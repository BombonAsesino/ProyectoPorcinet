// src/AuthWrapper.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { auth } from "../database";
import { onAuthStateChanged } from "firebase/auth";

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      if (!user) {
        // Si no hay usuario autenticado, ir al login
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }
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
    return null; // Se redirigirá al login
  }

  return children;
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
