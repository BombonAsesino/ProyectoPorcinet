// src/AssistantIAScreen.js
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Image, Alert, ActivityIndicator, Dimensions
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// ===== Escalado responsivo =====
const { width: SCREEN_W } = Dimensions.get("window");
const scale = (n) => Math.round((SCREEN_W / 375) * n); // base 375px

const Colors = {
  green900: "#0E3B2A",
  green700: "#1E5B3F",
  green600: "#206548",
  beige: "#FFF7EA",
  card: "#E9F1EB",
  white: "#FFFFFF",
  text: "#0f172a",
  muted: "#6b7280",
};

// ===== Razas (coeficientes + rangos típicos de finalización) =====
// NOTA: Son valores de referencia (demo) para mejorar la estimación local.
// Si conectas un modelo real/BD de tu granja, puedes ajustar aquí.
const BREED_INFO = {
  Yorkshire: { mult: 1.00, finisher: [250, 310] },
  Duroc:     { mult: 1.05, finisher: [260, 320] },
  Landrace:  { mult: 0.98, finisher: [240, 300] },
  Pietrain:  { mult: 0.92, finisher: [230, 290] },
  Hampshire: { mult: 0.97, finisher: [240, 305] },
};
const BREEDS = Object.keys(BREED_INFO);

// ===== Reconocimiento de raza (mock local) =====
const guessBreedLocal = (uri) => {
  const low = (uri || "").toLowerCase();
  if (low.includes("york") || low.includes("white")) return "Yorkshire";
  if (low.includes("duroc") || low.includes("red")) return "Duroc";
  if (low.includes("land")) return "Landrace";
  if (low.includes("piet")) return "Pietrain";
  if (low.includes("hamps") || low.includes("belt")) return "Hampshire";
  let s = 0; for (const ch of low) s += ch.charCodeAt(0);
  return BREEDS[s % BREEDS.length];
};

// ===== Peso base en libras (lb) =====
// Fórmula correcta EN PULGADAS: weight_lb = (girth_in^2 * length_in) / 400
// Convertimos cm -> pulgadas y calculamos directamente en lb.
const baseWeightLb = (girthCm, lengthCm) => {
  const g = Number(girthCm), L = Number(lengthCm);
  if (!g || !L) return null;
  const gIn = g / 2.54;
  const LIn = L / 2.54;
  const lb = (gIn * gIn * LIn) / 400;
  return Math.round(lb * 10) / 10;
};

// ===== Utilidades de ajuste =====
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ===== Peso afinado por raza =====
// 1) Calcula base en lb con pulgadas.
// 2) Aplica multiplicador por raza.
// 3) Reencuadre suave si está en finisher al rango típico de la raza.
// 4) Clamps por etapa y tope absoluto 600 lb (límite superior).
const breedAwareWeightLb = (breed, girthCm, lengthCm) => {
  const base = baseWeightLb(girthCm, lengthCm);
  if (base == null) return null;

  const info = BREED_INFO[breed] || { mult: 1.0, finisher: [240, 310] };
  let adjusted = base * info.mult;

  // Etapas más realistas con la fórmula corregida
  const stage = adjusted < 180 ? "grower" : adjusted <= 350 ? "finisher" : "adult";

  if (stage === "finisher" && info.finisher) {
    const [minF, maxF] = info.finisher;
    const pad = 10;
    const minClamp = minF - pad;
    const maxClamp = maxF + pad;

    if (adjusted < minClamp) {
      adjusted = lerp(adjusted, minClamp, 0.3);
    } else if (adjusted > maxClamp) {
      adjusted = lerp(adjusted, maxClamp, 0.3);
    }
  }

  // Clamps por etapa
  if (stage === "grower") adjusted = clamp(adjusted, 40, 200);   // 40–200 lb
  if (stage === "adult")  adjusted = clamp(adjusted, 260, 600);  // 260–600 lb

  // Tope absoluto de seguridad (límite, NO valor fijo)
  adjusted = Math.min(adjusted, 600);

  return Math.round(adjusted * 10) / 10;
};

// ===== Demo: generar medidas a partir de la imagen (determinista local) =====
// Rango afinado para dar variaciones realistas (evita empujar a >600)
const measuresFromImageLocal = (uri) => {
  let h = 0; for (const c of uri) h = (h * 31 + c.charCodeAt(0)) % 100000;
  const map = (v, a, b) => a + (v % (b - a + 1));
  // Perímetro torácico y longitud en CM en rangos razonables
  const girth = map(h, 80, 115);       // cm (≈31.5"–45.3")
  const length = map(h >> 3, 90, 135); // cm (≈35.4"–53.1")
  return { girth, length };
};

