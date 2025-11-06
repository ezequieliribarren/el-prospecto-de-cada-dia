const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const apiRoutes = require('./routes');
const { ensureDb } = require('./models/db');

let PORT = Number(process.env.PORT) || 4000;

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || true; // string URL or true (reflect request)
app.set('trust proxy', 1);
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
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
    await ensureDb();
    startServer(PORT);
  } catch (e) {
    console.error('DB init failed:', e);
    process.exit(1);
  }
})();
