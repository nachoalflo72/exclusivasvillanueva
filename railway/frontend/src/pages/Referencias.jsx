import { useState, useEffect } from 'react';
import api from '../utils/api';
import { SectionTitle, Modal, Spinner, EmptyState, Money, useToast } from '../components/UI';

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
  const [loading,  setLoading] = useState(true);
  const [filtroBodega, setFiltroBodega] = useState('');
  const [modal,    setModal]   = useState(false);
  const [form,     setForm]    = useState(EMPTY);
  const [saving,   setSaving]  = useState(false);

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
    try {
      if (form.id) await api.put(`/referencias/${form.id}`, form);
      else         await api.post('/referencias', form);
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

  const Campo = ({ label, k, type = 'text', span = 1 }) => (
    <div className="form-group" style={{ gridColumn: `span ${span}` }}>
      <label>{label}</label>
      <input className="input" type={type} value={form[k] ?? ''}
        onChange={e => setF(k, e.target.value)} />
    </div>
  );

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
                  <td style={{ padding: '10px 14px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrir(r)} style={{ marginRight: 6 }}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => desactivar(r.id)}>Desactivar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={form.id ? 'Editar referencia' : 'Nueva referencia'} onClose={cerrar}
          footer={<>
            <button className="btn btn-secondary" onClick={cerrar}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>}>
          <div className="form-grid form-grid-2" style={{ gap: 12 }}>
            <Campo label="Código *"     k="codigo" />
            <Campo label="Nombre *"     k="nombre" span={2} />
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Bodega *</label>
              <select className="input" value={form.bodega_entidad_id || ''}
                onChange={e => setF('bodega_entidad_id', e.target.value)}>
                <option value="">— Selecciona bodega —</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre_comercial}</option>)}
              </select>
            </div>
            <Campo label="Precio compra (€/bot)" k="precio_compra" type="number" />
            <Campo label="Precio venta (€/bot)"  k="precio_venta"  type="number" />
            <Campo label="Botellas por caja"      k="botellas_por_caja" type="number" />
            <Campo label="% Comisión"             k="comision" type="number" />
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Observaciones</label>
              <textarea className="input" rows={2} value={form.observaciones || ''}
                onChange={e => setF('observaciones', e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
