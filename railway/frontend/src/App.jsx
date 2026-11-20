import { useState } from 'react';
import Sidebar from './components/Sidebar';
import { ToastProvider } from './components/UI';
import Dashboard from './pages/Dashboard';
import Entidades from './pages/Entidades';
import Referencias from './pages/Referencias';
import Pedidos from './pages/Pedidos';
import Consultas from './pages/Consultas';
import { Facturas, Comisiones, Stock, Configuracion } from './pages/OtherPages';
import Login from './pages/Login';

function getUsuarioGuardado() {
  try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
}

export default function App() {
  const [page, setPage] = useState('/');
  const [usuario, setUsuario] = useState(getUsuarioGuardado);

  const handleLogin = (u) => {
    setUsuario(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  };

  if (!usuario) {
    return (
      <ToastProvider>
        <Login onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  const pages = {
    '/':               <Dashboard     onNavigate={setPage} />,
    '/entidades':      <Entidades />,
    '/referencias':    <Referencias />,
    '/pedidos':        <Pedidos />,
    '/facturas':       <Facturas />,
    '/comisiones':     <Comisiones />,
    '/stock':          <Stock />,
    '/consultas':      <Consultas />,
    '/configuracion':  <Configuracion />,
  };

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar current={page} onNavigate={setPage} usuario={usuario} onLogout={handleLogout} />
        <main className="main-content">
          {pages[page] || <Dashboard onNavigate={setPage} />}
        </main>
      </div>
    </ToastProvider>
  );
}
