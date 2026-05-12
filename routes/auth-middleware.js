const { scryptSync, randomBytes, timingSafeEqual, createHmac } = require('crypto');
const fs   = require('fs');
const path = require('path');

const SECRET    = process.env.SESSION_SECRET || 'sbk-portal-secret-change-in-production';
const DATA_DIR  = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readUsers() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function writeUsers(list) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(pw, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const test = scryptSync(pw, salt, 64).toString('hex');
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch { return false; }
}

function generateToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 86400000 * 7 })).toString('base64');
  const sig     = createHmac('sha256', SECRET).update(payload).digest('hex');
  return payload + '.' + sig;
}
function verifyToken(token) {
  try {
    const dot     = token.lastIndexOf('.');
    const payload = token.substring(0, dot);
    const sig     = token.substring(dot + 1);
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const { userId, exp } = JSON.parse(Buffer.from(payload, 'base64').toString());
    return Date.now() > exp ? null : userId;
  } catch { return null; }
}

function seedUsers() {
  return [
    {
      id: 'user_admin', username: 'admin',  name: 'Administrador',
      role: 'admin',      companyId: null,        departmentId: null,
      passwordHash: hashPassword('admin123'),
    },
    {
      id: 'user_gest', username: 'gestor', name: 'Gestor SBK',
      role: 'company',    companyId: 'comp_demo', departmentId: null,
      passwordHash: hashPassword('gestor123'),
    },
    {
      id: 'user_rh', username: 'rh', name: 'Analista RH',
      role: 'department', companyId: 'comp_demo', departmentId: 'dept_rh',
      passwordHash: hashPassword('rh123'),
    },
  ];
}
function getOrSeedUsers() {
  const list = readUsers();
  if (!list.length) { const s = seedUsers(); writeUsers(s); return s; }
  return list;
}

function safeUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

function requireAuth(req, res, next) {
  const raw   = req.headers.authorization || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  if (!token) return res.status(401).json({ error: 'Nao autenticado.' });
  const userId = verifyToken(token);
  if (!userId)  return res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
  const user = getOrSeedUsers().find(u => u.id === userId);
  if (!user)    return res.status(401).json({ error: 'Usuario nao encontrado.' });
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  next();
}

module.exports = { hashPassword, verifyPassword, generateToken, readUsers, writeUsers, getOrSeedUsers, safeUser, requireAuth, requireAdmin };
