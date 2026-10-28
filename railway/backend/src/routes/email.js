const express    = require('express');
const router     = express.Router();
const db         = require('../db');
const PDFDocument = require('pdfkit');

// ── Generar PDF del pedido con pdfkit ──────────────────────────
function generarPDFPedido(p, lineas, cfg) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const fmt = (n) => parseFloat(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });

    const dPct    = parseFloat(p.descuento_pct) || 0;
    const ivaPct  = parseFloat(p.porcentaje_iva) || 21;
    // Descuentos acumulados línea a línea
    const baseDesc = lineas.reduce((s, l) => {
      const base     = (parseFloat(l.cantidad_cajas)||0) * (parseFloat(l.botellas_por_caja)||0) * (parseFloat(l.precio_botella)||0);
      const dtoLinea = (l.descuento_linea_pct !== null && l.descuento_linea_pct !== undefined)
                       ? parseFloat(l.descuento_linea_pct) : 0;
      return s + base * (1 - dtoLinea / 100) * (1 - dPct / 100);
    }, 0);
    const ivaEuros = baseDesc * ivaPct / 100;
    const total    = baseDesc + ivaEuros;

    const fechaStr = p.fecha
      ? new Date(p.fecha).toLocaleDateString('es-ES')
      : '';

    const W = 515; // ancho útil
    const LEFT = 40;

    // ── Cabecera ──────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold')
       .text('EXCLUSIVAS VILLANUEVA, S.L.', LEFT, 40);
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#555')
       .text('Vinos con Denominación de Origen', LEFT, 62);
    doc.fillColor('#000');

    // Número de pedido (derecha)
    doc.fontSize(11).font('Helvetica-Bold')
       .text(`Pedido de compra nº ${p.serie_prefijo || ''}${p.numero}`, LEFT + 260, 40, { width: 255, align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor('#555')
       .text('Página 1 de 1', LEFT + 260, 56, { width: 255, align: 'right' })
       .text('Su refª.:', LEFT + 260, 68, { width: 255, align: 'right' })
       .text(`Fecha pedido:  ${fechaStr}`, LEFT + 260, 80, { width: 255, align: 'right' });
    doc.fillColor('#000');

    // Línea separadora
    doc.moveTo(LEFT, 98).lineTo(LEFT + W, 98).lineWidth(1.5).stroke();

    // ── Datos proveedor / cliente ─────────────────────────────
    const colW = W / 2 - 10;
    let y = 108;

    doc.fontSize(8).font('Helvetica-Bold').text('DATOS PROVEEDOR', LEFT, y);
    doc.fontSize(8).font('Helvetica-Bold').text('CLIENTE', LEFT + colW + 20, y);
    doc.moveTo(LEFT, y + 12).lineTo(LEFT + colW, y + 12).lineWidth(0.5).stroke();
    doc.moveTo(LEFT + colW + 20, y + 12).lineTo(LEFT + W, y + 12).lineWidth(0.5).stroke();

    y += 18;
    doc.fontSize(9).font('Helvetica-Bold').text(p.bodega_nombre || '', LEFT, y);
    doc.fontSize(9).font('Helvetica-Bold').text(p.entidad_nombre || '', LEFT + colW + 20, y);
    y += 13;
    doc.fontSize(8).font('Helvetica');
    if (p.bodega_direccion) { doc.text(p.bodega_direccion, LEFT, y); }
    if (p.direccion_fiscal)  { doc.text(p.direccion_fiscal, LEFT + colW + 20, y); }
    y += 11;
    const bodegaCPPob = [p.bodega_cp, p.bodega_poblacion].filter(Boolean).join(' ');
    const clienteCPPob = [p.cp_fiscal, p.poblacion_fiscal].filter(Boolean).join(' ');
    if (bodegaCPPob) doc.text(bodegaCPPob, LEFT, y);
    if (clienteCPPob) doc.text(clienteCPPob, LEFT + colW + 20, y);
    y += 11;
    if (p.bodega_provincia) doc.text(p.bodega_provincia, LEFT, y);
    if (p.provincia_fiscal)  doc.text(p.provincia_fiscal,  LEFT + colW + 20, y);
    y += 11;
    if (p.entidad_nif) doc.text(`NIF: ${p.entidad_nif}`, LEFT + colW + 20, y);

    // ── Tabla artículos ───────────────────────────────────────
    y += 22;
    doc.fontSize(8).font('Helvetica-Bold').text('ARTÍCULOS', LEFT, y);
    doc.moveTo(LEFT, y + 11).lineTo(LEFT + W, y + 11).lineWidth(0.5).stroke();
    y += 14;

    // Cabecera columnas
    const cols = [
      { label: 'Ref.',        x: LEFT,       w: 40,  align: 'left'  },
      { label: 'Descripción', x: LEFT + 42,  w: 160, align: 'left'  },
      { label: 'Cajas',       x: LEFT + 205, w: 45,  align: 'right' },
      { label: 'Uds.',        x: LEFT + 253, w: 40,  align: 'right' },
      { label: 'Precio ud.',  x: LEFT + 296, w: 55,  align: 'right' },
      { label: 'Dto.',        x: LEFT + 354, w: 40,  align: 'right' },
      { label: 'Precio neto', x: LEFT + 397, w: 55,  align: 'right' },
      { label: 'Importe',     x: LEFT + 455, w: 60,  align: 'right' },
    ];

    doc.fontSize(8).font('Helvetica-Bold');
    cols.forEach(c => doc.text(c.label, c.x, y, { width: c.w, align: c.align }));
    doc.moveTo(LEFT, y + 11).lineTo(LEFT + W, y + 11).lineWidth(0.5).stroke();
    y += 14;

    // Filas
    doc.font('Helvetica').fontSize(8);
    lineas.forEach(l => {
      const cajas    = parseFloat(l.cantidad_cajas) || 0;
      const cajasP   = parseFloat(l.cajas_promo)    || 0;
      const bpc      = parseFloat(l.botellas_por_caja) || 0;
      const pbot     = parseFloat(l.precio_botella) || 0;
      const uds      = cajas * bpc;
      const baseL    = cajas * bpc * pbot;
      // Descuentos acumulados: dto de línea (0 si no tiene) + dto del pedido
      const dtoLinea = (l.descuento_linea_pct !== null && l.descuento_linea_pct !== undefined)
                       ? parseFloat(l.descuento_linea_pct) : 0;
      const baseLD   = baseL * (1 - dtoLinea / 100) * (1 - dPct / 100);
      const dtoMostrar = dtoLinea > 0 ? dtoLinea : dPct;
      const pneto    = uds > 0 ? baseLD / uds : 0;
      const cajasStr = cajasP > 0 ? `${cajas}+${cajasP}` : `${cajas}`;

      doc.text(String(l.referencia_id || ''), cols[0].x, y, { width: cols[0].w, align: 'left' });
      doc.text(`${l.ref_codigo || ''} - ${l.ref_nombre || ''}`, cols[1].x, y, { width: cols[1].w, align: 'left' });
      doc.text(cajasStr,       cols[2].x, y, { width: cols[2].w, align: 'right' });
      doc.text(String(uds),    cols[3].x, y, { width: cols[3].w, align: 'right' });
      doc.text(fmt(pbot),      cols[4].x, y, { width: cols[4].w, align: 'right' });
      doc.text(dtoMostrar > 0 ? `${dtoMostrar}%` : '', cols[5].x, y, { width: cols[5].w, align: 'right' });
      doc.text(fmt(pneto),     cols[6].x, y, { width: cols[6].w, align: 'right' });
      doc.text(fmt(baseLD),    cols[7].x, y, { width: cols[7].w, align: 'right' });
      doc.moveTo(LEFT, y + 11).lineTo(LEFT + W, y + 11).lineWidth(0.3).strokeColor('#ccc').stroke();
      doc.strokeColor('#000');
      y += 14;
    });

    // ── Observaciones ─────────────────────────────────────────
    y += 8;
    doc.fontSize(8).font('Helvetica-Bold').text('OBSERVACIONES', LEFT, y);
    doc.moveTo(LEFT, y + 11).lineTo(LEFT / 2 + W / 2, y + 11).lineWidth(0.5).stroke();
    y += 16;
    if (p.observaciones) {
      doc.fontSize(8).font('Helvetica').text(p.observaciones, LEFT, y);
      y += 14;
    }

    // ── Tabla totales ─────────────────────────────────────────
    y += 10;
    const totX = LEFT + 200;
    const totW = W - 200;
    doc.fontSize(8).font('Helvetica-Bold');
    const totCols = [
      { label: 'Base Imponible', x: totX,       w: 80 },
      { label: '% IVA',          x: totX + 83,  w: 40 },
      { label: 'Cuota IVA',      x: totX + 126, w: 65 },
      { label: '% R.E.',         x: totX + 194, w: 40 },
      { label: 'Cuota R.E.',     x: totX + 237, w: 55 },
      { label: 'Total',          x: totX + 295, w: 60 },
    ];
    totCols.forEach(c => doc.text(c.label, c.x, y, { width: c.w, align: 'right' }));
    doc.moveTo(totX, y + 11).lineTo(LEFT + W, y + 11).lineWidth(0.5).stroke();
    doc.moveTo(totX, y - 1).lineTo(LEFT + W, y - 1).lineWidth(0.5).stroke();
    y += 14;
    doc.font('Helvetica').fontSize(8);
    doc.text(fmt(baseDesc),      totCols[0].x, y, { width: totCols[0].w, align: 'right' });
    doc.text(`${ivaPct},00`,     totCols[1].x, y, { width: totCols[1].w, align: 'right' });
    doc.text(fmt(ivaEuros),      totCols[2].x, y, { width: totCols[2].w, align: 'right' });
    doc.text('',                 totCols[3].x, y, { width: totCols[3].w, align: 'right' });
    doc.text('',                 totCols[4].x, y, { width: totCols[4].w, align: 'right' });
    doc.text(fmt(total),         totCols[5].x, y, { width: totCols[5].w, align: 'right' });

    // ── Gran total ────────────────────────────────────────────
    y += 28;
    doc.moveTo(LEFT + 350, y - 4).lineTo(LEFT + W, y - 4).lineWidth(1).stroke();
    doc.fontSize(14).font('Helvetica-Bold')
       .text('T O T A L', LEFT + 350, y, { width: 100, align: 'left' });
    doc.fontSize(14).font('Helvetica-Bold')
       .text(`${fmt(total)}€`, LEFT + 350, y, { width: W - 350, align: 'right' });

    // ── Pie de página ─────────────────────────────────────────
    const pieY = doc.page.height - 110;
    doc.moveTo(LEFT, pieY).lineTo(LEFT + W, pieY).lineWidth(0.5).stroke();

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#333')
       .text('Nuestra dirección postal', LEFT, pieY + 6)
       .text('Nuestros datos de contacto', LEFT + 200, pieY + 6);

    doc.font('Helvetica').fillColor('#555');
    const dir = [cfg?.direccion, [cfg?.cp, cfg?.poblacion].filter(Boolean).join(' '), cfg?.provincia || 'Asturias', 'España'].filter(Boolean);
    dir.forEach((l, i) => doc.text(l, LEFT, pieY + 17 + i * 10));

    let cY = pieY + 17;
    if (cfg?.telefono) { doc.text(`Tfno: ${cfg.telefono}`, LEFT + 200, cY); cY += 10; }
    if (cfg?.movil)    { doc.text(`Móvil: ${cfg.movil}`,   LEFT + 200, cY); cY += 10; }
    if (cfg?.email)    { doc.text(`Email: ${cfg.email}`,   LEFT + 200, cY); }

    doc.fillColor('#000');
    doc.end();
  });
}

