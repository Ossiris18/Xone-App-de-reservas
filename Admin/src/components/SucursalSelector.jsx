import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MapPin } from 'lucide-react';

function SucursalSelector() {
  const [sucursales, setSucursales] = useState([]);
  const [seleccion, setSeleccion] = useState({
    pais: '',
    estado: '',
    municipio: '',
    hotel: localStorage.getItem('sucursalActiva') || ''
  });

  // 1. Cargar todas las sucursales de Firebase al inicio
  useEffect(() => {
    const obtenerSucursales = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "Sucursales"));
        const lista = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setSucursales(lista);
      } catch (error) {
        console.error("Error cargando sucursales:", error);
      }
    };
    obtenerSucursales();
  }, []);

  // 2. Filtrado dinámico según lo que vas eligiendo
  const hotelesFiltrados = sucursales.filter(h => {
    return h.ubicacion?.pais === seleccion.pais && 
           h.ubicacion?.estado === seleccion.estado;
  });

  return (
    <div className="nav-filtros-container">
      <div className="nav-label">
        <MapPin size={16} /> <span>Ubicación:</span>
      </div>

      {/* Selector de País */}
      <select 
        className="nav-select"
        value={seleccion.pais}
        onChange={(e) => setSeleccion({...seleccion, pais: e.target.value, estado: '', hotel: ''})}
      >
        <option value="">País</option>
        {[...new Set(sucursales.map(s => s.ubicacion?.pais))].map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* Selector de Estado (Solo si hay país) */}
      {seleccion.pais && (
        <select 
          className="nav-select"
          value={seleccion.estado}
          onChange={(e) => setSeleccion({...seleccion, estado: e.target.value, hotel: ''})}
        >
          <option value="">Estado</option>
          {[...new Set(sucursales.filter(s => s.ubicacion.pais === seleccion.pais).map(s => s.ubicacion.estado))].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      )}

      {/* Selector de Hotel (Solo si hay estado) */}
      {seleccion.estado && (
        <select 
          className="nav-select"
          value={seleccion.hotel}
          onChange={(e) => {
            const id = e.target.value;
            setSeleccion({...seleccion, hotel: id});
            localStorage.setItem('sucursalActiva', id);
            window.location.reload(); 
          }}
        >
          <option value="">Selecciona Hotel</option>
          {hotelesFiltrados.map(h => (
            <option key={h.id} value={h.id}>{h.nombre}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export default SucursalSelector;