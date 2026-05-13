const express = require('express');
const router  = express.Router();
const { readData, writeData } = require('./db');

const CT_KEY = 'contratos_list';

async function getContratos(companyId) {
  const all = await readData(CT_KEY) || [];
  return companyId ? all.filter(c => c.companyId === companyId) : all;
}

async function saveContrato(ct) {
  const all = await readData(CT_KEY) || [];
  const idx = all.findIndex(c => c.id === ct.id);
  if (idx >= 0) all[idx] = ct; else all.unshift(ct);
  await writeData(CT_KEY, all);
  return ct;
}

async function deleteContrato(id) {
  const all = await readData(CT_KEY) || [];
  await writeData(CT_KEY, all.filter(c => c.id !== id));
}

// GET /api/contratos?companyId=xxx
router.get('/', async (req, res) => {
  try {
    res.json(await getContratos(req.query.companyId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/contratos
router.post('/', async (req, res) => {
  try {
    const { nomeCliente, cidade, clienteChave, cpfCnpj, dataInstalacao, estado, filial, modelo, companyId } = req.body;
    if (!nomeCliente) return res.status(400).json({ error: 'Nome do cliente e obrigatorio.' });
    const ct = {
      id:             'ct_' + Date.now(),
      nomeCliente:    (nomeCliente   || '').trim(),
      cidade:         (cidade        || '').trim(),
      clienteChave:   (clienteChave  || '').trim(),
      cpfCnpj:        (cpfCnpj       || '').trim(),
      dataInstalacao: (dataInstalacao|| '').trim(),
      estado:         (estado        || '').trim(),
      filial:         (filial        || '').trim(),
      modelo:         (modelo        || '').trim(),
      companyId:      companyId || null,
      createdAt:      new Date().toISOString(),
      createdBy:      req.user?.username || 'sistema',
    };
    await saveContrato(ct);
    res.status(201).json(ct);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/contratos/:id
router.put('/:id', async (req, res) => {
  try {
    const all = await readData(CT_KEY) || [];
    const ct  = all.find(c => c.id === req.params.id);
    if (!ct) return res.status(404).json({ error: 'Contrato nao encontrado.' });
    const fields = ['nomeCliente','cidade','clienteChave','cpfCnpj','dataInstalacao','estado','filial','modelo'];
    fields.forEach(f => { if (req.body[f] !== undefined) ct[f] = req.body[f].trim(); });
    ct.updatedAt = new Date().toISOString();
    await saveContrato(ct);
    res.json(ct);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/contratos/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteContrato(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
