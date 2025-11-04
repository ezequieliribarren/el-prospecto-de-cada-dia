const { getDb } = require('../models/db');

function listSent(req, res) {
  const db = getDb();
  const from = req.query.from || '0000-01-01';
  const to = req.query.to || '9999-12-31';
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  const params = [from, to];
  let where = `pl.status IN ('sent','won') AND pl.date BETWEEN ? AND ?`;
  if (userId) { where += ` AND pl.assigned_user_id = ?`; params.push(userId); }
  const rows = db.prepare(`
    SELECT pl.id as plan_id, pl.date, pl.status, pl.assigned_user_id,
           p.username, p.full_name, p.href,
           u.username as assigned_username, u.name as assigned_name
    FROM plan pl
    JOIN prospects p ON p.id = pl.prospect_id
    LEFT JOIN users u ON u.id = pl.assigned_user_id
    WHERE ${where}
    ORDER BY pl.date DESC, p.username ASC
  `).all(...params);
  res.json({ ok: true, items: rows });
}

module.exports = { listSent };

