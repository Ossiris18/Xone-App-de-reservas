import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from "react-native-paper";

import Navigation from "./src/navigation/Navigation";
import MainTabNavigator from './src/navigation/MainTabNavigator';
import HotelDetailScreen from './src/views/catalogo/HotelDetailScreen';
import CheckoutScreen from './src/views/catalogo/CheckoutScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <PaperProvider>
      <Navigation />
    </PaperProvider>
  );
}