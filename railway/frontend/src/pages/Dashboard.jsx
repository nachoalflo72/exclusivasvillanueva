import { useState, useEffect } from 'react';
import api from '../utils/api';
import { SectionTitle, Money, Spinner } from '../components/UI';

function KpiTile({ label, value, tipo, onClick }) {
  const formatted = tipo === 'dinero'
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0)
    : (value || 0).toLocaleString('es-ES');
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '18px 20px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow .15s',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>
        {formatted}
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/pedidos?estado=borrador').catch(() => ({ data: [] })),
      api.get('/pedidos?estado=enviado').catch(() => ({ data: [] })),
      api.get('/comisiones?liquidada=false').catch(() => ({ data: [] })),
      api.get('/entidades?tipo=cliente&activa=true').catch(() => ({ data: [] })),
      api.get('/entidades?tipo=bodega&activa=true').catch(() => ({ data: [] })),
    ]).then(([borradores, enviados, comisiones, clientes, bodegas]) => {
      const totalComisiones = comisiones.data.reduce((s, p) => s + parseFloat(p.total_comisiones_real ?? p.total_comisiones ?? 0), 0);
      setData({
        borradores: borradores.data.length,
        enviados:   enviados.data.length,
        comisiones: totalComisiones,
        clientes:   clientes.data.length,
        bodegas:    bodegas.data.length,
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spinner /></div>;

  return (
    <div>
      <SectionTitle>Dashboard</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 32 }}>
        <KpiTile label="Pedidos en borrador"  value={data.borradores} onClick={() => onNavigate('/pedidos')} />
        <KpiTile label="Pedidos enviados"     value={data.enviados}   onClick={() => onNavigate('/pedidos')} />
        <KpiTile label="Comisiones pendientes" value={data.comisiones} tipo="dinero" onClick={() => onNavigate('/comisiones')} />
        <KpiTile label="Clientes activos"     value={data.clientes}   onClick={() => onNavigate('/entidades')} />
        <KpiTile label="Bodegas activas"      value={data.bodegas}    onClick={() => onNavigate('/entidades')} />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Accesos rápidos</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            ['📋 Nuevo pedido', '/pedidos'],
            ['🏢 Entidades',    '/entidades'],
            ['🍷 Referencias',  '/referencias'],
            ['🔍 Consultas',    '/consultas'],
          ].map(([label, path]) => (
            <button key={path} className="btn btn-secondary" onClick={() => onNavigate(path)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
