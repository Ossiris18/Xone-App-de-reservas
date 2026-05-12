import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { signOut, deleteUser } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { colors } from "../../constants/theme";
import { Feather } from '@expo/vector-icons';
import { getUsuarioPorUid } from '../../services/apiServices';
import { useFocusEffect } from '@react-navigation/native';

const PerfilScreen = ({ navigation }) => {
  const user = auth.currentUser;
  const [datosExtra, setDatosExtra] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    if (user?.uid) {
      const datos = await getUsuarioPorUid(user.uid);
      setDatosExtra(datos);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchDatos();
    }, [fetchDatos])
  );

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert("Error", "No se pudo cerrar la sesión.");
    }
  };

  const confirmSignOut = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres cerrar tu sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, cerrar sesión", onPress: handleSignOut, style: "destructive" },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteUser(auth.currentUser);
    } catch (error) {
      Alert.alert("Error", "No se pudo borrar la cuenta. Por favor, inténtalo de nuevo.");
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Borrar Cuenta",
      "¿Estás seguro de que quieres borrar tu cuenta? Esta acción es irreversible.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, borrar cuenta", onPress: handleDeleteAccount, style: "destructive" },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Feather name="user" size={80} color={colors.primary} />
          <Text style={styles.userName}>{user?.displayName || datosExtra?.nombre || 'Usuario'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos Personales</Text>

          <View style={styles.dataCard}>
            <View style={styles.dataRow}>
              <Feather name="user" size={18} color="#000000" />
              <Text style={styles.dataLabel}>Nombre</Text>
              <Text style={styles.dataValue}>
                {datosExtra?.nombre || user?.displayName || 'No disponible'}
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.dataRow}>
              <Feather name="mail" size={18} color="#000000" />
              <Text style={styles.dataLabel}>Correo</Text>
              <Text style={styles.dataValue}>
                {user?.email || 'No disponible'}
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.dataRow}>
              <Feather name="phone" size={18} color="#000000" />
              <Text style={styles.dataLabel}>Teléfono</Text>
              <Text style={styles.dataValue}>
                {datosExtra?.telefono || 'No disponible'}
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.dataRow}>
              <Feather name="credit-card" size={18} color="#000000" />
              <Text style={styles.dataLabel}>CURP</Text>
              <Text style={styles.dataValue}>
                {datosExtra?.curp || 'No disponible'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta</Text>

          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={confirmSignOut}>
              <Feather name="log-out" size={24} color={colors.text} />
              <Text style={styles.menuItemText}>Cerrar Sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.deleteButton]} onPress={confirmDeleteAccount}>
              <Feather name="trash-2" size={24} color={colors.error} />
              <Text style={[styles.menuItemText, styles.deleteButtonText]}>Borrar Cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  userEmail: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  dataCard: {
    backgroundColor: colors.surface,
    borderRadius: 15,
    padding: 16,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  dataLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    width: 80,
  },
  dataValue: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  separator: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  menuContainer: {
    gap: 12,
    marginBottom: 30,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 16,
    color: colors.text,
  },
  deleteButton: {
    backgroundColor: '#fff0f0',
  },
  deleteButtonText: {
    color: colors.error,
  },
});

export default PerfilScreen;