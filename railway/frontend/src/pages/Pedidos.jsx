import { useState, useEffect } from 'react';
import api from '../utils/api';
import { SectionTitle, Modal, Spinner, EmptyState, Money, FechaCorta, EstadoBadge, useToast } from '../components/UI';

const ESTADOS = ['borrador','enviado','servido','facturado','anulado'];

export default function Pedidos() {
  const toast = useToast();
  const [lista,      setLista]      = useState([]);
  const [series,     setSeries]     = useState([]);
  const [entidades,  setEntidades]  = useState([]);
  const [bodegas,    setBodegas]    = useState([]);
  const [referencias,setReferencias]= useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false); // 'nuevo'|'detalle'|false
  const [pedidoSel,  setPedidoSel]  = useState(null);
  const [saving,     setSaving]     = useState(false);

  // Filtros
  const [fEstado,    setFEstado]    = useState('');
  const [fDesde,     setFDesde]     = useState('');
  const [fHasta,     setFHasta]     = useState('');

  // Form nuevo pedido
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], serie_id: '', entidad_id: '', bodega_entidad_id: '', porcentaje_iva: 21, descuento_euros: 0, descuento_pct: 0, observaciones: '' });
  const [lineas, setLineas] = useState([]);

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
    botellas_por_caja: 6, precio_botella: 0, descuento_euros: 0,
    descuento_pct: 0, comision_pct: 0
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
      setForm({ fecha: new Date().toISOString().split('T')[0], serie_id: '', entidad_id: '', bodega_entidad_id: '', porcentaje_iva: 21, descuento_euros: 0, descuento_pct: 0, observaciones: '' });
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Pedidos</SectionTitle>
        <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Nuevo pedido</button>
      </div>

      {/* Filtros */}
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

      {/* Modal Nuevo Pedido */}
      {modal === 'nuevo' && (
        <Modal title="Nuevo pedido" onClose={() => setModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Crear pedido'}
            </button>
          </>}>
          <div className="form-grid form-grid-2" style={{ gap: 12 }}>
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
            <div className="form-group">
              <label>IVA %</label>
              <input type="number" className="input" value={form.porcentaje_iva} onChange={e => setForm(f => ({ ...f, porcentaje_iva: e.target.value }))} />
            </div>
          </div>

          {/* Líneas */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b>Líneas</b>
              <button className="btn btn-secondary btn-sm" onClick={agregarLinea}>+ Añadir línea</button>
            </div>
            {lineas.map((l, i) => (
              <div key={i} style={{ background: 'var(--surface-raised)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div className="form-group">
                    <label>Referencia</label>
                    <select className="input" value={l.referencia_id} onChange={e => onRefChange(i, e.target.value)}>
                      <option value="">— Selecciona —</option>
                      {referencias.map(r => <option key={r.id} value={r.id}>{r.codigo} — {r.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cajas</label>
                    <input type="number" className="input" value={l.cantidad_cajas} onChange={e => setLinea(i,'cantidad_cajas',e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Bot/caja</label>
                    <input type="number" className="input" value={l.botellas_por_caja} onChange={e => setLinea(i,'botellas_por_caja',e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>€/bot</label>
                    <input type="number" className="input" value={l.precio_botella} onChange={e => setLinea(i,'precio_botella',e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Comisión %</label>
                    <input type="number" className="input" value={l.comision_pct} onChange={e => setLinea(i,'comision_pct',e.target.value)} />
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => quitarLinea(i)} style={{ marginBottom: 0 }}>✕</button>
                </div>
              </div>
            ))}
            {lineas.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin líneas. Pulsa "+ Añadir línea".</p>}
          </div>
        </Modal>
      )}

      {/* Modal Detalle */}
      {modal === 'detalle' && pedidoSel && (
        <Modal title={`Pedido ${pedidoSel.serie_prefijo || ''}${pedidoSel.numero}`} onClose={() => setModal(false)}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)' }}>
                {['Ref.', 'Nombre', 'Cajas', 'Promo', 'Bot/caja', '€/bot', 'Base'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(pedidoSel.lineas || []).map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{l.ref_codigo}</td>
                  <td style={{ padding: '8px 10px' }}>{l.ref_nombre}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{l.cantidad_cajas}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{l.cajas_promo}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{l.botellas_por_caja}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}><Money value={l.precio_botella} /></td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}><Money value={l.base_imponible} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                <td colSpan={6} style={{ padding: '8px 10px', textAlign: 'right' }}>Total</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--accent)' }}>
                  <Money value={pedidoSel.total} />
                </td>
              </tr>
            </tfoot>
          </table>
        </Modal>
      )}
    </div>
  );
}
