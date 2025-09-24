// src/HomeApp.js
import AdminHomeScreen from "./AdminHomeScreen";
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
} from "react-native";
import { NavigationContainer, DefaultTheme, useIsFocused } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// RTDB
import { auth, realtimeDb } from "../database";
import { ref, onValue } from "firebase/database";

// Screens
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
import SplashScreen from "./SplashScreen";
import EditProfileScreen from "./EditProfileScreen";
import BienvenidaProductor from "./BienvenidaProductor";
import AdminDashboardScreen from "./AdminDashboardScreen"; // 🔹 NUEVO

const Colors = {
<<<<<<< HEAD
  green: "#b86969ff",
=======
  green: "#843a3a",
>>>>>>> ae21fe245a5a87233e75799906274cebdf755141
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
};

const STATS_KEY = "@porcinet_stats";

/* ====== Chip KPI ====== */
function StatChip({ title, value, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text style={styles.chipTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.chipValue} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

/* ====== Pressable animado ====== */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
function BouncyTile({ onPress, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 1.1, friction: 9, tension: 120, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 9, tension: 120, useNativeDriver: true }).start();
  };
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      style={[styles.tile, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ====== Menú de Inicio ====== */
function HomeMenu({ navigation }) {
  const [herd, setHerd] = useState(0);
  const [sows, setSows] = useState(0);
  const [productivityPct, setProductivityPct] = useState(null);
  const isFocused = useIsFocused();

  // Modal madres
  const [editSowsVisible, setEditSowsVisible] = useState(false);
  const [tempSows, setTempSows] = useState("");

  useEffect(() => {
    const loadStats = async () => {
      try {
        const raw = await AsyncStorage.getItem(STATS_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          setHerd(Number.isFinite(obj?.herdSize) ? obj.herdSize : 0);
          setSows(Number.isFinite(obj?.sows) ? obj.sows : 0);
        } else {
          setHerd(0);
          setSows(0);
        }
      } catch {
        setHerd(0);
        setSows(0);
      }
    };
    if (isFocused) loadStats();
  }, [isFocused]);

  // Productividad RTDB
  useEffect(() => {
    if (!isFocused) return;
    const u = auth.currentUser;
    if (!u) {
      setProductivityPct(null);
      return;
    }
    const pRef = ref(realtimeDb, `producers/${u.uid}/metrics/productivityPct`);
    const off = onValue(pRef, (snap) => {
      const v = snap.val();
      if (Number.isFinite(v)) {
        setProductivityPct(Math.max(0, Math.min(100, Math.round(v))));
      } else {
        setProductivityPct(null);
      }
    });
    return () => off();
  }, [isFocused]);

  const openEditSows = () => {
    setTempSows(String(sows ?? 0));
    setEditSowsVisible(true);
  };
  const saveSows = async () => {
    const newVal = parseInt(String(tempSows).trim(), 10);
    if (!Number.isFinite(newVal) || newVal < 0) {
      Alert.alert("Valor inválido", "Ingresa un número válido (0 o mayor).");
      return;
    }
    try {
      const payload = { herdSize: herd, sows: newVal };
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(payload));
      setSows(newVal);
      setEditSowsVisible(false);
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar el valor.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.green} />
      <View style={[styles.screen, { backgroundColor: Colors.beige }]}>

        {/* Franja superior */}
        <View style={styles.topGreen}>
          <View style={styles.rowChips}>
            <StatChip title="Cerdos totales" value={String(herd)} />
            <StatChip title="Productividad" value={`${productivityPct ?? 85}%`} />
            <StatChip title="Madres" value={String(sows)} onPress={openEditSows} />
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          <BouncyTile onPress={() => navigation.navigate("InformeTab")}>
            <View style={styles.tileIconBox}>
              <Image source={require("../assets/productividad.png")} resizeMode="cover" style={{ width: "100%", height: "101%", borderRadius: 12 }} />
            </View>
            <Text style={styles.tileText}>Dashboard de{"\n"}productividad</Text>
          </BouncyTile>

          <BouncyTile onPress={() => navigation.navigate("RespaldoTab")}>
            <View style={styles.tileIconBox}>
              <Image source={require("../assets/respaldo.png")} resizeMode="cover" style={{ width: "100%", height: "109%", borderRadius: 10 }} />
            </View>
            <Text style={styles.tileText}>Respaldos{"\n"}en la nube</Text>
          </BouncyTile>

          <BouncyTile onPress={() => navigation.navigate("Reproducción")}>
            <View style={styles.tileIconBox}>
              <Image source={require("../assets/cerdo.png")} resizeMode="cover" style={{ width: "110%", height: "100%", borderRadius: 12 }} />
            </View>
            <Text style={styles.tileText}>Control de{"\n"}reproducción</Text>
          </BouncyTile>

          <BouncyTile onPress={() => navigation.navigate("Costos")}>
            <View style={styles.tileIconBox}>
              <Image source={require("../assets/costos.png")} resizeMode="cover" style={{ width: "101%", height: "101%", borderRadius: 12 }} />
            </View>
            <Text style={styles.tileText}>Gestión de{"\n"}costos y gastos</Text>
          </BouncyTile>
        </View>

        {/* Botón IA */}
        <Pressable style={styles.aiBtn} onPress={() => navigation.navigate("AsistenteIAWelcome")}>
          <Text style={styles.aiBtnText}>Asistente IA</Text>
        </Pressable>
      </View>

      {/* Modal editar “Madres” */}
      <Modal transparent visible={editSowsVisible} animationType="fade" onRequestClose={() => setEditSowsVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar número de madres</Text>
            <TextInput
              value={tempSows}
              onChangeText={setTempSows}
              keyboardType="number-pad"
              placeholder="0"
              style={styles.modalInput}
              maxLength={6}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setEditSowsVisible(false)}>
                <Text style={[styles.modalBtnText, { color: Colors.green }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalOk]} onPress={saveSows}>
                <Text style={[styles.modalBtnText, { color: Colors.white }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ====== Tabs (contenido real, sin tocar tu lógica) ====== */
const Tab = createBottomTabNavigator();
function AppTabs() {
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
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="InformeTab"
          component={ProductivityDashboardScreen}
          options={{
            title: "Informe",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-bar" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="RespaldoTab"
          component={BackupScreen}
          options={{
            title: "Respaldo",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cloud-outline" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="PerfilTab"
          component={ProfileScreen}
          options={{
            title: "Perfil",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" size={size} color={color} />,
          }}
        />
      </Tab.Navigator>
    </AuthWrapper>
  );
}

/* ====== Stack interno que muestra Bienvenida -> Tabs ====== */
const InnerStack = createNativeStackNavigator();
function TabsFlow({ navigation }) {
  return (
    <InnerStack.Navigator>
      <InnerStack.Screen
        name="BienvenidaProductor"
        component={BienvenidaProductor}
        options={{ headerShown: false }}
      />
      <InnerStack.Screen
        name="Tabs"
        component={AppTabs}
        options={{
          headerShown: true,
          title: "Mi Granja",
          headerStyle: { backgroundColor: Colors.green },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "800", fontSize: 20 },
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
    </InnerStack.Navigator>
  );
}

/* ====== Stack raíz ====== */
const RootStack = createNativeStackNavigator();

export default function HomeApp() {
  const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: Colors.beige } };

  return (
    <NavigationContainer theme={theme}>
      <RootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: Colors.green },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "800", fontSize: 20 },
          headerTitleAlign: "left",
          contentStyle: { backgroundColor: Colors.beige },
        }}
      >
        {/* Splash primero */}
        <RootStack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />

        {/* Acceso */}
        <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="Registro" component={RegisterScreen} options={{ headerShown: false }} />

        {/* Home con flujo: Bienvenida -> Tabs reales */}
        <RootStack.Screen
          name="Tabs"
          component={TabsFlow}
          options={{ headerShown: false }}
        />

        {/* Extras */}
        <RootStack.Screen name="Historial" component={BackupHistoryScreen} />
        <RootStack.Screen name="Costos" component={CostsScreen} />
        <RootStack.Screen name="Reproducción" component={ReproductionScreen} />
        <RootStack.Screen name="AsistenteIAWelcome" component={AssistantIAWelcomeScreen} />
        <RootStack.Screen name="AsistenteIA" component={AssistantIAScreen} />
        <RootStack.Screen name="EditarPerfil" component={EditProfileScreen} options={{ title: "Editar perfil" }} />

        {/* Admin */}
        <RootStack.Screen
          name="AdminPanel"
          component={AdminHomeScreen}
          options={{ title: "Admin", headerShown: true }}
        />
        <RootStack.Screen
          name="AdminDashboard"
          component={AdminDashboardScreen}   // 🔹 NUEVO
          options={{ title: "Dashboard" }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

/* ====== Estilos ====== */
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, paddingBottom: 100 },

  topGreen: {
    marginHorizontal: -16,
    marginTop: 0,
    backgroundColor: Colors.green,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },

  rowChips: { flexDirection: "row", alignItems: "stretch", gap: 12 },
  chip: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.beige,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    elevation: 1,
  },
  chipTitle: { fontSize: 12, color: Colors.muted, fontWeight: "700" },
  chipValue: { fontSize: 18, fontWeight: "900", color: Colors.text, marginTop: 4 },

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
    overflow: "hidden",
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

  // Modal editar madres
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 10 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D6D3C8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontWeight: "800",
    color: Colors.text,
  },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 12, justifyContent: "flex-end" },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.green,
  },
  modalCancel: { backgroundColor: Colors.white },
  modalOk: { backgroundColor: Colors.green, borderColor: Colors.green },
  modalBtnText: { fontWeight: "900", fontSize: 14 },
});
