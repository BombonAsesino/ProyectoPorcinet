// src/PigsListScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  DeviceEventEmitter,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";

/* ✅ soporte offline */
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#FFFFFF",
  border: "rgba(0,0,0,0.08)",
};

const ANIMALS_CACHE_KEY = "animals_local_cache_v1";
const OFFLINE_QUEUE_KEY = "animals_offline_queue_v1";

async function readLocalCache() {
  try {
    const raw = await AsyncStorage.getItem(ANIMALS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((x) => ({
      ...x,
      id: x.cloudId || x.localId || `local-${Math.random().toString(36).slice(2, 8)}`,
      offline: !!x.offline,
    }));
  } catch {
    return [];
  }
}

async function writeLocalCache(arr) {
  try {
    await AsyncStorage.setItem(ANIMALS_CACHE_KEY, JSON.stringify(arr));
  } catch {}
}

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(arr) {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(arr));
  } catch {}
}

function mergeAnimals(fsItems, cacheItems) {
  const out = [...fsItems];
  const seenById = new Set(fsItems.map((it) => String(it.id || "")));
  const keyOf = (o) =>
    `${(o.earTag || "").toString()}|${(o.name || "").toString()}`.trim().toLowerCase();
  const seenByPair = new Set(fsItems.map(keyOf));

  cacheItems.forEach((c) => {
    const cid = String(c.cloudId || "");
    if (!cid && seenByPair.has(keyOf(c))) return;
    if (cid && seenById.has(cid)) return;

    out.unshift({ ...c, id: c.id || c.cloudId || c.localId });
    seenByPair.add(keyOf(c));
  });

  return out;
}

/* ✅ CORREGIDO: elimina correctamente del caché */
async function removeFromLocalCache(item) {
  try {
    const raw = await AsyncStorage.getItem(ANIMALS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];

    const filtered = arr.filter((x) => {
      const matchCloud = item.cloudId && x.cloudId === item.cloudId;
      const matchId = item.id && x.id === item.id;
      const matchLocal = item.localId && x.localId === item.localId;
      return !(matchCloud || matchId || matchLocal);
    });

    await writeLocalCache(filtered);
  } catch (e) {
    console.log("removeFromLocalCache error:", e);
  }
}

/* ✅ CORREGIDO: elimina el create pendiente de la cola */
async function removeFromQueueForItem(item) {
  try {
    const queue = await readQueue();
    const filtered = queue.filter((q) => {
      const p = q.payload || {};
      const matchCloud = item.cloudId && p.cloudId === item.cloudId;
      const matchLocal = item.localId && q.localId === item.localId;
      const matchId = item.id && q.id === item.id;
      return !(matchCloud || matchLocal || matchId);
    });

    await writeQueue(filtered);
  } catch (e) {
    console.log("removeFromQueueForItem error:", e);
  }
}

export default function PigsListScreen({ navigation, route }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);

  const selectMode = route?.params?.selectMode === true;
  const onPick = route?.params?.onPick;

  useEffect(() => {
    (async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setItems(await readLocalCache());
        setBusy(false);
        return;
      }

      const net = await Network.getNetworkStateAsync();

      if (!net?.isConnected) {
        setItems(await readLocalCache());
        setBusy(false);
        return;
      }

      try {
        const cache = await readLocalCache();
        if (cache.length > 0) setItems(cache);
      } catch {}

      const qRef = query(
        collection(db, "animals"),
        where("uid", "==", uid),
        orderBy("createdAt", "desc")
      );

      const unsub = onSnapshot(
        qRef,
        async (snap) => {
          const arr = [];
          snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
          const cache = await readLocalCache();
          setItems(mergeAnimals(arr, cache));
          setBusy(false);
        },
        async () => {
          setItems(await readLocalCache());
          setBusy(false);
        }
      );

      return () => unsub();
    })();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("animals:changed", async () => {
      setItems(await readLocalCache());
    });
    return () => sub.remove();
  }, []);

  /* ✅ ELIMINAR COMPLETO Y SIN FALLAS */
  const askDelete = useCallback(
    (id) => {
      const item = items.find((it) => String(it.id) === String(id));
      if (!item) return;

      Alert.alert("Eliminar cerda", "¿Deseas eliminar este registro?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const net = await Network.getNetworkStateAsync();

              setItems((prev) => prev.filter((it) => String(it.id) !== String(id)));

              await removeFromLocalCache(item);
              await removeFromQueueForItem(item);

              if (net?.isConnected && !item.offline && item.id) {
                await deleteDoc(doc(db, "animals", item.id));
              }

              DeviceEventEmitter.emit("animals:changed", { type: "delete", id });
            } catch (e) {
              console.log(e);
              Alert.alert("Error", "No se pudo eliminar.");
            }
          },
        },
      ]);
    },
    [items]
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        selectMode && typeof onPick === "function"
          ? (onPick(item), navigation.goBack())
          : navigation.navigate("PigForm", { id: item.id })
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="pig-variant" size={22} color={Colors.green} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            #{item.earTag} • {item.name}
          </Text>
          <Text style={styles.sub}>Estado: {item.status} · Partos: {item.parity ?? 0}</Text>
        </View>

        <TouchableOpacity onPress={() => askDelete(item.id)} style={styles.iconBtn}>
          <MaterialCommunityIcons name="trash-can" size={18} color={Colors.green} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.beige, padding: 12 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Registro de cerdas</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("PigForm")}
        >
          <MaterialCommunityIcons name="plus" size={18} color={Colors.white} />
          <Text style={styles.addText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {busy ? (
        <ActivityIndicator color={Colors.green} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontWeight: "900", fontSize: 18, color: Colors.text },
  addBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: Colors.green,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addText: { color: Colors.white, fontWeight: "900" },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f2e8e8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  name: { fontWeight: "900", color: Colors.text },
  sub: { fontWeight: "700", color: Colors.muted },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.white,
  },
});
