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

function listUsers(req, res) {
  const db = getDb();
  const rows = db.prepare(`SELECT id, name, username, email, role, phone_number, created_at FROM users ORDER BY id DESC`).all();
  res.json({ ok: true, users: rows });
}

function register(req, res) {
  const db = getDb();
  const { name, username, email, password, role, phone_number } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'Faltan campos' });
  const count = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c;
  const normalizedRole = count === 0 ? 'admin' : (role === 'admin' ? 'admin' : 'sender');
  if (count > 0 && (!req.user || req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Solo un administrador puede crear usuarios' });
  }
  const phone = phone_number ? argPhoneE164(phone_number) : null;
  if (phone_number && !phone) return res.status(400).json({ error: 'Número inválido (debe ser de Argentina)' });
  const hash = bcrypt.hashSync(String(password), 10);
  try {
    const r = db.prepare(`INSERT INTO users(name, username, email, password_hash, role, phone_number) VALUES(?,?,?,?,?,?)`).run(name || null, username, email.toLowerCase(), hash, normalizedRole, phone);
    res.json({ ok: true, id: r.lastInsertRowid, role: normalizedRole });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Usuario o email ya existe' });
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
}

function login(req, res) {
  const db = getDb();
  const { email, username, password } = req.body || {};
  if (!password || (!email && !username)) return res.status(400).json({ error: 'Faltan credenciales' });
  const user = db.prepare(`SELECT * FROM users WHERE email = ? OR username = ?`).get((email || '').toLowerCase(), username || email || '');
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  const token = signToken({ id: user.id, role: user.role, name: user.name, username: user.username, email: user.email });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ ok: true });
}

function logout(_req, res) {
  res.clearCookie('token');
  res.json({ ok: true });
}

module.exports = { me, listUsers, register, login, logout };

