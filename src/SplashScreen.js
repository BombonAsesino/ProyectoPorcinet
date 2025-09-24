// src/SplashScreen.js
import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const DURATION = 4000; // 4 segundos

const Colors = {
  green: "#843a3a",
  greenDark: "#ae2d2dff",
  beige: "#FFF7EA",
  white: "#FFFFFF",
  mint: "#D5F2E3",
  mint2: "#B9E6D3",
  mint3: "#9CDDC3",
  progressTrack: "rgba(255,255,255,0.25)",
  progressFill: "#FFFFFF",
};

export default function SplashScreen({ navigation }) {
  // Anim values
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scalePulse = useRef(new Animated.Value(0.6)).current;
  const rotateRing = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  // Barra de progreso
  const progress = useRef(new Animated.Value(0)).current;
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.66],
  });

  // Burbujas flotantes (arriba y abajo)
  const bubbles = useMemo(
    () => [
      // Abajo
      { size: 120, x: width * 0.1, y: height - 100, delay: 0, color: Colors.mint },
      { size: 180, x: width * 0.75, y: height - 120, delay: 200, color: Colors.mint2 },
      { size: 90, x: width * 0.55, y: height - 80, delay: 400, color: Colors.mint3 },
      { size: 60, x: width * 0.25, y: height - 60, delay: 600, color: Colors.mint2 },

      // Arriba 👆
      { size: 140, x: width * 0.2, y: 40, delay: 0, color: Colors.mint2 },
      { size: 100, x: width * 0.7, y: 60, delay: 300, color: Colors.mint3 },
      { size: 70, x: width * 0.45, y: 30, delay: 500, color: Colors.mint },
    ],
    []
  );

  const bubbleOffsets = bubbles.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    // Fade in
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Pulso
    Animated.loop(
      Animated.sequence([
        Animated.timing(scalePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scalePulse, {
          toValue: 0.9,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Anillo girando
    Animated.loop(
      Animated.timing(rotateRing, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Título y subtítulo
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideUp, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Burbujas flotantes arriba y abajo
    bubbleOffsets.forEach((val, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: -14,
            duration: 1400 + i * 120,
            delay: bubbles[i].delay,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 1400 + i * 120,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // Barra en 4s
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Navegar a Login en 4s
    const timer = setTimeout(() => navigation.replace("Login"), DURATION);
    return () => clearTimeout(timer);
  }, []);

  const rotateInterpolate = rotateRing.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      {/* Burbujas */}
      {bubbles.map((b, idx) => (
        <Animated.View
          key={idx}
          style={[
            styles.bubble,
            {
              width: b.size,
              height: b.size,
              backgroundColor: b.color,
              left: b.x - b.size / 2,
              top: b.y,
              transform: [{ translateY: bubbleOffsets[idx] }],
              opacity: 0.22,
            },
          ]}
        />
      ))}

      <Animated.View style={[styles.centerWrap, { opacity: fadeIn }]}>
        {/* Ícono */}
        <View style={styles.ringWrap}>
          <Animated.View
            style={[styles.ring, { transform: [{ rotate: rotateInterpolate }] }]}
          />
          <Animated.View style={[styles.iconCircle, { transform: [{ scale: scalePulse }] }]}>
            <MaterialCommunityIcons name="pig-variant" size={84} color={Colors.white} />
          </Animated.View>
        </View>

        {/* Marca */}
        <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: slideUp }] }]}>
          Porcinet
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          Cuidando tu esfuerzo, asegurando tu futuro
        </Animated.Text>

        {/* Barra de carga */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const SIZE = 140;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.green,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  centerWrap: { alignItems: "center", justifyContent: "center" },
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  ring: {
    position: "absolute",
    width: SIZE + 28,
    height: SIZE + 28,
    borderRadius: (SIZE + 28) / 2,
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.16)",
    borderTopColor: "rgba(255,255,255,0.85)",
  },
  iconCircle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: Colors.greenDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.12)",
  },
  title: { fontSize: 36, fontWeight: "900", color: Colors.white, letterSpacing: 0.5 },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.beige,
    opacity: 0.9,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  progressWrap: { marginTop: 18, alignItems: "center", width: width * 0.72 },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.progressTrack,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: Colors.progressFill, borderRadius: 999 },
  bubble: { position: "absolute", borderRadius: 999 },
});
