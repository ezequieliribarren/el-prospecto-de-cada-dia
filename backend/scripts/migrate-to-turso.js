// Migrate data from local SQLite file to Turso (libSQL)
// Usage:
//   LIBSQL_URL=... LIBSQL_AUTH_TOKEN=... node backend/scripts/migrate-to-turso.js [SOURCE_DB_PATH]
// Defaults SOURCE_DB_PATH to backend/database.sqlite

const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');

async function main(){
  const srcPath = process.argv[2] || process.env.SOURCE_DB_PATH || path.join(__dirname, '..', 'database.sqlite');
  const url = process.env.LIBSQL_URL;
  const token = process.env.LIBSQL_AUTH_TOKEN;
  if (!url) {
    console.error('LIBSQL_URL no definido. Exporta tus credenciales de Turso antes de ejecutar.');
    process.exit(1);
  }
  console.log('Origen (SQLite local):', srcPath);
  console.log('Destino (Turso):', url);

  const src = new Database(srcPath);
  const dst = createClient({ url, authToken: token });

  // Ensure schema on destination by hitting health-like noop (tables are created on API init, but script may run standalone)
  // Create minimal tables if not present
  const ensure = async (sql) => {
    try { await dst.execute(sql); } catch (_) {}
  };
  await ensure(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
  await ensure(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, phone_number TEXT, hourly_rate REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));`);
  await ensure(`CREATE TABLE IF NOT EXISTS prospects (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, full_name TEXT, href TEXT, avatar_url TEXT, category TEXT DEFAULT 'lead', whatsapp_number TEXT, source TEXT, upload_id INTEGER, unwanted INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));`);
  await ensure(`CREATE TABLE IF NOT EXISTS uploads (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, mime TEXT, size INTEGER, source TEXT, network TEXT, instagram_account TEXT, processed INTEGER, unique_count INTEGER, inserted INTEGER, unwanted_count INTEGER, skipped_no_username INTEGER, duplicates_count INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));`);
  await ensure(`CREATE TABLE IF NOT EXISTS plan (id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id INTEGER NOT NULL, date TEXT NOT NULL, account_label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', updated_by_user_id INTEGER, assigned_user_id INTEGER, created_at TEXT DEFAULT (datetime('now')));`);
  await ensure(`CREATE TABLE IF NOT EXISTS upload_duplicates (id INTEGER PRIMARY KEY AUTOINCREMENT, upload_id INTEGER NOT NULL, username TEXT, full_name TEXT, href TEXT, source TEXT, network TEXT, instagram_account TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  await ensure(`CREATE TABLE IF NOT EXISTS work_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, start_ts TEXT NOT NULL, end_ts TEXT, duration_sec INTEGER);`);

  async function pragmaTableColumns(table){
    const info = src.prepare(`PRAGMA table_info(${table})`).all();
    return info.map(r=>r.name);
  }

  async function copyTable(table, orderById = true){
    const cols = await pragmaTableColumns(table);
    const colList = cols.join(',');
    const rows = src.prepare(`SELECT ${colList} FROM ${table} ${orderById ? 'ORDER BY id ASC' : ''}`).all();
    if (!rows.length) { console.log(`- ${table}: 0 filas`); return; }
    const placeholders = cols.map(()=>'?').join(',');
    const onConflict = cols.includes('id') ? ` ON CONFLICT(id) DO UPDATE SET ${cols.filter(c=>c!=='id').map(c=>`${c}=excluded.${c}`).join(', ')}` : '';
    const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})${onConflict}`;
    let inserted = 0;
    for (const row of rows){
      const args = cols.map(c=> row[c] ?? null);
      try { await dst.execute({ sql, args }); inserted++; } catch (e) { console.warn(`  ! fila id=${row.id||'?'}: ${e.message}`); }
    }
    console.log(`- ${table}: ${inserted}/${rows.length} filas migradas`);
  }

  // Order to satisfy FKs
  await copyTable('settings', false);
  await copyTable('users');
  await copyTable('uploads');
  await copyTable('prospects');
  await copyTable('plan');
  await copyTable('upload_duplicates');
  await copyTable('work_sessions');

  console.log('Migracion completada.');
}

main().catch(err=>{ console.error(err); process.exit(1); });

