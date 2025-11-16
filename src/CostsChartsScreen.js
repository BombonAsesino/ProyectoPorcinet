// src/CostsChartsScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import { collection, query, where, getDocs } from "firebase/firestore";

// ✅ Usaremos react-native-chart-kit (ya está en tu package.json)
import { BarChart, LineChart } from "react-native-chart-kit";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
};

const CATEGORIES = ["Alimentación", "Salud", "Mantenimiento"];

const screenWidth = Dimensions.get("window").width;
const chartWidth = screenWidth - 32; // padding horizontal

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function normalizeDate(any) {
  if (!any) return new Date();
  if (any?.toDate) return any.toDate();
  if (any?.seconds != null) return new Date(any.seconds * 1000);
  if (typeof any === "string" || typeof any === "number") return new Date(any);
  return new Date(any);
}

function monthLabelFromKey(mk) {
  try {
    const [y, m] = mk.split("-").map((x) => parseInt(x, 10));
    const d = new Date(y, m - 1, 1);
    return d.toLocaleString("es-ES", { month: "short", year: "2-digit" });
  } catch {
    return mk;
  }
}

export default function CostsChartsScreen() {
  const [rawCosts, setRawCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      const u = auth.currentUser;
      if (!u) {
        setStatus("Debes iniciar sesión para ver los gráficos.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setStatus("Cargando datos de costos…");

        const qCosts = query(collection(db, "costs"), where("uid", "==", u.uid));
        const snap = await getDocs(qCosts);

        const list = [];
        snap.forEach((d) => {
          const data = d.data();
          const date = normalizeDate(data.date);
          const mk = data.monthKey || getMonthKey(date);
          list.push({
            id: d.id,
            amount: Number(data.amount || 0),
            category: data.category || "Alimentación",
            note: data.note || "",
            date,
            monthKey: mk,
          });
        });

        setRawCosts(list);
        setStatus("");
      } catch (e) {
        console.log("CostsChartsScreen/load error", e);
        setStatus("No se pudieron cargar los datos.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const {
    currentMonthKey,
    totalsByCategory,
    chartDataCategories,
    chartDataMonths,
    totalCurrentMonth,
  } = useMemo(() => {
    if (!rawCosts.length) {
      return {
        currentMonthKey: getMonthKey(new Date()),
        totalsByCategory: { Alimentación: 0, Salud: 0, Mantenimiento: 0 },
        chartDataCategories: [],
        chartDataMonths: [],
        totalCurrentMonth: 0,
      };
    }

    const now = new Date();
    const mkNow = getMonthKey(now);

    const catTotals = { Alimentación: 0, Salud: 0, Mantenimiento: 0 };
    const mapMonths = new Map();

    for (const c of rawCosts) {
      const mk = c.monthKey || getMonthKey(c.date);
      const amt = Number(c.amount || 0);

      const prev = mapMonths.get(mk) || 0;
      mapMonths.set(mk, prev + amt);

      if (mk === mkNow && catTotals[c.category] !== undefined) {
        catTotals[c.category] += amt;
      }
    }

    const chartCat = CATEGORIES.map((cat) => ({
      category: cat,
      amount: catTotals[cat] || 0,
    }));

    const sortedKeys = Array.from(mapMonths.keys()).sort();
    const chartMonths = sortedKeys.map((mk) => ({
      monthKey: mk,
      label: monthLabelFromKey(mk),
      total: mapMonths.get(mk) || 0,
    }));

    const totalCurrent = chartCat.reduce((acc, it) => acc + it.amount, 0);

    return {
      currentMonthKey: mkNow,
      totalsByCategory: catTotals,
      chartDataCategories: chartCat,
      chartDataMonths: chartMonths,
      totalCurrentMonth: totalCurrent,
    };
  }, [rawCosts]);

  // Config visual para chart-kit
  const chartConfig = {
    backgroundColor: Colors.beige,
    backgroundGradientFrom: Colors.white,
    backgroundGradientTo: Colors.white,
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(132, 58, 58, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: Colors.green,
    },
    propsForLabels: {
      fontWeight: "600",
    },
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.beige }}>
      {/* Encabezado simple */}
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="chart-bar"
          size={22}
          color={Colors.white}
        />
        <Text style={styles.headerTitle}>Gráficas de costos</Text>
      </View>

      {/* Distribución mes actual */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>
          Distribución del mes actual ({monthLabelFromKey(currentMonthKey)})
        </Text>
        <Text style={styles.helperText}>
          Muestra cuánto se gasta por categoría en el mes actual.
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 10 }} />
        ) : chartDataCategories.length === 0 ||
          chartDataCategories.every((d) => d.amount === 0) ? (
          <Text style={styles.emptyText}>
            Aún no hay gastos registrados para este mes.
          </Text>
        ) : (
          <>
            <BarChart
              style={{ marginTop: 10, borderRadius: 12 }}
              data={{
                labels: chartDataCategories.map((d) => d.category),
                datasets: [
                  {
                    data: chartDataCategories.map((d) => d.amount),
                  },
                ],
              }}
              width={chartWidth}
              height={240}
              fromZero
              chartConfig={chartConfig}
              showValuesOnTopOfBars
              verticalLabelRotation={-15}
            />

            <View style={{ marginTop: 10 }}>
              {chartDataCategories.map((item) => (
                <View key={item.category} style={styles.row}>
                  <Text style={styles.rowLabel}>{item.category}</Text>
                  <Text style={styles.rowValue}>
                    C$ {item.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
              <View
                style={[
                  styles.row,
                  {
                    borderTopWidth: 1,
                    borderColor: Colors.border,
                    marginTop: 4,
                    paddingTop: 4,
                  },
                ]}
              >
                <Text style={[styles.rowLabel, { fontWeight: "900" }]}>
                  TOTAL
                </Text>
                <Text style={[styles.rowValue, { fontWeight: "900" }]}>
                  C$ {totalCurrentMonth.toFixed(2)}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Evolución mensual */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Evolución mensual de costos</Text>
        <Text style={styles.helperText}>
          Muestra cómo ha variado el total de costos en los distintos meses.
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 10 }} />
        ) : chartDataMonths.length === 0 ? (
          <Text style={styles.emptyText}>
            Aún no hay datos suficientes para mostrar la evolución mensual.
          </Text>
        ) : (
          <>
            <LineChart
              style={{ marginTop: 10, borderRadius: 12 }}
              data={{
                labels: chartDataMonths.map((d) => d.label),
                datasets: [
                  {
                    data: chartDataMonths.map((d) => d.total),
                  },
                ],
              }}
              width={chartWidth}
              height={240}
              fromZero
              bezier
              chartConfig={chartConfig}
            />

            <View style={{ marginTop: 10 }}>
              {chartDataMonths.map((item) => (
                <View key={item.monthKey} style={styles.row}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowValue}>
                    C$ {item.total.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {status ? (
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: Colors.muted, fontWeight: "700" }}>
            {status}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: Colors.white,
    fontWeight: "900",
    fontSize: 16,
  },
  panel: {
    backgroundColor: Colors.white,
    margin: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontWeight: "900",
    fontSize: 15,
    color: Colors.text,
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "600",
  },
  emptyText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.muted,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  rowLabel: {
    fontWeight: "700",
    color: Colors.text,
  },
  rowValue: {
    fontWeight: "700",
    color: Colors.text,
  },
});
