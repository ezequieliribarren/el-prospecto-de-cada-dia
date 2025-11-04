const { getDb } = require('../models/db');

function getSettings(_req, res) {
  const db = getDb();
  const kv = (k, def) => {
    const r = db.prepare(`SELECT value FROM settings WHERE key=?`).get(k);
    return r ? r.value : def;
  };
  const hourly = Number(kv('hourly_rate', '0'));
  const perDay = Number(kv('per_day', '25')) || 25;
  let activeSenders = [];
  try { activeSenders = JSON.parse(kv('active_senders', '[]')); } catch { activeSenders = []; }
  res.json({ ok: true, hourly_rate: hourly, per_day: perDay, active_senders: activeSenders });
}

function updateSettings(req, res) {
  const db = getDb();
  const updates = {};
  if (req.body.hourly_rate != null) {
    const hourly = Number(req.body.hourly_rate);
    if (!Number.isFinite(hourly) || hourly < 0) return res.status(400).json({ error: 'Invalid hourly_rate' });
    db.prepare(`INSERT INTO settings(key,value) VALUES('hourly_rate', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(String(hourly));
    updates.hourly_rate = hourly;
  }
  if (req.body.per_day != null) {
    const perDay = Math.max(1, Math.min(200, Number(req.body.per_day)));
    db.prepare(`INSERT INTO settings(key,value) VALUES('per_day', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(String(perDay));
    updates.per_day = perDay;
  }
  if (req.body.active_senders != null) {
    const arr = Array.isArray(req.body.active_senders) ? req.body.active_senders.map(Number) : [];
    db.prepare(`INSERT INTO settings(key,value) VALUES('active_senders', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(JSON.stringify(arr));
    updates.active_senders = arr;
  }
  res.json({ ok: true, ...updates });
}

module.exports = { getSettings, updateSettings };
