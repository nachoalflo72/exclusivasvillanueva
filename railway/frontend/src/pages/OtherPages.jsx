import { useState, useEffect } from 'react';
import api from '../utils/api';
import { SectionTitle, Spinner, EmptyState, Money, FechaCorta, EstadoBadge, useToast } from '../components/UI';

// ── FACTURAS ────────────────────────────────────────────────
export function Facturas() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/facturas').then(r => setLista(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionTitle>Facturas</SectionTitle>
      {loading ? <Spinner /> : lista.length === 0 ? <EmptyState mensaje="Sin facturas" /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                {['Fecha','Número','Cliente','Total','Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((f, i) => (
                <tr key={f.id} style={{ borderBottom: '1px solid var(--border)', background: i%2===0?'transparent':'var(--surface-raised)' }}>
                  <td style={{ padding: '10px 14px' }}><FechaCorta fecha={f.fecha} /></td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{f.numero}</td>
                  <td style={{ padding: '10px 14px' }}>{f.entidad_nombre}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}><Money value={f.total} /></td>
                  <td style={{ padding: '10px 14px' }}><EstadoBadge estado={f.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── COMISIONES ──────────────────────────────────────────────
export function Comisiones() {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionados, setSeleccionados] = useState([]);

  const cargar = () => {
    setLoading(true);
    api.get('/comisiones?liquidada=false')
      .then(r => setLista(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const toggle = (id) => setSeleccionados(s =>
    s.includes(id) ? s.filter(x => x !== id) : [...s, id]
  );

  const liquidar = async () => {
    if (seleccionados.length === 0) return toast('Selecciona al menos uno', 'error');
    if (!confirm(`¿Liquidar ${seleccionados.length} pedidos?`)) return;
    try {
      await api.post('/comisiones/liquidar', { pedido_ids: seleccionados });
      toast('Liquidados correctamente', 'success');
      setSeleccionados([]);
      cargar();
    } catch (e) { toast(e.message, 'error'); }
  };

  const totalSel = lista
    .filter(p => seleccionados.includes(p.id))
    .reduce((s, p) => s + parseFloat(p.total_comisiones || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Comisiones pendientes</SectionTitle>
        {seleccionados.length > 0 && (
          <button className="btn btn-primary" onClick={liquidar}>
            Liquidar {seleccionados.length} pedidos (<Money value={totalSel} />)
          </button>
        )}
      </div>
      {loading ? <Spinner /> : lista.length === 0 ? <EmptyState mensaje="Sin comisiones pendientes" /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 40, padding: '10px 14px' }}></th>
                {['Fecha','Número','Cliente','Bodega','Comisión'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: i%2===0?'transparent':'var(--surface-raised)' }}>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggle(p.id)} />
                  </td>
                  <td style={{ padding: '10px 14px' }}><FechaCorta fecha={p.fecha} /></td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p.serie_prefijo}{p.numero}</td>
                  <td style={{ padding: '10px 14px' }}>{p.entidad_nombre}</td>
                  <td style={{ padding: '10px 14px' }}>{p.bodega_nombre}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                    <Money value={p.total_comisiones} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── STOCK ───────────────────────────────────────────────────
export function Stock() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stock').then(r => setLista(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionTitle>Stock en depósito</SectionTitle>
      {loading ? <Spinner /> : lista.length === 0 ? <EmptyState mensaje="Sin stock registrado" /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                {['Código','Referencia','Bodega','Cajas','Botellas'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: i%2===0?'transparent':'var(--surface-raised)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{s.codigo}</td>
                  <td style={{ padding: '10px 14px' }}>{s.nombre}</td>
                  <td style={{ padding: '10px 14px' }}>{s.bodega_nombre}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{parseFloat(s.cantidad_cajas).toFixed(0)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{(parseFloat(s.cantidad_cajas) * s.botellas_por_caja).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── CONFIGURACIÓN ────────────────────────────────────────────
export function Configuracion() {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/configuracion').then(r => setForm(r.data || {})).finally(() => setLoading(false));
  }, []);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    setSaving(true);
    try {
      await api.put('/configuracion', form);
      toast('Configuración guardada', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally     { setSaving(false); }
  };

  const testEmail = async () => {
    try {
      await api.post('/email/test', { email: form.email });
      toast('Email de prueba enviado', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  if (loading) return <Spinner />;

  const Campo = ({ label, k, type = 'text' }) => (
    <div className="form-group">
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</label>
      <input className="input" type={type} value={form[k] || ''} onChange={e => setF(k, e.target.value)} />
    </div>
  );

  return (
    <div>
      <SectionTitle>Configuración</SectionTitle>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, maxWidth: 700 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Datos del comercial</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <Campo label="Nombre comercial" k="nombre_comercial" />
          <Campo label="NIF" k="nif" />
          <Campo label="Dirección" k="direccion" />
          <Campo label="Población" k="poblacion" />
          <Campo label="CP" k="cp" />
          <Campo label="Teléfono" k="telefono" />
          <Campo label="Email" k="email" type="email" />
          <Campo label="IVA por defecto (%)" k="iva_defecto" type="number" />
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Configuración de correo (SMTP)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <Campo label="Servidor SMTP" k="smtp_host" />
          <Campo label="Puerto" k="smtp_puerto" type="number" />
          <Campo label="Usuario" k="smtp_usuario" />
          <Campo label="Contraseña" k="smtp_password" type="password" />
          <Campo label="Remitente (From)" k="smtp_remitente" />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
          <button className="btn btn-secondary" onClick={testEmail}>
            📧 Enviar email de prueba
          </button>
        </div>
      </div>
    </div>
  );
}
