import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 👇 AQUÍ ADENTRO PEGAS TUS NUEVAS CREDENCIALES DEL NUEVO PROYECTO
const firebaseConfig = {
  apiKey: "AIzaSyABe9tlHkP1c8SFSosyiYBXJF0GaZLCK6w",
  authDomain: "skystay-resorts.firebaseapp.com",
  projectId: "skystay-resorts",
  storageBucket: "skystay-resorts.firebasestorage.app",
  messagingSenderId: "357099858621",
  appId: "1:357099858621:web:a41b5869b7f88cbb90e5d4",
  measurementId: "G-60619J1B0E"
};
// 👆 HASTA AQUÍ

// --- APP PRINCIPAL (La que usas tú para loguearte) ---
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- APP SECUNDARIA (El clon silencioso para crear staff de forma segura) ---
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);
export const storage = getStorage(app);