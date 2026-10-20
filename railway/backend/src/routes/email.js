const express    = require('express');
const router     = express.Router();
const db         = require('../db');
const nodemailer = require('nodemailer');

async function getTransporter() {
  const { rows } = await db.query(`SELECT * FROM configuracion WHERE id=1`);
  const cfg = rows[0] || {};
  if (!cfg.smtp_host) throw new Error('SMTP no configurado. Ve a Configuración y guarda los datos de correo.');

  const port = parseInt(cfg.smtp_puerto || 587);
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: cfg.smtp_usuario, pass: cfg.smtp_password },
    tls: { rejectUnauthorized: false }
  });
}

router.post('/pedido/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*,
              e.email AS entidad_email, e.nombre_comercial AS entidad_nombre,
              eb.email AS bodega_email, eb.nombre_comercial AS bodega_nombre,
              s.prefijo AS serie_prefijo
       FROM pedidos p
       LEFT JOIN entidades e   ON e.id  = p.entidad_id
       LEFT JOIN entidades eb  ON eb.id = p.bodega_entidad_id
       LEFT JOIN series_pedido s ON s.id = p.serie_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    const p = rows[0];

    const { rows: lineas } = await db.query(
      `SELECT lp.*, r.codigo AS ref_codigo, r.nombre AS ref_nombre
       FROM lineas_pedido lp JOIN referencias r ON r.id=lp.referencia_id
       WHERE lp.pedido_id=$1 ORDER BY lp.id`, [req.params.id]
    );

    const { rows: [cfg] } = await db.query(`SELECT * FROM configuracion WHERE id=1`);

    const destinatario = req.body.email || p.bodega_email;
    if (!destinatario) return res.status(400).json({ error: 'Sin email destinatario' });

    const lineasHTML = lineas.map(l =>
      `<tr>
        <td>${l.ref_codigo}</td><td>${l.ref_nombre}</td>
        <td style="text-align:right">${l.cantidad_cajas}</td>
        <td style="text-align:right">${l.cajas_promo || 0}</td>
        <td style="text-align:right">${l.botellas_por_caja}</td>
        <td style="text-align:right">${parseFloat(l.precio_botella).toFixed(2)} €</td>
        <td style="text-align:right">${parseFloat(l.base_imponible).toFixed(2)} €</td>
      </tr>`
    ).join('');

    const html = `
      <h2>Pedido ${p.serie_prefijo || ''}${p.numero} — ${p.entidad_nombre}</h2>
      <p><b>Fecha:</b> ${p.fecha} &nbsp; <b>Bodega:</b> ${p.bodega_nombre}</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px">
        <thead style="background:#f0f0f0">
          <tr><th>Código</th><th>Referencia</th><th>Cajas</th><th>Promo</th><th>Bot/caja</th><th>Precio bot.</th><th>Base</th></tr>
        </thead>
        <tbody>${lineasHTML}</tbody>
        <tfoot>
          <tr><td colspan="6" align="right"><b>Base imponible</b></td><td align="right">${parseFloat(p.base_imponible).toFixed(2)} €</td></tr>
          <tr><td colspan="6" align="right"><b>IVA ${p.porcentaje_iva}%</b></td><td align="right">${parseFloat(p.iva).toFixed(2)} €</td></tr>
          <tr><td colspan="6" align="right"><b>TOTAL</b></td><td align="right"><b>${parseFloat(p.total).toFixed(2)} €</b></td></tr>
        </tfoot>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#666">${cfg?.nombre_comercial || 'Exclusivas Villanueva'}</p>
    `;

    const transporter = await getTransporter();
    await transporter.sendMail({
      from: cfg.smtp_remitente || cfg.smtp_usuario,
      to:   destinatario,
      subject: `Pedido ${p.serie_prefijo || ''}${p.numero} — ${p.entidad_nombre}`,
      html
    });

    await db.query(
      `UPDATE pedidos SET email_enviado=true, fecha_email=NOW() WHERE id=$1`, [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/test', async (req, res) => {
  try {
    const transporter = await getTransporter();
    const { rows: [cfg] } = await db.query(`SELECT * FROM configuracion WHERE id=1`);
    await transporter.sendMail({
      from: cfg.smtp_remitente || cfg.smtp_usuario,
      to:   req.body.email || cfg.email,
      subject: 'Test email — Exclusivas Villanueva',
      text:    'Si recibes este mensaje, el correo funciona correctamente.'
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
