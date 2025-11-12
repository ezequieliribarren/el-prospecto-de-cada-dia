const { getDb } = require('../models/db');

async function listProspects(req, res) {
  const db = getDb();
  const q = (req.query.q || '').toString().toLowerCase();
  const status = (req.query.status || '').toString().toLowerCase();
  const date = (req.query.date || '').toString();
  const excludeUnwanted = req.query.exclude_unwanted === '1' || req.query.exclude_unwanted === 'true';
  const onlyUnwanted = req.query.only_unwanted === '1' || req.query.only_unwanted === 'true';
  const uploadId = req.query.upload_id ? Number(req.query.upload_id) : null;
  const category = (req.query.category || '').toString().toLowerCase();
  const source = (req.query.source || '').toString().toLowerCase();
  const account = (req.query.account || '').toString();
  const duplicates = req.query.duplicates === '1' || req.query.duplicates === 'true';
  // classification filters and ordering
  const entityKind = (req.query.entity_kind || '').toString().toLowerCase();
  const personProfession = (req.query.person_profession || '').toString().toLowerCase();
  const industry = (req.query.industry || '').toString().toLowerCase();
  const isCompetitor = req.query.is_competitor;
  const minScore = req.query.min_score != null ? Number(req.query.min_score) : null;
  const maxScore = req.query.max_score != null ? Number(req.query.max_score) : null;
  const sort = (req.query.sort || '').toString().toLowerCase();
  const limit = Math.min(200, Number(req.query.limit) || 100);
  const offset = Math.max(0, Number(req.query.offset) || 0);

  // Branch: duplicates view (from upload_duplicates)
  if (duplicates) {
    const dw = [];
    const dp = [];
    if (q) { dw.push('(LOWER(du.username) LIKE ? OR LOWER(COALESCE(du.full_name,\'\')) LIKE ?)'); dp.push(`%${q}%`, `%${q}%`); }
    if (uploadId) { dw.push('du.upload_id = ?'); dp.push(uploadId); }
    if (source) { dw.push('LOWER(u.source) = ?'); dp.push(source); }
    if (account) { dw.push('u.instagram_account = ?'); dp.push(account); }
    const dWhere = dw.length ? `WHERE ${dw.join(' AND ')}` : '';
    const items = await db.prepare(`
      SELECT du.id as id, du.username, du.full_name, du.href,
             u.created_at as upload_created_at, u.source as upload_source, u.network as upload_network, u.instagram_account as upload_instagram_account,
             NULL as plan_id, NULL as date, NULL as account_label, NULL as status,
             NULL as avatar_url, NULL as category, 0 as unwanted, du.upload_id
      FROM upload_duplicates du
      JOIN uploads u ON u.id = du.upload_id
      ${dWhere}
      ORDER BY du.id DESC
      LIMIT ? OFFSET ?
    `).all(...dp, limit, offset);
    const total = (await db.prepare(`
      SELECT COUNT(*) as c
      FROM upload_duplicates du
      JOIN uploads u ON u.id = du.upload_id
      ${dWhere}
    `).get(...dp)).c;
    return res.json({ ok: true, items, total, limit, offset });
  }

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
  if (category) {
    where.push('LOWER(p.category)=?');
    params.push(category);
  }
  if (entityKind) { where.push('LOWER(p.entity_kind)=?'); params.push(entityKind); }
  if (personProfession) { where.push('LOWER(p.person_profession)=?'); params.push(personProfession); }
  if (industry) { where.push('LOWER(p.industry)=?'); params.push(industry); }
  if (isCompetitor === '0' || isCompetitor === '1' || isCompetitor === 'true' || isCompetitor === 'false') {
    const v = (isCompetitor === '1' || isCompetitor === 'true') ? 1 : 0;
    where.push('p.is_competitor = ?'); params.push(v);
  }
  if (minScore != null && !Number.isNaN(minScore)) { where.push('p.lead_score >= ?'); params.push(Math.max(0, minScore)); }
  if (maxScore != null && !Number.isNaN(maxScore)) { where.push('p.lead_score <= ?'); params.push(Math.max(0, maxScore)); }
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
  if (source) {
    where.push('LOWER(u.source) = ?');
    params.push(source);
  }
  if (account) {
    where.push('u.instagram_account = ?');
    params.push(account);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await db.prepare(`
    SELECT p.id, p.username, p.full_name, p.href, p.avatar_url, p.category, p.unwanted, p.upload_id, p.created_at,
           p.entity_kind, p.person_profession, p.industry, p.is_competitor, p.lead_score, p.interest_probability, p.classification_version, p.classification_updated_at,
           u.created_at as upload_created_at, u.source as upload_source, u.network as upload_network, u.instagram_account as upload_instagram_account,
           pl.id as plan_id, pl.date, pl.account_label, pl.status
    FROM prospects p
    LEFT JOIN plan pl ON pl.prospect_id = p.id
    LEFT JOIN uploads u ON u.id = p.upload_id
    ${whereSql}
    ${
      sort === 'score_desc' ? 'ORDER BY p.lead_score DESC, p.username ASC' :
      sort === 'prob_desc' ? 'ORDER BY p.interest_probability DESC, p.username ASC' :
      "ORDER BY COALESCE(pl.date, '9999-12-31') ASC, p.username ASC"
    }
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = (await db.prepare(`
    SELECT COUNT(*) as c
    FROM prospects p
    LEFT JOIN plan pl ON pl.prospect_id = p.id
    ${whereSql}
  `).get(...params)).c;

  res.json({ ok: true, items: rows, total, limit, offset });
}

async function deleteProspect(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  await db.prepare(`DELETE FROM plan WHERE prospect_id=?`).run(id);
  const r = await db.prepare(`DELETE FROM prospects WHERE id=?`).run(id);
  const changes = r.changes;
  res.json({ ok: true, deleted: changes });
}

async function updateProspect(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  const body = req.body || {};
  const fields = {};
  if (body.username != null) {
    const u = String(body.username).trim().replace(/^@/, '').toLowerCase();
    if (!u) return res.status(400).json({ error: 'username vacío' });
    fields.username = u;
  }
  if (body.full_name !== undefined) fields.full_name = body.full_name ? String(body.full_name) : null;
  if (body.href !== undefined) fields.href = body.href ? String(body.href) : null;
  if (body.avatar_url !== undefined) fields.avatar_url = body.avatar_url ? String(body.avatar_url) : null;
  if (body.whatsapp_number !== undefined) fields.whatsapp_number = body.whatsapp_number ? String(body.whatsapp_number) : null;
  if (body.unwanted !== undefined) fields.unwanted = Number(body.unwanted) ? 1 : 0;
  if (body.category !== undefined) fields.category = String(body.category);
  const keys = Object.keys(fields);
  if (!keys.length) return res.status(400).json({ error: 'Nada para actualizar' });
  const setSql = keys.map(k => `${k}=?`).join(', ');
  const params = keys.map(k => fields[k]);
  try {
    const r = await db.prepare(`UPDATE prospects SET ${setSql} WHERE id=?`).run(...params, id);
    res.json({ ok: true, updated: r.changes });
  } catch (e) {
    if (String(e.message).includes('UNIQUE') && keys.includes('username')) {
      return res.status(409).json({ error: 'username ya existe' });
    }
    console.error(e);
    res.status(500).json({ error: 'No se pudo actualizar' });
  }
}

module.exports = { listProspects, deleteProspect, updateProspect };
