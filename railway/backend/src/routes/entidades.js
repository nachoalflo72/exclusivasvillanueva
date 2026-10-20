const express = require('express');
const router  = express.Router();
const db      = require('../db');

const TIPOS = ['bodega', 'cliente', 'comercial', 'distribuidor'];

router.get('/', async (req, res) => {
  try {
    const { tipo, activa, q } = req.query;
    let sql = `SELECT * FROM entidades WHERE 1=1`;
    const params = [];
    if (tipo)   { params.push(tipo);   sql += ` AND tipo = $${params.length}`; }
    if (activa !== undefined) { params.push(activa === 'true'); sql += ` AND activa = $${params.length}`; }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (nombre_comercial ILIKE $${params.length} OR codigo ILIKE $${params.length})`;
    }
    sql += ` ORDER BY nombre_comercial`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM entidades WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const {
    tipo, codigo, nombre_comercial, nombre_fiscal, nif,
    persona_contacto, telefono, movil, email,
    direccion_fiscal, poblacion_fiscal, provincia_fiscal, cp_fiscal,
    direccion_almacen, poblacion_almacen, provincia_almacen, cp_almacen,
    forma_pago, cuenta_bancaria, comision_defecto, observaciones
  } = req.body;
  if (!TIPOS.includes(tipo)) return res.status(400).json({ error: `Tipo inválido: ${TIPOS.join(', ')}` });
  try {
    const { rows } = await db.query(
      `INSERT INTO entidades (tipo,codigo,nombre_comercial,nombre_fiscal,nif,persona_contacto,telefono,movil,email,
        direccion_fiscal,poblacion_fiscal,provincia_fiscal,cp_fiscal,
        direccion_almacen,poblacion_almacen,provincia_almacen,cp_almacen,
        forma_pago,cuenta_bancaria,comision_defecto,observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [tipo,codigo,nombre_comercial,nombre_fiscal,nif,persona_contacto,telefono,movil,email,
       direccion_fiscal,poblacion_fiscal,provincia_fiscal,cp_fiscal,
       direccion_almacen,poblacion_almacen,provincia_almacen,cp_almacen,
       forma_pago,cuenta_bancaria,comision_defecto||0,observaciones]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const {
    tipo,codigo,nombre_comercial,nombre_fiscal,nif,persona_contacto,telefono,movil,email,
    direccion_fiscal,poblacion_fiscal,provincia_fiscal,cp_fiscal,
    direccion_almacen,poblacion_almacen,provincia_almacen,cp_almacen,
    forma_pago,cuenta_bancaria,comision_defecto,activa,observaciones
  } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE entidades SET tipo=$1,codigo=$2,nombre_comercial=$3,nombre_fiscal=$4,nif=$5,
        persona_contacto=$6,telefono=$7,movil=$8,email=$9,
        direccion_fiscal=$10,poblacion_fiscal=$11,provincia_fiscal=$12,cp_fiscal=$13,
        direccion_almacen=$14,poblacion_almacen=$15,provincia_almacen=$16,cp_almacen=$17,
        forma_pago=$18,cuenta_bancaria=$19,comision_defecto=$20,activa=$21,observaciones=$22
       WHERE id=$23 RETURNING *`,
      [tipo,codigo,nombre_comercial,nombre_fiscal,nif,persona_contacto,telefono,movil,email,
       direccion_fiscal,poblacion_fiscal,provincia_fiscal,cp_fiscal,
       direccion_almacen,poblacion_almacen,provincia_almacen,cp_almacen,
       forma_pago,cuenta_bancaria,comision_defecto||0,activa,observaciones,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query(`UPDATE entidades SET activa=false WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
