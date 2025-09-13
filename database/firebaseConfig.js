import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Configuración de Firebase - Proyecto mundoporcino-8a9df
const firebaseConfig = {
  apiKey: "AIzaSyAyc3VaZ3Bj7PdT2nrW4fAmPV9fiS09nTg",
  authDomain: "mundoporcino-8a9df.firebaseapp.com",
  projectId: "mundoporcino-8a9df",
  storageBucket: "mundoporcino-8a9df.firebasestorage.app",
  messagingSenderId: "527534176172",
  appId: "1:527534176172:web:78687ba0f9d7b6fd6bec09",
  databaseURL: "https://mundoporcino-8a9df-default-rtdb.firebaseio.com/"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios de Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const realtimeDb = getDatabase(app);
export const storage = getStorage(app);

export default app;
