import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { auth } from "../../config/firebase";
import { colors } from "../../constants/theme";
import { getCurpByUid, getReservasByUsuario } from "../../services/apiServices";

export default function TripsScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadTrips = async () => {
        try {
          setLoading(true);
          const uid = auth.currentUser?.uid;
          if (!uid) {
            if (mounted) {
              setItems([]);
              setError("No hay sesión activa.");
            }
            return;
          }

          const curp = await getCurpByUid(uid);
          if (!curp) {
            if (mounted) setItems([]);
            return;
          }

          const reservas = await getReservasByUsuario(curp);
          if (mounted) {
            setItems(reservas);
            setError("");
          }
        } catch (err) {
          if (mounted) setError("No se pudieron cargar tus viajes.");
        } finally {
          if (mounted) setLoading(false);
        }
      };

      loadTrips();

      return () => {
        mounted = false;
      };
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Text style={styles.title}>Mis viajes</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.nombreUsuario || "Reserva"}</Text>
            <Text style={styles.cardLine}>Habitación: {item.numeroHabitacion || "-"}</Text>
            <Text style={styles.cardLine}>Estado: {item.estado || "Activa"}</Text>
            <Text style={styles.cardTotal}>Total: ${item.totalGenerado || 0} MXN</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aún no tienes viajes</Text>
            <Text style={styles.emptyText}>Cuando reserves, aquí verás tu historial.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  cardLine: {
    color: colors.textSecondary,
    marginTop: 6,
    fontSize: 14,
  },
  cardTotal: {
    marginTop: 8,
    color: colors.success,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 22,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  emptyText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: colors.error,
    fontWeight: "700",
  },
});
