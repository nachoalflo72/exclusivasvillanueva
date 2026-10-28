import { useState, useEffect, createContext, useContext } from 'react';

// ── Toast ─────────────────────────────────────────────────
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = (msg, tipo = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ── Modal ─────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, style, zIndex }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="modal-overlay" style={zIndex ? { zIndex } : undefined}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={style}>
        <div className="modal-title">{title}</div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────
export function Spinner() { return <span className="spinner" />; }

// ── EmptyState ────────────────────────────────────────────
export function EmptyState({ mensaje }) {
  return <div className="empty-state">{mensaje || 'Sin datos'}</div>;
}

// ── EstadoBadge ───────────────────────────────────────────
const ESTADO_CLS = {
  borrador:   'badge-gray',
  enviado:    'badge-yellow',
  servido:    'badge-purple',
  facturado:  'badge-green',
  anulado:    'badge-red',
  emitida:    'badge-yellow',
  cobrada:    'badge-green',
};
export function EstadoBadge({ estado }) {
  return <span className={`badge ${ESTADO_CLS[estado] || 'badge-gray'}`}>{estado}</span>;
}

// ── Money ─────────────────────────────────────────────────
export function Money({ value }) {
  const n = parseFloat(value || 0);
  return <>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)}</>;
}

// ── FechaCorta ────────────────────────────────────────────
export function FechaCorta({ fecha }) {
  if (!fecha) return <>—</>;
  const d = new Date(fecha);
  return <>{d.toLocaleDateString('es-ES')}</>;
}

// ── SectionTitle ─────────────────────────────────────────
export function SectionTitle({ children }) {
  return (
    <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: 'var(--text)' }}>
      {children}
    </h1>
  );
}
