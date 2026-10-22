const express = require('express');
const router  = express.Router();
const db      = require('../db');

// Migraciones seguras
db.query(`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS movil TEXT`).catch(() => {});
db.query(`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS logo TEXT`).catch(() => {});

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM configuracion WHERE id = 1');
    res.json(rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  const {
    nombre_comercial, nif, direccion, poblacion, provincia, cp, telefono, movil, email,
    smtp_host, smtp_puerto, smtp_usuario, smtp_password, smtp_remitente, iva_defecto, logo
  } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO configuracion (id, nombre_comercial, nif, direccion, poblacion, provincia, cp, telefono, movil, email,
        smtp_host, smtp_puerto, smtp_usuario, smtp_password, smtp_remitente, iva_defecto, logo)
       VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
        nombre_comercial=$1, nif=$2, direccion=$3, poblacion=$4, provincia=$5, cp=$6, telefono=$7, movil=$8, email=$9,
        smtp_host=$10, smtp_puerto=$11, smtp_usuario=$12, smtp_password=$13, smtp_remitente=$14, iva_defecto=$15,
        logo=$16, updated_at=NOW()
       RETURNING *`,
      [nombre_comercial, nif, direccion, poblacion, provincia, cp, telefono, movil || null, email,
       smtp_host, smtp_puerto || 587, smtp_usuario, smtp_password, smtp_remitente, iva_defecto || 21,
       logo || null]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
