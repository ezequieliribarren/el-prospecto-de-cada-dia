const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret-change-me';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function extractToken(req){
  const cookieTok = req.cookies?.token;
  const auth = req.headers?.authorization || '';
  const bearerTok = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : null;
  return bearerTok || cookieTok || null;
}

function authOptional(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    const data = verifyToken(token);
    if (data) req.user = data;
  }
  next();
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Unauthorized' });
  req.user = data;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  }
}

module.exports = { signToken, verifyToken, requireAuth, requireRole, authOptional };
