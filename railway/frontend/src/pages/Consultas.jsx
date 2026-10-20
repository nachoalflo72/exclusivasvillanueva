import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { SectionTitle, Money, FechaCorta, EmptyState, Spinner } from '../components/UI';

// ── Tarjeta KPI individual ────────────────────────────────────
function KpiCard({ label, value, tipo = 'numero' }) {
  const formattedValue =
    tipo === 'dinero'
      ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value ?? 0)
      : Math.round(value ?? 0).toLocaleString('es-ES');

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 18px',
      minWidth: 160,
      flex: '1 1 160px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.2 }}>
        {formattedValue}
      </div>
    </div>
  );
}

// ── Grupo de KPIs con título de sección ──────────────────────
function KpiGroup({ titulo, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 8 }}>
        {titulo}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

export default function Consultas() {
  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', entidad_id: '', bodega_id: '', referencia_id: ''
  });
  const [pedidos,      setPedidos]     = useState([]);
  const [kpis,         setKpis]        = useState({});
  const [entidades,    setEntidades]   = useState([]);
  const [bodegas,      setBodegas]     = useState([]);
  const [referencias,  setReferencias] = useState([]);
  const [cargando,     setCargando]    = useState(false);
  const [cargandoKpis, setCargandoKpis] = useState(false);

  // Cargar selectores al montar
  useEffect(() => {
    api.get('/entidades?tipo=cliente&activa=true').then(r => setEntidades(r.data)).catch(() => {});
    api.get('/entidades?tipo=bodega&activa=true').then(r => setBodegas(r.data)).catch(() => {});
    api.get('/referencias').then(r => setReferencias(r.data)).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    setCargando(true);
    setCargandoKpis(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.append(k, v); });

      const [resPedidos, resKpis] = await Promise.all([
        api.get(`/consultas?${params}`),
        api.get(`/consultas/kpis?${params}`)
      ]);
      setPedidos(resPedidos.data);
      setKpis(resKpis.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
      setCargandoKpis(false);
    }
  }, [filtros]);

  const setF = (campo, valor) => setFiltros(f => ({ ...f, [campo]: valor }));

  const hayKpis = Object.keys(kpis).length > 0;

  return (
    <div>
      <SectionTitle>Consultas</SectionTitle>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Desde</label>
            <input type="date" className="input" value={filtros.desde}
              onChange={e => setF('desde', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hasta</label>
            <input type="date" className="input" value={filtros.hasta}
              onChange={e => setF('hasta', e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cliente</label>
            <select className="input" value={filtros.entidad_id}
              onChange={e => setF('entidad_id', e.target.value)}>
              <option value="">— Todos —</option>
              {entidades.map(e => (
                <option key={e.id} value={e.id}>{e.nombre_comercial}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bodega</label>
            <select className="input" value={filtros.bodega_id}
              onChange={e => setF('bodega_id', e.target.value)}>
              <option value="">— Todas —</option>
              {bodegas.map(b => (
                <option key={b.id} value={b.id}>{b.nombre_comercial}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Referencia</label>
            <select className="input" value={filtros.referencia_id}
              onChange={e => setF('referencia_id', e.target.value)}>
              <option value="">— Todas —</option>
              {referencias.map(r => (
                <option key={r.id} value={r.id}>{r.codigo} — {r.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="btn btn-primary" onClick={buscar} disabled={cargando}>
          {cargando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {/* ── Tarjetas KPI ────────────────────────────────────── */}
      {hayKpis && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 20, marginBottom: 20 }}>
          {cargandoKpis ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Spinner /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Bodega */}
              {(kpis.bodega_botellas !== undefined) && (
                <KpiGroup titulo="Bodega seleccionada">
                  <KpiCard label="Botellas vendidas"     value={kpis.bodega_botellas}   tipo="numero" />
                  <KpiCard label="Importe pedidos"       value={kpis.bodega_importe}    tipo="dinero" />
                  <KpiCard label="Comisiones facturadas" value={kpis.bodega_comisiones} tipo="dinero" />
                </KpiGroup>
              )}

              {/* Cliente */}
              {(kpis.cliente_botellas !== undefined) && (
                <KpiGroup titulo="Cliente seleccionado">
                  <KpiCard label="Botellas vendidas"  value={kpis.cliente_botellas}  tipo="numero" />
                  <KpiCard label="Importe pedidos"    value={kpis.cliente_importe}   tipo="dinero" />
                  <KpiCard label="Total facturado"    value={kpis.cliente_facturado} tipo="dinero" />
                </KpiGroup>
              )}

              {/* Referencia */}
              {(kpis.ref_botellas_total !== undefined) && (
                <KpiGroup titulo="Referencia seleccionada">
                  <KpiCard label="Botellas totales vendidas" value={kpis.ref_botellas_total}   tipo="numero" />
                  {kpis.ref_botellas_cliente !== undefined && (
                    <KpiCard label="Botellas a este cliente"  value={kpis.ref_botellas_cliente} tipo="numero" />
                  )}
                </KpiGroup>
              )}

            </div>
          )}
        </div>
      )}

      {/* ── Tabla de resultados ─────────────────────────────── */}
      {pedidos.length === 0 && !cargando ? (
        <EmptyState mensaje="Usa los filtros de arriba y pulsa Buscar" />
      ) : cargando ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                {['Fecha', 'Nº Pedido', 'Cód. Cliente', 'Cliente', 'Importe'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12,
                    fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'var(--surface-raised)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 14 }}><FechaCorta fecha={p.fecha} /></td>
                  <td style={{ padding: '10px 14px', fontSize: 14, fontFamily: 'monospace' }}>{p.numero_pedido}</td>
                  <td style={{ padding: '10px 14px', fontSize: 14 }}>{p.codigo_cliente}</td>
                  <td style={{ padding: '10px 14px', fontSize: 14 }}>{p.nombre_cliente}</td>
                  <td style={{ padding: '10px 14px', fontSize: 14, textAlign: 'right' }}>
                    <Money value={p.importe} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-raised)' }}>
                <td colSpan={4} style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>
                  Total ({pedidos.length} pedidos)
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--accent)' }}>
                  <Money value={pedidos.reduce((s, p) => s + parseFloat(p.importe || 0), 0)} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
