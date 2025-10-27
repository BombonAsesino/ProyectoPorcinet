// src/AuthWrapper.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { onAuthStateChanged } from "firebase/auth";

// ⚠️ Esta ruta es correcta porque tu carpeta "database" está FUERA de /src
import { auth } from "../database";



const Colors = {
  green: "#1E5B3F",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
};

export default function AuthWrapper({ children }) {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1) Inicializa canal/permisos una sola vez
 

  // 2) Listener de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      if (!u) {
        // Si no hay usuario autenticado, ir al login
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }
      // Si sí hay usuario, simplemente renderizamos children (mantiene la ruta actual)
    });

    return unsubscribe;
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (!user) {
    // Se redirige al login con navigation.reset
    return null;
  }

  return <View style={{ flex: 1 }}>{children}</View>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: Colors.muted,
    fontSize: 16,
    fontWeight: "600",
  },
});
