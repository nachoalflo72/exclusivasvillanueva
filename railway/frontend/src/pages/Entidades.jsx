import { useState, useEffect } from 'react';
import api from '../utils/api';
import { SectionTitle, Modal, Spinner, EmptyState, useToast } from '../components/UI';

const Campo = ({ label, k, type = 'text', span = 1, form, setF }) => (
  <div className="form-group" style={{ gridColumn: `span ${span}` }}>
    <label>{label}</label>
    <input className="input" type={type} value={form[k] || ''}
      onChange={e => setF(k, e.target.value)} />
  </div>
);

const TIPOS = ['bodega', 'cliente', 'comercial', 'distribuidor'];
const TIPO_LABELS = { bodega: 'Bodega', cliente: 'Cliente', comercial: 'Comercial', distribuidor: 'Distribuidor' };
const TIPO_COLORS = { bodega: 'badge-purple', cliente: 'badge-green', comercial: 'badge-yellow', distribuidor: 'badge-gray' };

const EMPTY = {
  tipo: 'cliente', codigo: '', nombre_comercial: '', nombre_fiscal: '', nif: '',
  persona_contacto: '', telefono: '', movil: '', email: '', emails_pedidos: '',
  direccion_fiscal: '', poblacion_fiscal: '', provincia_fiscal: '', cp_fiscal: '',
  direccion_almacen: '', poblacion_almacen: '', provincia_almacen: '', cp_almacen: '',
  forma_pago: '', cuenta_bancaria: '', comision_defecto: '', observaciones: '', activa: true
};

