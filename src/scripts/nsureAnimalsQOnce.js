// src/scripts/ensureAnimalsQOnce.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../../database";
import {
  collection, collectionGroup, query, where, getDocs, updateDoc
} from "firebase/firestore";

const FLAG_KEY = "animals_q_backfilled_v1";

const normalize = (t = "") =>
  String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();

export async function ensureAnimalsQOnce() {
  try {
    const done = await AsyncStorage.getItem(FLAG_KEY);
    if (done === "1") return;

    const uid = auth?.currentUser?.uid;
    if (!uid) return;

    async function backfillCol(colName) {
      const snap = await getDocs(query(collection(db, colName), where("uid", "==", uid)));
      for (const d of snap.docs) {
        const v = d.data() || {};
        const earTag = v.earTag ?? v.identificador ?? v.arete ?? "";
        const name   = v.name   ?? v.nombre ?? "";
        const breed  = v.breed  ?? v.raza ?? "";
        const status = v.status ?? v.estado ?? "";
        const notes  = v.notes  ?? v.notas ?? "";
        const qVal = normalize(`${earTag} ${name} ${breed} ${status} ${notes}`);
        if (v.q !== qVal || v.uid !== uid) {
          await updateDoc(d.ref, { q: qVal, uid });
        }
      }
    }

    // raíz animals y pigs (si lo usaste)
    try { await backfillCol("animals"); } catch {}
    try { await backfillCol("pigs"); } catch {}

    // subcolecciones "animals" (si guardaste dentro de users/…/animals)
    try {
      const snap = await getDocs(query(collectionGroup(db, "animals"), where("uid", "==", uid)));
      for (const d of snap.docs) {
        const v = d.data() || {};
        const earTag = v.earTag ?? v.identificador ?? v.arete ?? "";
        const name   = v.name   ?? v.nombre ?? "";
        const breed  = v.breed  ?? v.raza ?? "";
        const status = v.status ?? v.estado ?? "";
        const notes  = v.notes  ?? v.notas ?? "";
        const qVal = normalize(`${earTag} ${name} ${breed} ${status} ${notes}`);
        if (v.q !== qVal || v.uid !== uid) {
          await updateDoc(d.ref, { q: qVal, uid });
        }
      }
    } catch {}

    await AsyncStorage.setItem(FLAG_KEY, "1");
  } catch {}
}
