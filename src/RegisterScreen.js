// src/RegisterScreen.js
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../database";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";

const Colors = {
  green: "#1E5B3F",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  input: "#F6EFE0",
  border: "rgba(0,0,0,0.12)",
};

const STATS_KEY = "@porcinet_stats"; // { herdSize: number }

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [farmNumber, setFarmNumber] = useState("");
  const [herdSize, setHerdSize] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accept, setAccept] = useState(false);
  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);

  const confirmRegister = async () => {
    // Validaciones básicas
    if (!name.trim()) return Alert.alert("Falta nombre", "Ingresa tu nombre completo.");
    if (!email.trim()) return Alert.alert("Falta correo", "Ingresa tu correo electrónico.");
    if (pass.length < 6) return Alert.alert("Contraseña corta", "Mínimo 6 caracteres.");
    if (pass !== confirm) return Alert.alert("No coincide", "Las contraseñas no coinciden.");
    if (!accept) return Alert.alert("Términos", "Debes aceptar los términos y condiciones.");

    try {
      console.log("🔥 Iniciando registro en Firebase...");
      
      // 1. Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      console.log("✅ Usuario creado en Auth:", user.uid);

      // 2. Guardar datos del productor en Firestore
      const producerData = {
        uid: user.uid,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        farmNumber: farmNumber.trim(),
        herdSize: parseInt(herdSize, 10) || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, "producers", user.uid), producerData);
      console.log("✅ Datos del productor guardados en Firestore");

      // 3. Guardar cerdos totales en AsyncStorage (para compatibilidad)
      const safeHerd = Number.isFinite(producerData.herdSize) && producerData.herdSize >= 0 ? producerData.herdSize : 0;
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify({ herdSize: safeHerd }));

      // 4. Ir al Home
      Alert.alert("Registro exitoso", "Tu cuenta fue creada correctamente en Firebase.", [
        { text: "Continuar", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Tabs" }] }) },
      ]);

    } catch (error) {
      console.error("❌ Error en el registro:", error);
      
      let errorMessage = "Error al crear la cuenta";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Este correo ya está registrado";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "La contraseña es muy débil";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El correo no es válido";
      }
      
      Alert.alert("Error de registro", errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.beige }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Registro del productor</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Imagen de cerdo (decorativa) */}
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <Image
            source={{ uri: "https://cdn.pixabay.com/photo/2017/09/25/13/12/pig-2782073_960_720.jpg" }}
            style={{ width: 170, height: 170, borderRadius: 85, borderWidth: 6, borderColor: Colors.beige, backgroundColor: "#eee" }}
          />
        </View>

        <View style={styles.inputBox}>
          <TextInput placeholder="Nombre completo" placeholderTextColor={Colors.muted}
            value={name} onChangeText={setName} style={styles.input} />
        </View>

        <View style={styles.inputBox}>
          <TextInput placeholder="Correo electrónico" placeholderTextColor={Colors.muted}
            autoCapitalize="none" keyboardType="email-address"
            value={email} onChangeText={setEmail} style={styles.input} />
        </View>

        <View style={styles.inputBox}>
          <TextInput placeholder="Teléfono" placeholderTextColor={Colors.muted}
            keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} />
        </View>

        <View style={styles.inputBox}>
          <TextInput placeholder="Número de la granja" placeholderTextColor={Colors.muted}
            value={farmNumber} onChangeText={setFarmNumber} style={styles.input} />
        </View>

        <View style={styles.inputBox}>
          <TextInput placeholder="Número de cerdos actuales" placeholderTextColor={Colors.muted}
            keyboardType="numeric" value={herdSize} onChangeText={setHerdSize} style={styles.input} />
        </View>

        <View style={styles.inputBox}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput placeholder="Contraseña" placeholderTextColor={Colors.muted}
              secureTextEntry={secure1} value={pass} onChangeText={setPass}
              style={[styles.input, { flex: 1 }]} />
            <TouchableOpacity onPress={() => setSecure1(!secure1)} style={{ paddingHorizontal: 8 }}>
              <MaterialCommunityIcons name={secure1 ? "eye-off" : "eye"} size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputBox}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput placeholder="Confirmar contraseña" placeholderTextColor={Colors.muted}
              secureTextEntry={secure2} value={confirm} onChangeText={setConfirm}
              style={[styles.input, { flex: 1 }]} />
            <TouchableOpacity onPress={() => setSecure2(!secure2)} style={{ paddingHorizontal: 8 }}>
              <MaterialCommunityIcons name={secure2 ? "eye-off" : "eye"} size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Términos */}
        <TouchableOpacity style={styles.checkbox} onPress={() => setAccept(v => !v)} activeOpacity={0.8}>
          <MaterialCommunityIcons
            name={accept ? "checkbox-marked" : "checkbox-blank-outline"}
            size={22} color={Colors.green}
          />
          <Text style={{ color: Colors.text, marginLeft: 8, fontWeight: "700" }}>
            Acepto términos y condiciones
          </Text>
        </TouchableOpacity>

        {/* Confirmación de registro */}
        <TouchableOpacity style={styles.primaryBtn} onPress={confirmRegister}>
          <Text style={styles.primaryText}>Registrar productor</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green, height: 56, alignItems: "center",
    flexDirection: "row", paddingHorizontal: 8,
  },
  hTitle: { flex: 1, textAlign: "center", color: Colors.white, fontWeight: "800", fontSize: 18 },

  content: { padding: 16, gap: 14 },
  inputBox: {
    backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1.2, borderColor: "#D6D3C8",
  },
  input: { paddingHorizontal: 12, paddingVertical: 12, color: Colors.text, fontWeight: "700" },

  checkbox: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  primaryBtn: {
    backgroundColor: Colors.green, paddingVertical: 14, borderRadius: 12, alignItems: "center",
  },
  primaryText: { color: Colors.white, fontWeight: "900", fontSize: 16 },

  cancelBtn: { backgroundColor: "transparent", paddingVertical: 12, alignItems: "center" },
  cancelText: { color: Colors.muted, fontWeight: "800", fontSize: 14 },
});
