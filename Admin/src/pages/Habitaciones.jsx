import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, increment, serverTimestamp, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { Clock, User, X, CheckCircle2, LogOut, Eraser, ReceiptIndianRupee, MapPin, Building, AlertTriangle } from 'lucide-react';

function Habitaciones() {
  const [habitaciones, setHabitaciones] = useState([]);
  
  // Estados para filtros y listas
  const [listaFranquicias, setListaFranquicias] = useState([]);
  const [listaSucursales, setListaSucursales] = useState([]); 
  const [filtroFranquicia, setFiltroFranquicia] = useState('TODAS');
  const [filtroSucursal, setFiltroSucursal] = useState('TODAS');

  const [habSeleccionada, setHabSeleccionada] = useState(null); 
  const [modo, setModo] = useState(''); 
  const [formData, setFormData] = useState({ nombre: '', curp: '', correo: '', telefono: '', serviciosExtra: '' });
  
  // === ESTADO DE OVERBOOKING EN TIEMPO REAL ===
  const [habitacionSecuestrada, setHabitacionSecuestrada] = useState(false);
  
  const sesionEmpleado = JSON.parse(localStorage.getItem('sesionSkyStay')) || JSON.parse(localStorage.getItem('sesionXone'));
  const esAdmin = sesionEmpleado?.rol === 'Admin VIP';

  // 1. Carga inicial de Metadatos
  useEffect(() => {
    if (esAdmin) {
      const cargarMetadatos = async () => {
        const [snapFranquicias, snapSucursales] = await Promise.all([
          getDocs(collection(db, "Franquicias")),
          getDocs(collection(db, "Sucursales"))
        ]);
        setListaFranquicias(snapFranquicias.docs.map(d => ({ id: d.id, ...d.data() })));
        setListaSucursales(snapSucursales.docs.map(d => ({ id: d.id, ...d.data() })));
      };
      cargarMetadatos();
    }
  }, [esAdmin]);

  const sucursalesFiltradas = useMemo(() => {
    if (filtroFranquicia === 'TODAS') return listaSucursales;
    return listaSucursales.filter(s => s.idFranquicia === filtroFranquicia);
  }, [filtroFranquicia, listaSucursales]);

  // 2. CARGA DEL INVENTARIO GLOBAL (Optimizado para CERO advertencias y cuidar Cuota)
  useEffect(() => {
    if (!sesionEmpleado) return;

    let q;
    if (esAdmin) {
      if (filtroSucursal !== 'TODAS') {
        q = query(collection(db, "Habitaciones"), where("idSucursal", "==", filtroSucursal));
      } else if (filtroFranquicia !== 'TODAS') {
        const ids = sucursalesFiltradas.map(s => s.id);
        // PROTECCIÓN DE CUOTA: Si la franquicia no tiene hoteles, NO consultamos a Firebase
        if (ids.length === 0) return; 
        
        q = query(collection(db, "Habitaciones"), where("idSucursal", "in", ids));
      } else {
        q = collection(db, "Habitaciones");
      }
    } else {
      q = query(collection(db, "Habitaciones"), where("idSucursal", "==", sesionEmpleado.idSucursal));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHabitaciones(docs.sort((a, b) => a.numero.localeCompare(b.numero, undefined, {numeric: true})));
    });

    return () => unsubscribe();
  }, [sesionEmpleado, esAdmin, filtroFranquicia, filtroSucursal, sucursalesFiltradas]);

  // === 3. EL "VIGILANTE LÁSER" (OVERBOOKING EN MILISEGUNDOS) ===
  useEffect(() => {
    let unsubscribeLaser = null;

    if (habSeleccionada && modo === 'checkin') {
      const habRef = doc(db, "Habitaciones", habSeleccionada.id);
      
      unsubscribeLaser = onSnapshot(habRef, (docSnap) => {
        if (docSnap.exists()) {
          const estadoEnNube = docSnap.data().estado;
          if (estadoEnNube !== 'disponible') {
            setHabitacionSecuestrada(true); 
          }
        }
      });
    }

    return () => {
      if (unsubscribeLaser) unsubscribeLaser(); 
    };
  }, [habSeleccionada, modo]);

  // === 4. FILTRO VISUAL LIMPIO ===
  const habitacionesVisuales = useMemo(() => {
    // Si elegimos una franquicia que no tiene hoteles, mostramos vacío sin causar errores
    if (esAdmin && filtroFranquicia !== 'TODAS' && sucursalesFiltradas.length === 0) return [];
    
    let filtradas = habitaciones;
    if (esAdmin) {
      if (filtroFranquicia !== 'TODAS') {
        const ids = sucursalesFiltradas.map(s => s.id);
        filtradas = filtradas.filter(h => ids.includes(h.idSucursal));
      }
      if (filtroSucursal !== 'TODAS') {
        filtradas = filtradas.filter(h => h.idSucursal === filtroSucursal);
      }
    }
    return filtradas;
  }, [habitaciones, esAdmin, filtroFranquicia, filtroSucursal, sucursalesFiltradas]);

  const handleFranquiciaChange = (e) => {
    setFiltroFranquicia(e.target.value);
    setFiltroSucursal('TODAS'); 
  };

  const cerrarModal = () => {
    setHabSeleccionada(null); 
    setModo('');
    setHabitacionSecuestrada(false); 
    setFormData({ nombre: '', curp: '', correo: '', telefono: '', serviciosExtra: '' });
  };

  const registrarEnBitacora = async (accion, detalle) => {
    if (!sesionEmpleado) return;
    await addDoc(collection(db, "Bitacora"), { 
      tipoAccion: accion, 
      nombreEmpleado: sesionEmpleado.nombre || 'Administrador Sistema', 
      rolEmpleado: sesionEmpleado.rol || 'N/A', 
      detalles: detalle, 
      fecha: serverTimestamp() 
    });
  };

  const manejarInteraccionTarjeta = (hab) => {
    const rolActual = sesionEmpleado?.rol;
    if (hab.estado === 'disponible') {
      if (rolActual === 'Staff Limpieza') return alert('⛔ Acceso denegado: Solo Recepción o Administración pueden registrar huéspedes.');
      setModo('checkin');
    } else if (hab.estado === 'ocupado') {
      if (rolActual === 'Staff Limpieza') return alert('⛔ Acceso denegado: Solo Recepción o Administración pueden cobrar y hacer Check-out.');
      setModo('checkout');
    } else if (hab.estado === 'mantenimiento') {
      if (rolActual === 'Recepcionista') return alert(' Acceso denegado: Solo el personal de Limpieza puede marcar la habitación como lista.');
      setModo('limpieza');
    }
    setHabSeleccionada(hab);
    setHabitacionSecuestrada(false); 
  };

  const regexCURP = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/;
  const regexCorreo = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const curpValida = formData.curp.length === 0 || regexCURP.test(formData.curp.toUpperCase());
  const correoValido = formData.correo.length === 0 || regexCorreo.test(formData.correo);
  const telefonoLleno = formData.telefono.length === 10;
  const formCheckinValido = formData.nombre.length > 0 && curpValida && formData.curp.length === 18 && correoValido && formData.correo.length > 0 && telefonoLleno;

  const realizarCheckIn = async (e) => {
    e.preventDefault();
    if (!formCheckinValido || habitacionSecuestrada) return; 
    
    try {
      const habRef = doc(db, "Habitaciones", habSeleccionada.id);
      
      await runTransaction(db, async (transaction) => {
        const habDoc = await transaction.get(habRef);
        if (!habDoc.exists()) throw new Error("La habitación no existe.");
        if (habDoc.data().estado !== 'disponible') throw new Error("HABITACION_OCUPADA");

        transaction.update(habRef, { 
          estado: 'ocupado', 
          huespedNombre: formData.nombre, 
          huespedID: formData.curp.toUpperCase(), 
          serviciosActuales: formData.serviciosExtra ? formData.serviciosExtra.split(',').map(s => s.trim()) : [], 
          fechaIngreso: serverTimestamp() 
        });

        const usuarioRef = doc(db, "Usuarios", formData.curp.toUpperCase());
        transaction.set(usuarioRef, { 
          nombre: formData.nombre, 
          curp: formData.curp.toUpperCase(), 
          correo: formData.correo, 
          telefono: formData.telefono, 
          ultimaVisita: serverTimestamp(), 
          totalEstancias: increment(1) 
        }, { merge: true });

        const nuevaReservaRef = doc(collection(db, "Reservas"));
        transaction.set(nuevaReservaRef, { 
          idSucursal: habSeleccionada.idSucursal, 
          idHabitacion: habSeleccionada.id, 
          numeroHabitacion: habSeleccionada.numero, 
          idUsuario: formData.curp.toUpperCase(), 
          nombreUsuario: formData.nombre, 
          fechaIngreso: serverTimestamp(), 
          estado: 'Activa', 
          totalGenerado: Number(habSeleccionada.precioBase) 
        });

        const nuevaBitacoraRef = doc(collection(db, "Bitacora"));
        transaction.set(nuevaBitacoraRef, { 
          tipoAccion: 'OPERACIÓN', 
          nombreEmpleado: sesionEmpleado.nombre || 'Admin', 
          rolEmpleado: sesionEmpleado.rol || 'Sistema', 
          detalles: `Check-in: Huésped ${formData.nombre} en Habitación #${habSeleccionada.numero}`, 
          fecha: serverTimestamp() 
        });
      });

      cerrarModal();

    } catch (error) { 
      console.error(error); 
      if (error.message === "HABITACION_OCUPADA") {
        setHabitacionSecuestrada(true); 
      } else {
        alert("Ocurrió un error inesperado al procesar el Check-in.");
      }
    }
  };

  const realizarCheckOut = async () => {
    try {
      await updateDoc(doc(db, "Habitaciones", habSeleccionada.id), { estado: 'mantenimiento', fechaSalidaReal: serverTimestamp() });
      const q = query(collection(db, "Reservas"), where("idHabitacion", "==", habSeleccionada.id), where("estado", "==", "Activa"));
      
      const snapshotDocs = await getDocs(q);
      snapshotDocs.forEach(async (d) => { 
        await updateDoc(doc(db, "Reservas", d.id), { estado: 'Completada', fechaSalida: serverTimestamp() }); 
      });

      await registrarEnBitacora('MODIFICACIÓN', `Check-out: Habitación #${habSeleccionada.numero} a limpieza.`);
      cerrarModal();
    } catch (error) { console.error(error); }
  };

  const finalizarLimpieza = async () => {
    try {
      await updateDoc(doc(db, "Habitaciones", habSeleccionada.id), { estado: 'disponible', huespedNombre: null, huespedID: null, serviciosActuales: [], fechaIngreso: null, fechaSalidaReal: null });
      await registrarEnBitacora('OPERACIÓN', `Limpieza terminada: Habitación #${habSeleccionada.numero} lista.`);
      cerrarModal();
    } catch (error) { console.error(error); }
  };

  const calcularRestante = (fechaIngreso) => {
    if (!fechaIngreso) return "00h 00m";
    const dif = new Date(fechaIngreso.toDate().getTime() + 12 * 60 * 60 * 1000) - new Date();
    if (dif <= 0) return "¡AGOTADO!";
    return `${Math.floor(dif / (1000 * 60 * 60))}h ${Math.floor((dif % (1000 * 60 * 60)) / (1000 * 60))}m`;
  };

  const estilosTarjeta = (estado) => {
    switch (estado) {
      case 'disponible': return { bg: '#f0fdf4', border: '#4ade80', txtF: '#14532d', txtS: '#16a34a' };
      case 'ocupado': return { bg: '#fef2f2', border: '#f87171', txtF: '#7f1d1d', txtS: '#dc2626' };
      default: return { bg: '#fffbeb', border: '#facc15', txtF: '#713f12', txtS: '#d97706' };
    }
  };

  return (
    <div className="habitaciones-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', gap: '20px', flexWrap: 'wrap' }}>
        <div><h2 style={{ color: '#0f172a', margin: '0 0 5px 0' }}>Panel Operativo</h2><p style={{ color: '#64748b', margin: 0 }}>Gestiona estancias (Control de Acceso Activado).</p></div>
        {esAdmin && (
          <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', padding: '20px 28px', borderRadius: '14px', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '28px', border: '1px solid #e2e8f0' }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start'}}>
              <label style={{ fontWeight: '700', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}><div style={{ background: '#dbeafe', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building size={14} color="#0284c7"/></div> Franquicia</label>
              <select value={filtroFranquicia} onChange={handleFranquiciaChange} style={{ color: '#0f172a', border: '2px solid #e2e8f0', background: '#ffffff', padding: '11px 14px', borderRadius: '8px', outline: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '14px', minWidth: '160px', transition: 'all 0.25s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <option value="TODAS" style={{color: '#0f172a'}}>Todas</option>
                {listaFranquicias.map(f => <option key={f.id} value={f.id} style={{color: '#0f172a'}}>{f.nombreCorporativo}</option>)}
              </select>
            </div>
            
            <div style={{borderLeft: '2px solid #e2e8f0', height: '50px', opacity: 0.4}}></div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start'}}>
              <label style={{ fontWeight: '700', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}><div style={{ background: '#dcfce7', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={14} color="#16a34a"/></div> Hotel</label>
              <select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)} style={{ color: '#0f172a', border: '2px solid #e2e8f0', background: '#ffffff', padding: '11px 14px', borderRadius: '8px', outline: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '14px', minWidth: '180px', transition: 'all 0.25s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <option value="TODAS" style={{color: '#0f172a'}}>Todos en Franquicia</option>
                {sucursalesFiltradas.map(s => <option key={s.id} value={s.id} style={{color: '#0f172a'}}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="room-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
        {habitacionesVisuales.map(hab => {
          const st = estilosTarjeta(hab.estado);
          return (
            <div key={hab.id} onClick={() => manejarInteraccionTarjeta(hab)} 
              style={{ padding: '20px', borderRadius: '16px', cursor: 'pointer', background: st.bg, border: `2px solid ${st.border}`, boxShadow: `0 4px 15px rgba(0,0,0,0.05)`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <span style={{ fontWeight: '900', fontSize: '24px', color: st.txtF }}>#{hab.numero}</span>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: st.txtS, background: 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: '8px' }}>{hab.tipo}</span>
              </div>
              {hab.estado === 'ocupado' ? (
                <div><p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 'bold', color: st.txtF, display: 'flex', alignItems: 'center', gap: '6px' }}><User size={15}/> {hab.huespedNombre}</p><p style={{ margin: 0, fontSize: '13px', color: st.txtS, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}><Clock size={14}/> {calcularRestante(hab.fechaIngreso)}</p></div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {hab.estado === 'disponible' ? <CheckCircle2 size={18} color={st.txtS}/> : <Eraser size={18} color={st.txtS}/>}
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: st.txtF }}>{hab.estado.toUpperCase()}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {habSeleccionada && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '450px', position: 'relative' }}>
            <button onClick={cerrarModal} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18}/></button>
            
            {/* === ALERTA DE OVERBOOKING EN TIEMPO REAL === */}
            {habitacionSecuestrada && (
              <div style={{ background: '#fef2f2', border: '2px solid #ef4444', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '10px' }} />
                <h4 style={{ margin: '0 0 5px 0', color: '#991b1b' }}>¡Habitación Interceptada!</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
                  El motor global detectó que alguien más acaba de reservar esta habitación. Formulario bloqueado de forma reactiva en tiempo real.
                </p>
                <button type="button" onClick={cerrarModal} style={{ marginTop: '15px', width: '100%', padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Regresar a Disponibilidad
                </button>
              </div>
            )}

            {!habitacionSecuestrada && modo === 'checkin' && (
              <form onSubmit={realizarCheckIn}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#0f172a' }}>Check-in: Hab. {habSeleccionada.numero}</h3>
                <div style={{ marginBottom: '15px' }}><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Nombre Completo Oficial</label><input type="text" required onChange={(e)=>setFormData({...formData, nombre: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', outlineColor: '#0284c7' }}/></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>CURP del Huésped</label><input type="text" required onChange={(e)=>setFormData({...formData, curp: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: formData.curp.length > 0 ? (curpValida ? '2px solid #22c55e' : '2px solid #ef4444') : '1px solid #cbd5e1', boxSizing: 'border-box', textTransform: 'uppercase', outlineColor: '#0284c7' }}/></div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Teléfono Celular</label>
                    <input type="tel" required placeholder="Solo números (10)" maxLength="10" value={formData.telefono} onChange={(e)=>setFormData({...formData, telefono: e.target.value.replace(/[^0-9]/g, '')})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: formData.telefono.length > 0 ? (telefonoLleno ? '2px solid #22c55e' : '2px solid #ef4444') : '1px solid #cbd5e1', boxSizing: 'border-box', outlineColor: '#0284c7' }}/>
                  </div>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Correo (Login App)</label>
                  <input type="email" required placeholder="correo@empresa.com" value={formData.correo} onChange={(e)=>setFormData({...formData, correo: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: formData.correo.length > 0 ? (correoValido ? '2px solid #22c55e' : '2px solid #ef4444') : '1px solid #cbd5e1', boxSizing: 'border-box', outlineColor: '#0284c7' }}/>
                  {formData.correo.length > 0 && !correoValido && <span style={{fontSize: '10px', color: '#ef4444', fontWeight: 'bold'}}>Formato requerido: usuario@dominio.com</span>}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button type="submit" disabled={!formCheckinValido} style={{ flex: 1, padding: '14px', background: formCheckinValido ? '#0284c7' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: formCheckinValido ? 'pointer' : 'not-allowed' }}>Confirmar Entrada</button>
                  <button type="button" onClick={cerrarModal} style={{ flex: 1, padding: '14px', background: 'white', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                </div>
              </form>
            )}

            {!habitacionSecuestrada && modo === 'checkout' && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '25px', color: '#0f172a' }}><ReceiptIndianRupee size={22} style={{display: 'inline', verticalAlign: 'middle', color: '#0284c7', marginRight: '5px'}}/> Resumen de Salida</h3>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #e2e8f0' }}><p style={{ margin: '0 0 12px 0', color: '#334155' }}><strong>Huésped:</strong> {habSeleccionada.huespedNombre}</p><div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: '16px' }}>Total a Pagar:</strong> <span style={{ color: '#16a34a', fontSize: '22px', fontWeight: '900' }}>${habSeleccionada.precioBase} MXN</span></div></div>
                <div style={{ display: 'flex', gap: '12px' }}><button onClick={realizarCheckOut} style={{ flex: 1, padding: '14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}><LogOut size={18} style={{display: 'inline', verticalAlign: 'middle', marginRight: '5px'}}/> Registrar Salida</button><button onClick={cerrarModal} style={{ flex: 1, padding: '14px', background: 'white', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button></div>
              </div>
            )}
            
            {!habitacionSecuestrada && modo === 'limpieza' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ background: '#fefce8', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}><Eraser size={30} color="#ca8a04"/></div>
                <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#0f172a' }}>Control de Limpieza</h3>
                <p style={{ color: '#475569', marginBottom: '30px' }}>La habitación <strong>#{habSeleccionada.numero}</strong> está en mantenimiento. ¿Ya está lista?</p>
                <div style={{ display: 'flex', gap: '12px' }}><button onClick={finalizarLimpieza} style={{ flex: 1, padding: '14px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}><CheckCircle2 size={18} style={{display: 'inline', verticalAlign: 'middle', marginRight: '5px'}}/> Disponible</button><button onClick={cerrarModal} style={{ flex: 1, padding: '14px', background: 'white', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Habitaciones;