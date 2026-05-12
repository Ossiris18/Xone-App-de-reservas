import React, { useState } from 'react';
import Login from './pages/Login';
import Habitaciones from './pages/Habitaciones';
import Catalogos from './pages/Catalogos';
import Dashboard from './pages/Dashboard'; 
import Auditoria from './pages/Auditoria';
import './App.css';
import { LayoutDashboard, BedDouble, ShieldCheck, Settings, LogOut } from 'lucide-react';

import { SesionContext } from './context/SesionContext';

function App() {
  const [sesion, setSesion] = useState(() => {
    const sesionGuardada = localStorage.getItem('sesionSkyStay');
    return sesionGuardada ? JSON.parse(sesionGuardada) : null;
  });

  const [vistaActiva, setVistaActiva] = useState('dashboard'); 

  const manejarLogout = () => {
    localStorage.removeItem('sesionSkyStay');
    localStorage.removeItem('sucursalActiva');
    setSesion(null);
  };

  if (!sesion) {
    return <Login onLoginSuccess={(datos) => setSesion(datos)} />;
  }

  // Bloqueo si el correo no está verificado
  /* if (!sesion.emailVerified) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white', textAlign: 'center', padding: '20px' }}>
        <h1 style={{ color: '#38bdf8' }}>Verificación Requerida</h1>
        <p style={{ fontSize: '1.2rem', maxWidth: '500px', marginBottom: '30px' }}>
          Hemos enviado un enlace de verificación a tu correo <strong>{sesion.correo}</strong>. Por favor, revisa tu bandeja de entrada (y la carpeta de spam) para poder acceder al panel.
        </p>
        <button onClick={manejarLogout} style={{ padding: '12px 25px', backgroundColor: '#ef4444', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LogOut size={18} /> Cerrar Sesión para reintentar
        </button>
      </div>
    );
  } */

  const esAdminVIP = sesion.rol === 'Admin VIP';
  const esRecepcionista = sesion.rol === 'Recepcionista';
  const esAdminFranquicia = sesion.rol === 'Admin Franquicia';

  if (esRecepcionista && sesion.idSucursal) {
    localStorage.setItem('sucursalActiva', sesion.idSucursal);
  }

  return (
    <SesionContext.Provider value={sesion}>
      <div className="app-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
        
        {/* SIDEBAR */}
        <div className="sidebar" style={{ width: '250px', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '25px 20px' }}>
            <h2 style={{ color: '#38bdf8', margin: 0, fontSize: '24px' }}>Xone</h2>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, letterSpacing: '1px' }}>ADMIN PANEL</p>
          </div>

          <nav style={{ flex: 1, padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: vistaActiva === 'dashboard' ? '#1e293b' : 'transparent', border: 'none', color: vistaActiva === 'dashboard' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', textAlign: 'left', width: '100%', borderLeft: vistaActiva === 'dashboard' ? '4px solid #38bdf8' : '4px solid transparent' }} onClick={() => setVistaActiva('dashboard')}>
              <LayoutDashboard size={18}/> Dashboard
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: vistaActiva === 'habitaciones' ? '#1e293b' : 'transparent', border: 'none', color: vistaActiva === 'habitaciones' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', textAlign: 'left', width: '100%', borderLeft: vistaActiva === 'habitaciones' ? '4px solid #38bdf8' : '4px solid transparent' }} onClick={() => setVistaActiva('habitaciones')}>
              <BedDouble size={18}/> Habitaciones
            </button>

            {(esAdminVIP || esAdminFranquicia) && (
              <>
                <button style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: vistaActiva === 'auditoria' ? '#1e293b' : 'transparent', border: 'none', color: vistaActiva === 'auditoria' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', textAlign: 'left', width: '100%', borderLeft: vistaActiva === 'auditoria' ? '4px solid #38bdf8' : '4px solid transparent' }} onClick={() => setVistaActiva('auditoria')}>
                  <ShieldCheck size={18}/> Auditoría
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: vistaActiva === 'catalogos' ? '#1e293b' : 'transparent', border: 'none', color: vistaActiva === 'catalogos' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', textAlign: 'left', width: '100%', borderLeft: vistaActiva === 'catalogos' ? '4px solid #38bdf8' : '4px solid transparent' }} onClick={() => setVistaActiva('catalogos')}>
                  <Settings size={18}/> Catálogos
                </button>
              </>
            )}
          </nav>

          {/* PERFIL */}
          <div style={{ padding: '20px', borderTop: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#0f172a', fontSize: '18px' }}>
                {sesion.nombre ? sesion.nombre.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: 'white' }}>{sesion.nombre}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{sesion.rol}</p>
              </div>
            </div>
            <button onClick={manejarLogout} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </div>
        </div>

        {/* ÁREA PRINCIPAL */}
        <div className="main-content" style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
          {vistaActiva === 'dashboard' && <Dashboard />}
          {vistaActiva === 'habitaciones' && <Habitaciones />}
          {vistaActiva === 'catalogos' && (esAdminVIP || esAdminFranquicia) && <Catalogos />}
          {vistaActiva === 'auditoria' && esAdminVIP && <Auditoria />}
        </div>
      </div>
    </SesionContext.Provider>
  );
}

export default App;