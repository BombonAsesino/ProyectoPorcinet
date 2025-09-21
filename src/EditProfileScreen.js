// src/EditProfileScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

const Colors = {
  green: "#1E5B3F",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.12)",
};

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [farmNumber, setFarmNumber] = useState("");
  const [herdSize, setHerdSize] = useState("");

  // Imagen
  const [photoBase64, setPhotoBase64] = useState(null);      // lo que está guardado en Firestore
  const [localBase64, setLocalBase64] = useState(null);      // lo nuevo seleccionado (pendiente de guardar)

  useEffect(() => {
    const load = async () => {
      try {
        const u = auth.currentUser;
        if (!u) return;
        const snap = await getDoc(doc(db, "producers", u.uid));
        if (snap.exists()) {
          const d = snap.data();
          setName(d?.name || "");
          setPhone(d?.phone || "");
          setFarmNumber(d?.farmNumber || "");
          setHerdSize(String(d?.herdSize ?? ""));
          setPhotoBase64(d?.photoBase64 || null);
        }
      } catch (e) {
        console.error("Error cargando perfil:", e);
        Alert.alert("Error", "No se pudo cargar tu perfil.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permisos", "Necesito permiso para acceder a tus fotos.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,          // comprime un poco
      base64: true,          // 👈 necesario para guardar en Firestore
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!res.canceled && res.assets?.[0]?.base64) {
      setLocalBase64(res.assets[0].base64);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const u = auth.currentUser;
      if (!u) return;

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        farmNumber: farmNumber.trim(),
        herdSize: parseInt(herdSize || "0", 10) || 0,
        // Si el usuario escogió una imagen nueva, guardamos esa; si no, dejamos la existente
        photoBase64: localBase64 ?? photoBase64 ?? null,
        updatedAt: new Date(),
      };

      await setDoc(doc(db, "producers", u.uid), payload, { merge: true });

      // Reflejar nombre en Auth (photoURL ya no se usa; queda en Firestore)
      await updateProfile(u, { displayName: payload.name || u.displayName || null });

      Alert.alert("Listo", "Perfil actualizado correctamente.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error("Error guardando perfil:", e);
      Alert.alert("Error", "No se pudo guardar tu perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: Colors.muted }}>Cargando...</Text>
      </View>
    );
  }

  const imgSrc =
    localBase64
      ? { uri: `data:image/jpeg;base64,${localBase64}` }
      : photoBase64
      ? { uri: `data:image/jpeg;base64,${photoBase64}` }
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.beige }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Foto */}
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <View style={styles.avatar}>
            {imgSrc ? (
              <Image source={imgSrc} style={{ width: 128, height: 128, borderRadius: 64 }} />
            ) : (
              <MaterialCommunityIcons name="account" size={72} color={Colors.green} />
            )}
          </View>

          <TouchableOpacity style={styles.outlineBtn} onPress={pickImage}>
            <MaterialCommunityIcons name="image-plus" size={18} color={Colors.green} />
            <Text style={[styles.outlineBtnText, { marginLeft: 8 }]}>Cambiar foto</Text>
          </TouchableOpacity>
        </View>

        {/* Campos */}
        <Field label="Nombre completo">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={Colors.muted}
            style={styles.input}
          />
        </Field>

        <Field label="Teléfono">
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="8888-8888"
            keyboardType="phone-pad"
            placeholderTextColor={Colors.muted}
            style={styles.input}
          />
        </Field>

        <Field label="Número de granja">
          <TextInput
            value={farmNumber}
            onChangeText={setFarmNumber}
            placeholder="Ej: 56"
            placeholderTextColor={Colors.muted}
            style={styles.input}
          />
        </Field>

        <Field label="Cerdos actuales">
          <TextInput
            value={herdSize}
            onChangeText={setHerdSize}
            placeholder="Ej: 120"
            keyboardType="numeric"
            placeholderTextColor={Colors.muted}
            style={styles.input}
          />
        </Field>

        {/* Guardar */}
        <TouchableOpacity
          style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
          onPress={saveProfile}
          disabled={saving}
        >
          <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>{saving ? "Guardando..." : "Guardar cambios"}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.beige },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: Colors.white,
    borderWidth: 4,
    borderColor: Colors.green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  label: { color: Colors.text, fontWeight: "800", marginBottom: 6 },
  inputBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.border,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text,
    fontWeight: "700",
  },
  primaryBtn: {
    backgroundColor: Colors.green,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  primaryBtnText: { color: Colors.white, fontWeight: "900", fontSize: 16, marginLeft: 6 },
  outlineBtn: {
    borderWidth: 2,
    borderColor: Colors.green,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  outlineBtnText: { color: Colors.green, fontWeight: "800" },
});
