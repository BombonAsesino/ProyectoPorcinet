// testConnection.js — Verificación robusta de Firebase (SDK modular, RN/Web/Node)
import { auth, db, realtimeDb, storage } from './firebaseConfig';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  set as rtdbSet,
  get as rtdbGet,
} from 'firebase/database';

// Emuladores (opcional): SOLO si EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true'
async function maybeConnectEmulators() {
  try {
    const useEmulators =
      typeof process !== 'undefined' &&
      process?.env?.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

    if (!useEmulators) return;

    const [
      { connectAuthEmulator },
      { connectFirestoreEmulator },
      { connectDatabaseEmulator },
      { connectStorageEmulator },
    ] = await Promise.all([
      import('firebase/auth'),
      import('firebase/firestore'),
      import('firebase/database'),
      import('firebase/storage'),
    ]);

    // ⚠️ En dispositivo físico, reemplaza 'localhost' por la IP local de tu PC.
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectDatabaseEmulator(realtimeDb, 'localhost', 9000);
    connectStorageEmulator(storage, 'localhost', 9199);

    console.log('🧪 Emuladores conectados (Auth/Firestore/RTDB/Storage)');
  } catch (e) {
    console.log('⚠️ No se pudieron conectar emuladores:', e?.message || e);
  }
}

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

function showProjectInfo() {
  const opts = auth?.app?.options || {};
  const { runtime, nodeVersion } = runtimeInfo();

  console.log('📱 Firebase Connection Test - Porcinet');
  console.log('======================================');
  console.log('Fecha:', new Date().toLocaleString());
  console.log('Runtime:', runtime);
  console.log('Node.js:', nodeVersion);
  console.log('');
  console.log('📋 Config detectada:');
  console.log('  • projectId     :', opts.projectId || 'No disponible');
  console.log('  • authDomain    :', opts.authDomain || 'No disponible');
  console.log('  • storageBucket :', opts.storageBucket || 'No disponible');
  console.log('');
}

async function pingFirestoreRead() {
  try {
    await getDocs(collection(db, 'diag_ping')); // ✅ nombre válido
    console.log('   ✅ Lectura Firestore OK');
    return true;
  } catch (e) {
    console.log('   ⚠️ Lectura Firestore falló:', e?.message || e);
    return false;
  }
}

async function pingFirestoreWriteDelete() {
  const ref = doc(db, 'diag_meta', 'connection'); // ✅ colección válida
  try {
    await setDoc(ref, {
      ts: Date.now(),
      ok: true,
      source: 'testConnection.js',
    });
    console.log('   ✅ Escritura Firestore OK');
  } catch (e) {
    console.log('   ⚠️ Escritura Firestore falló:', e?.message || e);
    console.log('      💡 Si ves PERMISSION_DENIED, ajusta reglas o usa emuladores.');
    return false;
  }
  try {
    await deleteDoc(ref);
    console.log('   🧹 Documento de prueba (Firestore) eliminado');
  } catch (e) {
    console.log('   (Nota) No se pudo eliminar doc de prueba:', e?.message || e);
  }
  return true;
}

async function pingRealtimeDB() {
  try {
    const path = rtdbRef(realtimeDb, 'diag/ping'); // ✅ path no reservado
    await rtdbSet(path, { ts: Date.now(), ok: true });
    const snap = await rtdbGet(path);
    if (snap.exists()) {
      console.log('   ✅ Realtime DB OK (write/read)');
      return true;
    }
    console.log('   ⚠️ Realtime DB: no se pudo leer el ping');
    return false;
  } catch (e) {
    console.log('   ⚠️ Realtime DB falló:', e?.message || e);
    return false;
  }
}

export async function testFirebaseConnection() {
  console.log('🔥 Iniciando verificación de conexión a Firebase...\n');

  await maybeConnectEmulators();
  showProjectInfo();

  // 1) Servicios inicializados
  console.log('🔌 Servicios:');
  console.log('  • Auth        :', auth ? `✅ app=${auth.app.name}` : '❌ no inicializado');
  console.log('  • Firestore   :', db ? `✅ app=${db.app.name}` : '❌ no inicializado');
  console.log('  • Realtime DB :', realtimeDb ? `✅ app=${realtimeDb.app.name}` : '❌ no inicializado');
  console.log('  • Storage     :', storage ? `✅ app=${storage.app.name}` : '❌ no inicializado');

  // 2) Firestore (lectura, luego escritura/borrado)
  console.log('\n🗄️ Firestore:');
  const fsReadOk = await pingFirestoreRead();
  const fsWriteOk = await pingFirestoreWriteDelete();

  // 3) Realtime Database
  console.log('\n⚡ Realtime Database:');
  const rtdbOk = await pingRealtimeDB();

  // Resumen
  const ok =
    !!auth &&
    !!db &&
    fsReadOk &&
    fsWriteOk &&
    !!realtimeDb &&
    rtdbOk &&
    !!storage;

  console.log('\n📊 Resumen:');
  console.log('  • Auth        :', !!auth ? '✅' : '❌');
  console.log('  • Firestore R :', fsReadOk ? '✅' : '❌');
  console.log('  • Firestore W :', fsWriteOk ? '✅' : '❌');
  console.log('  • Realtime DB :', rtdbOk ? '✅' : '❌');
  console.log('  • Storage     :', !!storage ? '✅' : '❌');

  console.log(ok ? '\n🎉 Verificación completada con éxito\n' : '\n⚠️ Verificación completada con advertencias\n');
  return ok;
}

// Auto-run (seguro); comenta si no lo quieres ejecutar al importar
try { testFirebaseConnection().catch(() => {}); } catch {}
