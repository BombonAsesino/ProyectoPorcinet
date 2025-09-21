// src/database/firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore /*, initializeFirestore*/ } from 'firebase/firestore';
import { getDatabase, ref, set, get, child } from 'firebase/database'; // 👈 añadido helpers RTDB
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAyc3VaZ3Bj7PdT2nrW4fAmPV9fiS09nTg',
  authDomain: 'mundoporcino-8a9df.firebaseapp.com',
  projectId: 'mundoporcino-8a9df',
  storageBucket: 'mundoporcino-8a9df.appspot.com',
  messagingSenderId: '527534176172',
  appId: '1:527534176172:web:78687ba0f9d7b6fd6bec09',
  // ✅ URL de tu Realtime Database
  databaseURL: 'https://mundoporcino-8a9df-default-rtdb.firebaseio.com'
};

// ✅ Singleton de la app
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Servicios principales
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ Una sola instancia de RTDB
export const realtimeDb = getDatabase(app);

// 👉 Funciones utilitarias para que pruebes
export const testRTDB = async () => {
  try {
    // Escribir un valor de prueba
    await set(ref(realtimeDb, 'test/hello'), {
      saludo: 'Hola Mundo 🐖',
      fecha: new Date().toISOString()
    });

    // Leer el valor de prueba
    const snap = await get(child(ref(realtimeDb), 'test/hello'));
    console.log('✅ Realtime DB:', snap.val());
    return snap.val();
  } catch (error) {
    console.error('❌ Error en testRTDB:', error);
  }
};

export default app;
