const XLSX = require('xlsx');
const { getDb } = require('../models/db');

const UNWANTED_KEYWORDS = [
  'diseño','diseno','diseñador','diseñadora','designer','design',
  'agencia','agency','marketing','growth','seo','sem','ads','branding','publicidad',
  'digital','social','social media','socialmedia','cm','community manager','smm',
  'desarrollo web','web','site','developer','desarrollador','desarrolladora','programador','programadora',
  'creative','creativo','creativa','studio','estudio','ux','ui','ux/ui','uxui','software','app','apps','media'
];

function extractUsername(href) {
  if (!href) return null;
  try {
    let url = href.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    const u = new URL(url);
    if (!u.hostname.includes('instagram')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    // ignore /p/ or /reel/ links
    if (['p', 'reel', 'stories', 'explore'].includes(parts[0])) return null;
    // sometimes path ends with /?hl=es or similar
    const handle = parts[0].replace(/[^a-zA-Z0-9._]/g, '');
    if (!handle) return null;
    return handle.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeAccents(s){
  return s.normalize('NFD').replace(/\p{Diacritic}/gu,'');
}

function isUnwanted(text) {
  if (!text) return false;
  const t = normalizeAccents(String(text).toLowerCase());
  return UNWANTED_KEYWORDS.some(k => t.includes(k));
}

function pickInstagramUrlFromRow(row){
  // prefer fields that look like href/profile
  const keys = Object.keys(row);
  for (const k of keys) {
    const v = (row[k] ?? '').toString();
    if (!v) continue;
    if (/instagram\.com\//i.test(v)) {
      const user = extractUsername(v);
      if (user) return { href: v, username: user };
    }
  }
  // scan values joined (for weird headers)
  for (const v0 of Object.values(row)){
    const v = (v0 ?? '').toString();
    if (!v) continue;
    const m = v.match(/https?:\/\/[^\s]*instagram\.com\/[^\s"')]+/i);
    if (m){
      const user = extractUsername(m[0]);
      if (user) return { href: m[0], username: user };
    }
  }
  return { href: '', username: '' };
}

function pickName(row){
  const byKey = (row.nombre || row.name || row.full_name || row['Nombre'] || '').toString().trim();
  if (byKey) return byKey;
  // heuristics: pick first non-url, non-"Seguir" value with spaces or letters
  for (const v0 of Object.values(row)){
    const v = (v0 ?? '').toString().trim();
    if (!v) continue;
    if (/instagram\.com\//i.test(v)) continue;
    if (/^segui(r)?$/i.test(v)) continue;
    if (v.length > 1 && /[A-Za-zÁÉÍÓÚáéíóúÑñ ]/.test(v)) return v;
  }
  return '';
}

function pickUsername(row, fallbackHrefUser){
  const usuario = (row.usuario || row.username || row.user || row.handle || row['Usuario'] || '').toString().trim();
  if (usuario) return usuario.replace(/^@/, '').toLowerCase();
  // also some dumps store handle in random key like x1lliihq. try pattern
  for (const [k,v0] of Object.entries(row)){
    const v = (v0 ?? '').toString().trim();
    if (!v) continue;
    if (/@|\./.test(v) || /^[a-z0-9_\.]{3,}$/i.test(v)){
      if (!/instagram\.com\//i.test(v) && !/^segui(r)?$/i.test(v)){
        return v.replace(/^@/, '').toLowerCase();
      }
    }
  }
  return fallbackHrefUser || '';
}

function normalizeRecord(row) {
  const name = pickName(row);
  const { href, username: hrefUser } = pickInstagramUrlFromRow(row);
  const username = pickUsername(row, hrefUser);
  if (!username) return null;
  const link = href || `https://www.instagram.com/${username}/`;
  // avatar url (if provided in dump), try keys containing 'src'
  let avatar = '';
  for (const [k,v0] of Object.entries(row)){
    if (/src|avatar|image/i.test(k)){
      const v = (v0 ?? '').toString();
      if (/^https?:\/\//i.test(v)) { avatar = v; break; }
    }
  }
  const unwanted = isUnwanted(username) || isUnwanted(name);
  return {
    username,
    full_name: name || null,
    href: link,
    avatar_url: avatar || null,
    source: 'upload',
    unwanted: unwanted ? 1 : 0,
  };
}

async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const buf = req.file.buffer;
    const db = getDb();
    // create upload record
    const insUpload = db.prepare(`INSERT INTO uploads(filename, mime, size, processed, unique_count, inserted, unwanted_count, skipped_no_username) VALUES(?,?,?,?,?,?,?,?)`);
    const uploadInfo = {
      filename: req.file.originalname || 'upload.xlsx',
      mime: req.file.mimetype || '',
      size: req.file.size || buf.length || 0,
    };
    const uploadId = insUpload.run(uploadInfo.filename, uploadInfo.mime, uploadInfo.size, 0, 0, 0, 0, 0).lastInsertRowid;
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const insert = db.prepare(`INSERT OR IGNORE INTO prospects (username, full_name, href, avatar_url, source, upload_id, unwanted) VALUES (@username, @full_name, @href, @avatar_url, @source, @upload_id, @unwanted)`);

    let processed = 0;
    let inserted = 0;
    let skippedNoUser = 0;
    const seen = new Set();
    const toInsert = [];
    for (const r of rows) {
      const norm = normalizeRecord(r);
      processed += 1;
      if (!norm) { skippedNoUser += 1; continue; }
      if (seen.has(norm.username)) continue;
      seen.add(norm.username);
      toInsert.push({ ...norm, upload_id: uploadId, source: `upload:${uploadId}` });
    }

    const tx = db.transaction((items) => {
      for (const it of items) {
        const resIns = insert.run(it);
        if (resIns.changes > 0) inserted += 1;
      }
    });
    tx(toInsert);

    // update upload row
    db.prepare(`UPDATE uploads SET processed=?, unique_count=?, inserted=?, unwanted_count=?, skipped_no_username=? WHERE id=?`).run(
      processed,
      toInsert.length,
      inserted,
      toInsert.filter(x => x.unwanted === 1).length,
      skippedNoUser,
      uploadId
    );

    res.json({
      ok: true,
      upload_id: uploadId,
      processed,
      unique: toInsert.length,
      inserted,
      total_prospects: db.prepare(`SELECT COUNT(*) as c FROM prospects`).get().c,
      unwanted_marked: toInsert.filter(x => x.unwanted === 1).length,
      skipped_no_username: skippedNoUser,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to process file' });
  }
}

module.exports = { handleUpload };
