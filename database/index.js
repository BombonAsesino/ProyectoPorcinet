// index.js — Punto de entrada de la base de datos
// Centraliza y reexporta los servicios de Firebase

// Exportar todo lo de firebaseConfig (auth, db, realtimeDb, storage, etc.)
export * from './firebaseConfig';

// Exportar la app principal (default)
export { default as firebaseApp } from './firebaseConfig';

// Exportar función de prueba de conexión
export { testFirebaseConnection } from './testConnection';
