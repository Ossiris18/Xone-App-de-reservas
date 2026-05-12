import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyABe9tlHkP1c8SFSosyiYBXJF0GaZLCK6w",
  authDomain: "skystay-resorts.firebaseapp.com",
  projectId: "skystay-resorts",
  storageBucket: "skystay-resorts.firebasestorage.app",
  messagingSenderId: "357099858621",
  appId: "1:357099858621:web:a41b5869b7f88cbb90e5d4",
  measurementId: "G-60619J1B0E"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };