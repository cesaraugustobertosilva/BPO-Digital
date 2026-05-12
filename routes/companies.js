const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();
const { requireAuth, requireAdmin } = require('./auth-middleware');

const DATA_DIR  = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'companies.json');

const DEFAULT_CHECKLIST = [
  { id: 'cnh',    name: 'CNH / RG / Documento de Identidade', req: true },
  { id: 'cpf',    name: 'CPF',                                req: true },
  { id: 'ctrato', name: 'Contrato de Trabalho',               req: true },
  { id: 'admiss', name: 'Ficha de Admissao',                  req: true },
  { id: 'exame',  name: 'Exame Admissional',                  req: true },
  { id: 'resid',  name: 'Comprovante de Residencia',          req: false },
  { id: 'foto',   name: 'Foto 3x4',                           req: false },
];

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readCompanies() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function writeCompanies(list) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}
function seed() {
  return [{
    id: 'comp_demo',
    name: 'SBK Legal Operations',
    departments: [
      { id: 'dept_rh',  name: 'Recursos Humanos', checklist: DEFAULT_CHECKLIST.map(c => ({...c})) },
      { id: 'dept_jur', name: 'Juridico',          checklist: DEFAULT_CHECKLIST.map(c => ({...c})) },
    ],
  }];
}
function getOrSeed() {
  const list = readCompanies();
  if (!list.length) { const s = seed(); writeCompanies(s); return s; }
  return list;
}

router.get('/', requireAuth, (_req, res) => {
  try { res.json(getOrSeed()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio.' });
    const list = getOrSeed();
    const item = { id: 'comp_' + Date.now(), name, departments: [] };
    list.push(item);
    writeCompanies(list);
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const list = getOrSeed();
    const idx  = list.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    list[idx] = { ...list[idx], name: req.body.name || list[idx].name };
    writeCompanies(list);
    res.json(list[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    writeCompanies(getOrSeed().filter(c => c.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/departments', requireAuth, (req, res) => {
  try {
    const co = getOrSeed().find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    res.json(co.departments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/departments', requireAuth, (req, res) => {
  try {
    const { role, companyId: uCo } = req.user;
    if (role !== 'admin' && !(role === 'company' && uCo === req.params.id))
      return res.status(403).json({ error: 'Acesso negado.' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio.' });
    const list = getOrSeed();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    const dept = { id: 'dept_' + Date.now(), name, checklist: DEFAULT_CHECKLIST.map(c => ({...c})) };
    co.departments.push(dept);
    writeCompanies(list);
    res.json(dept);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/departments/:deptId', requireAuth, (req, res) => {
  try {
    const { role, companyId: uCo, departmentId: uDept } = req.user;
    const isAdmin = role === 'admin';
    const isCoMgr = role === 'company' && uCo === req.params.id;
    const isDeptMgr = role === 'department' && uCo === req.params.id && uDept === req.params.deptId;
    if (!isAdmin && !isCoMgr && !isDeptMgr)
      return res.status(403).json({ error: 'Acesso negado.' });
    const list = getOrSeed();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    const idx  = co.departments.findIndex(d => d.id === req.params.deptId);
    if (idx < 0) return res.status(404).json({ error: 'Departamento nao encontrado.' });
    co.departments[idx] = { ...co.departments[idx], ...req.body, id: co.departments[idx].id };
    writeCompanies(list);
    res.json(co.departments[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/departments/:deptId', requireAuth, requireAdmin, (req, res) => {
  try {
    const list = getOrSeed();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    co.departments = co.departments.filter(d => d.id !== req.params.deptId);
    writeCompanies(list);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
