const express = require('express');
const router  = express.Router();
const db      = require('../db');

// Migración: tabla de tarifas por entidad
db.query(`
  CREATE TABLE IF NOT EXISTS referencia_tarifas (
    id            SERIAL PRIMARY KEY,
    referencia_id INTEGER NOT NULL REFERENCES referencias(id) ON DELETE CASCADE,
    entidad_id    INTEGER NOT NULL REFERENCES entidades(id)   ON DELETE CASCADE,
    precio_venta  NUMERIC(10,4) NOT NULL DEFAULT 0,
    UNIQUE (referencia_id, entidad_id)
  )
`).catch(() => {});

// ── Referencias ───────────────────────────────────────────────────────────────

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

// ── Tarifas por entidad ───────────────────────────────────────────────────────

// GET /referencias/:id/tarifas  → lista tarifas de una referencia
router.get('/:id/tarifas', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*, e.nombre_comercial AS entidad_nombre
       FROM referencia_tarifas t
       JOIN entidades e ON e.id = t.entidad_id
       WHERE t.referencia_id = $1
       ORDER BY e.nombre_comercial`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /referencias/:id/tarifas  → crear o actualizar tarifa (upsert)
router.post('/:id/tarifas', async (req, res) => {
  const { entidad_id, precio_venta } = req.body;
  if (!entidad_id) return res.status(400).json({ error: 'entidad_id requerido' });
  try {
    const { rows } = await db.query(
      `INSERT INTO referencia_tarifas (referencia_id, entidad_id, precio_venta)
       VALUES ($1, $2, $3)
       ON CONFLICT (referencia_id, entidad_id)
       DO UPDATE SET precio_venta = EXCLUDED.precio_venta
       RETURNING *`,
      [req.params.id, entidad_id, precio_venta || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /referencias/:id/tarifas/:tarifaId
router.delete('/:id/tarifas/:tarifaId', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM referencia_tarifas WHERE id = $1 AND referencia_id = $2`,
      [req.params.tarifaId, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /referencias/tarifa?referencia_id=X&entidad_id=Y
// Usado por Pedidos para saber el precio correcto al seleccionar referencia+cliente
router.get('/tarifa/precio', async (req, res) => {
  const { referencia_id, entidad_id } = req.query;
  if (!referencia_id || !entidad_id) return res.status(400).json({ error: 'Faltan parámetros' });
  try {
    // Busca tarifa específica; si no existe devuelve precio_venta por defecto
    const { rows } = await db.query(
      `SELECT
         COALESCE(t.precio_venta, r.precio_venta) AS precio_venta,
         t.id AS tarifa_id
       FROM referencias r
       LEFT JOIN referencia_tarifas t
         ON t.referencia_id = r.id AND t.entidad_id = $2
       WHERE r.id = $1`,
      [referencia_id, entidad_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Referencia no encontrada' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
