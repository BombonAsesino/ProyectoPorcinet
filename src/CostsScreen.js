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
  Image,
  Modal,
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

/* ✅ Offline */
import { initDB, run, all } from "./db/database"; // <-- Asegura esta ruta
import * as Network from "expo-network";
import { useIsFocused } from "@react-navigation/native";

/* ✅ Fotos */
import * as ImagePicker from "expo-image-picker";

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
const toYYYYMMDD = (d) => d.toISOString().slice(0, 10);
const normalizeDateStr = (val) => {
  if (!val) return toYYYYMMDD(new Date());
  if (val?.toDate) return toYYYYMMDD(val.toDate());
  if (typeof val === "object" && val.seconds != null) {
    return toYYYYMMDD(new Date(val.seconds * 1000));
  }
  try {
    return toYYYYMMDD(new Date(val));
  } catch {
    return toYYYYMMDD(new Date());
  }
};

/* 🔧 Helpers de fecha */
function toDateFromISOorYMD(s) {
  try {
    if (!s) return new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
    return new Date(s);
  } catch {
    return new Date();
  }
}
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const daysInMonth = (y, m /* 0-11 */) => new Date(y, m + 1, 0).getDate();

/* ====== Esquema local ====== */
const ensureCostSchema = async () => {
  await initDB();
  await run(
    "CREATE TABLE IF NOT EXISTS costs (id INTEGER PRIMARY KEY AUTOINCREMENT, concept TEXT, category TEXT, amount REAL, date TEXT, notes TEXT, deleted INTEGER DEFAULT 0, updated_at TEXT);"
  );
  try {
    await run("ALTER TABLE costs ADD COLUMN cloud_id TEXT");
  } catch {}
  try {
    await run("ALTER TABLE costs ADD COLUMN synced INTEGER DEFAULT 0");
  } catch {}
  try {
    await run("ALTER TABLE costs ADD COLUMN month_key TEXT");
  } catch {}
  try {
    await run("ALTER TABLE costs ADD COLUMN photo_uri TEXT");
  } catch {}
  await run(
    "UPDATE costs SET month_key = substr(date,1,7) WHERE month_key IS NULL OR month_key=''"
  );
  await run(
    "CREATE TABLE IF NOT EXISTS pending_ops (id INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL, target_id TEXT NOT NULL, payload TEXT, created_at TEXT DEFAULT (datetime('now')));"
  );
  await run("CREATE INDEX IF NOT EXISTS idx_pending_ops_op ON pending_ops(op)");
  await run(
    "CREATE INDEX IF NOT EXISTS idx_pending_ops_target ON pending_ops(target_id)"
  );
};

