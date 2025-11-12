/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
// Classify and score prospects, storing segmentation and interest fields
// Usage examples:
//   node backend/scripts/backfill-classification.js              # only missing
//   FULL_RECLASSIFY=1 node backend/scripts/backfill-classification.js  # all rows
//   LIBSQL_URL=... LIBSQL_AUTH_TOKEN=... node backend/scripts/backfill-classification.js

const { ensureDb } = require('../models/db');
const { classifyProspect } = require('../utils/classifier');

async function run(){
  await ensureDb();
  const db = require('../models/db').getDb();
  const full = process.env.FULL_RECLASSIFY === '1' || process.env.FULL_RECLASSIFY === 'true';

  const where = full ? '' : "WHERE classification_version IS NULL OR classification_version = ''";
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM prospects ${where}`).get()).c;
  console.log(`[CLASSIFY] Filas a procesar: ${total}`);
  if (!total) return;

  const rows = await db.prepare(`SELECT id, username, full_name, href FROM prospects ${where} ORDER BY id ASC`).all();

  const upd = db.prepare(`UPDATE prospects SET 
    entity_kind=?, person_profession=?, industry=?, is_competitor=?,
    lead_score=?, interest_probability=?, classification_signals=?,
    classification_version=?, classification_updated_at=datetime('now')
    WHERE id=?
  `);

  let ok = 0, fail = 0;
  for (const r of rows){
    try {
      const cls = classifyProspect(r);
      const signals = JSON.stringify(cls.classification_signals || {});
      await upd.run(
        cls.entity_kind || null,
        cls.person_profession || null,
        cls.industry || null,
        cls.is_competitor ? 1 : 0,
        cls.lead_score || 0,
        cls.interest_probability || 0,
        signals,
        cls.classification_version || 'rules-v1',
        r.id
      );
      ok++;
    } catch (e){
      console.warn(`[CLASSIFY] fallo id=${r.id}:`, e.message);
      fail++;
    }
  }
  console.log(`[CLASSIFY] Listo. OK=${ok} Fail=${fail}`);
}

run().catch(e=>{ console.error(e); process.exit(1); });

