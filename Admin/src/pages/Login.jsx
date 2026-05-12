import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; 
import { Lock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [cargando, setCargando] = useState(false);

  // VALIDACIÓN ESTRICTA DE CORREO
  const regexCorreo = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const manejarLogin = async (e) => {
    e.preventDefault();
    setCargando(true); 
    setError('');
    setMensajeExito('');

    if (!regexCorreo.test(email)) {
      setError('Formato de correo inválido (Ejemplo: usuario@empresa.com)');
      setCargando(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        await auth.signOut();
        setError('Debes verificar tu correo dando clic en el enlace que te enviamos (revisa SPAM).');
        setCargando(false);
        return;
      }

      const userEmail = userCredential.user.email;
      const q = query(collection(db, "Personal"), where("correo", "==", userEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('No tienes permisos de Staff para entrar a este panel.');
        auth.signOut();
        setCargando(false); 
        return;
      }

      const docId = querySnapshot.docs[0].id;
      const datosEmpleado = querySnapshot.docs[0].data();
      
      if (!datosEmpleado.verificado) {
        await updateDoc(doc(db, "Personal", docId), { verificado: true });
      }
      
      const sesionData = {
        nombre: datosEmpleado.nombre, rol: datosEmpleado.rol,
        idSucursal: datosEmpleado.idSucursal || 'TODAS', idFranquicia: datosEmpleado.idFranquicia || 'TODAS'
      };
      
      // Variable de entorno actualizada a Xone
      localStorage.setItem('sesionSkyStay', JSON.stringify(sesionData));
      onLoginSuccess(sesionData);

    } catch (error) {
      console.error(error);
      if (error.code === 'auth/too-many-requests') {
        setError(' Acceso bloqueado por múltiples intentos fallidos (Protección Fuerza Bruta).');
      } else {
        setError('Credenciales incorrectas o el usuario no existe.');
      }
    } finally { 
      setCargando(false); 
    }
  };

  // === MECANISMO DE CONTENCIÓN (RECUPERACIÓN Y CIERRE DE SESIONES) ===
  const manejarRecuperacion = async () => {
    setError('');
    setMensajeExito('');
    
    if (!regexCorreo.test(email)) {
      setError('Para restablecer tu contraseña, primero escribe tu correo arriba y luego presiona este botón.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMensajeExito('Se ha enviado un correo de recuperación. Al cambiar tu contraseña, todas tus sesiones previas se cerrarán automáticamente por seguridad.');
    } catch (error) {
      console.error("🚨 DETALLE EXACTO DEL ERROR:", error);
      
      if (error.code === 'auth/user-not-found') {
        setError('Este correo no está registrado en el sistema.');
      } else if (error.code === 'auth/invalid-email') {
        setError('El correo tiene un formato inválido.');
      } else {
        setError(`Error de Firebase: ${error.message}`);
      }
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          {/* Título actualizado a Xone */}
          <h1 style={{ color: '#0284c7', margin: 0, fontSize: '32px', letterSpacing: '-1px' }}>Xone</h1>
          <p style={{ color: '#64748b', marginTop: '5px' }}>Panel de Administración</p>
        </div>
        
        {error && ( 
          <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', lineHeight: '1.4' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} /> {error}
          </div> 
        )}

        {mensajeExito && ( 
          <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px', borderRadius: '6px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', lineHeight: '1.4' }}>
            <CheckCircle2 size={20} style={{ flexShrink: 0 }} /> {mensajeExito}
          </div> 
        )}
        
        <form onSubmit={manejarLogin} style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#334155', fontSize: '14px' }}>Correo Oficial</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing:'border-box', outlineColor: '#0284c7' }}/>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#334155', fontSize: '14px' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing:'border-box', outlineColor: '#0284c7' }}/>
            </div>
          </div>
          <button type="submit" disabled={cargando} style={{ padding: '12px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: cargando ? 'not-allowed' : 'pointer' }}>
            {cargando ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* BOTÓN DE CONTENCIÓN Y RECUPERACIÓN */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button type="button" onClick={manejarRecuperacion} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
            ¿Cuenta comprometida o contraseña olvidada?
          </button>
        </div>

      </div>
    </div>
  );
}
export default Login;