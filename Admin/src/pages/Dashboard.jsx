import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from '../firebase'; 
import { Users, CalendarCheck, Clock, TrendingUp } from 'lucide-react';

function Dashboard() {
  const [reservas, setReservas] = useState([]);
  const [mapaSucursales, setMapaSucursales] = useState({});
  const [stats, setStats] = useState({ ingresos: 0, activas: 0, total: 0 });
  const sesion = JSON.parse(localStorage.getItem('sesionSkyStay'));

  useEffect(() => {
    if (!sesion) return;
    const cargarNombresHoteles = async () => {
      const snap = await getDocs(collection(db, "Sucursales"));
      const mapa = {};
      snap.forEach(doc => { mapa[doc.id] = doc.data().nombre; });
      setMapaSucursales(mapa);
    };
    cargarNombresHoteles();

    let q = sesion.rol === 'Admin VIP' ? query(collection(db, "Reservas")) : query(collection(db, "Reservas"), where("idSucursal", "==", sesion.idSucursal));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => b.fechaIngreso?.toMillis() - a.fechaIngreso?.toMillis());

      let sumaIngresos = 0, habitacionesOcupadas = 0;
      docs.forEach(res => {
        if (res.estado === 'Activa') habitacionesOcupadas++;
        if (res.estado === 'Completada') sumaIngresos += (res.totalGenerado || 0);
      });
      setReservas(docs); setStats({ ingresos: sumaIngresos, activas: habitacionesOcupadas, total: docs.length });
    });
    return () => unsubscribe();
  }, [sesion]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ marginBottom: '25px' }}>
        <h2 style={{ fontSize: '24px', color: '#0f172a' }}>Dashboard Global de Operaciones</h2>
        <p style={{ color: '#64748b' }}>Monitoreo en tiempo real - {sesion?.nombre}</p>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        {/* RESTRICCIÓN: Solo el Admin ve el dinero */}
        {sesion?.rol === 'Admin VIP' && (
          <div className="stat-card" style={{ flex: 1, minWidth: '240px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px', borderRadius: '10px' }}><TrendingUp /></div>
            <div><h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Ingresos Totales</h3><p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>${stats.ingresos.toLocaleString()}</p></div>
          </div>
        )}
        
        <div className="stat-card" style={{ flex: 1, minWidth: '240px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '10px' }}><Clock /></div>
          <div><h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Cuartos Ocupados</h3><p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{stats.activas}</p></div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: '240px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#f1f5f9', color: '#475569', padding: '12px', borderRadius: '10px' }}><CalendarCheck /></div>
          <div><h3 style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Total de Movimientos</h3><p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{stats.total}</p></div>
        </div>
      </div>

      {/* La tabla sigue igual */}
      <div className="table-container" style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={20}/> Flujo de Huéspedes</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ padding: '12px', color: '#64748b' }}>Fecha y Hora</th><th style={{ padding: '12px', color: '#64748b' }}>Huésped</th><th style={{ padding: '12px', color: '#64748b' }}>Origen (Hotel)</th><th style={{ padding: '12px', color: '#64748b' }}>Habitación</th><th style={{ padding: '12px', color: '#64748b' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((res) => (
              <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px', fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>{res.fechaIngreso ? res.fechaIngreso.toDate().toLocaleString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'}) : '...'} hs</td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{res.nombreUsuario}</td><td style={{ padding: '12px', color: '#0284c7' }}>{mapaSucursales[res.idSucursal] || 'Cargando...'}</td><td style={{ padding: '12px' }}>#{res.numeroHabitacion}</td>
                <td style={{ padding: '12px' }}><span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: res.estado === 'Activa' ? '#fee2e2' : '#dcfce7', color: res.estado === 'Activa' ? '#dc2626' : '#16a34a' }}>{res.estado === 'Activa' ? 'OCUPADA' : 'SALIDA (OK)'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default Dashboard;