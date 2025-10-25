// src/utils/linkSubaccountLite.js
import { auth, db } from "../../database";
import { collectionGroup, getDocs, query, updateDoc, where, doc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Si existe una subcuenta pendiente con el mismo email, la enlaza:
 * - Coloca uid y pending=false en producers/{ownerUid}/subaccounts/{docId}
 * - Escribe users/{uid} -> { producerUid, role: "subaccount" }
 * Devuelve true si enlazó algo.
 */
export async function linkSubaccountLite() {
  const u = auth.currentUser;
  if (!u?.email) return false;
  const email = u.email.toLowerCase();

  // Buscar subcuentas pendientes por email
  const q = query(collectionGroup(db, "subaccounts"), where("email", "==", email), where("pending", "==", true));
  const snap = await getDocs(q);
  if (snap.empty) return false;

  const d = snap.docs[0];
  const ownerUid = d.ref.parent.parent.id; // producers/{ownerUid}/subaccounts/{docId}

  await updateDoc(d.ref, {
    uid: u.uid,
    pending: false,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "users", u.uid),
    { producerUid: ownerUid, role: "subaccount", updatedAt: serverTimestamp() },
    { merge: true }
  );

  return true;
}
