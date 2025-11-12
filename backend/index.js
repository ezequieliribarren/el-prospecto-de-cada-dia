const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });
require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
// path already required above
const fs = require('fs');
const BetterDB = require('better-sqlite3');

const apiRoutes = require('./routes');
const { ensureDb } = require('./models/db');

let PORT = Number(process.env.PORT) || 4000;

const app = express();
const isProd = process.env.NODE_ENV === 'production';
// Robust CORS: admite lista separada por comas y normaliza sin '/'
const rawCors = process.env.CORS_ORIGIN || '';
const WHITELIST = rawCors
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const originFn = (origin, callback) => {
  // Permite non-browser requests (no Origin) como health checks
  if (!origin) return callback(null, true);
  const normalized = origin.replace(/\/$/, '');
  if (!WHITELIST.length) {
    // sin configuración: reflejar origen (útil en dev o cuando ya confías por proxy)
    return callback(null, normalized);
  }
  if (WHITELIST.includes(normalized)) {
    return callback(null, normalized);
  }
  return callback(new Error('Not allowed by CORS'), false);
};

app.set('trust proxy', 1);
app.use(cors({ origin: originFn, credentials: true }));
// Express 5 uses path-to-regexp v6 which doesn't accept '*' pattern.
// Use a catch-all pattern compatible with v6 for preflight requests.
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Conveniences so hitting root paths doesn't 404 during manual checks
app.get('/api', (_req, res) => {
  res.json({ ok: true, tip: 'Usa /api/* endpoints. Salud: /api/health' });
});
app.get('/', (_req, res) => {
  res.redirect('/api/health');
});

app.use('/api', apiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

function startServer(port, attemptsLeft = 5) {
  const server = app
    .listen(port, () => {
      PORT = port;
      console.log(`API listening on http://localhost:${PORT}`);
    })
    .on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        const next = port + 1;
        console.warn(`Port ${port} busy, trying ${next}...`);
        setTimeout(() => startServer(next, attemptsLeft - 1), 300);
      } else {
        console.error('Failed to start server:', err);
        process.exit(1);
      }
    });
}

// Ensure DB initialized before listening
(async () => {
  try {
    const adapter = await ensureDb();

    // Optional one-shot migration from a bundled SQLite file to Turso on boot
    if (process.env.MIGRATE_ON_BOOT && process.env.LIBSQL_URL) {
      try {
        const srcPath = process.env.MIGRATE_FROM_SQLITE_PATH || path.join(__dirname, 'database.sqlite');
        if (fs.existsSync(srcPath)) {
          const hasUsers = await adapter.prepare(`SELECT COUNT(*) as c FROM users`).get().then(r=>Number(r?.c||0));
          const hasPros = await adapter.prepare(`SELECT COUNT(*) as c FROM prospects`).get().then(r=>Number(r?.c||0));
          if ((hasUsers + hasPros) === 0) {
            const src = new BetterDB(srcPath);
            const pragma = (t)=> src.prepare(`PRAGMA table_info(${t})`).all().map(r=>r.name);
            const copy = async (table, orderById=true)=>{
              try {
                const cols = pragma(table);
                if (!cols.length) return;
                const colList = cols.join(',');
                const rows = src.prepare(`SELECT ${colList} FROM ${table} ${orderById?'ORDER BY id ASC':''}`).all();
                if (!rows.length) return;
                const placeholders = cols.map(()=>'?').join(',');
                const onConflict = cols.includes('id') ? ` ON CONFLICT(id) DO UPDATE SET ${cols.filter(c=>c!=='id').map(c=>`${c}=excluded.${c}`).join(', ')}` : '';
                const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})${onConflict}`;
                for (const row of rows){
                  const args = cols.map(c=> row[c] ?? null);
                  await adapter.prepare(sql).run(args);
                }
                console.log(`[MIGRATE] ${table}: ${rows.length} filas`);
              } catch (e){ console.warn(`[MIGRATE] ${table} aviso:`, e.message); }
            };
            await copy('settings', false);
            await copy('users');
            await copy('uploads');
            await copy('prospects');
            await copy('plan');
            await copy('upload_duplicates');
            await copy('work_sessions');
            console.log('[MIGRATE] Completa desde', srcPath);
          } else {
            console.log('[MIGRATE] Omitida: destino ya tiene datos');
          }
        } else {
          console.log('[MIGRATE] Archivo origen no encontrado, omitida');
        }
      } catch (e) {
        console.warn('[MIGRATE] Fallo de migracion (continuo sin bloquear):', e.message);
      }
    }
    startServer(PORT);
  } catch (e) {
    console.error('DB init failed:', e);
    process.exit(1);
  }
})();
