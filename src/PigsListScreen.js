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

// === helpers offline ===
async function readLocalCache() {
  try {
    const raw = await AsyncStorage.getItem(ANIMALS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((x) => ({
      ...x,
      id: x.cloudId || x.localId || `local-${Math.random().toString(36).slice(2, 8)}`,
      offline: !!x.offline,
    }));
  } catch (e) {
    console.log("readLocalCache error:", e);
    return [];
  }
}

async function writeLocalCache(arr) {
  try {
    await AsyncStorage.setItem(ANIMALS_CACHE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.log("writeLocalCache error:", e);
  }
}

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.log("readQueue error:", e);
    return [];
  }
}

async function writeQueue(arr) {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.log("writeQueue error:", e);
  }
}

function mergeAnimals(fsItems, cacheItems) {
  const out = [...fsItems];
  const seenById = new Set(fsItems.map((it) => String(it.id || "")));
  const keyOf = (o) =>
    `${(o.earTag || "").toString()}|${(o.name || "").toString()}`.trim().toLowerCase();
  const seenByPair = new Set(fsItems.map(keyOf));

  cacheItems.forEach((c) => {
    const cid = String(c.cloudId || "");
    const idDup = cid && seenById.has(cid);
    const pairDup = seenByPair.has(keyOf(c));
    if (!idDup && !pairDup) {
      out.unshift({
        ...c,
        id: c.id || c.cloudId || c.localId || `local-${Math.random().toString(36).slice(2, 8)}`,
        offline: !!c.offline,
      });
      seenByPair.add(keyOf(c));
    }
  });

  return out;
}

// elimina del caché local por id/localId o por par (earTag|name)
async function removeFromLocalCache(item) {
  try {
    const raw = await AsyncStorage.getItem(ANIMALS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const keyOf = (o) =>
      `${(o.earTag || "").toString()}|${(o.name || "").toString()}`.trim().toLowerCase();

    const targetId = String(item.id || "");
    const targetLocalId = String(item.localId || "");
    const targetKey = keyOf(item);

    const filtered = arr.filter((x) => {
      const sameId = String(x.cloudId || x.id || "") === targetId;
      const sameLocal = x.localId && String(x.localId) === targetLocalId;
      const samePair = keyOf(x) === targetKey;
      return !(sameId || sameLocal || samePair);
    });

    await writeLocalCache(filtered);
  } catch (e) {
    console.log("removeFromLocalCache error:", e);
  }
}

// elimina de la cola offline las entradas "create" que correspondan a ese item
async function removeFromQueueForItem(item) {
  try {
    const queue = await readQueue();
    const keyOf = (o) =>
      `${(o.earTag || "").toString()}|${(o.name || "").toString()}`.trim().toLowerCase();
    const targetKey = keyOf(item);
    const targetLocalId = String(item.localId || "");

    const filtered = queue.filter((q) => {
      if (q.action !== "create") return true; // dejamos updates
      const p = q.payload || {};
      const qKey = keyOf(p);
      const qLocalId = String(q.localId || "");
      const matches = qKey === targetKey || (targetLocalId && qLocalId === targetLocalId);
      return !matches;
    });

    await writeQueue(filtered);
  } catch (e) {
    console.log("removeFromQueueForItem error:", e);
  }
}

export default function PigsListScreen({ navigation, route }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);

  const selectMode = route?.params?.selectMode === true; // opcional
  const onPick = route?.params?.onPick; // opcional

  useEffect(() => {
    (async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        // sin usuario → al menos muestra caché
        const cacheOnly = await readLocalCache();
        setItems(cacheOnly);
        setBusy(false);
        return;
      }

      const net = await Network.getNetworkStateAsync();

      if (!net?.isConnected) {
        // SIN INTERNET → solo caché local
        const cache = await readLocalCache();
        setItems(cache);
        setBusy(false);
        return;
      }

      // ✅ CON INTERNET → precarga caché para no ver vacío
      try {
        const cache = await readLocalCache();
        if (cache.length > 0) {
          setItems(cache);
          setBusy(false);
        }
      } catch {}

      // Firestore + caché (puede requerir índice compuesto uid+createdAt)
      const qRef = query(
        collection(db, "animals"),
        where("uid", "==", uid),
        orderBy("createdAt", "desc")
      );

      const off = onSnapshot(
        qRef,
        async (snap) => {
          const arr = [];
          snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
          const cache = await readLocalCache();
          const merged = mergeAnimals(arr, cache);
          setItems(merged);
          setBusy(false);
        },
        async (err) => {
          // ❗️Fallo (p.ej. índice no creado): muestro caché como fallback
          console.log("onSnapshot animals error:", err?.message || err);
          const cache = await readLocalCache();
          setItems(cache);
          setBusy(false);
          // Opcional: Alert.alert("Aviso", "Mostrando datos locales mientras se prepara la nube.");
        }
      );

      return () => off();
    })();
  }, []);

  // escuchar altas offline desde el form
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("animals:changed", async (evt) => {
      if (evt?.type === "offline-add") {
        const net = await Network.getNetworkStateAsync();
        const cache = await readLocalCache();

        if (!net?.isConnected) {
          setItems(cache);
          return;
        }

        setItems((prev) => {
          const fsOnly = prev.filter((x) => !x.offline);
          return mergeAnimals(fsOnly, cache);
        });
      }
    });
    return () => sub.remove();
  }, []);

  // ✅ Eliminar: si offline → borra de caché/cola y de UI; si online → Firestore
  const askDelete = useCallback((id) => {
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

            // 1) Remover de UI instantáneo
            setItems((prev) => prev.filter((it) => String(it.id) !== String(id)));

            if (!net?.isConnected || item.offline) {
              // ✅ OFFLINE (o ítem local): limpiar caché y cola
              await removeFromLocalCache(item);
              await removeFromQueueForItem(item);
              return;
            }

            // 2) ONLINE + item Firestore → borrar en Firestore
            await deleteDoc(doc(db, "animals", id));
            // onSnapshot ajustará el estado real si hubiera algún desfasaje
          } catch (e) {
            console.log(e);
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  }, [items]);

  const renderItem = ({ item }) => {
    const birth =
      item.birthDate?.toDate
        ? item.birthDate.toDate()
        : (item.birthDate ? new Date(item.birthDate) : null);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => {
          if (selectMode && typeof onPick === "function") {
            onPick({ id: item.id, earTag: item.earTag, name: item.name });
            navigation.goBack();
          } else {
            navigation.navigate("PigForm", { id: item.id });
          }
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="pig-variant" size={22} color={Colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {item.earTag ? `#${item.earTag}` : "Sin arete"} • {item.name || "Cerda"}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              Estado: {item.status || "activa"} · Partos: {item.parity ?? 0}
            </Text>
            {birth && (
              <Text style={styles.sub}>
                Nac.: {birth.toLocaleDateString("es-ES")}
              </Text>
            )}
          </View>

          {/* Botón de eliminar */}
          <TouchableOpacity
            onPress={() => askDelete(item.id)}
            style={styles.iconBtn}
            accessibilityLabel="Eliminar cerda"
          >
            <MaterialCommunityIcons name="trash-can" size={18} color={Colors.green} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

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
        <ActivityIndicator color={Colors.green} style={{ marginTop: 12 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id || it.localId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text style={{ color: Colors.muted, fontWeight: "700" }}>
              Aún no tienes cerdas registradas.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontWeight: "900", color: Colors.text, fontSize: 18 },
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
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f2e8e8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { color: Colors.text, fontWeight: "900" },
  sub: { color: Colors.muted, fontWeight: "700" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
});
