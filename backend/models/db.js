const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
let db;

function ensureDb() {
  if (db) return db;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS prospects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      full_name TEXT,
      href TEXT,
      avatar_url TEXT,
      category TEXT DEFAULT 'lead',
      whatsapp_number TEXT,
      source TEXT,
      upload_id INTEGER,
      unwanted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      account_label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      updated_by_user_id INTEGER,
      assigned_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    );

    CREATE TABLE IF NOT EXISTS work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      start_ts TEXT NOT NULL,
      end_ts TEXT,
      duration_sec INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','sender')),
      phone_number TEXT,
      hourly_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      mime TEXT,
      size INTEGER,
      source TEXT,
      network TEXT,
      instagram_account TEXT,
      processed INTEGER,
      unique_count INTEGER,
      inserted INTEGER,
      unwanted_count INTEGER,
      skipped_no_username INTEGER,
      duplicates_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Columns added after initial version: ensure they exist
  try { db.prepare("SELECT avatar_url FROM prospects LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE prospects ADD COLUMN avatar_url TEXT"); } catch {}
  }
  try { db.prepare("SELECT category FROM prospects LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE prospects ADD COLUMN category TEXT DEFAULT 'lead'"); } catch {}
  }
  try { db.prepare("SELECT whatsapp_number FROM prospects LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE prospects ADD COLUMN whatsapp_number TEXT"); } catch {}
  }
  try { db.prepare("SELECT upload_id FROM prospects LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE prospects ADD COLUMN upload_id INTEGER"); } catch {}
  }
  try { db.prepare("SELECT updated_by_user_id FROM plan LIMIT 1").get(); } catch {
    db.exec("ALTER TABLE plan ADD COLUMN updated_by_user_id INTEGER");
  }
  try { db.prepare("SELECT user_id FROM work_sessions LIMIT 1").get(); } catch {
    db.exec("ALTER TABLE work_sessions ADD COLUMN user_id INTEGER");
  }
  try { db.prepare("SELECT assigned_user_id FROM plan LIMIT 1").get(); } catch {
    db.exec("ALTER TABLE plan ADD COLUMN assigned_user_id INTEGER");
  }
  try { db.prepare("SELECT source FROM uploads LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE uploads ADD COLUMN source TEXT"); } catch {}
  }
  try { db.prepare("SELECT network FROM uploads LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE uploads ADD COLUMN network TEXT"); } catch {}
  }
  try { db.prepare("SELECT instagram_account FROM uploads LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE uploads ADD COLUMN instagram_account TEXT"); } catch {}
  }
  try { db.prepare("SELECT duplicates_count FROM uploads LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE uploads ADD COLUMN duplicates_count INTEGER DEFAULT 0"); } catch {}
  }
  // Track duplicates per upload
  db.exec(`
    CREATE TABLE IF NOT EXISTS upload_duplicates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER NOT NULL,
      username TEXT,
      full_name TEXT,
      href TEXT,
      source TEXT,
      network TEXT,
      instagram_account TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    );
  `);
  // Ensure users.hourly_rate exists (migrate from settings if present)
  try { db.prepare("SELECT hourly_rate FROM users LIMIT 1").get(); } catch {
    try { db.exec("ALTER TABLE users ADD COLUMN hourly_rate REAL DEFAULT 0"); } catch {}
  }
  // Ensure per_day default (messages per sender per day)
  const perDayRow = db.prepare(`SELECT value FROM settings WHERE key='per_day'`).get();
  if (!perDayRow) {
    db.prepare(`INSERT INTO settings(key, value) VALUES('per_day', '25')`).run();
  }
  return db;
}

function getDb() {
  if (!db) return ensureDb();
  return db;
}

module.exports = { ensureDb, getDb };
