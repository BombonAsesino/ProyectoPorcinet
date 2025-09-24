// src/ProducersList.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { db, auth } from "../database";
import { signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.08)",
};

export default function ProducersList({ navigation }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "producers"), orderBy("createdAt", "desc"));
    const off = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setItems(arr);
        setBusy(false);
      },
      () => setBusy(false)
    );
    return () => off();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (e) {
      console.error("❌ Error al cerrar sesión:", e);
    }
  };

  const renderItem = ({ item }) => {
    const created =
      item.createdAt?.toDate
        ? item.createdAt.toDate()
        : (item.createdAt ? new Date(item.createdAt) : null);

    return (
      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={26} color={Colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name || "—"}</Text>
            <Text style={styles.email} numberOfLines={1}>{item.email || "—"}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Teléfono</Text>
          <Text style={styles.value}>{item.phone || "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>N° Granja</Text>
          <Text style={styles.value}>{item.farmNumber || "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cerdos actuales</Text>
          <Text style={styles.value}>
            {Number.isFinite(item.herdSize) ? item.herdSize : "—"}
          </Text>
        </View>
        {created && (
          <View style={[styles.row, { marginTop: 6 }]}>
            <Text style={styles.meta}>
              Registrado: {created.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.beige, padding: 16 }}>
      {/* Header con botones */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
          <MaterialCommunityIcons name="logout" size={20} color={Colors.white} />
          <Text style={styles.headerBtnText}>Salir</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Productores</Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.navigate("AdminDashboard")} style={styles.headerBtn}>
            <MaterialCommunityIcons name="view-dashboard" size={20} color={Colors.white} />
            <Text style={styles.headerBtnText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowList(true)} style={styles.headerBtn}>
            <MaterialCommunityIcons name="account-group" size={20} color={Colors.white} />
            <Text style={styles.headerBtnText}>Ver usuarios</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido */}
      <View style={{ flex: 1 }}>
        {!showList ? (
          <View style={styles.placeholder}>
            <MaterialCommunityIcons name="account-group" size={46} color={Colors.green} />
            <Text style={styles.placeholderText}>
              Pulsa “Ver usuarios” para mostrar los productores registrados.
            </Text>
          </View>
        ) : busy ? (
          <View style={{ paddingTop: 20 }}>
            <ActivityIndicator color={Colors.green} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <Text style={{ color: Colors.muted, fontWeight: "700", marginTop: 12 }}>
                Aún no hay productores registrados.
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { color: Colors.white, fontWeight: "900", fontSize: 16 },

  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
  },
  headerBtnText: { color: Colors.white, fontWeight: "800" },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { fontWeight: "900", color: Colors.text },
  email: { color: Colors.muted, fontWeight: "700" },

  row: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: { color: Colors.muted, fontWeight: "800" },
  value: { color: Colors.text, fontWeight: "800" },

  meta: { color: Colors.muted, fontWeight: "700", fontSize: 12 },

  placeholder: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  placeholderText: { color: Colors.text, fontWeight: "800", textAlign: "center" },
});
