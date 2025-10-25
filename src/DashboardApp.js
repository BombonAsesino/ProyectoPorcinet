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
  DeviceEventEmitter, // ⬅️ nuevo: broadcast inmediato al Home
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, realtimeDb } from "../database";
import { ref, onValue, set, push, update } from "firebase/database";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.08)",
  ok: "#2e7d32",
  warn: "#eab308",
  bad: "#b42318",
};

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const YEARS_AVAILABLE = [2025, 2026, 2027, 2028, 2029, 2030];

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
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function makeBucketsForHalf(year, startMonth) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const m = startMonth + i;
    const d = new Date(year, m, 1);
    out.push({
      key: monthKey(d),
      month: MONTHS_ES[d.getMonth()],
      farrowings: 0,
      weaned: 0,
      mortality: 0,
      start: new Date(year, m, 1),
      end: new Date(year, m + 1, 0),
    });
  }
  return out;
}

function useRealtimeDashboardData() {
  const [herd, setHerd] = useState({ total: 0, sows: 0, boars: 0, growers: 0 });
  const [eventsAll, setEventsAll] = useState([]);
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
        const arr = [];
        snap.forEach((child) => {
          const v = child.val() || {};
          const d = parseDateFlexible(v.date);
          if (!d) return;
          arr.push({
            id: child.key,
            type: v.type,
            count: Number(v.count ?? 0),
            date: d,
            createdAt: Number(v.createdAt ?? 0),
          });
        });
        setEventsAll(arr);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      offHerd();
      offEvents();
    };
  }, []);

  return { herd, eventsAll, loading };
}

function computeHalfMetrics(herd, eventsAll, startMonth, year = 2025) {
  const buckets = makeBucketsForHalf(year, startMonth);
  const startWindow = buckets[0].start;
  const endWindow = buckets[buckets.length - 1].end;

  eventsAll.forEach((ev) => {
    const d = ev.date;
    if (!d || d < startWindow || d > endWindow) return;
    const key = monthKey(d);
    const idx = buckets.findIndex((b) => b.key === key);
    if (idx === -1) return;
    const count = Number(ev.count ?? 0);
    if (ev.type === "farrowing") buckets[idx].farrowings += count || 1;
    if (ev.type === "weaning")  buckets[idx].weaned += Math.max(0, count);
    if (ev.type === "death")    buckets[idx].mortality += Math.max(0, count);
  });

  const totalWeaned = buckets.reduce((a, b) => a + b.weaned, 0);
  const totalFarrows = buckets.reduce((a, b) => a + b.farrowings, 0);
  const totalMortality = buckets.reduce((a, b) => a + b.mortality, 0);

  const months = Math.max(buckets.length, 1);
  const avgWeanedPerMonth = totalWeaned / months;
  const avgFarrowPerMonth = totalFarrows / months;
  const avgMortality = Math.round(totalMortality / months);

  const weanedPerSowMonth = herd.sows > 0 ? avgWeanedPerMonth / herd.sows : 0;
  const farrowRate = herd.sows > 0 ? Math.round((avgFarrowPerMonth / herd.sows) * 100) : 0;
  const mortPct = herd.total > 0 ? Math.round((avgMortality / herd.total) * 100) : 0;
  const productivityPct = Math.min(100, Math.round((weanedPerSowMonth / 4.5) * 100));

  const label =
    startMonth === 0 ? `Enero ${year} – Junio ${year}` : `Julio ${year} – Diciembre ${year}`;

  return {
    buckets,
    windowLabel: label,
    totals: { totalWeaned, totalFarrows, totalMortality },
    avgs: { avgWeanedPerMonth, avgFarrowPerMonth, avgMortality },
    kpis: { productivityPct, farrowRate, mortPct, weanedPerSowMonth },
    window: { startWindow, endWindow },
  };
}

function pctColor(pct, mode = "positive") {
  const n = Number(pct) || 0;
  if (mode === "negative") {
    if (n > 85) return Colors.bad;
    if (n >= 60) return Colors.warn;
    return Colors.ok;
  } else {
    if (n < 60) return Colors.bad;
    if (n <= 85) return Colors.warn;
    return Colors.ok;
  }
}

