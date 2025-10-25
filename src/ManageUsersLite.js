// src/ManageUsersLite.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, deleteDoc, updateDoc } from "firebase/firestore";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.08)",
  danger: "#b42318",
};

export default function ManageUsersLite() {
  const ownerUid = auth.currentUser?.uid;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [items, setItems] = useState([]); // subcuentas
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(collection(db, "producers", ownerUid, "subaccounts"));
    const off = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setItems(arr.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
    });
    return () => off();
  }, [ownerUid]);

  const addSub = async () => {
    if (!ownerUid) return Alert.alert("Sesión", "Inicia sesión.");
    const em = String(email).trim().toLowerCase();
    const nm = String(name).trim();
    if (!/\S+@\S+\.\S+/.test(em)) return Alert.alert("Email", "Ingresa un email válido.");
    if (!nm) return Alert.alert("Nombre", "Ingresa un nombre.");

    try {
      setBusy(true);
      // Usamos el email como ID para evitar duplicados sencillamente
      const safeId = em.replace(/[^a-z0-9._-]/gi, "_");
      await setDoc(doc(db, "producers", ownerUid, "subaccounts", safeId), {
        email: em,
        name: nm,
        uid: null,           // se llenará al primer login de ese correo
        active: true,
        pending: true,       // aún no se ha registrado/logueado
        role: "subaccount",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEmail("");
      setName("");
      Alert.alert("Guardado", "Subcuenta agregada. Cuando la persona se registre con ese correo quedará vinculada automáticamente.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo crear la subcuenta.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await updateDoc(doc(db, "producers", ownerUid, "subaccounts", row.id), {
        active: !row.active,
        updatedAt: serverTimestamp(),
      });
    } catch {
      Alert.alert("Error", "No se pudo actualizar el estado.");
    }
  };

  const removeSub = async (row) => {
    Alert.alert("Eliminar", `¿Eliminar la subcuenta ${row.email}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "producers", ownerUid, "subaccounts", row.id));
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.beige }} contentContainerStyle={{ padding: 14 }}>
      <Text style={styles.title}>Gestión de usuarios (simple)</Text>

      {/* Alta rápida */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Agregar subcuenta</Text>

        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} placeholder="Ej: Juan Pérez" value={name} onChangeText={setName} />

        <Text style={styles.label}>Correo</Text>
        <TextInput
          style={styles.input}
          placeholder="usuario@correo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={addSub} disabled={busy}>
          <MaterialCommunityIcons name="account-plus-outline" size={18} color={Colors.white} />
          <Text style={styles.btnText}>{busy ? "Guardando..." : "Agregar"}</Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <View style={[styles.card, { marginBottom: 30 }]}>
        <Text style={styles.cardTitle}>Subcuentas</Text>
        {items.length === 0 ? (
          <Text style={{ color: Colors.muted, fontWeight: "700" }}>Sin subcuentas todavía.</Text>
        ) : (
          items.map((r) => (
            <View key={r.id} style={styles.rowItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {r.name || r.email} {r.active ? "" : "· (desactivada)"} {r.pending ? "· (pendiente)" : ""}
                </Text>
                <Text style={styles.rowSub}>{r.email}</Text>
              </View>

              <TouchableOpacity onPress={() => toggleActive(r)} style={styles.iconBtn}>
                <MaterialCommunityIcons
                  name={r.active ? "account-off-outline" : "account-check-outline"}
                  size={18}
                  color={r.active ? Colors.danger : Colors.green}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => removeSub(r)} style={styles.iconBtn}>
                <MaterialCommunityIcons name="delete" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "900", color: Colors.text, marginBottom: 10 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: "900", color: Colors.text, marginBottom: 8, fontSize: 16 },
  label: { color: Colors.muted, fontWeight: "800", marginTop: 4 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    color: Colors.text,
    fontWeight: "700",
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { color: Colors.white, fontWeight: "900" },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  rowTitle: { fontWeight: "900", color: Colors.text },
  rowSub: { color: Colors.muted, fontWeight: "700" },
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
