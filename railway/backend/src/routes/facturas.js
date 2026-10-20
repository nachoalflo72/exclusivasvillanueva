const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', async (req, res) => {
  try {
    const { desde, hasta, entidad_id, estado } = req.query;
    let sql = `SELECT f.*, e.nombre_comercial AS entidad_nombre, e.codigo AS entidad_codigo
               FROM facturas f LEFT JOIN entidades e ON e.id = f.entidad_id WHERE 1=1`;
    const params = [];
    if (desde)      { params.push(desde);      sql += ` AND f.fecha >= $${params.length}`; }
    if (hasta)      { params.push(hasta);      sql += ` AND f.fecha <= $${params.length}`; }
    if (entidad_id) { params.push(entidad_id); sql += ` AND f.entidad_id = $${params.length}`; }
    if (estado)     { params.push(estado);     sql += ` AND f.estado = $${params.length}`; }
    sql += ` ORDER BY f.fecha DESC, f.id DESC`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const factura = await db.query(
      `SELECT f.*, e.nombre_comercial AS entidad_nombre, e.nif AS entidad_nif,
              e.direccion_fiscal, e.poblacion_fiscal, e.cp_fiscal
       FROM facturas f LEFT JOIN entidades e ON e.id=f.entidad_id WHERE f.id=$1`,
      [req.params.id]
    );
    if (!factura.rows.length) return res.status(404).json({ error: 'No encontrada' });
    const lineas = await db.query(
      `SELECT lf.*, r.codigo AS ref_codigo, r.nombre AS ref_nombre
       FROM lineas_factura lf LEFT JOIN referencias r ON r.id=lf.referencia_id
       WHERE lf.factura_id=$1 ORDER BY lf.id`, [req.params.id]
    );
    res.json({ ...factura.rows[0], lineas: lineas.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { numero, fecha, entidad_id, base_imponible, porcentaje_iva, observaciones, lineas } = req.body;
    const piva  = parseFloat(porcentaje_iva || 21);
    const base  = parseFloat(base_imponible || 0);
    const iva   = base * piva / 100;
    const total = base + iva;

    const { rows: [factura] } = await db.query(
      `INSERT INTO facturas (numero,fecha,entidad_id,base_imponible,porcentaje_iva,iva,total,observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [numero, fecha, entidad_id, base.toFixed(2), piva, iva.toFixed(2), total.toFixed(2), observaciones]
    );

    if (lineas && lineas.length) {
      for (const l of lineas) {
        await db.query(
          `INSERT INTO lineas_factura (factura_id,pedido_id,referencia_id,descripcion,cantidad_cajas,precio_unitario,base_imponible)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [factura.id, l.pedido_id || null, l.referencia_id || null, l.descripcion,
           l.cantidad_cajas || null, l.precio_unitario || null, l.base_imponible || 0]
        );
      }
    }
    res.status(201).json(factura);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/estado', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE facturas SET estado=$1 WHERE id=$2 RETURNING *`, [req.body.estado, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
