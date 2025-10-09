// src/ReproductionScreen.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { auth, db } from "../database";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  setDoc,
  updateDoc, // ← agregado para editar eventos
} from "firebase/firestore";

const Colors = {
  green:  "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#FFFFFF",
  chip: "#b93746ff",
  border: "rgba(0,0,0,0.08)",
  warn: "#f59e0b",
  danger: "#843a3a",
  ok: "#843a3a",
};

export default function ReproductionScreen({ navigation, route }) {
  const today = new Date().toISOString().slice(0, 10);
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // ===== NUEVO: cerda seleccionada (H04) =====
  const [selectedSow, setSelectedSow] = useState(null); // { id, earTag, name }

  useEffect(() => {
    const sow = route?.params?.pickedSow;
    if (sow?.id) setSelectedSow(sow);
  }, [route?.params?.pickedSow]);

  // ====== Carga en tiempo real de eventos del usuario ======
  useEffect(() => {
    const uid = auth.currentUser?.uid || "__anon__";

    let qBase = query(collection(db, "reproEvents"), where("uid", "==", uid));

    if (selectedSow?.id) {
      qBase = query(
        collection(db, "reproEvents"),
        where("uid", "==", uid),
        where("sowId", "==", selectedSow.id)
      );
    }

    const unsub = onSnapshot(
      qBase,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

        list.sort((a, b) => {
          const ta = a.ts?.toMillis?.() ?? (a.ts?.seconds ? a.ts.seconds * 1000 : 0);
          const tb = b.ts?.toMillis?.() ?? (b.ts?.seconds ? b.ts.seconds * 1000 : 0);
          return tb - ta;
        });

        setEvents(list);
        setLoading(false);
      },
      (err) => {
        console.error("onSnapshot reproEvents:", err);
        setLoading(false);
        Alert.alert("Error", "No se pudieron cargar los eventos.");
      }
    );
    return unsub;
  }, [selectedSow?.id]);

  const dayEvents = useMemo(() => events.filter((e) => e.date === selected), [events, selected]);

  const markedDates = useMemo(() => {
    const m = {};
    events.forEach((e) => {
      m[e.date] = {
        marked: true,
        dotColor: Colors.green,
        selected: e.date === selected,
        selectedColor: Colors.green,
      };
    });
    if (!m[selected]) m[selected] = { selected: true, selectedColor: "green" };
    else {
      m[selected].selected = true;
      m[selected].selectedColor = "green";
    }
    return m;
  }, [events, selected]);

  const registerEvent = useCallback(
    async (type) => {
      try {
        const uid = auth.currentUser?.uid || "__anon__";
        if (!selected) return Alert.alert("Selecciona una fecha", "Toca un día en el calendario.");

        if (!selectedSow?.id) {
          return Alert.alert(
            "Selecciona una cerda",
            "Abre la lista de cerdas y elige una antes de registrar eventos."
          );
        }

        await addDoc(collection(db, "reproEvents"), {
          uid,
          sowId: selectedSow.id,
          date: selected,          // YYYY-MM-DD
          type,                    // "celo" | "monta" | "parto"
          note: "",
          ts: serverTimestamp(),
        });

        Alert.alert("Guardado", `Evento de ${type} registrado para ${selected}.`);
      } catch (e) {
        console.error("registerEvent:", e);
        Alert.alert("Error", "No se pudo registrar el evento.");
      }
    },
    [selected, selectedSow?.id]
  );

  const deleteLastOfSelected = useCallback(async () => {
    try {
      const ofDay = [...dayEvents];
      if (ofDay.length === 0) return Alert.alert("Sin registros", "Este día no tiene eventos.");
      ofDay.sort((a, b) => {
        const ta = a.ts?.toMillis?.() ?? (a.ts?.seconds ? a.ts.seconds * 1000 : 0);
        const tb = b.ts?.toMillis?.() ?? (b.ts?.seconds ? b.ts.seconds * 1000 : 0);
        return tb - ta;
      });
      const last = ofDay[0];
      await deleteDoc(doc(db, "reproEvents", last.id));
      Alert.alert("Eliminado", "Se borró el último registro del día.");
    } catch (e) {
      console.error("deleteLastOfSelected:", e);
      Alert.alert("Error", "No se pudo eliminar el registro.");
    }
  }, [dayEvents]);

  // ====== CRUD en cronología (EDIT / DELETE por ítem) ======
  const editEvent = async (event) => {
    // Alert.prompt solo está en iOS; en Android usa un modal tuyo si quieres.
    Alert.prompt(
      "Editar evento",
      "Escribe una nota (opcional) para este evento.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Guardar",
          onPress: async (value) => {
            try {
              await updateDoc(doc(db, "reproEvents", event.id), {
                note: value || "",
              });
              Alert.alert("Actualizado", "Evento editado con éxito.");
            } catch (err) {
              console.error("editEvent:", err);
              Alert.alert("Error", "No se pudo editar el evento.");
            }
          },
        },
      ],
      "plain-text",
      event.note || ""
    );
  };

  const deleteEvent = async (event) => {
    Alert.alert(
      "Eliminar evento",
      "¿Seguro que quieres borrar este evento?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "reproEvents", event.id));
              Alert.alert("Eliminado", "Evento borrado.");
            } catch (err) {
              console.error("deleteEvent:", err);
              Alert.alert("Error", "No se pudo borrar el evento.");
            }
          },
        },
      ]
    );
  };

  // ====== Fechas helpers ======
  const parseYMD = (ymd) => {
    const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const addDays = (d, n) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
  };
  const diffDays = (a, b) => {
    const MS = 24 * 60 * 60 * 1000;
    return Math.floor((a - b) / MS);
  };

  // ====== Generación de alertas (cliente) ======
  const computedAlerts = useMemo(() => {
    if (!events.length) return [];

    const arr = [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const todayDate = parseYMD(new Date().toISOString().slice(0, 10));
    const result = [];

    const celos = arr.filter((e) => e.type === "celo");
    const montas = arr.filter((e) => e.type === "monta");
    const partos = arr.filter((e) => e.type === "parto");

    // Celo sin monta > 3d
    celos.forEach((c) => {
      const cDate = parseYMD(c.date);
      const monta = montas.find((m) => m.date >= c.date);
      if (!monta) {
        const days = diffDays(todayDate, addDays(cDate, 3));
        if (days > 0) {
          const key = `celo-no-monta|${c.date}`;
          result.push({
            key,
            level: "warn",
            kind: "celo-no-monta",
            refDate: c.date,
            title: "Celo sin monta",
            msg: `Registrar monta posterior al celo del ${c.date}. (+${days} días)`,
          });
        }
      }
    });

    // Monta -> parto próximo/vencido
    montas.forEach((m) => {
      const mDate = parseYMD(m.date);
      const due = addDays(mDate, 114);
      const maxDue = addDays(mDate, 116);
      const parto = partos.find((p) => p.date >= m.date);

      if (!parto) {
        const daysToDue = diffDays(due, todayDate);
        const overdue = diffDays(todayDate, maxDue);

        if (overdue > 0) {
          const key = `parto-vencido|${m.date}`;
          result.push({
            key,
            level: "danger",
            kind: "parto-vencido",
            refDate: m.date,
            title: "Parto vencido",
            msg: `No se registró parto estimado de la monta del ${m.date} (vencido hace ${overdue} días).`,
          });
        } else if (daysToDue >= 0 && daysToDue <= 7) {
          const key = `parto-proximo|${m.date}`;
          result.push({
            key,
            level: "warn",
            kind: "parto-proximo",
            refDate: m.date,
            title: "Parto próximo",
            msg: `Se estima parto en ${daysToDue} día(s) (monta del ${m.date}).`,
          });
        }
      }
    });

    return result.slice(0, 20);
  }, [events]);

  // ====== Sincronización con Firestore (colección reproAlerts) ======
  useEffect(() => {
    const syncAlerts = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const q = query(collection(db, "reproAlerts"), where("uid", "==", uid));
        const snap = await getDocs(q);
        const existing = new Map();
        snap.forEach((d) => {
          const data = d.data();
          if (data.key) existing.set(data.key, { id: d.id, data });
        });

        const desired = new Map();
        computedAlerts.forEach((a) => desired.set(a.key, a));

        const batch = writeBatch(db);

        for (const [key, a] of desired.entries()) {
          const safeId = `${uid}_${key}`.replace(/[^a-zA-Z0-9_\-\.|]/g, "_");
          const docRef = doc(db, "reproAlerts", safeId);

          const prev = existing.get(key)?.data;
          const payload = {
            uid,
            key: a.key,
            level: a.level,
            kind: a.kind,
            refDate: a.refDate,
            title: a.title,
            msg: a.msg,
            createdAt: serverTimestamp(),
          };

          if (
            !prev ||
            prev.level !== payload.level ||
            prev.msg !== payload.msg ||
            prev.title !== payload.title
          ) {
            batch.set(docRef, payload, { merge: true });
          }
        }

        for (const [key, { id }] of existing.entries()) {
          if (!desired.has(key)) {
            batch.delete(doc(db, "reproAlerts", id));
          }
        }

        await batch.commit();
      } catch (e) {
        console.error("syncAlerts:", e);
      }
    };

    syncAlerts();
  }, [computedAlerts, db]);

  // ====== UI ======
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 28 }}
      showsVerticalScrollIndicator
    >
      <Text style={styles.title}>Control de reproducción</Text>

      {/* Selector de cerda */}
      <View style={styles.sowBar}>
        <TouchableOpacity
          style={styles.sowBtn}
          onPress={() =>
            navigation?.navigate("PigsList", {
              selectMode: true,
              onPick: (sow) => setSelectedSow(sow),
            })
          }
        >
          <MaterialCommunityIcons name="account-search" size={18} color={Colors.white} />
          <Text style={styles.sowBtnText}>
            {selectedSow
              ? `Cerda: ${selectedSow.earTag ? "#" + selectedSow.earTag : selectedSow.name || selectedSow.id}`
              : "Seleccionar cerda"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sowAdd}
          onPress={() => navigation?.navigate("PigForm")}
        >
          <MaterialCommunityIcons name="plus" size={18} color={Colors.green} />
          <Text style={styles.sowAddText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      <Calendar
        onDayPress={(day) => setSelected(day.dateString)}
        markedDates={markedDates}
        theme={{
          selectedDayBackgroundColor: "green",
          todayTextColor: "#e11d48",
          arrowColor: "green",
          dotColor: Colors.green,
        }}
      />

      {/* Cabecera del día */}
      <View style={styles.eventCard}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="pig-variant" size={36} color={Colors.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventTitle}>
            {dayEvents.length > 0 ? "Eventos del día" : "Sin información"}
          </Text>
          <Text style={styles.eventSubtitle}>{selected}</Text>
        </View>
      </View>

      {/* Acciones */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => registerEvent("celo")}>
          <Text style={styles.actionText}>Registrar celo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => registerEvent("monta")}>
          <Text style={styles.actionText}>Monta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => registerEvent("parto")}>
          <Text style={styles.actionText}>Parto</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={deleteLastOfSelected}>
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.white} />
        <Text style={styles.deleteText}>Borrar último registro del día</Text>
      </TouchableOpacity>

      {/* Cronología con CRUD */}
      <View style={styles.timeline}>
        <Text style={styles.timelineTitle}>Cronología ({selected})</Text>

        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 8 }} />
        ) : dayEvents.length === 0 ? (
          <Text style={{ color: Colors.muted }}>Sin información.</Text>
        ) : (
          dayEvents.map((e) => (
            <View key={e.id} style={styles.timelineRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <MaterialCommunityIcons
                  name={
                    e.type === "celo"
                      ? "heart-outline"
                      : e.type === "monta"
                      ? "horse-human"
                      : "baby-face-outline"
                  }
                  size={18}
                  color={Colors.green}
                />
                <Text style={styles.timelineText}>
                  {e.type === "celo" ? "Detección de celo" : e.type === "monta" ? "Monta" : "Parto"}
                  {e.note ? ` · ${e.note}` : ""}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity onPress={() => editEvent(e)} accessibilityLabel="Editar evento">
                  <MaterialCommunityIcons name="pencil" size={18} color={Colors.green} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteEvent(e)} accessibilityLabel="Eliminar evento">
                  <MaterialCommunityIcons name="delete" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Alertas */}
      <View style={styles.alertsPanel}>
        <Text style={styles.alertsTitle}>Alertas</Text>
        {computedAlerts.length === 0 ? (
          <View style={styles.alertRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color={Colors.ok} />
            <Text style={[styles.alertText, { color: Colors.ok }]}>Sin alertas por ahora.</Text>
          </View>
        ) : (
          computedAlerts.map((a) => (
            <View key={a.key} style={styles.alertRow}>
              <MaterialCommunityIcons
                name={a.level === "danger" ? "alert-octagon" : "alert-circle"}
                size={18}
                color={a.level === "danger" ? Colors.danger : Colors.warn}
              />
              <Text
                style={[
                  styles.alertText,
                  { color: a.level === "danger" ? Colors.danger : Colors.text },
                ]}
              >
                <Text style={{ fontWeight: "900" }}>{a.title}: </Text>
                {a.msg}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

/* ================== Estilos ================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5dc", padding: 15 },
  title: { fontSize: 22, fontWeight: "bold", color: "green", marginBottom: 15 },

  // barra de selección de cerda
  sowBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  sowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.green,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sowBtnText: { color: Colors.white, fontWeight: "900" },
  sowAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sowAddText: { color: Colors.green, fontWeight: "900" },

  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef7f0",
    marginRight: 12,
  },
  eventTitle: { fontWeight: "bold", fontSize: 16, color: Colors.text },
  eventSubtitle: { color: Colors.muted },

  actions: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.chip,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionText: { fontWeight: "800", color: Colors.text },

  deleteBtn: {
    backgroundColor: "#843a3a",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  deleteText: { color: Colors.white, fontWeight: "900" },

  timeline: {
    backgroundColor: Colors.card,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  timelineTitle: { fontWeight: "bold", marginBottom: 8, color: Colors.text },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    justifyContent: "space-between",
  },
  timelineText: { fontWeight: "700", color: Colors.text, flex: 1 },

  alertsPanel: {
    backgroundColor: Colors.card,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  alertsTitle: { fontWeight: "bold", marginBottom: 8, color: Colors.text, fontSize: 16 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  alertText: { fontWeight: "700", color: Colors.text, flex: 1, lineHeight: 20 },
});
