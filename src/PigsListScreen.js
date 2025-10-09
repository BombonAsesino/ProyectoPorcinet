// src/PigsListScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#FFFFFF",
  border: "rgba(0,0,0,0.08)",
};

export default function PigsListScreen({ navigation, route }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);

  const selectMode = route?.params?.selectMode === true;           // opcional
  const onPick = route?.params?.onPick;                            // opcional

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(
      collection(db, "animals"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    );

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

  const askDelete = useCallback((id) => {
    Alert.alert("Eliminar cerda", "¿Deseas eliminar este registro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "animals", id));
          } catch (e) {
            console.log(e);
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  }, []);

  const renderItem = ({ item }) => {
    const birth =
      item.birthDate?.toDate
        ? item.birthDate.toDate()
        : (item.birthDate ? new Date(item.birthDate) : null);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => {
          if (selectMode && typeof onPick === "function") {
            onPick({ id: item.id, earTag: item.earTag, name: item.name });
            navigation.goBack();
          } else {
            navigation.navigate("PigForm", { id: item.id });
          }
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="pig-variant" size={22} color={Colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {item.earTag ? `#${item.earTag}` : "Sin arete"} • {item.name || "Cerda"}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              Estado: {item.status || "activa"} · Partos: {item.parity ?? 0}
            </Text>
            {birth && (
              <Text style={styles.sub}>
                Nac.: {birth.toLocaleDateString("es-ES")}
              </Text>
            )}
          </View>
          {!selectMode && (
            <TouchableOpacity onPress={() => askDelete(item.id)} style={styles.iconBtn}>
              <MaterialCommunityIcons name="trash-can" size={18} color={Colors.green} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.beige, padding: 12 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Registro de cerdas</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("PigForm")}
        >
          <MaterialCommunityIcons name="plus" size={18} color={Colors.white} />
          <Text style={styles.addText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {busy ? (
        <ActivityIndicator color={Colors.green} style={{ marginTop: 12 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text style={{ color: Colors.muted, fontWeight: "700" }}>
              Aún no tienes cerdas registradas.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontWeight: "900", color: Colors.text, fontSize: 18 },
  addBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: Colors.green,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addText: { color: Colors.white, fontWeight: "900" },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f2e8e8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { color: Colors.text, fontWeight: "900" },
  sub: { color: Colors.muted, fontWeight: "700" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
});
