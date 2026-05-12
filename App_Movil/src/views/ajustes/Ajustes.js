import { View, StyleSheet, Text, ScrollView, Image, TouchableOpacity, Alert } from "react-native";
import { useState, useEffect } from "react";
import { auth, db } from "../../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { authServices } from "../../services/authServices";

export default function Ajustes({ navigation }) {
  const [nombre, setNombre] = useState("Usuario");
  const [correo, setCorreo] = useState("No disponible");
  const [telefono, setTelefono] = useState("No disponible");
  const [ine, setIne] = useState("No disponible");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const fetchDatos = async () => {
          const docRef = doc(db, "Usuarios", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setNombre(data.name || "Usuario");
            setCorreo(data.email || "No disponible");
            setTelefono(data.telefono || "No disponible");
            setIne(data.ine || "No disponible");
          }
        };
        fetchDatos();
      }
    });
    return () => unsubscribe();
  }, []);

  async function onLogout() {
    await authServices.logout();
  }

  async function onEliminarCuenta() {
    Alert.alert(
      "Eliminar cuenta",
      "¿Estás seguro? Esta acción es permanente y no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const response = await authServices.eliminarCuenta();
            if (response.error) {
              Alert.alert("Error", response.error);
              return;
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container}>

      <View style={styles.cardPerfil}>
        <View style={styles.avatarContainer}>
          <Image
            source={require("../../components/icons/user.png")}
            style={{ width: 45, height: 45 }}
          />
        </View>
        <Text style={styles.nombreUsuario}>{nombre}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos Personales</Text>

        <View style={styles.dataRow}>
          <Image source={require("../../components/icons/email.png")} style={styles.dataIcon} />
          <Text style={styles.dataLabel}>Correo:</Text>
          <Text style={styles.dataValue}>{correo}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.dataRow}>
          <Image source={require("../../components/icons/tel.png")} style={styles.dataIcon} />
          <Text style={styles.dataLabel}>Teléfono:</Text>
          <Text style={styles.dataValue}>{telefono}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.dataRow}>
          <Image source={require("../../components/icons/ine.png")} style={styles.dataIcon} />
          <Text style={styles.dataLabel}>INE:</Text>
          <Text style={styles.dataValue}>{ine}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cuenta</Text>

        <TouchableOpacity style={styles.accionRow} onPress={onLogout}>
          <View style={styles.accionIconContainer}>
            <Image source={require("../../components/icons/cerrar.png")} style={{ width: 28, height: 28 }} />
          </View>
          <View>
            <Text style={styles.accionLabel}>Cerrar Sesión</Text>
            <Text style={styles.accionSubLabel}>Salir de la cuenta</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.separator} />

        <TouchableOpacity style={styles.accionRow} onPress={onEliminarCuenta}>
          <View style={[styles.accionIconContainer, { backgroundColor: "#ffe5e5" }]}>
            <Image source={require("../../components/icons/borrar.png")} style={{ width: 28, height: 28 }} />
          </View>
          <View>
            <Text style={[styles.accionLabel, { color: "#e53935" }]}>Eliminar Cuenta</Text>
            <Text style={styles.accionSubLabel}>Eliminar cuenta permanente</Text>
          </View>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 15,
  },
  cardPerfil: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    elevation: 2,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#84bcc2",
    justifyContent: "center",
    alignItems: "center",
  },
  nombreUsuario: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#24504f",
    marginLeft: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#24504f",
    textAlign: "center",
    marginBottom: 20,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  dataIcon: {
    width: 24,
    height: 24,
  },
  dataLabel: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333333",
    width: 80,
  },
  dataValue: {
    fontSize: 14,
    color: "#aaaaaa",
    flex: 1,
    textAlign: "right",
  },
  separator: {
    height: 0.5,
    backgroundColor: "#e0e0e0",
  },
  accionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 15,
  },
  accionIconContainer: {
    width: 55,
    height: 55,
    borderRadius: 27,
    backgroundColor: "#e0f2f1",
    justifyContent: "center",
    alignItems: "center",
  },
  accionLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
  },
  accionSubLabel: {
    fontSize: 13,
    color: "#aaaaaa",
    marginTop: 2,
  },
});