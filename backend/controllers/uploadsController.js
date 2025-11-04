const { getDb } = require('../models/db');

function listUploads(_req, res) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT u.*, 
      (SELECT COUNT(*) FROM prospects p WHERE p.upload_id=u.id) as prospects_count,
      (SELECT COUNT(*) FROM plan pl JOIN prospects p2 ON p2.id=pl.prospect_id WHERE p2.upload_id=u.id) as planned_count
    FROM uploads u
    ORDER BY u.id DESC
  `).all();
  res.json({ ok: true, uploads: rows });
}

function deleteUpload(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  const tx = db.transaction(()=>{
    const prospectIds = db.prepare(`SELECT id FROM prospects WHERE upload_id=?`).all(id).map(r=>r.id);
    if (prospectIds.length) {
      const inIds = prospectIds.map(()=>'?').join(',');
      db.prepare(`DELETE FROM plan WHERE prospect_id IN (${inIds})`).run(...prospectIds);
    }
    db.prepare(`DELETE FROM prospects WHERE upload_id=?`).run(id);
    const r = db.prepare(`DELETE FROM uploads WHERE id=?`).run(id);
    return r.changes;
  });
  const changes = tx();
  res.json({ ok: true, deleted: changes });
}

module.exports = { listUploads, deleteUpload };
function purgeLegacy(_req, res) {
  const db = getDb();
  const tx = db.transaction(() => {
    const legacyPros = db.prepare(`SELECT id FROM prospects WHERE upload_id IS NULL AND (source='upload' OR source IS NULL OR source LIKE 'upload:%')`).all();
    const ids = legacyPros.map(r=>r.id);
    let plansDeleted = 0;
    if (ids.length) {
      const inQ = ids.map(()=>'?').join(',');
      plansDeleted = db.prepare(`DELETE FROM plan WHERE prospect_id IN (${inQ})`).run(...ids).changes;
    }
    const prosDeleted = db.prepare(`DELETE FROM prospects WHERE upload_id IS NULL AND (source='upload' OR source IS NULL OR source LIKE 'upload:%')`).run().changes;
    return { prosDeleted, plansDeleted };
  });
  const { prosDeleted, plansDeleted } = tx();
  res.json({ ok: true, deleted_prospects: prosDeleted, deleted_plans: plansDeleted });
}

module.exports.purgeLegacy = purgeLegacy;
