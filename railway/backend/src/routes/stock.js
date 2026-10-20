const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, r.codigo, r.nombre, r.botellas_por_caja,
              e.nombre_comercial AS bodega_nombre
       FROM stock s
       JOIN referencias r ON r.id = s.referencia_id
       JOIN entidades e   ON e.id = r.bodega_entidad_id
       ORDER BY e.nombre_comercial, r.codigo`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/ajuste', async (req, res) => {
  const { referencia_id, cantidad_cajas, motivo } = req.body;
  try {
    await db.query(
      `INSERT INTO stock (referencia_id, cantidad_cajas)
       VALUES ($1, $2)
       ON CONFLICT (referencia_id) DO UPDATE SET cantidad_cajas = $2, updated_at = NOW()`,
      [referencia_id, cantidad_cajas]
    );
    await db.query(
      `INSERT INTO movimientos_stock (referencia_id, tipo, cantidad_cajas, motivo)
       VALUES ($1, 'ajuste', $2, $3)`,
      [referencia_id, Math.abs(cantidad_cajas), motivo || 'ajuste manual']
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
