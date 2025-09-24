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
} from "react-native";

const Colors = {
  green: "#1E5B3F",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
};

export default function BienvenidaProductor({ navigation }) {
  const continuar = () => {
    // Entrar al Home (Tabs) y evitar volver con "atrás"
    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
  };

  // Animaciones
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoBounce = useRef(new Animated.Value(0)).current; // para un "rebote" vertical sutil
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

  useEffect(() => {
    // Secuencia de entrada
    Animated.sequence([
      // Logo: zoom-in con rebote
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
      // Título
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Párrafo
      Animated.parallel([
        Animated.timing(paraOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(paraTranslate, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Bullets en "stagger"
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

    // "Latido" del botón CTA en loop
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, { toValue: 1.04, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(ctaScale, { toValue: 1.0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [
    logoScale,
    logoBounce,
    titleOpacity,
    titleTranslate,
    paraOpacity,
    paraTranslate,
    b1Opacity,
    b1Translate,
    b2Opacity,
    b2Translate,
    b3Opacity,
    b3Translate,
    ctaScale,
  ]);

  // Rebote vertical sutil del logo (mapea 0..1 a -4..0 px)
  const logoTranslateY = logoBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <View style={styles.container}>
      {/* Cabecera verde */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PorciNet</Text>
      </View>

      {/* Contenido */}
      <View style={styles.body}>
        {/* Logo / Imagen animada */}
        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.logoCircle,
              { transform: [{ scale: logoScale }, { translateY: logoTranslateY }] },
            ]}
          >
            <Image
              source={require("../assets/bienvenido.png")}
              resizeMode="cover"
              style={{ width: "100%", height: "100%", borderRadius: 100 }}
            />
            {/* Halo suave debajo */}
            <View style={styles.glow} />
          </Animated.View>
        </View>

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
          Administra tu granja de forma sencilla: registra gastos clave, consulta tu
          productividad y crea respaldos en la nube para mantener tus datos seguros.
        </Animated.Text>

        <View style={styles.bullets}>
          <Animated.Text
            style={[
              styles.bullet,
              { opacity: b1Opacity, transform: [{ translateY: b1Translate }] },
            ]}
          >
            • Control de costos: alimentación, salud y mantenimiento.
          </Animated.Text>
          <Animated.Text
            style={[
              styles.bullet,
              { opacity: b2Opacity, transform: [{ translateY: b2Translate }] },
            ]}
          >
            • Indicadores claros para decisiones rápidas.
          </Animated.Text>
          <Animated.Text
            style={[
              styles.bullet,
              { opacity: b3Opacity, transform: [{ translateY: b3Translate }] },
            ]}
          >
            • Respaldo y restauración de información con un toque.
          </Animated.Text>
        </View>

        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <TouchableOpacity style={styles.cta} onPress={continuar} activeOpacity={0.9}>
            <Text style={styles.ctaText}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.beige },
  header: {
    height: 90,
    backgroundColor: Colors.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  headerTitle: { color: Colors.white, fontWeight: "900", fontSize: 18 },

  body: { flex: 1, padding: 18, gap: 12 },
  logoWrap: { alignItems: "center", marginTop: 8, marginBottom: 6 },

  logoCircle: {
    width: 220,
    height: 220,
    borderRadius: 100,
    borderWidth: 0,
    borderColor: Colors.beige,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    elevation: 2,
  },

  // Halo/Glow decorativo
  glow: {
    position: "absolute",
    bottom: -16,
    width: 160,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E5B3F22",
    alignSelf: "center",
    filter: "blur(6px)", // RN web; en nativo simplemente aporta color suave
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.text,
    textAlign: "center",
    marginTop: 2,
  },
  paragraph: {
    color: Colors.text,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },
  bullets: { marginTop: 6, gap: 6 },
  bullet: { color: Colors.muted, fontWeight: "700" },

  cta: {
    marginTop: 16,
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  ctaText: { color: Colors.white, fontWeight: "900", fontSize: 16 },
});
