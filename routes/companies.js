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

async function getCompanies() {
  return await readData('companies') || [];
}

// GET /api/companies
router.get('/', requireAuth, async (_req, res) => {
  try { res.json(await getCompanies()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/companies
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio.' });
    const list = await getCompanies();
    const item = { id: 'comp_' + Date.now(), name: name.trim(), departments: [] };
    list.push(item);
    await writeData('companies', list);
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/companies/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const list = await getCompanies();
    const idx  = list.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    if (req.body.name) list[idx].name = req.body.name.trim();
    await writeData('companies', list);
    res.json(list[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/companies/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const list = await getCompanies();
    await writeData('companies', list.filter(c => c.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/companies/:id/departments
router.get('/:id/departments', requireAuth, async (req, res) => {
  try {
    const co = (await getCompanies()).find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    res.json(co.departments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/companies/:id/departments
router.post('/:id/departments', requireAuth, async (req, res) => {
  try {
    const { role, companyId: uCo } = req.user;
    if (role !== 'admin' && !(role === 'company' && uCo === req.params.id))
      return res.status(403).json({ error: 'Acesso negado.' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio.' });
    const list = await getCompanies();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    const dept = { id: 'dept_' + Date.now(), name: name.trim(), checklist: DEFAULT_CHECKLIST.map(c => ({...c})) };
    co.departments.push(dept);
    await writeData('companies', list);
    res.json(dept);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/companies/:id/departments/:deptId
router.put('/:id/departments/:deptId', requireAuth, async (req, res) => {
  try {
    const { role, companyId: uCo, departmentId: uDept } = req.user;
    const isAdmin   = role === 'admin';
    const isCoMgr   = role === 'company'    && uCo   === req.params.id;
    const isDeptMgr = role === 'department' && uCo   === req.params.id && uDept === req.params.deptId;
    if (!isAdmin && !isCoMgr && !isDeptMgr)
      return res.status(403).json({ error: 'Acesso negado.' });
    const list = await getCompanies();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    const idx  = co.departments.findIndex(d => d.id === req.params.deptId);
    if (idx < 0) return res.status(404).json({ error: 'Departamento nao encontrado.' });
    co.departments[idx] = { ...co.departments[idx], ...req.body, id: co.departments[idx].id };
    await writeData('companies', list);

    const newChecklist = co.departments[idx].checklist;
    if (Array.isArray(newChecklist)) {
      const dossies = await readData('dossies') || [];
      let changed = false;
      dossies.forEach(d => {
        if (d.companyId !== req.params.id || d.departmentId !== req.params.deptId) return;
        const uploaded = new Set((d.docs || []).map(n => n.toLowerCase()));
        d.missing_req = newChecklist
          .filter(item => item.req && !uploaded.has(item.name.toLowerCase()))
          .map(item => item.name);
        d.req = newChecklist.filter(item => item.req && uploaded.has(item.name.toLowerCase())).length;
        changed = true;
      });
      if (changed) await writeData('dossies', dossies);
    }

    res.json(co.departments[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/companies/:id/departments/:deptId
router.delete('/:id/departments/:deptId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const list = await getCompanies();
    const co   = list.find(c => c.id === req.params.id);
    if (!co) return res.status(404).json({ error: 'Empresa nao encontrada.' });
    co.departments = co.departments.filter(d => d.id !== req.params.deptId);
    await writeData('companies', list);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/companies/:id/ct-schema
router.get('/:id/ct-schema', requireAuth, async (req, res) => {
  try {
    const schemas = await readData('ct_schemas') || {};
    res.json(schemas[req.params.id] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/companies/:id/ct-schema
router.put('/:id/ct-schema', requireAuth, async (req, res) => {
  try {
    const { role, companyId: uCo } = req.user;
    if (role !== 'admin' && !(role === 'company' && uCo === req.params.id))
      return res.status(403).json({ error: 'Acesso negado.' });
    const { fields } = req.body;
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > 10)
      return res.status(400).json({ error: 'Schema deve ter entre 1 e 10 campos.' });
    const schemas = await readData('ct_schemas') || {};
    schemas[req.params.id] = fields
      .map(f => ({ id: String(f.id), label: String(f.label || '').trim(), required: !!f.required }))
      .filter(f => f.id && f.label);
    if (!schemas[req.params.id].length)
      return res.status(400).json({ error: 'Nenhum campo valido enviado.' });
    await writeData('ct_schemas', schemas);
    res.json(schemas[req.params.id]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
