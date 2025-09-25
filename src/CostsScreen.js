// src/CostsScreen.js


import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

/* ====== Estilos/colores ====== */
const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
  ok: "#843a3a",
  bad: "#843a3a",
};



/* ====== Dominios ====== */
const CATEGORIES = ["Alimentación", "Salud", "Mantenimiento"];

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/* =====================================================================================
   PANTALLA: Gestión de costos y gastos
   - Crear/editar/eliminar gastos (Alimentación/Salud/Mantenimiento)
   - Reporte mensual + validación de cálculos
   - Carga por mes actual (con navegación de meses)
===================================================================================== */
export function CostsScreen() {
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimentación");
  const [note, setNote] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // edición
  const [editingId, setEditingId] = useState(null);

  const monthKey = getMonthKey(currentMonth);

  // ====== Cargar gastos del mes ======
  const fetchExpenses = useCallback(async () => {
    try {
      const u = auth.currentUser;
      if (!u) return;

      const q = query(
  collection(db, "costs"),
  where("uid", "==", u.uid),
  where("monthKey", "==", monthKey)
);

      const snap = await getDocs(q);
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      // ordenar por fecha descendente en cliente (evita índice compuesto)
      arr.sort((a, b) => {
        const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const dbb = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return dbb - da;
      });
      setExpenses(arr);
    } catch (e) {
      console.error("Error load expenses", e);
    }
  }, [monthKey]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // ====== Guardar (crear o actualizar) ======
 const saveExpense = async () => {
  const u = auth.currentUser;
  if (!u) return Alert.alert("Sesión", "Debes iniciar sesión.");

  const amt = parseFloat(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return Alert.alert("Error", "Monto inválido.");
  }
  if (!CATEGORIES.includes(category)) {
    return Alert.alert("Error", "Categoría inválida.");
  }

  try {
    if (editingId) {
      // 👉 editar AHORA en la colección 'costs'
      await updateDoc(doc(db, "costs", editingId), {
        amount: amt,
        category,
        note: note.trim(),
        updatedAt: serverTimestamp(),
      });
      Alert.alert("Actualizado", "Gasto editado correctamente.");
    } else {
      // 👉 crear en 'costs' asegurando uid, date y monthKey
      await addDoc(collection(db, "costs"), {
        uid: u.uid,
        amount: amt,
        category,
        note: note.trim(),
        date: new Date(),
        monthKey,
        createdAt: serverTimestamp(),
        updatedAt: null,
      });
      Alert.alert("Guardado", "Gasto registrado.");
    }

    // limpiar y refrescar
    setAmount("");
    setNote("");
    setCategory("Alimentación");
    setEditingId(null);
    fetchExpenses();
  } catch (e) {
    console.error("saveExpense", e);
    Alert.alert("Error", "No se pudo guardar el gasto.");
  }
};


  // ====== Eliminar ======
  const deleteExpense = async (id) => {
  const u = auth.currentUser;
  if (!u) return;

  Alert.alert("Eliminar", "¿Deseas eliminar este gasto?", [
    { text: "Cancelar", style: "cancel" },
    {
      text: "Eliminar",
      style: "destructive",
      onPress: async () => {
        try {
          // 👉 eliminar AHORA en 'costs'
          await deleteDoc(doc(db, "costs", id));

          if (editingId === id) {
            setEditingId(null);
            setAmount("");
            setNote("");
            setCategory("Alimentación");
          }
          fetchExpenses();
        } catch (e) {
          console.error("deleteExpense", e);
          Alert.alert("Error", "No se pudo eliminar el gasto.");
        }
      },
    },
  ]);
};


  // ====== Preparar edición ======
  const startEdit = (item) => {
    setEditingId(item.id);
    setAmount(String(item.amount ?? ""));
    setCategory(item.category || "Alimentación");
    setNote(item.note || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount("");
    setNote("");
    setCategory("Alimentación");
  };

  // ====== Cálculos ======
  const { totals, totalGeneral } = useMemo(() => {
    const t = { Alimentación: 0, Salud: 0, Mantenimiento: 0 };
    let total = 0;
    expenses.forEach((e) => {
      if (t[e.category] !== undefined) {
        t[e.category] += e.amount;
        total += e.amount;
      }
    });
    return { totals: t, totalGeneral: total };
  }, [expenses]);

  const validationOk =
    Math.round(
      totals["Alimentación"] + totals["Salud"] + totals["Mantenimiento"]
    ) === Math.round(totalGeneral);

  // ====== Cambio de mes ======
  const prevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
  };
  const nextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
  };

  // ====== UI ======
  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.beige }}>
      {/* Header mes */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentMonth.toLocaleString("es-ES", { month: "long", year: "numeric" })}
        </Text>
        <TouchableOpacity onPress={nextMonth}>
          <MaterialCommunityIcons name="chevron-right" size={28} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Formulario */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>
          {editingId ? "Editar gasto" : "Registrar gasto"}
        </Text>

        <TextInput
          placeholder="Monto"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
        />
        <TextInput
          placeholder="Nota (opcional)"
          value={note}
          onChangeText={setNote}
          style={styles.input}
        />

        <View style={{ flexDirection: "row", gap: 8 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.catBtn, category === c && { backgroundColor: Colors.green }]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.catText, category === c && { color: Colors.white }]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={saveExpense}>
            <MaterialCommunityIcons
              name={editingId ? "content-save-edit" : "content-save"}
              size={20}
              color={Colors.white}
            />
            <Text style={styles.saveText}>{editingId ? "Guardar cambios" : "Guardar gasto"}</Text>
          </TouchableOpacity>

          {editingId ? (
            <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={cancelEdit}>
              <MaterialCommunityIcons name="close-circle" size={20} color={Colors.bad} />
              <Text style={[styles.saveText, { color: Colors.bad }]}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Reporte mensual */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Reporte mensual</Text>
        {CATEGORIES.map((c) => (
          <View key={c} style={styles.row}>
            <Text style={styles.label}>{c}</Text>
            <Text style={styles.value}>C$ {totals[c].toFixed(2)}</Text>
          </View>
        ))}
        <View style={[styles.row, { borderTopWidth: 1, borderColor: Colors.border, paddingTop: 6 }]}>
          <Text style={[styles.label, { fontWeight: "900" }]}>TOTAL</Text>
          <Text style={[styles.value, { fontWeight: "900" }]}>C$ {totalGeneral.toFixed(2)}</Text>
        </View>

        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons
            name={validationOk ? "check-circle" : "close-circle"}
            size={20}
            color={validationOk ? Colors.ok : Colors.bad}
          />
          <Text style={{ color: validationOk ? Colors.ok : Colors.bad, fontWeight: "700" }}>
            {validationOk ? "Validación OK" : "Error en los cálculos"}
          </Text>
        </View>
      </View>

      {/* Listado del mes */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Gastos del mes</Text>
        {expenses.length === 0 ? (
          <Text style={{ color: Colors.muted, fontWeight: "700" }}>No hay registros.</Text>
        ) : (
          expenses.map((it) => {
            const d = it.date?.toDate ? it.date.toDate() : (it.date ? new Date(it.date) : null);
            return (
              <View key={it.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: Colors.text }}>
                    {it.category} · C$ {Number(it.amount).toFixed(2)}
                  </Text>
                  {!!it.note && (
                    <Text style={{ color: Colors.muted, fontWeight: "700" }} numberOfLines={1}>
                      {it.note}
                    </Text>
                  )}
                  {d && (
                    <Text style={{ color: Colors.muted, fontSize: 12 }}>
                      {d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                    </Text>
                  )}
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => startEdit(it)} accessibilityLabel="Editar">
                    <MaterialCommunityIcons name="pencil" size={20} color={Colors.green} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => deleteExpense(it.id)} accessibilityLabel="Eliminar">
                    <MaterialCommunityIcons name="trash-can" size={20} color={Colors.bad} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

/* =======================
   Estilos
======================= */
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#843a3a",
    padding: 12,
  },
  headerTitle: { color: Colors.white, fontWeight: "800", fontSize: 16 },

  panel: {
    backgroundColor: Colors.white,
    margin: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#843a3a",
    gap: 10,
  },
  panelTitle: { fontWeight: "900", fontSize: 15, color: Colors.text },

  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    color: Colors.text,
    fontWeight: "700",
  },

  catBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.green,
    alignItems: "center",
  },
  catText: { fontWeight: "800", color: Colors.green },

  saveBtn: {
    marginTop: 6,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  cancelBtn: {
    marginTop: 6,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.bad,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  saveText: { color: Colors.white, fontWeight: "900" },

  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontWeight: "700", color: Colors.text },
  value: { fontWeight: "700", color: Colors.text },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
});

/* =====================================================================================
   CONEXIÓN PARA RESPALDO / RESTAURACIÓN (usada desde BackupApp.js)
   - getExpensesForBackup(uid): lee TODOS los gastos del productor (todas las fechas)
   - restoreExpensesFromBackup(uid, items): inserta los gastos del respaldo
===================================================================================== */

// Lee todos los gastos del usuario (para armar el payload del respaldo)
export async function getExpensesForBackup(uid) {
  if (!uid) return [];
  const out = [];
  const q = query(collection(db, "producers", uid, "expenses"));
  const snap = await getDocs(q);
  snap.forEach((d) => {
    const data = d.data();
    // Serializamos fechas a ISO para que el backup sea 100% JSON
    const dateISO =
      data.date?.toDate ? data.date.toDate().toISOString() : (data.date || null);
    out.push({
      id: d.id,
      amount: Number(data.amount || 0),
      category: data.category || "Alimentación",
      note: data.note || "",
      monthKey: data.monthKey || (dateISO ? getMonthKey(new Date(dateISO)) : null),
      date: dateISO,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : null,
      updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : null,
    });
  });
  return out;
}

// Inserta de vuelta los gastos desde un backup (no borra existentes)
export async function restoreExpensesFromBackup(uid, items = []) {
  if (!uid || !Array.isArray(items)) return;
  for (const it of items) {
    const date = it.date ? new Date(it.date) : new Date();
    const mk = it.monthKey || getMonthKey(date);
    await addDoc(collection(db, "producers", uid, "expenses"), {
      amount: Number(it.amount || 0),
      category: it.category || "Alimentación",
      note: it.note || "",
      date,
      monthKey: mk,
      // No restauramos createdAt/updatedAt originales para evitar errores de seguridad.
      createdAt: serverTimestamp(),
    });
  }
}
