const { scryptSync, randomBytes, timingSafeEqual, createHmac } = require('crypto');
const { readData, writeData } = require('./db');

const SECRET = process.env.SESSION_SECRET || 'sbk-portal-secret-change-in-production';

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
    const dot      = token.lastIndexOf('.');
    const payload  = token.substring(0, dot);
    const sig      = token.substring(dot + 1);
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const { userId, exp } = JSON.parse(Buffer.from(payload, 'base64').toString());
    return Date.now() > exp ? null : userId;
  } catch { return null; }
}

function seedUsers() {
  // Apenas o administrador e criado automaticamente.
  // Usuarios de empresa e departamento devem ser cadastrados pelo admin
  // apos criar as empresas e departamentos correspondentes.
  return [
    {
      id:           'user_admin',
      username:     'admin',
      name:         'Administrador',
      role:         'admin',
      companyId:    null,
      departmentId: null,
      modules:      [],
      passwordHash: hashPassword('admin123'),
    },
  ];
}

async function getOrSeedUsers() {
  // readData lanca erro em caso de falha de storage; deixamos propagar para
  // nao confundir "chave inexistente" com "erro de conexao" e evitar
  // sobrescrever usuarios cadastrados quando o storage esta indisponivel.
  const list = await readData('users');
  if (list && list.length > 0) return list;
  const s = seedUsers();
  await writeData('users', s);
  return s;
}

function safeUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

async function requireAuth(req, res, next) {
  try {
    const raw   = req.headers.authorization || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    if (!token) return res.status(401).json({ error: 'Nao autenticado.' });
    const userId = verifyToken(token);
    if (!userId) return res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
    const users = await getOrSeedUsers();
    const user  = users.find(u => u.id === userId);
    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado.' });
    req.user = user;
    next();
  } catch (err) { next(err); }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  next();
}

module.exports = { hashPassword, verifyPassword, generateToken, getOrSeedUsers, safeUser, requireAuth, requireAdmin };
