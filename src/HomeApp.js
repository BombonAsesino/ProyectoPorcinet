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
  DeviceEventEmitter,
} from "react-native";
import { NavigationContainer, DefaultTheme, useIsFocused } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Firebase
import { auth, realtimeDb, db } from "../database";
import { ref, onValue, update } from "firebase/database";
import { doc, getDoc } from "firebase/firestore";
import { signOut as fbSignOut } from "firebase/auth";

// Screens
import { ProductivityDashboardScreen } from "./DashboardApp";
import { BackupScreen, BackupHistoryScreen } from "./BackupApp";
import { CostsScreen } from "./CostsScreen";
import ReproductionScreen from "./ReproductionScreen";
import PigsListScreen from "./PigsListScreen";
import PigFormScreen from "./PigFormScreen";
import AssistantIAScreen from "./AssistantIAScreen";
import AssistantIAWelcomeScreen from "./AssistantIAWelcomeScreen";
import LoginScreen from "./LoginScreen";
import RegisterScreen from "./RegisterScreen";
import ProfileScreen from "./ProfileScreen";
import AuthWrapper from "./AuthWrapper";
import SplashScreen from "./SplashScreen";
import EditProfileScreen from "./EditProfileScreen";
import BienvenidaProductor from "./BienvenidaProductor";
import AdminDashboardScreen from "./AdminDashboardScreen";
import PantallaGestionUsuarios from "./PantallaGestionUsuarios";
import ManageUsersLite from "./ManageUsersLite";

// ⬇️ Pantalla modal de búsqueda
import SearchOverlayScreen from "./SearchOverlayScreen";

// ⬇️ NUEVO: pantalla de Salud y Crecimiento (H19)
import HealthAndGrowthScreen from "./HealthAndGrowthScreen";

// ⬇️ NUEVO: sync de colas offline de salud/crecimiento
import * as Network from "expo-network";
import { syncHealthQueues } from "./scripts/syncHealthQueues";

