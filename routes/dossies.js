const express = require('express');
const router  = express.Router();
const { requireAuth } = require('./auth-middleware');
const { readData, writeData } = require('./db');

function seed() {
  const now = Date.now();
  return [
    {
      id: 'demo1', ts: now - 86400000 * 2, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Ana Beatriz Souza', cpf: '123.456.789-00', mat: '00541',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional'],
      missing_req: [], total: 5, req: 5,
    },
    {
      id: 'demo2', ts: now - 86400000 * 5, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Carlos Eduardo Lima', cpf: '987.654.321-00', mat: '00312',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho'],
      missing_req: ['Ficha de Admissao', 'Exame Admissional'], total: 3, req: 3,
    },
    {
      id: 'demo3', ts: now - 86400000 * 8, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Fernanda Costa Ribeiro', cpf: '456.789.123-00', mat: '00218',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional', 'Foto 3x4'],
      missing_req: [], total: 6, req: 5,
    },
    {
      id: 'demo4', ts: now - 86400000 * 3, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Ricardo Almeida Neto', cpf: '321.654.987-00', mat: '00710',
      docs: ['CPF', 'Contrato de Trabalho', 'Ficha de Admissao'],
      missing_req: ['CNH / RG / Documento de Identidade', 'Exame Admissional'], total: 3, req: 3,
    },
    {
      id: 'demo5', ts: now - 86400000 * 1, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Juliana Martins Freitas', cpf: '111.222.333-00', mat: '00889',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao'],
      missing_req: ['Exame Admissional'], total: 4, req: 4,
    },
  ];
}

async function getOrSeed() {
  const list = await readData('dossies');
  if (!list || !list.length) {
    const s = seed();
    await writeData('dossies', s);
    return s;
  }
  return list;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    let list = await getOrSeed();
    const { role, companyId: uCo, departmentId: uDept } = req.user;
    if (role === 'company')    list = list.filter(d => d.companyId === uCo);
    if (role === 'department') list = list.filter(d => d.companyId === uCo && d.departmentId === uDept);
    if (role === 'admin') {
      const { companyId, departmentId } = req.query;
      if (companyId)    list = list.filter(d => d.companyId === companyId);
      if (departmentId) list = list.filter(d => d.departmentId === departmentId);
    }
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const entry = (await getOrSeed()).find(d => d.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Dossie nao encontrado.' });
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.id) return res.status(400).json({ error: 'Payload invalido.' });
    const list = await getOrSeed();
    const idx  = list.findIndex(d => d.id === entry.id);
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    await writeData('dossies', list.slice(0, 500));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const list = await getOrSeed();
    await writeData('dossies', list.filter(d => d.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
