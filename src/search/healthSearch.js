// src/search/healthSearch.js
import AsyncStorage from "@react-native-async-storage/async-storage";

function normalize(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Misma clave que en el screen
const HEALTH_CACHE_KEY = "health_local_cache_v1";

// Recibe el texto y la lista de cerdas que ya tienes en memoria (para desambiguar id->arete/nombre)
export async function searchHealthGlobal(text, animals = []) {
  const q = normalize(text);
  if (!q) return [];

  const results = [];
  // Buscamos en TODOS los caches de cerdas que tengas
  // (si manejas muchos animales, podrías limitarte a los visibles/recientes)
  const keys = await AsyncStorage.getAllKeys();
  const healthKeys = keys.filter((k) => k.startsWith(HEALTH_CACHE_KEY + ":"));

  for (const k of healthKeys) {
    try {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const data = JSON.parse(raw);
      const animalId = k.split(":")[1];

      const a = animals.find((z) => String(z.id) === String(animalId)) || {};
      const header = `#${a.earTag || "?"} • ${a.name || "Cerda"}`;

      // match por peso
      for (const w of data.weights || []) {
        const hay = normalize(`${w.date} ${w.kg} peso`);
        if (hay.includes(q)) {
          results.push({
            id: `health-w-${animalId}-${w.date}`,
            title: header,
            subtitle: `Peso ${w.kg} kg — ${w.date}`,
            icon: "scale-bathroom",
            target: { screen: "HealthAndGrowth", params: { id: animalId, earTag: a.earTag, name: a.name } },
            kind: "health",
          });
        }
      }

      // match por tratamientos
      for (const t of data.treatments || []) {
        const hay = normalize(`${t.date} ${t.note}`);
        if (hay.includes(q)) {
          results.push({
            id: `health-t-${animalId}-${t.date}-${t.note?.slice(0,10)}`,
            title: header,
            subtitle: `Tratamiento — ${t.note} (${t.date})`,
            icon: "medical-bag",
            target: { screen: "HealthAndGrowth", params: { id: animalId, earTag: a.earTag, name: a.name } },
            kind: "health",
          });
        }
      }
    } catch {}
  }

  return results;
}
