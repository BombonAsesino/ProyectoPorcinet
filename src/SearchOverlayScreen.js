// src/SearchOverlayScreen.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { auth, db } from "../database";
import {
  collection,
  query as fsQuery,
  where,
  getDocs,
  orderBy as fsOrderBy,
  startAt as fsStartAt,
  endAt as fsEndAt,
  limit as fsLimit,
} from "firebase/firestore";
// arriba
import { searchHealthGlobal } from "./search/healthSearch";


// 🔎 búsqueda de cerdas (tu helper)
import { searchAnimalsGlobal } from "./search/animalsSearch";

// 📦 SQLite local (reutilizamos tu driver)
import { initDB, all } from "./db/database";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
};

function normalize(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SearchOverlayScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // Flags que vienen desde HomeApp (puedes encender/apagar por módulo)
  const enableAnimals = route?.params?.enableAnimals !== false; // default ON
  const enableCosts = route?.params?.enableCosts !== false;     // default ON

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  // Debounce
  const deb = useRef(null);
  useEffect(() => {
    if (deb.current) clearTimeout(deb.current);
    deb.current = setTimeout(() => {
      void performSearch(q);
    }, 250);
    return () => deb.current && clearTimeout(deb.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ===== LÓGICA DE BÚSQUEDA =====
  async function performSearch(text) {
    const n = normalize(text);
    if (!n) {
      setResults([]);
      setBusy(false);
      return;
    }

    setBusy(true);
    try {
      const merged = [];

      // ====== COSTOS / GASTOS ======
      if (enableCosts) {
        try {
          // 1) Local SQLite (prefijo/contiene vía LIKE sobre q)
          await initDB();
          const localRows = await all(
            `SELECT id, category, amount, notes AS note, date, cloud_id
               FROM costs
              WHERE deleted=0 AND q LIKE ?
              ORDER BY date DESC, id DESC
              LIMIT 60`,
            [`%${n}%`]
          );

          for (const r of localRows) {
            merged.push({
              _key: r.cloud_id ? `cost:${r.cloud_id}` : `cost:local:${r.id}`,
              kind: "cost",
              icon: "cash",
              title: `${r.category || "Gasto"} · C$ ${Number(r.amount || 0).toFixed(2)}`,
              subtitle: r.note || String(r.date || ""),
              // Al tocar, te llevo a la pantalla de Costos (si implementaste filtro interno, lo pasas)
              onPress: () => {
                Keyboard.dismiss();
                navigation.navigate("Costos", { initialQuery: text });
              },
            });
          }

          // 2) Firestore (prefijo rápido sobre q)
          const u = auth.currentUser;
          if (u) {
            try {
              const fq = fsQuery(
                collection(db, "costs"),
                where("uid", "==", u.uid),
                fsOrderBy("q"),
                fsStartAt(n),
                fsEndAt(n + "\uf8ff"),
                fsLimit(60)
              );
              const snap = await getDocs(fq);
              snap.forEach((d) => {
                const v = d.data() || {};
                merged.push({
                  _key: `cost:${d.id}`,
                  kind: "cost",
                  icon: "cash",
                  title: `${v.category || "Gasto"} · C$ ${Number(v.amount || 0).toFixed(2)}`,
                  subtitle: v.note || "",
                  onPress: () => {
                    Keyboard.dismiss();
                    navigation.navigate("Costos", { initialQuery: text });
                  },
                });
              });
            } catch {
              // sin red o falta índice: ignoramos remoto
            }
          }
        } catch {
          // si falla SQLite, continuamos con lo demás
        }
      }


// ===== SALUD / CRECIMIENTO =====
try {
  const animalsForNames = []; // si aquí puedes pasar tu lista de cerdas, mejor
  const health = await searchHealthGlobal(text, animalsForNames);
  results.push(...health);
} catch (e) {
  console.log("health search error:", e?.message || e);
}



      // ====== ANIMALES / CERDAS ======
      if (enableAnimals) {
        try {
          const animals = await searchAnimalsGlobal(text); // soporta prefijo (cer, cerd, cerda, nombre, arete)
          animals.forEach((a) => {
            const ear = a.earTag ? `#${a.earTag}` : null;
            const pieces = [ear, a.breed || "", a.status || ""].filter(Boolean);
            merged.push({
              _key: `animal:${a.id}`,
              kind: "animal",
              icon: "pig",
              title: a.name || ear || "Cerda",
              subtitle: pieces.join(" · "),
              onPress: () => {
                Keyboard.dismiss();
                // abre directamente la ficha
                navigation.navigate("ReproStack", {
                  screen: "PigForm",
                  params: { id: a.id },
                });
              },
            });
          });
        } catch {
          // ignorar errores de búsqueda de animales
        }
      }

      // De-dup por _key y listo
      const map = new Map();
      for (const it of merged) {
        if (!map.has(it._key)) map.set(it._key, it);
      }

      // Orden opcional: primero animales luego costos (o por título)
      const out = Array.from(map.values()).sort((a, b) => {
        if (a.kind !== b.kind) {
          // animales primero
          return a.kind === "animal" ? -1 : 1;
        }
        return (a.title || "").localeCompare(b.title || "");
      });

      setResults(out);
    } finally {
      setBusy(false);
    }
  }



  
  // ===== UI =====
  const headerRight = useMemo(() => {
    if (!q) return null;
    return (
      <TouchableOpacity onPress={() => setQ("")} style={{ padding: 6 }}>
        <MaterialCommunityIcons name="close-circle" size={20} color={Colors.muted} />
      </TouchableOpacity>
    );
  }, [q]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.beige }}>
      {/* Barra de búsqueda */}
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={22} color={Colors.text} />
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="Buscar… (ej. cerda, #arete, alimentación)"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {headerRight}
      </View>

      {/* Resultados */}
      {busy ? (
        <View style={{ paddingTop: 16, alignItems: "center" }}>
          <ActivityIndicator color={Colors.green} />
          <Text style={{ color: Colors.muted, marginTop: 6, fontWeight: "700" }}>Buscando…</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(it) => it._key}
          contentContainerStyle={{ padding: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultCard} onPress={item.onPress}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons
                  name={item.icon === "pig" ? "pig-variant" : "cash"}
                  size={22}
                  color={Colors.green}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                {!!item.subtitle && (
                  <Text style={styles.resultSub} numberOfLines={1}>{item.subtitle}</Text>
                )}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.muted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            q ? (
              <Text style={{ color: Colors.muted, textAlign: "center", marginTop: 18, fontWeight: "700" }}>
                Sin resultados para “{q}”.
              </Text>
            ) : (
              <Text style={{ color: Colors.muted, textAlign: "center", marginTop: 18, fontWeight: "700" }}>
                Escribe para buscar en cerdas y en costos.
              </Text>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    margin: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontWeight: "800",
    color: Colors.text,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f2e8e8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultTitle: { color: Colors.text, fontWeight: "900" },
  resultSub: { color: Colors.muted, fontWeight: "700" },
});
