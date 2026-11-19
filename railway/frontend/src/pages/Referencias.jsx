import { useState, useEffect } from 'react';
import api from '../utils/api';
import { SectionTitle, Modal, Spinner, EmptyState, Money, useToast } from '../components/UI';

const Campo = ({ label, k, type = 'text', span = 1, form, setF }) => (
  <div className="form-group" style={{ gridColumn: `span ${span}` }}>
    <label>{label}</label>
    <input className="input" type={type} value={form[k] ?? ''}
      onChange={e => setF(k, e.target.value)} />
  </div>
);

const EMPTY = {
  codigo: '', nombre: '', bodega_entidad_id: '',
  precio_compra: '', precio_venta: '', botellas_por_caja: 6,
  comision: '', promo_activa: false,
  promo_cajas_compra: '', promo_cajas_regalo: '', observaciones: '', activa: true
};

export default function Referencias() {
  const toast = useToast();
  const [lista,    setLista]   = useState([]);
  const [bodegas,  setBodegas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [filtroBodega, setFiltroBodega] = useState('');
  const [modal,    setModal]   = useState(false);
  const [form,     setForm]    = useState(EMPTY);
  const [saving,   setSaving]  = useState(false);

  // ── Estado modal tarifas ──────────────────────────────────────────────────
  const [tarifaModal,   setTarifaModal]   = useState(null); // referencia activa
  const [tarifas,       setTarifas]       = useState([]);
  const [tarifaForm,    setTarifaForm]    = useState({ entidad_id: '', precio_venta: '' });
  const [savingTarifa,  setSavingTarifa]  = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = filtroBodega ? `?bodega_id=${filtroBodega}` : '';
      const { data } = await api.get(`/referencias${params}`);
      setLista(data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/entidades?tipo=bodega&activa=true').then(r => setBodegas(r.data));
    api.get('/entidades?activa=true').then(r => setClientes(r.data));
    cargar();
  }, []);

  useEffect(() => { cargar(); }, [filtroBodega]);

  const abrir  = (r = null) => { setForm(r ? { ...EMPTY, ...r } : EMPTY); setModal(true); };
  const cerrar = () => setModal(false);
  const setF   = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    if (!form.codigo || !form.nombre || !form.bodega_entidad_id)
      return toast('Código, nombre y bodega son obligatorios', 'error');
    setSaving(true);
    const payload = {
      ...form,
      precio_compra:      parseFloat(form.precio_compra)      || 0,
      precio_venta:       parseFloat(form.precio_venta)       || 0,
      botellas_por_caja:  parseInt(form.botellas_por_caja)    || 6,
      comision:           parseFloat(form.comision)           || 0,
      promo_cajas_compra: parseInt(form.promo_cajas_compra)   || null,
      promo_cajas_regalo: parseInt(form.promo_cajas_regalo)   || null,
    };
    try {
      if (form.id) await api.put(`/referencias/${form.id}`, payload);
      else         await api.post('/referencias', payload);
      toast(form.id ? 'Actualizada' : 'Creada', 'success');
      cerrar(); cargar();
    } catch (e) { toast(e.message, 'error'); }
    finally     { setSaving(false); }
  };

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar?')) return;
    try { await api.delete(`/referencias/${id}`); toast('Desactivada', 'success'); cargar(); }
    catch (e) { toast(e.message, 'error'); }
  };

  // ── Tarifas ───────────────────────────────────────────────────────────────
  const abrirTarifas = async (ref) => {
    setTarifaModal(ref);
    setTarifaForm({ entidad_id: '', precio_venta: '' });
    try {
      const { data } = await api.get(`/referencias/${ref.id}/tarifas`);
      setTarifas(data);
    } catch (e) { toast(e.message, 'error'); }
  };

  const guardarTarifa = async () => {
    if (!tarifaForm.entidad_id || tarifaForm.precio_venta === '')
      return toast('Selecciona una entidad e indica el precio', 'error');
    setSavingTarifa(true);
    try {
      await api.post(`/referencias/${tarifaModal.id}/tarifas`, {
        entidad_id:  parseInt(tarifaForm.entidad_id),
        precio_venta: parseFloat(tarifaForm.precio_venta) || 0,
      });
      toast('Tarifa guardada', 'success');
      setTarifaForm({ entidad_id: '', precio_venta: '' });
      const { data } = await api.get(`/referencias/${tarifaModal.id}/tarifas`);
      setTarifas(data);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSavingTarifa(false); }
  };

  const eliminarTarifa = async (tarifaId) => {
    if (!confirm('¿Eliminar esta tarifa?')) return;
    try {
      await api.delete(`/referencias/${tarifaModal.id}/tarifas/${tarifaId}`);
      toast('Tarifa eliminada', 'success');
      const { data } = await api.get(`/referencias/${tarifaModal.id}/tarifas`);
      setTarifas(data);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Referencias</SectionTitle>
        <button className="btn btn-primary" onClick={() => abrir()}>+ Nueva referencia</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <select className="input" style={{ width: 220 }} value={filtroBodega}
          onChange={e => setFiltroBodega(e.target.value)}>
          <option value="">— Todas las bodegas —</option>
          {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre_comercial}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : lista.length === 0 ? <EmptyState mensaje="Sin referencias" /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                {['Código', 'Nombre', 'Bodega', 'P.Compra', 'P.Venta', 'Bot/caja', 'Comisión', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: i%2===0?'transparent':'var(--surface-raised)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.codigo}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{r.nombre}</td>
                  <td style={{ padding: '10px 14px' }}>{r.bodega_nombre}</td>
                  <td style={{ padding: '10px 14px' }}><Money value={r.precio_compra} /></td>
                  <td style={{ padding: '10px 14px' }}><Money value={r.precio_venta} /></td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>{r.botellas_por_caja}</td>
                  <td style={{ padding: '10px 14px' }}>{r.comision}%</td>
                  <td style={{ padding: '10px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrir(r)}>Editar</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrirTarifas(r)}
                      style={{ background: 'rgba(139,92,246,.12)', color: 'var(--accent)', border: '1px solid rgba(139,92,246,.3)' }}>
                      💰 Tarifas
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => desactivar(r.id)}>Desactivar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal editar/crear referencia ───────────────────── */}
      {modal && (
        <Modal title={form.id ? 'Editar referencia' : 'Nueva referencia'} onClose={cerrar}
          footer={<>
            <button className="btn btn-secondary" onClick={cerrar}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>}>
          <div className="form-grid form-grid-2" style={{ gap: 12 }}>
            <Campo label="Código *"     k="codigo"  form={form} setF={setF} />
            <Campo label="Nombre *"     k="nombre" span={2} form={form} setF={setF} />
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Bodega *</label>
              <select className="input" value={form.bodega_entidad_id || ''}
                onChange={e => setF('bodega_entidad_id', e.target.value)}>
                <option value="">— Selecciona bodega —</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre_comercial}</option>)}
              </select>
            </div>
            <Campo label="Precio compra (€/bot)" k="precio_compra"    type="number" form={form} setF={setF} />
            <Campo label="Precio venta (€/bot)"  k="precio_venta"     type="number" form={form} setF={setF} />
            <Campo label="Botellas por caja"      k="botellas_por_caja" type="number" form={form} setF={setF} />
            <Campo label="% Comisión"             k="comision"         type="number" form={form} setF={setF} />
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Observaciones</label>
              <textarea className="input" rows={2} value={form.observaciones || ''}
                onChange={e => setF('observaciones', e.target.value)} />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal tarifas por entidad ────────────────────────── */}
      {tarifaModal && (
        <Modal
          title={`Tarifas de venta — ${tarifaModal.codigo} ${tarifaModal.nombre}`}
          onClose={() => setTarifaModal(null)}
          style={{ maxWidth: 640, width: '95vw' }}
        >
          {/* Precio por defecto */}
          <div style={{
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Precio venta por defecto:</span>
            <strong><Money value={tarifaModal.precio_venta} /></strong>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(se usa cuando no hay tarifa específica)</span>
          </div>

          {/* Lista de tarifas */}
          {tarifas.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Sin tarifas específicas definidas.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>Entidad</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>€/botella</th>
                  <th style={{ padding: '8px 12px', width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {tarifas.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', background: i%2===0?'transparent':'var(--surface-raised)' }}>
                    <td style={{ padding: '8px 12px' }}>{t.entidad_nombre}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}><Money value={t.precio_venta} /></td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminarTarifa(t.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Formulario añadir tarifa */}
          <div style={{
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '14px 16px',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Añadir / actualizar tarifa</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                <label style={{ fontSize: 12 }}>Entidad</label>
                <select className="input" value={tarifaForm.entidad_id}
                  onChange={e => setTarifaForm(f => ({ ...f, entidad_id: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_comercial}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ width: 130, marginBottom: 0 }}>
                <label style={{ fontSize: 12 }}>€/botella</label>
                <input type="number" step="0.0001" className="input"
                  value={tarifaForm.precio_venta}
                  onChange={e => setTarifaForm(f => ({ ...f, precio_venta: e.target.value }))}
                  placeholder="0.0000" />
              </div>
              <button className="btn btn-primary" onClick={guardarTarifa} disabled={savingTarifa}
                style={{ marginBottom: 0 }}>
                {savingTarifa ? 'Guardando…' : 'Guardar tarifa'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              Si ya existe una tarifa para esa entidad, se actualizará con el nuevo precio.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
