// Archivo principal de la base de datos
// Exporta todas las configuraciones y servicios de Firebase

export { default as firebaseApp, auth, db, realtimeDb, storage } from './firebaseConfig';

// Servicios adicionales que puedas necesitar
export * from './firebaseConfig';

// Función de prueba de conexión
export { testFirebaseConnection } from './testConnection';
