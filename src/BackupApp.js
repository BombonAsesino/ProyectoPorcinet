// src/BackupApp.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

// 🔹 Firebase (tu módulo centralizado)
import { auth, db } from "../database";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

/* =======================
   Paleta y utilidades
======================= */
const Colors = {
  green: "#1E5B3F",
  greenDark: "#15432F",
  beige: "#FFF7EA",
  text: "#0f172a",
  outline: "#1E5B3F",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F9F3E6",
};

function formatDateTime(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("es-NI", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()} ${dt
      .getHours()
      .toString()
      .padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
  }
}

/* ============ Claves locales a respaldar (ajústalas a tu app) ============ */
const STATS_KEY = "@porcinet_stats";
const REPRO_KEY = "@repro_events";
const COSTS_KEY = "@costs_local_state";
const KEYS_TO_BACKUP = [STATS_KEY, REPRO_KEY, COSTS_KEY];

/* Helpers Firestore */
async function getOrCreateDeviceId() {
  const DEVICE_KEY = "@porcinet_device_id";
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function ownerId() {
  const uid = auth?.currentUser?.uid;
  if (uid) return `uid-${uid}`;
  const deviceId = await getOrCreateDeviceId();
  return `device-${deviceId}`;
}

async function gatherLocalData() {
  const data = {};
  for (const k of KEYS_TO_BACKUP) {
    try {
      const raw = await AsyncStorage.getItem(k);
      data[k] = raw ? JSON.parse(raw) : null;
    } catch {
      data[k] = null;
    }
  }
  return data;
}

/* =======================
   Pantalla: Respaldos
======================= */
export function BackupScreen({ navigation }) {
  const [autoBackup, setAutoBackup] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadState = useCallback(async () => {
    const [auto, last] = await Promise.all([
      AsyncStorage.getItem("autoBackupEnabled"),
      AsyncStorage.getItem("lastBackup"),
    ]);
    setAutoBackup(auto === "true");
    if (last) setLastBackup(last);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const toggleAutoBackup = async (value) => {
    setAutoBackup(value);
    await AsyncStorage.setItem("autoBackupEnabled", value ? "true" : "false");
  };

  const doBackupNow = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const owner = await ownerId();
      const col = collection(db, "backups", owner, "items");

      const payload = await gatherLocalData();
      const createdAt = new Date();

      // Guarda respaldo como documento Firestore
      await addDoc(col, {
        meta: {
          owner,
          uid: auth?.currentUser?.uid || null,
          app: "Porcinet",
          version: 1,
        },
        data: payload,
        createdAt: serverTimestamp(), // para ordenar en el servidor
        createdAtLocal: createdAt.toISOString(), // para mostrar mientras resuelve el serverTimestamp
      });

      // Actualiza "último respaldo" local
      await AsyncStorage.setItem("lastBackup", createdAt.toISOString());
      setLastBackup(createdAt.toISOString());

      Alert.alert("Listo", "Respaldo guardado en Firestore ✅");
    } catch (err) {
      console.log("firestore error:", err?.code, err?.message);
      Alert.alert("Error al respaldar", String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.beige }]}>
      <View style={styles.headerSpacer} />

      <View style={styles.avatarWrap}>
        <MaterialCommunityIcons name="pig" size={96} color="#ef7896" />
      </View>

      <Text style={styles.title}>Respaldos{"\n"}en la nube</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Respaldos automáticos</Text>
        <Switch
          value={autoBackup}
          onValueChange={toggleAutoBackup}
          trackColor={{ true: Colors.green }}
          thumbColor={autoBackup ? Colors.white : "#f4f3f4"}
        />
      </View>

      <Text style={styles.helper}>
        Último respaldo:{" "}
        <Text style={styles.helperBold}>
          {lastBackup ? formatDateTime(lastBackup) : "—"}
        </Text>
      </Text>

      <Pressable
        onPress={doBackupNow}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { backgroundColor: Colors.greenDark },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.primaryBtnText}>Respaldar ahora</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("Historial")}
        style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.outlineBtnText}>Ver respaldos anteriores</Text>
      </Pressable>
    </View>
  );
}

