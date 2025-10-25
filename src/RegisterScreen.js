// src/RegisterScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../database";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { linkSubaccountLite } from "./utils/linkSubaccountLite";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  input: "#F6EFE0",
  border: "rgba(0,0,0,0.12)",
  card: "#F1E9D6",
  danger: "#dc2626",
};

const STATS_KEY = "@porcinet_stats"; // { herdSize: number }

export default function RegisterScreen({ navigation }) {
  // 🔒 Admin permanentemente deshabilitado
  const adminLocked = true;

  // Rol fijo efectivo (siempre productor)
  const role = "producer";

  // Campos
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
    if (!name.trim()) return Alert.alert("Falta nombre", "Ingresa tu nombre completo.");
    if (!email.trim()) return Alert.alert("Falta correo", "Ingresa tu correo electrónico.");
    if (pass.length < 6) return Alert.alert("Contraseña corta", "Mínimo 6 caracteres.");
    if (pass !== confirm) return Alert.alert("No coincide", "Las contraseñas no coinciden.");
    if (!accept) return Alert.alert("Términos", "Debes aceptar los términos y condiciones.");

    // Validaciones de productor
    if (!phone.trim()) return Alert.alert("Falta teléfono", "Ingresa tu número de teléfono.");
    if (!farmNumber.trim()) return Alert.alert("Falta # de granja", "Ingresa el número de granja.");
    const herd = parseInt(herdSize, 10);
    if (!Number.isFinite(herd) || herd < 0) {
      return Alert.alert("Cerdos inválidos", "Ingresa un número de cerdos válido.");
    }

    try {

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);

      
      const user = userCredential.user;

      const producerData = {
        uid: user.uid,
        role, // siempre "producer"
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        farmNumber: farmNumber.trim(),
        herdSize: herd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

await createUserWithEmailAndPassword(auth, email, pass);
await linkSubaccountLite();


      await setDoc(doc(db, "producers", user.uid), producerData);

      const safeHerd = Number.isFinite(producerData.herdSize) && producerData.herdSize >= 0
        ? producerData.herdSize
        : 0;
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify({ herdSize: safeHerd }));

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

  // Tap en Admin -> solo aviso, no cambia nada
  const onPressAdmin = () => {
    if (adminLocked) {
      Alert.alert(
        "Rol restringido",
        "El registro de administradores está deshabilitado. Solo se permiten cuentas de productor."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.beige }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Registro del productor</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Imagen */}
        <View style={styles.avatarWrap}>
          <View style={styles.pigIconCircle}>
            <Image
              source={require("../assets/productor.png")}
              resizeMode="cover"
              style={{ width: "100%", height: "100%", borderRadius: 60 }}
            />
          </View>
        </View>

        {/* Selector de Rol (Admin deshabilitado) */}
        <Text style={styles.groupLabel}>Selecciona rol</Text>
        <View style={styles.rolesRow}>
          <View style={[styles.roleBtn, styles.roleBtnActive]}>
            <MaterialCommunityIcons name="account" size={18} color={Colors.white} />
            <Text style={[styles.roleText, { color: Colors.white }]}>Productor</Text>
          </View>

          <TouchableOpacity
            style={[styles.roleBtn, styles.roleBtnLocked]}
            onPress={onPressAdmin}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="shield-account" size={18} color={Colors.muted} />
            <Text style={[styles.roleText, { color: Colors.muted }]}>Admin</Text>
          </TouchableOpacity>
        </View>

        {/* Formulario de PRODUCTOR */}
        <View style={styles.inputBox}>
          <TextInput
            placeholder="Nombre completo"
            placeholderTextColor={Colors.muted}
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
        </View>

        <View style={styles.inputBox}>
          <TextInput
            placeholder="Correo electrónico"
            placeholderTextColor={Colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
        </View>

        <View style={styles.inputBox}>
          <TextInput
            placeholder="Teléfono"
            placeholderTextColor={Colors.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
          />
        </View>

        <View style={styles.inputBox}>
          <TextInput
            placeholder="Número de la granja"
            placeholderTextColor={Colors.muted}
            value={farmNumber}
            onChangeText={setFarmNumber}
            style={styles.input}
          />
        </View>

        <View style={styles.inputBox}>
          <TextInput
            placeholder="Número de cerdos actuales"
            placeholderTextColor={Colors.muted}
            keyboardType="numeric"
            value={herdSize}
            onChangeText={setHerdSize}
            style={styles.input}
          />
        </View>

        <View style={styles.inputBox}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor={Colors.muted}
              secureTextEntry={secure1}
              value={pass}
              onChangeText={setPass}
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity onPress={() => setSecure1(!secure1)} style={{ paddingHorizontal: 8 }}>
              <MaterialCommunityIcons name={secure1 ? "eye-off" : "eye"} size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputBox}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
              placeholder="Confirmar contraseña"
              placeholderTextColor={Colors.muted}
              secureTextEntry={secure2}
              value={confirm}
              onChangeText={setConfirm}
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity onPress={() => setSecure2(!secure2)} style={{ paddingHorizontal: 8 }}>
              <MaterialCommunityIcons name={secure2 ? "eye-off" : "eye"} size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Términos */}
        <TouchableOpacity style={styles.checkbox} onPress={() => setAccept((v) => !v)} activeOpacity={0.8}>
          <MaterialCommunityIcons
            name={accept ? "checkbox-marked" : "checkbox-blank-outline"}
            size={22}
            color={Colors.green}
          />
          <Text style={{ color: Colors.text, marginLeft: 8, fontWeight: "700" }}>
            Acepto términos y condiciones
          </Text>
        </TouchableOpacity>

        {/* Botón registrar */}
        <TouchableOpacity style={styles.primaryBtn} onPress={confirmRegister}>
          <Text style={styles.primaryText}>Registrar productor</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>

        {/* Aviso fijo */}
        <View style={styles.lockNotice}>
          <MaterialCommunityIcons name="shield-lock" size={18} color={Colors.danger} />
          <Text style={styles.lockNoticeText}>
            El registro de administradores está deshabilitado. Solo se permiten cuentas de productor.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green,
    height: 56,
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 8,
  },
  hTitle: { flex: 1, textAlign: "center", color: Colors.white, fontWeight: "800", fontSize: 18 },

  content: { padding: 16, gap: 14 },

  avatarWrap: { alignItems: "center", marginVertical: 8 },
  pigIconCircle: {
    width: 300,
    height: 250,
    borderRadius: 100,
    borderWidth: 7,
    borderColor: Colors.beige,
    backgroundColor: Colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },

  groupLabel: { fontWeight: "900", color: Colors.text, marginTop: 4, marginBottom: -4 },
  rolesRow: { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 2 },
  roleBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.green,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  roleBtnActive: { backgroundColor: Colors.green },
  roleBtnLocked: { backgroundColor: Colors.card, borderColor: Colors.card },
  roleText: { fontWeight: "900", color: Colors.green },

  inputBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#D6D3C8",
  },
  input: { paddingHorizontal: 12, paddingVertical: 12, color: Colors.text, fontWeight: "700" },

  checkbox: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  primaryBtn: {
    backgroundColor: Colors.green,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { color: Colors.white, fontWeight: "900", fontSize: 16 },

  cancelBtn: { backgroundColor: "transparent", paddingVertical: 12, alignItems: "center" },
  cancelText: { color: Colors.muted, fontWeight: "800", fontSize: 14 },

  lockNotice: {
    marginTop: 4,
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lockNoticeText: { color: Colors.danger, fontWeight: "800", flex: 1 },
});
