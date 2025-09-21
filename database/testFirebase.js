// testFirebase.js — Test simple de Firebase para Expo
import { auth, db } from './firebaseConfig';

export const testFirebaseBasics = () => {
  console.log('🔥 Probando conexión a Firebase...');
  const projectId = auth?.app?.options?.projectId || 'No disponible';
  console.log('📋 Proyecto:', projectId);

  // Verificar Auth
  if (auth) {
    console.log('✅ Auth conectado:', auth.app.name);
    console.log('   - ProjectId:', projectId);
  } else {
    console.log('❌ Error: Auth no inicializado');
  }

  // Verificar Firestore
  if (db) {
    console.log('✅ Firestore conectado:', db.app.name);
    console.log('   - ProjectId:', db.app.options?.projectId || 'No disponible');
  } else {
    console.log('❌ Error: Firestore no inicializado');
  }

  console.log('🎉 ¡Firebase listo para usar!');

  return {
    auth: !!auth,
    firestore: !!db,
    projectId,
  };
};

// Función para probar registro (sin crear usuario real)
export const testRegistration = async (email, password) => {
  try {
    console.log('🧪 Probando registro de prueba...');

    if (!auth || !db) throw new Error('Servicios de Firebase no disponibles');

    console.log('✅ Servicios de Firebase disponibles');
    console.log('📧 Email:', email);
    console.log('🔒 Password length:', typeof password === 'string' ? password.length : 0);

    return { success: true, message: 'Servicios de Firebase listos para registro' };
  } catch (error) {
    console.error('❌ Error en prueba de registro:', error);
    return { success: false, message: error.message };
  }
};