/* =======================
   Pantalla: Historial (Firestore)
======================= */
export function BackupHistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setBusy(true);
      const owner = await ownerId();
      const col = collection(db, "backups", owner, "items");

      // Ordena por createdAt (server) descendente
      const q = query(col, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const rows = snap.docs.map((d) => {
        const data = d.data();
        // createdAt puede estar pendiente; usa createdAtLocal como fallback
        const created =
          (data.createdAt && data.createdAt.toDate && data.createdAt.toDate()) ||
          (data.createdAtLocal ? new Date(data.createdAtLocal) : null);
        return {
          id: d.id,
          createdAt: created ? created.toISOString() : null,
        };
      });

      setItems(rows);
    } catch (err) {
      console.log("history error:", err?.code, err?.message);
      Alert.alert("Error", String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", loadHistory);
    return unsub;
  }, [navigation, loadHistory]);

  const restore = async (itemId) => {
    try {
      setBusy(true);
      const owner = await ownerId();
      const refDoc = doc(db, "backups", owner, "items", itemId);
      const snap = await getDoc(refDoc);
      if (!snap.exists()) {
        Alert.alert("Ups", "El respaldo ya no existe.");
        return;
      }
      const data = snap.data();
      const payload = data?.data || {};

      // Restaurar a AsyncStorage
      const entries = Object.entries(payload);
      for (const [key, value] of entries) {
        if (!key) continue;
        if (value === null || value === undefined) {
          await AsyncStorage.removeItem(key);
        } else {
          await AsyncStorage.setItem(key, JSON.stringify(value));
        }
      }

      Alert.alert("Restaurado", "Los datos fueron restaurados correctamente ✅");
    } catch (err) {
      console.log("restore error:", err?.code, err?.message);
      Alert.alert("Error al restaurar", String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId) => {
    try {
      setBusy(true);
      const owner = await ownerId();
      const refDoc = doc(db, "backups", owner, "items", itemId);
      await deleteDoc(refDoc);
      await loadHistory();
      Alert.alert("Eliminado", "Respaldo eliminado.");
    } catch (err) {
      console.log("delete error:", err?.code, err?.message);
      Alert.alert("Error al eliminar", String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.historyItem}>
      <Ionicons name="cloud-done-outline" size={22} color={Colors.green} />
      <View style={{ flex: 1 }}>
        <Text style={styles.historyText}>{formatDateTime(item.createdAt)}</Text>
      </View>

      <Pressable
        onPress={() => restore(item.id)}
        style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.smallBtnText}>Restaurar</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          Alert.alert("Eliminar", "¿Eliminar este respaldo?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", style: "destructive", onPress: () => removeItem(item.id) },
          ])
        }
        style={({ pressed }) => [styles.smallBtnOutline, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.smallBtnOutlineText}>Eliminar</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.beige }]}>
      <Pressable
        onPress={loadHistory}
        style={({ pressed }) => [styles.outlineBtn, { marginBottom: 10 }, pressed && { opacity: 0.85 }]}
      >
        {busy ? (
          <ActivityIndicator color={Colors.outline} />
        ) : (
          <Text style={styles.outlineBtnText}>Actualizar</Text>
        )}
      </Pressable>

      {items.length === 0 && !busy ? (
        <Text style={styles.empty}>Aún no hay respaldos.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingTop: 8 }}
        />
      )}
    </View>
  );
}

/* =======================
   Estilos
======================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerSpacer: { height: 4 },
  avatarWrap: {
    alignSelf: "center",
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
    elevation: 2,
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  rowLabel: { fontSize: 16, fontWeight: "600", color: Colors.text },
  helper: { marginTop: 10, color: Colors.muted, fontSize: 14 },
  helperBold: { color: Colors.text, fontWeight: "700" },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: Colors.green,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: Colors.white, fontWeight: "800", fontSize: 16 },
  outlineBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.outline,
    backgroundColor: "transparent",
  },
  outlineBtnText: { color: Colors.outline, fontWeight: "800", fontSize: 16 },
  empty: { color: Colors.muted, fontSize: 14 },

  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  historyText: { fontSize: 15, color: Colors.text, fontWeight: "600" },

  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.green,
    borderRadius: 10,
    marginLeft: 6,
  },
  smallBtnText: { color: Colors.white, fontWeight: "800", fontSize: 12 },

  smallBtnOutline: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "#b91c1c",
    borderRadius: 10,
    marginLeft: 6,
  },
  smallBtnOutlineText: { color: "#b91c1c", fontWeight: "800", fontSize: 12 },
});
