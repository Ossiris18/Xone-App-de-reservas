import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";
import Welcome from "../views/auth/Welcome";
import LoginScreen from "../views/auth/LoginScreen";
import RegisterScreen from "../views/auth/RegisterScreen";
import MainTabNavigator from "./MainTabNavigator";
import { auth } from "../config/firebase";
import { colors } from "../constants/theme";

import HotelDetailScreen from "../views/catalogo/HotelDetailScreen";
import CheckoutScreen from "../views/catalogo/CheckoutScreen";

const Stack = createNativeStackNavigator();

export default function Navigation() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      const isVerified = Boolean(user);
      setIsAuthenticated(isVerified);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="HotelDetail" component={HotelDetailScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={Welcome} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});