const { getDb } = require('../models/db');

function listProspects(req, res) {
  const db = getDb();
  const q = (req.query.q || '').toString().toLowerCase();
  const status = (req.query.status || '').toString().toLowerCase();
  const date = (req.query.date || '').toString();
  const excludeUnwanted = req.query.exclude_unwanted === '1' || req.query.exclude_unwanted === 'true';
  const onlyUnwanted = req.query.only_unwanted === '1' || req.query.only_unwanted === 'true';
  const uploadId = req.query.upload_id ? Number(req.query.upload_id) : null;
  const limit = Math.min(200, Number(req.query.limit) || 100);
  const offset = Math.max(0, Number(req.query.offset) || 0);

  let where = [];
  let params = [];

  if (q) {
    where.push('(LOWER(p.username) LIKE ? OR LOWER(p.full_name) LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (excludeUnwanted) {
    where.push('p.unwanted=0');
  }
  if (onlyUnwanted) {
    where.push('p.unwanted=1');
  }
  if (status) {
    where.push('pl.status = ?');
    params.push(status);
  }
  if (date) {
    where.push('pl.date = ?');
    params.push(date);
  }
  if (uploadId) {
    where.push('p.upload_id = ?');
    params.push(uploadId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT p.id, p.username, p.full_name, p.href, p.avatar_url, p.unwanted, p.upload_id, p.created_at,
           pl.id as plan_id, pl.date, pl.account_label, pl.status
    FROM prospects p
    LEFT JOIN plan pl ON pl.prospect_id = p.id
    ${whereSql}
    ORDER BY COALESCE(pl.date, '9999-12-31') ASC, p.username ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as c
    FROM prospects p
    LEFT JOIN plan pl ON pl.prospect_id = p.id
    ${whereSql}
  `).get(...params).c;

  res.json({ ok: true, items: rows, total, limit, offset });
}

function deleteProspect(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  const tx = db.transaction(()=>{
    db.prepare(`DELETE FROM plan WHERE prospect_id=?`).run(id);
    const r = db.prepare(`DELETE FROM prospects WHERE id=?`).run(id);
    return r.changes;
  });
  const changes = tx();
  res.json({ ok: true, deleted: changes });
}

module.exports = { listProspects, deleteProspect };
