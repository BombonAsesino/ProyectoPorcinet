// src/HealthAndGrowthScreen.js
import React, { useEffect, useState, useMemo } from "react";
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
import { LineChart } from "react-native-chart-kit";

/* ✅ OFFLINE */
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
  card: "#FFFFFF",
};

function isValidYMD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}
function parseYMD(s) {
  if (!isValidYMD(s)) return null;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/* =================== Gráfico (igual que tenías) =================== */
function PrettyWeightChartSpectacular({ data = [], title = "Evolución de peso" }) {
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

  const movingAvg = (() => {
    const out = [];
    const n = values.length;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      const slice = values.slice(a, b + 1);
      const avg = slice.reduce((x, y) => x + y, 0) / slice.length;
      out.push(Math.round(avg * 10) / 10);
    }
    return out;
  })();

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const avg =
    values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : 0;
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const gain = values.length ? Math.round((last - first) * 10) / 10 : 0;

  const dense = labels.length > 8;
  const safeLabels = labels.length ? labels : ["", ""];
  const labelFormatter = (l, i) => (dense && i % 2 !== 0 ? "" : l);

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(15,23,42,${opacity})`,
    labelColor: (opacity = 1) => `rgba(107,114,128,${opacity})`,
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#843a3a" },
    propsForBackgroundLines: { strokeDasharray: "4 8", stroke: "rgba(0,0,0,0.08)" },
  };

  const lineMain = (opacity = 1) => `rgba(132, 58, 58, ${opacity})`;
  const lineAvg = (opacity = 1) => `rgba(37, 99, 235, ${opacity})`;

  const labelForIndex = (idx) => {
    if (idx === values.length - 1) return `${values[idx]}kg`;
    if (values[idx] === max) return `máx ${max}kg`;
    if (values[idx] === min) return `mín ${min}kg`;
    return null;
  };

  return (
    <View style={chartCard.container}>
      <Text style={chartCard.title}>{title}</Text>
      <View style={chartCard.metricsRow}>
        <MetricChip label="Mín." value={`${min} kg`} bg="#FFF7EA" />
        <MetricChip label="Prom." value={`${avg} kg`} bg="#F6FAFF" />
        <MetricChip label="Máx." value={`${max} kg`} bg="#FFF5F6" />
        <MetricChip label="Ganancia" value={`${gain >= 0 ? "+" : ""}${gain} kg`} bg="#EEFDF3" />
      </View>

      <LineChart
        data={{
          labels: safeLabels,
          datasets: [
            { data: values.length ? values : [0, 0], color: lineMain, strokeWidth: 3, withDots: true },
            { data: movingAvg.length ? movingAvg : [0, 0], color: lineAvg, strokeWidth: 2, withDots: false },
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
        formatXLabel={labelFormatter}
        yLabelsOffset={8}
        decorator={() => null}
        renderDotContent={({ x, y, index }) => {
          const text = labelForIndex(index);
          if (!text) return null;
          return (
            <View
              key={`lab-${index}`}
              style={{
                position: "absolute",
                left: x - 22,
                top: y - 28,
                backgroundColor: "rgba(132,58,58,0.08)",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#843a3a" }}>{text}</Text>
            </View>
          );
        }}
      />

      <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "flex-end", gap: 16 }}>
        <LegendDot color={lineMain()} label="Peso" />
        <LegendDot color={lineAvg()} label="Promedio móvil" />
      </View>
    </View>
  );
}
function MetricChip({ label, value, bg }) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
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
};

/* =================== Helpers OFFLINE =================== */
const queueKey = (animalId) => `health_offline_queue_${animalId}`;
const feedCacheKey = (animalId) => `feeds_cache_${animalId}`;
const weightCacheKey = (animalId) => `weights_cache_${animalId}`;
const eventCacheKey  = (animalId) => `events_cache_${animalId}`;

async function readJSON(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function writeJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

async function readQueue(animalId) { return readJSON(queueKey(animalId)); }
async function writeQueue(animalId, arr) { return writeJSON(queueKey(animalId), arr); }

async function readFeedCache(animalId) { return readJSON(feedCacheKey(animalId)); }
async function writeFeedCache(animalId, arr){ return writeJSON(feedCacheKey(animalId), arr); }

async function readWeightCache(animalId){ return readJSON(weightCacheKey(animalId)); }
async function writeWeightCache(animalId, arr){ return writeJSON(weightCacheKey(animalId), arr); }

async function readEventCache(animalId){ return readJSON(eventCacheKey(animalId)); }
async function writeEventCache(animalId, arr){ return writeJSON(eventCacheKey(animalId), arr); }

// Unifica por cloudId o localId
function mergeByIdentity(fsItems = [], localItems = [], idGetter) {
  const out = [];
  const seen = new Set();
  [...fsItems, ...localItems].forEach((x) => {
    const k = idGetter(x);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(x);
  });
  return out;
}
function mergeFeeds(fsItems = [], localItems = []) {
  const idGetter = (x) =>
    x.cloudId ? `c:${x.cloudId}` : x.localId ? `l:${x.localId}` : `k:${x.date}|${x.type}|${x.kg}|${x.desc}`;
  const merged = mergeByIdentity(fsItems, localItems, idGetter);
  return merged.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* =================== Pantalla =================== */
export default function HealthAndGrowthScreen({ route }) {
  const animalId = route?.params?.id;
  const earTag = route?.params?.earTag || "";
  const name = route?.params?.name || "";

  // Peso
  const [wDate, setWDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [wKg, setWKg] = useState("");

  // Evento
  const [eDate, setEDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eType, setEType] = useState("vacuna"); // vacuna | tratamiento | sintoma
  const [eDesc, setEDesc] = useState("");

  // Alimentación
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fType, setFType] = useState("balanceado"); // balanceado | maiz | otro
  const [fKg, setFKg] = useState("");
  const [fDesc, setFDesc] = useState("");

  // Estados
  const [weights, setWeights] = useState([]); // [{date, kg}]
  const [events,  setEvents]  = useState([]); // [{date, type, desc}]
  const [feeds,   setFeeds]   = useState([]); // [{date, type, kg, desc, cloudId?, localId?, offline?}]

  // Carga inicial con caché primero
  useEffect(() => {
    (async () => {
      if (!animalId) {
        console.log("HealthAndGrowthScreen: faltó route.params.id");
        return;
      }

      // 1) Cargar SIEMPRE cachés
      const [cw, ce, cf] = await Promise.all([
        readWeightCache(animalId),
        readEventCache(animalId),
        readFeedCache(animalId),
      ]);
      if (cw?.length) setWeights(cw);
      if (ce?.length) setEvents(ce);
      if (cf?.length) setFeeds(cf);

      // 2) Online → traer y fusionar y reescribir caché
      const net = await Network.getNetworkStateAsync();
      const uid = auth.currentUser?.uid || null;
      if (!uid || !net?.isConnected) return;

      try {
        // Pesos
        const qW = query(
          collection(db, "health"),
          where("uid", "==", uid),
          where("animalId", "==", animalId),
          where("type", "==", "weight"),
          orderBy("date", "asc")
        );
        const snapW = await getDocs(qW);
        const w = [];
        snapW.forEach((d) => {
          const x = d.data();
          const dt = x.date?.toDate ? x.date.toDate() : x.date ? new Date(x.date) : null;
          const iso = dt ? dt.toISOString().slice(0, 10) : null;
          if (iso && Number.isFinite(Number(x.valueKg))) w.push({ date: iso, kg: Number(x.valueKg) });
        });
        setWeights(w);
        await writeWeightCache(animalId, w);
      } catch {}

      try {
        // Eventos
        const qE = query(
          collection(db, "health"),
          where("uid", "==", uid),
          where("animalId", "==", animalId),
          where("type", "in", ["vacuna", "tratamiento", "sintoma"]),
          orderBy("date", "desc")
        );
        const snapE = await getDocs(qE);
        const e = [];
        snapE.forEach((d) => {
          const x = d.data();
          const dt = x.date?.toDate ? x.date.toDate() : x.date ? new Date(x.date) : null;
          const iso = dt ? dt.toISOString().slice(0, 10) : null;
          if (iso) e.push({ date: iso, type: x.type, desc: x.description || "" });
        });
        setEvents(e);
        await writeEventCache(animalId, e);
      } catch {}

      try {
        // Alimentación
        const qF = query(
          collection(db, "health"),
          where("uid", "==", uid),
          where("animalId", "==", animalId),
          where("type", "==", "feed"),
          orderBy("date", "desc")
        );
        const snapF = await getDocs(qF);
        const fsFeeds = [];
        snapF.forEach((d) => {
          const x = d.data();
          const dt = x.date?.toDate ? x.date.toDate() : x.date ? new Date(x.date) : null;
          const iso = dt ? dt.toISOString().slice(0, 10) : null;
          const kg = Number(x.feedKg);
          if (!iso) return;
          fsFeeds.push({
            cloudId: d.id,
            date: iso,
            type: x.feedType || "balanceado",
            kg: Number.isFinite(kg) ? kg : null,
            desc: x.description || "",
            offline: false,
          });
        });
        const merged = mergeFeeds(fsFeeds, cf || []);
        setFeeds(merged);
        await writeFeedCache(animalId, merged);

        // sincroniza cola de alimentación pendiente
        await syncPendingFeeds(animalId);
      } catch {}
    })();
  }, [animalId]);

  // === Guardar peso (write-through caché)
  const saveWeight = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Alert.alert("Sesión", "Debes iniciar sesión.");
    if (!isValidYMD(wDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    const kg = Number(wKg);
    if (!Number.isFinite(kg) || kg <= 0) return Alert.alert("Peso", "Ingresa un peso válido (>0).");

    await addDoc(collection(db, "health"), {
      uid,
      animalId,
      type: "weight",
      date: parseYMD(wDate),
      valueKg: kg,
      createdAt: serverTimestamp(),
    });

    const next = [...weights, { date: wDate, kg }].sort((a, b) => a.date.localeCompare(b.date));
    setWeights(next);
    await writeWeightCache(animalId, next);

    setWKg("");
    Alert.alert("OK", "Peso guardado.");
  };

  // === Guardar evento sanitario (write-through caché)
  const saveEvent = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Alert.alert("Sesión", "Debes iniciar sesión.");
    if (!isValidYMD(eDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    if (!eType) return Alert.alert("Tipo", "Selecciona un tipo.");
    if (!eDesc.trim()) return Alert.alert("Descripción", "Agrega un detalle.");

    await addDoc(collection(db, "health"), {
      uid,
      animalId,
      type: eType,
      date: parseYMD(eDate),
      description: eDesc.trim(),
      createdAt: serverTimestamp(),
    });

    const next = [{ date: eDate, type: eType, desc: eDesc.trim() }, ...events];
    setEvents(next);
    await writeEventCache(animalId, next);

    setEDesc("");
    Alert.alert("OK", "Evento guardado.");
  };

  /* ===== Alimentación (con cola offline) ===== */
  const saveFeed = async () => {
    if (!isValidYMD(fDate)) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    if (!fType) return Alert.alert("Tipo", "Selecciona el tipo de alimento.");
    const kgNum = Number(fKg);
    if (!Number.isFinite(kgNum) || kgNum <= 0) return Alert.alert("Cantidad", "Ingresa kilos válidos (>0).");

    const net = await Network.getNetworkStateAsync();
    const uid = auth.currentUser?.uid || null;

    const localItem = { date: fDate, type: fType, kg: kgNum, desc: fDesc.trim() };

    // reflejo inmediato en UI + caché
    let cached = await readFeedCache(animalId);
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toCache = { ...localItem, localId, offline: !net?.isConnected || !uid };
    const merged = mergeFeeds([], [...cached, toCache]);
    setFeeds(merged);
    await writeFeedCache(animalId, merged);

    if (net?.isConnected && uid) {
      try {
        const ref = await addDoc(collection(db, "health"), {
          uid,
          animalId,
          type: "feed",
          date: parseYMD(fDate),
          feedType: fType,
          feedKg: kgNum,
          description: fDesc.trim(),
          createdAt: serverTimestamp(),
        });
        const after = merged.map((x) =>
          x.localId === localId ? { ...x, cloudId: ref.id, offline: false } : x
        );
        setFeeds(after);
        await writeFeedCache(animalId, after);
      } catch {
        await enqueueFeed(animalId, {
          action: "create",
          localId,
          payload: { ...localItem },
          enqueuedAt: new Date().toISOString(),
        });
      }
    } else {
      await enqueueFeed(animalId, {
        action: "create",
        localId,
        payload: { ...localItem },
        enqueuedAt: new Date().toISOString(),
      });
    }

    setFKg("");
    setFDesc("");
    Alert.alert("OK", "Alimentación registrada.");
  };

  async function enqueueFeed(animalId, record) {
    const q = await readQueue(animalId);
    q.unshift(record);
    await writeQueue(animalId, q);
  }
  async function syncPendingFeeds(animalId) {
    const net = await Network.getNetworkStateAsync();
    const uid = auth.currentUser?.uid || null;
    if (!net?.isConnected || !uid) return;

    const queue = await readQueue(animalId);
    if (!Array.isArray(queue) || queue.length === 0) return;

    const remaining = [];
    let cacheArr = await readFeedCache(animalId);

    for (const task of queue) {
      if (task.action !== "create") { remaining.push(task); continue; }
      try {
        const p = task.payload || {};
        const ref = await addDoc(collection(db, "health"), {
          uid,
          animalId,
          type: "feed",
          date: parseYMD(p.date),
          feedType: p.type,
          feedKg: Number(p.kg),
          description: String(p.desc || ""),
          createdAt: serverTimestamp(),
        });
        cacheArr = cacheArr.map((x) =>
          x.localId === task.localId ? { ...x, cloudId: ref.id, offline: false } : x
        );
      } catch {
        remaining.push(task);
      }
    }
    await writeFeedCache(animalId, cacheArr);
    setFeeds(cacheArr);
    await writeQueue(animalId, remaining);
  }

  // ====== memo original ======
  const chartData = useMemo(() => {
    if (!weights || weights.length === 0) return null;
    const last = [...weights].slice(-10);
    const labels = last.map((w) => w.date.slice(5));
    const data = last.map((w) => w.kg);
    return { labels, datasets: [{ data, strokeWidth: 2 }], legend: [`Peso (kg)`] };
  }, [weights]);

  const chartWidth = Math.min(Dimensions.get("window").width - 24, 700);
  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: () => "#843a3a",
    labelColor: () => "#6b7280",
    decimalPlaces: 0,
    propsForDots: { r: "3" },
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <View style={{ padding: 12 }}>
        <Text style={styles.title}>
          Ficha: #{earTag || "—"} {name ? `• ${name}` : ""}
        </Text>

        {/* Gráfico */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Evolución de peso</Text>
          {weights.length >= 2 ? (
            <PrettyWeightChartSpectacular data={weights.map((w) => ({ date: w.date, kg: w.kg }))} />
          ) : (
            <Text style={{ color: Colors.muted, fontWeight: "700" }}>
              Aún no hay suficientes pesos para graficar (necesitas 2+ registros).
            </Text>
          )}
        </View>

        {/* Registrar peso */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Registrar peso</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
              <TextInput value={wDate} onChangeText={setWDate} style={styles.input} />
            </View>
            <View style={{ width: 100 }}>
              <Text style={styles.label}>Kg</Text>
              <TextInput value={wKg} onChangeText={setWKg} keyboardType="numeric" style={styles.input} />
            </View>
          </View>
          <TouchableOpacity onPress={saveWeight} style={styles.saveBtn}>
            <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
            <Text style={styles.saveText}>Guardar peso</Text>
          </TouchableOpacity>
        </View>

        {/* Registrar evento sanitario */}
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

        {/* Registrar alimentación */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Registrar alimentación</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
              <TextInput value={fDate} onChangeText={setFDate} style={styles.input} />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>Kg</Text>
              <TextInput value={fKg} onChangeText={setFKg} keyboardType="numeric" style={styles.input} />
            </View>
          </View>

          <Text style={styles.label}>Tipo de alimento</Text>
          <View style={[styles.row, { gap: 8 }]}>
            {["balanceado", "maiz", "otro"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setFType(t)}
                style={[styles.chip, fType === t && { backgroundColor: Colors.green, borderColor: Colors.green }]}
              >
                <Text style={[styles.chipText, fType === t && { color: Colors.white }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Nota (opcional)</Text>
          <TextInput
            value={fDesc}
            onChangeText={setFDesc}
            placeholder="Detalle de la ración…"
            multiline
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
          />

          <TouchableOpacity onPress={saveFeed} style={styles.saveBtn}>
            <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
            <Text style={styles.saveText}>Guardar alimentación</Text>
          </TouchableOpacity>
        </View>

        {/* Listados */}
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

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Historial de alimentación</Text>
          {feeds.length === 0 ? (
            <Text style={{ color: Colors.muted, fontWeight: "700" }}>Sin registros.</Text>
          ) : (
            <View style={styles.listBox}>
              {feeds.map((f, i) => (
                <Text key={i} style={styles.listItem}>
                  {f.date} — {f.type} • {Number.isFinite(f.kg) ? `${f.kg} kg` : "—"}{f.desc ? ` • ${f.desc}` : ""}
                  {f.offline ? "  (offline)" : ""}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

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