async function imprimirFicha(entidad) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margenIzq = 20;
  const margenDer = 190;
  const anchoUtil = margenDer - margenIzq;
  let y = 20;
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(165, 180, 252);
  doc.text('EXCLUSIVAS VILLANUEVA', margenIzq, 13);
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Ficha de entidad', margenIzq, 21);
  const tipoLabel = TIPO_LABELS[entidad.tipo] || entidad.tipo || '';
  doc.setFontSize(9);
  doc.setTextColor(165, 180, 252);
  doc.text(tipoLabel.toUpperCase(), margenDer, 21, { align: 'right' });
  y = 44;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 27, 75);
  doc.text(entidad.nombre_fiscal || entidad.nombre_comercial || '—', margenIzq, y);
  y += 3;
  doc.setDrawColor(196, 181, 253);
  doc.setLineWidth(0.4);
  doc.line(margenIzq, y, margenDer, y);
  y += 10;
  const fila = (etiqueta, valor) => {
    if (!valor) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 120);
    doc.text(etiqueta.toUpperCase(), margenIzq, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 40);
    const lineas = doc.splitTextToSize(String(valor), anchoUtil - 42);
    doc.text(lineas, margenIzq + 42, y);
    y += lineas.length > 1 ? lineas.length * 5.5 + 2 : 8;
  };
  const separador = (titulo) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(139, 92, 246);
    doc.text(titulo.toUpperCase(), margenIzq, y);
    doc.setDrawColor(221, 214, 254);
    doc.setLineWidth(0.3);
    doc.line(margenIzq + doc.getTextWidth(titulo.toUpperCase()) + 2, y - 1, margenDer, y - 1);
    y += 7;
  };
  separador('Datos generales');
  fila('Nombre fiscal', entidad.nombre_fiscal || entidad.nombre_comercial);
  fila('CIF / NIF', entidad.nif);
  separador('Dirección fiscal');
  const dirFiscal = [entidad.direccion_fiscal, [entidad.cp_fiscal, entidad.poblacion_fiscal].filter(Boolean).join(' '), entidad.provincia_fiscal].filter(Boolean).join(', ');
  fila('Dirección', dirFiscal);
  const dirAlmacen = [entidad.direccion_almacen, [entidad.cp_almacen, entidad.poblacion_almacen].filter(Boolean).join(' '), entidad.provincia_almacen].filter(Boolean).join(', ');
  if (dirAlmacen) { separador('Dirección almacén'); fila('Dirección', dirAlmacen); }
  separador('Contacto');
  if (entidad.telefono) fila('Teléfono', entidad.telefono);
  if (entidad.movil) fila('Móvil', entidad.movil);
  fila('Correo electrónico', entidad.email);
  separador('Condiciones comerciales');
  fila('Forma de pago', entidad.forma_pago);
  fila('Nº cuenta', entidad.cuenta_bancaria);
  const totalPags = doc.getNumberOfPages();
  for (let i = 1; i <= totalPags; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 180);
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Generado el ${fecha}`, margenIzq, 290);
    doc.text(`${i} / ${totalPags}`, margenDer, 290, { align: 'right' });
  }
  const nombreArchivo = `ficha_${(entidad.nombre_comercial || 'entidad').replace(/\s+/g, '_').toLowerCase()}.pdf`;
  doc.save(nombreArchivo);
}

export default function Entidades() {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroQ, setFiltroQ] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroQ) params.set('q', filtroQ);
      const { data } = await api.get(`/entidades?${params}`);
      setLista(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [filtroTipo]);

  const abrir = (e = null) => { setForm(e ? { ...EMPTY, ...e } : EMPTY); setModal(true); };
  const cerrar = () => setModal(false);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    if (!form.nombre_comercial || !form.codigo) return toast('Nombre y código son obligatorios', 'error');
    setSaving(true);
    try {
      if (form.id) await api.put(`/entidades/${form.id}`, form);
      else await api.post('/entidades', form);
      toast(form.id ? 'Entidad actualizada' : 'Entidad creada', 'success');
      cerrar(); cargar();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar esta entidad?')) return;
    try { await api.delete(`/entidades/${id}`); toast('Desactivada', 'success'); cargar(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const eliminar = async (e) => {
    if (!confirm(`¿Eliminar definitivamente "${e.nombre_comercial}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/entidades/${e.id}/eliminar`);
      toast('Entidad eliminada', 'success');
      cargar();
    } catch (err) { toast(err.message, 'error'); }
  };

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
                  <td style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => abrir(e)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => desactivar(e.id)}>Desactivar</button>
                    <button className="btn btn-sm" style={{ background: '#7f1d1d', color: '#fff', border: 'none' }} onClick={() => eliminar(e)}>Eliminar</button>
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
            {form.id && (
              <button className="btn btn-secondary" onClick={() => imprimirFicha(form)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                🖨️ Imprimir ficha
              </button>
            )}
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
            <Campo label="Código *" k="codigo" form={form} setF={setF}/>
            <Campo label="Nombre comercial *" k="nombre_comercial" span={2} form={form} setF={setF}/>
            <Campo label="Nombre fiscal" k="nombre_fiscal" span={2} form={form} setF={setF}/>
            <Campo label="NIF / CIF" k="nif" form={form} setF={setF}/>
            <Campo label="Persona contacto" k="persona_contacto" form={form} setF={setF}/>
            <Campo label="Teléfono" k="telefono" form={form} setF={setF}/>
            <Campo label="Móvil" k="movil" form={form} setF={setF}/>
            <Campo label="Email" k="email" type="email" span={2} form={form} setF={setF}/>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Emails para pedidos <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>(varios correos separados por ;)</span></label>
              <input className="input" type="text" placeholder="correo1@ejemplo.com; correo2@ejemplo.com"
                value={form.emails_pedidos || ''} onChange={e => setF('emails_pedidos', e.target.value)} />
            </div>
            <Campo label="Dirección fiscal" k="direccion_fiscal" span={2} form={form} setF={setF}/>
            <Campo label="Población fiscal" k="poblacion_fiscal" form={form} setF={setF}/>
            <Campo label="CP fiscal" k="cp_fiscal" form={form} setF={setF}/>
            <Campo label="Dirección almacén" k="direccion_almacen" span={2} form={form} setF={setF}/>
            <Campo label="Población almacén" k="poblacion_almacen" form={form} setF={setF}/>
            <Campo label="CP almacén" k="cp_almacen" form={form} setF={setF}/>
            <Campo label="Forma de pago" k="forma_pago" form={form} setF={setF}/>
            <Campo label="% Comisión defecto" k="comision_defecto" type="number" form={form} setF={setF}/>
            <Campo label="Nº cuenta bancaria" k="cuenta_bancaria" span={2} form={form} setF={setF}/>
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
