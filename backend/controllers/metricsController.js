const dayjs = require('dayjs');
const { getDb } = require('../models/db');

function getSecondsSum(db) {
  const s = db.prepare(`SELECT COALESCE(SUM(duration_sec),0) as sec FROM work_sessions`).get();
  return Number(s.sec || 0);
}

function getMetrics(req, res) {
  const db = getDb();
  const uid = req.user?.role === 'sender' ? req.user.id : null;
  const totalProspects = db.prepare(`SELECT COUNT(*) as c FROM prospects`).get().c;
  const totalAssigned = db.prepare(`SELECT COUNT(*) as c FROM plan`).get().c;
  const totalSent = uid
    ? db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status='sent' AND updated_by_user_id=?`).get(uid).c
    : db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status='sent'`).get().c;
  const totalWon = uid
    ? db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status='won' AND updated_by_user_id=?`).get(uid).c
    : db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status='won'`).get().c;
  const hours = uid
    ? (db.prepare(`SELECT COALESCE(SUM(duration_sec),0) as sec FROM work_sessions WHERE user_id=?`).get(uid).sec || 0) / 3600
    : getSecondsSum(db) / 3600;
  const hourly = Number((db.prepare(`SELECT value FROM settings WHERE key='hourly_rate'`).get() || { value: '0' }).value);

  const cost = hourly * hours;
  const cpa = totalSent > 0 ? cost / totalSent : 0; // cost per action (message)
  const cpr = totalWon > 0 ? cost / totalWon : 0;   // cost per result (client)
  const conversion = totalSent > 0 ? (totalWon / totalSent) * 100 : 0;

  // messages per day (last 14 days)
  const from = dayjs().subtract(13, 'day').format('YYYY-MM-DD');
  const perDay = uid
    ? db.prepare(`
      SELECT date, COUNT(*) as sent
      FROM plan
      WHERE status IN ('sent','won') AND date >= ? AND updated_by_user_id=?
      GROUP BY date
      ORDER BY date
    `).all(from, uid)
    : db.prepare(`
      SELECT date, COUNT(*) as sent
      FROM plan
      WHERE status IN ('sent','won') AND date >= ?
      GROUP BY date
      ORDER BY date
    `).all(from);

  res.json({
    ok: true,
    totals: {
      prospects: totalProspects,
      assigned: totalAssigned,
      sent: totalSent,
      won: totalWon,
    },
    rates: {
      conversion,
      hourly,
      cost,
      cpa,
      cpr,
      hours,
    },
    series: {
      sentByDay: perDay,
    },
  });
}

module.exports = { getMetrics };