export default function AssistantIAScreen({ navigation }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [imageUri, setImageUri] = useState(null);
  const [breed, setBreed] = useState(null);
  const [weightLb, setWeightLb] = useState(null);
  const [healthRisk, setHealthRisk] = useState("—");

  // ⬇️ Estado del plan generado
  const [planTitle, setPlanTitle] = useState("");
  const [planBody, setPlanBody] = useState("");

  const askPermissions = async () => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    const gal = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (cam.status !== "granted" || gal.status !== "granted") {
      Alert.alert("Permisos", "Concede acceso a cámara y galería.");
      return false;
    }
    return true;
  };

  const analyzeUri = async (uri) => {
    setBusy(true);
    setImageUri(uri);

    // 1) Estimar raza
    const b = guessBreedLocal(uri);
    setBreed(b);

    // 2) Extraer medidas (simuladas) y estimar peso afinado por raza
    const { girth, length } = measuresFromImageLocal(uri);
    const w = breedAwareWeightLb(b, girth, length);
    setWeightLb(w);

    // 3) Alertas de salud según el peso final
    if (w == null) {
      setHealthRisk("—");
    } else if (w < 100) {
      setHealthRisk("Bajo");
    } else if (w > 300) {
      setHealthRisk("Alto");
    } else {
      setHealthRisk("Saludable");
    }

    setBusy(false);
  };

  const fromCamera = async () => {
    if (!(await askPermissions())) return;
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.9 });
    if (!res.canceled) analyzeUri(res.assets[0].uri);
  };

  const fromGallery = async () => {
    if (!(await askPermissions())) return;
    const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.9 });
    if (!res.canceled) analyzeUri(res.assets[0].uri);
  };

  const quickFill = (txt) => setMessage(txt);

  // ======== Generar plan según mensaje ========
  const generatePlan = () => {
    const txt = (message || "").toLowerCase().trim();

    if (!txt) {
      Alert.alert("Mensaje vacío", "Escribe o elige una opción antes de generar el plan.");
      return;
    }

    const wLbNum = Number(weightLb) || null;
    const wKg = wLbNum ? Math.round((wLbNum / 2.205) * 10) / 10 : null;

    const setPlan = (title, lines) => {
      setPlanTitle(title);
      setPlanBody(lines.join("\n"));
    };

    if (txt.includes("diagnost")) {
      setPlan("Plan de diagnóstico",
        [
          "1) Observación:",
          "   • Temperatura, apetito, actividad, tos, diarrea, lesiones.",
          "2) Aislamiento:",
          "   • Separar el animal si hay signos evidentes para evitar contagios.",
          "3) Revisión rápida:",
          "   • Mucosas, hidratación (pliegue cutáneo), respiración/minuto.",
          "4) Registro:",
          "   • Fecha, lote, corral, síntomas y duración.",
          "5) Próximos pasos:",
          "   • Hidratar si hay diarrea; mejorar cama/ventilación si hay tos.",
          "   • Consultar al veterinario ante fiebre alta o empeoramiento.",
        ]
      );
      return;
    }

    if (txt.includes("dosis") || txt.includes("dos") || txt.includes("estimada")) {
      const mgPerKg = 5; // DEMO
      if (!wKg) {
        setPlan("Sugerencia de dosis (ejemplo educativo)",
          [
            "No se detectó el peso automáticamente.",
            `• Fórmula ejemplo: ${mgPerKg} mg/kg (revisa el medicamento real).`,
            "• Si conoces el peso, multiplica: peso(kg) × mg/kg.",
            "• Verifica concentración del producto (mg/mL) para calcular el volumen.",
            "⚠️ Guía educativa. Consulta a tu veterinario antes de medicar.",
          ]
        );
      } else {
        const totalMg = Math.round(wKg * mgPerKg);
        const concMgPerMl = 100; // DEMO
        const ml = Math.round((totalMg / concMgPerMl) * 100) / 100;
        setPlan("Sugerencia de dosis (ejemplo educativo)",
          [
            `Peso estimado: ${wKg} kg (${wLbNum} lb)`,
            `• Dosis ejemplo: ${mgPerKg} mg/kg`,
            `• Total: ${totalMg} mg`,
            `• Si el producto es ${concMgPerMl} mg/mL → Volumen: ~${ml} mL`,
            "Notas:",
            "• Ajusta según el fármaco y concentración reales.",
            "• Consulta a tu veterinario antes de medicar.",
          ]
        );
      }
      return;
    }

    if (txt.includes("aliment")) {
      const weight = wLbNum || 200; // estimado si no hay foto
      let rationPct = 0.03;
      if (weight < 80) rationPct = 0.05;
      else if (weight < 150) rationPct = 0.04;
      else if (weight > 280) rationPct = 0.025;

      const rationLb = Math.round(weight * rationPct * 10) / 10;

      setPlan("Plan de alimentación",
        [
          `Peso de referencia: ${wLbNum ? `${wLbNum} lb` : `~${weight} lb (estimado)`}`,
          `• Ración diaria: ~${rationLb} lb/día (≈ ${(rationLb/2.205).toFixed(1)} kg/día)`,
          "• Frecuencia: 2–3 comidas/día",
          "• Agua: acceso libre, revisar bebederos",
          "",
          "Composición sugerida:",
          "• Energía: maíz/sorgo; Proteína: soya (12–18% según etapa)",
          "• Minerales: Ca/P + premezcla vitamínica",
          "Ajustes:",
          "• +5–10% si está bajo de condición",
          "• −5–10% si hay exceso de grasa",
        ]
      );
      return;
    }

    if (txt.includes("pronó") || txt.includes("pronost")) {
      const breedAdj = { Yorkshire: 0.95, Duroc: 1.0, Landrace: 0.9, Pietrain: 0.85, Hampshire: 0.92 };
      const baseADG = 0.9; // lb/día DEMO
      const mult = breed ? (breedAdj[breed] ?? 0.9) : 0.9;
      const adg = Math.round(baseADG * mult * 100) / 100;

      const start = wLbNum || 200;
      const days = 30;
      // Respeta el tope de 600 lb en la proyección
      const projected = Math.min(600, Math.round((start + adg * days) * 10) / 10);

      setPlan("Pronóstico de peso (30 días)",
        [
          `Raza: ${breed || "—"}  |  ADG: ~${adg} lb/día`,
          `Peso inicial: ${wLbNum ? `${wLbNum} lb` : `~${start} lb (referencia)`}`,
          `Proyección a ${days} días: ~${projected} lb (máx. 600)`,
          "Sugerencias:",
          "• Densidad adecuada, buena ventilación",
          "• Ración suficiente y agua limpia",
          "• Control sanitario y antiparasitario",
        ]
      );
      return;
    }

    setPlan("Plan general",
      [
        "No identifiqué el tipo de plan por el texto ingresado.",
        "Usa: Diagnosticar síntoma, Sugerir dosis estimada, Plan de alimentación o Pronóstico de peso.",
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.green900 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.hBtn}>
          <MaterialCommunityIcons name="arrow-left" size={scale(22)} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Asistente IA — Monitoreo Porcino</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.green900 }}
        contentContainerStyle={{ padding: scale(16), paddingBottom: scale(28) }}
        showsVerticalScrollIndicator
      >
        {/* Burbuja saludo */}
        <View style={styles.bubble}>
          <MaterialCommunityIcons name="pig-variant-outline" size={scale(22)} color={Colors.green700} />
          <Text style={styles.bubbleText}>Hola, ¿en qué puedo ayudarte hoy?</Text>
        </View>

        {/* Input + botón cámara */}
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#cbd5e1"
            value={message}
            onChangeText={setMessage}
            style={styles.input}
          />
          <TouchableOpacity style={styles.camBtn} onPress={fromCamera}>
            <MaterialCommunityIcons name="camera" size={scale(20)} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Chips de acciones rápidas */}
        <View style={styles.chipsWrap}>
          {[
            "Diagnosticar síntoma",
            "Sugerir dosis estimada",
            "Plan de alimentación",
            "Pronóstico de peso",
          ].map((t) => (
            <TouchableOpacity key={t} style={styles.chip} onPress={() => quickFill(t)}>
              <Text style={styles.chipTxt}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tarjeta de Alertas de salud (siempre visible) */}
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Alertas de salud</Text>
          <Text style={styles.alertSub}>
            Estado general: <Text style={{ fontWeight: "900" }}>{weightLb == null ? "—" : healthRisk}</Text>
          </Text>
        </View>

        {/* Acciones principales */}
        <View style={{ flexDirection: "row", gap: scale(10) }}>
          <TouchableOpacity style={styles.primaryBtn} onPress={fromGallery}>
            <Text style={styles.primaryTxt}>Analizar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: Colors.green600 }]}
            onPress={generatePlan}
          >
            <Text style={styles.primaryTxt}>Generar plan</Text>
          </TouchableOpacity>
        </View>

        {/* Resultado análisis */}
        {busy && (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.white} size="small" />
            <Text style={styles.loadingTxt}>Analizando imagen…</Text>
          </View>
        )}

        {imageUri && !busy && (
          <View style={styles.resultCard}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>Resultados del análisis</Text>
              <Text style={styles.resultLine}>Raza estimada: <Text style={{ fontWeight: "900" }}>{breed}</Text></Text>
              <Text style={styles.resultLine}>Peso estimado (máx. 600 lb): <Text style={{ fontWeight: "900" }}>{weightLb} lb</Text></Text>
              <Text style={styles.resultHint}>*Fórmula en pulgadas (base realista) + ajuste por raza y reencuadre finisher.</Text>
            </View>
          </View>
        )}

        {/* 📝 Plan generado */}
        {planTitle ? (
          <View style={styles.planCard}>
            <Text style={styles.planTitle}>{planTitle}</Text>
            {planBody.split("\n").map((line, idx) => (
              <Text key={idx} style={styles.planLine}>{line}</Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/* ====================== Estilos (con escala) ====================== */
const styles = StyleSheet.create({
  header: {
    height: scale(60),
    backgroundColor: Colors.green900,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(10),
  },
  hBtn: { width: scale(36), height: scale(36), alignItems: "center", justifyContent: "center" },
  hTitle: { flex: 1, color: Colors.white, fontWeight: "900", fontSize: scale(18), textAlign: "left" },

  bubble: {
    backgroundColor: Colors.card,
    borderRadius: scale(16),
    paddingVertical: scale(14),
    paddingHorizontal: scale(14),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  bubbleText: { color: Colors.green700, fontWeight: "800", fontSize: scale(16) },

  inputRow: {
    marginTop: scale(14),
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#174C36",
    borderRadius: scale(16),
    padding: scale(8),
  },
  input: {
    flex: 1,
    color: Colors.white,
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    fontWeight: "700",
    fontSize: scale(16),
  },
  camBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    backgroundColor: Colors.green700,
    alignItems: "center",
    justifyContent: "center",
  },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: scale(10), marginTop: scale(14) },
  chip: {
    backgroundColor: "#1C5C41",
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: 999,
  },
  chipTxt: { color: "#ddf0e6", fontWeight: "800", fontSize: scale(13) },

  alertCard: {
    backgroundColor: Colors.card,
    borderRadius: scale(18),
    padding: scale(16),
    marginTop: scale(14),
  },
  alertTitle: { fontWeight: "900", color: Colors.green700, marginBottom: scale(6), fontSize: scale(16) },
  alertSub: { color: Colors.green700, fontWeight: "700", fontSize: scale(15) },

  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.green700,
    borderRadius: scale(16),
    paddingVertical: scale(14),
    alignItems: "center",
    marginTop: scale(14),
  },
  primaryTxt: { color: Colors.white, fontWeight: "900", fontSize: scale(16) },

  loading: { flexDirection: "row", alignItems: "center", marginTop: scale(14) },
  loadingTxt: { color: Colors.white, marginLeft: scale(10), fontWeight: "800", fontSize: scale(14) },

  resultCard: {
    marginTop: scale(14),
    backgroundColor: Colors.card,
    borderRadius: scale(18),
    padding: scale(14),
    flexDirection: "row",
    gap: scale(12),
  },
  preview: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(14),
    backgroundColor: "#173b2d",
  },
  resultTitle: { fontWeight: "900", color: Colors.green700, marginBottom: scale(6), fontSize: scale(16) },
  resultLine: { color: Colors.green700, marginTop: scale(3), fontWeight: "700", fontSize: scale(15) },
  resultHint: { color: Colors.muted, marginTop: scale(8), fontSize: scale(12) },

  planCard: {
    marginTop: scale(14),
    backgroundColor: Colors.white,
    borderRadius: scale(18),
    padding: scale(14),
  },
  planTitle: { fontWeight: "900", color: Colors.text, fontSize: scale(16), marginBottom: scale(8) },
  planLine: { color: Colors.text, fontSize: scale(14), marginTop: scale(2) },
});
