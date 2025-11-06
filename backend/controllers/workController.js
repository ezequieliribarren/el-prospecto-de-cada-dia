const dayjs = require('dayjs');
const { getDb } = require('../models/db');

async function startWork(req, res) {
  const db = getDb();
  if (req.user?.role !== 'sender') return res.status(403).json({ error: 'Forbidden' });
  const now = dayjs().toISOString();
  const uid = req.user?.id || null;
  await db.prepare(`INSERT INTO work_sessions(user_id, start_ts) VALUES(?,?)`).run(uid, now);
  res.json({ ok: true, started_at: now });
}

async function stopWork(req, res) {
  const db = getDb();
  if (req.user?.role !== 'sender') return res.status(403).json({ error: 'Forbidden' });
  const uid = req.user?.id || null;
  const row = await db.prepare(`SELECT * FROM work_sessions WHERE end_ts IS NULL AND (user_id IS ? OR user_id=?) ORDER BY id DESC LIMIT 1`).get(uid, uid);
  if (!row) return res.status(400).json({ error: 'No active session' });
  const end = dayjs();
  const start = dayjs(row.start_ts);
  const durationSec = Math.max(0, end.diff(start, 'second'));
  await db.prepare(`UPDATE work_sessions SET end_ts=?, duration_sec=? WHERE id=?`).run(end.toISOString(), durationSec, row.id);
  res.json({ ok: true, duration_sec: durationSec });
}

module.exports = { startWork, stopWork };
async function statusWork(req, res) {
  const db = getDb();
  const uid = req.user?.id || null;
  const row = await db.prepare(`SELECT * FROM work_sessions WHERE end_ts IS NULL AND (user_id IS ? OR user_id=?) ORDER BY id DESC LIMIT 1`).get(uid, uid);
  if (!row) return res.json({ ok: true, active: false });
  const start = dayjs(row.start_ts);
  const sec = Math.max(0, dayjs().diff(start, 'second'));
  res.json({ ok: true, active: true, started_at: row.start_ts, elapsed_sec: sec });
}

module.exports.statusWork = statusWork;
