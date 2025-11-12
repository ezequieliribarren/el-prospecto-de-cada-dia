/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });
require('dotenv').config({ override: true });
// path already required above
const fs = require('fs');
const os = require('os');
const { createClient } = require('@libsql/client');
const Database = require('better-sqlite3');

const requestedPath = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
const tmpFallbackPath = path.join(os.tmpdir(), 'database.sqlite');

let adapter = null;

function mkBetterAdapter(filePath) {
  const raw = new Database(filePath);
  raw.pragma('journal_mode = WAL');
  return {
    kind: 'better',
    raw,
    async exec(sql) { raw.exec(sql); },
    prepare(sql) {
      const st = raw.prepare(sql);
      const spread = (args) => {
        if (!args || args.length === 0) return [];
        if (args.length === 1 && Array.isArray(args[0])) return args[0];
        return args;
      };
      return {
        async get(...args){ const a = spread(args); return a.length ? st.get(...a) : st.get(); },
        async all(...args){ const a = spread(args); return a.length ? st.all(...a) : st.all(); },
        async run(...args){
          const a = spread(args);
          const r = a.length ? st.run(...a) : st.run();
          return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
        }
      };
    },
    transaction(fn){
      return async (...args) => {
        try { raw.exec('BEGIN'); await fn(...args); raw.exec('COMMIT'); }
        catch(e){ try { raw.exec('ROLLBACK'); } catch {} throw e; }
      };
    }
  };
}

function mkLibsqlAdapter(url, token){
  const client = createClient({ url, authToken: token });
  return {
    kind: 'libsql',
    async exec(sql){
      // naive split; acceptable for our DDL/DML here
      for (const stmt of sql.split(';')){
        const s = stmt.trim();
        if (!s) continue;
        await client.execute(s);
      }
    },
    prepare(sql){
      const norm = (args) => {
        if (!args || args.length === 0) return undefined;
        if (args.length === 1 && Array.isArray(args[0])) return args[0];
        return args;
      };
      return {
        async get(...args){ const r = await client.execute({ sql, args: norm(args) }); return r.rows?.[0] || undefined; },
        async all(...args){ const r = await client.execute({ sql, args: norm(args) }); return r.rows || []; },
        async run(...args){
          const r = await client.execute({ sql, args: norm(args) });
          return { changes: r.rowsAffected || 0, lastInsertRowid: r.lastInsertRowid };
        },
      };
    },
    transaction(fn){
      return async (...args) => {
        const tx = await client.transaction();
        const txAdapter = {
          exec: (s) => tx.execute(s),
          prepare: (sql) => ({
            get: (p)=> tx.execute({ sql, args: p }).then(r=> r.rows?.[0] || undefined),
            all: (p)=> tx.execute({ sql, args: p }).then(r=> r.rows || []),
            run: (...a)=> {
              const params = a.length === 1 ? a[0] : a;
              return tx.execute({ sql, args: params }).then(r=> ({ changes: r.rowsAffected||0, lastInsertRowid: r.lastInsertRowid }));
            },
          })
        };
        try { await fn(txAdapter, ...args); await tx.commit(); }
        catch(e){ try { await tx.rollback(); } catch {} throw e; }
      };
    }
  };
}

async function ensureDb() {
  if (adapter) return adapter;
  if (process.env.LIBSQL_URL) {
    adapter = mkLibsqlAdapter(process.env.LIBSQL_URL, process.env.LIBSQL_AUTH_TOKEN || undefined);
  } else {
    // Try requested path first, then /tmp fallback (ephemeral)
    const tryOpen = (p)=>{
      try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {}
      try { return mkBetterAdapter(p); } catch { return null; }
    };
    adapter = tryOpen(requestedPath) || tryOpen(tmpFallbackPath);
    if (adapter && adapter.raw && adapter.raw.name !== requestedPath) {
      console.warn(`[DB] Usando base en fallback temporal: ${adapter.raw.name}. Los datos no persistiran en reinicios.`);
    }
    if (!adapter) throw new Error('No se pudo abrir la base de datos.');
  }

  // Schema setup (works for ambos adapters)
  await adapter.exec(`
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

  // Ensure extra columns
  async function ensureColumn(table, col, ddl){
    try {
      const info = await adapter.prepare(`PRAGMA table_info(${table})`).all();
      const names = new Set(info.map(r=> r.name));
      if (!names.has(col)) await adapter.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch {}
  }
  await ensureColumn('prospects','avatar_url','avatar_url TEXT');
  await ensureColumn('prospects','category',"category TEXT DEFAULT 'lead'");
  await ensureColumn('prospects','whatsapp_number','whatsapp_number TEXT');
  await ensureColumn('prospects','upload_id','upload_id INTEGER');
  // Classification/segmentation columns
  await ensureColumn('prospects','entity_kind',"entity_kind TEXT CHECK (entity_kind IN ('person','business'))");
  await ensureColumn('prospects','person_profession','person_profession TEXT');
  await ensureColumn('prospects','industry','industry TEXT');
  await ensureColumn('prospects','is_competitor','is_competitor INTEGER DEFAULT 0');
  await ensureColumn('prospects','lead_score','lead_score INTEGER DEFAULT 0');
  await ensureColumn('prospects','interest_probability','interest_probability REAL DEFAULT 0');
  await ensureColumn('prospects','classification_signals','classification_signals TEXT');
  await ensureColumn('prospects','classification_version','classification_version TEXT');
  await ensureColumn('prospects','classification_updated_at','classification_updated_at TEXT');
  await ensureColumn('plan','updated_by_user_id','updated_by_user_id INTEGER');
  await ensureColumn('plan','assigned_user_id','assigned_user_id INTEGER');
  await ensureColumn('uploads','source','source TEXT');
  await ensureColumn('uploads','network','network TEXT');
  await ensureColumn('uploads','instagram_account','instagram_account TEXT');
  await ensureColumn('uploads','duplicates_count','duplicates_count INTEGER DEFAULT 0');

  await adapter.exec(`
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
  await ensureColumn('users','hourly_rate','hourly_rate REAL DEFAULT 0');

  const perDayRow = await adapter.prepare(`SELECT value FROM settings WHERE key='per_day'`).get();
  if (!perDayRow) await adapter.prepare(`INSERT INTO settings(key, value) VALUES('per_day', '25')`).run();

  try {
    if (adapter.kind === 'libsql') {
      console.log(`[DB] Conectado a Turso (libSQL): ${process.env.LIBSQL_URL}`);
    } else if (adapter.kind === 'better' && adapter.raw && adapter.raw.name) {
      console.log(`[DB] Usando SQLite local: ${adapter.raw.name}`);
    }
  } catch {}

  return adapter;
}

function getDb(){ return adapter; }

module.exports = { ensureDb, getDb };
