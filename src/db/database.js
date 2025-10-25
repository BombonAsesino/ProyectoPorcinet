// src/db/database.js
import * as SQLite from "expo-sqlite"; // SDK 54+: API nueva

const dbPromise = SQLite.openDatabaseAsync("porcinet.db");

export const initDB = async () => {
  const db = await dbPromise;

  // 🐷 Tabla de animales
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS animales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      peso REAL,
      fecha TEXT
    );
  `);

  // 💰 Tabla de gastos/costos offline
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept TEXT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,          -- 'YYYY-MM-DD'
      notes TEXT,
      deleted INTEGER DEFAULT 0,
      updated_at TEXT,
      cloud_id TEXT,
      synced INTEGER DEFAULT 0,
      month_key TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(date);
    CREATE INDEX IF NOT EXISTS idx_costs_cat ON costs(category);
  `);

  // 🧬 NUEVA: tabla para control de reproducción (offline)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reproduction (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT,
      sowId TEXT,
      date TEXT,
      type TEXT,
      note TEXT,
      ts TEXT,
      cloud_id TEXT,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_repro_date ON reproduction(date);
    CREATE INDEX IF NOT EXISTS idx_repro_type ON reproduction(type);
  `);

  // ⚙️ Cola de operaciones pendientes (borrados offline)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_ops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      op TEXT NOT NULL,
      target_id TEXT NOT NULL,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
};

// Helpers
export const run = async (sql, params = []) => {
  const db = await dbPromise;
  return db.runAsync(sql, ...(Array.isArray(params) ? params : [params]));
};
export const all = async (sql, params = []) => {
  const db = await dbPromise;
  return db.getAllAsync(sql, ...(Array.isArray(params) ? params : [params]));
};
export const first = async (sql, params = []) => {
  const db = await dbPromise;
  return db.getFirstAsync(sql, ...(Array.isArray(params) ? params : [params]));
};
