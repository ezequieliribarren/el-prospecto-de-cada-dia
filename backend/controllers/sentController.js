const { getDb } = require('../models/db');

async function listSent(req, res) {
  const db = getDb();
  const from = req.query.from || '0000-01-01';
  const to = req.query.to || '9999-12-31';
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  const q = (req.query.q || '').toString().trim().toLowerCase();
  // statuses: comma-separated list (e.g., interested,won)
  const allowed = new Set(['sent','interested','won']);
  const statuses = String(req.query.statuses || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => allowed.has(s));

  const useStatuses = statuses.length ? statuses : ['sent','interested','won'];

  const params = [from, to];
  let where = `pl.status IN (${useStatuses.map(()=>'?').join(',')}) AND pl.date BETWEEN ? AND ?`;
  // status params must precede others
  params.unshift(...useStatuses);
  if (userId) { where += ` AND pl.assigned_user_id = ?`; params.push(userId); }
  if (q) {
    where += ` AND (LOWER(p.username) LIKE ? OR p.whatsapp_number LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  const rows = await db.prepare(`
    SELECT pl.id as plan_id, pl.date, pl.status, pl.assigned_user_id,
           p.id as prospect_id, p.username, p.full_name, p.href, p.whatsapp_number,
           u.username as assigned_username, u.name as assigned_name
    FROM plan pl
    JOIN prospects p ON p.id = pl.prospect_id
    LEFT JOIN users u ON u.id = pl.assigned_user_id
    WHERE ${where}
    ORDER BY pl.date DESC, p.username ASC
  `).all(...params);
  res.json({ ok: true, items: rows });
}

async function updateProspectWhatsApp(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  const num = (req.body && req.body.whatsapp_number != null) ? String(req.body.whatsapp_number).trim() : '';
  const r = await db.prepare(`UPDATE prospects SET whatsapp_number=? WHERE id=?`).run(num || null, id);
  res.json({ ok: true, updated: r.changes });
}

module.exports = { listSent, updateProspectWhatsApp };
