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

// Calcula importe comisión de una línea (sobre base, aplicando descuento pedido)
const comisionLinea = (l, descuentoPct) => {
  const base   = baseLinea(l);
  const dPct   = parseFloat(descuentoPct) || 0;
  const baseDesc = base * (1 - dPct / 100);
  const pct    = parseFloat(l.comision_pct) || 0;
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

  const [fEstado, setFEstado] = useState('');
  const [fDesde,  setFDesde]  = useState('');
  const [fHasta,  setFHasta]  = useState('');

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

  const enviarEmail = async (id, email) => {
    try {
      await api.post(`/email/pedido/${id}`, { email });
      toast('Email enviado', 'success');
    } catch (e) { toast(e.message, 'error'); }
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
                {['Fecha', 'Número', 'Cliente', 'Bodega', 'Total', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
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
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}><Money value={p.total} /></td>
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
          style={{ maxWidth: 1100, width: '95vw' }}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear pedido'}
            </button>
          </>}>

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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                    {['Referencia', 'Cajas', 'Bot/caja', '€/bot', 'Base', '% Com.', 'Imp. Com.', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Referencia' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
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
                        <td style={td()}>
                          <input type="number" className="input" style={{ width: 70, textAlign: 'right' }} value={l.cantidad_cajas} onChange={e => setLinea(i,'cantidad_cajas',e.target.value)} />
                        </td>
                        <td style={td()}>
                          <input type="number" className="input" style={{ width: 70, textAlign: 'right' }} value={l.botellas_por_caja} onChange={e => setLinea(i,'botellas_por_caja',e.target.value)} />
                        </td>
                        <td style={td()}>
                          <input type="number" className="input" style={{ width: 80, textAlign: 'right' }} value={l.precio_botella} onChange={e => setLinea(i,'precio_botella',e.target.value)} />
                        </td>
                        <td style={td({ textAlign: 'right', fontWeight: 500 })}>
                          {base.toFixed(2)} €
                        </td>
                        <td style={td()}>
                          <input type="number" className="input" style={{ width: 70, textAlign: 'right' }} value={l.comision_pct} onChange={e => setLinea(i,'comision_pct',e.target.value)} />
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

          {/* Totales + campos pedido */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 8 }}>
            {/* Izquierda: IVA y descuento */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>IVA %</label>
                <input type="number" className="input" value={form.porcentaje_iva}
                  onChange={e => setForm(f => ({ ...f, porcentaje_iva: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Descuento %</label>
                <input type="number" className="input" value={form.descuento_pct}
                  onChange={e => setForm(f => ({ ...f, descuento_pct: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Observaciones</label>
                <textarea className="input" rows={2} value={form.observaciones || ''}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
              </div>
            </div>

            {/* Derecha: resumen de totales */}
            <div style={{ background: 'var(--surface-raised)', borderRadius: 8, padding: 16, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Base imponible</span>
                <span style={{ fontWeight: 500 }}>{totales.baseTotal.toFixed(2)} €</span>
              </div>
              {(parseFloat(form.descuento_pct) > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--danger, #e53)' }}>
                  <span>Descuento {form.descuento_pct}%</span>
                  <span>− {totales.descEuros.toFixed(2)} €</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Base s/descuento</span>
                <span style={{ fontWeight: 500 }}>{totales.baseDesc.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>IVA {form.porcentaje_iva}%</span>
                <span>{totales.iva.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>{totales.total.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8, color: 'var(--accent)' }}>
                <span>Total comisiones</span>
                <span style={{ fontWeight: 600 }}>{totales.comision.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Detalle ──────────────────────────────────── */}
      {modal === 'detalle' && pedidoSel && (() => {
        const lineasDet = pedidoSel.lineas || [];
        const descPct   = parseFloat(pedidoSel.descuento_pct) || 0;
        const totalCom  = lineasDet.reduce((s, l) => {
          const base = parseFloat(l.base_imponible) || 0;
          const pct  = parseFloat(l.comision_pct)   || 0;
          return s + base * pct / 100;
        }, 0);
        return (
          <Modal title={`Pedido ${pedidoSel.serie_prefijo || ''}${pedidoSel.numero}`} onClose={() => setModal(false)}
            style={{ maxWidth: 1100, width: '95vw' }}
            footer={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select className="input" style={{ width: 140 }} defaultValue={pedidoSel.estado}
                  onChange={e => cambiarEstado(pedidoSel.id, e.target.value)}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="btn btn-secondary" onClick={() => enviarEmail(pedidoSel.id, pedidoSel.bodega_email)}>
                  📧 Enviar email
                </button>
                <button className="btn btn-secondary" onClick={() => setModal(false)}>Cerrar</button>
              </div>
            }>
            <div style={{ marginBottom: 12 }}>
              <p><b>Cliente:</b> {pedidoSel.entidad_nombre} &nbsp; <b>Bodega:</b> {pedidoSel.bodega_nombre}</p>
              <p><b>Fecha:</b> <FechaCorta fecha={pedidoSel.fecha} /> &nbsp; <EstadoBadge estado={pedidoSel.estado} /></p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)' }}>
                    {['Ref.', 'Nombre', 'Cajas', 'Promo', 'Bot/caja', '€/bot', 'Base', '% Com.', 'Imp. Com.'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Ref.' || h === 'Nombre' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineasDet.map((l, i) => {
                    const base = parseFloat(l.base_imponible) || 0;
                    const pct  = parseFloat(l.comision_pct)   || 0;
                    const com  = base * pct / 100;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td({ fontFamily: 'monospace' })}>{l.ref_codigo}</td>
                        <td style={td()}>{l.ref_nombre}</td>
                        <td style={td({ textAlign: 'right' })}>{l.cantidad_cajas}</td>
                        <td style={td({ textAlign: 'right' })}>{l.cajas_promo}</td>
                        <td style={td({ textAlign: 'right' })}>{l.botellas_por_caja}</td>
                        <td style={td({ textAlign: 'right' })}><Money value={l.precio_botella} /></td>
                        <td style={td({ textAlign: 'right', fontWeight: 500 })}><Money value={l.base_imponible} /></td>
                        <td style={td({ textAlign: 'right' })}>{pct}%</td>
                        <td style={td({ textAlign: 'right', color: 'var(--accent)', fontWeight: 500 })}>{com.toFixed(2)} €</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {descPct > 0 && (
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td colSpan={6} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>Descuento {descPct}%</td>
                      <td colSpan={3} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--danger, #e53)' }}>
                        − {(parseFloat(pedidoSel.base_imponible) * descPct / 100).toFixed(2)} €
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td colSpan={6} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>Base imponible</td>
                    <td colSpan={3} style={{ padding: '6px 10px', textAlign: 'right' }}><Money value={pedidoSel.base_imponible} /></td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>IVA {pedidoSel.porcentaje_iva}%</td>
                    <td colSpan={3} style={{ padding: '6px 10px', textAlign: 'right' }}><Money value={pedidoSel.iva} /></td>
                  </tr>
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                    <td colSpan={6} style={{ padding: '8px 10px', textAlign: 'right', fontSize: 14 }}>Total</td>
                    <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--accent)', fontSize: 14 }}>
                      <Money value={pedidoSel.total} />
                    </td>
                  </tr>
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td colSpan={6} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--accent)', fontSize: 12 }}>Total comisiones</td>
                    <td colSpan={3} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{totalCom.toFixed(2)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
