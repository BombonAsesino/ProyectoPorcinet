// src/BackupApp.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";

// Firestore
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

const Colors = {
  green: "#1E5B3F",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.08)",
};

// ===== helpers de fecha =====
function safeDate(any) {
  if (!any) return new Date();
  if (any?.toDate) return any.toDate();
  if (any?.seconds != null) return new Date(any.seconds * 1000);
  if (any?._seconds != null) return new Date(any._seconds * 1000);
  if (typeof any === "string" || typeof any === "number") return new Date(any);
  return new Date(any);
}
function monthKeyFrom(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(ts) {
  try {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch {
    return String(ts);
  }
}

/* ============================
   Crear respaldo
============================ */
async function createBackup(uid) {
  let costs = [];
  try {
    const q = query(collection(db, "costs"), where("uid", "==", uid));
    const snap = await getDocs(q);
    costs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.log("createBackup/getDocs error", e);
    costs = [];
  }

  const costsSanitized = costs.map((c) => ({
    ...c,
    date: (() => {
      const d = safeDate(c.date);
      return Number.isFinite(d?.getTime?.()) ? d.toISOString() : null;
    })(),
    createdAt: c.createdAt?.toMillis ? c.createdAt.toMillis() : null,
    updatedAt: c.updatedAt?.toMillis ? c.updatedAt.toMillis() : null,
  }));

  const payload = {
    version: 1,
    uid,
    createdAt: Date.now(),
    data: { costs: costsSanitized },
  };

  const json = JSON.stringify(payload);
  const backupId = `${uid}_${payload.createdAt}`;
  const ref = doc(collection(db, "backups"), backupId);

  await setDoc(ref, {
    uid,
    createdAt: payload.createdAt,
    sizeBytes: json.length,
    version: payload.version,
    collections: ["costs"],
    payload: json,
  });

  return { id: backupId, createdAt: payload.createdAt };
}

async function readBackupDoc(backupId) {
  const ref = doc(collection(db, "backups"), backupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Respaldo no encontrado");
  const data = snap.data();
  return JSON.parse(String(data.payload || "{}"));
}

async function restoreCosts(uid, items = []) {
  if (!Array.isArray(items)) return;
  const batch = writeBatch(db);

  items.forEach((it) => {
    const date = safeDate(it.date);
    const mk = it.monthKey || monthKeyFrom(date);
    const id = it.id ?? `${uid}_${date.getTime()}`;

    const clean = {
      uid,
      amount: Number(it.amount || 0),
      category: it.category || "Alimentación",
      note: (it.note || "").trim(),
      date,
      monthKey: mk,
      createdAt: serverTimestamp(),
      updatedAt: null,
    };

    batch.set(doc(collection(db, "costs"), id), clean);
  });

  await batch.commit();
}

/* ============================
   Pantalla principal
============================ */
export function BackupScreen({ navigation }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    const qHist = query(
      collection(db, "backups"),
      where("uid", "==", u.uid),
      orderBy("createdAt", "desc")
    );
    const off = onSnapshot(qHist, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setLast(arr[0] ?? null);
    });
    return () => off();
  }, []);

  const doBackup = async () => {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Sesión", "Debes iniciar sesión.");
    try {
      setBusy(true);
      setStatus("Preparando respaldo…");
      const res = await createBackup(u.uid);
      setStatus(`Respaldo creado: ${fmt(res.createdAt)}`);
      Alert.alert("Listo", "Respaldo creado correctamente.");
    } catch (e) {
      console.log("createBackup error", e);
      Alert.alert("Error", String(e?.message ?? e));
      setStatus("Error al crear respaldo");
    } finally {
      setBusy(false);
    }
  };

  const doRestoreLast = async () => {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Sesión", "Debes iniciar sesión.");
    if (!last?.id) return Alert.alert("Sin respaldo", "Aún no tienes respaldos.");

    try {
      setBusy(true);
      setStatus("Descargando respaldo…");
      const payload = await readBackupDoc(last.id);

      if (!payload?.data || payload.uid !== u.uid) {
        throw new Error("Respaldo inválido o de otro usuario.");
      }

      setStatus("Restaurando datos …");
      await restoreCosts(u.uid, payload.data.costs ?? []);
      setStatus("Datos restaurados.");
      Alert.alert("Listo", "Se restauraron los costos del respaldo.");
    } catch (e) {
      console.log("restore error", e);
      Alert.alert("Error", String(e?.message ?? e));
      setStatus("Error al restaurar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.beige, padding: 16 }}>
      <View style={styles.panel}>
        <Text style={styles.title}>Respaldos en la nube</Text>

        <TouchableOpacity
          style={[styles.btn, busy && { opacity: 0.7 }]}
          onPress={doBackup}
          disabled={busy}
        >
          <MaterialCommunityIcons name="cloud-upload" size={18} color={Colors.white} />
          <Text style={styles.btnText}>{busy ? "Procesando…" : "Crear respaldo"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnLight, busy && { opacity: 0.7 }]}
          onPress={doRestoreLast}
          disabled={busy}
        >
          <MaterialCommunityIcons name="cloud-download" size={18} color={Colors.green} />
          <Text style={styles.btnLightText}>Restaurar último respaldo</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 8 }}>
          <Text style={styles.smallLabel}>Estado</Text>
          <Text style={styles.smallText}>{status || "Listo"}</Text>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={styles.smallLabel}>Último respaldo</Text>
          {last ? (
            <Text style={styles.smallText}>
              {fmt(last.createdAt)} · {Math.round((last.sizeBytes ?? 0) / 1024)} KB
            </Text>
          ) : (
            <Text style={styles.smallText}>—</Text>
          )}
        </View>

        {busy ? (
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator color={Colors.green} />
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Historial</Text>
        <Text style={styles.smallText}>
          Para ver todos tus respaldos, abre “Historial de respaldos”.
        </Text>

        <TouchableOpacity
          style={[styles.rowBtn, { alignSelf: "flex-start", marginTop: 10 }]}
          onPress={() => navigation?.navigate("Historial")}
        >
          <MaterialCommunityIcons name="history" size={18} color={Colors.white} />
          <Text style={styles.rowBtnText}>Abrir historial de respaldos</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ============================
   Pantalla historial
============================ */
export function BackupHistoryScreen() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setItems([]);
      setBusy(false);
      return;
    }
    const qHist = query(
      collection(db, "backups"),
      where("uid", "==", u.uid),
      orderBy("createdAt", "desc")
    );
    const off = onSnapshot(
      qHist,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setItems(arr);
        setBusy(false);
      },
      () => setBusy(false)
    );
    return () => off();
  }, []);

  const restoreOne = async (it) => {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Sesión", "Debes iniciar sesión.");
    try {
      setBusy(true);
      const payload = await readBackupDoc(it.id);
      if (!payload?.data || payload.uid !== u.uid) {
        throw new Error("Respaldo inválido o de otro usuario.");
      }
      await restoreCosts(u.uid, payload.data.costs ?? []);
      Alert.alert("Listo", "Se restauraron los costos del respaldo seleccionado.");
    } catch (e) {
      console.log("restore one error", e);
      Alert.alert("Error", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{fmt(item.createdAt)}</Text>
        <Text style={styles.rowSub}>
          {Math.round((item.sizeBytes ?? 0) / 1024)} KB · {item.collections?.join(", ")}
        </Text>
      </View>
      <TouchableOpacity style={styles.rowBtn} onPress={() => restoreOne(item)}>
        <MaterialCommunityIcons name="cloud-download" size={18} color={Colors.white} />
        <Text style={styles.rowBtnText}>Restaurar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.beige, padding: 16 }}>
      <View style={styles.panel}>
        <Text style={styles.title}>Historial de respaldos</Text>
        {busy ? (
          <ActivityIndicator color={Colors.green} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            ListEmptyComponent={<Text style={styles.smallText}>Aún no tienes respaldos.</Text>}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )}
      </View>
    </View>
  );
}

/* ============================
   Estilos
============================ */
const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: "900", color: Colors.text, marginBottom: 8 },
  btn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: { color: Colors.white, fontWeight: "900" },
  btnLight: {
    marginTop: 8,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnLightText: { color: Colors.green, fontWeight: "900" },
  smallLabel: { color: Colors.muted, fontWeight: "800", fontSize: 12 },
  smallText: { color: Colors.text, fontWeight: "700" },
  row: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontWeight: "900", color: Colors.text },
  rowSub: { color: Colors.muted, fontWeight: "700", marginTop: 2 },
  rowBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowBtnText: { color: Colors.white, fontWeight: "900" },
});
