// src/AssistantIAWelcomeScreen.js
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const { width: W } = Dimensions.get("window");
const scale = (n) => Math.round((W / 375) * n);

const Colors = {
  green: "#1E5B3F",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
};

export default function AssistantIAWelcomeScreen({ navigation }) {
  // Animaciones
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animación de entrada
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 550, useNativeDriver: true }),
    ]).start();

    // Flotación del ícono
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloat, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(iconFloat, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const floatY = iconFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  const onContinue = () => {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.94, friction: 5, tension: 140, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
    ]).start(() => {
      navigation.replace("AsistenteIA");
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.beige }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Asistente IA</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Contenido */}
      <Animated.View
        style={[styles.container, { opacity: fade, transform: [{ translateY: slide }] }]}
      >
        <Animated.View style={{ transform: [{ translateY: floatY }] }}>
          <MaterialCommunityIcons name="robot-happy" size={scale(72)} color={Colors.green} />
        </Animated.View>

        <Text style={styles.title}>¡Bienvenido al asistente de IA!</Text>
        <Text style={styles.subtitle}>
          Podrás tomar o subir una foto del cerdo, estimar su raza y calcular su peso en libras.
        </Text>

        <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
          <TouchableOpacity activeOpacity={0.9} onPress={onContinue} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Continuar</Text>
            <MaterialCommunityIcons name="arrow-right" size={scale(18)} color={Colors.white} />
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>Cancelar</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  hTitle: { flex: 1, textAlign: "center", color: Colors.white, fontWeight: "800", fontSize: 18 },

  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  title: { fontSize: 22, fontWeight: "900", color: Colors.text, textAlign: "center", marginTop: 12 },
  subtitle: { color: Colors.muted, textAlign: "center", marginTop: 8, marginBottom: 10 },

  primaryBtn: {
    marginTop: 10,
    backgroundColor: Colors.green,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryText: { color: Colors.white, fontWeight: "900", fontSize: 16, marginRight: 8 },

  secondaryBtn: {
    marginTop: 12,
    backgroundColor: "transparent",
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.green,
    borderRadius: 12,
  },
  secondaryText: { color: Colors.green, fontWeight: "900" },
});
