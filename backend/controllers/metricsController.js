const dayjs = require('dayjs');
const { getDb } = require('../models/db');

async function getSecondsSum(db) {
  const s = await db.prepare(`SELECT COALESCE(SUM(duration_sec),0) as sec FROM work_sessions`).get();
  return Number((s && s.sec) || 0);
}

async function getMetrics(req, res) {
  const db = getDb();
  const uid = req.user?.role === 'sender' ? req.user.id : null;
  const totalProspects = (await db.prepare(`SELECT COUNT(*) as c FROM prospects`).get()).c;
  const totalAssigned = (await db.prepare(`SELECT COUNT(*) as c FROM plan`).get()).c;
  const totalMessaged = uid
    ? (await db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status IN ('sent','interested','won') AND updated_by_user_id=?`).get(uid)).c
    : (await db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status IN ('sent','interested','won')`).get()).c;
  const totalInterested = uid
    ? (await db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status='interested' AND updated_by_user_id=?`).get(uid)).c
    : (await db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status='interested'`).get()).c;
  const totalWon = uid
    ? (await db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status='won' AND updated_by_user_id=?`).get(uid)).c
    : (await db.prepare(`SELECT COUNT(*) as c FROM plan WHERE status='won'`).get()).c;
  const hours = uid
    ? ((await db.prepare(`SELECT COALESCE(SUM(duration_sec),0) as sec FROM work_sessions WHERE user_id=?`).get(uid)).sec || 0) / 3600
    : (await getSecondsSum(db)) / 3600;
  // Per-user hourly rate
  const userHours = uid
    ? db.prepare(`SELECT u.id, u.username, u.name, u.hourly_rate as hr, COALESCE(SUM(ws.duration_sec),0)/3600.0 as hours
                  FROM users u LEFT JOIN work_sessions ws ON ws.user_id=u.id
                  WHERE u.id=?`).get(uid)
    : db.prepare(`SELECT u.id, u.username, u.name, u.hourly_rate as hr, COALESCE(SUM(ws.duration_sec),0)/3600.0 as hours
                  FROM users u LEFT JOIN work_sessions ws ON ws.user_id=u.id
                  GROUP BY u.id`).all();
  const totalCost = Array.isArray(userHours)
    ? userHours.reduce((acc, r)=> acc + (Number(r.hr||0) * Number(r.hours||0)), 0)
    : (Number(userHours?.hr||0) * Number(userHours?.hours||0));

  const cost = totalCost;
  const cpa = totalMessaged > 0 ? cost / totalMessaged : 0; // cost per action (message)
  const cpr = totalWon > 0 ? cost / totalWon : 0;   // cost per result (client)
  const conversion = totalMessaged > 0 ? (totalWon / totalMessaged) * 100 : 0;
  const interestedPct = totalMessaged > 0 ? (totalInterested / totalMessaged) * 100 : 0;
  const closedPct = totalMessaged > 0 ? (totalWon / totalMessaged) * 100 : 0;

  // messages per day (last 14 days)
  const from = dayjs().subtract(13, 'day').format('YYYY-MM-DD');
  const perDay = uid
    ? await db.prepare(`
      SELECT date, COUNT(*) as sent
      FROM plan
      WHERE status IN ('sent','interested','won') AND date >= ? AND updated_by_user_id=?
      GROUP BY date
      ORDER BY date
    `).all(from, uid)
    : await db.prepare(`
      SELECT date, COUNT(*) as sent
      FROM plan
      WHERE status IN ('sent','interested','won') AND date >= ?
      GROUP BY date
      ORDER BY date
    `).all(from);

  res.json({
    ok: true,
    totals: {
      prospects: totalProspects,
      assigned: totalAssigned,
      sent: totalMessaged,
      interested: totalInterested,
      won: totalWon,
    },
    rates: {
      conversion,
      interested_pct: interestedPct,
      closed_pct: closedPct,
      // hourly removed; cost computed per user rate
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
