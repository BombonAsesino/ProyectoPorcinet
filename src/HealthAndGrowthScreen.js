// src/HealthAndGrowthScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Dimensions,
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
function parseHM(s) {
  const [hh, mm] = s.split(":").map((n) => parseInt(n, 10));
  return { hh, mm };
}

/* ================= Claves de caché/cola ================= */
const cacheKey = (animalId) => `health_cache_v1:${animalId}`;
const QUEUE_KEY = "health_offline_queue_v1";
const alertKey = (animalId) => `health_alerts_v1:${animalId}`;
const notifiedOnceKey = "notif_perm_asked_v1";

/* ================= Gráfico vistoso ================= */
function PrettyWeightChart({ data = [], title = "Evolución de peso" }) {
  const screenW = Dimensions.get("window").width;
  const WIDTH = Math.min(screenW - 24, 680);
  const HEIGHT = 260;

  const series = [...data]
    .filter((d) => Number.isFinite(d.kg))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const labels = series.map((d) =>
    new Date(d.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
  );
  const values = series.map((d) => Number(d.kg));

  const avgSeries = values.map((_, i) => {
    const a = Math.max(0, i - 1);
    const b = Math.min(values.length - 1, i + 1);
    const slice = values.slice(a, b + 1);
    return Math.round((slice.reduce((x, y) => x + y, 0) / slice.length) * 10) / 10;
  });

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 1,
    color: (o = 1) => `rgba(15,23,42,${o})`,
    labelColor: (o = 1) => `rgba(107,114,128,${o})`,
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#843a3a" },
    propsForBackgroundLines: { strokeDasharray: "4 8", stroke: "rgba(0,0,0,0.08)" },
  };
  const lineMain = (o = 1) => `rgba(132,58,58,${o})`;
  const lineAvg = (o = 1) => `rgba(37,99,235,${o})`;

  if (values.length < 2) {
    return (
      <View style={chartCard.container}>
        <Text style={chartCard.title}>{title}</Text>
        <Text style={{ color: Colors.muted, fontWeight: "700" }}>
          Aún no hay suficientes pesos para graficar (necesitas 2+ registros).
        </Text>
      </View>
    );
  }

  return (
    <View style={chartCard.container}>
      <Text style={chartCard.title}>{title}</Text>

      <View style={chartCard.metricsRow}>
        <MetricChip label="Mín." value={`${Math.min(...values)} kg`} bg="#FFF7EA" />
        <MetricChip
          label="Prom."
          value={`${Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10} kg`}
          bg="#F6FAFF"
        />
        <MetricChip label="Máx." value={`${Math.max(...values)} kg`} bg="#FFF5F6" />
      </View>

      <LineChart
        data={{
          labels,
          datasets: [
            { data: values, color: lineMain, strokeWidth: 3, withDots: true },
            { data: avgSeries, color: lineAvg, strokeWidth: 2, withDots: false },
          ],
          legend: [],
        }}
        width={WIDTH}
        height={HEIGHT}
        yAxisSuffix=" kg"
        chartConfig={chartConfig}
        bezier
        withShadow
        segments={4}
        style={{ borderRadius: 14 }}
        formatXLabel={(l, i) => (labels.length > 8 && i % 2 ? "" : l)}
      />

      <View style={chartCard.legendRow}>
        <LegendDot color={lineMain()} label="Peso" />
        <LegendDot color={lineAvg()} label="Promedio móvil" />
      </View>
    </View>
  );
}
function MetricChip({ label, value, bg }) {
  return (
    <View style={{ backgroundColor: bg, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: "900", color: Colors.muted }}>{label}</Text>
      <Text style={{ fontWeight: "900", color: Colors.text }}>{value}</Text>
    </View>
  );
}
function LegendDot({ color, label }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color }} />
      <Text style={{ fontWeight: "800", color: Colors.muted }}>{label}</Text>
    </View>
  );
}
const chartCard = {
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  title: { fontWeight: "900", color: Colors.text, marginBottom: 8 },
  metricsRow: { flexDirection: "row", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  legendRow: { marginTop: 8, flexDirection: "row", gap: 16, alignItems: "center", justifyContent: "flex-end" },
};

/* ================= Pantalla ================= */
export default function HealthAndGrowthScreen({ route }) {
  const animalId = route?.params?.id;
  const earTag = route?.params?.earTag || "";
  const name = route?.params?.name || "";

  // Peso
  const [wDate, setWDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [wKg, setWKg] = useState("");

  // Evento sanitario
  const [eDate, setEDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eType, setEType] = useState("vacuna"); // vacuna | tratamiento | sintoma
  const [eDesc, setEDesc] = useState("");

  // Alimentación
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fKg, setFKg] = useState("");
  const [fCost, setFCost] = useState("");
  const [fNote, setFNote] = useState("");

  // Recordatorios
  const [rDate, setRDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rTime, setRTime] = useState("08:00");
  const [rType, setRType] = useState("alimentación"); // alimentación | vacuna | revisión
  const [rMsg, setRMsg] = useState("");
  const [reminders, setReminders] = useState([]); // [{id,title,date,time,type,message}]

  // Estados datos
  const [weights, setWeights] = useState([]);     // [{date, kg}]
  const [events, setEvents] = useState([]);       // [{date, type, desc}]
  const [feeding, setFeeding] = useState([]);     // [{date, kg, cost, note}]

  /* ---------- permisos de notificación (1 sola vez) ---------- */
  useEffect(() => {
    (async () => {
      try {
        const asked = await AsyncStorage.getItem(notifiedOnceKey);
        if (asked) return;

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        const settings = await Notifications.getPermissionsAsync();
        if (!settings.granted) {
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
      await AsyncStorage.setItem(cacheKey(animalId), JSON.stringify(next));
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
            type: q.type,         // weight | vacuna | tratamiento | sintoma | feeding
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

      // 1) Caché
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

      // 3) Sincronizar cola
      await trySyncQueue();

      // 4) Firestore (si hay red)
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const net = await Network.getNetworkStateAsync();
      if (!net?.isConnected) return;

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

  /* ---------- guardar peso ---------- */
  const saveWeight = async () => {
    if (!isValidYMD(wDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    const kg = Number(wKg);
    if (!Number.isFinite(kg) || kg <= 0) return Alert.alert("Peso", "Ingresa un peso válido (>0).");

    const uid = auth.currentUser?.uid;
    const net = await Network.getNetworkStateAsync();

    const nextW = [...weights, { date: wDate, kg }].sort((a, b) => a.date.localeCompare(b.date));
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

  /* ---------- guardar evento ---------- */
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

  /* ---------- guardar alimentación ---------- */
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

  /* ---------- programar recordatorio (notificación local) ---------- */
  const scheduleReminder = async () => {
    if (!isValidYMD(rDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    if (!isValidHM(rTime)) return Alert.alert("Hora", "Usa formato HH:MM (24h).");

    const { hh, mm } = parseHM(rTime);
    const when = parseYMD(rDate);
    when.setHours(hh, mm, 0, 0);

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

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: when, // fecha/hora exacta
      });

      const item = {
        id,
        title,
        message: body,
        type: rType,
        date: rDate,
        time: rTime,
      };
      const next = [item, ...reminders];
      setReminders(next);
      await AsyncStorage.setItem(alertKey(animalId), JSON.stringify(next));

      Alert.alert("OK", "Recordatorio programado.");
      setRMsg("");
    } catch (e) {
      Alert.alert("Error", "No se pudo programar la notificación.");
    }
  };

  const cancelReminder = async (id) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
    const next = reminders.filter((r) => r.id !== id);
    setReminders(next);
    await AsyncStorage.setItem(alertKey(animalId), JSON.stringify(next));
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
              <TextInput value={wKg} onChangeText={setWKg} keyboardType="numeric" style={styles.input} />
            </View>
          </View>
          <TouchableOpacity onPress={saveWeight} style={styles.saveBtn}>
            <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
            <Text style={styles.saveText}>Guardar peso</Text>
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
                style={[styles.chip, eType === t && { backgroundColor: Colors.green, borderColor: Colors.green }]}
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
              <TextInput value={fKg} onChangeText={setFKg} keyboardType="numeric" style={styles.input} />
            </View>
            <View style={{ width: 120 }}>
              <Text style={styles.label}>Costo</Text>
              <TextInput value={fCost} onChangeText={setFCost} keyboardType="numeric" style={styles.input} />
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
        </View>

        {/* Recordatorios automáticos (H11) */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Recordatorios automáticos</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
              <TextInput value={rDate} onChangeText={setRDate} style={styles.input} />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>Hora (HH:MM)</Text>
              <TextInput value={rTime} onChangeText={setRTime} style={styles.input} placeholder="08:00" />
            </View>
          </View>

          <Text style={styles.label}>Tipo</Text>
          <View style={[styles.row, { gap: 8 }]}>
            {["alimentación", "vacuna", "revisión"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setRType(t)}
                style={[styles.chip, rType === t && { backgroundColor: Colors.green, borderColor: Colors.green }]}
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
                    {r.date} {r.time} — {r.type} · {r.message}
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
                  {f.date} — {f.kg} kg {Number.isFinite(f.cost) && f.cost > 0 ? `· C$ ${f.cost}` : ""} {f.note ? `· ${f.note}` : ""}
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
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
  listBox: {
    backgroundColor: "#f7f2ea",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listItem: { color: Colors.text, fontWeight: "800", marginBottom: 4 },
});
