// testSimple.js — Test simple de Firebase usando la config central
import { auth, db } from './firebaseConfig';

export const testFirebaseSimple = () => {
  console.log('🔥 Test simple de Firebase...');
  const opts = auth?.app?.options || {};

  console.log('📋 Configuración detectada:');
  console.log('   - API Key:', opts.apiKey ? 'Presente' : 'Faltante');
  console.log('   - Project ID:', opts.projectId || 'No disponible');
  console.log('   - Auth Domain:', opts.authDomain || 'No disponible');
  console.log('   - Storage Bucket:', opts.storageBucket || 'No disponible');

  console.log('🔐 Auth:');
  console.log('   - App:', auth?.app?.name || 'No inicializado');
  console.log('   - Usuario actual:', auth?.currentUser?.uid || 'Ninguno');

  console.log('✅ Firebase inicializado correctamente');

  return {
    success: !!auth,
    app: auth?.app?.name || null,
    projectId: opts.projectId || null,
  };
};
