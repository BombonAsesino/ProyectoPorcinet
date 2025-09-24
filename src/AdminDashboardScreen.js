// src/AdminDashboardScreen.js
import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../database";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.08)",
  ok: "#16a34a",
  bad: "#dc2626",
};

function toDate(any) {
  if (!any) return null;
  if (any?.toDate) return any.toDate();
  if (typeof any === "number") return new Date(any);
  if (typeof any === "string") return new Date(any);
  return null;
}

export default function AdminDashboardScreen() {
  const [busy, setBusy] = useState(true);
  const [producers, setProducers] = useState([]);
  const [costs, setCosts] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setBusy(true);

        // ---- Producers (todos) ----
        const pSnap = await getDocs(collection(db, "producers"));
        const p = [];
        pSnap.forEach((d) => p.push({ id: d.id, ...d.data() }));
        setProducers(p);

        // ---- Costs últimos 30 días (todas las granjas) ----
        const ago = new Date();
        ago.setDate(ago.getDate() - 30);

        // Nota: un único filtro por 'date' evita índices compuestos.
        const cQ = query(collection(db, "costs"), where("date", ">=", ago));
        const cSnap = await getDocs(cQ);
        const c = [];
        cSnap.forEach((d) => c.push({ id: d.id, ...d.data() }));
        setCosts(c);
      } catch (e) {
        console.log("AdminDashboard load error", e);
      } finally {
        setBusy(false);
      }
    };
    fetchAll();
  }, []);

  // ===== KPIs =====
  const {
    totalProducers,
    herdTotal,
    avgHerd,
    newProducers30d,
    spend30d,
    byCat,
    calcOk,
  } = useMemo(() => {
    const totalProducers = producers.length;
    const herdTotal = producers.reduce((acc, it) => {
      const n = Number(it.herdSize);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
    const avgHerd = totalProducers > 0 ? herdTotal / totalProducers : 0;

    const now = new Date();
    const ago30 = new Date(now);
    ago30.setDate(now.getDate() - 30);
    const newProducers30d = producers.filter((it) => {
      const d = toDate(it.createdAt);
      return d && d >= ago30;
    }).length;

    const byCat = { Alimentación: 0, Salud: 0, Mantenimiento: 0, Otros: 0 };
    let spend30d = 0;
    costs.forEach((c) => {
      const amt = Number(c.amount);
      if (!Number.isFinite(amt) || amt <= 0) return;
      const cat = c.category || "Otros";
      if (byCat[cat] === undefined) byCat[cat] = 0;
      byCat[cat] += amt;
      spend30d += amt;
    });

    const sumCats = Object.values(byCat).reduce((a, b) => a + b, 0);
    const calcOk = Math.round(sumCats) === Math.round(spend30d);

    return { totalProducers, herdTotal, avgHerd, newProducers30d, spend30d, byCat, calcOk };
  }, [producers, costs]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.beige, padding: 16 }}>
      <Text style={styles.title}>Dashboard (últimos 30 días)</Text>

      {busy ? (
        <View style={{ paddingTop: 20 }}>
          <ActivityIndicator color={Colors.green} />
        </View>
      ) : (
        <>
          {/* KPIs principales */}
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.label}>Productores</Text>
              <Text style={styles.value}>{totalProducers}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Inventario total</Text>
              <Text style={styles.value}>{herdTotal}</Text>
              <Text style={styles.meta}>Promedio/granja: {avgHerd.toFixed(1)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Nuevos (30d)</Text>
              <Text style={styles.value}>{newProducers30d}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Gasto total (30d)</Text>
              <Text style={styles.value}>C$ {spend30d.toFixed(2)}</Text>
            </View>
          </View>

          {/* Breakdown por categoría */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Gastos por categoría (30d)</Text>
            {Object.keys(byCat).map((k) => (
              <View key={k} style={styles.row}>
                <Text style={styles.rowLabel}>{k}</Text>
                <Text style={styles.rowValue}>C$ {byCat[k].toFixed(2)}</Text>
              </View>
            ))}

            <View style={[styles.row, { borderTopWidth: 1, borderColor: Colors.border, paddingTop: 6, marginTop: 6 }]}>
              <Text style={[styles.rowLabel, { fontWeight: "900" }]}>TOTAL</Text>
              <Text style={[styles.rowValue, { fontWeight: "900" }]}>C$ {spend30d.toFixed(2)}</Text>
            </View>

            <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.badge, { backgroundColor: calcOk ? Colors.ok : Colors.bad }]} />
              <Text style={{ color: calcOk ? Colors.ok : Colors.bad, fontWeight: "800" }}>
                {calcOk ? "Validación OK" : "Revisar cálculos (las categorías no suman el total)"}
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: "900", fontSize: 18, color: Colors.text, marginBottom: 10 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flexGrow: 1,
    minWidth: "47%",
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  label: { color: Colors.muted, fontWeight: "800", marginBottom: 4 },
  value: { color: Colors.text, fontWeight: "900", fontSize: 20 },
  meta: { color: Colors.muted, fontWeight: "700", marginTop: 4, fontSize: 12 },

  block: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  blockTitle: { fontWeight: "900", color: Colors.text, marginBottom: 8 },

  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  rowLabel: { color: Colors.text, fontWeight: "800" },
  rowValue: { color: Colors.text, fontWeight: "800" },

  badge: { width: 10, height: 10, borderRadius: 5 },
});
