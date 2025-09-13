// Diagnóstico de Firebase para identificar errores
import { auth, db } from './firebaseConfig';

export const diagnoseFirebase = () => {
  console.log('🔍 === DIAGNÓSTICO DE FIREBASE ===');
  
  // 1. Verificar configuración
  console.log('\n📋 1. Verificando configuración...');
  if (auth && auth.app) {
    console.log('✅ Auth app:', auth.app.name);
    console.log('   - Project ID:', auth.app.options.projectId);
    console.log('   - API Key:', auth.app.options.apiKey ? 'Presente' : 'Faltante');
  } else {
    console.log('❌ Auth no inicializado');
  }

  if (db && db.app) {
    console.log('✅ Firestore app:', db.app.name);
    console.log('   - Project ID:', db.app.options.projectId);
  } else {
    console.log('❌ Firestore no inicializado');
  }

  // 2. Verificar configuración hardcodeada
  console.log('\n🌍 2. Verificando configuración...');
  console.log('   - API Key:', auth?.app?.options?.apiKey ? 'Presente' : 'Faltante');
  console.log('   - Project ID:', auth?.app?.options?.projectId || 'No disponible');
  console.log('   - Auth Domain:', auth?.app?.options?.authDomain || 'No disponible');

  // 3. Verificar estado de autenticación
  console.log('\n🔐 3. Verificando estado de autenticación...');
  if (auth) {
    console.log('   - Usuario actual:', auth.currentUser ? auth.currentUser.uid : 'No hay usuario');
    console.log('   - Estado de carga:', auth.app ? 'Listo' : 'Cargando');
  }

  // 4. Verificar conectividad
  console.log('\n🌐 4. Verificando conectividad...');
  console.log('   - Navegador:', typeof window !== 'undefined' ? 'Web' : 'React Native');
  console.log('   - Plataforma:', typeof navigator !== 'undefined' ? navigator.userAgent : 'React Native');

  // 5. Errores comunes
  console.log('\n⚠️ 5. Verificando errores comunes...');
  
  if (!auth?.app?.options?.apiKey) {
    console.log('❌ ERROR: API Key no está definida en la configuración');
  }
  
  if (!auth?.app?.options?.projectId) {
    console.log('❌ ERROR: Project ID no está definido en la configuración');
  }

  if (auth && !auth.app) {
    console.log('❌ ERROR: Auth no tiene app inicializada');
  }

  console.log('\n🎯 === FIN DEL DIAGNÓSTICO ===');
  
  return {
    authReady: !!(auth && auth.app),
    firestoreReady: !!(db && db.app),
    configReady: !!(auth?.app?.options?.apiKey && auth?.app?.options?.projectId),
    currentUser: auth?.currentUser?.uid || null
  };
};

// Función para probar autenticación sin crear usuario
export const testAuthConnection = async () => {
  try {
    console.log('🧪 Probando conexión de autenticación...');
    
    if (!auth) {
      throw new Error('Auth no está inicializado');
    }

    // Verificar que el servicio esté disponible
    console.log('✅ Servicio de Auth disponible');
    console.log('📱 Proyecto:', auth.app.options.projectId);
    
    return {
      success: true,
      message: 'Conexión de autenticación exitosa',
      projectId: auth.app.options.projectId
    };
    
  } catch (error) {
    console.error('❌ Error en conexión de autenticación:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};
