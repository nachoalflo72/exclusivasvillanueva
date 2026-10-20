const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM series_pedido ORDER BY nombre`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { nombre, prefijo, descripcion } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO series_pedido (nombre, prefijo, descripcion) VALUES ($1,$2,$3) RETURNING *`,
      [nombre, prefijo, descripcion]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { nombre, prefijo, descripcion, activa } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE series_pedido SET nombre=$1,prefijo=$2,descripcion=$3,activa=$4 WHERE id=$5 RETURNING *`,
      [nombre, prefijo, descripcion, activa, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
