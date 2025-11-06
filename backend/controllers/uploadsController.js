const { getDb } = require('../models/db');

async function listUploads(_req, res) {
  const db = getDb();
  const rows = await db.prepare(`
    SELECT u.*, 
      (SELECT COUNT(*) FROM prospects p WHERE p.upload_id=u.id) as prospects_count,
      (SELECT COUNT(*) FROM plan pl JOIN prospects p2 ON p2.id=pl.prospect_id WHERE p2.upload_id=u.id) as planned_count
    FROM uploads u
    ORDER BY u.id DESC
  `).all();
  res.json({ ok: true, uploads: rows });
}

async function deleteUpload(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  const prospectIds = (await db.prepare(`SELECT id FROM prospects WHERE upload_id=?`).all(id)).map(r=>r.id);
  if (prospectIds.length) {
    const inIds = prospectIds.map(()=>'?').join(',');
    await db.prepare(`DELETE FROM plan WHERE prospect_id IN (${inIds})`).run(...prospectIds);
  }
  await db.prepare(`DELETE FROM prospects WHERE upload_id=?`).run(id);
  const r = await db.prepare(`DELETE FROM uploads WHERE id=?`).run(id);
  const changes = r.changes;
  res.json({ ok: true, deleted: changes });
}

module.exports = { listUploads, deleteUpload };
async function purgeLegacy(_req, res) {
  const db = getDb();
  const legacyPros = await db.prepare(`SELECT id FROM prospects WHERE upload_id IS NULL AND (source='upload' OR source IS NULL OR source LIKE 'upload:%')`).all();
  const ids = legacyPros.map(r=>r.id);
  let plansDeleted = 0;
  if (ids.length) {
    const inQ = ids.map(()=>'?').join(',');
    plansDeleted = (await db.prepare(`DELETE FROM plan WHERE prospect_id IN (${inQ})`).run(...ids)).changes;
  }
  const prosDeleted = (await db.prepare(`DELETE FROM prospects WHERE upload_id IS NULL AND (source='upload' OR source IS NULL OR source LIKE 'upload:%')`).run()).changes;
  res.json({ ok: true, deleted_prospects: prosDeleted, deleted_plans: plansDeleted });
}

module.exports.purgeLegacy = purgeLegacy;

async function updateUpload(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  const { source, network, instagram_account } = req.body || {};
  const fields = {};
  if (source !== undefined) fields.source = source ? String(source) : null;
  if (network !== undefined) fields.network = network ? String(network) : null;
  if (instagram_account !== undefined) fields.instagram_account = instagram_account ? String(instagram_account) : null;
  const keys = Object.keys(fields);
  if (!keys.length) return res.status(400).json({ error: 'Nada para actualizar' });
  const setSql = keys.map(k => `${k}=?`).join(', ');
  try {
    const r = await db.prepare(`UPDATE uploads SET ${setSql} WHERE id=?`).run(...keys.map(k => fields[k]), id);
    res.json({ ok: true, updated: r.changes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo actualizar upload' });
  }
}

module.exports.updateUpload = updateUpload;
