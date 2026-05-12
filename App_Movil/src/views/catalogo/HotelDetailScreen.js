import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../../constants/theme";
import {
  getHabitacionesDisponiblesBySucursal,
  getSucursalById,
} from "../../services/apiServices";

const getImageSource = (fotoUrl) => {
  if (!fotoUrl) return null;
  return { uri: fotoUrl };
};

export default function HotelDetailScreen({ navigation, route }) {
  const { idSucursal } = route.params || {};
  const [hotel, setHotel] = useState(null);
  const [habitaciones, setHabitaciones] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!idSucursal) {
        setError("No se encontró el hotel.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [hotelData, roomsData] = await Promise.all([
          getSucursalById(idSucursal),
          getHabitacionesDisponiblesBySucursal(idSucursal),
        ]);

        if (!mounted) return;
        setHotel(hotelData);
        setHabitaciones(roomsData);
        setSelectedRoom(roomsData[0] || null);
      } catch (err) {
        if (mounted) setError("No fue posible cargar el detalle.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [idSucursal]);

  const hotelUbicacion = useMemo(() => {
    return [
      hotel?.ubicacion?.direccion,
      hotel?.ubicacion?.municipio,
      hotel?.ubicacion?.estado,
    ]
      .filter(Boolean)
      .join(", ");
  }, [hotel]);

  const renderRoom = ({ item }) => {
    const servicios = Array.isArray(item.servicios) ? item.servicios : [];
    const selected = selectedRoom?.id === item.id;

    return (
      <Pressable
        style={[styles.roomCard, selected && styles.roomCardSelected]}
        onPress={() => setSelectedRoom(item)}
      >
        {item.fotoUrl ? (
          <Image source={getImageSource(item.fotoUrl)} style={styles.roomImage} />
        ) : (
          <View style={[styles.roomImage, styles.roomImagePlaceholder]}>
            <Text style={styles.roomImagePlaceholderText}>Sin imagen</Text>
          </View>
        )}

        <View style={styles.roomBody}>
          <Text style={styles.roomTitle}>{item.tipo || "Habitación"}</Text>
          <Text style={styles.roomSubtitle}>No. {item.numero || "-"}</Text>
          <Text style={styles.roomPrice}>${item.precioBase || 0} MXN / noche</Text>

          <View style={styles.chipsWrap}>
            {servicios.slice(0, 6).map((servicio, index) => (
              <View style={styles.chip} key={`${servicio}-${index}`}>
                <Text style={styles.chipText}>{servicio}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (error || !hotel) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <Text style={styles.errorText}>{error || "Hotel no encontrado."}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={habitaciones}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {hotel.fotoUrl ? (
              <Image source={getImageSource(hotel.fotoUrl)} style={styles.heroImage} />
            ) : (
              <View style={[styles.heroImage, styles.roomImagePlaceholder]}>
                <Text style={styles.roomImagePlaceholderText}>Sin imagen</Text>
              </View>
            )}

            <View style={styles.headerBlock}>
              <Text style={styles.hotelName}>{hotel.nombre}</Text>
              <Text style={styles.hotelLocation}>{hotelUbicacion || "Ubicación no disponible"}</Text>
              <Text style={styles.sectionLabel}>Habitaciones disponibles</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Sin habitaciones disponibles</Text>
            <Text style={styles.emptySubtitle}>Prueba más tarde con otra sucursal.</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomPriceLabel}>Desde</Text>
          <Text style={styles.bottomPrice}>
            ${selectedRoom?.precioBase || 0} MXN <Text style={styles.bottomNight}>/ noche</Text>
          </Text>
        </View>

        <Pressable
          style={[styles.reserveButton, !selectedRoom && styles.reserveButtonDisabled]}
          disabled={!selectedRoom}
          onPress={() =>
            navigation.navigate("Checkout", {
              hotel,
              habitacion: selectedRoom,
            })
          }
        >
          <Text style={styles.reserveButtonText}>Reservar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: 120,
  },
  heroImage: {
    width: "100%",
    height: 280,
    backgroundColor: colors.muted,
  },
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  hotelName: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  hotelLocation: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    marginTop: 16,
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  roomCard: {
    marginTop: 14,
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "transparent",
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  roomCardSelected: {
    borderColor: colors.primary,
  },
  roomImage: {
    width: "100%",
    height: 190,
    backgroundColor: colors.muted,
  },
  roomImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  roomImagePlaceholderText: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  roomBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  roomTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  roomSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 13,
  },
  roomPrice: {
    marginTop: 8,
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
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -3 },
    elevation: 16,
  },
  bottomPriceLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomPrice: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  bottomNight: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  reserveButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  reserveButtonDisabled: {
    opacity: 0.5,
  },
  reserveButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: "800",
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
  emptyState: {
    marginTop: 20,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: colors.textSecondary,
    marginTop: 6,
    fontSize: 13,
  },
});
