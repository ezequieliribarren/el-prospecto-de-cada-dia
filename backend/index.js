const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const apiRoutes = require('./routes');
const { ensureDb } = require('./models/db');

let PORT = Number(process.env.PORT) || 4000;

ensureDb();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
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

startServer(PORT);
