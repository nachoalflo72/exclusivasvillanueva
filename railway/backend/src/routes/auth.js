const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign(
      { id: user.id, email: user.email, nombre: user.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, usuario: { id: user.id, email: user.email, nombre: user.nombre } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
