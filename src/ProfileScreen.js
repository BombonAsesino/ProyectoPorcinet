// src/ProfileScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Image,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db, realtimeDb } from "../database";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ref, onValue, set } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage"; // 👈 NUEVO

const Colors = {
<<<<<<< HEAD
  green: "#1E5B3F",
=======
  green: "#843a3a",
>>>>>>> ae21fe245a5a87233e75799906274cebdf755141
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.12)",
  ok: "#16a34a",
  bad: "#dc2626",
};

const STATS_KEY = "@porcinet_stats"; // 👈 NUEVO (Home lo lee para chips)

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [producerData, setProducerData] = useState(null);
  const [loading, setLoading] = useState(true);

  // RTDB demo
  const [rtConnected, setRtConnected] = useState(false);
  const [rtStatus, setRtStatus] = useState(null);

  useEffect(() => {
    loadUserData();
    const unsubscribe = navigation.addListener("focus", loadUserData);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    const connRef = ref(realtimeDb, ".info/connected");
    const offConn = onValue(connRef, (snap) => setRtConnected(!!snap.val()));

    const statusRef = ref(realtimeDb, `status/${u.uid}`);
    const offStatus = onValue(statusRef, (snap) => {
      setRtStatus(snap.exists() ? snap.val() : null);
    });

    return () => {
      offConn();
      offStatus();
    };
  }, [auth?.currentUser?.uid]);

  const loadUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        setUser(currentUser);
        const producerDoc = await getDoc(doc(db, "producers", currentUser.uid));
        if (producerDoc.exists()) setProducerData(producerDoc.data());
      }
    } catch (error) {
      console.error("Error cargando datos del usuario:", error);
    } finally {
      setLoading(false);
    }
  };

  // 👇 NUEVO: sincroniza chips del Home cada vez que cambie el perfil
  useEffect(() => {
    if (!producerData) return;
    const herd =
      Number.isFinite(producerData?.herdSize) && producerData.herdSize >= 0
        ? producerData.herdSize
        : 0;
    const sows =
      Number.isFinite(producerData?.sows) && producerData.sows >= 0
        ? producerData.sows
        : 0;

    AsyncStorage.setItem(STATS_KEY, JSON.stringify({ herdSize: herd, sows })).catch(
      () => {}
    );
  }, [producerData]);

  const handleLogout = async () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro de que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          } catch (error) {
            console.error("Error al cerrar sesión:", error);
            Alert.alert("Error", "No se pudo cerrar sesión");
          }
        },
      },
    ]);
  };

  const formatDate = (date) => {
    if (!date) return "No disponible";
    if (typeof date === "string") {
      const d = new Date(date);
      return isNaN(d.getTime())
        ? "No disponible"
        : d.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
    }
    if (date?.seconds) {
      return new Date(date.seconds * 1000).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    try {
      return new Date(date).toLocaleString("es-ES", {
        dateStyle: "long",
        timeStyle: "short",
      });
    } catch {
      return "No disponible";
    }
  };

  const updateRealtimeStatus = async () => {
    try {
      const u = auth.currentUser;
      if (!u) return;
      await set(ref(realtimeDb, `status/${u.uid}`), {
        lastLogin: new Date().toISOString(),
        message: "Usuario activo ✅",
      });
      Alert.alert("Listo", "Estado actualizado en tiempo real.");
    } catch (e) {
      console.error("Error escribiendo en RTDB:", e);
      Alert.alert("Error", "No se pudo actualizar el estado en tiempo real.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.beige }}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.green} />
        <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: Colors.muted }}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Soporta foto guardada como Data URL (photoDataUrl), base64 (photoBase64) o URL
  let photoSrc = null;
  if (producerData?.photoDataUrl) {
    photoSrc = { uri: producerData.photoDataUrl };
  } else if (producerData?.photoBase64) {
    photoSrc = { uri: `data:image/jpeg;base64,${producerData.photoBase64}` };
  } else if (producerData?.photoURL || user?.photoURL) {
    photoSrc = { uri: producerData?.photoURL || user?.photoURL };
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.green} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialCommunityIcons name="logout" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Avatar e info básica */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {photoSrc ? (
              <Image source={photoSrc} style={{ width: 120, height: 120, borderRadius: 60 }} />
            ) : (
              <MaterialCommunityIcons name="account" size={80} color={Colors.green} />
            )}
          </View>
          <Text style={styles.userName}>{producerData?.name || user?.email || "Usuario"}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>

          {/* Botón Editar Perfil justo debajo de la foto */}
          <TouchableOpacity
            style={[styles.actionBtn, { marginTop: 12 }]}
            onPress={() => navigation.navigate("EditarPerfil")}
          >
            <MaterialCommunityIcons name="pencil" size={20} color={Colors.white} />
            <Text style={styles.actionBtnText}>Editar Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Información del productor */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Información del Productor</Text>
          <InfoCard icon="account" label="Nombre completo" value={producerData?.name || "No disponible"} />
          <InfoCard icon="phone" label="Teléfono" value={producerData?.phone || "No disponible"} />
          <InfoCard icon="home" label="Número de granja" value={producerData?.farmNumber || "No disponible"} />
          <InfoCard icon="pig" label="Cerdos actuales" value={`${producerData?.herdSize || 0} cerdos`} />
        </View>

        {/* Información de la cuenta */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Información de la Cuenta</Text>
          <InfoCard icon="email" label="Correo electrónico" value={user?.email} />
          <InfoCard icon="calendar" label="Cuenta creada" value={formatDate(producerData?.createdAt)} />
          <InfoCard
            icon="shield-check"
            label="Estado de verificación"
            value={user?.emailVerified ? "Verificado" : "No verificado"}
            valueColor={user?.emailVerified ? Colors.ok : Colors.muted}
          />
        </View>

        {/* Realtime DB (demo) */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Estado en tiempo real (Realtime DB)</Text>

          <View style={styles.rtRow}>
            <View
              style={[
                styles.rtDot,
                { backgroundColor: rtConnected ? Colors.ok : Colors.bad },
              ]}
            />
            <Text style={{ fontWeight: "800", color: Colors.text }}>
              {rtConnected ? "Conectado" : "Desconectado"}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="broadcast" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Mensaje:</Text>
            </View>
            <Text style={styles.infoValue}>{rtStatus?.message || "—"}</Text>

            <View style={[styles.infoRow, { marginTop: 8 }]}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Última actualización:</Text>
            </View>
            <Text style={styles.infoValue}>
              {rtStatus?.lastLogin ? formatDate(rtStatus.lastLogin) : "—"}
            </Text>

            <TouchableOpacity style={[styles.actionBtn, { marginTop: 12 }]} onPress={updateRealtimeStatus}>
              <MaterialCommunityIcons name="refresh" size={20} color={Colors.white} />
              <Text style={styles.actionBtnText}>Actualizar estado en tiempo real</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ icon, label, value, valueColor }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.green} />
        <Text style={styles.infoLabel}>{label}:</Text>
      </View>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, paddingBottom: 100 },
  header: {
    backgroundColor: Colors.green,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: Colors.white, fontSize: 20, fontWeight: "800" },
  logoutBtn: { padding: 8 },

  content: { flex: 1, padding: 16 },

  avatarSection: { alignItems: "center", marginBottom: 24 },
  avatarContainer: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.white, alignItems: "center", justifyContent: "center",
    marginBottom: 16, borderWidth: 4, borderColor: Colors.green,
  },
  userName: { fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  userEmail: { fontSize: 16, color: Colors.muted, fontWeight: "600" },

  infoSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 16 },

  infoCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  infoLabel: { fontSize: 14, fontWeight: "700", color: Colors.muted, marginLeft: 8 },
  infoValue: { fontSize: 16, fontWeight: "600", color: Colors.text },

  actionBtn: {
    backgroundColor: Colors.green, paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  actionBtnText: { color: Colors.white, fontSize: 16, fontWeight: "800", marginLeft: 8 },

  // RTDB
  rtRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  rtDot: { width: 12, height: 12, borderRadius: 6 },
});
