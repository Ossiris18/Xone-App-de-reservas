import React, { useState, useEffect, useCallback, useContext } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase';
import { SesionContext } from '../context/SesionContext';
import { Trash2, MapPin, Image as ImageIcon, X } from 'lucide-react';

// === IMPORTACIONES DEL MAPA GLOBAL XONE ===
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Arreglo para el ícono del mapa
const iconoMapa = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// === COMPONENTE DEL MAPA EXTRAÍDO (Evita errores de renderizado en React) ===
function MapClicker({ coordsTemp, setCoordsTemp }) {
  useMapEvents({
    click(e) {
      setCoordsTemp({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return <Marker position={[coordsTemp.lat, coordsTemp.lng]} icon={iconoMapa} />;
}
// ============================================================================

const TIPOS_HABITACION = ["Tradicional", "Junior Suite", "Suite", "Presidencial", "Cabaña Eco"];
const SERVICIOS_DISPONIBLES = [ "1 Cama Matrimonial", "2 Camas Matrimoniales", "1 Cama King Size", "1 Baño Completo", "2 Baños", "Jacuzzi Privado", "Alberca 24hrs", "Cocina Equipada", "Refrigerador", "Cámaras 24/7", "Caja Fuerte", "Vista Mar", "Vista Selva", "WiFi", "Clima" ];

const convertirImagenABase64 = (archivo) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(archivo);
    reader.onload = () => resolve(reader.result);
    reader.onerror = err => reject(err);
  });
};

const validarCurpMatematica = (curp) => {
  const regex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/;
  if (!regex.test(curp)) return false;
  const dic = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  let suma = 0; for (let i = 0; i < 17; i++) { suma += dic.indexOf(curp.charAt(i)) * (18 - i); }
  let calc = 10 - (suma % 10); if (calc === 10) calc = 0;
  const last = curp.charAt(17);
  return parseInt(last, 10) === calc || dic.includes(last); 
};

function Catalogos() {
  const sesion = useContext(SesionContext);
  const [pestañaActiva, setPestañaActiva] = useState('franquicias'); 
  const [catalogoUbicaciones, setCatalogoUbicaciones] = useState({});
  const [listaFranquicias, setListaFranquicias] = useState([]); 
  const [listaSucursales, setListaSucursales] = useState([]); 
  const [listaPersonal, setListaPersonal] = useState([]);
  const [listaHuespedes, setListaHuespedes] = useState([]);

  const [archivoHotel, setArchivoHotel] = useState(null);
  const [archivoHabitacion, setArchivoHabitacion] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false); 
  const [numerosHabitacionExistentes, setNumerosHabitacionExistentes] = useState([]);

  const [nuevaFranquicia, setNuevaFranquicia] = useState({ nombreCorporativo: '', correoContacto: '', direccionPrincipal: '', nombreDueño: '', curpDueño: '', telefonoDueño: '' });
  const [nuevaSucursal, setNuevaSucursal] = useState({ idFranquicia: '', nombre: '', ubicacion: { pais: '', estado: '', municipio: '', direccion: '', lat: '', lng: '' }, moneda: 'MXN' });
  const [configHabitacion, setConfigHabitacion] = useState({ idFranquicia: '', idSucursal: '', cantidad: 1, numeroInicial: 101, tipo: 'Tradicional', precioBase: 1500, servicios: [] });
  const [nuevoEmpleado, setNuevoEmpleado] = useState({ nombre: '', curp: '', correo: '', password: '', rol: 'Recepcionista', idFranquicia: '', idSucursal: '' });

  // === ESTADOS PARA EL MAPA INTERACTIVO ===
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [coordsTemp, setCoordsTemp] = useState({ lat: 16.7569, lng: -93.1292 }); // Centro de Tuxtla por defecto

  const confirmarUbicacion = () => {
    setNuevaSucursal({
      ...nuevaSucursal,
      ubicacion: { ...nuevaSucursal.ubicacion, lat: coordsTemp.lat.toFixed(6), lng: coordsTemp.lng.toFixed(6) }
    });
    setMostrarMapa(false);
  };
  // ========================================

  const handleSucursalChange = async (e) => {
    const nuevoIdSucursal = e.target.value;
    setConfigHabitacion(prev => ({ ...prev, idSucursal: nuevoIdSucursal }));

    if (!nuevoIdSucursal) {
      setNumerosHabitacionExistentes([]);
      setConfigHabitacion(prev => ({ ...prev, numeroInicial: 101 }));
      return;
    }

    try {
      const q = query(collection(db, "Habitaciones"), where("idSucursal", "==", nuevoIdSucursal));
      const querySnapshot = await getDocs(q);
      const numeros = querySnapshot.docs.map(doc => parseInt(doc.data().numero, 10));
      
      setNumerosHabitacionExistentes(numeros);

      if (numeros.length > 0) {
        const maxNumero = Math.max(...numeros);
        setConfigHabitacion(prev => ({ ...prev, numeroInicial: maxNumero + 1 }));
      } else {
        setConfigHabitacion(prev => ({ ...prev, numeroInicial: 101 }));
      }
    } catch (err) { 
      console.error("Error al buscar habitaciones:", err); 
    }
  };

  const cargarDatos = useCallback(async () => {
    if (!sesion) return;
    const esAdminFranquicia = sesion.rol === 'Admin Franquicia';
    const esAdminVIP = sesion.rol === 'Admin VIP';

    try {
      const catSnap = await getDocs(collection(db, "Catalogos"));
      if (!catSnap.empty) {
        const primerDoc = catSnap.docs[0];
        const data = primerDoc.data();
        if (data.Ubicaciones) setCatalogoUbicaciones(data.Ubicaciones);
      }

      let franquiciasQuery = collection(db, "Franquicias");
      if (esAdminFranquicia) franquiciasQuery = query(franquiciasQuery, where('__name__', '==', sesion.idFranquicia));
      const franqSnap = await getDocs(franquiciasQuery);
      setListaFranquicias(franqSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      let sucursalesQuery = collection(db, "Sucursales");
      if (esAdminFranquicia) sucursalesQuery = query(sucursalesQuery, where("idFranquicia", "==", sesion.idFranquicia));
      const sucSnap = await getDocs(sucursalesQuery);
      setListaSucursales(sucSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      let personalQuery = collection(db, "Personal");
      if (esAdminFranquicia) personalQuery = query(personalQuery, where("idFranquicia", "==", sesion.idFranquicia));
      const persSnap = await getDocs(personalQuery);
      setListaPersonal(persSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      if (esAdminVIP) {
        const huespedSnap = await getDocs(collection(db, "Usuarios")); 
        setListaHuespedes(huespedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setListaHuespedes([]);
      }
    } catch (err) { 
      console.error("Error al cargar datos de catálogos:", err); 
    }
  }, [sesion]);

  useEffect(() => { 
    const iniciar = async () => { 
      if (sesion) {
        await cargarDatos(); 
        if (sesion.rol === 'Admin Franquicia') {
          setNuevaSucursal(prev => ({ ...prev, idFranquicia: sesion.idFranquicia }));
          setConfigHabitacion(prev => ({ ...prev, idFranquicia: sesion.idFranquicia }));
          setNuevoEmpleado(prev => ({ ...prev, idFranquicia: sesion.idFranquicia }));
        }
      }
    }; 
    iniciar(); 
  }, [cargarDatos, sesion]);

  // Validaciones
  const correoFranquiciaValido = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(nuevaFranquicia.correoContacto);
  const curpDueñoValida = validarCurpMatematica(nuevaFranquicia.curpDueño.toUpperCase());
  const formFranquiciaValido = nuevaFranquicia.nombreCorporativo.trim() !== '' && correoFranquiciaValido && nuevaFranquicia.direccionPrincipal.trim() !== '' && nuevaFranquicia.nombreDueño.trim() !== '' && curpDueñoValida && nuevaFranquicia.telefonoDueño.trim() !== '';
  const formSucursalValido = nuevaSucursal.idFranquicia !== '' && nuevaSucursal.nombre.trim() !== '' && nuevaSucursal.ubicacion.pais !== '' && nuevaSucursal.ubicacion.estado !== '' && nuevaSucursal.ubicacion.municipio !== '' && nuevaSucursal.ubicacion.direccion.trim() !== '' && nuevaSucursal.ubicacion.lat !== '' && nuevaSucursal.ubicacion.lng !== '' && archivoHotel !== null; 

  // Lógica de validación de ocupación de números
  let numeroHabitacionOcupado = false;
  const startNumTest = parseInt(configHabitacion.numeroInicial, 10) || 0;
  const cantidadTest = parseInt(configHabitacion.cantidad, 10) || 1;
  
  for (let i = 0; i < cantidadTest; i++) {
    if (numerosHabitacionExistentes.includes(startNumTest + i)) {
      numeroHabitacionOcupado = true;
      break;
    }
  }

  const formHabitacionesValido = configHabitacion.idFranquicia !== '' && configHabitacion.idSucursal !== '' && configHabitacion.cantidad > 0 && configHabitacion.numeroInicial !== '' && configHabitacion.precioBase > 0 && archivoHabitacion !== null; 

  const guardarFranquicia = async (e) => { 
    e.preventDefault(); 
    if(!formFranquiciaValido) return;
    try {
      await addDoc(collection(db, "Franquicias"), { ...nuevaFranquicia, curpDueño: nuevaFranquicia.curpDueño.toUpperCase() }); 
      setNuevaFranquicia({ nombreCorporativo: '', correoContacto: '', direccionPrincipal: '', nombreDueño: '', curpDueño: '', telefonoDueño: '' }); 
      cargarDatos(); 
    } catch(err) { 
      console.error(err);
      alert("Error al guardar franquicia"); 
    }
  };

  const guardarSucursal = async (e) => {
    e.preventDefault(); 
    if(!formSucursalValido) return;
    setSubiendoFoto(true);
    try {
      const urlDescarga = await convertirImagenABase64(archivoHotel);
      await addDoc(collection(db, "Sucursales"), { ...nuevaSucursal, fotoUrl: urlDescarga });
      setNuevaSucursal({ idFranquicia: '', nombre: '', ubicacion: { pais: '', estado: '', municipio: '', direccion: '', lat: '', lng: '' }, moneda: 'MXN' }); 
      setArchivoHotel(null);
      document.getElementById('inputFotoHotel').value = "";
      cargarDatos();
      alert("¡Hotel y foto registrados con éxito!");
    } catch(err) {
      console.error(err);
      alert("Error guardando el hotel: " + err.message);
    } finally { setSubiendoFoto(false); }
  };

  const generarHabitaciones = async (e) => {
    e.preventDefault();
    if(!formHabitacionesValido || numeroHabitacionOcupado) return;
    setSubiendoFoto(true);
    try {
      const urlDescarga = await convertirImagenABase64(archivoHabitacion);
      const startNum = parseInt(configHabitacion.numeroInicial);
      const cantidad = parseInt(configHabitacion.cantidad);
      const nuevosNumerosCargados = [];

      for (let i = 0; i < cantidad; i++) {
        const numeroActual = startNum + i;
        if (numerosHabitacionExistentes.includes(numeroActual)) continue; 
        await addDoc(collection(db, "Habitaciones"), {
          numero: numeroActual.toString(), idSucursal: configHabitacion.idSucursal, tipo: configHabitacion.tipo, precioBase: Number(configHabitacion.precioBase), servicios: configHabitacion.servicios, estado: 'disponible', fotoUrl: urlDescarga 
        });
        nuevosNumerosCargados.push(numeroActual);
      }
      
      setNumerosHabitacionExistentes([...numerosHabitacionExistentes, ...nuevosNumerosCargados]);
      const nuevoNumeroSugerido = startNum + cantidad;
      setConfigHabitacion({ ...configHabitacion, cantidad: 1, numeroInicial: nuevoNumeroSugerido, tipo: 'Tradicional', precioBase: 1500, servicios: [] });
      setArchivoHabitacion(null);
      document.getElementById('inputFotoHabitacion').value = "";
      alert("¡Inventario generado y fotos subidas!"); 
      cargarDatos();
    } catch(err) {
      console.error(err);
      alert("Error generando habitaciones: " + err.message);
    } finally { setSubiendoFoto(false); }
  };

  const reqLongitud = nuevoEmpleado.password.length >= 8;
  const reqMayuscula = /[A-Z]/.test(nuevoEmpleado.password);
  const reqNumero = /[0-9]/.test(nuevoEmpleado.password);
  const reqSimbolo = /[^A-Za-z0-9]/.test(nuevoEmpleado.password);
  const curpStaffValida = nuevoEmpleado.curp.length === 0 || validarCurpMatematica(nuevoEmpleado.curp.toUpperCase());
  const regexCorreo = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const correoValido = nuevoEmpleado.correo.length === 0 || regexCorreo.test(nuevoEmpleado.correo);
  const formStaffValido = reqLongitud && reqMayuscula && reqNumero && reqSimbolo && validarCurpMatematica(nuevoEmpleado.curp.toUpperCase()) && regexCorreo.test(nuevoEmpleado.correo);

  const guardarEmpleado = async (e) => {
    e.preventDefault(); 
    if (!formStaffValido) return;
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, nuevoEmpleado.correo, nuevoEmpleado.password);
      await sendEmailVerification(userCredential.user);
      await addDoc(collection(db, "Personal"), { nombre: nuevoEmpleado.nombre, curp: nuevoEmpleado.curp.toUpperCase(), correo: nuevoEmpleado.correo, rol: nuevoEmpleado.rol, idFranquicia: nuevoEmpleado.idFranquicia, idSucursal: nuevoEmpleado.idSucursal, verificado: false });
      setNuevoEmpleado({ nombre: '', curp: '', correo: '', password: '', rol: 'Recepcionista', idFranquicia: '', idSucursal: '' });
      cargarDatos(); 
      alert(`¡Se ha enviado un correo a ${nuevoEmpleado.correo} para verificar su identidad!`);
    } catch (err) { 
      console.error(err); 
      alert("Error Auth. Es posible que el correo ya esté en uso o sea inválido."); 
    }
  };

  const borrarDoc = async (coleccion, id) => { if (window.confirm("¿Eliminar registro permanentemente?")) { await deleteDoc(doc(db, coleccion, id)); cargarDatos(); } };
  const toggleServicio = (servicio) => { setConfigHabitacion(prev => ({ ...prev, servicios: prev.servicios.includes(servicio) ? prev.servicios.filter(s => s !== servicio) : [...prev.servicios, servicio] })); };
  const obtenerNombreSucursal = (id) => listaSucursales.find(s => s.id === id)?.nombre || 'N/A';
  const obtenerNombreFranquicia = (id) => listaFranquicias.find(f => f.id === id)?.nombreCorporativo || 'N/A';

  return (
    <div className="page-container">
      <div className="header-seccion"><h2 style={{ color: '#0f172a', margin: '0 0 5px 0' }}>Catálogos y Configuración Core</h2></div>

      <div className="tabs-container" style={{ display: 'flex', gap: '15px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
        {[ { id: 'franquicias', label: '1. Franquicias'}, { id: 'sucursales', label: '2. Hoteles (Fotos/Mapa)'}, { id: 'habitaciones', label: '3. Habitaciones'}, { id: 'personal', label: '4. Staff'}, { id: 'huespedes', label: '5. Directorio'} ].map(tab => (
          <button key={tab.id} onClick={() => setPestañaActiva(tab.id)} style={{ padding: '10px 15px', background: 'none', border: 'none', borderBottom: pestañaActiva === tab.id ? '3px solid #0284c7' : 'none', cursor: 'pointer', fontWeight: pestañaActiva === tab.id ? 'bold' : 'normal' }}>{tab.label}</button>
        ))}
      </div>

      {pestañaActiva === 'franquicias' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="card-formulario" style={{ background: 'white', padding: '25px', borderRadius: '12px' }}>
            <form onSubmit={guardarFranquicia} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <input type="text" placeholder="Nombre Corporativo" onChange={e => setNuevaFranquicia({...nuevaFranquicia, nombreCorporativo: e.target.value})} value={nuevaFranquicia.nombreCorporativo} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}/>
              <div>
                <input type="email" placeholder="Correo Oficial" onChange={e => setNuevaFranquicia({...nuevaFranquicia, correoContacto: e.target.value})} value={nuevaFranquicia.correoContacto} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: nuevaFranquicia.correoContacto.length > 0 ? (correoFranquiciaValido ? '2px solid #22c55e' : '2px solid #ef4444') : '1px solid #cbd5e1', boxSizing: 'border-box' }}/>
                {nuevaFranquicia.correoContacto.length > 0 && !correoFranquiciaValido && <span style={{fontSize: '10px', color: '#ef4444'}}>Formato de correo inválido.</span>}
              </div>
              <input type="text" placeholder="Dirección Fiscal Principal" onChange={e => setNuevaFranquicia({...nuevaFranquicia, direccionPrincipal: e.target.value})} value={nuevaFranquicia.direccionPrincipal} style={{ gridColumn: 'span 2', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}/>
              <input type="text" placeholder="CURP del Dueño" onChange={e => setNuevaFranquicia({...nuevaFranquicia, curpDueño: e.target.value})} value={nuevaFranquicia.curpDueño} style={{ padding: '10px', borderRadius: '6px', border: nuevaFranquicia.curpDueño.length > 0 ? (curpDueñoValida ? '2px solid #22c55e' : '2px solid #ef4444') : '1px solid #cbd5e1', textTransform: 'uppercase' }}/>
              <input type="text" placeholder="Nombre Completo del Dueño" onChange={e => setNuevaFranquicia({...nuevaFranquicia, nombreDueño: e.target.value})} value={nuevaFranquicia.nombreDueño} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="tel" placeholder="Teléfono del Dueño" onChange={e => setNuevaFranquicia({...nuevaFranquicia, telefonoDueño: e.target.value})} value={nuevaFranquicia.telefonoDueño} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}/>
              <button type="submit" disabled={!formFranquiciaValido} style={{ background: formFranquiciaValido ? '#0f172a' : '#cbd5e1', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: formFranquiciaValido ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>Guardar</button>
            </form>
          </div>
          <div className="card-tabla" style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
            <p style={{fontSize: '12px', color: '#16a34a', background: '#dcfce7', padding: '5px 10px', borderRadius: '5px', display: 'inline-block'}}>✓ Historial Inmutable</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '15px' }}>
              <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th>ID Sistema</th><th>Empresa Corporativa</th><th>Contacto</th><th>Dueño</th></tr></thead>
              <tbody>{listaFranquicias.map(f => (<tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{padding:'10px', fontSize:'11px', color:'#94a3b8'}}>{f.id}</td><td style={{fontWeight:'bold'}}>{f.nombreCorporativo}</td><td>{f.correoContacto}</td><td>{f.nombreDueño || 'N/A'}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {pestañaActiva === 'sucursales' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="card-formulario" style={{ background: 'white', padding: '25px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 5px 0' }}>Registrar Hotel (Mapas Integrados)</h3>
            <form onSubmit={guardarSucursal} style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <select onChange={e => setNuevaSucursal({...nuevaSucursal, idFranquicia: e.target.value})} value={nuevaSucursal.idFranquicia} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} disabled={sesion.rol === 'Admin Franquicia'}>
                  <option value="">Franquicia...</option>
                  {listaFranquicias.map(f => <option key={f.id} value={f.id}>{f.nombreCorporativo}</option>)}
                </select>
                <input type="text" placeholder="Nombre Comercial del Hotel" onChange={e => setNuevaSucursal({...nuevaSucursal, nombre: e.target.value})} value={nuevaSucursal.nombre} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}/>
              </div>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px dashed #94a3b8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ImageIcon color="#64748b" />
                <label style={{ fontSize: '13px', color: '#475569', flex: 1 }}>Sube una foto de la Fachada (Requerida - Peso ligero):</label>
                <input id="inputFotoHotel" type="file" accept="image/*" onChange={(e) => setArchivoHotel(e.target.files[0])} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select onChange={e => setNuevaSucursal({...nuevaSucursal, ubicacion: {...nuevaSucursal.ubicacion, pais: e.target.value, estado: '', municipio: ''}})} value={nuevaSucursal.ubicacion.pais} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">País</option>{Object.keys(catalogoUbicaciones).map(p => <option key={p} value={p}>{p}</option>)}</select>
                <select disabled={!nuevaSucursal.ubicacion.pais} onChange={e => setNuevaSucursal({...nuevaSucursal, ubicacion: {...nuevaSucursal.ubicacion, estado: e.target.value, municipio: ''}})} value={nuevaSucursal.ubicacion.estado} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Estado</option>{nuevaSucursal.ubicacion.pais && Object.keys(catalogoUbicaciones[nuevaSucursal.ubicacion.pais]).map(est => <option key={est} value={est}>{est}</option>)}</select>
                <select disabled={!nuevaSucursal.ubicacion.estado} onChange={e => setNuevaSucursal({...nuevaSucursal, ubicacion: {...nuevaSucursal.ubicacion, municipio: e.target.value}})} value={nuevaSucursal.ubicacion.municipio} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Municipio</option>{nuevaSucursal.ubicacion.estado && catalogoUbicaciones[nuevaSucursal.ubicacion.pais][nuevaSucursal.ubicacion.estado].map(m => <option key={m} value={m}>{m}</option>)}</select>
              </div>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'grid', gap: '10px' }}>
                <input type="text" placeholder="Dirección Exacta (Calle, Número, C.P.)" onChange={e => setNuevaSucursal({...nuevaSucursal, ubicacion: {...nuevaSucursal.ubicacion, direccion: e.target.value}})} value={nuevaSucursal.ubicacion.direccion} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}/>
                
                {/* === BOTONES DEL MAPA === */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                  <input type="text" readOnly placeholder="Latitud" value={nuevaSucursal.ubicacion.lat} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#e2e8f0', color: '#475569' }}/>
                  <input type="text" readOnly placeholder="Longitud" value={nuevaSucursal.ubicacion.lng} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#e2e8f0', color: '#475569' }}/>
                  <button type="button" onClick={() => setMostrarMapa(true)} style={{ background: '#0284c7', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 4px 6px rgba(2, 132, 199, 0.2)' }}>
                    <MapPin size={16}/> Abrir Mapa
                  </button>
                </div>
              </div>
              <button type="submit" disabled={!formSucursalValido || subiendoFoto} style={{ padding: '12px', background: formSucursalValido && !subiendoFoto ? '#0284c7' : '#cbd5e1', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: formSucursalValido && !subiendoFoto ? 'pointer' : 'not-allowed' }}>
                {subiendoFoto ? 'Procesando imagen (Puede tardar un poco)...' : 'Guardar Hotel'}
              </button>
            </form>
          </div>
          <div className="card-tabla" style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}><th style={{ padding: '10px' }}>Hotel</th><th>Franquicia</th><th>Foto</th></tr></thead>
              <tbody>
                {listaSucursales.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{s.nombre}</td>
                    <td style={{ color: '#0284c7' }}>{obtenerNombreFranquicia(s.idFranquicia)}</td>
                    <td>{s.fotoUrl ? <img src={s.fotoUrl} alt="Hotel" style={{width: '50px', height: '30px', objectFit: 'cover', borderRadius: '4px'}} /> : 'Sin foto'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestañaActiva === 'habitaciones' && (
        <div className="card-formulario" style={{ background: 'white', padding: '25px', borderRadius: '12px' }}>
          <form onSubmit={generarHabitaciones} style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px dashed #94a3b8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ImageIcon color="#64748b" />
                <label style={{ fontSize: '13px', color: '#475569', flex: 1 }}>Sube una foto prototipo de la habitación (Requerida - Peso ligero):</label>
                <input id="inputFotoHabitacion" type="file" accept="image/*" onChange={(e) => setArchivoHabitacion(e.target.files[0])} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <select onChange={e => setConfigHabitacion({...configHabitacion, idFranquicia: e.target.value, idSucursal: ''})} value={configHabitacion.idFranquicia} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} disabled={sesion.rol === 'Admin Franquicia'}>
                <option value="">Franquicia...</option>
                {listaFranquicias.map(f => <option key={f.id} value={f.id}>{f.nombreCorporativo}</option>)}
              </select>
              <select value={configHabitacion.idSucursal} onChange={handleSucursalChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <option value="">Selecciona Hotel Destino...</option>
                {listaSucursales.filter(s => s.idFranquicia === configHabitacion.idFranquicia).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
              <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Cantidad</label><input type="number" value={configHabitacion.cantidad} onChange={e => setConfigHabitacion({...configHabitacion, cantidad: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}/></div>
              <div>
                <label style={{fontSize:'12px', fontWeight:'bold'}}>N° Inicial</label>
                <input type="number" value={configHabitacion.numeroInicial} readOnly style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', fontWeight: 'bold' }} title="El sistema asigna este número automáticamente por seguridad"/>
                {numeroHabitacionOcupado && <span style={{fontSize: '10px', color: '#ef4444'}}>El número (o el rango) ya existe en este hotel.</span>}
              </div>
              <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Categoría</label><select onChange={e => setConfigHabitacion({...configHabitacion, tipo: e.target.value})} value={configHabitacion.tipo} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>{TIPOS_HABITACION.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Precio Base</label><input type="number" value={configHabitacion.precioBase} onChange={e => setConfigHabitacion({...configHabitacion, precioBase: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}/></div>
            </div>
            <div>
              <p style={{ fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>Amenidades para la App</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                {SERVICIOS_DISPONIBLES.map(s => (
                  <label key={s} style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center', background: configHabitacion.servicios.includes(s) ? '#e0f2fe' : 'white', border: configHabitacion.servicios.includes(s) ? '1px solid #38bdf8' : '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}><input type="checkbox" checked={configHabitacion.servicios.includes(s)} onChange={() => toggleServicio(s)} style={{ accentColor: '#0284c7' }}/> {s}</label>
                ))}
              </div>
            </div>
            <button type="submit" disabled={!formHabitacionesValido || subiendoFoto || numeroHabitacionOcupado} style={{ padding: '15px', background: formHabitacionesValido && !subiendoFoto && !numeroHabitacionOcupado ? '#0f172a' : '#cbd5e1', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: formHabitacionesValido && !subiendoFoto && !numeroHabitacionOcupado ? 'pointer' : 'not-allowed' }}>
              {subiendoFoto ? 'Procesando datos y foto...' : 'Generar Inventario y Subir Foto'}
            </button>
          </form>
        </div>
      )}

      {pestañaActiva === 'personal' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="card-formulario" style={{ background: 'white', padding: '25px', borderRadius: '12px' }}>
            <form onSubmit={guardarEmpleado} style={{ display: 'grid', gap: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <input type="text" placeholder="Nombre Staff" value={nuevoEmpleado.nombre} onChange={e => setNuevoEmpleado({...nuevoEmpleado, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}/>
                <input type="text" placeholder="CURP (Validación Matemática)" value={nuevoEmpleado.curp} onChange={e => setNuevoEmpleado({...nuevoEmpleado, curp: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: nuevoEmpleado.curp.length > 0 ? (curpStaffValida ? '2px solid #22c55e' : '2px solid #ef4444') : '1px solid #cbd5e1', textTransform: 'uppercase' }}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <input type="email" placeholder="Correo Oficial" value={nuevoEmpleado.correo} onChange={e => setNuevoEmpleado({...nuevoEmpleado, correo: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: nuevoEmpleado.correo.length > 0 ? (correoValido ? '2px solid #22c55e' : '2px solid #ef4444') : '1px solid #cbd5e1', boxSizing: 'border-box' }}/>
                  {nuevoEmpleado.correo.length > 0 && !correoValido && <span style={{fontSize: '10px', color: '#ef4444'}}>Formato requerido: usuario@empresa.com</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <input type="text" placeholder="Contraseña Segura" value={nuevoEmpleado.password} onChange={e => setNuevoEmpleado({...nuevoEmpleado, password: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: reqLongitud && reqMayuscula && reqNumero && reqSimbolo ? '2px solid #22c55e' : '1px solid #cbd5e1', outline: 'none' }}/>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px', marginTop: '4px', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: reqLongitud ? '#16a34a' : '#ef4444', fontWeight: 'bold' }}>{reqLongitud ? '✓' : '✗'} 8+ Caracteres</span>
                    <span style={{ color: reqMayuscula ? '#16a34a' : '#ef4444', fontWeight: 'bold' }}>{reqMayuscula ? '✓' : '✗'} 1 Mayúscula</span>
                    <span style={{ color: reqNumero ? '#16a34a' : '#ef4444', fontWeight: 'bold' }}>{reqNumero ? '✓' : '✗'} 1 Número</span>
                    <span style={{ color: reqSimbolo ? '#16a34a' : '#ef4444', fontWeight: 'bold' }}>{reqSimbolo ? '✓' : '✗'} 1 Símbolo especial</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <select onChange={e => setNuevoEmpleado({...nuevoEmpleado, rol: e.target.value})} value={nuevoEmpleado.rol} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="Recepcionista">Recepcionista</option>
                  <option value="Staff Limpieza">Staff Limpieza</option>
                  {sesion.rol === 'Admin VIP' && <option value="Admin Franquicia">Admin Franquicia</option>}
                  {sesion.rol === 'Admin VIP' && <option value="Admin VIP">Admin VIP</option>}
                </select>
                <select onChange={e => setNuevoEmpleado({...nuevoEmpleado, idFranquicia: e.target.value})} value={nuevoEmpleado.idFranquicia} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} disabled={sesion.rol === 'Admin Franquicia'}>
                  <option value="">Franquicia...</option>
                  {listaFranquicias.map(f => <option key={f.id} value={f.id}>{f.nombreCorporativo}</option>)}
                </select>
                <select disabled={!nuevoEmpleado.idFranquicia} onChange={e => setNuevoEmpleado({...nuevoEmpleado, idSucursal: e.target.value})} value={nuevoEmpleado.idSucursal} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}><option value="">Hotel asignado...</option>{listaSucursales.filter(s => s.idFranquicia === nuevoEmpleado.idFranquicia).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
              </div>
              <button type="submit" disabled={!formStaffValido} style={{ padding: '15px', background: formStaffValido ? '#0f172a' : '#cbd5e1', color: 'white', borderRadius: '8px', border: 'none', cursor: formStaffValido ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>Registrar Staff y Enviar Verificación</button>
            </form>
          </div>
          <div className="card-tabla" style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={{padding:'10px'}}>Staff</th><th>Rol</th><th>Hotel</th><th>Verificación</th><th>Acción</th></tr></thead>
              <tbody>
                {listaPersonal.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{padding:'10px'}}><strong>{p.nombre}</strong><br/><span style={{fontSize:'11px', color:'#64748b'}}>{p.curp}</span></td>
                    <td><span style={{fontSize:'11px', background:'#e2e8f0', padding:'2px 6px', borderRadius:'10px', fontWeight:'bold'}}>{p.rol}</span></td>
                    <td>{obtenerNombreSucursal(p.idSucursal)}</td>
                    <td><span style={{ background: p.verificado ? '#dcfce7' : '#fee2e2', color: p.verificado ? '#166534' : '#dc2626', padding: '4px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>{p.verificado ? 'Verificado' : 'Pendiente Mail'}</span></td>
                    <td><button onClick={() => borrarDoc('Personal', p.id)} style={{color:'#ef4444', background:'none', border:'none', cursor:'pointer'}}><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestañaActiva === 'huespedes' && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={{padding:'12px'}}>Cliente</th><th>CURP</th><th>Nivel</th></tr></thead>
            <tbody>
              {listaHuespedes.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{padding:'12px', fontWeight:'bold'}}>{h.nombre}</td>
                  <td>{h.curp || h.id}</td>
                  <td><span style={{ background: h.totalEstancias > 5 ? '#dcfce7' : '#f1f5f9', color: h.totalEstancias > 5 ? '#166534' : '#475569', padding: '4px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>{h.totalEstancias > 5 ? 'VIP' : 'Normal'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === MODAL DEL MAPA FLOTANTE === */}
      {mostrarMapa && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '700px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>Ubicación Global del Hotel</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Haz clic en el mapa para colocar el marcador (Pincito) en la ubicación exacta.</p>
              </div>
              <button onClick={() => setMostrarMapa(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} color="#475569" />
              </button>
            </div>
            
            {/* Contenedor del Mapa Leaflet */}
            <div style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e2e8f0', zIndex: 1 }}>
              <MapContainer center={[16.7569, -93.1292]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer 
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapClicker coordsTemp={coordsTemp} setCoordsTemp={setCoordsTemp} />
              </MapContainer>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>Lat: <span style={{ color: '#0284c7' }}>{coordsTemp.lat.toFixed(6)}</span></div>
                <div style={{ background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>Lng: <span style={{ color: '#0284c7' }}>{coordsTemp.lng.toFixed(6)}</span></div>
              </div>
              <button onClick={confirmarUbicacion} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(22, 163, 74, 0.2)' }}>
                Confirmar Coordenadas
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Catalogos;