// src/LoginScreen.js
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
import { auth, db } from "../database";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "black",
  white: "#FFFFFF",
  muted: "#6b7280",
  input: "#843a3a",
  border: "rgba(0,0,0,0.12)",
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [secure, setSecure] = useState(true);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passError, setPassError] = useState("");

  const validateEmail = (v) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError(v && !re.test(v) ? "Formato de correo inválido" : "");
  };
  const validatePassword = (v) => {
    setPassError(v && v.length < 6 ? "Mínimo 6 caracteres" : "");
  };

  const handleLogin = async () => {
    setEmailError("");
    setPassError("");

    if (!email.trim()) return setEmailError("Campo requerido");
    if (!pass.trim()) return setPassError("Campo requerido");

    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email.trim())) return setEmailError("Formato de correo inválido");
    if (pass.length < 6) return setPassError("Mínimo 6 caracteres");

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const u = cred.user;

      // --- chequeo de rol admin en users/{uid} ---
      const adminDoc = await getDoc(doc(db, "users", u.uid));
      const role = adminDoc.exists() ? adminDoc.data()?.role : null;

      if (role === "admin") {
        // Solo ese correo que registraste como admin tendrá este doc y role
        navigation.reset({ index: 0, routes: [{ name: "AdminPanel" }] });
      } else {
        // Productor (o cualquier otro)
        navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
      }
    } catch (error) {
      console.error("❌ Error en login:", error);
      let errorMessage = "Error al iniciar sesión";
      let errorTitle = "Error de autenticación";
      if (error.code === "auth/user-not-found") {
        errorMessage = "No existe una cuenta con este correo electrónico.\n\n¿Quieres registrarte?";
        errorTitle = "Usuario no encontrado";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "La contraseña es incorrecta.\n\n¿Olvidaste tu contraseña?";
        errorTitle = "Contraseña incorrecta";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage =
          "El correo electrónico o la contraseña son incorrectos.\n\nVerifica tus datos e intenta nuevamente.";
        errorTitle = "Credenciales inválidas";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El formato del correo electrónico no es válido.\n\nEjemplo: usuario@ejemplo.com";
        errorTitle = "Correo inválido";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Demasiados intentos fallidos.\n\nEspera unos minutos antes de intentar nuevamente.";
        errorTitle = "Demasiados intentos";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Error de conexión a internet.\n\nVerifica tu conexión e intenta nuevamente.";
        errorTitle = "Error de conexión";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "Esta cuenta ha sido deshabilitada.\n\nContacta al soporte técnico.";
        errorTitle = "Cuenta deshabilitada";
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage =
          "El inicio de sesión con correo y contraseña no está habilitado.\n\nContacta al soporte técnico.";
        errorTitle = "Método no permitido";
      }

      if (error.code === "auth/user-not-found") {
        Alert.alert(errorTitle, errorMessage, [
          { text: "Cancelar", style: "cancel" },
          { text: "Registrarse", onPress: () => navigation.navigate("Registro") },
        ]);
      } else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        Alert.alert(errorTitle, errorMessage, [
          { text: "Intentar nuevamente", style: "cancel" },
          { text: "Registrarse", onPress: () => navigation.navigate("Registro") },
        ]);
      } else {
        Alert.alert(errorTitle, errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.beige }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {}} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Ingresar a mi granja</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Logo circular */}
        <View style={styles.avatarWrap}>
          <View style={styles.pigIconCircle}>
            <Image
              source={require("../assets/logo.png")}
              resizeMode="cover"
              style={{ width: "100%", height: "100%", borderRadius: 85 }}
            />
          </View>
        </View>

        {/* Inputs */}
        <View style={styles.inputContainer}>
          <View style={[styles.inputBox, emailError && styles.inputBoxError]}>
            <TextInput
              placeholder="Correo electrónico"
              placeholderTextColor={Colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                validateEmail(t);
              }}
              style={styles.input}
            />
          </View>
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>

        <View style={styles.inputContainer}>
          <View style={[styles.inputBox, passError && styles.inputBoxError]}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TextInput
                placeholder="Contraseña"
                placeholderTextColor={Colors.muted}
                secureTextEntry={secure}
                value={pass}
                onChangeText={(t) => {
                  setPass(t);
                  validatePassword(t);
                }}
                style={[styles.input, { flex: 1 }]}
              />
              <TouchableOpacity onPress={() => setSecure(!secure)} style={{ paddingHorizontal: 8 }}>
                <MaterialCommunityIcons name={secure ? "eye-off" : "eye"} size={20} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
          {passError ? <Text style={styles.errorText}>{passError}</Text> : null}
        </View>

        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setRemember(!remember)}
          activeOpacity={0.8}
        >
     
        </TouchableOpacity>

        {/* Botones */}
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.primaryText}>{loading ? "Iniciando sesión..." : "Ingresar"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("Registro")}>
          <Text style={styles.secondaryText}>Registrarse</Text>
        </TouchableOpacity>
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
  avatarWrap: { alignItems: "center", marginTop: 8, marginBottom: 8 },
  pigIconCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 6,
    borderColor: Colors.beige,
    backgroundColor: "#843a3a",
    alignItems: "center",
    justifyContent: "center",
  },

  inputContainer: { marginBottom: 4 },
  inputBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#843a3a",
  },
  inputBoxError: { borderColor: "#EF4444", borderWidth: 2 },
  input: { paddingHorizontal: 12, paddingVertical: 12, color: Colors.text, fontWeight: "700" },
  errorText: { color: "#EF4444", fontSize: 12, fontWeight: "600", marginTop: 4, marginLeft: 4 },

  checkboxRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  checkboxText: { marginLeft: 8, color: Colors.text, fontWeight: "700" },

  primaryBtn: {
    backgroundColor: Colors.green,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnDisabled: { backgroundColor: "#9CA3AF", opacity: 0.7 },
  primaryText: { color: Colors.white, fontWeight: "900", fontSize: 16 },

  secondaryBtn: {
    backgroundColor: "#843a3a",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1.3,
    borderColor: "white",
  },
  secondaryText: { color: "white", fontWeight: "900", fontSize: 16 },
});
