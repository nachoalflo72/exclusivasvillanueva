import { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { SectionTitle, Modal, Spinner, EmptyState, Money, FechaCorta, EstadoBadge, useToast } from '../components/UI';

const ESTADOS = ['borrador','enviado','servido','facturado','anulado'];

// Calcula base imponible de una línea
const baseLinea = (l) => {
  const cajas = parseFloat(l.cantidad_cajas) || 0;
  const bpc   = parseFloat(l.botellas_por_caja) || 0;
  const pbot  = parseFloat(l.precio_botella) || 0;
  return cajas * bpc * pbot;
};

// Calcula base con descuento de una línea (usa descuento de línea si existe, si no el del pedido)
const baseDescLinea = (l, descuentoPedidoPct) => {
  const base = baseLinea(l);
  const dPct = parseFloat(l.descuento_linea_pct ?? descuentoPedidoPct) || 0;
  return base * (1 - dPct / 100);
};

// Calcula importe comisión de una línea
const comisionLinea = (l, descuentoPct) => {
  const baseDesc = baseDescLinea(l, descuentoPct);
  const pct = parseFloat(l.comision_pct) || 0;
  return baseDesc * pct / 100;
};

export default function Pedidos() {
  const toast = useToast();
  const [lista,      setLista]      = useState([]);
  const [series,     setSeries]     = useState([]);
  const [entidades,  setEntidades]  = useState([]);
  const [bodegas,    setBodegas]    = useState([]);
  const [referencias,setReferencias]= useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [pedidoSel,  setPedidoSel]  = useState(null);
  const [saving,     setSaving]     = useState(false);

  // Estado editable para el detalle
  const [detForm,   setDetForm]   = useState({});
  const [detLineas, setDetLineas] = useState([]);

  const [fEstado, setFEstado] = useState('');
  const [fDesde,  setFDesde]  = useState('');
  const [fHasta,  setFHasta]  = useState('');

  // Vista previa email
  const [emailModal,    setEmailModal]    = useState(null); // { pedidoId, bodegaEmail, lineas, descPct, ivaPct, pedido }
  const [emailObs,      setEmailObs]      = useState('');
  const [emailSending,  setEmailSending]  = useState(false);

  const FORM_EMPTY = { fecha: new Date().toISOString().split('T')[0], serie_id: '', entidad_id: '', bodega_entidad_id: '', porcentaje_iva: 21, descuento_pct: 0, observaciones: '' };
  const [form,   setForm]   = useState(FORM_EMPTY);
  const [lineas, setLineas] = useState([]);

  // ── Totales calculados en tiempo real ──────────────────────
  const totales = useMemo(() => {
    const descPct  = parseFloat(form.descuento_pct) || 0;
    const ivaPct   = parseFloat(form.porcentaje_iva) || 0;
    const baseTotal = lineas.reduce((s, l) => s + baseLinea(l), 0);
    const descEuros = baseTotal * descPct / 100;
    const baseDesc  = baseTotal - descEuros;
    const iva       = baseDesc * ivaPct / 100;
    const total     = baseDesc + iva;
    const comision  = lineas.reduce((s, l) => s + comisionLinea(l, descPct), 0);
    return { baseTotal, descEuros, baseDesc, iva, total, comision };
  }, [lineas, form.descuento_pct, form.porcentaje_iva]);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fEstado) params.set('estado', fEstado);
      if (fDesde)  params.set('desde',  fDesde);
      if (fHasta)  params.set('hasta',  fHasta);
      const { data } = await api.get(`/pedidos?${params}`);
      setLista(data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    Promise.all([
      api.get('/series'),
      api.get('/entidades?tipo=cliente&activa=true'),
      api.get('/entidades?tipo=bodega&activa=true'),
      api.get('/referencias?activa=true'),
    ]).then(([s, e, b, r]) => {
      setSeries(s.data); setEntidades(e.data); setBodegas(b.data); setReferencias(r.data);
    });
    cargar();
  }, []);

  const abrirDetalle = async (id) => {
    try {
      const { data } = await api.get(`/pedidos/${id}`);
      setPedidoSel(data);
      setDetForm({ descuento_pct: data.descuento_pct || 0, porcentaje_iva: data.porcentaje_iva || 21 });
      setDetLineas(data.lineas || []);
      setModal('detalle');
    } catch (e) { toast(e.message, 'error'); }
  };

  const agregarLinea = () => setLineas(l => [...l, {
    referencia_id: '', cantidad_cajas: 1, cajas_promo: 0,
    botellas_por_caja: 6, precio_botella: 0, comision_pct: 0
  }]);

  const setLinea = (i, k, v) => setLineas(l => l.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const quitarLinea = (i) => setLineas(l => l.filter((_, idx) => idx !== i));

  const onRefChange = (i, ref_id) => {
    const ref = referencias.find(r => r.id == ref_id);
    if (ref) {
      setLineas(l => l.map((x, idx) => idx === i ? {
        ...x, referencia_id: ref_id,
        botellas_por_caja: ref.botellas_por_caja,
        precio_botella: ref.precio_venta,
        comision_pct: ref.comision
      } : x));
    }
  };

  const guardar = async () => {
    if (!form.serie_id || !form.entidad_id || !form.bodega_entidad_id)
      return toast('Serie, cliente y bodega son obligatorios', 'error');
    if (lineas.length === 0) return toast('Añade al menos una línea', 'error');
    setSaving(true);
    try {
      await api.post('/pedidos', { ...form, lineas });
      toast('Pedido creado', 'success');
      setModal(false);
      setLineas([]);
      setForm(FORM_EMPTY);
      cargar();
    } catch (e) { toast(e.message, 'error'); }
    finally     { setSaving(false); }
  };

  const cambiarEstado = async (id, estado) => {
    try {
      await api.put(`/pedidos/${id}/estado`, { estado });
      toast('Estado actualizado', 'success');
      cargar();
      if (pedidoSel) { const { data } = await api.get(`/pedidos/${id}`); setPedidoSel(data); }
    } catch (e) { toast(e.message, 'error'); }
  };

  const abrirVistaPrevia = (pedido, lineas, descPct, ivaPct) => {
    setEmailObs('');
    setEmailModal({ pedido, lineas, descPct, ivaPct });
  };

  const confirmarEnvioEmail = async () => {
    if (!emailModal) return;
    setEmailSending(true);
    try {
      await api.post(`/email/pedido/${emailModal.pedido.id}`, {
        email: emailModal.pedido.bodega_email,
        observaciones: emailObs,
      });
      // Cambiar estado a enviado
      await api.put(`/pedidos/${emailModal.pedido.id}/estado`, { estado: 'enviado' });
      toast('Email enviado y pedido marcado como Enviado', 'success');
      setEmailModal(null);
      cargar();
      // Actualizar pedidoSel si está abierto
      if (pedidoSel?.id === emailModal.pedido.id) {
        const { data } = await api.get(`/pedidos/${emailModal.pedido.id}`);
        setPedidoSel(data);
      }
    } catch (e) { toast(e.message, 'error'); }
    finally { setEmailSending(false); }
  };

  const imprimirPedido = async (pedido, lineas, descPct, ivaPct) => {
    // Cargar configuración del comercial
    let cfg = {};
    try { const { data } = await api.get('/configuracion'); cfg = data || {}; } catch {}

    const fmt = (n) => parseFloat(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const baseTotal = lineas.reduce((s, l) => s + baseLinea(l), 0);
    const descEuros = baseTotal * descPct / 100;
    const baseDesc  = baseTotal - descEuros;
    const ivaEuros  = baseDesc * ivaPct / 100;
    const total     = baseDesc + ivaEuros;

    const filasLineas = lineas.map(l => {
      const cajas = parseFloat(l.cantidad_cajas) || 0;
      const cajasPromo = parseFloat(l.cajas_promo) || 0;
      const bpc   = parseFloat(l.botellas_por_caja) || 0;
      const pbot  = parseFloat(l.precio_botella) || 0;
      const uds   = cajas * bpc;
      const base  = baseLinea(l);
      const baseD = base * (1 - descPct / 100);
      const precioNeto = uds > 0 ? baseD / uds : 0;
      const nombre = l.ref_nombre || l.nombre || '';
      const codigo = l.ref_codigo || l.codigo || '';
      return `
        <tr>
          <td>${l.referencia_id || ''}</td>
          <td>${codigo ? codigo + ' - ' : ''}${nombre}</td>
          <td style="text-align:right">${cajas}${cajasPromo > 0 ? '+' + cajasPromo : ''}</td>
          <td style="text-align:right">${uds}</td>
          <td style="text-align:right">${fmt(pbot)}</td>
          <td style="text-align:right">${descPct > 0 ? descPct + '%' : ''}</td>
          <td style="text-align:right">${fmt(precioNeto)}</td>
          <td style="text-align:right">${fmt(baseD)}</td>
          <td style="text-align:center">G</td>
        </tr>`;
    }).join('');

    const fechaFormateada = pedido.fecha ? new Date(pedido.fecha).toLocaleDateString('es-ES') : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Pedido ${pedido.serie_prefijo || ''}${pedido.numero}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #222; padding: 20px 30px; }
  .cabecera { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 12px; }
  .logo-area { display: flex; flex-direction: column; }
  .empresa-nombre { font-size: 22pt; font-weight: bold; letter-spacing: 1px; color: #1a1a1a; }
  .empresa-subtitulo { font-size: 9pt; color: #555; margin-top: 2px; font-style: italic; }
  .pedido-ref { text-align: right; }
  .pedido-ref h2 { font-size: 13pt; font-weight: bold; margin-bottom: 4px; }
  .pedido-ref .meta { font-size: 9pt; color: #555; margin-top: 4px; }
  .seccion { display: flex; gap: 30px; margin-bottom: 16px; }
  .bloque { flex: 1; }
  .bloque h3 { font-size: 9pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 3px; margin-bottom: 6px; }
  .bloque p { font-size: 9pt; margin-bottom: 2px; color: #333; }
  .bloque .nombre-principal { font-weight: bold; font-size: 10pt; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 16px; }
  table thead tr { border-bottom: 1px solid #333; border-top: 1px solid #333; }
  table th { padding: 5px 6px; font-size: 8.5pt; font-weight: bold; color: #333; }
  table td { padding: 5px 6px; border-bottom: 1px solid #ddd; }
  .totales-tabla { width: 320px; margin-left: auto; }
  .totales-tabla td { padding: 4px 8px; font-size: 9pt; }
  .totales-tabla .fila-total { font-weight: bold; border-top: 2px solid #333; border-bottom: 2px solid #333; }
  .gran-total { text-align: right; margin-top: 16px; }
  .gran-total .etiqueta { font-size: 14pt; font-weight: bold; display: inline-block; margin-right: 12px; }
  .gran-total .valor { font-size: 16pt; font-weight: bold; }
  .observaciones { margin-bottom: 16px; }
  .observaciones h3 { font-size: 9pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 3px; margin-bottom: 6px; }
  .pie { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ccc; display: flex; gap: 30px; font-size: 7.5pt; color: #555; }
  .pie .col { flex: 1; }
  .pie h4 { font-weight: bold; margin-bottom: 4px; font-size: 8pt; color: #333; }
  .lopd { margin-top: 10px; font-size: 6.5pt; color: #888; line-height: 1.4; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { padding: 10px 15px; } }
</style>
</head>
<body>

<div class="cabecera">
  <div class="logo-area">
    ${cfg.logo
      ? `<img src="${cfg.logo}" alt="Logo" style="max-height:80px;max-width:200px;object-fit:contain;margin-bottom:4px">`
      : `<div class="empresa-nombre">EXCLUSIVAS<br>VILLANUEVA, S.L.</div>
    <div class="empresa-subtitulo">Vinos con Denominación de Origen</div>`
    }
  </div>
  <div class="pedido-ref">
    <h2>Pedido de compra nº ${pedido.serie_prefijo || ''}${pedido.numero}</h2>
    <div class="meta">Página 1 de 1</div>
    <div class="meta">Su refª.:</div>
    <div class="meta">Fecha pedido:&nbsp;&nbsp;${fechaFormateada}</div>
  </div>
</div>

<div class="seccion">
  <div class="bloque">
    <h3>Datos proveedor</h3>
    <p class="nombre-principal">${pedido.bodega_nombre || ''}</p>
    ${pedido.bodega_direccion ? `<p>${pedido.bodega_direccion}</p>` : ''}
    ${pedido.bodega_cp || pedido.bodega_poblacion ? `<p>${[pedido.bodega_cp, pedido.bodega_poblacion].filter(Boolean).join(' ')}</p>` : ''}
    ${pedido.bodega_provincia ? `<p>${pedido.bodega_provincia}</p>` : ''}
  </div>
  <div class="bloque">
    <h3>Cliente</h3>
    <p class="nombre-principal">${pedido.entidad_nombre || ''}</p>
    ${pedido.direccion_fiscal ? `<p>${pedido.direccion_fiscal}</p>` : ''}
    ${pedido.cp_fiscal || pedido.poblacion_fiscal ? `<p>${[pedido.cp_fiscal, pedido.poblacion_fiscal].filter(Boolean).join(' ')}</p>` : ''}
    ${pedido.provincia_fiscal ? `<p>${pedido.provincia_fiscal}</p>` : ''}
    ${pedido.entidad_nif ? `<p>NIF: ${pedido.entidad_nif}</p>` : ''}
  </div>
</div>

<h3 style="font-size:9pt;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #333;padding-bottom:3px;margin-bottom:8px;">Artículos</h3>

<table>
  <thead>
    <tr>
      <th style="text-align:left;width:50px">Ref.</th>
      <th style="text-align:left">Descripción</th>
      <th style="text-align:right;width:55px">Cajas</th>
      <th style="text-align:right;width:45px">Uds.</th>
      <th style="text-align:right;width:60px">Precio ud.</th>
      <th style="text-align:right;width:45px">Dto.</th>
      <th style="text-align:right;width:60px">Precio neto</th>
      <th style="text-align:right;width:70px">Importe</th>
      <th style="text-align:center;width:25px">IVA</th>
    </tr>
  </thead>
  <tbody>
    ${filasLineas}
  </tbody>
</table>

${pedido.observaciones ? `
<div class="observaciones">
  <h3>Observaciones</h3>
  <p style="font-size:9pt">${pedido.observaciones}</p>
</div>` : '<div class="observaciones"><h3>Observaciones</h3></div>'}

<table class="totales-tabla">
  <thead>
    <tr style="border-bottom:1px solid #333;border-top:1px solid #333">
      <th style="text-align:right">Base Imponible</th>
      <th style="text-align:right">% IVA</th>
      <th style="text-align:right">Cuota IVA</th>
      <th style="text-align:right">% R. E.</th>
      <th style="text-align:right">Cuota R. E.</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:right">${fmt(baseDesc)}</td>
      <td style="text-align:right">${ivaPct},00</td>
      <td style="text-align:right">${fmt(ivaEuros)}</td>
      <td style="text-align:right"></td>
      <td style="text-align:right"></td>
      <td style="text-align:right">${fmt(total)}</td>
    </tr>
  </tbody>
</table>

<div class="gran-total">
  <span class="etiqueta">T O T A L</span>
  <span class="valor">${fmt(total)}€</span>
</div>

<div class="pie">
  <div class="col">
    <h4>Nuestra dirección postal</h4>
    <p>${cfg.direccion || ''}</p>
    <p>${[cfg.cp, cfg.poblacion].filter(Boolean).join(' ')}</p>
    <p>${cfg.provincia || 'Asturias'}</p>
    <p>España</p>
  </div>
  <div class="col">
    <h4>Nuestros datos de contacto</h4>
    ${cfg.telefono ? `<p>Tfno: ${cfg.telefono}</p>` : ''}
    ${cfg.email ? `<p>Email: ${cfg.email}</p>` : ''}
  </div>
</div>

</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=900,height=700');
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); }, 400);
  };

  // Estilo celda tabla
  const td = (extra = {}) => ({ padding: '8px 10px', ...extra });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Pedidos</SectionTitle>
        <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Nuevo pedido</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 150 }} value={fEstado} onChange={e => setFEstado(e.target.value)}>
          <option value="">— Todos —</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="input" style={{ width: 150 }} value={fDesde} onChange={e => setFDesde(e.target.value)} />
        <input type="date" className="input" style={{ width: 150 }} value={fHasta} onChange={e => setFHasta(e.target.value)} />
        <button className="btn btn-secondary" onClick={cargar}>Buscar</button>
      </div>

      {loading ? <Spinner /> : lista.length === 0 ? <EmptyState mensaje="Sin pedidos" /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                {['Fecha', 'Número', 'Cliente', 'Bodega', 'Importe sin IVA', 'Total', 'Comisiones', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: ['Importe sin IVA','Total','Comisiones'].includes(h) ? 'right' : 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: i%2===0?'transparent':'var(--surface-raised)', cursor: 'pointer' }}
                  onClick={() => abrirDetalle(p.id)}>
                  <td style={{ padding: '10px 14px' }}><FechaCorta fecha={p.fecha} /></td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{p.serie_prefijo}{p.numero}</td>
                  <td style={{ padding: '10px 14px' }}>{p.entidad_nombre}</td>
                  <td style={{ padding: '10px 14px' }}>{p.bodega_nombre}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}><Money value={p.base_imponible} /></td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}><Money value={p.total} /></td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--accent)' }}><Money value={p.total_comisiones} /></td>
                  <td style={{ padding: '10px 14px' }}><EstadoBadge estado={p.estado} /></td>
                  <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrirDetalle(p.id)}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Nuevo Pedido ─────────────────────────────── */}
      {modal === 'nuevo' && (
        <Modal title="Nuevo pedido" onClose={() => setModal(false)}
          style={{ maxWidth: 1100, width: '95vw' }}>

          {/* Cabecera del pedido */}
          <div className="form-grid form-grid-2" style={{ gap: 12, marginBottom: 20 }}>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Serie *</label>
              <select className="input" value={form.serie_id} onChange={e => setForm(f => ({ ...f, serie_id: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {series.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.prefijo})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Cliente *</label>
              <select className="input" value={form.entidad_id} onChange={e => setForm(f => ({ ...f, entidad_id: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {entidades.map(e => <option key={e.id} value={e.id}>{e.nombre_comercial}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Bodega *</label>
              <select className="input" value={form.bodega_entidad_id} onChange={e => setForm(f => ({ ...f, bodega_entidad_id: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre_comercial}</option>)}
              </select>
            </div>
          </div>

          {/* Líneas */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ fontSize: 14 }}>Líneas de pedido</b>
              <button className="btn btn-secondary btn-sm" onClick={agregarLinea}>+ Añadir línea</button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 40 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                    {[
                      { h: 'Referencia', align: 'left' },
                      { h: 'Cajas', align: 'right' },
                      { h: 'Bot/caja', align: 'right' },
                      { h: '€/bot', align: 'right' },
                      { h: 'Base', align: 'right' },
                      { h: '% Com.', align: 'right' },
                      { h: 'Imp. Com.', align: 'right' },
                      { h: '', align: 'center' },
                    ].map(({ h, align }) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: align, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => {
                    const base = baseLinea(l);
                    const com  = comisionLinea(l, form.descuento_pct);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td()}>
                          <select className="input" style={{ minWidth: 200 }} value={l.referencia_id} onChange={e => onRefChange(i, e.target.value)}>
                            <option value="">— Selecciona —</option>
                            {referencias.map(r => <option key={r.id} value={r.id}>{r.codigo} — {r.nombre}</option>)}
                          </select>
                        </td>
                        <td style={td({ textAlign: 'right' })}>
                          <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} value={l.cantidad_cajas} onChange={e => setLinea(i,'cantidad_cajas',e.target.value)} />
                        </td>
                        <td style={td({ textAlign: 'right' })}>
                          <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} value={l.botellas_por_caja} onChange={e => setLinea(i,'botellas_por_caja',e.target.value)} />
                        </td>
                        <td style={td({ textAlign: 'right' })}>
                          <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} value={l.precio_botella} onChange={e => setLinea(i,'precio_botella',e.target.value)} />
                        </td>
                        <td style={td({ textAlign: 'right', fontWeight: 500 })}>
                          {base.toFixed(2)} €
                        </td>
                        <td style={td({ textAlign: 'right' })}>
                          <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} value={l.comision_pct} onChange={e => setLinea(i,'comision_pct',e.target.value)} />
                        </td>
                        <td style={td({ textAlign: 'right', color: 'var(--accent)', fontWeight: 500 })}>
                          {com.toFixed(2)} €
                        </td>
                        <td style={td()}>
                          <button className="btn btn-danger btn-sm" onClick={() => quitarLinea(i)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                  {lineas.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Sin líneas. Pulsa "+ Añadir línea".</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fila inferior: campos + totales en horizontal */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12, flexWrap: 'wrap' }}>
            {/* Campos pequeños */}
            <div className="form-group" style={{ minWidth: 80 }}>
              <label>IVA %</label>
              <input type="number" className="input" value={form.porcentaje_iva}
                onChange={e => setForm(f => ({ ...f, porcentaje_iva: e.target.value }))} />
            </div>
            <div className="form-group" style={{ minWidth: 100 }}>
              <label>Descuento %</label>
              <input type="number" className="input" value={form.descuento_pct}
                onChange={e => setForm(f => ({ ...f, descuento_pct: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label>Observaciones</label>
              <input type="text" className="input" value={form.observaciones || ''}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
            </div>

            {/* Totales inline */}
            <div style={{ display: 'flex', gap: 0, background: 'var(--surface-raised)', borderRadius: 8, overflow: 'hidden', fontSize: 13, border: '1px solid var(--border)', flexShrink: 0 }}>
              {[
                { label: 'Base', value: totales.baseTotal.toFixed(2) + ' €' },
                { label: `Dto ${form.descuento_pct||0}%`, value: '−' + totales.descEuros.toFixed(2) + ' €', color: '#e53' },
                { label: 'Base s/dto', value: totales.baseDesc.toFixed(2) + ' €' },
                { label: `IVA ${form.porcentaje_iva}%`, value: totales.iva.toFixed(2) + ' €' },
                { label: 'TOTAL', value: totales.total.toFixed(2) + ' €', bold: true, accent: true },
                { label: 'Comisiones', value: totales.comision.toFixed(2) + ' €', accent: true },
              ].map((t, i) => (
                <div key={i} style={{ padding: '8px 14px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none', textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontWeight: t.bold ? 700 : 500, color: t.accent ? 'var(--accent)' : t.color || 'inherit', whiteSpace: 'nowrap' }}>{t.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Botones al final, dentro del scroll */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear pedido'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal Detalle ──────────────────────────────────── */}
      {/* ── Modal Vista Previa Email ──────────────────────────── */}
      {emailModal && (() => {
        const { pedido, lineas: eLineas, descPct: eDsc, ivaPct: eIva } = emailModal;
        const fmt = (n) => parseFloat(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fechaStr = pedido.fecha ? new Date(pedido.fecha).toLocaleDateString('es-ES') : '';
        const numeroPedido = `${pedido.serie_prefijo || ''}${pedido.numero}`;
        const baseTotal = eLineas.reduce((s, l) => s + baseLinea(l), 0);
        const baseDescT = eLineas.reduce((s, l) => s + baseDescLinea(l, eDsc), 0);
        const ivaEuros  = baseDescT * eIva / 100;
        const totalFinal = baseDescT + ivaEuros;

        return (
          <Modal title="Vista previa del email" onClose={() => setEmailModal(null)}
            style={{ maxWidth: 720, width: '95vw' }}>

            {/* Preview del email */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16, background: '#fff', color: '#222', fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
              <p style={{ marginBottom: 12 }}>
                Adjunto remitimos N/pedido nº <strong>{numeroPedido}</strong> de fecha <strong>{fechaStr}</strong> correspondiente al cliente <strong>{pedido.entidad_nombre}</strong>, con el siguiente detalle:
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #333' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Producto</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cajas</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Botellas</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Precio/bot.</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>% Dto.</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {eLineas.map((l, i) => {
                    const cajas   = parseFloat(l.cantidad_cajas) || 0;
                    const cajasP  = parseFloat(l.cajas_promo)    || 0;
                    const bpc     = parseFloat(l.botellas_por_caja) || 0;
                    const pbot    = parseFloat(l.precio_botella) || 0;
                    const botellas = (cajas + cajasP) * bpc;
                    const baseLD  = baseDescLinea(l, eDsc);
                    const dtoLinea = parseFloat(l.descuento_linea_pct ?? eDsc) || 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #e8e8e8' }}>
                        <td style={{ padding: '5px 8px' }}>{l.ref_nombre}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{cajasP > 0 ? `${cajas}+${cajasP}` : cajas}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{botellas}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmt(pbot)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{dtoLinea > 0 ? `${dtoLinea}%` : '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}><b>{fmt(baseLD)}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Observaciones preview */}
              {emailObs && (
                <p style={{ marginBottom: 12, whiteSpace: 'pre-wrap', borderLeft: '3px solid #ddd', paddingLeft: 10, color: '#444' }}>{emailObs}</p>
              )}

              <p style={{ marginBottom: 8 }}>Un cordial saludo.</p>
            </div>

            {/* Campo observaciones */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Observaciones (se añaden antes del saludo)</label>
              <textarea className="input" rows={4} style={{ width: '100%', resize: 'vertical' }}
                placeholder="Escribe aquí cualquier comentario adicional para este email..."
                value={emailObs} onChange={e => setEmailObs(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEmailModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarEnvioEmail} disabled={emailSending}>
                {emailSending ? 'Enviando…' : '📧 Enviar email'}
              </button>
            </div>
          </Modal>
        );
      })()}

      {modal === 'detalle' && pedidoSel && (() => {
        const descPct  = parseFloat(detForm.descuento_pct) || 0;
        const ivaPct   = parseFloat(detForm.porcentaje_iva) || 21;
        const baseTotal = detLineas.reduce((s, l) => s + baseLinea(l), 0);
        const baseDescTotal = detLineas.reduce((s, l) => s + baseDescLinea(l, descPct), 0);
        const descEuros = baseTotal - baseDescTotal;
        const baseDesc  = baseDescTotal;
        const iva       = baseDesc * ivaPct / 100;
        const total     = baseDesc + iva;
        const totalCom  = detLineas.reduce((s, l) => s + comisionLinea(l, descPct), 0);

        const setDetLinea = (i, k, v) => setDetLineas(l => l.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
        const quitarDetLinea = (i) => setDetLineas(l => l.filter((_, idx) => idx !== i));
        const agregarDetLinea = () => setDetLineas(l => [...l, {
          referencia_id: '', cantidad_cajas: 1, cajas_promo: 0,
          botellas_por_caja: 6, precio_botella: 0, comision_pct: 0
        }]);
        const onDetRefChange = (i, ref_id) => {
          const ref = referencias.find(r => r.id == ref_id);
          if (ref) setDetLineas(l => l.map((x, idx) => idx === i ? {
            ...x, referencia_id: ref_id,
            ref_codigo: ref.codigo, ref_nombre: ref.nombre,
            botellas_por_caja: ref.botellas_por_caja,
            precio_botella: ref.precio_venta,
            comision_pct: ref.comision
          } : x));
        };
        const guardarDetalle = async () => {
          setSaving(true);
          try {
            const lineasSaneadas = detLineas.map(l => ({
              referencia_id:       l.referencia_id,
              cantidad_cajas:      parseFloat(l.cantidad_cajas)       || 0,
              cajas_promo:         parseFloat(l.cajas_promo)          || 0,
              botellas_por_caja:   parseFloat(l.botellas_por_caja)    || 0,
              precio_botella:      parseFloat(l.precio_botella)       || 0,
              comision_pct:        parseFloat(l.comision_pct)         || 0,
              descuento_linea_pct: l.descuento_linea_pct !== undefined && l.descuento_linea_pct !== ''
                                     ? parseFloat(l.descuento_linea_pct) : null,
            }));
            await api.put(`/pedidos/${pedidoSel.id}`, {
              descuento_pct: descPct,
              porcentaje_iva: ivaPct,
              lineas: lineasSaneadas
            });
            toast('Pedido actualizado', 'success');
            abrirDetalle(pedidoSel.id);
            cargar();
          } catch (e) { toast(e.message, 'error'); }
          finally { setSaving(false); }
        };

        return (
          <Modal title={`Pedido ${pedidoSel.serie_prefijo || ''}${pedidoSel.numero}`} onClose={() => setModal(false)}
            style={{ maxWidth: 1100, width: '95vw' }}>
            <div style={{ marginBottom: 12 }}>
              <p><b>Cliente:</b> {pedidoSel.entidad_nombre} &nbsp; <b>Bodega:</b> {pedidoSel.bodega_nombre}</p>
              <p><b>Fecha:</b> <FechaCorta fecha={pedidoSel.fecha} /> &nbsp; <EstadoBadge estado={pedidoSel.estado} /></p>
            </div>

            {/* Líneas editables */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>Líneas de pedido</b>
                <button className="btn btn-secondary btn-sm" onClick={agregarDetLinea}>+ Añadir línea</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 85 }} />
                    <col style={{ width: 75 }} />
                    <col style={{ width: 95 }} />
                    <col style={{ width: 75 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 40 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--surface-raised)' }}>
                      {[
                        { h: 'Referencia', align: 'left' },
                        { h: 'Cajas', align: 'right' },
                        { h: 'Bot/caja', align: 'right' },
                        { h: '€/bot', align: 'right' },
                        { h: 'Base', align: 'right' },
                        { h: 'Dto. %', align: 'right' },
                        { h: 'Base c/dto', align: 'right' },
                        { h: '% Com.', align: 'right' },
                        { h: 'Imp. Com.', align: 'right' },
                        { h: '', align: 'center' },
                      ].map(({ h, align }) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: align, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detLineas.map((l, i) => {
                      const base    = baseLinea(l);
                      const baseD   = baseDescLinea(l, descPct);
                      const com     = comisionLinea(l, descPct);
                      const dtoLinea = l.descuento_linea_pct ?? '';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={td()}>
                            {l.ref_nombre ? (
                              <span style={{ fontWeight: 500 }}>{l.ref_codigo} — {l.ref_nombre}</span>
                            ) : (
                              <select className="input" style={{ minWidth: 200 }} value={l.referencia_id || ''} onChange={e => onDetRefChange(i, e.target.value)}>
                                <option value="">— Selecciona —</option>
                                {referencias.map(r => <option key={r.id} value={r.id}>{r.codigo} — {r.nombre}</option>)}
                              </select>
                            )}
                          </td>
                          <td style={td({ textAlign: 'right' })}>
                            <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} value={l.cantidad_cajas} onChange={e => setDetLinea(i,'cantidad_cajas',e.target.value)} />
                          </td>
                          <td style={td({ textAlign: 'right' })}>
                            <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} value={l.botellas_por_caja} onChange={e => setDetLinea(i,'botellas_por_caja',e.target.value)} />
                          </td>
                          <td style={td({ textAlign: 'right' })}>
                            <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} value={l.precio_botella} onChange={e => setDetLinea(i,'precio_botella',e.target.value)} />
                          </td>
                          <td style={td({ textAlign: 'right', fontWeight: 500 })}>{base.toFixed(2)} €</td>
                          <td style={td({ textAlign: 'right' })}>
                            <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} placeholder={descPct > 0 ? descPct : '0'} value={dtoLinea} onChange={e => setDetLinea(i,'descuento_linea_pct', e.target.value === '' ? undefined : e.target.value)} />
                          </td>
                          <td style={td({ textAlign: 'right', fontWeight: 500, color: baseD < base ? '#e53' : 'inherit' })}>{baseD.toFixed(2)} €</td>
                          <td style={td({ textAlign: 'right' })}>
                            <input type="number" className="input" style={{ width: '100%', textAlign: 'right' }} value={l.comision_pct} onChange={e => setDetLinea(i,'comision_pct',e.target.value)} />
                          </td>
                          <td style={td({ textAlign: 'right', color: 'var(--accent)', fontWeight: 500 })}>{com.toFixed(2)} €</td>
                          <td style={td()}>
                            <button className="btn btn-danger btn-sm" onClick={() => quitarDetLinea(i)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fila inferior: IVA, descuento y totales */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ minWidth: 80 }}>
                <label>IVA %</label>
                <input type="number" className="input" value={detForm.porcentaje_iva}
                  onChange={e => setDetForm(f => ({ ...f, porcentaje_iva: e.target.value }))} />
              </div>
              <div className="form-group" style={{ minWidth: 100 }}>
                <label>Descuento %</label>
                <input type="number" className="input" value={detForm.descuento_pct}
                  onChange={e => setDetForm(f => ({ ...f, descuento_pct: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 0, background: 'var(--surface-raised)', borderRadius: 8, overflow: 'hidden', fontSize: 13, border: '1px solid var(--border)', flexShrink: 0 }}>
                {[
                  { label: 'Base', value: baseTotal.toFixed(2) + ' €' },
                  { label: `Dto ${descPct}%`, value: '−' + descEuros.toFixed(2) + ' €', color: '#e53' },
                  { label: 'Base s/dto', value: baseDesc.toFixed(2) + ' €' },
                  { label: `IVA ${ivaPct}%`, value: iva.toFixed(2) + ' €' },
                  { label: 'TOTAL', value: total.toFixed(2) + ' €', bold: true, accent: true },
                  { label: 'Comisiones', value: totalCom.toFixed(2) + ' €', accent: true },
                ].map((t, i) => (
                  <div key={i} style={{ padding: '8px 14px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none', textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t.label}</div>
                    <div style={{ fontWeight: t.bold ? 700 : 500, color: t.accent ? 'var(--accent)' : t.color || 'inherit', whiteSpace: 'nowrap' }}>{t.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
              <select className="input" style={{ width: 140 }} defaultValue={pedidoSel.estado}
                onChange={e => cambiarEstado(pedidoSel.id, e.target.value)}>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-primary" onClick={guardarDetalle} disabled={saving}>
                {saving ? 'Guardando…' : '💾 Guardar cambios'}
              </button>
              <button className="btn btn-secondary" onClick={() => imprimirPedido(pedidoSel, detLineas, descPct, ivaPct)}>
                🖨️ Imprimir
              </button>
              <button className="btn btn-secondary" onClick={() => abrirVistaPrevia(pedidoSel, detLineas, descPct, ivaPct)}>
                📧 Vista previa del email
              </button>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cerrar</button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
