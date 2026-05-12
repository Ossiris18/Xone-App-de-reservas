import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../../constants/theme";
import { getHabitacionesBySucursal } from "../../services/apiServices";

const getImageSource = (fotoUrl) => {
  if (!fotoUrl) return null;
  return { uri: fotoUrl };
};

export default function CatalogoScreen({ route }) {
  const { idSucursal, nombreSucursal } = route.params || {};
  const [habitaciones, setHabitaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadHabitaciones = async () => {
      if (!idSucursal) {
        if (mounted) {
          setError("No se recibió el hotel seleccionado.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const data = await getHabitacionesBySucursal(idSucursal);
        if (mounted) setHabitaciones(data);
      } catch (err) {
        if (mounted) setError("No fue posible cargar las habitaciones.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHabitaciones();

    return () => {
      mounted = false;
    };
  }, [idSucursal]);

  const renderHabitacion = ({ item }) => {
    const servicios = Array.isArray(item.servicios) ? item.servicios : [];
    const precioBase = item.precioBase;

    return (
      <View style={styles.card}>
        {item.fotoUrl ? (
          <Image source={getImageSource(item.fotoUrl)} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>Sin imagen</Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.roomType}>{item.tipo}</Text>
          <Text style={styles.price}>{precioBase ? `$${precioBase}` : "Precio no disponible"}</Text>

          <View style={styles.chipsWrap}>
            {servicios.slice(0, 6).map((servicio, index) => (
              <View key={`${servicio}-${index}`} style={styles.chip}>
                <Text style={styles.chipText}>{servicio}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const headerTitle = useMemo(() => nombreSucursal || "Catálogo", [nombreSucursal]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando habitaciones...</Text>
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
      <View style={styles.header}>
        <Text style={styles.kicker}>Catálogo de habitaciones</Text>
        <Text style={styles.title}>{headerTitle}</Text>
        <Text style={styles.subtitle}>
          Habitaciones disponibles con una presentación premium y clara.
        </Text>
      </View>

      <FlatList
        data={habitaciones}
        keyExtractor={(item) => item.id}
        renderItem={renderHabitacion}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No hay habitaciones para este hotel</Text>
            <Text style={styles.emptySubtitle}>
              Verifica que la colección Habitaciones tenga el campo idSucursal correcto.
            </Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  kicker: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginTop: 6,
  },
  subtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  image: {
    width: "100%",
    height: 240,
    backgroundColor: "#e2e8f0",
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  roomType: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  price: {
    marginTop: 6,
    color: colors.success,
    fontSize: 17,
    fontWeight: "800",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "700",
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
});