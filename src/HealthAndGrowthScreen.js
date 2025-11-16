// src/HealthAndGrowthScreen.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Dimensions,
  AppState,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { LineChart } from "react-native-chart-kit";

/* ================= Colores ================= */
const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
  card: "#FFFFFF",
};

/* ================= Helpers fechas ================= */
function isValidYMD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}
function parseYMD(s) {
  if (!isValidYMD(s)) return null;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}
function isValidHM(s) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(s || "").trim());
}
function to24h(h, ampm) {
  const hh = parseInt(h, 10);
  if (ampm === "AM") return hh === 12 ? 0 : hh;
  return hh === 12 ? 12 : hh + 12;
}

/* ================= Claves de caché/cola ================= */
const cacheKey = (animalId) => `health_cache_v1:${animalId}`;
const QUEUE_KEY = "health_offline_queue_v1";
const alertKey = (animalId) => `health_alerts_v1:${animalId}`;
const notifiedOnceKey = "notif_perm_asked_v1";

/* ================= Gráfico ================= */
function PrettyWeightChart({ data = [] }) {
  const screenW = Dimensions.get("window").width;
  const WIDTH = Math.min(screenW - 24, 680);
  const HEIGHT = 250;

  const series = [...data]
    .filter((d) => d && Number.isFinite(Number(d.kg)) && d.date)
    .map((d) => ({ date: new Date(d.date), kg: Number(d.kg) }))
    .sort((a, b) => a.date - b.date);

  if (series.length < 2) {
    return (
      <View style={chartCard.container}>
        <Text style={chartCard.title}>Evolución de peso</Text>
        <Text style={{ color: Colors.muted, fontWeight: "700" }}>
          Registra al menos dos pesos para ver la gráfica.
        </Text>
      </View>
    );
  }

  const labels = series.map((d) =>
    d.date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
  );
  const values = series.map((d) => d.kg);

  // Métricas solicitadas
  const minPeso = Math.min(...values);
  const maxPeso = Math.max(...values);
  const gananciaTotal = values[values.length - 1] - values[0];

  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    color: (o = 1) => `rgba(132,58,58,${o})`,
    labelColor: (o = 1) => `rgba(107,114,128,${o})`,
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#843a3a" },
    propsForBackgroundLines: { strokeDasharray: "4 8", stroke: "rgba(0,0,0,0.08)" },
  };

  return (
    <View style={chartCard.container}>
      <Text style={chartCard.title}>Evolución de peso</Text>

      <View style={chartCard.metricsRow}>
        <MetricChip label="Peso mínimo" value={`${minPeso.toFixed(1)} kg`} bg="#F6FAFF" />
        <MetricChip label="Ganancia total" value={`${gananciaTotal.toFixed(1)} kg`} bg="#EFFFF3" />
        <MetricChip label="Peso máximo" value={`${maxPeso.toFixed(1)} kg`} bg="#FFF6F0" />
      </View>

      <LineChart
        data={{ labels, datasets: [{ data: values }] }}
        width={WIDTH}
        height={HEIGHT}
        yAxisSuffix=" kg"
        bezier
        chartConfig={chartConfig}
        style={{ borderRadius: 14 }}
      />
    </View>
  );
}
function MetricChip({ label, value, bg }) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontWeight: "800", color: Colors.muted }}>{label}</Text>
      <Text style={{ fontWeight: "900", color: Colors.text }}>{value}</Text>
    </View>
  );
}
const chartCard = {
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 12,
    marginTop: 10,
  },
  title: { fontWeight: "900", color: Colors.text, marginBottom: 8 },
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 6, flexWrap: "wrap" },
};

