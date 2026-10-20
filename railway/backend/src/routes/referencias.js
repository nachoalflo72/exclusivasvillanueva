const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', async (req, res) => {
  try {
    const { bodega_id, activa, q } = req.query;
    let sql = `SELECT r.*, e.nombre_comercial AS bodega_nombre
               FROM referencias r
               JOIN entidades e ON e.id = r.bodega_entidad_id
               WHERE 1=1`;
    const params = [];
    if (bodega_id) { params.push(bodega_id); sql += ` AND r.bodega_entidad_id = $${params.length}`; }
    if (activa !== undefined) { params.push(activa === 'true'); sql += ` AND r.activa = $${params.length}`; }
    if (q) { params.push(`%${q}%`); sql += ` AND (r.codigo ILIKE $${params.length} OR r.nombre ILIKE $${params.length})`; }
    sql += ` ORDER BY r.codigo`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, e.nombre_comercial AS bodega_nombre FROM referencias r JOIN entidades e ON e.id=r.bodega_entidad_id WHERE r.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { codigo, nombre, bodega_entidad_id, precio_compra, precio_venta, botellas_por_caja,
          comision, promo_activa, promo_cajas_compra, promo_cajas_regalo, observaciones } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO referencias (codigo,nombre,bodega_entidad_id,precio_compra,precio_venta,botellas_por_caja,
        comision,promo_activa,promo_cajas_compra,promo_cajas_regalo,observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [codigo,nombre,bodega_entidad_id,precio_compra||0,precio_venta||0,botellas_por_caja||6,
       comision||0,promo_activa||false,promo_cajas_compra,promo_cajas_regalo,observaciones]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { codigo, nombre, bodega_entidad_id, precio_compra, precio_venta, botellas_por_caja,
          comision, promo_activa, promo_cajas_compra, promo_cajas_regalo, activa, observaciones } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE referencias SET codigo=$1,nombre=$2,bodega_entidad_id=$3,precio_compra=$4,precio_venta=$5,
        botellas_por_caja=$6,comision=$7,promo_activa=$8,promo_cajas_compra=$9,promo_cajas_regalo=$10,
        activa=$11,observaciones=$12 WHERE id=$13 RETURNING *`,
      [codigo,nombre,bodega_entidad_id,precio_compra||0,precio_venta||0,botellas_por_caja||6,
       comision||0,promo_activa||false,promo_cajas_compra,promo_cajas_regalo,activa,observaciones,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query(`UPDATE referencias SET activa=false WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
