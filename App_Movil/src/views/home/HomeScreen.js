import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../constants/theme";
import { getSucursales } from "../../services/apiServices";
import { useFocusEffect } from "@react-navigation/native";
import { useLocation } from "../../hooks/useLocation";

const getImageSource = (fotoUrl) => {
  if (!fotoUrl) return null;
  return { uri: fotoUrl };
};

const calcularDistancia = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function HomeScreen({ navigation }) {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtrarCercanos, setFiltrarCercanos] = useState(false);

  const { ubicacion, permisoOtorgado, cargando: cargandoUbicacion, reintentarUbicacion } = useLocation();

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const loadSucursales = async () => {
        try {
          setLoading(true);
          const data = await getSucursales();
          if (mounted) {
            setSucursales(data);
            setError("");
          }
        } catch (err) {
          if (mounted) setError("No fue posible cargar los hoteles.");
        } finally {
          if (mounted) setLoading(false);
        }
      };
      loadSucursales();
      return () => { mounted = false; };
    }, [])
  );

  const onPressCercanos = () => {
    if (!permisoOtorgado || !ubicacion) {
      reintentarUbicacion();
      return;
    }
    setFiltrarCercanos((prev) => !prev);
  };

  const groupedHotels = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = sucursales.filter((hotel) => {
      if (!term) return true;
      const nombre = (hotel?.nombre || "").toLowerCase();
      const municipio = (hotel?.ubicacion?.municipio || "").toLowerCase();
      return nombre.includes(term) || municipio.includes(term);
    });

    if (filtrarCercanos && ubicacion) {
      filtered = filtered
        .filter((h) => h?.ubicacion?.lat && h?.ubicacion?.lng)
        .map((h) => ({
          ...h,
          distancia: calcularDistancia(
            ubicacion.lat,
            ubicacion.lng,
            h.ubicacion.lat,
            h.ubicacion.lng
          ),
        }))
        .sort((a, b) => a.distancia - b.distancia);

      return [{ municipio: "Hoteles más cercanos", hoteles: filtered }];
    }

    const map = filtered.reduce((acc, hotel) => {
      const municipio = hotel?.ubicacion?.municipio || "Sin municipio";
      if (!acc[municipio]) acc[municipio] = [];
      acc[municipio].push(hotel);
      return acc;
    }, {});

    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((municipio) => ({ municipio, hoteles: map[municipio] }));
  }, [search, sucursales, filtrarCercanos, ubicacion]);

  const renderHotelCard = (item) => {
    const ubicacionTexto = [item?.ubicacion?.municipio, item?.ubicacion?.estado]
      .filter(Boolean)
      .join(", ");

    return (
      <Pressable
        key={item.id}
        style={styles.hotelCard}
        onPress={() => navigation.navigate("HotelDetail", { idSucursal: item.id })}
      >
        {item.fotoUrl ? (
          <Image source={getImageSource(item.fotoUrl)} style={styles.hotelImage} />
        ) : (
          <View style={[styles.hotelImage, styles.placeholder]}>
            <Text style={styles.placeholderText}>Sin imagen</Text>
          </View>
        )}
        <View style={styles.hotelBody}>
          <Text style={styles.hotelName} numberOfLines={1}>{item.nombre}</Text>
          <Text style={styles.hotelLocation} numberOfLines={1}>
            {ubicacionTexto || "Ubicación no disponible"}
          </Text>
          {item.distancia !== undefined && (
            <Text style={styles.distanciaText}>
              {item.distancia < 1
                ? `${Math.round(item.distancia * 1000)} m`
                : `${item.distancia.toFixed(1)} km`}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  const renderMunicipioSection = ({ item }) => {
    const esCercanos = item.municipio === "Hoteles más cercanos";

    return (
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>{item.municipio}</Text>
        {esCercanos ? (
          <View style={styles.verticalList}>
            {item.hoteles.map((hotel) => (
              <Pressable
                key={hotel.id}
                style={styles.hotelCardVertical}
                onPress={() => navigation.navigate("HotelDetail", { idSucursal: hotel.id })}
              >
                {hotel.fotoUrl ? (
                  <Image source={getImageSource(hotel.fotoUrl)} style={styles.hotelImageVertical} />
                ) : (
                  <View style={[styles.hotelImageVertical, styles.placeholder]}>
                    <Text style={styles.placeholderText}>Sin imagen</Text>
                  </View>
                )}
                <View style={styles.hotelBody}>
                  <Text style={styles.hotelName} numberOfLines={1}>{hotel.nombre}</Text>
                  <Text style={styles.hotelLocation} numberOfLines={1}>
                    {[hotel?.ubicacion?.municipio, hotel?.ubicacion?.estado].filter(Boolean).join(", ") || "Ubicación no disponible"}
                  </Text>
                  {hotel.distancia !== undefined && (
                    <Text style={styles.distanciaText}>
                      {hotel.distancia < 1
                        ? `${Math.round(hotel.distancia * 1000)} m`
                        : `${hotel.distancia.toFixed(1)} km`}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            data={item.hoteles}
            horizontal
            keyExtractor={(hotel) => hotel.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            renderItem={({ item: hotel }) => renderHotelCard(hotel)}
          />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando hoteles...</Text>
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
        data={groupedHotels}
        keyExtractor={(item) => item.municipio}
        renderItem={renderMunicipioSection}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <View style={styles.stickyHeader}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por hotel o municipio"
                placeholderTextColor={colors.textSecondary}
                value={search}
                onChangeText={setSearch}
              />
              <TouchableOpacity
                style={[styles.locationButton, filtrarCercanos && styles.locationButtonActive]}
                onPress={onPressCercanos}
                disabled={cargandoUbicacion}
              >
                {cargandoUbicacion ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.locationIcon}>📍</Text>
                )}
              </TouchableOpacity>
            </View>
            {filtrarCercanos && ubicacion && (
              <Text style={styles.cercanosBanner}>Mostrando hoteles más cercanos</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No hay hoteles disponibles</Text>
            <Text style={styles.emptySubtitle}>
              Revisa que la colección Sucursales tenga registros.
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
  stickyHeader: {
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
  },
  locationButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  locationButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationIcon: {
    fontSize: 20,
  },
  cercanosBanner: {
    marginTop: 6,
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    paddingHorizontal: 4,
  },
  listContent: {
    paddingBottom: 26,
  },
  sectionWrap: {
    marginTop: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
 carouselContent: {
  paddingHorizontal: 20,
  paddingBottom: 8,
  gap: 12,
},
  verticalList: {
    paddingHorizontal: 20,
    gap: 12,
  },
 hotelCard: {
  width: 260,
  backgroundColor: colors.surface,
  borderRadius: 20,
  shadowColor: colors.shadow,
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
},
  hotelCardVertical: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: 4,
  },
  hotelImage: {
  width: 260,
  height: 168,
  backgroundColor: "#e2e8f0",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
},
  hotelImageVertical: {
    width: "100%",
    height: 180,
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
  hotelBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hotelName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  hotelLocation: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  distanciaText: {
    marginTop: 4,
    color: colors.primary,
    fontSize: 13,
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
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
});