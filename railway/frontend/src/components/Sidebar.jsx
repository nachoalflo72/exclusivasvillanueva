const MENU = [
  { path: '/',             label: 'Dashboard',    icon: '📊' },
  { path: '/entidades',    label: 'Entidades',    icon: '🏢' },
  { path: '/referencias',  label: 'Referencias',  icon: '🍷' },
  { path: '/pedidos',      label: 'Pedidos',      icon: '📋' },
  { path: '/facturas',     label: 'Facturas',     icon: '🧾' },
  { path: '/comisiones',   label: 'Comisiones',   icon: '💰' },
  { path: '/stock',        label: 'Stock',        icon: '📦' },
  { path: '/consultas',    label: 'Consultas',    icon: '🔍' },
  { path: '/configuracion',label: 'Configuración',icon: '⚙️' },
];

export default function Sidebar({ current, onNavigate }) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: 'var(--sidebar-w)', background: '#1e1b4b',
      display: 'flex', flexDirection: 'column', padding: '0 0 16px',
      zIndex: 100,
    }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Exclusivas
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 2 }}>
          Villanueva
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
        {MENU.map(item => {
          const active = current === item.path;
          return (
            <button key={item.path}
              onClick={() => onNavigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 12px', marginBottom: 2,
                background: active ? 'rgba(167,139,250,.25)' : 'transparent',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                color: active ? '#c4b5fd' : 'rgba(255,255,255,.7)',
                fontSize: 14, fontWeight: active ? 600 : 400,
                textAlign: 'left', transition: 'all .15s',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
