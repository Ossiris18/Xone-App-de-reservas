import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TouchableOpacity, View, Text, StyleSheet, Image } from "react-native";
import { colors } from "../constants/theme";
import HomeScreen from "../views/home/HomeScreen";
import HotelDetailScreen from "../views/catalogo/HotelDetailScreen";
import CheckoutScreen from "../views/catalogo/CheckoutScreen";
import TripsScreen from "../views/home/TripsScreen";
import Ajustes from "../views/ajustes/Ajustes";
import { useMemo } from "react";

const Drawer = createDrawerNavigator();
const ExploreStack = createNativeStackNavigator();

function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator
      initialRouteName="HomeMain"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "800",
          color: colors.text,
        },
      }}
    >
      <ExploreStack.Screen name="HomeMain" component={HomeScreen} options={{ title: "SkyStay" }} />
      <ExploreStack.Screen
        name="HotelDetail"
        component={HotelDetailScreen}
        options={{ title: "Detalle" }}
      />
      <ExploreStack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: "Checkout" }}
      />
    </ExploreStack.Navigator>
  );
}

function CustomDrawerContent({ navigation }) {
  const menuItems = useMemo(
    () => [
      { label: "Inicio", screen: "Inicio", icon: require("../components/icons/home.png") },
      { label: "Mis Viajes", screen: "MisViajes", icon: require("../components/icons/home.png") },
      { label: "Ajustes", screen: "Ajustes", icon: require("../components/icons/ajustes.png") },
    ],
    []
  );

  return (
    <View style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Xone</Text>
      </View>

      <View style={styles.menuItems}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            {item.icon ? (
              <Image source={item.icon} style={{ width: 22, height: 22, marginRight: 15 }} />
            ) : (
              <Text style={styles.menuIcon}>⬜</Text>
            )}
            <Text style={styles.menuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function DrawerNavigation() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: {
          backgroundColor: colors.background,
          width: 260,
        },
      }}
    >
      <Drawer.Screen
        name="Inicio"
        component={ExploreStackNavigator}
        options={{ headerShown: false, title: "Inicio" }}
      />
      <Drawer.Screen
        name="MisViajes"
        component={TripsScreen}
        options={{ title: "Mis Viajes" }}
      />
      <Drawer.Screen name="Ajustes" component={Ajustes} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  drawerHeader: {
    backgroundColor: colors.primary,
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  drawerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  menuItems: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
    marginTop: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 15,
  },
  menuLabel: {
    fontSize: 16,
    color: colors.text,
  },
});