// src/DashboardApp.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, realtimeDb } from "../database";
// 👇 agregado "update"
import { ref, onValue, set, push, update } from "firebase/database";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.08)",
  ok: "#843a3a",
  warn: "#eab308",
  bad: "#843a3a",
};

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/* ---------------------------
   UTILIDADES
--------------------------------*/
function parseDateFlexible(v) {
  if (v == null) return null;
  if (typeof v === "number") return new Date(v);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function isoToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function makeLast6MonthsBuckets(now = new Date()) {
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: MONTHS_ES[d.getMonth()],
      farrowings: 0,
      weaned: 0,
      mortality: 0,
    });
  }
  return out;
}

/* ---------------------------
   BACKEND: RTDB -> Estado
--------------------------------*/
function useRealtimeDashboardData() {
  const [herd, setHerd] = useState({ total: 0, sows: 0, boars: 0, growers: 0 });
  const [production, setProduction] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    const herdRef = ref(realtimeDb, `producers/${u.uid}/herd`);
    const evRef = ref(realtimeDb, `producers/${u.uid}/events`);

    const offHerd = onValue(
      herdRef,
      (snap) => {
        const v = snap.val() || {};
        setHerd({
          total: Number(v.total ?? 0),
          sows: Number(v.sows ?? 0),
          boars: Number(v.boars ?? 0),
          growers: Number(v.growers ?? 0),
        });
      },
      () => {}
    );

    const offEvents = onValue(
      evRef,
      (snap) => {
        const all = snap.val() || {};
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const buckets = makeLast6MonthsBuckets(now);

        Object.values(all).forEach((ev) => {
          const d = parseDateFlexible(ev.date);
          if (!d) return;
          if (d < start || d > now) return;

          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const idx = buckets.findIndex((b) => b.key === key);
          if (idx === -1) return;

          const count = Number(ev.count ?? 0);
          switch (ev.type) {
            case "farrowing":
              buckets[idx].farrowings += count || 1; // si no viene count, asumimos 1 parto
              break;
            case "weaning":
              buckets[idx].weaned += Math.max(0, count);
              break;
            case "death":
              buckets[idx].mortality += Math.max(0, count);
              break;
            default:
              break;
          }
        });

        setProduction(buckets);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      offHerd();
      offEvents();
    };
  }, []);

  return { herd, production, loading };
}

/* ---------------------------
   CÁLCULO DE MÉTRICAS
--------------------------------*/
function computeMetrics(herd, production) {
  const months = Math.max(production.length, 1);
  const totalWeaned = production.reduce((a, b) => a + b.weaned, 0);
  const totalFarrows = production.reduce((a, b) => a + b.farrowings, 0);
  const totalMortality = production.reduce((a, b) => a + b.mortality, 0);

  const weanedPerSowMonth = herd.sows > 0 ? (totalWeaned / herd.sows) / months : 0;
  const productivityPct = Math.min(100, Math.round((weanedPerSowMonth / 4.5) * 100));
  const farrowRate = herd.sows > 0 ? Math.round(((totalFarrows / months) / herd.sows) * 100) : 0;
  const avgMortality = Math.round(totalMortality / months);

  return {
    herd,
    totals: { totalWeaned, totalFarrows, totalMortality },
    kpis: { productivityPct, farrowRate, avgMortality },
    trends: {
      trendWeaned: production.map((p) => p.weaned),
      trendFarrow: production.map((p) => p.farrowings),
      trendMort: production.map((p) => p.mortality),
      labels: production.map((p) => p.month),
    },
  };
}

/* ---------------------------
   QA
--------------------------------*/
function runAccuracyTests(herd, production, kpis) {
  return [
    {
      name: "Coherencia del hato (sumas)",
      pass:
        Number(herd.sows ?? 0) +
          Number(herd.boars ?? 0) +
          Number(herd.growers ?? 0) === Number(herd.total ?? 0),
    },
    {
      name: "Valores no negativos",
      pass:
        (herd.total ?? 0) >= 0 &&
        production.every(
          (p) => p.farrowings >= 0 && p.weaned >= 0 && p.mortality >= 0
        ),
    },
    {
      name: "Productividad en rango",
      pass: kpis.productivityPct >= 0 && kpis.productivityPct <= 100,
      info: `${kpis.productivityPct}%`,
    },
    {
      name: "Mortalidad razonable",
      pass: kpis.avgMortality < 50,
      info: `prom. ${kpis.avgMortality}/mes`,
    },
  ];
}

/* ---------------------------
   MINI GRÁFICOS
--------------------------------*/
function MiniBars({ data = [], maxHeight = 42 }) {
  const max = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
      {data.map((v, i) => {
        const h = Math.max(4, (v / max) * maxHeight);
        return (
          <View
            key={i}
            style={{ width: 10, height: h, backgroundColor: Colors.green, borderRadius: 3 }}
          />
        );
      })}
    </View>
  );
}

