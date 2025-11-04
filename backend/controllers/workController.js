const dayjs = require('dayjs');
const { getDb } = require('../models/db');

function startWork(req, res) {
  const db = getDb();
  const now = dayjs().toISOString();
  const uid = req.user?.id || null;
  db.prepare(`INSERT INTO work_sessions(user_id, start_ts) VALUES(?,?)`).run(uid, now);
  res.json({ ok: true, started_at: now });
}

function stopWork(req, res) {
  const db = getDb();
  const uid = req.user?.id || null;
  const row = db.prepare(`SELECT * FROM work_sessions WHERE end_ts IS NULL AND (user_id IS ? OR user_id=?) ORDER BY id DESC LIMIT 1`).get(uid, uid);
  if (!row) return res.status(400).json({ error: 'No active session' });
  const end = dayjs();
  const start = dayjs(row.start_ts);
  const durationSec = Math.max(0, end.diff(start, 'second'));
  db.prepare(`UPDATE work_sessions SET end_ts=?, duration_sec=? WHERE id=?`).run(end.toISOString(), durationSec, row.id);
  res.json({ ok: true, duration_sec: durationSec });
}

module.exports = { startWork, stopWork };
