// src/database/firebaseConfig.js
// Inicialización de Firebase para React Native (Expo) con PERSISTENCIA DE SESIÓN

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getDatabase, ref, set, get, child } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAyc3VaZ3Bj7PdT2nrW4fAmPV9fiS09nTg",
  authDomain: "mundoporcino-8a9df.firebaseapp.com",
  projectId: "mundoporcino-8a9df",
  storageBucket: "mundoporcino-8a9df.appspot.com",
  messagingSenderId: "527534176172",
  appId: "1:527534176172:web:78687ba0f9d7b6fd6bec09",
  databaseURL: "https://mundoporcino-8a9df-default-rtdb.firebaseio.com",
};

// ✅ Singleton de la app (evita inicializar 2 veces en desarrollo)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ PERSISTENCIA DE SESIÓN EN REACT NATIVE (Expo)
// La PRIMERA llamada a Auth debe ser initializeAuth(...persistence...)
// Si el módulo se recarga en caliente, caemos a getAuth(app).
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

// Servicios principales (mismas instancias de antes)
const db = getFirestore(app);
const realtimeDb = getDatabase(app);
const storage = getStorage(app);

// 👉 Utilidad de prueba RTDB (opcional, igual que tenías)
export const testRTDB = async () => {
  try {
    await set(ref(realtimeDb, "test/hello"), {
      saludo: "Hola Mundo 🐖",
      fecha: new Date().toISOString(),
    });
    const snap = await get(child(ref(realtimeDb), "test/hello"));
    console.log("✅ Realtime DB:", snap.val());
    return snap.val();
  } catch (error) {
    console.error("❌ Error en testRTDB:", error);
  }
};

export { app, auth, db, realtimeDb, storage };
export default app;
