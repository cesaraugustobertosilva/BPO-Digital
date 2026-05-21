const express = require('express');
const router  = express.Router();
const { readData, writeData } = require('./db');

const CT_KEY   = 'contratos_list';
const MAX_FILE = 4 * 1024 * 1024; // 4 MB base64 por arquivo

async function getContratos(companyId) {
  const all = await readData(CT_KEY) || [];
  // strip file data from list view to keep responses small
  return (companyId ? all.filter(c => c.companyId === companyId) : all)
    .map(c => ({ ...c, files: (c.files || []).map(f => ({ id:f.id, name:f.name, size:f.size, mime:f.mime, uploadedAt:f.uploadedAt })) }));
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
    const { fields = {}, companyId } = req.body;
    if (!String(fields.f1 || '').trim())
      return res.status(400).json({ error: 'O campo principal (f1) e obrigatorio.' });
    const sanitized = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, String(v || '').trim()])
    );
    const rawCl = Array.isArray(req.body.checklist) ? req.body.checklist : [];
    const ct = {
      id:          'ct_' + Date.now(),
      companyId:   companyId || null,
      fields:      sanitized,
      nomeCliente: sanitized.f1, // backward compat
      files:       [],
      checklist:   rawCl.map(i => ({ id: String(i.id), name: String(i.name||'').trim(), checked: !!i.checked })).filter(i => i.id && i.name),
      createdAt:   new Date().toISOString(),
      createdBy:   req.user?.username || 'sistema',
    };
    await saveContrato(ct);
    res.status(201).json({ ...ct, files: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/contratos/:id
router.put('/:id', async (req, res) => {
  try {
    const all = await readData(CT_KEY) || [];
    const ct  = all.find(c => c.id === req.params.id);
    if (!ct) return res.status(404).json({ error: 'Contrato nao encontrado.' });
    if (req.body.fields && typeof req.body.fields === 'object') {
      ct.fields = Object.fromEntries(
        Object.entries(req.body.fields).map(([k, v]) => [k, String(v || '').trim()])
      );
      ct.nomeCliente = ct.fields.f1 || ct.nomeCliente; // backward compat
    }
    if (Array.isArray(req.body.checklist)) {
      ct.checklist = req.body.checklist
        .map(i => ({ id: String(i.id), name: String(i.name || '').trim(), checked: !!i.checked }))
        .filter(i => i.id && i.name);
    }
    ct.updatedAt = new Date().toISOString();
    await saveContrato(ct);
    res.json({ ...ct, files: (ct.files||[]).map(f => ({ id:f.id, name:f.name, size:f.size, mime:f.mime, uploadedAt:f.uploadedAt })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/contratos/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteContrato(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/contratos/:id/files  — upload one file (base64)
router.post('/:id/files', async (req, res) => {
  try {
    const all = await readData(CT_KEY) || [];
    const ct  = all.find(c => c.id === req.params.id);
    if (!ct) return res.status(404).json({ error: 'Contrato nao encontrado.' });

    const { name, mime, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'name e data sao obrigatorios.' });
    if (data.length > MAX_FILE) return res.status(413).json({ error: 'Arquivo muito grande (max 4 MB).' });

    const file = {
      id:         'f_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      name:       name.trim(),
      mime:       mime || 'application/octet-stream',
      size:       Math.round(data.length * 0.75), // approx bytes
      data,
      uploadedAt: new Date().toISOString(),
    };
    ct.files = ct.files || [];
    ct.files.push(file);
    await saveContrato(ct);
    res.status(201).json({ id:file.id, name:file.name, size:file.size, mime:file.mime, uploadedAt:file.uploadedAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/contratos/:id/files/:fid  — download a file
router.get('/:id/files/:fid', async (req, res) => {
  try {
    const all  = await readData(CT_KEY) || [];
    const ct   = all.find(c => c.id === req.params.id);
    if (!ct) return res.status(404).json({ error: 'Contrato nao encontrado.' });
    const file = (ct.files || []).find(f => f.id === req.params.fid);
    if (!file) return res.status(404).json({ error: 'Arquivo nao encontrado.' });

    const buf = Buffer.from(file.data, 'base64');
    res.setHeader('Content-Type', file.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    res.send(buf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/contratos/:id/files/:fid
router.delete('/:id/files/:fid', async (req, res) => {
  try {
    const all = await readData(CT_KEY) || [];
    const ct  = all.find(c => c.id === req.params.id);
    if (!ct) return res.status(404).json({ error: 'Contrato nao encontrado.' });
    ct.files = (ct.files || []).filter(f => f.id !== req.params.fid);
    await saveContrato(ct);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
