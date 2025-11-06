const bcrypt = require('bcryptjs');
const { parsePhoneNumber } = require('libphonenumber-js');
const { getDb } = require('../models/db');
const { signToken } = require('../middleware/auth');

function argPhoneE164(input) {
  if (!input) return null;
  try {
    const p = parsePhoneNumber(String(input), 'AR');
    if (!p || !p.isValid()) return null;
    return p.number; // E.164
  } catch {
    return null;
  }
}

function me(req, res) {
  res.json({ ok: true, user: req.user || null });
}

async function listUsers(req, res) {
  const db = getDb();
  const rows = await db.prepare(`SELECT id, name, username, email, role, phone_number, hourly_rate, created_at FROM users ORDER BY id DESC`).all();
  res.json({ ok: true, users: rows });
}

async function register(req, res) {
  const db = getDb();
  const { name, username, email, password, role, phone_number, hourly_rate } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'Faltan campos' });
  const count = (await db.prepare(`SELECT COUNT(*) as c FROM users`).get()).c;
  const normalizedRole = count === 0 ? 'admin' : (role === 'admin' ? 'admin' : 'sender');
  if (count > 0 && (!req.user || req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Solo un administrador puede crear usuarios' });
  }
  const phone = phone_number ? argPhoneE164(phone_number) : null;
  if (phone_number && !phone) return res.status(400).json({ error: 'Número inválido (debe ser de Argentina)' });
  const hash = bcrypt.hashSync(String(password), 10);
  try {
    const hr = Number(hourly_rate) || 0;
    const r = await db.prepare(`INSERT INTO users(name, username, email, password_hash, role, phone_number, hourly_rate) VALUES(?,?,?,?,?,?,?)`).run(name || null, username, email.toLowerCase(), hash, normalizedRole, phone, hr);
    res.json({ ok: true, id: r.lastInsertRowid, role: normalizedRole });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Usuario o email ya existe' });
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
}

async function login(req, res) {
  const db = getDb();
  const { email, username, password } = req.body || {};
  if (!password || (!email && !username)) return res.status(400).json({ error: 'Faltan credenciales' });
  const user = await db.prepare(`SELECT * FROM users WHERE email = ? OR username = ?`).get((email || '').toLowerCase(), username || email || '');
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  const token = signToken({ id: user.id, role: user.role, name: user.name, username: user.username, email: user.email });
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, { httpOnly: true, sameSite: isProd ? 'none' : 'lax', secure: isProd, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ ok: true });
}

function logout(_req, res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', { sameSite: isProd ? 'none' : 'lax', secure: isProd });
  res.json({ ok: true });
}

module.exports = { me, listUsers, register, login, logout };

async function updateUser(req, res) {
  const db = getDb();
  const id = Number(req.params.id);
  const { name, username, email, role, phone_number, password, hourly_rate } = req.body || {};
  const updates = {};
  if (name !== undefined) updates.name = name ? String(name) : null;
  if (username !== undefined) updates.username = String(username).trim();
  if (email !== undefined) updates.email = String(email).toLowerCase();
  if (role !== undefined) {
    const r = String(role) === 'admin' ? 'admin' : 'sender';
    updates.role = r;
  }
  if (phone_number !== undefined) {
    const phone = phone_number ? argPhoneE164(phone_number) : null;
    if (phone_number && !phone) return res.status(400).json({ error: 'Número inválido (debe ser de Argentina)' });
    updates.phone_number = phone;
  }
  if (hourly_rate !== undefined) {
    const hr = Number(hourly_rate);
    if (!Number.isFinite(hr) || hr < 0) return res.status(400).json({ error: 'hourly_rate inválido' });
    updates.hourly_rate = hr;
  }
  const keys = Object.keys(updates);
  if (!keys.length && !password) return res.status(400).json({ error: 'Nada para actualizar' });
  try {
    if (keys.length) {
      const setSql = keys.map(k => `${k}=?`).join(', ');
      await db.prepare(`UPDATE users SET ${setSql} WHERE id=?`).run(...keys.map(k => updates[k]), id);
    }
    if (password != null) {
      const hash = bcrypt.hashSync(String(password), 10);
      await db.prepare(`UPDATE users SET password_hash=? WHERE id=?`).run(hash, id);
    }
    try {
      const u = await db.prepare(`SELECT id, role, name, username, email FROM users WHERE id=?`).get(id);
      if (u && req.user && Number(req.user.id) === id) {
        const token = signToken({ id: u.id, role: u.role, name: u.name, username: u.username, email: u.email });
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie('token', token, { httpOnly: true, sameSite: isProd ? 'none' : 'lax', secure: isProd, maxAge: 7 * 24 * 3600 * 1000 });
      }
    } catch {}
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Usuario o email ya existe' });
    console.error(e);
    res.status(500).json({ error: 'No se pudo actualizar' });
  }
}

module.exports.updateUser = updateUser;
