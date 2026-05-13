const express   = require('express');
const router    = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { readData, writeData } = require('./db');

const NF_KEY = 'nf_list';

async function getNFs(companyId) {
  const all = await readData(NF_KEY) || [];
  return companyId ? all.filter(n => n.companyId === companyId) : all;
}

async function saveNF(nf) {
  const all = await readData(NF_KEY) || [];
  const idx = all.findIndex(n => n.id === nf.id);
  if (idx >= 0) all[idx] = nf; else all.unshift(nf);
  await writeData(NF_KEY, all);
  return nf;
}

async function deleteNF(id) {
  const all = await readData(NF_KEY) || [];
  await writeData(NF_KEY, all.filter(n => n.id !== id));
}

// GET /api/nf?companyId=xxx
router.get('/', async (req, res) => {
  try {
    const list = await getNFs(req.query.companyId);
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/nf
router.post('/', async (req, res) => {
  try {
    const { cnpj, numero, dataEmissao, fornecedor, valor, companyId } = req.body;
    if (!cnpj || !numero || !fornecedor) {
      return res.status(400).json({ error: 'CNPJ, numero e fornecedor sao obrigatorios.' });
    }
    const nf = {
      id:          'nf_' + Date.now(),
      cnpj:        cnpj.trim(),
      numero:      numero.trim(),
      dataEmissao: (dataEmissao || '').trim(),
      fornecedor:  fornecedor.trim(),
      valor:       valor || null,
      companyId:   companyId || null,
      createdAt:   new Date().toISOString(),
      createdBy:   req.user?.username || 'sistema',
    };
    await saveNF(nf);
    res.status(201).json(nf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/nf/:id
router.put('/:id', async (req, res) => {
  try {
    const all = await readData(NF_KEY) || [];
    const nf  = all.find(n => n.id === req.params.id);
    if (!nf) return res.status(404).json({ error: 'NF nao encontrada.' });
    const { cnpj, numero, dataEmissao, fornecedor, valor } = req.body;
    if (cnpj)        nf.cnpj        = cnpj.trim();
    if (numero)      nf.numero      = numero.trim();
    if (dataEmissao !== undefined) nf.dataEmissao = dataEmissao.trim();
    if (fornecedor)  nf.fornecedor  = fornecedor.trim();
    if (valor !== undefined) nf.valor = valor || null;
    nf.updatedAt = new Date().toISOString();
    await saveNF(nf);
    res.json(nf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/nf/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteNF(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/nf/interpret  — AI extraction from image or PDF base64
router.post('/interpret', async (req, res) => {
  try {
    const { fileData, mediaType } = req.body;
    if (!fileData || !mediaType) {
      return res.status(400).json({ error: 'fileData e mediaType sao obrigatorios.' });
    }

    const client = new Anthropic();
    const prompt = `Voce e um especialista em leitura de Notas Fiscais brasileiras. Analise o documento e extraia as informacoes abaixo. Responda APENAS com JSON valido, sem texto extra:

{
  "cnpj": "CNPJ do emitente no formato 00.000.000/0001-00 ou null",
  "numero": "numero da NF (ex: 000123) ou null",
  "serie": "serie da NF ou null",
  "dataEmissao": "data de emissao no formato DD/MM/AAAA ou null",
  "fornecedor": "razao social ou nome do emitente ou null",
  "valor": "valor total da NF no formato R$ 0.000,00 ou null",
  "confianca": "alta | media | baixa",
  "observacao": "observacao curta se houver duvida na leitura, caso contrario null"
}`;

    const contentBlock = mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }
      : { type: 'image',    source: { type: 'base64', media_type: mediaType,          data: fileData } };

    const createParams = {
      model:      'claude-sonnet-4-6',
      max_tokens: 400,
      messages:   [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
    };

    const response = mediaType === 'application/pdf'
      ? await client.beta.messages.create({ ...createParams, betas: ['pdfs-2024-09-25'] })
      : await client.messages.create(createParams);

    const raw = response.content.find(c => c.type === 'text')?.text || '{}';
    res.json(JSON.parse(raw.replace(/```json\n?|```/g, '').trim()));
  } catch (err) {
    const msg = err.error?.error?.message || err.message || 'Erro interno';
    res.status(err.status || 500).json({ error: msg });
  }
});

module.exports = router;