const Colors = {
  green: "#843a3a",
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
      <Text style={styles.chipTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.chipValue} numberOfLines={1}>{value}</Text>
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
  const [herd, setHerd] = useState(0); // total
  const [sows, setSows] = useState(0);
  const [productivityPct, setProductivityPct] = useState(null);
  const isFocused = useIsFocused();

  // === permisos / rol ===
  const [role, setRole] = useState("principal"); // 'principal' | 'subcuenta'
  const [allowed, setAllowed] = useState(null);  // null => sin restricción; array => módulos permitidos

  // Modal madres
  const [editSowsVisible, setEditSowsVisible] = useState(false);
  const [tempSows, setTempSows] = useState("");

  // 0) Cargar rol + permisos
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    let offRTDB = null;

    (async () => {
      try {
        const me = await getDoc(doc(db, "users", u.uid));
        const data = me.data() || {};
        const rol = data?.rol || "principal";
        const disabled = !!data?.disabled;
        setRole(rol);

        if (disabled) {
          Alert.alert("Cuenta desactivada", "Consulta con el administrador.");
          try { await fbSignOut(auth); } catch {}
          return;
        }

        if (rol === "subcuenta") {
          offRTDB = onValue(ref(realtimeDb, `userPerms/${u.uid}/modules`), (snap) => {
            const arr = snap.val();
            setAllowed(Array.isArray(arr) ? arr.map(String) : []);
          });
        } else {
          setAllowed(null); // dueño: todo permitido
        }
      } catch {
        setAllowed(null);
      }
    })();

    return () => { if (offRTDB) offRTDB(); };
  }, []);

  const can = (tag) => {
    if (allowed === null) return true;     // dueño
    return allowed.includes(tag);          // subcuenta limitada
  };

  // 1) Prime desde AsyncStorage para arranque rápido
  useEffect(() => {
    const primeFromLocal = async () => {
      try {
        const raw = await AsyncStorage.getItem(STATS_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          if (Number.isFinite(obj?.herdSize)) setHerd(obj.herdSize);
          if (Number.isFinite(obj?.sows)) setSows(obj.sows);
        }
      } catch {}
    };
    if (isFocused) primeFromLocal();
  }, [isFocused]);

  // 2) Suscripción RTDB: herd (total, sows)
  useEffect(() => {
    if (!isFocused) return;
    const u = auth.currentUser;
    if (!u) {
      setHerd(0);
      setSows(0);
      return;
    }
    const herdRef = ref(realtimeDb, `producers/${u.uid}/herd`);
    const off = onValue(herdRef, async (snap) => {
      const v = snap.val() || {};
      const total = Number(v.total ?? 0);
      const msows = Number(v.sows ?? 0);
      setHerd(total);
      setSows(msows);
      try {
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify({ herdSize: total, sows: msows }));
      } catch {}
    });
    return () => off();
  }, [isFocused]);

  // 3) Productividad RTDB
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
      if (Number.isFinite(v)) setProductivityPct(Math.max(0, Math.min(100, Math.round(v))));
      else setProductivityPct(null);
    });
    return () => off();
  }, [isFocused]);

  // 4) Broadcast inmediato desde Dashboard
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("herd:updated", async (payload) => {
      if (!payload) return;
      const t = Number(payload.total ?? herd);
      const s = Number(payload.sows ?? sows);
      setHerd(Number.isFinite(t) ? t : herd);
      setSows(Number.isFinite(s) ? s : sows);
      try { await AsyncStorage.setItem(STATS_KEY, JSON.stringify({ herdSize: t, sows: s })); } catch {}
    });
    return () => sub.remove();
  }, [herd, sows]);

  const openEditSows = () => {
    setTempSows(String(sows ?? 0));
    setEditSowsVisible(true);
  };

  // Guardar "Madres" desde Home (opcional)
  const saveSows = async () => {
    const newVal = parseInt(String(tempSows).trim(), 10);
    if (!Number.isFinite(newVal) || newVal < 0) {
      Alert.alert("Valor inválido", "Ingresa un número válido (0 o mayor).");
      return;
    }
    const u = auth.currentUser;
    if (!u) {
      Alert.alert("Sesión", "Debes iniciar sesión.");
      return;
    }
    try {
      await update(ref(realtimeDb, `producers/${u.uid}/herd`), {
        sows: newVal,
        updatedAt: Date.now(),
      });
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify({ herdSize: herd, sows: newVal }));
      setSows(newVal);
      DeviceEventEmitter.emit("herd:updated", { total: herd, sows: newVal });
      setEditSowsVisible(false);
      Alert.alert("Guardado", "Número de madres actualizado.");
    } catch {
      Alert.alert("Error", "No se pudo guardar el valor.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.green} />
      <View style={[styles.screen, { backgroundColor: Colors.beige, paddingTop: 20 }]}>
        {/* Franja superior */}
        <View style={styles.topGreen}>
          <View style={styles.rowChips}>
            <StatChip title="Cerdos totales" value={String(herd)} />
            <StatChip
              title="Productividad"
              value={productivityPct !== null && productivityPct !== undefined ? `${productivityPct}%` : `-- %`}
            />
            <StatChip title="Madres" value={String(sows)} onPress={openEditSows} />
          </View>
        </View>

        {/* Grid (filtrado por permisos) */}
        <View style={styles.grid}>
          {can("analytics") && (
            <BouncyTile onPress={() => navigation.navigate("InformeTab")}>
              <View style={styles.tileIconBox}>
                <Image source={require("../assets/productividad.png")} resizeMode="cover" style={{ width: "100%", height: "101%", borderRadius: 12 }} />
              </View>
              <Text style={styles.tileText}>Dashboard de{"\n"}productividad</Text>
            </BouncyTile>
          )}

          {can("respaldo") && (
            <BouncyTile onPress={() => navigation.navigate("RespaldoTab")}>
              <View style={styles.tileIconBox}>
                <Image source={require("../assets/respaldo.png")} resizeMode="cover" style={{ width: "100%", height: "109%", borderRadius: 10 }} />
              </View>
              <Text style={styles.tileText}>Respaldos{"\n"}en la nube</Text>
            </BouncyTile>
          )}

          {can("reproduccion") && (
            <BouncyTile onPress={() => navigation.navigate("ReproStack")}>
              <View style={styles.tileIconBox}>
                <Image source={require("../assets/cerdo.png")} resizeMode="cover" style={{ width: "110%", height: "100%", borderRadius: 12 }} />
              </View>
              <Text style={styles.tileText}>Control de{"\n"}reproducción</Text>
            </BouncyTile>
          )}

          {role === "principal" && (
            <BouncyTile onPress={() => navigation.navigate("GestionUsuarios")}>
              <View style={styles.tileIconBox}>
                <MaterialCommunityIcons name="account-group-outline" size={42} color={Colors.green} />
              </View>
              <Text style={styles.tileText}>Gestión de{"\n"}usuarios</Text>
            </BouncyTile>
          )}

          {can("costos") && (
            <BouncyTile onPress={() => navigation.navigate("Costos")}>
              <View style={styles.tileIconBox}>
                <Image source={require("../assets/costos.png")} resizeMode="cover" style={{ width: "101%", height: "101%", borderRadius: 12 }} />
              </View>
              <Text style={styles.tileText}>Gestión de{"\n"}costos y gastos</Text>
            </BouncyTile>
          )}
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

/* ====== Tabs ====== */
const Tab = createBottomTabNavigator();
function AppTabs() {
  // pequeña capa de permisos también en Tabs
  const [role, setRole] = useState("principal");
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    let offRTDB = null;

    (async () => {
      try {
        const me = await getDoc(doc(db, "users", u.uid));
        const data = me.data() || {};
        const rol = data?.rol || "principal";
        setRole(rol);
        if (rol === "subcuenta") {
          offRTDB = onValue(ref(realtimeDb, `userPerms/${u.uid}/modules`), (snap) => {
            const arr = snap.val();
            setAllowed(Array.isArray(arr) ? arr.map(String) : []);
          });
        } else {
          setAllowed(null);
        }
      } catch {
        setAllowed(null);
      }
    })();

    return () => { if (offRTDB) offRTDB(); };
  }, []);

  const can = (tag) => {
    if (allowed === null) return true;
    return allowed.includes(tag);
  };

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

        {can("analytics") && (
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
        )}

        {can("respaldo") && (
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
        )}

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

/* ====== Stack Reproducción (H04) ====== */
const ReproStackNav = createNativeStackNavigator();
function ReproStack() {
  return (
    <ReproStackNav.Navigator>
      <ReproStackNav.Screen name="Reproducción" component={ReproductionScreen} />
      <ReproStackNav.Screen name="PigsList" component={PigsListScreen} options={{ title: "Lista de cerdas" }} />
      <ReproStackNav.Screen name="PigForm" component={PigFormScreen} options={{ title: "Formulario cerda" }} />
      {/* ⬇️ NUEVO: pantalla de Salud y crecimiento */}
      <ReproStackNav.Screen name="HealthAndGrowth" component={HealthAndGrowthScreen} options={{ title: "Salud y crecimiento" }} />
    </ReproStackNav.Navigator>
  );
}

/* ====== Header "Mi Granja" con icono de búsqueda ====== */
function TitleWithSearch({ navigation }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ color: Colors.white, fontWeight: "800", fontSize: 22 }}>Mi Granja</Text>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("Buscar", {
            // ⬇️ estos flags permiten que el overlay busque cerdas y costos
            enableAnimals: true,
            enableCosts: true,
          })
        }
        style={{ padding: 6 }}
      >
        <MaterialCommunityIcons name="magnify" size={24} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