export function ProductivityDashboardScreen() {
  const { herd, eventsAll, loading } = useRealtimeDashboardData();

  const [selectedYear, setSelectedYear] = useState(2025);
  const [startMonth, setStartMonth] = useState(0);

  const metrics = useMemo(
    () => computeHalfMetrics(herd, eventsAll, startMonth, selectedYear),
    [herd, eventsAll, startMonth, selectedYear]
  );

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

  const [dateStr, setDateStr] = useState(isoToday());
  const [cntFarrow, setCntFarrow] = useState("1");
  const [cntWeaned, setCntWeaned] = useState("10");
  const [cntDeath, setCntDeath] = useState("1");

  const [hTotal, setHTotal] = useState("");
  const [hSows, setHSows] = useState("");
  const [hBoars, setHBoars] = useState("");
  const [hGrowers, setHGrowers] = useState("");

  useEffect(() => {
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");
    }
    const d = parseDateFlexible(dateStr);
    if (!d) return Alert.alert("Fecha", "Usa formato YYYY-MM-DD.");

    try {
      const evRef = ref(realtimeDb, `producers/${u.uid}/events`);
      await push(evRef, {
        type,
        count,
        date: d.toISOString(),
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
    const valid = [total, sows, boars, growers].every((n) => Number.isFinite(n) && n >= 0);

    if (!valid) return Alert.alert("Datos inválidos", "Revisa que todos sean números válidos.");

    try {
      await set(ref(realtimeDb, `producers/${u.uid}/herd`), {
        total,
        sows,
        boars,
        growers,
        updatedAt: Date.now(),
      });

      // 🔔 Broadcast inmediato al Home (sin esperar onValue ni cambiar de pestaña)
      DeviceEventEmitter.emit("herd:updated", { total, sows, boars, growers });

      Alert.alert("Guardado", "Hato actualizado.");
    } catch (e) {
      console.error("saveHerd error", e);
      Alert.alert("Error", "No se pudo guardar el hato.");
    }
  };

  const { startWindow, endWindow } = metrics.window || {};
  const eventsInWindowAll = useMemo(() => {
    if (!startWindow || !endWindow) return [];
    return eventsAll
      .filter((e) => e.date >= startWindow && e.date <= endWindow)
      .sort((a, b) => b.date - a.date);
  }, [eventsAll, startWindow, endWindow]);

  const [bulkDeleted, setBulkDeleted] = useState(null);
  const [bulkUndoVisible, setBulkUndoVisible] = useState(false);
  const [bulkUndoTimer, setBulkUndoTimer] = useState(null);

  const deleteSemester = async () => {
    const u = auth.currentUser;
    if (!u) return;

    const count = eventsInWindowAll.length;
    if (count === 0) {
      Alert.alert("Sin registros", "No hay eventos en este semestre.");
      return;
    }

    const confirmText =
      `¿Eliminar TODOS los ${count} registros de ` +
      (startMonth === 0 ? `Enero–Junio ${selectedYear}` : `Julio–Diciembre ${selectedYear}`) +
      `? Esta acción se puede deshacer.`;

    Alert.alert("Eliminar semestre (6 meses)", confirmText, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar todo",
        style: "destructive",
        onPress: async () => {
          try {
            const items = eventsInWindowAll.map((evt) => ({
              id: evt.id,
              data: {
                type: evt.type,
                count: evt.count,
                date: evt.date.toISOString(),
                createdAt: evt.createdAt || Date.now(),
              },
            }));
            setBulkDeleted({
              items,
              windowLabel: startMonth === 0 ? `Ene–Jun ${selectedYear}` : `Jul–Dic ${selectedYear}`,
            });

            const updates = {};
            items.forEach((it) => {
              updates[`producers/${u.uid}/events/${it.id}`] = null;
            });
            await update(ref(realtimeDb), updates);

            setBulkUndoVisible(true);
            if (bulkUndoTimer) clearTimeout(bulkUndoTimer);
            const t = setTimeout(() => {
              setBulkUndoVisible(false);
              setBulkDeleted(null);
            }, 15000);
            setBulkUndoTimer(t);
          } catch (e) {
            console.error("deleteSemester error", e);
            Alert.alert("Error", "No se pudo eliminar el semestre.");
          }
        },
      },
    ]);
  };

  const undoDeleteSemester = async () => {
    const u = auth.currentUser;
    if (!u || !bulkDeleted?.items?.length) return;

    try {
      const updates = {};
      bulkDeleted.items.forEach((it) => {
        updates[`producers/${u.uid}/events/${it.id}`] = it.data;
      });
      await update(ref(realtimeDb), updates);

      setBulkUndoVisible(false);
      setBulkDeleted(null);
      if (bulkUndoTimer) clearTimeout(bulkUndoTimer);
      Alert.alert("Restaurado", "Se devolvieron todos los registros del semestre.");
    } catch (e) {
      console.error("undoDeleteSemester error", e);
      Alert.alert("Error", "No se pudo devolver el semestre.");
    }
  };

  const colorProd = pctColor(metrics.kpis.productivityPct, "positive");
  const colorFarrowRate = pctColor(metrics.kpis.farrowRate, "positive");
  const colorMortPct = pctColor(metrics.kpis.mortPct, "negative");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.beige }}
      contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 160 }}
      showsVerticalScrollIndicator
    >
      {/* KPIs */}
      <View style={styles.rowChips}>
        <KpiCard icon="pig-variant" label="Cerdos" value={herd.total} />
        <KpiCard icon="gender-female" label="Madres" value={herd.sows} />
        <KpiCard
          icon="chart-areaspline"
          label="Productividad"
          value={loading ? "..." : `${metrics.kpis.productivityPct}%`}
          valueColor={colorProd}
        />
      </View>

      {/* Selector año/semestre */}
      <View style={{ marginTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {YEARS_AVAILABLE.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.yearBtn, selectedYear === y && styles.yearBtnActive]}
              onPress={() => setSelectedYear(y)}
            >
              <Text style={[styles.yearText, selectedYear === y && styles.yearTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.windowHeader}>
          <TouchableOpacity
            style={[styles.halfBtn, startMonth === 0 && styles.halfBtnActive]}
            onPress={() => setStartMonth(0)}
          >
            <Text style={[styles.halfText, startMonth === 0 && styles.halfTextActive]}>
              Ene–Jun {selectedYear}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.halfBtn, startMonth === 6 && styles.halfBtnActive]}
            onPress={() => setStartMonth(6)}
          >
            <Text style={[styles.halfText, startMonth === 6 && styles.halfTextActive]}>
              Jul–Dic {selectedYear}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resumen ventana */}
      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <Text style={styles.panelTitle}>
            {startMonth === 0
              ? `Enero ${selectedYear} – Junio ${selectedYear}`
              : `Julio ${selectedYear} – Diciembre ${selectedYear}`}
          </Text>
        </View>

        <Row label="Destetados totales" value={metrics.totals.totalWeaned} />
        <Row label="Destetados / mes" value={Math.round(metrics.avgs.avgWeanedPerMonth)} />
        <Row label="Por madre / mes" value={metrics.kpis.weanedPerSowMonth.toFixed(2)} hint="Meta 4.5" />

        <Separator />

        <Row label="Partos totales" value={metrics.totals.totalFarrows} />
        <Row label="Partos / mes" value={Math.round(metrics.avgs.avgFarrowPerMonth)} />
        <Row label="Tasa de partos" value={`${metrics.kpis.farrowRate}%`} valueStyle={{ color: colorFarrowRate }} />

        <Separator />

        <Row label="Bajas totales" value={metrics.totals.totalMortality} />
        <Row label="Mortalidad / mes" value={metrics.avgs.avgMortality} />
        <Row label="% del hato / mes" value={`${metrics.kpis.mortPct}%`} valueStyle={{ color: colorMortPct }} />
      </View>

      {/* Barra deshacer masivo */}
      {bulkUndoVisible && bulkDeleted ? (
        <View style={[styles.undoBar, { backgroundColor: "#111827" }]}>
          <Text style={{ color: Colors.white, fontWeight: "800", flex: 1 }} numberOfLines={2}>
            Se eliminaron todos los registros de {bulkDeleted.windowLabel}. ¿Devolver?
          </Text>
          <TouchableOpacity style={styles.undoBtn} onPress={undoDeleteSemester}>
            <Text style={{ color: Colors.green, fontWeight: "900" }}>DESHACER</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Actividad por mes */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Actividad por mes</Text>
        <View style={styles.table}>
          <View style={[styles.tr, { backgroundColor: "#f3efe5" }]}>
            <Text style={[styles.th, { flex: 1.2 }]}>Mes</Text>
            <Text style={styles.th}>Partos</Text>
            <Text style={styles.th}>Destetados</Text>
            <Text style={styles.th}>Bajas</Text>
          </View>
          {metrics.buckets.map((r, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.td, { flex: 1.2 }]}>{r.month}</Text>
              <Text style={styles.td}>{r.farrowings}</Text>
              <Text style={styles.td}>{r.weaned}</Text>
              <Text style={styles.td}>{r.mortality}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Captura rápida */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Captura rápida</Text>

        <Text style={styles.smallLabel}>Fecha (YYYY-MM-DD)</Text>
        <TextInput value={dateStr} onChangeText={setDateStr} placeholder="YYYY-MM-DD" style={styles.input} />

        <View style={styles.quickRow}>
          <NumberInput label="Partos (+)" value={cntFarrow} setValue={setCntFarrow} />
          <SmallBtn label="Registrar parto" icon="plus-circle" onPress={() => addEvent("farrowing", cntFarrow)} />
        </View>

        <View style={styles.quickRow}>
          <NumberInput label="Destetados (+)" value={cntWeaned} setValue={setCntWeaned} />
          <SmallBtn label="Registrar destete" icon="plus-circle" onPress={() => addEvent("weaning", cntWeaned)} />
        </View>

        <View style={styles.quickRow}>
          <NumberInput label="Bajas / muertes (+)" value={cntDeath} setValue={setCntDeath} />
          <SmallBtn label="Registrar baja" icon="alert-circle" bad onPress={() => addEvent("death", cntDeath)} />
        </View>
      </View>

      {/* Hato */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Hato</Text>

        <View style={styles.grid2}>
          <LabeledNumber label="Total" value={hTotal} setValue={setHTotal} />
          <LabeledNumber label="Madres" value={hSows} setValue={setHSows} />
        </View>

        <View style={styles.grid2}>
          <LabeledNumber label="Machos" value={hBoars} setValue={setHBoars} />
          <LabeledNumber label="Recría" value={hGrowers} setValue={setHGrowers} />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveHerd}>
            <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
            <Text style={styles.btnText}>Guardar hato</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={deleteSemester}>
            <MaterialCommunityIcons name="delete-sweep" size={18} color={Colors.white} />
            <Text style={styles.btnText}>Eliminar semestre </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function KpiCard({ label, value, icon, valueColor }) {
  return (
    <View style={styles.kpiCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon ? <MaterialCommunityIcons name={icon} size={16} color={Colors.green} /> : null}
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      <Text style={[styles.kpiValue, valueColor ? { color: valueColor } : null]}>
        {String(value)}
      </Text>
    </View>
  );
}
function Row({ label, value, hint, valueStyle }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
        <Text style={[styles.value, valueStyle]}>{value}</Text>
      </View>
    </View>
  );
}
function Separator() {
  return <View style={styles.sep} />;
}
function NumberInput({ label, value, setValue }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        style={styles.input}
      />
    </View>
  );
}
function SmallBtn({ label, icon, onPress, bad }) {
  return (
    <TouchableOpacity
      style={[styles.smallBtn, { backgroundColor: bad ? Colors.bad : Colors.green }]}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={18} color={Colors.white} />
      <Text style={styles.smallBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}
function LabeledNumber({ label, value, setValue }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput value={value} onChangeText={setValue} keyboardType="number-pad" style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  rowChips: { flexDirection: "row", justifyContent: "space-between" },

  kpiCard: {
    width: "32%",
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "space-between",
  },
  kpiLabel: { fontSize: 12, color: Colors.muted, fontWeight: "800" },
  kpiValue: { fontSize: 18, fontWeight: "900", color: Colors.text, marginTop: 4 },

  yearBtn: {
    backgroundColor: "#6e2f2f",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  yearBtnActive: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.green,
  },
  yearText: { color: Colors.white, fontWeight: "900" },
  yearTextActive: { color: Colors.green },

  windowHeader: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    padding: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  halfBtn: {
    flex: 1,
    backgroundColor: "#6e2f2f",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  halfBtnActive: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.green,
  },
  halfText: { color: Colors.white, fontWeight: "900" },
  halfTextActive: { color: Colors.green },

  panel: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 14,
    gap: 10,
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  panelTitle: { fontSize: 16, fontWeight: "900", color: Colors.text },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: Colors.muted, fontWeight: "800" },
  value: { color: Colors.text, fontWeight: "900" },
  hint: { color: Colors.muted, fontWeight: "700", fontSize: 11 },
  sep: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },

  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  th: { flex: 1, fontWeight: "900", color: Colors.text },
  td: { flex: 1, fontWeight: "800", color: Colors.text },

  undoBar: {
    marginHorizontal: 16,
    marginTop: 6,
    backgroundColor: "#1f2937",
    padding: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  undoBtn: {
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

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
  quickRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 8 },
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

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnPrimary: { backgroundColor: Colors.green },
  btnDanger: { backgroundColor: Colors.bad },
  btnText: { color: Colors.white, fontWeight: "900" },
});

export default ProductivityDashboardScreen;
