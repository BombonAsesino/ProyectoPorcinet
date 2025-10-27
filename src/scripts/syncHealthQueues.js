// src/scripts/syncHealthQueues.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { auth, db } from "../../database";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const Q_HEALTH = "health_offline_queue_v1";
const Q_WEIGHTS = "weights_offline_queue_v1";

async function read(key) {
  try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function write(key, arr) {
  try { await AsyncStorage.setItem(key, JSON.stringify(arr)); } catch {}
}

export async function syncHealthQueues() {
  const net = await Network.getNetworkStateAsync();
  if (!net?.isConnected) return;

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  // Pesos
  let weights = await read(Q_WEIGHTS);
  if (weights.length) {
    const next = [];
    for (const it of weights) {
      try {
        const { animalId, payload } = it;
        await addDoc(collection(db, "animals", animalId, "weights"), {
          ...payload,
          uid,
          date: new Date(payload.date),
          createdAt: serverTimestamp(),
        });
      } catch {
        next.push(it); // queda para otra ronda
      }
    }
    await write(Q_WEIGHTS, next);
  }

  // Salud
  let health = await read(Q_HEALTH);
  if (health.length) {
    const next = [];
    for (const it of health) {
      try {
        const { animalId, payload } = it;
        await addDoc(collection(db, "animals", animalId, "health"), {
          ...payload,
          uid,
          date: new Date(payload.date),
          createdAt: serverTimestamp(),
        });
      } catch {
        next.push(it);
      }
    }
    await write(Q_HEALTH, next);
  }
}
