import { auth, db } from "../config/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  reload,
  updateProfile,
} from "firebase/auth";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";

const login = async (email, password) => {
  try {
    const response = await signInWithEmailAndPassword(auth, email, password);
    await reload(response.user);

    if (!response.user.emailVerified) {
      await signOut(auth);
      return {
        user: null,
        error:
          "Debes verificar tu correo antes de ingresar. Revisa tu bandeja de entrada.",
      };
    }

    return { user: response.user, error: null };
  } catch (error) {
    if (error.code === "auth/user-not-found") return { user: null, error: "No existe una cuenta con este correo" };
    if (error.code === "auth/wrong-password") return { user: null, error: "Contraseña incorrecta" };
    if (error.code === "auth/invalid-email") return { user: null, error: "Correo inválido" };
    if (error.code === "auth/invalid-credential") return { user: null, error: "Correo o contraseña incorrectos" };
    return { user: null, error: "Error al iniciar sesión" };
  }
};

const upsertUserProfile = async ({ user, nombre = "", telefono = "", curp = "" }) => {
  if (!user?.uid) return;

  await setDoc(
    doc(db, "Usuarios", user.uid),
    {
      uid: user.uid,
      correo: user.email || "",
      nombre: nombre || user.displayName || "Usuario SkyStay",
      telefono: telefono || "",
      curp: curp || "",
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
};

const register = async (email, password, nombre, apellido, telefono, curp) => {
  try {
    const response = await createUserWithEmailAndPassword(auth, email, password);
    const user = response.user;

    const fullName = [nombre, apellido].filter(Boolean).join(" ").trim();
    if (fullName) {
      await updateProfile(user, { displayName: fullName });
    }

    await upsertUserProfile({
      user,
      nombre: fullName,
      telefono,
      curp,
    });

    await sendEmailVerification(user);
    await signOut(auth);

    return { user, error: null };
  } catch (error) {
    if (error.code === "auth/email-already-in-use") return { user: null, error: "Este correo ya está registrado" };
    if (error.code === "auth/invalid-email") return { user: null, error: "Correo inválido" };
    return { user: null, error: "Error al registrarse" };
  }
};

const logout = async () => {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    return false;
  }
};

const eliminarCuenta = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      await deleteDoc(doc(db, "Usuarios", user.uid));
      await deleteUser(user);
      return { success: true, error: null };
    }
    return { success: false, error: "No hay usuario autenticado" };
  } catch (error) {
    if (error.code === "auth/requires-recent-login") {
      return { success: false, error: "Por seguridad debes iniciar sesión de nuevo antes de eliminar tu cuenta" };
    }
    return { success: false, error: "Error al eliminar la cuenta" };
  }
};

export const authServices = { login, logout, register, eliminarCuenta };