/* ====== Stack interno Bienvenida -> Tabs ====== */
const InnerStack = createNativeStackNavigator();
function TabsFlow() {
  return (
    <InnerStack.Navigator>
      <InnerStack.Screen name="BienvenidaProductor" component={BienvenidaProductor} options={{ headerShown: false }} />
      <InnerStack.Screen
        name="Tabs"
        component={AppTabs}
        options={({ navigation }) => ({
          headerShown: true,
          // Título con icono de búsqueda al lado (estilo Facebook)
          headerTitle: () => <TitleWithSearch navigation={navigation} />,
          headerStyle: { backgroundColor: Colors.green },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "800", fontSize: 22 },
          headerTitleAlign: "center",
        })}
      />
    </InnerStack.Navigator>
  );
}

/* ====== Stack raíz ====== */
const RootStack = createNativeStackNavigator();
export default function HomeApp() {
  const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: Colors.beige } };

  // ⬇️ NUEVO: al abrir la app, intenta sincronizar colas offline (si hay internet)
  useEffect(() => {
    (async () => {
      try {
        const net = await Network.getNetworkStateAsync();
        if (net?.isConnected) {
          await syncHealthQueues();
        }
      } catch (e) {
        console.log("syncHealthQueues (HomeApp) error:", e?.message || e);
      }
    })();
  }, []);

  return (
    <NavigationContainer theme={theme}>
      <RootStack.Navigator
        screenOptions={{ headerStyle: { backgroundColor: Colors.green }, headerTintColor: Colors.white }}
      >
        <RootStack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="Registro" component={RegisterScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="Tabs" component={TabsFlow} options={{ headerShown: false }} />

        <RootStack.Screen
          name="GestionUsuarios"
          component={PantallaGestionUsuarios}
          options={{ title: "Gestión de usuarios" }}
        />

        {/* Extras */}
        <RootStack.Screen name="Historial" component={BackupHistoryScreen} />
        <RootStack.Screen name="Costos" component={CostsScreen} />
        <RootStack.Screen name="ReproStack" component={ReproStack} options={{ headerShown: false }} />
        <RootStack.Screen name="AsistenteIAWelcome" component={AssistantIAWelcomeScreen} />
        <RootStack.Screen name="AsistenteIA" component={AssistantIAScreen} />
        <RootStack.Screen name="EditarPerfil" component={EditProfileScreen} options={{ title: "Editar perfil" }} />

        {/* Admin */}
        <RootStack.Screen name="AdminPanel" component={AdminHomeScreen} options={{ title: "Admin" }} />
        <RootStack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: "Dashboard" }} />

        {/* ⬇️ Pantalla modal de búsqueda */}
        <RootStack.Screen
          name="Buscar"
          component={SearchOverlayScreen}
          options={{
            title: "Buscar",
            presentation: "modal",
            headerStyle: { backgroundColor: Colors.green },
            headerTintColor: Colors.white,
            headerTitleStyle: { fontWeight: "800", fontSize: 18 },
          }}
          initialParams={{
            // params activan la búsqueda de cerdas y costos desde el overlay
            enableAnimals: true,
            enableCosts: true,
          }}
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
  aiBtn: { marginTop: 14, backgroundColor: Colors.green, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  aiBtnText: { color: Colors.white, fontWeight: "800", fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 10 },
  modalInput: { borderWidth: 1, borderColor: "#D6D3C8", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontWeight: "800", color: Colors.text },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 12, justifyContent: "flex-end" },
  modalBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, borderWidth: 2, borderColor: Colors.green },
  modalCancel: { backgroundColor: Colors.white },
  modalOk: { backgroundColor: Colors.green, borderColor: Colors.green },
  modalBtnText: { fontWeight: "900", fontSize: 14 },
});
