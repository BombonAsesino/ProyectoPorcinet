// src/PigFormScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  DeviceEventEmitter,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

/* ✅ Soporte offline */
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_QUEUE_KEY = "animals_offline_queue_v1";
const ANIMALS_CACHE_KEY = "animals_local_cache_v1"; // ✅ caché que lee la lista

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
};

function parseYMD(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isValidYMD(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// ✅ helpers caché
async function readCache() {
  try {
    const raw = await AsyncStorage.getItem(ANIMALS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function writeCache(arr) {
  try {
    await AsyncStorage.setItem(ANIMALS_CACHE_KEY, JSON.stringify(arr));
  } catch {}
}
async function upsertCacheItem(item) {
  // usa cloudId si existe para evitar duplicados; si no, usa par earTag|name
  const keyOf = (o) =>
    `${(o.earTag || "").toString()}|${(o.name || "").toString()}`.toLowerCase();
  const cache = await readCache();

  let updated = false;
  const next = cache.map((x) => {
    const sameCloud = item.cloudId && x.cloudId && String(x.cloudId) === String(item.cloudId);
    const samePair = keyOf(x) === keyOf(item);
    if (sameCloud || (!x.cloudId && samePair)) {
      updated = true;
      return { ...x, ...item };
    }
    return x;
  });
  if (!updated) next.unshift(item);
  await writeCache(next);
}

export default function PigFormScreen({ navigation, route }) {
  const id = route?.params?.id || null;

  const [earTag, setEarTag] = useState("");
  const [name, setName] = useState("");
  const [birthStr, setBirthStr] = useState("");
  const [status, setStatus] = useState("activa");
  const [parity, setParity] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "animals", id));
        if (snap.exists()) {
          const d = snap.data();
          setEarTag(String(d.earTag || ""));
          setName(String(d.name || ""));
          const birth =
            d.birthDate?.toDate
              ? d.birthDate.toDate()
              : (d.birthDate ? new Date(d.birthDate) : null);
          setBirthStr(birth ? birth.toISOString().slice(0, 10) : "");
          setStatus(d.status || "activa");
          setParity(String(d.parity ?? "0"));
          setNotes(String(d.notes || ""));
        }
      } catch (e) {
        console.log(e);
        Alert.alert("Error", "No se pudo cargar la cerda.");
      }
    })();
  }, [id]);

  const validateForm = () => {
    const errors = [];
    if (!earTag.trim()) errors.push("• El campo 'Arete / Código' es obligatorio.");
    if (!name.trim()) errors.push("• El campo 'Nombre' es obligatorio.");
    if (birthStr.trim() && !isValidYMD(birthStr.trim())) {
      errors.push("• La 'Fecha de nacimiento' debe tener formato válido (YYYY-MM-DD).");
    }
    const p = parseInt(parity, 10);
    if (!Number.isFinite(p) || p < 0) {
      errors.push("• El campo 'Partos' debe ser un número entero mayor o igual a 0.");
    }
    if (errors.length > 0) {
      Alert.alert("Campos incompletos", errors.join("\n"));
      return false;
    }
    return true;
  };

  /* ===== Offline helpers ===== */
  const enqueueOffline = async (record) => {
    try {
      const prev = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const arr = prev ? JSON.parse(prev) : [];
      arr.unshift(record);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.log("enqueueOffline error:", e);
    }
  };

  // ✅ Agrega o actualiza caché local (lista)
  const addToLocalCache = async (cachedItem) => {
    await upsertCacheItem(cachedItem);
    DeviceEventEmitter.emit("animals:changed", { type: "offline-add", item: cachedItem });
  };

  const save = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Alert.alert("Sesión", "Debes iniciar sesión.");

    if (!validateForm()) return;

    const birthDate = parseYMD(birthStr);
    const payload = {
      uid,
      earTag: earTag.trim(),
      name: name.trim(),
      birthDate: birthDate || null,
      status: (status || "activa").toLowerCase(),
      parity: Number.isFinite(parseInt(parity, 10)) ? parseInt(parity, 10) : 0,
      notes: notes.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      setBusy(true);

      // Chequeo de red
      const net = await Network.getNetworkStateAsync();
      if (!net?.isConnected) {
        // Guardado OFFLINE: encola y agrega al caché del listado
        const safePayload = {
          ...payload,
          updatedAt: new Date().toISOString(),
          birthDate: birthDate ? birthDate.toISOString() : null,
        };

        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        await enqueueOffline({
          action: id ? "update" : "create",
          id: id || null,
          payload: safePayload,
          enqueuedAt: new Date().toISOString(),
        });

        await addToLocalCache({
          localId,
          cloudId: null,
          uid,
          earTag: safePayload.earTag,
          name: safePayload.name,
          birthDate: safePayload.birthDate,
          status: safePayload.status,
          parity: safePayload.parity,
          notes: safePayload.notes,
          createdAt: new Date().toISOString(),
          offline: true,
        });

        Alert.alert(
          "Guardado offline",
          "La cerda se guardó localmente y ya aparece en la lista. Se sincronizará al reconectarte."
        );
        navigation.goBack();
        return;
      }

      // === Flujo online ===
      if (id) {
        await updateDoc(doc(db, "animals", id), payload);

        // ✅ espejo en caché para persistencia post-reinicio
        await addToLocalCache({
          cloudId: id,
          uid,
          earTag: payload.earTag,
          name: payload.name,
          birthDate: birthDate ? birthDate.toISOString() : null,
          status: payload.status,
          parity: payload.parity,
          notes: payload.notes,
          createdAt: new Date().toISOString(),
          offline: false,
        });

        Alert.alert("Actualizado", "Cerda actualizada correctamente.");
      } else {
        const ref = await addDoc(collection(db, "animals"), {
          ...payload,
          createdAt: serverTimestamp(),
        });

        // ✅ espejo en caché con cloudId del doc creado
        await addToLocalCache({
          cloudId: ref.id,
          uid,
          earTag: payload.earTag,
          name: payload.name,
          birthDate: birthDate ? birthDate.toISOString() : null,
          status: payload.status,
          parity: payload.parity,
          notes: payload.notes,
          createdAt: new Date().toISOString(), // usable para ordenar localmente
          offline: false,
        });

        Alert.alert("Guardado", "Cerda registrada correctamente.");
      }
      navigation.goBack();
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo guardar la información.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <View style={styles.panel}>
        <Text style={styles.title}>{id ? "Editar cerda" : "Nueva cerda"}</Text>

        <Text style={styles.label}>Arete / Código</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 1234"
          value={earTag}
          onChangeText={setEarTag}
        />

        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Chanchita"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Fecha de nacimiento (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2024-05-10"
          value={birthStr}
          onChangeText={setBirthStr}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Estado</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["activa", "inactiva"].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, status === s && { backgroundColor: Colors.green }]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.chipText, status === s && { color: Colors.white }]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Partos</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          keyboardType="numeric"
          value={parity}
          onChangeText={setParity}
        />

        <Text style={styles.label}>Notas</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: "top" }]}
          placeholder="Observaciones…"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={busy}>
          <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
          <Text style={styles.saveText}>{busy ? "Guardando…" : "Guardar"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.white,
    margin: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  title: { fontWeight: "900", fontSize: 18, color: Colors.text, marginBottom: 6 },
  label: { color: Colors.muted, fontWeight: "800" },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    color: Colors.text,
    fontWeight: "700",
  },
  chip: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.green,
    alignItems: "center",
  },
  chipText: { fontWeight: "800", color: Colors.green },
  saveBtn: {
    marginTop: 6,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  saveText: { color: Colors.white, fontWeight: "900" },
});