/* ---------------------------
   PANTALLA (con captura)
--------------------------------*/
export function ProductivityDashboardScreen() {
  const { herd, production, loading } = useRealtimeDashboardData();
  const metrics = useMemo(() => computeMetrics(herd, production), [herd, production]);
  const tests = useMemo(() => runAccuracyTests(herd, production, metrics.kpis), [herd, production, metrics.kpis]);

  // 👇 NUEVO: publicar productividad en RTDB para que Home la lea
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const pct = Number(metrics?.kpis?.productivityPct ?? 0);
    if (!Number.isFinite(pct)) return;
    update(ref(realtimeDb, `producers/${u.uid}/metrics`), {
      productivityPct: Math.max(0, Math.min(100, Math.round(pct))),
      lastComputedAt: Date.now(),
    }).catch(() => {});
  }, [metrics?.kpis?.productivityPct]);

  // --- Captura rápida (evento)
  const [dateStr, setDateStr] = useState(isoToday());
  const [cntFarrow, setCntFarrow] = useState("1");
  const [cntWeaned, setCntWeaned] = useState("10");
  const [cntDeath, setCntDeath] = useState("1");

  // --- Editar hato
  const [hTotal, setHTotal] = useState("");
  const [hSows, setHSows] = useState("");
  const [hBoars, setHBoars] = useState("");
  const [hGrowers, setHGrowers] = useState("");

  useEffect(() => {
    // sincroniza inputs de hato con valores actuales (para editar)
    setHTotal(String(herd.total ?? 0));
    setHSows(String(herd.sows ?? 0));
    setHBoars(String(herd.boars ?? 0));
    setHGrowers(String(herd.growers ?? 0));
  }, [herd.total, herd.sows, herd.boars, herd.growers]);

  const addEvent = async (type, countStr) => {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Sesión", "Debes iniciar sesión.");

    const count = parseInt(String(countStr).trim(), 10);
    if (!Number.isFinite(count) || count < 0) {
      return Alert.alert("Valor inválido", "Ingresa un número válido.");
    }
    const d = parseDateFlexible(dateStr);
    if (!d) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");

    try {
      const evRef = ref(realtimeDb, `producers/${u.uid}/events`);
      await push(evRef, {
        type,             // "farrowing" | "weaning" | "death"
        count,
        date: d.toISOString(), // ISO
        createdAt: Date.now(),
      });
      Alert.alert("Guardado", "Evento registrado.");
    } catch (e) {
      console.error("addEvent error", e);
      Alert.alert("Error", "No se pudo guardar el evento.");
    }
  };

  const saveHerd = async () => {
    const u = auth.currentUser;
    if (!u) return Alert.alert("Sesión", "Debes iniciar sesión.");

    const total = parseInt(hTotal, 10);
    const sows = parseInt(hSows, 10);
    const boars = parseInt(hBoars, 10);
    const growers = parseInt(hGrowers, 10);
    const valid =
      [total, sows, boars, growers].every((n) => Number.isFinite(n) && n >= 0);

    if (!valid) return Alert.alert("Datos inválidos", "Revisa que todos sean números válidos.");

    try {
      await set(ref(realtimeDb, `producers/${u.uid}/herd`), {
        total,
        sows,
        boars,
        growers,
        updatedAt: Date.now(),
      });
      Alert.alert("Guardado", "Hato actualizado.");
    } catch (e) {
      console.error("saveHerd error", e);
      Alert.alert("Error", "No se pudo guardar el hato.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.beige }}
      contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={true}
      bounces={true}
    >
      {/* KPIs */}
      <View style={styles.rowChips}>
        <KpiCard label="Cerdos totales" value={herd.total} />
        <KpiCard label="Productividad" value={loading ? "..." : `${metrics.kpis.productivityPct}%`} />
        <KpiCard label="Madres" value={herd.sows} />
      </View>

      {/* Resumen + Tendencias */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Resumen de productividad</Text>

        <View style={styles.itemRow}>
          <Info label="Tasa de partos" value={`${metrics.kpis.farrowRate}%`} />
          <MiniGraph title="Partos" data={metrics.trends.trendFarrow} labels={metrics.trends.labels} />
        </View>

        <View style={styles.itemRow}>
          <Info label="Lechones destetados (6m)" value={metrics.totals.totalWeaned} />
          <MiniGraph title="Destetados" data={metrics.trends.trendWeaned} labels={metrics.trends.labels} />
        </View>

        <View style={styles.itemRow}>
          <Info label="Mortalidad prom./mes" value={metrics.kpis.avgMortality} />
          <MiniGraph title="Mortalidad" data={metrics.trends.trendMort} labels={metrics.trends.labels} />
        </View>
      </View>

      {/* Captura rápida de eventos */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Captura rápida (últimos 6m)</Text>

        <View style={{ gap: 8 }}>
          <Text style={styles.smallLabel}>Fecha (YYYY-MM-DD)</Text>
          <TextInput
            value={dateStr}
            onChangeText={setDateStr}
            placeholder="YYYY-MM-DD"
            style={styles.input}
          />
        </View>

        <View style={styles.quickRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Partos (+)</Text>
            <TextInput
              value={cntFarrow}
              onChangeText={setCntFarrow}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: Colors.green }]}
            onPress={() => addEvent("farrowing", cntFarrow)}
          >
            <MaterialCommunityIcons name="plus-circle" size={18} color={Colors.white} />
            <Text style={styles.smallBtnText}>Registrar parto</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Destetados (+)</Text>
            <TextInput
              value={cntWeaned}
              onChangeText={setCntWeaned}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: Colors.green }]}
            onPress={() => addEvent("weaning", cntWeaned)}
          >
            <MaterialCommunityIcons name="plus-circle" size={18} color={Colors.white} />
            <Text style={styles.smallBtnText}>Registrar destete</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Bajas / muertes (+)</Text>
            <TextInput
              value={cntDeath}
              onChangeText={setCntDeath}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: Colors.bad }]}
            onPress={() => addEvent("death", cntDeath)}
          >
            <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.white} />
            <Text style={styles.smallBtnText}>Registrar baja</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Editar hato */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Hato (editar)</Text>

        <View style={styles.grid2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Total</Text>
            <TextInput value={hTotal} onChangeText={setHTotal} keyboardType="number-pad" style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Madres</Text>
            <TextInput value={hSows} onChangeText={setHSows} keyboardType="number-pad" style={styles.input} />
          </View>
        </View>

        <View style={styles.grid2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Machos</Text>
            <TextInput value={hBoars} onChangeText={setHBoars} keyboardType="number-pad" style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Recría</Text>
            <TextInput value={hGrowers} onChangeText={setHGrowers} keyboardType="number-pad" style={styles.input} />
          </View>
        </View>

        <TouchableOpacity style={styles.btn} onPress={saveHerd}>
          <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
          <Text style={styles.btnText}>Guardar hato</Text>
        </TouchableOpacity>
      </View>

      {/* QA */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Pruebas de exactitud</Text>
        {tests.map((t, i) => (
          <View key={i} style={styles.testRow}>
            <MaterialCommunityIcons
              name={t.pass ? "check-circle" : "close-circle"}
              size={18}
              color={t.pass ? Colors.ok : Colors.bad}
            />
            <Text style={[styles.testText, { color: t.pass ? Colors.ok : Colors.bad }]}>
              {t.pass ? "PASA" : "FALLA"} – {t.name}
              {t.info ? ` (${t.info})` : ""}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ---------------------------
   SUB-COMPONENTES
--------------------------------*/
function KpiCard({ label, value }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Info({ label, value }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: Colors.muted, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: Colors.text, fontWeight: "900", fontSize: 18 }}>{value}</Text>
    </View>
  );
}

function MiniGraph({ title, data, labels }) {
  return (
    <View style={{ alignItems: "flex-end", gap: 6 }}>
      <Text style={{ color: Colors.muted, fontWeight: "800" }}>{title}</Text>
      <MiniBars data={data} />
      <Text style={{ color: Colors.muted, fontSize: 11 }}>{labels.join("  ")}</Text>
    </View>
  );
}

/* ---------------------------
   ESTILOS (se mantienen tu estética/paneles)
--------------------------------*/
const styles = StyleSheet.create({
  rowChips: { flexDirection: "row", justifyContent: "space-between" },
  kpiCard: {
    width: "32%",
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiLabel: { fontSize: 12, color: Colors.muted, fontWeight: "800" },
  kpiValue: { fontSize: 18, fontWeight: "900", color: Colors.text, marginBottom: 4 },

  panel: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 14,
    gap: 14,
  },
  panelTitle: { fontSize: 16, fontWeight: "900", color: Colors.text },

  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  btn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: { color: Colors.white, fontWeight: "900" },

  testRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  testText: { fontWeight: "800" },

  // Captura rápida / Hato
  smallLabel: { color: Colors.muted, fontWeight: "800", fontSize: 12 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#D6D3C8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },
  quickRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  smallBtn: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  smallBtnText: { color: Colors.white, fontWeight: "900" },
  grid2: { flexDirection: "row", gap: 10 },
});
