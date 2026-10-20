const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM configuracion WHERE id = 1');
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  const {
    nombre_comercial, nif, direccion, poblacion, provincia, cp, telefono, email,
    smtp_host, smtp_puerto, smtp_usuario, smtp_password, smtp_remitente, iva_defecto
  } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO configuracion (id, nombre_comercial, nif, direccion, poblacion, provincia, cp, telefono, email,
        smtp_host, smtp_puerto, smtp_usuario, smtp_password, smtp_remitente, iva_defecto)
       VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
        nombre_comercial=$1, nif=$2, direccion=$3, poblacion=$4, provincia=$5, cp=$6, telefono=$7, email=$8,
        smtp_host=$9, smtp_puerto=$10, smtp_usuario=$11, smtp_password=$12, smtp_remitente=$13, iva_defecto=$14,
        updated_at=NOW()
       RETURNING *`,
      [nombre_comercial, nif, direccion, poblacion, provincia, cp, telefono, email,
       smtp_host, smtp_puerto || 587, smtp_usuario, smtp_password, smtp_remitente, iva_defecto || 21]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
