import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";

const EMAILJS_SERVICE_ID = "service_br0yn2y";
const EMAILJS_TEMPLATE_ID = "template_frhsxvn";
const EMAILJS_PUBLIC_KEY = "15C3JhlfZqU25RCNm";
const EMAILJS_PRIVATE_KEY = "oIMNECNhjSjnBwfdeSnpA";
const EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";

const mapDoc = (docSnapshot) => ({
  id: docSnapshot.id,
  ...docSnapshot.data(),
});

export const getSucursales = async () => {
  const snapshot = await getDocs(collection(db, "Sucursales"));
  return snapshot.docs.map(mapDoc);
};

export const getSucursalById = async (idSucursal) => {
  const snapshot = await getDoc(doc(db, "Sucursales", idSucursal));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
};

export const getHabitacionesBySucursal = async (idSucursal) => {
  const habitacionesQuery = query(
    collection(db, "Habitaciones"),
    where("idSucursal", "==", idSucursal)
  );

  const snapshot = await getDocs(habitacionesQuery);
  return snapshot.docs.map(mapDoc);
};

export const getHabitacionesDisponiblesBySucursal = async (idSucursal) => {
  const habitacionesQuery = query(
    collection(db, "Habitaciones"),
    where("idSucursal", "==", idSucursal),
    where("estado", "==", "disponible")
  );

  const snapshot = await getDocs(habitacionesQuery);
  return snapshot.docs.map(mapDoc);
};

export const getUsuarioPorUid = async (uid) => {
  if (!uid) return null;
  const usuariosQuery = query(collection(db, "Usuarios"), where("uid", "==", uid));
  const snapshot = await getDocs(usuariosQuery);
  if (snapshot.empty) {
    return null;
  }
  // Devuelve el primer usuario encontrado con ese UID
  return mapDoc(snapshot.docs[0]);
};

export const getReservasByUsuario = async (curp) => {
  if (!curp) return [];
  const reservasQuery = query(collection(db, "Reservas"), where("idUsuario", "==", curp));
  const snapshot = await getDocs(reservasQuery);
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(mapDoc);
};

export const saveReservaCheckout = async ({
  hotel,
  habitacion,
  total,
  curp,
  telefono,
  nombreUsuario,
  correo,
  uid,
  mensajeEspecial,
  metodoPago,
  ultimos4,
  fechaEntrada,
  fechaSalida,
}) => {
  // Obtener la información completa y actualizada del hotel para el correo
 const hotelCompleto = await getSucursalById(hotel.id);
  if (!hotelCompleto) throw new Error("No se pudo obtener la información completa del hotel.");

  const totalFinal = total || Number(habitacion?.precioBase || 0);
  const habitacionRef = doc(db, "Habitaciones", habitacion.id);

  // 1. Actualizar estado de habitación para evitar overbooking
  await updateDoc(habitacionRef, {
    estado: "ocupado",
  });

  // 2. Registrar/Actualizar datos del usuario
  await setDoc(
    doc(db, "Usuarios", curp),
    {
      nombre: nombreUsuario || "Usuario",
      curp,
      correo: correo || "",
      telefono,
      totalEstancias: increment(1),
      uid: uid || "",
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );

  // 3. Crear la reserva
  await addDoc(collection(db, "Reservas"), {
    idSucursal: hotelCompleto.id,
    idHabitacion: habitacion.id,
    numeroHabitacion: habitacion.numero || "",
    idUsuario: curp,
    nombreUsuario: nombreUsuario || "Usuario",
    estado: "Activa",
    totalGenerado: totalFinal,
    fechaIngreso: serverTimestamp(),
    fechaEntrada: fechaEntrada || null,
    fechaSalida: fechaSalida || null,
    mensajeEspecial: mensajeEspecial || "",
    metodoPago: metodoPago || "No definido",
    ultimos4Tarjeta: ultimos4 || "",
    estadoComprobante: "pendiente",
  });

  return {
    correoDestino: correo || "",
    plantilla: {
      nombreUsuario: nombreUsuario || "Usuario SkyStay",
      hotel: hotelCompleto?.nombre || "Hotel",
      habitacion: `${habitacion?.tipo || "Habitación"} #${habitacion?.numero || "-"}`,
      numeroHabitacion: String(habitacion?.numero || "-"),
      pais: hotelCompleto?.ubicacion?.pais || "No especificado",
      municipio: hotelCompleto?.ubicacion?.municipio || "No especificado",
      direccion: hotelCompleto?.ubicacion?.direccion || "No especificada",
      total: totalFinal,
      fechaEntrada: fechaEntrada || "Por definir",
      fechaSalida: fechaSalida || "Por definir",
      metodoPago: metodoPago || "No definido",
      ultimos4: ultimos4 || "",
    },
  };
};

export const prepararEnvioComprobante = async ({ correoDestino, plantilla }) => {
  const templateParams = {
    to_email: correoDestino,
    nombre_huesped: plantilla?.nombreUsuario || "Huesped",
    hotel: plantilla?.hotel || "SkyStay",
    numero_habitacion: plantilla?.numeroHabitacion || "-",
    pais: plantilla?.pais || "No especificado",
    municipio: plantilla?.municipio || "No especificado",
    direccion: plantilla?.direccion || "No especificada",
    precio_total: plantilla?.total || 0,
    fecha_entrada: plantilla?.fechaEntrada || "Por definir",
    fecha_salida: plantilla?.fechaSalida || "Por definir",
  };

  const response = await fetch(EMAILJS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    accessToken: EMAILJS_PRIVATE_KEY,
    template_params: templateParams,
  }),
  });

  if (!response.ok) {
    const detalle = await response.text();
    console.log("Error EmailJS:", detalle);
    return { status: "error", detalle };
  }

  return { status: "enviado", provider: "EmailJS" };
};

export const apiServices = {
  getSucursales,
  getSucursalById,
  getHabitacionesBySucursal,
  getHabitacionesDisponiblesBySucursal,
  getUsuarioPorUid,
  getReservasByUsuario,
  saveReservaCheckout,
  prepararEnvioComprobante,
};