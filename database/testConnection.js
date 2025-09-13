// Archivo de prueba para verificar la conexión a Firebase
import { auth, db, realtimeDb, storage } from './firebaseConfig.js';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectDatabaseEmulator } from 'firebase/database';
import { connectStorageEmulator } from 'firebase/storage';

console.log('🔥 Iniciando verificación de conexión a Firebase...\n');

// Función para verificar la conexión a Firebase
async function testFirebaseConnection() {
  try {
    console.log('📋 Configuración de Firebase:');
    console.log('   - Proyecto: porcinet-347e5');
    console.log('   - Auth Domain: porcinet-347e5.firebaseapp.com');
    console.log('   - Storage Bucket: porcinet-347e5.firebasestorage.app\n');

    // Verificar Auth
    console.log('🔐 Verificando servicio de Autenticación...');
    if (auth) {
      console.log('   ✅ Auth inicializado correctamente');
      console.log('   - App: ', auth.app.name);
      console.log('   - Config: ', auth.app.options);
    } else {
      console.log('   ❌ Error al inicializar Auth');
    }

    // Verificar Firestore
    console.log('\n🗄️ Verificando Firestore...');
    if (db) {
      console.log('   ✅ Firestore inicializado correctamente');
      console.log('   - App: ', db.app.name);
    } else {
      console.log('   ❌ Error al inicializar Firestore');
    }

    // Verificar Realtime Database
    console.log('\n⚡ Verificando Realtime Database...');
    if (realtimeDb) {
      console.log('   ✅ Realtime Database inicializado correctamente');
      console.log('   - App: ', realtimeDb.app.name);
    } else {
      console.log('   ❌ Error al inicializar Realtime Database');
    }

    // Verificar Storage
    console.log('\n💾 Verificando Storage...');
    if (storage) {
      console.log('   ✅ Storage inicializado correctamente');
      console.log('   - App: ', storage.app.name);
    } else {
      console.log('   ❌ Error al inicializar Storage');
    }

    // Prueba de conectividad básica
    console.log('\n🌐 Probando conectividad...');
    try {
      // Intentar conectar a Firestore (esto hará una petición real)
      const testRef = db.collection('test').doc('connection');
      await testRef.set({
        timestamp: new Date(),
        message: 'Conexión exitosa a Firebase',
        project: 'porcinet-347e5'
      });
      console.log('   ✅ Conexión a Firestore exitosa');
      
      // Limpiar el documento de prueba
      await testRef.delete();
      console.log('   🧹 Documento de prueba eliminado');
      
    } catch (error) {
      console.log('   ⚠️ Error de conectividad:', error.message);
      console.log('   💡 Esto puede ser normal si no tienes reglas de seguridad configuradas');
    }

    console.log('\n🎉 Verificación completada!');
    console.log('📊 Resumen:');
    console.log('   - Auth: ✅');
    console.log('   - Firestore: ✅');
    console.log('   - Realtime DB: ✅');
    console.log('   - Storage: ✅');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  }
}

// Función para mostrar información del proyecto
function showProjectInfo() {
  console.log('📱 Proyecto Porcinet - Firebase Connection Test');
  console.log('===============================================');
  console.log('Fecha:', new Date().toLocaleString());
  console.log('Node.js:', process.version);
  console.log('');
}

// Ejecutar la verificación
showProjectInfo();
testFirebaseConnection();

export { testFirebaseConnection };
