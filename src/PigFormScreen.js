// src/PigFormScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
};

function parseYMD(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function PigFormScreen({ navigation, route }) {
  const id = route?.params?.id || null;

  const [earTag, setEarTag] = useState("");
  const [name, setName] = useState("");
  const [birthStr, setBirthStr] = useState(""); // YYYY-MM-DD
  const [status, setStatus] = useState("activa");
  const [parity, setParity] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "animals", id));
        if (snap.exists()) {
          const d = snap.data();
          setEarTag(String(d.earTag || ""));
          setName(String(d.name || ""));
          const birth =
            d.birthDate?.toDate
              ? d.birthDate.toDate()
              : (d.birthDate ? new Date(d.birthDate) : null);
          setBirthStr(birth ? birth.toISOString().slice(0, 10) : "");
          setStatus(d.status || "activa");
          setParity(String(d.parity ?? "0"));
          setNotes(String(d.notes || ""));
        }
      } catch (e) {
        console.log(e);
        Alert.alert("Error", "No se pudo cargar la cerda.");
      }
    })();
  }, [id]);

  const save = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Alert.alert("Sesión", "Debes iniciar sesión.");

    const birthDate = parseYMD(birthStr);
    const payload = {
      uid,
      earTag: earTag.trim(),
      name: name.trim(),
      birthDate: birthDate || null,
      status: (status || "activa").toLowerCase(),
      parity: Number.isFinite(parseInt(parity, 10)) ? parseInt(parity, 10) : 0,
      notes: notes.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      setBusy(true);
      if (id) {
        await updateDoc(doc(db, "animals", id), payload);
        Alert.alert("Actualizado", "Cerda actualizada correctamente.");
      } else {
        await addDoc(collection(db, "animals"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        Alert.alert("Guardado", "Cerda registrada.");
      }
      navigation.goBack();
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <View style={styles.panel}>
        <Text style={styles.title}>{id ? "Editar cerda" : "Nueva cerda"}</Text>

        <Text style={styles.label}>Arete / Código</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 1234"
          value={earTag}
          onChangeText={setEarTag}
        />

        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          placeholder="Opcional"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Fecha de nacimiento (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2024-05-10"
          value={birthStr}
          onChangeText={setBirthStr}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Estado</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["activa", "inactiva"].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, status === s && { backgroundColor: Colors.green }]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.chipText, status === s && { color: Colors.white }]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Partos</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          keyboardType="numeric"
          value={parity}
          onChangeText={setParity}
        />

        <Text style={styles.label}>Notas</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: "top" }]}
          placeholder="Observaciones…"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={busy}>
          <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
          <Text style={styles.saveText}>{busy ? "Guardando…" : "Guardar"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.white,
    margin: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  title: { fontWeight: "900", fontSize: 18, color: Colors.text, marginBottom: 6 },
  label: { color: Colors.muted, fontWeight: "800" },
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
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.green,
    alignItems: "center",
  },
  chipText: { fontWeight: "800", color: Colors.green },
  saveBtn: {
    marginTop: 6,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  saveText: { color: Colors.white, fontWeight: "900" },
});