// ── Función de envío via Resend ───────────────────────────────
async function sendEmail({ to, subject, html, text, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY no configurada en las variables de entorno de Render.');

  const from = 'Exclusivas Villanueva <onboarding@resend.dev>';

  const body = { from, to, subject, html };
  if (text)        body.text        = text;
  if (attachments) body.attachments = attachments;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error al enviar email');
  return data;
}

// ── POST /email/pedido/:id ─────────────────────────────────────
router.post('/pedido/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*,
              e.email AS entidad_email, e.nombre_comercial AS entidad_nombre,
              e.nif AS entidad_nif, e.direccion_fiscal, e.poblacion_fiscal,
              e.cp_fiscal, e.provincia_fiscal,
              eb.email AS bodega_email, eb.nombre_comercial AS bodega_nombre,
              eb.direccion_fiscal AS bodega_direccion, eb.poblacion_fiscal AS bodega_poblacion,
              eb.cp_fiscal AS bodega_cp, eb.provincia_fiscal AS bodega_provincia,
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
    const observaciones = req.body.observaciones || '';

    // Calcular totales para el email
    const dPct   = parseFloat(p.descuento_pct) || 0;
    const ivaPct = parseFloat(p.porcentaje_iva) || 21;
    const fmt = (n) => parseFloat(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    const fechaStr = p.fecha ? new Date(p.fecha).toLocaleDateString('es-ES') : '';
    const numeroPedido = `${p.serie_prefijo || ''}${p.numero}`;
    const comercialNombre = cfg?.nombre_comercial || 'Exclusivas Villanueva';

    // ── Filas de la tabla del email ───────────────────────────
    const lineasHTML = lineas.map(l => {
      const cajas    = parseFloat(l.cantidad_cajas) || 0;
      const cajasP   = parseFloat(l.cajas_promo)    || 0;
      const bpc      = parseFloat(l.botellas_por_caja) || 0;
      const pbot     = parseFloat(l.precio_botella) || 0;
      const botellas = (cajas + cajasP) * bpc;
      const baseL    = cajas * bpc * pbot;
      // Descuentos acumulados: dto de línea (0 si no tiene) + dto del pedido
      const dtoLinea = (l.descuento_linea_pct !== null && l.descuento_linea_pct !== undefined)
        ? parseFloat(l.descuento_linea_pct) : 0;
      const baseLD   = baseL * (1 - dtoLinea / 100) * (1 - dPct / 100);
      // En la columna % Dto. mostramos el descuento de línea (si lo hay), o el de pedido (si lo hay)
      const dtoMostrar = dtoLinea > 0 ? dtoLinea : (dPct > 0 ? dPct : 0);
      return `
        <tr>
          <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;white-space:nowrap">${l.ref_nombre}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;white-space:nowrap">${cajasP > 0 ? cajas + '+' + cajasP : cajas}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;white-space:nowrap">${botellas}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;white-space:nowrap">${fmt(pbot)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;white-space:nowrap">${dtoMostrar > 0 ? dtoMostrar + '%' : '—'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;white-space:nowrap"><b>${fmt(baseLD)}</b></td>
        </tr>`;
    }).join('');

    // ── HTML del email ────────────────────────────────────────
    const obsHTML = observaciones
      ? `<p style="margin-bottom:16px;white-space:pre-wrap">${observaciones}</p>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;max-width:680px;margin:0 auto;padding:20px">

  <p style="margin-bottom:16px">
    Adjunto remitimos N/pedido nº <strong>${numeroPedido}</strong> de
    fecha <strong>${fechaStr}</strong> correspondiente al cliente
    <strong>${p.entidad_nombre}</strong>, con el siguiente detalle:
  </p>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
    <thead>
      <tr style="border-bottom:2px solid #333">
        <th style="padding:7px 8px;text-align:left;font-weight:bold">Producto</th>
        <th style="padding:7px 8px;text-align:right;font-weight:bold">Cajas</th>
        <th style="padding:7px 8px;text-align:right;font-weight:bold">Botellas</th>
        <th style="padding:7px 8px;text-align:right;font-weight:bold">Precio/bot.</th>
        <th style="padding:7px 8px;text-align:right;font-weight:bold">% Dto.</th>
        <th style="padding:7px 8px;text-align:right;font-weight:bold">Importe</th>
      </tr>
    </thead>
    <tbody>${lineasHTML}</tbody>
  </table>

  ${obsHTML}
  <p style="margin-bottom:24px">Un cordial saludo.</p>

  <p style="margin-bottom:4px"><strong>${comercialNombre}</strong></p>
  ${cfg?.telefono ? `<p style="margin:2px 0;color:#555">Tfno./Fax: ${cfg.telefono}</p>` : ''}
  ${cfg?.movil    ? `<p style="margin:2px 0;color:#555">Móvil: ${cfg.movil}</p>`         : ''}
  ${cfg?.email    ? `<p style="margin:2px 0"><a href="mailto:${cfg.email}" style="color:#1a73e8">${cfg.email}</a></p>` : ''}

</body>
</html>`;

    // ── Generar PDF adjunto ───────────────────────────────────
    const pdfBuffer = await generarPDFPedido(p, lineas, cfg);
    const pdfBase64 = pdfBuffer.toString('base64');

    await sendEmail({
      to: destinatario,
      subject: `Pedido ${numeroPedido} — ${p.entidad_nombre}`,
      html,
      attachments: [{
        filename: `Pedido_${numeroPedido}.pdf`,
        content:  pdfBase64
      }]
    });

    await db.query(
      `UPDATE pedidos SET email_enviado=true, fecha_email=NOW() WHERE id=$1`, [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /email/test ───────────────────────────────────────────
router.post('/test', async (req, res) => {
  try {
    const { rows: [cfg] } = await db.query(`SELECT * FROM configuracion WHERE id=1`);
    const to = req.body.email || cfg?.email;
    if (!to) return res.status(400).json({ error: 'No hay email destino configurado' });
    await sendEmail({
      to,
      subject: 'Test email — Exclusivas Villanueva',
      html: '<p>Si recibes este mensaje, el correo funciona correctamente.</p>'
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
