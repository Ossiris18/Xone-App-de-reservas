import { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { auth, db } from "../../config/firebase";
import { doc, onSnapshot, runTransaction, collection, serverTimestamp } from "firebase/firestore";
import { colors } from "../../constants/theme";
import { prepararEnvioComprobante, getSucursalById, getUsuarioPorUid } from "../../services/apiServices";
import { validarCurpMatematica, validarTelefono } from "../../utilities/validaciones";

const PASOS = ["Boucher", "Peticiones", "Huesped", "Pago"];

const getImageSource = (fotoUrl) => {
  if (!fotoUrl) return null;
  return { uri: fotoUrl };
};

const formatDate = (dateValue) => {
  if (!dateValue) return "Por definir";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "Por definir";
  return parsed.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export default function CheckoutScreen({ navigation, route }) {
  const { hotel, habitacion } = route.params || {};
  const [step, setStep] = useState(1);
  const [mensajeEspecial, setMensajeEspecial] = useState("");
  const [curp, setCurp] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaEntradaDate, setFechaEntradaDate] = useState(new Date());
  const [fechaSalidaDate, setFechaSalidaDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showCheckInPicker, setShowCheckInPicker] = useState(false);
  const [showCheckOutPicker, setShowCheckOutPicker] = useState(false);
  const [metodoPago, setMetodoPago] = useState("card");
  const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [comprobanteInfo, setComprobanteInfo] = useState(null);
  const [tieneDatosPrevios, setTieneDatosPrevios] = useState(false);
  const [modalTerminos, setModalTerminos] = useState(false);
  const [modalPrivacidad, setModalPrivacidad] = useState(false);
  const [habitacionInterceptada, setHabitacionInterceptada] = useState(false);
  const unsubscribeRef = useRef(null);

  const user = auth.currentUser;

  const noches = useMemo(() => {
    const inicio = new Date(fechaEntradaDate).setHours(0, 0, 0, 0);
    const fin = new Date(fechaSalidaDate).setHours(0, 0, 0, 0);
    if (Number.isNaN(inicio) || Number.isNaN(fin) || fin <= inicio) return 1;
    return Math.max(1, Math.ceil((fin - inicio) / (24 * 60 * 60 * 1000)));
  }, [fechaEntradaDate, fechaSalidaDate]);

  const subtotal = useMemo(() => Number(habitacion?.precioBase || 0) * noches, [habitacion, noches]);
  const impuestos = useMemo(() => subtotal * 0.16, [subtotal]);
  const total = useMemo(() => subtotal + impuestos, [subtotal, impuestos]);

  const telefonoValido = validarTelefono(telefono);
  const curpValida = validarCurpMatematica(curp);
  const tarjetaValida = /^\d{16}$/.test(numeroTarjeta);
  const vencimientoValido = /^(0[1-9]|1[0-2])\/(\d{2})$/.test(vencimiento);
  const cvvValido = /^\d{3,4}$/.test(cvv);
  const pagoValido = metodoPago === "paypal" || (tarjetaValida && vencimientoValido && cvvValido);

  // 🛡️ ANTI-OVERBOOKING: Listener en tiempo real
  useEffect(() => {
    if (!habitacion?.id) return;

    const habitacionRef = doc(db, "Habitaciones", habitacion.id);
    let contadorDisparos = 0;

    const unsubscribe = onSnapshot(habitacionRef, (snapshot) => {
      if (!snapshot.exists()) return;
      contadorDisparos += 1;
      const data = snapshot.data();
      // Ignorar los primeros 2 disparos (caché + servidor inicial)
      if (contadorDisparos <= 2) return;
      // A partir del 3er disparo es un cambio real en tiempo real
      if (data.estado !== "disponible") {
        setHabitacionInterceptada(true);
      }
    });

    unsubscribeRef.current = unsubscribe;
    return () => unsubscribe();
  }, [habitacion?.id]);

  useEffect(() => {
    const precargarDatos = async () => {
      if (user?.uid) {
        const datos = await getUsuarioPorUid(user.uid);
        if (datos?.curp && datos?.telefono) {
          setCurp(datos.curp);
          setTelefono(datos.telefono);
          setTieneDatosPrevios(true);
        }
      }
    };
    precargarDatos();
  }, []);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => {
      navigation.navigate("Main", { screen: "Explorar" });
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigation, success]);

  const onChangeCheckIn = (event, selectedDate) => {
    if (Platform.OS !== "ios") setShowCheckInPicker(false);
    if (!selectedDate) return;
    setFechaEntradaDate(selectedDate);
    if (selectedDate >= fechaSalidaDate) {
      setFechaSalidaDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000));
    }
  };

  const onChangeCheckOut = (event, selectedDate) => {
    if (Platform.OS !== "ios") setShowCheckOutPicker(false);
    if (!selectedDate) return;
    const checkOut = new Date(selectedDate);
    if (checkOut <= fechaEntradaDate) {
      Alert.alert("Fecha inválida", "La fecha de check-out debe ser posterior al check-in.");
      return;
    }
    setFechaSalidaDate(checkOut);
  };

  if (!hotel || !habitacion) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <Text style={styles.errorText}>No hay información de reserva.</Text>
      </SafeAreaView>
    );
  }

  const goNext = () => {
    if (habitacionInterceptada) {
      Alert.alert("Habitación no disponible", "Esta habitación ya no está disponible.");
      return;
    }
    if (step === 3 && (!telefonoValido || !curpValida)) {
      Alert.alert("Datos inválidos", "Ingresa un teléfono de 10 dígitos y una CURP válida.");
      return;
    }
    if (step === 4 && !pagoValido) {
      Alert.alert("Pago incompleto", "Completa correctamente los datos del método de pago.");
      return;
    }
    setStep((prev) => Math.min(4, prev + 1));
  };

  // 🛡️ ANTI-OVERBOOKING: Transacción atómica
  const onConfirm = async () => {
    if (habitacionInterceptada) {
      Alert.alert("Habitación no disponible", "Esta habitación ya fue reservada por alguien más.");
      return;
    }
    if (!telefonoValido || !curpValida) {
      Alert.alert("Datos inválidos", "Ingresa un teléfono de 10 dígitos y una CURP válida.");
      return;
    }
    if (!pagoValido) {
      Alert.alert("Pago incompleto", "Completa correctamente los datos del método de pago.");
      return;
    }

    setLoading(true);
    try {
      const habitacionRef = doc(db, "Habitaciones", habitacion.id);
      const reservasRef = collection(db, "Reservas");

      await runTransaction(db, async (transaction) => {
        const habitacionSnap = await transaction.get(habitacionRef);
        if (!habitacionSnap.exists()) throw new Error("La habitación no existe.");
        const estadoActual = habitacionSnap.data().estado;
        if (estadoActual !== "disponible") throw new Error("INTERCEPTADA");

        transaction.update(habitacionRef, { estado: "ocupado" });

        const hotelCompleto = await getSucursalById(hotel.id);
        const totalFinal = total || Number(habitacion?.precioBase || 0);
        const nuevaReservaRef = doc(reservasRef);

        transaction.set(nuevaReservaRef, {
          idSucursal: hotelCompleto?.id || hotel.id,
          idHabitacion: habitacion.id,
          numeroHabitacion: habitacion.numero || "",
          idUsuario: curp.trim().toUpperCase(),
          nombreUsuario: user?.displayName || "Usuario SkyStay",
          estado: "Activa",
          totalGenerado: totalFinal,
          fechaIngreso: serverTimestamp(),
          fechaEntrada: fechaEntradaDate.toISOString().slice(0, 10),
          fechaSalida: fechaSalidaDate.toISOString().slice(0, 10),
          mensajeEspecial: mensajeEspecial || "",
          metodoPago: metodoPago === "paypal" ? "PayPal" : "Tarjeta de Crédito/Débito",
          ultimos4Tarjeta: metodoPago === "card" ? numeroTarjeta.slice(-4) : "",
          estadoComprobante: "pendiente",
        });
      });

      const comprobante = await prepararEnvioComprobante({
        correoDestino: user?.email || "",
        plantilla: {
          nombreUsuario: user?.displayName || "Usuario SkyStay",
          hotel: hotel?.nombre || "Hotel",
          habitacion: `${habitacion?.tipo || "Habitación"} #${habitacion?.numero || "-"}`,
          numeroHabitacion: String(habitacion?.numero || "-"),
          pais: hotel?.ubicacion?.pais || "No especificado",
          municipio: hotel?.ubicacion?.municipio || "No especificado",
          direccion: hotel?.ubicacion?.direccion || "No especificada",
          total,
          fechaEntrada: formatDate(fechaEntradaDate),
          fechaSalida: formatDate(fechaSalidaDate),
          metodoPago: metodoPago === "paypal" ? "PayPal" : "Tarjeta de Crédito/Débito",
          ultimos4: metodoPago === "card" ? numeroTarjeta.slice(-4) : "",
        },
      });

      setComprobanteInfo(comprobante);
      setSuccess(true);

    } catch (error) {
      if (error.message === "INTERCEPTADA") {
        setHabitacionInterceptada(true);
        Alert.alert("¡Overbooking Prevenido!", "Alguien más acaba de reservar esta habitación. Por favor elige otra.");
      } else {
        Alert.alert("Error", "No se pudo confirmar la reserva. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>¡Reserva Exitosa!</Text>
          <Text style={styles.successText}>
            Tu reserva se guardó y la habitación quedó marcada como ocupada.
          </Text>
          <Text style={styles.mailText}>
            Comprobante: {comprobanteInfo?.status || "simulado"} con {comprobanteInfo?.provider || "proveedor"}
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Main", { screen: "Explorar" })}>
            <Text style={styles.primaryButtonText}>Volver al inicio</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.stepText}>Paso {step} de 4: {PASOS[step - 1]}</Text>

        <View style={styles.stepsRow}>
          {PASOS.map((label, index) => {
            const stepIndex = index + 1;
            const active = step === stepIndex;
            const done = step > stepIndex;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                  <Text style={[styles.stepDotText, (active || done) && styles.stepDotTextActive]}>{stepIndex}</Text>
                </View>
                <Text style={styles.stepLabel}>{label}</Text>
              </View>
            );
          })}
        </View>

        {step === 1 && (
          <View style={styles.ticketCard}>
            <Text style={styles.ticketTitle}>Boucher / Ticket</Text>
            {habitacion?.fotoUrl ? (
              <Image source={getImageSource(habitacion.fotoUrl)} style={styles.roomImage} />
            ) : hotel?.fotoUrl ? (
              <Image source={getImageSource(hotel.fotoUrl)} style={styles.roomImage} />
            ) : (
              <View style={[styles.roomImage, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>Sin imagen</Text>
              </View>
            )}
            <Text style={styles.ticketLine}>Hotel: {hotel.nombre || "-"}</Text>
            <Text style={styles.ticketLine}>Habitación: {habitacion.tipo || "-"} #{habitacion.numero || "-"}</Text>
            <View style={styles.dateRow}>
              <Pressable style={styles.datePickerButton} onPress={() => setShowCheckInPicker(true)}>
                <Text style={styles.datePickerLabel}>Check-in</Text>
                <Text style={styles.datePickerValue}>{formatDate(fechaEntradaDate)}</Text>
              </Pressable>
              <Pressable style={styles.datePickerButton} onPress={() => setShowCheckOutPicker(true)}>
                <Text style={styles.datePickerLabel}>Check-out</Text>
                <Text style={styles.datePickerValue}>{formatDate(fechaSalidaDate)}</Text>
              </Pressable>
            </View>
            {showCheckInPicker && (
              <DateTimePicker
                value={fechaEntradaDate}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onChangeCheckIn}
              />
            )}
            {showCheckOutPicker && (
              <DateTimePicker
                value={fechaSalidaDate}
                mode="date"
                minimumDate={new Date(fechaEntradaDate.getTime() + 24 * 60 * 60 * 1000)}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onChangeCheckOut}
              />
            )}
            <Text style={styles.ticketLine}>Entrada: {formatDate(fechaEntradaDate)}</Text>
            <Text style={styles.ticketLine}>Salida: {formatDate(fechaSalidaDate)}</Text>
            <Text style={styles.ticketLine}>Noches: {noches}</Text>
            <View style={styles.totalBox}>
              <Text style={styles.ticketLine}>Subtotal: ${subtotal.toFixed(2)} MXN</Text>
              <Text style={styles.ticketLine}>Impuestos (16%): ${impuestos.toFixed(2)} MXN</Text>
              <Text style={styles.ticketTotal}>Total: ${total.toFixed(2)} MXN</Text>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.ticketCard}>
            <Text style={styles.ticketTitle}>Peticiones especiales</Text>
            <TextInput
              placeholder="Ej. cama extra, piso alto..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={mensajeEspecial}
              onChangeText={setMensajeEspecial}
              style={[styles.input, styles.textArea]}
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.ticketCard}>
            <Text style={styles.ticketTitle}>Datos del huésped</Text>
            <TextInput
              placeholder="CURP"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              value={curp}
              maxLength={18}
              onChangeText={(text) => !tieneDatosPrevios && setCurp(text.toUpperCase().replace(/\s+/g, ""))}
              style={[
                styles.input,
                curp.length > 0 && !curpValida && styles.inputError,
                tieneDatosPrevios && styles.inputReadOnly,
              ]}
              editable={!tieneDatosPrevios}
            />
            <TextInput
              placeholder="Teléfono"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={telefono}
              maxLength={10}
              onChangeText={(text) => !tieneDatosPrevios && setTelefono(text.replace(/\D/g, ""))}
              style={[
                styles.input,
                telefono.length > 0 && !telefonoValido && styles.inputError,
                tieneDatosPrevios && styles.inputReadOnly,
              ]}
              editable={!tieneDatosPrevios}
            />
            <Text style={styles.helperText}>
              Teléfono: {telefonoValido ? "válido" : "debe tener 10 dígitos"} | CURP: {curpValida ? "válida" : "inválida"}
            </Text>
            <Text style={styles.userInfoLabel}>Nombre: {user?.displayName || "Usuario"}</Text>
            <Text style={styles.userInfoLabel}>Correo: {user?.email || "Sin correo"}</Text>
            {!tieneDatosPrevios && (
              <View style={styles.terminosContainer}>
                <Text style={styles.terminosText}>
                  Al seleccionar continuar, acepto los{" "}
                  <Text style={styles.terminosLink} onPress={() => setModalTerminos(true)}>
                    Términos y Condiciones
                  </Text>
                  {" "}y la{" "}
                  <Text style={styles.terminosLink} onPress={() => setModalPrivacidad(true)}>
                    Política de Privacidad
                  </Text>
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={styles.ticketCard}>
            <Text style={styles.ticketTitle}>Método de pago</Text>
            <View style={styles.paymentSwitchRow}>
              <Pressable
                style={[styles.paymentOption, metodoPago === "card" && styles.paymentOptionActive]}
                onPress={() => setMetodoPago("card")}
              >
                <Text style={[styles.paymentOptionText, metodoPago === "card" && styles.paymentOptionTextActive]}>
                  Tarjeta de Crédito/Débito
                </Text>
              </Pressable>
              <Pressable
                style={[styles.paymentOption, metodoPago === "paypal" && styles.paymentOptionActive]}
                onPress={() => setMetodoPago("paypal")}
              >
                <Text style={[styles.paymentOptionText, metodoPago === "paypal" && styles.paymentOptionTextActive]}>
                  PayPal
                </Text>
              </Pressable>
            </View>
            {metodoPago === "card" ? (
              <>
                <TextInput
                  placeholder="Número de tarjeta (16 dígitos)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  maxLength={16}
                  value={numeroTarjeta}
                  onChangeText={(text) => setNumeroTarjeta(text.replace(/\D/g, ""))}
                  style={[styles.input, numeroTarjeta.length > 0 && !tarjetaValida && styles.inputError]}
                />
                <View style={styles.cardRow}>
                  <TextInput
                    placeholder="MM/YY"
                    placeholderTextColor={colors.textSecondary}
                    maxLength={5}
                    keyboardType="numeric"
                    value={vencimiento}
                    onChangeText={(text) => {
                      const onlyDigits = text.replace(/\D/g, "").slice(0, 4);
                      const formatted = onlyDigits.length > 2 ? `${onlyDigits.slice(0, 2)}/${onlyDigits.slice(2)}` : onlyDigits;
                      setVencimiento(formatted);
                    }}
                    style={[styles.input, styles.cardHalfInput, vencimiento.length > 0 && !vencimientoValido && styles.inputError]}
                  />
                  <TextInput
                    placeholder="CVV"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    maxLength={4}
                    value={cvv}
                    onChangeText={(text) => setCvv(text.replace(/\D/g, ""))}
                    style={[styles.input, styles.cardHalfInput, cvv.length > 0 && !cvvValido && styles.inputError]}
                  />
                </View>
              </>
            ) : (
              <View style={styles.paypalBox}>
                <Text style={styles.paypalText}>Serás redirigido a PayPal en un flujo real.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footerActions}>
        {step > 1 ? (
          <Pressable style={styles.ghostButton} onPress={() => setStep((prev) => prev - 1)}>
            <Text style={styles.ghostButtonText}>Atrás</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {step < 4 ? (
          <Pressable
            style={[styles.primaryButton, habitacionInterceptada && styles.primaryButtonDisabled]}
            onPress={goNext}
            disabled={habitacionInterceptada}
          >
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryButton, (!pagoValido || loading || habitacionInterceptada) && styles.primaryButtonDisabled]}
            onPress={onConfirm}
            disabled={!pagoValido || loading || habitacionInterceptada}
          >
            {loading ? <ActivityIndicator color={colors.textLight} /> : <Text style={styles.primaryButtonText}>Pagar</Text>}
          </Pressable>
        )}
      </View>

      <Modal visible={modalTerminos} animationType="slide" onRequestClose={() => setModalTerminos(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Términos y Condiciones</Text>
            <Pressable onPress={() => setModalTerminos(false)}>
              <Text style={styles.modalClose}>✕ Cerrar</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>
              <Text style={styles.modalSubtitle}>1. Aceptación de los términos{"\n"}</Text>
              Al usar esta aplicación, aceptas estos términos en su totalidad.{"\n\n"}
              <Text style={styles.modalSubtitle}>2. Uso del servicio{"\n"}</Text>
              Esta aplicación está destinada a la reservación de hoteles y servicios turísticos.{"\n\n"}
              <Text style={styles.modalSubtitle}>3. Datos personales{"\n"}</Text>
              Los datos proporcionados serán utilizados únicamente para gestionar tus reservaciones.{"\n\n"}
              <Text style={styles.modalSubtitle}>4. Reservaciones{"\n"}</Text>
              Una vez confirmada una reservación, la habitación quedará marcada como ocupada.{"\n\n"}
              <Text style={styles.modalSubtitle}>5. Pagos{"\n"}</Text>
              Los pagos están sujetos a las políticas del proveedor de pago seleccionado.{"\n\n"}
              <Text style={styles.modalSubtitle}>6. Modificaciones{"\n"}</Text>
              Nos reservamos el derecho de modificar estos términos en cualquier momento.{"\n\n"}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={modalPrivacidad} animationType="slide" onRequestClose={() => setModalPrivacidad(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Política de Privacidad</Text>
            <Pressable onPress={() => setModalPrivacidad(false)}>
              <Text style={styles.modalClose}>✕ Cerrar</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>
              <Text style={styles.modalSubtitle}>1. Información que recopilamos{"\n"}</Text>
              Recopilamos nombre, correo, CURP y teléfono para gestionar tu cuenta.{"\n\n"}
              <Text style={styles.modalSubtitle}>2. Uso de la información{"\n"}</Text>
              Tu información se usa para procesar reservaciones y mejorar nuestros servicios.{"\n\n"}
              <Text style={styles.modalSubtitle}>3. Protección de datos{"\n"}</Text>
              Tus datos están protegidos mediante Firebase.{"\n\n"}
              <Text style={styles.modalSubtitle}>4. Tus derechos{"\n"}</Text>
              Puedes acceder, corregir o eliminar tu información desde la sección de Perfil.{"\n\n"}
              <Text style={styles.modalSubtitle}>5. Contacto{"\n"}</Text>
              Puedes contactarnos a través de la aplicación.{"\n\n"}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 🛡️ Modal de habitación interceptada */}
      <Modal visible={habitacionInterceptada} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.interceptadaModal}>
            <Pressable style={styles.interceptadaClose} onPress={() => navigation.goBack()}>
              <Text style={styles.interceptadaCloseText}>✕</Text>
            </Pressable>
            <Text style={styles.interceptadaIcono}>⚠️</Text>
            <Text style={styles.interceptadaTitulo}>¡Habitación Interceptada!</Text>
            <Text style={styles.interceptadaDescripcion}>
              El motor global detectó que alguien más acaba de reservar esta habitación. Formulario bloqueado de forma reactiva en tiempo real.
            </Text>
            <Pressable style={styles.interceptadaBoton} onPress={() => navigation.goBack()}>
              <Text style={styles.interceptadaBotonText}>Regresar a Disponibilidad</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  interceptadaModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  interceptadaClose: {
    alignSelf: 'flex-end',
  },
  interceptadaCloseText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  interceptadaIcono: {
    fontSize: 48,
  },
  interceptadaTitulo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#dc2626',
    textAlign: 'center',
  },
  interceptadaDescripcion: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  interceptadaBoton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  interceptadaBotonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 120,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  stepText: {
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 6,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepDotText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,
  },
  stepDotTextActive: {
    color: colors.textLight,
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 15,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    gap: 10,
  },
  ticketTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  roomImage: {
    width: "100%",
    height: 170,
    borderRadius: 15,
    marginBottom: 8,
    backgroundColor: colors.muted,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  dateRow: {
    flexDirection: "row",
    gap: 8,
  },
  datePickerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  datePickerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  datePickerValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  totalBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    gap: 4,
  },
  ticketLine: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  ticketTotal: {
    marginTop: 6,
    color: colors.success,
    fontSize: 20,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputReadOnly: {
    backgroundColor: "#f0f0f0",
    color: colors.textSecondary,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  inputError: {
    borderColor: colors.error,
  },
  terminosContainer: {
    paddingVertical: 8,
    alignItems: "center",
  },
  terminosText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
  },
  terminosLink: {
    color: colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  paymentSwitchRow: {
    flexDirection: "row",
    gap: 8,
  },
  paymentOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
  },
  paymentOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  paymentOptionText: {
    color: colors.text,
    fontWeight: "600",
    textAlign: "center",
    fontSize: 12,
  },
  paymentOptionTextActive: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  cardRow: {
    flexDirection: "row",
    gap: 8,
  },
  cardHalfInput: {
    flex: 1,
  },
  paypalBox: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
  },
  paypalText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  userInfoLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  footerActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -3 },
    elevation: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 150,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: colors.textLight,
    fontWeight: "800",
    fontSize: 15,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  ghostButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  successCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 15,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  successTitle: {
    color: colors.success,
    fontSize: 24,
    fontWeight: "800",
  },
  successText: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  mailText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },
  errorText: {
    color: colors.error,
    fontWeight: "700",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  modalClose: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "700",
  },
  modalContent: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  modalSubtitle: {
    fontWeight: "800",
    color: colors.text,
    fontSize: 15,
  },
});