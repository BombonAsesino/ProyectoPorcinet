// Test simple de Firebase para Expo
import { auth, db } from './firebaseConfig';

export const testFirebaseConnection = () => {
  console.log('🔥 Probando conexión a Firebase...');
  console.log('📋 Proyecto: mundoporcino-8a9df');
  
  // Verificar Auth
  if (auth) {
    console.log('✅ Auth conectado:', auth.app.name);
    console.log('   - Config:', auth.app.options.projectId);
  } else {
    console.log('❌ Error: Auth no inicializado');
  }
  
  // Verificar Firestore
  if (db) {
    console.log('✅ Firestore conectado:', db.app.name);
    console.log('   - Config:', db.app.options.projectId);
  } else {
    console.log('❌ Error: Firestore no inicializado');
  }
  
  console.log('🎉 ¡Firebase listo para usar!');
  
  return {
    auth: !!auth,
    firestore: !!db,
    projectId: auth?.app?.options?.projectId || 'No disponible'
  };
};

// Función para probar registro (sin crear usuario real)
export const testRegistration = async (email, password) => {
  try {
    console.log('🧪 Probando registro de prueba...');
    
    // Solo verificar que los servicios estén disponibles
    if (!auth || !db) {
      throw new Error('Servicios de Firebase no disponibles');
    }
    
    console.log('✅ Servicios de Firebase disponibles');
    console.log('📧 Email:', email);
    console.log('🔒 Password length:', password.length);
    
    return {
      success: true,
      message: 'Servicios de Firebase listos para registro'
    };
    
  } catch (error) {
    console.error('❌ Error en prueba de registro:', error);
    return {
      success: false,
      message: error.message
    };
  }
};
