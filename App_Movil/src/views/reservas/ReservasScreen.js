import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { auth } from '../../config/firebase';
import { getUsuarioPorUid, getReservasByUsuario, getSucursalById } from '../../services/apiServices';
import { colors } from '../../constants/theme';

const mostrarFechaSegura = (fechaFirebase) => {
  if (!fechaFirebase) return "Fecha no disponible";
  if (typeof fechaFirebase.toDate === 'function') {
    return fechaFirebase.toDate().toLocaleDateString("es-MX");
  }
  return String(fechaFirebase);
};

const ReservasScreen = () => {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [usuario, setUsuario] = useState(null);

  const fetchReservas = useCallback(async () => {
    if (!auth.currentUser) {
      setError("Usuario no autenticado.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userProfile = await getUsuarioPorUid(auth.currentUser.uid);
      if (!userProfile || !userProfile.curp) {
        setError("No se pudo encontrar el perfil del usuario o la CURP.");
        setLoading(false);
        return;
      }
      setUsuario(userProfile);

      const userReservas = await getReservasByUsuario(userProfile.curp);

      // Consultar datos de cada sucursal
      const reservasConSucursal = await Promise.all(
  userReservas.map(async (reserva) => {
    if (reserva.idSucursal) {
      try {
        const sucursal = await getSucursalById(reserva.idSucursal);
        if (sucursal) {
          return {
            ...reserva,
            nombreHotel: sucursal.nombre || "Hotel",
            estadoHotel: sucursal.ubicacion?.estado || "No disponible",
            municipioHotel: sucursal.ubicacion?.municipio || "No disponible",
          };
        }
      } catch (e) {
        console.warn("Error al obtener sucursal:", e);
      }
    }
    return { ...reserva, nombreHotel: "Hotel", estadoHotel: "No disponible", municipioHotel: "No disponible" };
  })
);

      setReservas(reservasConSucursal);

    } catch (err) {
      console.error("Error al cargar las reservas:", err);
      setError("Ocurrió un error al cargar tus viajes. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservas();
  }, [fetchReservas]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReservas().finally(() => setRefreshing(false));
  }, [fetchReservas]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {/* Encabezado: nombre hotel + estado de reserva */}
      <View style={styles.cardHeader}>
        <Text style={styles.hotelName}>{item.nombreHotel}</Text>
        <View style={[
          styles.estadoBadge,
          item.estado === "Completada" ? styles.estadoCompletada :
          item.estado === "Activa" ? styles.estadoActiva : styles.estadoPendiente
        ]}>
          <Text style={styles.estadoText}>{item.estado || "Activa"}</Text>
        </View>
      </View>

      {/* Ubicación */}
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Estado:</Text>
        <Text style={styles.detailValue}>{item.estadoHotel}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Municipio:</Text>
        <Text style={styles.detailValue}>{item.municipioHotel}</Text>
      </View>

      {/* Separador */}
      <View style={styles.separator} />

      {/* Detalles de reserva */}
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Habitación:</Text>
        <Text style={styles.detailValue}>{item.numeroHabitacion || "No disponible"}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Check-in:</Text>
        <Text style={styles.detailValue}>{mostrarFechaSegura(item.fechaEntrada)}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Check-out:</Text>
        <Text style={styles.detailValue}>{mostrarFechaSegura(item.fechaSalida)}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Pago:</Text>
        <Text style={styles.detailValue}>{item.metodoPago || "No definido"}</Text>
      </View>

      {/* Total */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Pagado:</Text>
        <Text style={styles.totalValue}>${(item.totalGenerado || 0).toFixed(2)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.centered} />;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Viajes</Text>
      {reservas.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Aún no tienes ninguna reserva.</Text>
          <Text style={styles.emptySubText}>¡Anímate a explorar nuestros destinos!</Text>
        </View>
      ) : (
        <FlatList
          data={reservas}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginVertical: 20,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hotelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  estadoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  estadoCompletada: {
    backgroundColor: '#d1fae5',
  },
  estadoActiva: {
    backgroundColor: '#dbeafe',
  },
  estadoPendiente: {
    backgroundColor: '#fef3c7',
  },
  estadoText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  }
});

export default ReservasScreen;