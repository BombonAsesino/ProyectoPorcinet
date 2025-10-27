// src/scripts/backfillPigsQ.js
import { auth, db } from "../../database";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")        // quita # y símbolos (#78 -> 78)
    .replace(/\s+/g, " ")
    .trim();
}

// ⚠️ Esta es tu colección real
const COLLECTION_ANIMALS = "animals";

export async function backfillPigsQ() {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("No hay usuario autenticado");

  const qy = query(collection(db, COLLECTION_ANIMALS), where("uid", "==", uid));
  const snap = await getDocs(qy);

  let count = 0;
  for (const d of snap.docs) {
    const v = d.data() || {};
    const ear = v.earTag != null ? String(v.earTag) : "";
    const name = v.name || "";
    const breed = v.breed || "";
    const status = v.status || "";
    const notes = v.notes || v.notas || "";

    // q incluye arete (con y sin #), nombre, raza, estado, notas
    const qVal = normalize(`${ear} ${name} ${breed} ${status} ${notes}`);

    if (v.q !== qVal) {
      await updateDoc(doc(db, COLLECTION_ANIMALS, d.id), { q: qVal });
      count++;
    }
  }
  return count;
}
