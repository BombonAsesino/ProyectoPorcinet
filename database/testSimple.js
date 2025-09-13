// Test simple de Firebase sin variables de entorno
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Configuración directa
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
const auth = getAuth(app);

export const testFirebaseSimple = () => {
  console.log('🔥 Test simple de Firebase...');
  console.log('📋 Configuración:');
  console.log('   - API Key:', firebaseConfig.apiKey ? 'Presente' : 'Faltante');
  console.log('   - Project ID:', firebaseConfig.projectId);
  console.log('   - Auth Domain:', firebaseConfig.authDomain);
  
  console.log('🔐 Auth:');
  console.log('   - App:', auth.app.name);
  console.log('   - Config:', auth.app.options);
  
  console.log('✅ Firebase inicializado correctamente');
  
  return {
    success: true,
    app: auth.app.name,
    projectId: firebaseConfig.projectId
  };
};

export { auth, app };