/* ================= Pantalla principal ================= */
export default function HealthAndGrowthScreen({ route }) {
  const animalId = route?.params?.id;
  const earTag = route?.params?.earTag || "";
  const name = route?.params?.name || "";

  // Estados principales
  const [weights, setWeights] = useState([]);
  const [events, setEvents] = useState([]);
  const [feeding, setFeeding] = useState([]);
  const [reminders, setReminders] = useState([]);

  const [wDate, setWDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [wKg, setWKg] = useState("");

  const [eDate, setEDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eType, setEType] = useState("vacuna");
  const [eDesc, setEDesc] = useState("");

  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fKg, setFKg] = useState("");
  const [fCost, setFCost] = useState("");
  const [fNote, setFNote] = useState("");

  const [rDate, setRDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rTime, setRTime] = useState("08:00");
  const [rAMPM, setRAMPM] = useState("AM");
  const [rType, setRType] = useState("alimentación");
  const [rMsg, setRMsg] = useState("");

  const appState = useRef(AppState.currentState);
  const tickerRef = useRef(null);

  /* ---------- Permisos y handler de notificación ---------- */
  useEffect(() => {
    (async () => {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("porcinet-reminders", {
            name: "Recordatorios",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
            vibrationPattern: [0, 250, 250, 250],
            bypassDnd: false,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }

        const asked = await AsyncStorage.getItem(notifiedOnceKey);
        const settings = await Notifications.getPermissionsAsync();
        if (!settings.granted && !asked) {
          await Notifications.requestPermissionsAsync();
        }
        await AsyncStorage.setItem(notifiedOnceKey, "1");
      } catch {}
    })();
  }, []);

  /* ---------- utilidades caché/cola ---------- */
  const readCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(animalId));
      if (!raw) return { weights: [], events: [], feeding: [] };
      const obj = JSON.parse(raw);
      return {
        weights: Array.isArray(obj.weights) ? obj.weights : [],
        events: Array.isArray(obj.events) ? obj.events : [],
        feeding: Array.isArray(obj.feeding) ? obj.feeding : [],
      };
    } catch {
      return { weights: [], events: [], feeding: [] };
    }
  };
  const writeCache = async (next) => {
    try {
      const safe = {
        weights: Array.isArray(next.weights) ? next.weights : [],
        events: Array.isArray(next.events) ? next.events : [],
        feeding: Array.isArray(next.feeding) ? next.feeding : [],
      };
      if (
        safe.weights.length === 0 &&
        safe.events.length === 0 &&
        safe.feeding.length === 0
      ) {
        await AsyncStorage.removeItem(cacheKey(animalId));
      } else {
        await AsyncStorage.setItem(cacheKey(animalId), JSON.stringify(safe));
      }
    } catch {}
  };
  const enqueue = async (record) => {
    try {
      const prev = await AsyncStorage.getItem(QUEUE_KEY);
      const arr = prev ? JSON.parse(prev) : [];
      arr.unshift(record);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
    } catch {}
  };
  const trySyncQueue = async () => {
    const net = await Network.getNetworkStateAsync();
    if (!net?.isConnected) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const prev = await AsyncStorage.getItem(QUEUE_KEY);
      const queue = prev ? JSON.parse(prev) : [];
      if (queue.length === 0) return;

      const remaining = [];
      for (const q of queue) {
        try {
          await addDoc(collection(db, "health"), {
            uid,
            animalId: q.animalId,
            type: q.type, // weight | vacuna | tratamiento | sintoma | feeding
            date: parseYMD(q.date),
            valueKg: q.valueKg ?? null,
            description: q.description ?? null,
            feedKg: q.feedKg ?? null,
            feedCost: q.feedCost ?? null,
            feedNote: q.feedNote ?? null,
            createdAt: serverTimestamp(),
          });
        } catch {
          remaining.push(q);
        }
      }
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } catch {}
  };

  /* ---------- carga inicial ---------- */
  useEffect(() => {
    (async () => {
      if (!animalId) return;

      // 1) Caché local
      const local = await readCache();
      setWeights(local.weights);
      setEvents(local.events);
      setFeeding(local.feeding);

      // 2) Recordatorios locales
      try {
        const raw = await AsyncStorage.getItem(alertKey(animalId));
        setReminders(raw ? JSON.parse(raw) : []);
      } catch {
        setReminders([]);
      }

      // 3) Sincronizar cola si hay red
      await trySyncQueue();

      // 4) Cargar de Firestore (si hay red y user)
      const uid = auth.currentUser?.uid;
      const net = await Network.getNetworkStateAsync();
      if (!uid || !net?.isConnected) return;

      // Pesos
      const qW = query(
        collection(db, "health"),
        where("uid", "==", uid),
        where("animalId", "==", animalId),
        where("type", "==", "weight"),
        orderBy("date", "asc")
      );
      const w = [];
      (await getDocs(qW)).forEach((d) => {
        const x = d.data();
        const dt = x.date?.toDate ? x.date.toDate() : x.date ? new Date(x.date) : null;
        const iso = dt ? dt.toISOString().slice(0, 10) : null;
        if (iso && Number.isFinite(Number(x.valueKg))) w.push({ date: iso, kg: Number(x.valueKg) });
      });

      // Eventos
      const qE = query(
        collection(db, "health"),
        where("uid", "==", uid),
        where("animalId", "==", animalId),
        where("type", "in", ["vacuna", "tratamiento", "sintoma"]),
        orderBy("date", "desc")
      );
      const e = [];
      (await getDocs(qE)).forEach((d) => {
        const x = d.data();
        const dt = x.date?.toDate ? x.date.toDate() : x.date ? new Date(x.date) : null;
        const iso = dt ? dt.toISOString().slice(0, 10) : null;
        if (iso) e.push({ date: iso, type: x.type, desc: x.description || "" });
      });

      // Alimentación
      const qF = query(
        collection(db, "health"),
        where("uid", "==", uid),
        where("animalId", "==", animalId),
        where("type", "==", "feeding"),
        orderBy("date", "desc")
      );
      const f = [];
      (await getDocs(qF)).forEach((d) => {
        const x = d.data();
        const dt = x.date?.toDate ? x.date.toDate() : x.date ? new Date(x.date) : null;
        const iso = dt ? dt.toISOString().slice(0, 10) : null;
        if (iso)
          f.push({
            date: iso,
            kg: Number(x.feedKg ?? 0),
            cost: Number(x.feedCost ?? 0),
            note: x.feedNote || "",
          });
      });

      setWeights(w);
      setEvents(e);
      setFeeding(f);
      await writeCache({ weights: w, events: e, feeding: f });
    })();
  }, [animalId]);

  /* ---------- Ticker foreground (respaldo Expo Go) ---------- */
  useEffect(() => {
    const checkDue = async () => {
      try {
        const raw = await AsyncStorage.getItem(alertKey(animalId));
        const list = raw ? JSON.parse(raw) : [];
        if (list.length === 0) return;

        const now = Date.now();
        const remaining = [];
        let changed = false;

        for (const r of list) {
          if (typeof r.dueAt === "number" && r.dueAt <= now) {
            if (!r.delivered) {
              try {
                await Notifications.presentNotificationAsync({
                  title: r.title,
                  body: r.message,
                });
              } catch {}
              r.delivered = true;
              r.deliveredAt = new Date().toISOString();
              changed = true;
            }
          }
          remaining.push(r);
        }

        if (changed) {
          setReminders(remaining);
          await AsyncStorage.setItem(alertKey(animalId), JSON.stringify(remaining));
        }
      } catch {}
    };

    tickerRef.current = setInterval(checkDue, 15000);
    const sub = AppState.addEventListener("change", (state) => {
      if (appState.current.match(/inactive|background/) && state === "active") {
        checkDue();
      }
      appState.current = state;
    });

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      sub.remove();
    };
  }, [animalId]);

  /* ---------- Guardar Peso ---------- */
  const saveWeight = async () => {
    if (!isValidYMD(wDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    const kg = Number(wKg);
    if (!Number.isFinite(kg) || kg <= 0) return Alert.alert("Peso", "Ingresa un peso válido (>0).");

    // ❗Regla: no permitir mismo día/mes/año ya registrado
    const already = weights.some((w) => String(w.date) === String(wDate));
    if (already) {
      return Alert.alert(
        "Fecha duplicada",
        "Ya existe un registro de peso para este mismo día. Cambia la fecha o edita el registro existente."
      );
    }

    const uid = auth.currentUser?.uid;
    const net = await Network.getNetworkStateAsync();

    const nextW = [...weights, { date: wDate, kg }].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
    setWeights(nextW);
    await writeCache({ weights: nextW, events, feeding });

    if (uid && net?.isConnected) {
      try {
        await addDoc(collection(db, "health"), {
          uid,
          animalId,
          type: "weight",
          date: parseYMD(wDate),
          valueKg: kg,
          createdAt: serverTimestamp(),
        });
      } catch {
        await enqueue({ animalId, type: "weight", date: wDate, valueKg: kg });
      }
    } else {
      await enqueue({ animalId, type: "weight", date: wDate, valueKg: kg });
    }

    setWKg("");
    Alert.alert("OK", "Peso guardado.");
  };

  /* ---------- Guardar Evento ---------- */
  const saveEvent = async () => {
    if (!isValidYMD(eDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    if (!eType) return Alert.alert("Tipo", "Selecciona un tipo.");
    if (!eDesc.trim()) return Alert.alert("Descripción", "Agrega un detalle.");

    const uid = auth.currentUser?.uid;
    const net = await Network.getNetworkStateAsync();

    const nextE = [{ date: eDate, type: eType, desc: eDesc.trim() }, ...events];
    setEvents(nextE);
    await writeCache({ weights, events: nextE, feeding });

    if (uid && net?.isConnected) {
      try {
        await addDoc(collection(db, "health"), {
          uid,
          animalId,
          type: eType,
          date: parseYMD(eDate),
          description: eDesc.trim(),
          createdAt: serverTimestamp(),
        });
      } catch {
        await enqueue({ animalId, type: eType, date: eDate, description: eDesc.trim() });
      }
    } else {
      await enqueue({ animalId, type: eType, date: eDate, description: eDesc.trim() });
    }

    setEDesc("");
    Alert.alert("OK", "Evento guardado.");
  };

  /* ---------- Guardar Alimentación ---------- */
  const saveFeeding = async () => {
    if (!isValidYMD(fDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    const kg = Number(fKg);
    const cost = Number(fCost || 0);
    if (!Number.isFinite(kg) || kg <= 0) return Alert.alert("Alimento", "Ingresa kg válidos (>0).");

    const uid = auth.currentUser?.uid;
    const net = await Network.getNetworkStateAsync();

    const item = { date: fDate, kg, cost, note: fNote.trim() };
    const nextF = [item, ...feeding];
    setFeeding(nextF);
    await writeCache({ weights, events, feeding: nextF });

    if (uid && net?.isConnected) {
      try {
        await addDoc(collection(db, "health"), {
          uid,
          animalId,
          type: "feeding",
          date: parseYMD(fDate),
          feedKg: kg,
          feedCost: cost,
          feedNote: fNote.trim() || null,
          createdAt: serverTimestamp(),
        });
      } catch {
        await enqueue({
          animalId,
          type: "feeding",
          date: fDate,
          feedKg: kg,
          feedCost: cost,
          feedNote: fNote.trim() || null,
        });
      }
    } else {
      await enqueue({
        animalId,
        type: "feeding",
        date: fDate,
        feedKg: kg,
        feedCost: cost,
        feedNote: fNote.trim() || null,
      });
    }

    setFKg("");
    setFCost("");
    setFNote("");
    Alert.alert("OK", "Alimentación guardada.");
  };

  /* ---------- Programar recordatorio (exacto a la hora establecida) ---------- */
  const scheduleReminder = async () => {
    if (!isValidYMD(rDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    if (!isValidHM(rTime)) return Alert.alert("Hora", "Usa formato HH:MM (ej. 08:00).");

    const [hmH, hmM] = rTime.split(":");
    const hh24 = to24h(hmH, rAMPM);
    const mm = parseInt(hmM, 10);

    const when = parseYMD(rDate);
    when.setSeconds(0, 0);
    when.setHours(hh24, mm, 0, 0);

    if (when.getTime() <= Date.now()) {
      return Alert.alert("Horario", "Elige una fecha/hora futura.");
    }

    const title = `Recordatorio de ${rType}`;
    const body =
      rMsg.trim() ||
      (rType === "alimentación"
        ? `Revisar ración de la cerda #${earTag}`
        : rType === "vacuna"
        ? `Aplicar vacuna programada a la cerda #${earTag}`
        : `Realizar revisión sanitaria a la cerda #${earTag}`);

    let nativeId = null;
    try {
      nativeId = await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: "default" },
        trigger: when,
      });
    } catch {
      nativeId = null;
    }

    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nativeId,
      title,
      message: body,
      type: rType,
      date: rDate,
      time: rTime,
      ampm: rAMPM,
      dueAt: when.getTime(),
      delivered: false,
    };

    const next = [item, ...reminders];
    setReminders(next);
    await AsyncStorage.setItem(alertKey(animalId), JSON.stringify(next));

    Alert.alert("OK", "Recordatorio programado.");
    setRMsg("");
  };

  /* ---------- Cancelar recordatorio (eliminar) ---------- */
  const cancelReminder = async (id) => {
    const r = reminders.find((x) => x.id === id);
    if (!r) return;

    Alert.alert(
      "Cancelar recordatorio",
      "¿Seguro que deseas cancelar y eliminar este recordatorio?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, eliminar",
          style: "destructive",
          onPress: async () => {
            if (r.nativeId) {
              try {
                await Notifications.cancelScheduledNotificationAsync(r.nativeId);
              } catch {}
            }
            const remaining = reminders.filter((x) => x.id !== id);
            setReminders(remaining);
            await AsyncStorage.setItem(alertKey(animalId), JSON.stringify(remaining));
          },
        },
      ]
    );
  };

  /* ---------- Borrar Historiales con confirmación (FUNCIONANDO) ---------- */
  const clearHistory = async (type) => {
    const label =
      type === "weights"
        ? "historial de peso"
        : type === "events"
        ? "historial sanitario"
        : "historial de alimentación";

    Alert.alert(
      "Borrar historial",
      `¿Seguro que deseas borrar el ${label}? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            const key = cacheKey(animalId);
            const raw = await AsyncStorage.getItem(key);
            const data = raw ? JSON.parse(raw) : {};

            const next = {
              weights: type === "weights" ? [] : Array.isArray(data.weights) ? data.weights : [],
              events: type === "events" ? [] : Array.isArray(data.events) ? data.events : [],
              feeding: type === "feeding" ? [] : Array.isArray(data.feeding) ? data.feeding : [],
            };

            if (type === "weights") setWeights([]);
            if (type === "events") setEvents([]);
            if (type === "feeding") setFeeding([]);

            await writeCache(next);
            Alert.alert("OK", `Se borró el ${label}.`);
          },
        },
      ]
    );
  };

  /* ---------- UI ---------- */
  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <View style={{ padding: 12 }}>
        <Text style={styles.title}>
          Ficha: #{earTag || "—"} {name ? `• ${name}` : ""}
        </Text>

        {/* Gráfico */}
        <PrettyWeightChart data={weights} />

        {/* Peso */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Registrar peso</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
              <TextInput value={wDate} onChangeText={setWDate} style={styles.input} />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>Kg</Text>
              <TextInput
                value={wKg}
                onChangeText={setWKg}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>
          <TouchableOpacity onPress={saveWeight} style={styles.saveBtn}>
            <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
            <Text style={styles.saveText}>Guardar peso</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => clearHistory("weights")}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteText}>Borrar historial de peso</Text>
          </TouchableOpacity>
        </View>

        {/* Evento sanitario */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Registrar evento sanitario</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
              <TextInput value={eDate} onChangeText={setEDate} style={styles.input} />
            </View>
          </View>

          <Text style={styles.label}>Tipo</Text>
          <View style={[styles.row, { gap: 8 }]}>
            {["vacuna", "tratamiento", "sintoma"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setEType(t)}
                style={[
                  styles.chip,
                  eType === t && { backgroundColor: Colors.green, borderColor: Colors.green },
                ]}
              >
                <Text style={[styles.chipText, eType === t && { color: Colors.white }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            value={eDesc}
            onChangeText={setEDesc}
            placeholder="Detalle del evento…"
            multiline
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
          />

          <TouchableOpacity onPress={saveEvent} style={styles.saveBtn}>
            <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
            <Text style={styles.saveText}>Guardar evento</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => clearHistory("events")}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteText}>Borrar historial sanitario</Text>
          </TouchableOpacity>
        </View>

        {/* Alimentación */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Registrar alimentación</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
              <TextInput value={fDate} onChangeText={setFDate} style={styles.input} />
            </View>
            <View style={{ width: 100 }}>
              <Text style={styles.label}>Kg</Text>
              <TextInput
                value={fKg}
                onChangeText={setFKg}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={{ width: 120 }}>
              <Text style={styles.label}>Costo</Text>
              <TextInput
                value={fCost}
                onChangeText={setFCost}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Nota (opcional)</Text>
          <TextInput
            value={fNote}
            onChangeText={setFNote}
            placeholder="Tipo de alimento, lote, etc."
            multiline
            style={[styles.input, { height: 70, textAlignVertical: "top" }]}
          />

          <TouchableOpacity onPress={saveFeeding} style={styles.saveBtn}>
            <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
            <Text style={styles.saveText}>Guardar alimentación</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => clearHistory("feeding")}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteText}>Borrar historial de alimentación</Text>
          </TouchableOpacity>
        </View>

        {/* Recordatorios automáticos */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Recordatorios automáticos</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
              <TextInput value={rDate} onChangeText={setRDate} style={styles.input} />
            </View>

            <View style={{ width: 110 }}>
              <Text style={styles.label}>Hora (hh:mm)</Text>
              <TextInput
                value={rTime}
                onChangeText={setRTime}
                style={styles.input}
                placeholder="08:00"
              />
            </View>

            <View style={{ width: 90 }}>
              <Text style={styles.label}>AM / PM</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["AM", "PM"].map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setRAMPM(v)}
                    style={[
                      styles.chip,
                      { paddingVertical: 8, paddingHorizontal: 10 },
                      rAMPM === v && { backgroundColor: Colors.green, borderColor: Colors.green },
                    ]}
                  >
                    <Text style={[styles.chipText, rAMPM === v && { color: Colors.white }]}>
                      {v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.label}>Tipo</Text>
          <View style={[styles.row, { gap: 8 }]}>
            {["alimentación", "vacuna", "revisión"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setRType(t)}
                style={[
                  styles.chip,
                  rType === t && { backgroundColor: Colors.green, borderColor: Colors.green },
                ]}
              >
                <Text style={[styles.chipText, rType === t && { color: Colors.white }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Mensaje (opcional)</Text>
          <TextInput
            value={rMsg}
            onChangeText={setRMsg}
            placeholder="Ej: Revisar agua y ración matutina"
            multiline
            style={[styles.input, { height: 70, textAlignVertical: "top" }]}
          />

          <TouchableOpacity onPress={scheduleReminder} style={styles.saveBtn}>
            <MaterialCommunityIcons name="bell-ring" size={18} color={Colors.white} />
            <Text style={styles.saveText}>Programar recordatorio</Text>
          </TouchableOpacity>

          {/* Lista de recordatorios */}
          <View style={[styles.listBox, { marginTop: 10 }]}>
            {reminders.length === 0 ? (
              <Text style={{ color: Colors.muted, fontWeight: "700" }}>Sin recordatorios.</Text>
            ) : (
              reminders.map((r) => (
                <View
                  key={r.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderColor: "rgba(0,0,0,0.05)",
                  }}
                >
                  <Text style={{ color: Colors.text, fontWeight: "800", flex: 1 }}>
                    {r.date} {r.time} {r.ampm} — {r.type} · {r.message}
                  </Text>
                  <TouchableOpacity
                    onPress={() => cancelReminder(r.id)}
                    style={{
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: Colors.white,
                    }}
                  >
                    <Text style={{ color: "#b42318", fontWeight: "900" }}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Historial peso */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Historial de peso (últimos)</Text>
          {weights.length === 0 ? (
            <Text style={{ color: Colors.muted, fontWeight: "700" }}>Sin registros.</Text>
          ) : (
            <View style={styles.listBox}>
              {[...weights].slice(-10).reverse().map((w, i) => (
                <Text key={i} style={styles.listItem}>
                  {w.date} — {w.kg} kg
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Historial sanitario */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Historial sanitario</Text>
          {events.length === 0 ? (
            <Text style={{ color: Colors.muted, fontWeight: "700" }}>Sin registros.</Text>
          ) : (
            <View style={styles.listBox}>
              {events.map((e, i) => (
                <Text key={i} style={styles.listItem}>
                  {e.date} — {e.type}: {e.desc}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Historial alimentación */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Historial de alimentación</Text>
          {feeding.length === 0 ? (
            <Text style={{ color: Colors.muted, fontWeight: "700" }}>Sin registros.</Text>
          ) : (
            <View style={styles.listBox}>
              {feeding.map((f, i) => (
                <Text key={i} style={styles.listItem}>
                  {f.date} — {f.kg} kg {Number.isFinite(f.cost) && f.cost > 0 ? `· C$ ${f.cost}` : ""}{" "}
                  {f.note ? `· ${f.note}` : ""}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

/* ================= Estilos ================= */
const styles = StyleSheet.create({
  title: { fontWeight: "900", fontSize: 18, color: Colors.text, marginBottom: 8 },
  panel: {
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: "900", fontSize: 16, color: Colors.text, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { color: Colors.muted, fontWeight: "800", marginBottom: 6 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    color: Colors.text,
    fontWeight: "700",
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.green,
  },
  chipText: { color: Colors.green, fontWeight: "900" },
  saveBtn: {
    marginTop: 10,
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: Colors.white, fontWeight: "900" },
  deleteBtn: {
    backgroundColor: "#f8d7da",
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 8,
    alignItems: "center",
  },
  deleteText: { color: "#842029", fontWeight: "900" },
  listBox: {
    backgroundColor: "#f7f2ea",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listItem: { color: Colors.text, fontWeight: "800", marginBottom: 4 },
});
