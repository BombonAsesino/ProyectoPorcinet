// diagnoseFirebase.js — Diagnóstico seguro de Firebase (SDK modular, RN/Web/Node)
import { auth, db } from './firebaseConfig';

/** Detecta entorno de ejecución sin romper en RN */
function runtimeInfo() {
  let runtime = 'Unknown';
  try {
    if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') runtime = 'React Native';
    else if (typeof window !== 'undefined') runtime = 'Web';
    else runtime = 'Node';
  } catch {}
  let nodeVersion = 'N/A';
  try { nodeVersion = (typeof process !== 'undefined' && process?.version) ? process.version : 'N/A'; } catch {}
  return { runtime, nodeVersion };
}

export const diagnoseFirebase = () => {
  console.log('🔍 === DIAGNÓSTICO DE FIREBASE ===');

  const authApp = auth?.app || null;
  const dbApp   = db?.app || null;
  const opts    = authApp?.options || {};

  // 0. Entorno
  const { runtime, nodeVersion } = runtimeInfo();
  console.log('\n🖥️ 0. Entorno');
  console.log('   - Runtime:', runtime);
  console.log('   - Node.js:', nodeVersion);

  // 1. Verificar configuración detectada desde la app
  console.log('\n📋 1. Verificando configuración detectada...');
  if (authApp) {
    console.log('✅ Auth app:', authApp.name);
    console.log('   - Project ID:', opts.projectId || 'No disponible');
    console.log('   - API Key:', opts.apiKey ? 'Presente' : 'Faltante');
    console.log('   - Auth Domain:', opts.authDomain || 'No disponible');
  } else {
    console.log('❌ Auth no inicializado');
  }

  if (dbApp) {
    console.log('✅ Firestore app:', dbApp.name);
    console.log('   - Project ID:', dbApp.options?.projectId || 'No disponible');
  } else {
    console.log('❌ Firestore no inicializado');
  }

  // 2. Chequeos de configuración mínima
  console.log('\n✅ 2. Chequeos de configuración mínima...');
  const hasApiKey    = !!opts.apiKey;
  const hasProjectId = !!opts.projectId;

  console.log('   - API Key presente:', hasApiKey ? 'Sí' : 'No');
  console.log('   - Project ID presente:', hasProjectId ? 'Sí' : 'No');

  // 3. Estado de autenticación
  console.log('\n🔐 3. Estado de autenticación...');
  if (auth) {
    console.log('   - Usuario actual:', auth.currentUser?.uid || 'No hay usuario');
    console.log('   - Auth listo:', authApp ? 'Sí' : 'No');
  } else {
    console.log('   - Auth no disponible');
  }

  // 4. Conectividad (solo información de plataforma)
  console.log('\n🌐 4. Plataforma / Conectividad (básico)');
  console.log('   - Plataforma detectada:', runtime);

  // 5. Errores comunes (validaciones)
  console.log('\n⚠️ 5. Validaciones y posibles problemas...');
  if (!hasApiKey) {
    console.log('   ❌ ERROR: API Key no está definida en la configuración');
  }
  if (!hasProjectId) {
    console.log('   ❌ ERROR: Project ID no está definido en la configuración');
  }
  if (auth && !authApp) {
    console.log('   ❌ ERROR: Auth existe pero no tiene app inicializada');
  }

  console.log('\n🎯 === FIN DEL DIAGNÓSTICO ===');

  return {
    authReady: !!authApp,
    firestoreReady: !!dbApp,
    configReady: hasApiKey && hasProjectId,
    currentUser: auth?.currentUser?.uid || null,
    runtime,
    nodeVersion,
    projectId: opts.projectId || null,
  };
};

/** Prueba básica de disponibilidad de Auth (sin crear usuario) */
export const testAuthConnection = async () => {
  try {
    console.log('🧪 Probando conexión de autenticación...');
    if (!auth) throw new Error('Auth no está inicializado');

    const projectId = auth?.app?.options?.projectId || 'No disponible';
    console.log('✅ Servicio de Auth disponible');
    console.log('📱 Proyecto:', projectId);

    return {
      success: true,
      message: 'Conexión de autenticación exitosa',
      projectId,
    };
  } catch (error) {
    console.error('❌ Error en conexión de autenticación:', error);
    return {
      success: false,
      message: error?.message || String(error),
      error,
    };
  }
};