export function CostsScreen({ navigation }) {   // ⬅️ AQUÍ recibe navigation
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimentación");
  const [note, setNote] = useState("");
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date())); // ✅ anclado al 1
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  /* ✅ Foto ligada al gasto */
  const [imageUri, setImageUri] = useState(null);

  /* ✅ Vista previa grande */
  const [previewUri, setPreviewUri] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const monthKey = getMonthKey(currentMonth);

  /* ====== Cargar gastos del mes (Offline-First) ====== */
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      await ensureCostSchema();

      // No mostrar elementos en cola de borrado remoto
      const pendDel = await all(
        "SELECT target_id FROM pending_ops WHERE op='delete'",
        []
      );
      const pendingDeleteIds = new Set(pendDel.map((r) => r.target_id));

      // 1) Local primero
      const localRows = await all(
        `SELECT id, category, amount, notes AS note, date, cloud_id, photo_uri
           FROM costs
          WHERE deleted=0 AND date LIKE ?
          ORDER BY date DESC, id DESC`,
        [`${monthKey}-%`]
      );

      const locals = localRows.map((r) => {
        const cloudIdNorm = (r.cloud_id ?? "").trim();
        return {
          id: `local:${r.id}`,
          amount: Number(r.amount || 0),
          category: r.category || "Alimentación",
          note: r.note || "",
          dateStr: normalizeDateStr(r.date),
          cloud_id: cloudIdNorm.length ? cloudIdNorm : null,
          photoUri: r.photo_uri || null,
        };
      });

      const byKey = new Map();
      for (const l of locals) {
        const key = l.cloud_id || l.id; // local manda
        byKey.set(key, l);
      }

      // 2) Remoto
      try {
        const u = auth.currentUser;
        if (u) {
          const qy = query(
            collection(db, "costs"),
            where("uid", "==", u.uid),
            where("monthKey", "==", monthKey)
          );
          const snap = await getDocs(qy);
          snap.forEach((d) => {
            if (pendingDeleteIds.has(d.id)) return;
            const key = d.id;
            if (byKey.has(key)) return;

            const data = d.data();
            byKey.set(key, {
              id: d.id,
              amount: Number(data.amount || 0),
              category: data.category || "Alimentación",
              note: data.note || "",
              dateStr: normalizeDateStr(data.date),
              cloud_id: d.id,
              photoUri: data.photoUri || null, // 🔹 campo que también usa el backup
            });
          });
        }
      } catch {
        // sin red: solo locales
      }

      const merged = Array.from(byKey.values()).sort(
        (a, b) => new Date(b.dateStr) - new Date(a.dateStr)
      );

      setExpenses(merged);
    } catch (e) {
      console.error("Error load expenses", e);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);
  useEffect(() => {
    if (isFocused) fetchExpenses();
  }, [isFocused, fetchExpenses]);

  /* ====== Selector de imagen ====== */
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permisos", "Se requiere permiso para acceder a la galería.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error("pickImage", e);
      Alert.alert("Error", "No se pudo abrir la galería.");
    }
  };

  const openPreview = (uri) => {
    if (!uri) return;
    setPreviewUri(uri);
    setPreviewVisible(true);
  };

  /* ====== Guardar (crear o actualizar) ====== */
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
      await ensureCostSchema();
      const net = await Network.getNetworkStateAsync();

      // ✅ FECHA BASE SIEMPRE EN EL MES MOSTRADO (día = hoy, con clamp al fin de mes)
      const today = new Date();
      const y = currentMonth.getFullYear();
      const m = currentMonth.getMonth();
      const maxDay = daysInMonth(y, m);
      const day = Math.min(today.getDate(), maxDay);
      const baseDate = new Date(y, m, day);
      const baseStr = toYYYYMMDD(baseDate);

      // preservamos fecha en edición
      const currentItem = editingId ? expenses.find((e) => e.id === editingId) : null;
      const dateStr =
        editingId && currentItem?.dateStr ? currentItem.dateStr : baseStr;

      if (editingId) {
        // Editar
        if (editingId.startsWith("local:")) {
          const localId = editingId.split(":")[1];
          await run(
            `UPDATE costs
               SET category=?,
                   amount=?,
                   notes=?,
                   photo_uri=?,
                   date=?,
                   month_key=?,
                   updated_at=datetime('now'),
                   synced=0
             WHERE id=?`,
            [
              category,
              amt,
              note.trim(),
              imageUri || null,
              dateStr,
              getMonthKey(new Date(dateStr)),
              localId,
            ]
          );
          setExpenses((prev) =>
            prev.map((e) =>
              e.id === editingId
                ? {
                    ...e,
                    amount: amt,
                    category,
                    note,
                    dateStr,
                    photoUri: imageUri || null,
                  }
                : e
            )
          );
          Alert.alert("Actualizado", "Gasto actualizado localmente.");
        } else {
          if (net.isConnected) {
            await updateDoc(doc(db, "costs", editingId), {
              amount: amt,
              category,
              note: note.trim(),
              date: new Date(dateStr),
              monthKey: getMonthKey(new Date(dateStr)),
              updatedAt: serverTimestamp(),
              photoUri: imageUri || null, // 🔹 también en Firestore
            });
            await run(
              `UPDATE costs
                 SET category=?,
                     amount=?,
                     notes=?,
                     photo_uri=?,
                     date=?,
                     month_key=?,
                     synced=1,
                     updated_at=datetime('now')
               WHERE cloud_id=?`,
              [
                category,
                amt,
                note.trim(),
                imageUri || null,
                dateStr,
                getMonthKey(new Date(dateStr)),
                editingId,
              ]
            );
            setExpenses((prev) =>
              prev.map((e) =>
                e.id === editingId
                  ? {
                      ...e,
                      amount: amt,
                      category,
                      note,
                      dateStr,
                      photoUri: imageUri || null,
                    }
                  : e
              )
            );
            Alert.alert("Actualizado", "Gasto editado correctamente.");
          } else {
            // OFFLINE: espejo local con cloud_id y synced=0
            const mirror = await all(
              `SELECT id FROM costs WHERE cloud_id=? LIMIT 1`,
              [editingId]
            );
            if (mirror.length) {
              await run(
                `UPDATE costs
                   SET category=?,
                       amount=?,
                       notes=?,
                       photo_uri=?,
                       date=?,
                       month_key=?,
                       synced=0,
                       updated_at=datetime('now')
                 WHERE cloud_id=?`,
                [
                  category,
                  amt,
                  note.trim(),
                  imageUri || null,
                  dateStr,
                  getMonthKey(new Date(dateStr)),
                  editingId,
                ]
              );
            } else {
              await run(
                `INSERT INTO costs
                   (concept, category, amount, date, notes, photo_uri, deleted, updated_at, synced, cloud_id, month_key)
                 VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), 0, ?, ?)`,
                [
                  category,
                  category,
                  amt,
                  dateStr,
                  note.trim(),
                  imageUri || null,
                  editingId,
                  getMonthKey(new Date(dateStr)),
                ]
              );
            }
            setExpenses((prev) =>
              prev.map((e) =>
                e.id === editingId
                  ? {
                      ...e,
                      amount: amt,
                      category,
                      note,
                      dateStr,
                      photoUri: imageUri || null,
                    }
                  : e
              )
            );
            Alert.alert("Guardado", "Cambios guardados localmente (offline).");
          }
        }
      } else {
        // Crear
        if (net.isConnected) {
          const ref = await addDoc(collection(db, "costs"), {
            uid: u.uid,
            amount: amt,
            category,
            note: note.trim(),
            date: baseDate, // ✅ mes mostrado (clamp día)
            monthKey: getMonthKey(baseDate), // ✅ mes mostrado
            createdAt: serverTimestamp(),
            updatedAt: null,
            photoUri: imageUri || null, // 🔹 se guarda en Firestore
          });
          await run(
            `INSERT INTO costs
               (concept, category, amount, date, notes, photo_uri, deleted, updated_at, synced, cloud_id, month_key)
             VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), 1, ?, ?)`,
            [
              category,
              category,
              amt,
              baseStr,
              note.trim(),
              imageUri || null,
              ref.id,
              getMonthKey(baseDate),
            ]
          );
          Alert.alert("Guardado", "Gasto registrado.");
        } else {
          await run(
            `INSERT INTO costs
               (concept, category, amount, date, notes, photo_uri, deleted, updated_at, synced, cloud_id, month_key)
             VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), 0, NULL, ?)`,
            [
              category,
              category,
              amt,
              baseStr,
              note.trim(),
              imageUri || null,
              getMonthKey(baseDate),
            ]
          );
          Alert.alert("Guardado", "Gasto guardado localmente (offline).");
        }
        await fetchExpenses();
      }

      setAmount("");
      setNote("");
      setCategory("Alimentación");
      setEditingId(null);
      setImageUri(null);
    } catch (e) {
      console.error("saveExpense", e);
      Alert.alert("Error", "No se pudo guardar el gasto.");
    }
  };

  /* ====== Eliminar ====== */
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
            await ensureCostSchema();
            const net = await Network.getNetworkStateAsync();

            if (id.startsWith("local:")) {
              const localId = id.split(":")[1];
              await run(
                `UPDATE costs SET deleted=1, updated_at=datetime('now') WHERE id=?`,
                [localId]
              );

              const row = await all(
                "SELECT cloud_id FROM costs WHERE id=?",
                [localId]
              );
              const cloudId = (row?.[0]?.cloud_id ?? "").trim();
              if (cloudId) {
                if (net.isConnected) {
                  try {
                    await deleteDoc(doc(db, "costs", cloudId));
                  } catch {
                    await run(
                      "INSERT INTO pending_ops(op, target_id) VALUES('delete', ?)",
                      [cloudId]
                    );
                  }
                } else {
                  await run(
                    "INSERT INTO pending_ops(op, target_id) VALUES('delete', ?)",
                    [cloudId]
                  );
                }
              }
            } else {
              await run(
                `UPDATE costs SET deleted=1, updated_at=datetime('now') WHERE cloud_id=?`,
                [id]
              );
              if (net.isConnected) {
                try {
                  await deleteDoc(doc(db, "costs", id));
                } catch {
                  await run(
                    "INSERT INTO pending_ops(op, target_id) VALUES('delete', ?)",
                    [id]
                  );
                }
              } else {
                await run(
                  "INSERT INTO pending_ops(op, target_id) VALUES('delete', ?)",
                  [id]
                );
              }
            }

            setExpenses((prev) =>
              prev.filter((e) => e.id !== id && e.cloud_id !== id)
            );
            Alert.alert("Eliminado", "Gasto eliminado.");
          } catch (e) {
            console.error("deleteExpense", e);
            Alert.alert("Error", "No se pudo eliminar el gasto.");
          }
        },
      },
    ]);
  };

  /* ====== Preparar edición ====== */
  const startEdit = (item) => {
    setEditingId(item.id);
    setAmount(String(item.amount ?? ""));
    setCategory(item.category || "Alimentación");
    setNote(item.note || "");
    setImageUri(item.photoUri || null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount("");
    setNote("");
    setCategory("Alimentación");
    setImageUri(null);
  };

  /* 🔁 Sincronizar locales al volver la conexión (creaciones + ediciones) */
  const syncPendingLocals = async () => {
    const u = auth.currentUser;
    if (!u) return;

    try {
      await ensureCostSchema();
      const net = await Network.getNetworkStateAsync();
      if (!net.isConnected) return;

      // 1) Subir todos los registros creados offline (synced=0, cloud_id IS NULL)
      const newRows = await all(
        `SELECT id, category, amount, notes, date, month_key, photo_uri
           FROM costs
          WHERE deleted=0 AND synced=0 AND (cloud_id IS NULL OR cloud_id='')`
      );

      for (const r of newRows) {
        const dateObj = toDateFromISOorYMD(r.date);
        const mk = r.month_key || getMonthKey(dateObj);

        const ref = await addDoc(collection(db, "costs"), {
          uid: u.uid,
          amount: Number(r.amount || 0),
          category: r.category || "Alimentación",
          note: r.notes || "",
          date: dateObj,
          monthKey: mk,
          createdAt: serverTimestamp(),
          updatedAt: null,
          photoUri: r.photo_uri || null, // 🔹 se sube la foto también
        });

        await run(
          `UPDATE costs SET synced=1, cloud_id=?, updated_at=datetime('now') WHERE id=?`,
          [ref.id, r.id]
        );
      }

      // 2) Enviar EDICIONES offline (synced=0, cloud_id NOT NULL)
      const updRows = await all(
        `SELECT id, cloud_id, category, amount, notes, date, month_key, photo_uri
           FROM costs
          WHERE deleted=0 AND synced=0 AND cloud_id IS NOT NULL AND cloud_id <> ''`
      );

      for (const r of updRows) {
        const dateObj = toDateFromISOorYMD(r.date);
        const mk = r.month_key || getMonthKey(dateObj);

        await updateDoc(doc(db, "costs", (r.cloud_id ?? "").trim()), {
          amount: Number(r.amount || 0),
          category: r.category || "Alimentación",
          note: r.notes || "",
          date: dateObj,
          monthKey: mk,
          updatedAt: serverTimestamp(),
          photoUri: r.photo_uri || null, // 🔹 se sincroniza también en ediciones
        });

        await run(
          `UPDATE costs SET synced=1, updated_at=datetime('now') WHERE id=?`,
          [r.id]
        );
      }

      // 3) Procesar pendientes de eliminación
      const pendDel = await all(
        "SELECT id, target_id FROM pending_ops WHERE op='delete'"
      );
      for (const pd of pendDel) {
        try {
          await deleteDoc(doc(db, "costs", pd.target_id));
          await run("DELETE FROM pending_ops WHERE id=?", [pd.id]);
        } catch {
          // si falla, queda para el siguiente respaldo
        }
      }

      await fetchExpenses();
    } catch (e) {
      console.error("syncPendingLocals", e);
    }
  };

  /* 🔁 Auto-sync cuando vuelves a la pantalla y hay internet */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const net = await Network.getNetworkStateAsync();
        if (mounted && net.isConnected) {
          await syncPendingLocals();
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [isFocused]);

  /* ====== Cálculos ====== */
  const { totals, totalGeneral } = useMemo(() => {
    const t = { Alimentación: 0, Salud: 0, Mantenimiento: 0 };
    let total = 0;
    expenses.forEach((e) => {
      if (t[e.category] !== undefined) {
        const v = Number(e.amount || 0);
        t[e.category] += v;
        total += v;
      }
    });
    return { totals: t, totalGeneral: total };
  }, [expenses]);

  const validationOk =
    Math.round(
      totals["Alimentación"] + totals["Salud"] + totals["Mantenimiento"]
    ) === Math.round(totalGeneral);

  /* ====== Cambio de mes (anclado al día 1 para evitar desbordes) ====== */
  const prevMonth = () => {
    const d = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    ); // ✅
    setCurrentMonth(d);
  };
  const nextMonth = () => {
    const d = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    ); // ✅
    setCurrentMonth(d);
  };

  /* ====== UI ====== */
  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: Colors.beige }}>
        {/* Header mes */}
        <View style={styles.header}>
          <TouchableOpacity onPress={prevMonth}>
            <MaterialCommunityIcons
              name="chevron-left"
              size={28}
              color={Colors.white}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentMonth.toLocaleString("es-ES", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <TouchableOpacity onPress={nextMonth}>
            <MaterialCommunityIcons
              name="chevron-right"
              size={28}
              color={Colors.white}
            />
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

          {/* Foto opcional */}
          <Text style={styles.label}>Foto (opcional)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
              <MaterialCommunityIcons
                name="image-plus"
                size={20}
                color={Colors.white}
              />
              <Text style={styles.photoBtnText}>
                {imageUri ? "Cambiar foto" : "Adjuntar foto"}
              </Text>
            </TouchableOpacity>
            {imageUri ? (
              <TouchableOpacity onPress={() => openPreview(imageUri)}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.catBtn,
                  category === c && { backgroundColor: Colors.green },
                ]}
                onPress={() => setCategory(c)}
              >
                <Text
                  style={[
                    styles.catText,
                    category === c && { color: Colors.white },
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[styles.saveBtn, { flex: 1 }]}
              onPress={saveExpense}
            >
              <MaterialCommunityIcons
                name={editingId ? "content-save-edit" : "content-save"}
                size={20}
                color={Colors.white}
              />
              <Text style={styles.saveText}>
                {editingId ? "Guardar cambios" : "Guardar gasto"}
              </Text>
            </TouchableOpacity>

            {editingId ? (
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1 }]}
                onPress={cancelEdit}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color={Colors.bad}
                />
                <Text style={[styles.saveText, { color: Colors.bad }]}>
                  Cancelar
                </Text>
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
          <View
            style={[
              styles.row,
              { borderTopWidth: 1, borderColor: Colors.border, paddingTop: 6 },
            ]}
          >
            <Text style={[styles.label, { fontWeight: "900" }]}>TOTAL</Text>
            <Text style={[styles.value, { fontWeight: "900" }]}>
              C$ {totalGeneral.toFixed(2)}
            </Text>
          </View>

          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MaterialCommunityIcons
              name={validationOk ? "check-circle" : "close-circle"}
              size={20}
              color={validationOk ? Colors.ok : Colors.bad}
            />
            <Text
              style={{
                color: validationOk ? Colors.ok : Colors.bad,
                fontWeight: "700",
              }}
            >
              {validationOk ? "Validación OK" : "Error en los cálculos"}
            </Text>
          </View>

          {/* Botón para ir a las gráficas */}
          <TouchableOpacity
            style={styles.verGraficasBtn}
            onPress={() => navigation.navigate("CostsCharts")}
          >
            <MaterialCommunityIcons name="chart-bar" size={20} color="#fff" />
            <Text style={styles.verGraficasText}>Ver gráficas</Text>
          </TouchableOpacity>
        </View>

        {/* Listado del mes */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Gastos del mes</Text>
          {loading ? (
            <Text style={{ color: Colors.muted }}>Cargando…</Text>
          ) : expenses.length === 0 ? (
            <Text style={{ color: Colors.muted, fontWeight: "700" }}>
              No hay registros.
            </Text>
          ) : (
            expenses.map((it) => {
              return (
                <View key={it.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontWeight: "900", color: Colors.text }}
                    >{`${it.category} · C$ ${Number(it.amount).toFixed(
                      2
                    )}`}</Text>
                    {!!it.note && (
                      <Text
                        style={{ color: Colors.muted, fontWeight: "700" }}
                        numberOfLines={1}
                      >
                        {it.note}
                      </Text>
                    )}
                    <Text style={{ color: Colors.muted, fontSize: 12 }}>
                      {it.dateStr || ""}
                    </Text>

                    {it.photoUri ? (
                      <TouchableOpacity
                        style={{ marginTop: 4, alignSelf: "flex-start" }}
                        onPress={() => openPreview(it.photoUri)}
                      >
                        <Image
                          source={{ uri: it.photoUri }}
                          style={styles.thumbImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => startEdit(it)}
                      accessibilityLabel="Editar"
                    >
                      <MaterialCommunityIcons
                        name="pencil"
                        size={20}
                        color={Colors.green}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => deleteExpense(it.id)}
                      accessibilityLabel="Eliminar"
                    >
                      <MaterialCommunityIcons
                        name="trash-can"
                        size={20}
                        color={Colors.bad}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal de vista previa de la foto */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setPreviewVisible(false)}
          >
            <View style={styles.modalContent}>
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
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

  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.green,
  },
  photoBtnText: {
    color: Colors.white,
    fontWeight: "800",
    marginLeft: 6,
    fontSize: 13,
  },
  thumbImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    padding: 10,
    backgroundColor: Colors.white,
    borderRadius: 12,
    maxWidth: "90%",
    maxHeight: "80%",
  },
  modalImage: {
    width: 260,
    height: 260,
    borderRadius: 8,
  },

  // ⬇️ Estilos para el botón "Ver gráficas"
  verGraficasBtn: {
    marginTop: 12,
    backgroundColor: Colors.green,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  verGraficasText: {
    color: Colors.white,
    fontWeight: "900",
    fontSize: 14,
  },
});

/* ===========================
   🔁 Tus funciones de respaldo
   (ajustadas para incluir foto)
=========================== */

// Lee todos los gastos del usuario (para armar el payload del respaldo)
export async function getExpensesForBackup(uid) {
  if (!uid) return [];
  const out = [];
  const q = query(collection(db, "producers", uid, "expenses"));
  const snap = await getDocs(q);
  snap.forEach((d) => {
    const data = d.data();
    const dateISO = data.date?.toDate
      ? data.date.toDate().toISOString()
      : data.date || null;
    out.push({
      id: d.id,
      amount: Number(data.amount || 0),
      category: data.category || "Alimentación",
      note: data.note || "",
      monthKey: data.monthKey || (dateISO ? getMonthKey(new Date(dateISO)) : null),
      date: dateISO,
      createdAt: data.createdAt?.toMillis
        ? data.createdAt.toMillis()
        : null,
      updatedAt: data.updatedAt?.toMillis
        ? data.updatedAt.toMillis()
        : null,
      photoUri: data.photoUri || null, // 🔹 por si usas este backup clásico
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
      createdAt: serverTimestamp(),
      photoUri: it.photoUri || null, // 🔹 también se reescribe
    });
  }
}

/* 👇 Export opcional para respaldar desde otra pantalla (no interfiere) */
export async function syncPendingCostsNow() {
  try {
    await initDB();
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected) return;

    const u = auth.currentUser;
    if (!u) return;

    // Nuevos (sin cloud_id)
    const newRows = await all(
      `SELECT id, category, amount, notes, date, month_key, photo_uri
         FROM costs
        WHERE deleted=0 AND synced=0 AND (cloud_id IS NULL OR cloud_id='')`
    );
    for (const r of newRows) {
      const dateObj = toDateFromISOorYMD(r.date);
      const mk = r.month_key || getMonthKey(dateObj);
      const ref = await addDoc(collection(db, "costs"), {
        uid: u.uid,
        amount: Number(r.amount || 0),
        category: r.category || "Alimentación",
        note: r.notes || "",
        date: dateObj,
        monthKey: mk,
        createdAt: serverTimestamp(),
        updatedAt: null,
        photoUri: r.photo_uri || null,
      });
      await run(
        `UPDATE costs SET synced=1, cloud_id=?, updated_at=datetime('now') WHERE id=?`,
        [ref.id, r.id]
      );
    }

    // Ediciones (con cloud_id)
    const updRows = await all(
      `SELECT id, cloud_id, category, amount, notes, date, month_key, photo_uri
         FROM costs
        WHERE deleted=0 AND synced=0 AND cloud_id IS NOT NULL AND cloud_id <> ''`
    );
    for (const r of updRows) {
      const dateObj = toDateFromISOorYMD(r.date);
      const mk = r.month_key || getMonthKey(dateObj);
      await updateDoc(doc(db, "costs", (r.cloud_id ?? "").trim()), {
        amount: Number(r.amount || 0),
        category: r.category || "Alimentación",
        note: r.notes || "",
        date: dateObj,
        monthKey: mk,
        updatedAt: serverTimestamp(),
        photoUri: r.photo_uri || null,
      });
      await run(
        `UPDATE costs SET synced=1, updated_at=datetime('now') WHERE id=?`,
        [r.id]
      );
    }

    // Deletes pendientes
    const pendDel = await all(
      "SELECT id, target_id FROM pending_ops WHERE op='delete'"
    );
    for (const pd of pendDel) {
      try {
        await deleteDoc(doc(db, "costs", pd.target_id));
        await run("DELETE FROM pending_ops WHERE id=?", [pd.id]);
      } catch {}
    }
  } catch (e) {
    console.error("syncPendingCostsNow", e);
  }
}

export default CostsScreen;
