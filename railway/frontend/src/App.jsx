import { useState } from 'react';
import Sidebar from './components/Sidebar';
import { ToastProvider } from './components/UI';
import Dashboard      from './pages/Dashboard';
import Entidades      from './pages/Entidades';
import Referencias    from './pages/Referencias';
import Pedidos        from './pages/Pedidos';
import Consultas      from './pages/Consultas';
import { Facturas, Comisiones, Stock, Configuracion } from './pages/OtherPages';

export default function App() {
  const [page, setPage] = useState('/');

  const pages = {
    '/':              <Dashboard      onNavigate={setPage} />,
    '/entidades':     <Entidades />,
    '/referencias':   <Referencias />,
    '/pedidos':       <Pedidos />,
    '/facturas':      <Facturas />,
    '/comisiones':    <Comisiones />,
    '/stock':         <Stock />,
    '/consultas':     <Consultas />,
    '/configuracion': <Configuracion />,
  };

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar current={page} onNavigate={setPage} />
        <main className="main-content">
          {pages[page] || <Dashboard onNavigate={setPage} />}
        </main>
      </div>
    </ToastProvider>
  );
}
