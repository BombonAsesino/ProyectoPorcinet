// src/scripts/backfillCostsQ.js
import { auth, db } from "../../database";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const buildQ = (cat, note) => normalize(`${cat || ""} ${note || ""}`);
const buildCategoryQ = (cat) => normalize(cat || "");

export async function backfillCostsQ() {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("No hay usuario autenticado");

  const qy = query(collection(db, "costs"), where("uid", "==", uid));
  const snap = await getDocs(qy);

  let updated = 0;
  for (const d of snap.docs) {
    const v = d.data() || {};
    const qVal = buildQ(v.category, v.note);
    const catQ = buildCategoryQ(v.category);

    if (v.q !== qVal || v.categoryQ !== catQ) {
      await updateDoc(doc(db, "costs", d.id), { q: qVal, categoryQ: catQ });
      updated++;
    }
  }
  return updated;
}
