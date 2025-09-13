// src/HomeApp.js
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, TouchableOpacity, Alert, StatusBar, SafeAreaView } from "react-native";
import { NavigationContainer, DefaultTheme, useIsFocused } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ProductivityDashboardScreen } from "./DashboardApp";
import { BackupScreen, BackupHistoryScreen } from "./BackupApp";
import { CostsScreen } from "./CostsScreen";
import ReproductionScreen from "./ReproductionScreen";
import AssistantIAScreen from "./AssistantIAScreen";
import AssistantIAWelcomeScreen from "./AssistantIAWelcomeScreen";
import LoginScreen from "./LoginScreen";
import RegisterScreen from "./RegisterScreen";
import ProfileScreen from "./ProfileScreen";
import AuthWrapper from "./AuthWrapper";
import SplashScreen from "./SplashScreen"; // 👈 NUEVO: Splash animado

const Colors = {
  green: "#1E5B3F",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
};

const STATS_KEY = "@porcinet_stats"; // { herdSize: number }

/* ====== Menú de Inicio ====== */
function StatChip({ title, value }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipTitle}>{title}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

function HomeMenu({ navigation }) {
  const [herd, setHerd] = useState(0);
  const isFocused = useIsFocused();

  useEffect(() => {
    const loadHerd = async () => {
      try {
        const raw = await AsyncStorage.getItem(STATS_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          setHerd(Number.isFinite(obj?.herdSize) ? obj.herdSize : 0);
        } else {
          setHerd(0);
        }
      } catch {
        setHerd(0);
      }
    };
    if (isFocused) loadHerd();
  }, [isFocused]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.green} />
      <View style={[styles.screen, { backgroundColor: Colors.beige }]}>
        <View style={styles.topGreen}>
          <View style={styles.chipsRow}>
            <StatChip title="Cerdos totales" value={String(herd)} />
            <StatChip title="Productividad" value="85%" />
            <StatChip title="Madres" value="120" />
          </View>
        </View>

        <View style={styles.grid}>
          {/* Dashboard */}
          <Pressable
            onPress={() => navigation.navigate("InformeTab")}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.tileIconBox}>
              <MaterialCommunityIcons name="view-dashboard" size={42} color={Colors.green} />
            </View>
            <Text style={styles.tileText}>Dashboard de{"\n"}productividad</Text>
          </Pressable>

          {/* Respaldos */}
          <Pressable
            onPress={() => navigation.navigate("RespaldoTab")}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.tileIconBox}>
              <MaterialCommunityIcons name="cloud-upload-outline" size={42} color={Colors.green} />
            </View>
            <Text style={styles.tileText}>Respaldos{"\n"}en la nube</Text>
          </Pressable>

          {/* Control de reproducción */}
          <Pressable
            onPress={() => navigation.navigate("Reproducción")}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.tileIconBox}>
              <MaterialCommunityIcons name="calendar-heart" size={42} color={Colors.green} />
            </View>
            <Text style={styles.tileText}>Control de{"\n"}reproducción</Text>
          </Pressable>

          {/* Costos y gastos */}
          <Pressable
            onPress={() => navigation.navigate("Costos")}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.tileIconBox}>
              <MaterialCommunityIcons name="piggy-bank" size={42} color={Colors.green} />
            </View>
            <Text style={styles.tileText}>Gestión de{"\n"}costos y gastos</Text>
          </Pressable>
        </View>

        {/* Botón Asistente IA */}
        <Pressable style={styles.aiBtn} onPress={() => navigation.navigate("AsistenteIAWelcome")}>
          <Text style={styles.aiBtnText}>Asistente IA</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ====== Tabs ====== */
const Tab = createBottomTabNavigator();
function Tabs() {
  return (
    <AuthWrapper>
      <Tab.Navigator
        initialRouteName="InicioTab"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.white,
          tabBarInactiveTintColor: "#ddf0e6",
          tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
          tabBarStyle: {
            backgroundColor: Colors.green,
            height: 64,
            paddingBottom: 8,
            borderTopWidth: 0,
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            borderRadius: 22,
            elevation: 12,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          },
        }}
      >
        <Tab.Screen
          name="InicioTab"
          component={HomeMenu}
          options={{
            title: "Inicio",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="InformeTab"
          component={ProductivityDashboardScreen}
          options={{
            title: "Informe",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="RespaldoTab"
          component={BackupScreen}
          options={{
            title: "Respaldo",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="cloud-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="PerfilTab"
          component={ProfileScreen}
          options={{
            title: "Perfil",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account-outline" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </AuthWrapper>
  );
}

/* ====== Stack root ====== */
const Stack = createNativeStackNavigator();

export default function HomeApp() {
  const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: Colors.beige } };

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: Colors.green },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "800", fontSize: 20 },
          headerTitleAlign: "left",
          contentStyle: { backgroundColor: Colors.beige },
        }}
      >
        {/* Splash primero */}
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />

        {/* Acceso */}
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Registro" component={RegisterScreen} options={{ headerShown: false }} />

        {/* Home con Tabs (flecha visible pero sin acción) */}
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{
            headerLeft: () => (
              <TouchableOpacity onPress={() => {}} style={{ paddingHorizontal: 6 }}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
              </TouchableOpacity>
            ),
            headerTitle: () => (
              <Text style={{ color: Colors.white, fontWeight: "800", fontSize: 20 }}>
                Mi Granja
              </Text>
            ),
            headerRight: () => (
              <TouchableOpacity
                onPress={() => Alert.alert("Buscar", "Función próximamente")}
                style={{ paddingHorizontal: 6 }}
              >
                <MaterialCommunityIcons name="magnify" size={22} color={Colors.white} />
              </TouchableOpacity>
            ),
          }}
        />

        {/* Extras (flecha funciona normal, NO ocultamos header) */}
        <Stack.Screen name="Historial" component={BackupHistoryScreen} />
        <Stack.Screen name="Costos" component={CostsScreen} />
        <Stack.Screen name="Reproducción" component={ReproductionScreen} />
        <Stack.Screen name="AsistenteIAWelcome" component={AssistantIAWelcomeScreen} />
        <Stack.Screen name="AsistenteIA" component={AssistantIAScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* ====== Estilos ====== */
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, paddingBottom: 100 },

  topGreen: {
    marginHorizontal: -16,
    marginTop: -16,
    backgroundColor: Colors.green,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },

  chipsRow: { flexDirection: "row", justifyContent: "space-between" },
  chip: {
    width: "32%",
    backgroundColor: Colors.beige,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    elevation: 1,
  },
  chipTitle: { fontSize: 12, color: Colors.muted, fontWeight: "700" },
  chipValue: { fontSize: 16, fontWeight: "900", color: Colors.text, marginTop: 4 },

  grid: { marginTop: 12, flexDirection: "row", gap: 12, flexWrap: "wrap" },
  tile: {
    width: "48%",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  tileIconBox: {
    height: 90,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tileText: { fontWeight: "800", color: Colors.text, fontSize: 14, lineHeight: 18 },

  aiBtn: {
    marginTop: 14,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  aiBtnText: { color: Colors.white, fontWeight: "800", fontSize: 16 },
});
