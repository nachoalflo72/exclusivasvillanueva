const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos subidos (albaranes)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/configuracion', require('./routes/configuracion'));
app.use('/api/entidades',     require('./routes/entidades'));
app.use('/api/series',        require('./routes/series'));
app.use('/api/referencias',   require('./routes/referencias'));
app.use('/api/pedidos',       require('./routes/pedidos'));
app.use('/api/facturas',      require('./routes/facturas'));
app.use('/api/stock',         require('./routes/stock'));
app.use('/api/comisiones',    require('./routes/comisiones'));
app.use('/api/consultas',     require('./routes/consultas'));
app.use('/api/email',         require('./routes/email'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Servir frontend (build de React) ───────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno', detalle: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅  Servidor en http://localhost:${PORT}`));
