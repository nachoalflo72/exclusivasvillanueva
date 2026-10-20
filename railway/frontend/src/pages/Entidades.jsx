import { useState, useEffect } from 'react';
import api from '../utils/api';
import { SectionTitle, Modal, Spinner, EmptyState, useToast } from '../components/UI';

const TIPOS = ['bodega', 'cliente', 'comercial', 'distribuidor'];
const TIPO_LABELS = { bodega: 'Bodega', cliente: 'Cliente', comercial: 'Comercial', distribuidor: 'Distribuidor' };
const TIPO_COLORS = { bodega: 'badge-purple', cliente: 'badge-green', comercial: 'badge-yellow', distribuidor: 'badge-gray' };

const EMPTY = {
  tipo: 'cliente', codigo: '', nombre_comercial: '', nombre_fiscal: '', nif: '',
  persona_contacto: '', telefono: '', movil: '', email: '',
  direccion_fiscal: '', poblacion_fiscal: '', provincia_fiscal: '', cp_fiscal: '',
  direccion_almacen: '', poblacion_almacen: '', provincia_almacen: '', cp_almacen: '',
  forma_pago: '', cuenta_bancaria: '', comision_defecto: '', observaciones: '', activa: true
};

export default function Entidades() {
  const toast = useToast();
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroQ,    setFiltroQ]    = useState('');
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroQ)    params.set('q',    filtroQ);
      const { data } = await api.get(`/entidades?${params}`);
      setLista(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [filtroTipo]);

  const abrir  = (e = null) => { setForm(e ? { ...EMPTY, ...e } : EMPTY); setModal(true); };
  const cerrar = () => setModal(false);
  const setF   = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    if (!form.nombre_comercial || !form.codigo) return toast('Nombre y código son obligatorios', 'error');
    setSaving(true);
    try {
      if (form.id) await api.put(`/entidades/${form.id}`, form);
      else         await api.post('/entidades', form);
      toast(form.id ? 'Entidad actualizada' : 'Entidad creada', 'success');
      cerrar(); cargar();
    } catch (e) { toast(e.message, 'error'); }
    finally     { setSaving(false); }
  };

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar esta entidad?')) return;
    try { await api.delete(`/entidades/${id}`); toast('Desactivada', 'success'); cargar(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const Campo = ({ label, k, type = 'text', span = 1 }) => (
    <div className="form-group" style={{ gridColumn: `span ${span}` }}>
      <label>{label}</label>
      <input className="input" type={type} value={form[k] || ''}
        onChange={e => setF(k, e.target.value)} />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Entidades</SectionTitle>
        <button className="btn btn-primary" onClick={() => abrir()}>+ Nueva entidad</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 160 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">— Todos los tipos —</option>
          {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
        </select>
        <input className="input" style={{ width: 220 }} placeholder="Buscar…" value={filtroQ}
          onChange={e => setFiltroQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && cargar()} />
        <button className="btn btn-secondary" onClick={cargar}>Buscar</button>
      </div>

      {loading ? <Spinner /> : lista.length === 0 ? <EmptyState mensaje="Sin entidades" /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                {['Código', 'Nombre', 'Tipo', 'Teléfono', 'Email', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-raised)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{e.codigo}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{e.nombre_comercial}</td>
                  <td style={{ padding: '10px 14px' }}><span className={`badge ${TIPO_COLORS[e.tipo]}`}>{TIPO_LABELS[e.tipo]}</span></td>
                  <td style={{ padding: '10px 14px' }}>{e.telefono || e.movil || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{e.email || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrir(e)} style={{ marginRight: 6 }}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => desactivar(e.id)}>Desactivar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={form.id ? 'Editar entidad' : 'Nueva entidad'} onClose={cerrar}
          footer={<>
            <button className="btn btn-secondary" onClick={cerrar}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>}>
          <div className="form-grid form-grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label>Tipo</label>
              <select className="input" value={form.tipo} onChange={e => setF('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </div>
            <Campo label="Código *"           k="codigo" />
            <Campo label="Nombre comercial *" k="nombre_comercial" span={2} />
            <Campo label="Nombre fiscal"      k="nombre_fiscal" span={2} />
            <Campo label="NIF / CIF"          k="nif" />
            <Campo label="Persona contacto"   k="persona_contacto" />
            <Campo label="Teléfono"           k="telefono" />
            <Campo label="Móvil"              k="movil" />
            <Campo label="Email"              k="email" type="email" span={2} />
            <Campo label="Dirección fiscal"   k="direccion_fiscal" span={2} />
            <Campo label="Población fiscal"   k="poblacion_fiscal" />
            <Campo label="CP fiscal"          k="cp_fiscal" />
            <Campo label="Dirección almacén"  k="direccion_almacen" span={2} />
            <Campo label="Población almacén"  k="poblacion_almacen" />
            <Campo label="CP almacén"         k="cp_almacen" />
            <Campo label="Forma de pago"      k="forma_pago" />
            <Campo label="% Comisión defecto" k="comision_defecto" type="number" />
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Observaciones</label>
              <textarea className="input" rows={3} value={form.observaciones || ''}
                onChange={e => setF('observaciones', e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
