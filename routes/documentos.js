const express = require('express');
const router  = express.Router();
const { readData, writeData } = require('./db');

const DV_KEY   = 'documentos_list';
const MAX_FILE = 4 * 1024 * 1024; // 4 MB base64 por arquivo

async function getDocumentos(companyId) {
  const all = await readData(DV_KEY) || [];
  return (companyId ? all.filter(d => d.companyId === companyId) : all)
    .map(d => ({ ...d, files: (d.files || []).map(f => ({ id:f.id, name:f.name, size:f.size, mime:f.mime, uploadedAt:f.uploadedAt })) }));
}

async function saveDocumento(doc) {
  const all = await readData(DV_KEY) || [];
  const idx = all.findIndex(d => d.id === doc.id);
  if (idx >= 0) all[idx] = doc; else all.unshift(doc);
  await writeData(DV_KEY, all);
  return doc;
}

async function deleteDocumento(id) {
  const all = await readData(DV_KEY) || [];
  await writeData(DV_KEY, all.filter(d => d.id !== id));
}

// GET /api/documentos?companyId=xxx
router.get('/', async (req, res) => {
  try {
    res.json(await getDocumentos(req.query.companyId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/documentos
router.post('/', async (req, res) => {
  try {
    const { fields = {}, companyId, checklist = [] } = req.body;
    if (!String(fields.f1 || '').trim())
      return res.status(400).json({ error: 'O campo principal (f1) e obrigatorio.' });
    const sanitized = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, String(v || '').trim()])
    );
    const doc = {
      id:        'dv_' + Date.now(),
      companyId: companyId || null,
      fields:    sanitized,
      checklist: checklist
        .map(i => ({ id: String(i.id || ('ci_' + Date.now() + Math.random().toString(36).slice(2,5))), name: String(i.name || '').trim(), checked: !!i.checked }))
        .filter(i => i.name),
      files:     [],
      createdAt: new Date().toISOString(),
      createdBy: req.user?.username || 'sistema',
    };
    await saveDocumento(doc);
    res.status(201).json({ ...doc, files: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/documentos/:id
router.put('/:id', async (req, res) => {
  try {
    const all = await readData(DV_KEY) || [];
    const doc = all.find(d => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento nao encontrado.' });
    if (req.body.fields && typeof req.body.fields === 'object') {
      doc.fields = Object.fromEntries(
        Object.entries(req.body.fields).map(([k, v]) => [k, String(v || '').trim()])
      );
    }
    if (Array.isArray(req.body.checklist)) {
      doc.checklist = req.body.checklist
        .map(i => ({ id: String(i.id), name: String(i.name || '').trim(), checked: !!i.checked }))
        .filter(i => i.id && i.name);
    }
    doc.updatedAt = new Date().toISOString();
    await saveDocumento(doc);
    res.json({ ...doc, files: (doc.files||[]).map(f => ({ id:f.id, name:f.name, size:f.size, mime:f.mime, uploadedAt:f.uploadedAt })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/documentos/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteDocumento(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/documentos/:id/files
router.post('/:id/files', async (req, res) => {
  try {
    const all = await readData(DV_KEY) || [];
    const doc = all.find(d => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento nao encontrado.' });

    const { name, mime, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'name e data sao obrigatorios.' });
    if (data.length > MAX_FILE) return res.status(413).json({ error: 'Arquivo muito grande (max 4 MB).' });

    const file = {
      id:         'f_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      name:       name.trim(),
      mime:       mime || 'application/octet-stream',
      size:       Math.round(data.length * 0.75),
      data,
      uploadedAt: new Date().toISOString(),
    };
    doc.files = doc.files || [];
    doc.files.push(file);
    await saveDocumento(doc);
    res.status(201).json({ id:file.id, name:file.name, size:file.size, mime:file.mime, uploadedAt:file.uploadedAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/documentos/:id/files/:fid
router.get('/:id/files/:fid', async (req, res) => {
  try {
    const all  = await readData(DV_KEY) || [];
    const doc  = all.find(d => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento nao encontrado.' });
    const file = (doc.files || []).find(f => f.id === req.params.fid);
    if (!file) return res.status(404).json({ error: 'Arquivo nao encontrado.' });

    const buf = Buffer.from(file.data, 'base64');
    res.setHeader('Content-Type', file.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    res.send(buf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/documentos/:id/files/:fid
router.delete('/:id/files/:fid', async (req, res) => {
  try {
    const all = await readData(DV_KEY) || [];
    const doc = all.find(d => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento nao encontrado.' });
    doc.files = (doc.files || []).filter(f => f.id !== req.params.fid);
    await saveDocumento(doc);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
