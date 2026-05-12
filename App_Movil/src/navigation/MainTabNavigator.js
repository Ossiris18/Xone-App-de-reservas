
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import HomeScreen from '../views/home/HomeScreen';
import ReservasScreen from '../views/reservas/ReservasScreen';
import PerfilScreen from '../views/perfil/PerfilScreen';
import { colors } from '../constants/theme';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          let label;

          if (route.name === 'Explorar') {
            iconName = focused ? 'search' : 'search-outline';
            label = 'Explorar';
          } else if (route.name === 'Mis Viajes') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
            label = 'Mis Viajes';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
            label = 'Perfil';
          }

          return (
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={size} color={color} />
              <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.textSecondary }]}>
                {label}
              </Text>
            </View>
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      })}
    >
      <Tab.Screen name="Explorar" component={HomeScreen} />
      <Tab.Screen name="Mis Viajes" component={ReservasScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    elevation: 5,
    backgroundColor: colors.surface,
    borderRadius: 15,
    height: 80,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.5,
    borderTopWidth: 0,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    top: 20,
    width: 80,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default MainTabNavigator;
