// src/utils/permissions.js
// Guarda/actualiza permisos de subcuentas en RTDB para que HomeApp oculte/permita módulos.

import { realtimeDb } from "../../database";
import { ref, set, update } from "firebase/database";

/**
 * Convierte el objeto de permisos del formulario a un array de etiquetas.
 * { reproduccion:true, costos:false, analytics:true, cerdas:true, respaldo:false }
 * -> ["reproduccion","analytics","cerdas"]
 */
function mapPermsObjToArray(permsObj = {}) {
  const out = [];
  if (permsObj.reproduccion) out.push("reproduccion");
  if (permsObj.costos) out.push("costos");
  if (permsObj.analytics) out.push("analytics");
  if (permsObj.cerdas) out.push("cerdas");
  if (permsObj.respaldo) out.push("respaldo");
  return out;
}

/** Escribe los permisos de una subcuenta recién creada */
export async function saveSubaccountPerms(subUid, permsObj) {
  const modules = mapPermsObjToArray(permsObj);
  await set(ref(realtimeDb, `userPerms/${subUid}`), {
    modules,
    updatedAt: Date.now(),
  });
}

/** Actualiza los permisos de una subcuenta existente */
export async function updateSubaccountPerms(subUid, permsObj) {
  const modules = mapPermsObjToArray(permsObj);
  await update(ref(realtimeDb, `userPerms/${subUid}`), {
    modules,
    updatedAt: Date.now(),
  });
}
