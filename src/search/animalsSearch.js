// src/search/animalsSearch.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

// ⚠️ Ajusta SOLO si en tu app usas otro nombre de caché
const ANIMALS_CACHE_KEY = "animals_local_cache_v1";

// Normaliza para búsquedas por prefijo ("cer", "cerd", "cerda") y arete
function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lee caché local y lo mapea a un formato uniforme
async function readAnimalsCache() {
  try {
    const raw = await AsyncStorage.getItem(ANIMALS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((x) => ({
      id: x.cloudId || x.localId || `local-${Math.random().toString(36).slice(2, 8)}`,
      earTag: String(x.earTag ?? "").trim(),
      name: String(x.name ?? "").trim(),
      breed: String(x.breed ?? "").trim(),
      status: String(x.status ?? "").trim(),
      notes: String(x.notes ?? "").trim(),
      // guardo un q efímero para filtrar local
      _q: normalize(`${x.earTag} ${x.name} ${x.breed} ${x.status} ${x.notes}`),
    }));
  } catch {
    return [];
  }
}

// 🔎 Búsqueda global de animales (offline + online)
// Devuelve un array de objetos { id, earTag, name, breed, status }
export async function searchAnimalsGlobal(text) {
  const q = normalize(text);
  if (!q) return [];

  // 1) Siempre: buscar en caché local (soporta offline)
  const cache = await readAnimalsCache();
  const localMatches = cache
    .filter((a) => a._q.includes(q) || a.earTag.toLowerCase().startsWith(q))
    .map(({ _q, ...keep }) => keep);

  // 2) Si hay internet: buscar en Firestore por prefijo (uid + q)
  let remoteMatches = [];
  try {
    const net = await Network.getNetworkStateAsync();
    if (net?.isConnected) {
      // IMPORTAMOS AQUÍ para evitar errores de resolución si usas esta función en entornos sin Firebase (tests)
      const { auth, db } = require("../../database");
      const {
        collection,
        query,
        where,
        orderBy,
        startAt,
        endAt,
        limit,
        getDocs,
      } = require("firebase/firestore");

      const uid = auth?.currentUser?.uid;
      if (uid) {
        const qRef = query(
          collection(db, "animals"),
          where("uid", "==", uid),
          orderBy("q"),
          startAt(q),
          endAt(q + "\uf8ff"),
          limit(40)
        );
        const snap = await getDocs(qRef);
        remoteMatches = snap.docs.map((d) => {
          const v = d.data() || {};
          return {
            id: d.id, // 👈 cloud id (abre la ficha directa)
            earTag: String(v.earTag ?? "").trim(),
            name: String(v.name ?? "").trim(),
            breed: String(v.breed ?? "").trim(),
            status: String(v.status ?? "").trim(),
            notes: String(v.notes ?? "").trim(),
          };
        });
      }
    }
  } catch {
    // sin red o sin índice: simplemente nos quedamos con lo local
  }

  // 3) Merge (prioriza remoto cuando exista el mismo id)
  const map = new Map();
  for (const a of localMatches) map.set(String(a.id), a);
  for (const a of remoteMatches) map.set(String(a.id), a);

  // 4) Orden (heurística: por arete y nombre)
  return Array.from(map.values()).sort((a, b) => {
    const A = (a.earTag || a.name || "").toString();
    const B = (b.earTag || b.name || "").toString();
    return A.localeCompare(B, "es");
  });
}
