const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', async (req, res) => {
  try {
    const { desde, hasta, bodega_id, liquidada } = req.query;
    let sql = `SELECT p.*,
                 e.nombre_comercial  AS entidad_nombre,
                 eb.nombre_comercial AS bodega_nombre,
                 s.prefijo           AS serie_prefijo,
                 COALESCE((
                   SELECT SUM(lp.importe_comision)
                   FROM lineas_pedido lp
                   WHERE lp.pedido_id = p.id
                 ), 0) AS total_comisiones_real
               FROM pedidos p
               LEFT JOIN entidades e   ON e.id  = p.entidad_id
               LEFT JOIN entidades eb  ON eb.id = p.bodega_entidad_id
               LEFT JOIN series_pedido s ON s.id = p.serie_id
               WHERE COALESCE((
                 SELECT SUM(lp.importe_comision)
                 FROM lineas_pedido lp
                 WHERE lp.pedido_id = p.id
               ), 0) > 0`;
    const params = [];
    if (desde)    { params.push(desde);    sql += ` AND p.fecha >= $${params.length}`; }
    if (hasta)    { params.push(hasta);    sql += ` AND p.fecha <= $${params.length}`; }
    if (bodega_id){ params.push(bodega_id);sql += ` AND p.bodega_entidad_id = $${params.length}`; }
    if (liquidada !== undefined) {
      params.push(liquidada === 'true');
      sql += ` AND p.comision_liquidada = $${params.length}`;
    }
    sql += ` ORDER BY p.fecha DESC`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/liquidar', async (req, res) => {
  const { pedido_ids } = req.body;
  try {
    await db.query(
      `UPDATE pedidos SET comision_liquidada=true, fecha_liquidacion=NOW()
       WHERE id = ANY($1::int[])`,
      [pedido_ids]
    );
    res.json({ ok: true, count: pedido_ids.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
