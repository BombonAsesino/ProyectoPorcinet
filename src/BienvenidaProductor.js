// src/BienvenidaProductor.js
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#101318",
  white: "#FFFFFF",
  muted: "#6b7280",
};

export default function BienvenidaProductor({ navigation }) {
  const continuar = () => {
    // Mantengo la lógica EXACTA
    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
  };

  // ====== Animaciones base ======
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoBounce = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(10)).current;

  const paraOpacity = useRef(new Animated.Value(0)).current;
  const paraTranslate = useRef(new Animated.Value(10)).current;

  const b1Opacity = useRef(new Animated.Value(0)).current;
  const b1Translate = useRef(new Animated.Value(10)).current;
  const b2Opacity = useRef(new Animated.Value(0)).current;
  const b2Translate = useRef(new Animated.Value(10)).current;
  const b3Opacity = useRef(new Animated.Value(0)).current;
  const b3Translate = useRef(new Animated.Value(10)).current;

  const ctaScale = useRef(new Animated.Value(1)).current;

  // ====== Partículas (decoración animada) ======
  const PARTICLES = 14;
  const particles = useRef(
    Array.from({ length: PARTICLES }).map(() => ({
      x: Math.random() * width,
      size: 6 + Math.random() * 10,            // un poco más grandes para verse mejor
      drift: (Math.random() * 2 - 1) * 25,
      duration: 6000 + Math.random() * 4000,
      delay: Math.random() * 2000,
      anim: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    // Secuencia de entrada elegante
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }),
        Animated.timing(logoBounce, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(paraOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(paraTranslate, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(120, [
        Animated.parallel([
          Animated.timing(b1Opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(b1Translate, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(b2Opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(b2Translate, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(b3Opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(b3Translate, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    // Bucle CTA
    const loopCTA = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, {
          toValue: 1.04,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaScale, {
          toValue: 1.0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loopCTA.start();

    // Arrancar partículas
    particles.forEach((p) => {
      const cycle = () =>
        Animated.parallel([
          Animated.timing(p.anim, {
            toValue: 1,
            duration: p.duration,
            delay: p.delay,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(p.opacity, {
              toValue: 0.35 + Math.random() * 0.35,
              duration: p.duration * 0.4,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: p.duration * 0.6,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]).start(({ finished }) => {
          if (finished) {
            p.anim.setValue(0);
            p.opacity.setValue(0);
            p.x = Math.random() * width;
            p.size = 6 + Math.random() * 10;
            cycle();
          }
        });
      cycle();
    });

    return () => {
      loopCTA.stop();
    };
  }, []);

  // Shimmer del botón
  const shimmerX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loopShimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shimmerX, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loopShimmer.start();
    return () => loopShimmer.stop();
  }, []);
  const shimmerTranslate = shimmerX.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] });

  return (
    <View style={styles.container}>
      {/* Fondo: franja hero */}
      <View style={styles.topBand} />

      {/* Partículas (detrás del contenido) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {particles.map((p, i) => {
          const translateY = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [height * 0.55, height * 0.15],
          });
          const translateX = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [p.x, p.x + p.drift],
          });
          return (
            <Animated.View
              key={`particle-${i}`}
              style={[
                styles.particle,
                {
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  opacity: p.opacity,
                  transform: [{ translateX }, { translateY }],
                },
              ]}
            />
          );
        })}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PorciNet</Text>
      </View>

      {/* Card central (glass) */}
      <View style={styles.body}>
        <View style={styles.card}>
          {/* sombreado lateral suave (bordes) */}
          <View pointerEvents="none" style={styles.edgeShadeLeft} />
          <View pointerEvents="none" style={styles.edgeShadeRight} />

          {/* Logo con halo */}
          <Animated.View
            style={[
              styles.logoCircle,
              { transform: [{ scale: logoScale }, { translateY: logoBounce.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] },
            ]}
          >
            <Image
              source={require("../assets/bienvenido.png")}
              resizeMode="cover"
              style={styles.logoImage}
            />
            <View style={styles.glow} />
          </Animated.View>

          {/* Titular y texto */}
          <Animated.Text
            style={[
              styles.title,
              { opacity: titleOpacity, transform: [{ translateY: titleTranslate }] },
            ]}
          >
            ¡Bienvenido, productor!
          </Animated.Text>

          <Animated.Text
            style={[
              styles.paragraph,
              { opacity: paraOpacity, transform: [{ translateY: paraTranslate }] },
            ]}
          >
            Empieza a gestionar tu granja con enfoque profesional: controla costos, accede
            a tu <Text style={{ fontWeight: "900", color: Colors.green }}>Dashboard</Text> y resguarda la información en la nube.
          </Animated.Text>

          {/* Chips: ANCHO UNIFORME Y TEXTO CENTRADO */}
          <View style={styles.chipsRow}>
            <View style={styles.chipCol}>
              <Animated.View
                style={[
                  styles.chip,
                  { opacity: b1Opacity, transform: [{ translateY: b1Translate }] },
                ]}
              >
                <Icon style={styles.chipIcon} name="cash-multiple" size={16} color={Colors.green} />
                <Text
                  style={styles.chipText}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  Costos clave
                </Text>
              </Animated.View>
            </View>

            <View style={styles.chipCol}>
              <Animated.View
                style={[
                  styles.chip,
                  { opacity: b2Opacity, transform: [{ translateY: b2Translate }] },
                ]}
              >
                <Icon style={styles.chipIcon} name="view-dashboard-outline" size={16} color={Colors.green} />
                <Text
                  style={styles.chipText}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  Dashboard
                </Text>
              </Animated.View>
            </View>

            <View style={styles.chipCol}>
              <Animated.View
                style={[
                  styles.chip,
                  { opacity: b3Opacity, transform: [{ translateY: b3Translate }] },
                ]}
              >
                <Icon style={styles.chipIcon} name="cloud-lock-outline" size={16} color={Colors.green} />
                <Text
                  style={styles.chipText}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  Respaldo
                </Text>
              </Animated.View>
            </View>
          </View>

          {/* CTA con brillo dinámico */}
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <TouchableOpacity style={styles.cta} onPress={continuar} activeOpacity={0.9}>
              <Text style={styles.ctaText}>Continuar</Text>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shimmer,
                  { transform: [{ translateX: shimmerTranslate }, { rotate: "20deg" }] },
                ]}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const GUTTER = 8; // separación entre chips
const CARD_PADDING = 18;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.beige },

  /* Franja superior tipo “hero” */
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.32,
    backgroundColor: Colors.green,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },

  header: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: Colors.white,
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 6,
    alignItems: "center",
  },

  /* Tarjeta principal (glassmorphism) */
  card: {
    width: "100%",
    marginTop: 17,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 20,
    padding: CARD_PADDING,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
    position: "relative",
    overflow: "visible",
  },

  // Sombreado de bordes (simulación de degradado lateral)
  edgeShadeLeft: {
    position: "absolute",
    top: 10,
    bottom: 10,
    left: -6,
    width: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    opacity: 0.5,
  },
  edgeShadeRight: {
    position: "absolute",
    top: 10,
    bottom: 10,
    right: -6,
    width: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    opacity: 0.5,
  },

  /* Logo */
  logoCircle: {
    alignSelf: "center",
    width: width * 0.56,
    height: width * 0.56,
    borderRadius: 240,
    backgroundColor: Colors.white,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  logoImage: { width: "100%", height: "100%", borderRadius: 240 },

  glow: {
    position: "absolute",
    bottom: -18,
    width: 180,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E5B3F22",
    alignSelf: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.text,
    textAlign: "center",
    marginTop: 18,
  },
  paragraph: {
    color: Colors.text,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
    paddingHorizontal: 6,
  },

  /* Chips (3 columnas iguales) */
  chipsRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chipCol: {
    flexBasis: (width - (CARD_PADDING * 2) - (GUTTER * 2)) / 3, // tres columnas exactas
    maxWidth: (width - (CARD_PADDING * 2) - (GUTTER * 2)) / 3,
  },
  chip: {
    minHeight: 48,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",   // centra icono + texto
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  chipIcon: { marginRight: 4 },
  chipText: {
    fontWeight: "800",
    color: Colors.text,
    fontSize: 13.5,
    lineHeight: 16,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    flexShrink: 1,            // evita desbordes
    maxWidth: "80%",          // asegura que no aplaste márgenes
  },

  /* CTA premium */
  cta: {
    marginTop: 22,
    backgroundColor: Colors.green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    elevation: 6,
    shadowColor: Colors.green,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  ctaText: { color: Colors.white, fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },

  // Brillo que cruza el botón (shimmer)
  shimmer: {
    position: "absolute",
    width: 120,
    height: "220%",
    top: -10,
    left: -60,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 20,
  },

  // Partículas
  particle: {
    position: "absolute",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    shadowColor: "#fff",
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
});
