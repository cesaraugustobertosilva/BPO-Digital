const express = require('express');
const router  = express.Router();
const { requireAuth, requireAdmin } = require('./auth-middleware');
const { readData, writeData } = require('./db');

const DEFAULT_CHECKLIST = [
  { id: 'cnh',    name: 'CNH / RG / Documento de Identidade', req: true },
  { id: 'cpf',    name: 'CPF',                                req: true },
  { id: 'ctrato', name: 'Contrato de Trabalho',               req: true },
  { id: 'admiss', name: 'Ficha de Admissao',                  req: true },
  { id: 'exame',  name: 'Exame Admissional',                  req: true },
  { id: 'resid',  name: 'Comprovante de Residencia',          req: false },
  { id: 'foto',   name: 'Foto 3x4',                           req: false },
];

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

async function getOrSeed() {
  const list = await readData('companies');
  if (!list || !list.length) {
    const s = seed();
    await writeData('companies', s);
    return s;
  }
  return list;
}

router.get('/', requireAuth, async (_req, res) => {
  try { res.json(await getOrSeed()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio.' });
    const list = await getOrSeed();
    const item = { id: 'comp_' + Date.now(), name, departments: [] };
    list.push(item);
    await writeData('companies', list);
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const list = await getOrSeed();
    const idx  = list.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    list[idx] = { ...list[idx], name: req.body.name || list[idx].name };
    await writeData('companies', list);
    res.json(list[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const list = await getOrSeed();
    await writeData('companies', list.filter(c => c.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/departments', requireAuth, async (req, res) => {
  try {
    const co = (await getOrSeed()).find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    res.json(co.departments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/departments', requireAuth, async (req, res) => {
  try {
    const { role, companyId: uCo } = req.user;
    if (role !== 'admin' && !(role === 'company' && uCo === req.params.id))
      return res.status(403).json({ error: 'Acesso negado.' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio.' });
    const list = await getOrSeed();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    const dept = { id: 'dept_' + Date.now(), name, checklist: DEFAULT_CHECKLIST.map(c => ({...c})) };
    co.departments.push(dept);
    await writeData('companies', list);
    res.json(dept);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/departments/:deptId', requireAuth, async (req, res) => {
  try {
    const { role, companyId: uCo, departmentId: uDept } = req.user;
    const isAdmin   = role === 'admin';
    const isCoMgr   = role === 'company'    && uCo   === req.params.id;
    const isDeptMgr = role === 'department' && uCo   === req.params.id && uDept === req.params.deptId;
    if (!isAdmin && !isCoMgr && !isDeptMgr)
      return res.status(403).json({ error: 'Acesso negado.' });
    const list = await getOrSeed();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    const idx  = co.departments.findIndex(d => d.id === req.params.deptId);
    if (idx < 0) return res.status(404).json({ error: 'Departamento nao encontrado.' });
    co.departments[idx] = { ...co.departments[idx], ...req.body, id: co.departments[idx].id };
    await writeData('companies', list);
    res.json(co.departments[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/departments/:deptId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const list = await getOrSeed();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    co.departments = co.departments.filter(d => d.id !== req.params.deptId);
    await writeData('companies', list);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
