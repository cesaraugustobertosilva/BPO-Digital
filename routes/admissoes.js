const express     = require('express');
const router      = express.Router();
const { randomBytes } = require('crypto');
const { readData, writeData } = require('./db');
const { requireAuth } = require('./auth-middleware');

/* ── helpers ── */

const DEMO_IDS = new Set(['adm_demo1', 'adm_demo2', 'adm_demo3', 'adm_demo4']);

function demoSeed() {
  const now = Date.now();
  return [
    {
      id: 'adm_demo1',
      companyId: 'comp_demo',
      departmentId: 'dept_rh',
      name: 'Juliana Ferreira Costa',
      cpf: '432.109.876-55',
      email: 'juliana.costa@email.com',
      phone: '5511987654321',
      cargo: 'Analista de Marketing',
      dataInicio: '2025-06-02',
      mat: '',
      status: 'aguardando_candidato',
      createdAt: new Date(now - 86400000 * 2).toISOString(),
      createdBy: 'admin',
      migratedDossieId: null,
      linkToken: 'demo-token-juliana-001',
      contrato: { modo: 'manual', status: 'pendente', file: null },
      checklist: [
        { id: 'ci_rg',      name: 'RG ou CNH',                           required: true,  status: 'aprovado', aiResult: { ok: true,  reason: 'Documento de identidade legivel e valido.' },        file: { id: 'f1', name: 'rg.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 86400000).toISOString() } },
        { id: 'ci_cpf',     name: 'CPF',                                  required: true,  status: 'aprovado', aiResult: { ok: true,  reason: 'CPF legivel e no formato correto.' },                 file: { id: 'f2', name: 'cpf.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 86400000).toISOString() } },
        { id: 'ci_res',     name: 'Comprovante de Residencia',            required: true,  status: 'reprovado', aiResult: { ok: false, reason: 'Documento com data superior a 90 dias.' },          file: { id: 'f3', name: 'comp_res.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 43200000).toISOString() } },
        { id: 'ci_foto',    name: 'Foto 3x4',                             required: true,  status: 'enviado',  aiResult: null, file: { id: 'f4', name: 'foto.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 3600000).toISOString() } },
        { id: 'ci_cert',    name: 'Certidao de Nascimento ou Casamento',  required: true,  status: 'pendente', aiResult: null, file: null },
        { id: 'ci_ctps',    name: 'Carteira de Trabalho (CTPS)',          required: true,  status: 'pendente', aiResult: null, file: null },
        { id: 'ci_titulo',  name: 'Titulo de Eleitor',                    required: false, status: 'pendente', aiResult: null, file: null },
        { id: 'ci_diploma', name: 'Certificado Escolar / Diploma',        required: false, status: 'aprovado', aiResult: { ok: true, reason: 'Diploma de graduacao legivel e autenticado.' }, file: { id: 'f5', name: 'diploma.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 86400000).toISOString() } },
      ],
    },
    {
      id: 'adm_demo2',
      companyId: 'comp_demo',
      departmentId: 'dept_rh',
      name: 'Rafael Souza Almeida',
      cpf: '521.876.043-19',
      email: 'rafael.almeida@email.com',
      phone: '5521996543210',
      cargo: 'Desenvolvedor Backend',
      dataInicio: '2025-06-09',
      mat: '',
      status: 'completo',
      createdAt: new Date(now - 86400000 * 5).toISOString(),
      createdBy: 'admin',
      migratedDossieId: null,
      linkToken: 'demo-token-rafael-002',
      contrato: { modo: 'd4sign', status: 'aguardando_assinatura', d4signDocUuid: 'uuid-demo-001', d4signSignatories: 'rafael.almeida@email.com', d4signStatus: 'enviado' },
      checklist: [
        { id: 'ci_rg',      name: 'RG ou CNH',                           required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'CNH valida e dentro do prazo de validade.' },    file: { id: 'f10', name: 'cnh.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 86400000 * 3).toISOString() } },
        { id: 'ci_cpf',     name: 'CPF',                                  required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'CPF legivel e no formato correto.' },             file: { id: 'f11', name: 'cpf.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 86400000 * 3).toISOString() } },
        { id: 'ci_res',     name: 'Comprovante de Residencia',            required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'Comprovante recente e legivel.' },                 file: { id: 'f12', name: 'res.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 86400000 * 2).toISOString() } },
        { id: 'ci_foto',    name: 'Foto 3x4',                             required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'Foto adequada para documentos.' },                 file: { id: 'f13', name: 'foto.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 86400000 * 2).toISOString() } },
        { id: 'ci_cert',    name: 'Certidao de Nascimento ou Casamento',  required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'Certidao de nascimento legivel.' },                file: { id: 'f14', name: 'certidao.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 86400000 * 1).toISOString() } },
        { id: 'ci_ctps',    name: 'Carteira de Trabalho (CTPS)',          required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'CTPS com todas as paginas necessarias.' },         file: { id: 'f15', name: 'ctps.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 86400000 * 1).toISOString() } },
        { id: 'ci_diploma', name: 'Certificado Escolar / Diploma',        required: false, status: 'aprovado', aiResult: { ok: true, reason: 'Diploma de tecnologia legivel.' },                  file: { id: 'f16', name: 'diploma.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 43200000).toISOString() } },
      ],
    },
    {
      id: 'adm_demo3',
      companyId: 'comp_demo',
      departmentId: 'dept_rh',
      name: 'Camila Rodrigues Nunes',
      cpf: '876.543.210-33',
      email: 'camila.nunes@email.com',
      phone: '5531988887777',
      cargo: 'Assistente Comercial',
      dataInicio: '2025-06-16',
      mat: '',
      status: 'em_andamento',
      createdAt: new Date(now - 86400000 * 1).toISOString(),
      createdBy: 'admin',
      migratedDossieId: null,
      linkToken: 'demo-token-camila-003',
      contrato: { modo: 'manual', status: 'pendente', file: null },
      checklist: [
        { id: 'ci_rg',      name: 'RG ou CNH',                           required: true,  status: 'pendente', aiResult: null, file: null },
        { id: 'ci_cpf',     name: 'CPF',                                  required: true,  status: 'pendente', aiResult: null, file: null },
        { id: 'ci_res',     name: 'Comprovante de Residencia',            required: true,  status: 'pendente', aiResult: null, file: null },
        { id: 'ci_foto',    name: 'Foto 3x4',                             required: true,  status: 'pendente', aiResult: null, file: null },
        { id: 'ci_cert',    name: 'Certidao de Nascimento ou Casamento',  required: true,  status: 'pendente', aiResult: null, file: null },
        { id: 'ci_ctps',    name: 'Carteira de Trabalho (CTPS)',          required: true,  status: 'pendente', aiResult: null, file: null },
        { id: 'ci_titulo',  name: 'Titulo de Eleitor',                    required: false, status: 'pendente', aiResult: null, file: null },
        { id: 'ci_reserv',  name: 'Certificado de Reservista',            required: false, status: 'pendente', aiResult: null, file: null },
        { id: 'ci_pis',     name: 'PIS/PASEP',                            required: false, status: 'pendente', aiResult: null, file: null },
      ],
    },
    {
      id: 'adm_demo4',
      companyId: 'comp_demo',
      departmentId: 'dept_rh',
      name: 'Bruno Henrique Oliveira',
      cpf: '109.234.567-88',
      email: 'bruno.oliveira@email.com',
      phone: '5541977776666',
      cargo: 'Coordenador Financeiro',
      dataInicio: '2025-05-26',
      mat: '01045',
      status: 'migrado',
      createdAt: new Date(now - 86400000 * 10).toISOString(),
      createdBy: 'admin',
      migratedDossieId: 'dossie_adm_demo4',
      linkToken: 'demo-token-bruno-004',
      contrato: { modo: 'manual', status: 'assinado', file: { id: 'cf_demo4', name: 'contrato_assinado.pdf', mime: 'application/pdf' } },
      checklist: [
        { id: 'ci_rg',      name: 'RG ou CNH',                           required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'RG legivel e dentro da validade.' },    file: { id: 'f20', name: 'rg.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 86400000 * 8).toISOString() } },
        { id: 'ci_cpf',     name: 'CPF',                                  required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'CPF legivel.' },                         file: { id: 'f21', name: 'cpf.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 86400000 * 8).toISOString() } },
        { id: 'ci_res',     name: 'Comprovante de Residencia',            required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'Comprovante valido e recente.' },         file: { id: 'f22', name: 'res.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 86400000 * 7).toISOString() } },
        { id: 'ci_foto',    name: 'Foto 3x4',                             required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'Foto adequada.' },                        file: { id: 'f23', name: 'foto.jpg', mime: 'image/jpeg', uploadedAt: new Date(now - 86400000 * 7).toISOString() } },
        { id: 'ci_cert',    name: 'Certidao de Nascimento ou Casamento',  required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'Certidao valida.' },                      file: { id: 'f24', name: 'cert.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 86400000 * 6).toISOString() } },
        { id: 'ci_ctps',    name: 'Carteira de Trabalho (CTPS)',          required: true,  status: 'aprovado', aiResult: { ok: true, reason: 'CTPS completa.' },                        file: { id: 'f25', name: 'ctps.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 86400000 * 6).toISOString() } },
        { id: 'ci_diploma', name: 'Certificado Escolar / Diploma',        required: false, status: 'aprovado', aiResult: { ok: true, reason: 'Diploma de administracao legivel.' },    file: { id: 'f26', name: 'diploma.pdf', mime: 'application/pdf', uploadedAt: new Date(now - 86400000 * 5).toISOString() } },
      ],
    },
  ];
}

async function getAll() {
  let list = (await readData('admissoes')) || [];
  const existingIds = new Set(list.map(a => a.id));
  const demos = demoSeed();
  const missingDemos = demos.filter(d => !existingIds.has(d.id));
  if (missingDemos.length) {
    list = list.filter(a => !DEMO_IDS.has(a.id));
    list = [...demos, ...list];
    await writeData('admissoes', list);
  }
  return list;
}

async function saveAll(list) {
  await writeData('admissoes', list);
}

function stripSensitive(entry) {
  const e = { ...entry };
  if (e.contrato) {
    const { d4signApiKey, ...contratoSafe } = e.contrato;
    if (contratoSafe.file) {
      const { data, ...fileSafe } = contratoSafe.file;
      contratoSafe.file = fileSafe;
    }
    e.contrato = contratoSafe;
  }
  if (e.checklist) {
    e.checklist = e.checklist.map(c => {
      if (!c.file) return c;
      const { data, ...fileSafe } = c.file;
      return { ...c, file: fileSafe };
    });
  }
  return e;
}

/* ── LIST ── */
router.get('/', requireAuth, async (req, res) => {
  try {
    let list = await getAll();
    const { role, companyId: uCo, departmentId: uDept } = req.user;
    if (role === 'company')    list = list.filter(a => a.companyId === uCo);
    if (role === 'department') list = list.filter(a => a.companyId === uCo && a.departmentId === uDept);
    if (role === 'admin') {
      const { companyId } = req.query;
      if (companyId) list = list.filter(a => a.companyId === companyId);
    }
    res.json(list.map(stripSensitive));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── PUBLIC ENDPOINTS (no auth) - must come before /:id routes ── */

router.get('/pub/:token', async (req, res) => {
  try {
    const list  = await getAll();
    const entry = list.find(a => a.linkToken === req.params.token);
    if (!entry) return res.status(404).json({ error: 'Link invalido ou expirado.' });
    const safe = {
      id:         entry.id,
      name:       entry.name,
      cargo:      entry.cargo,
      dataInicio: entry.dataInicio,
      status:     entry.status,
      checklist:  (entry.checklist || []).map(c => ({
        id:       c.id,
        name:     c.name,
        required: c.required,
        status:   c.status,
        hasFile:  !!c.file,
        aiResult: c.aiResult,
      })),
    };
    res.json(safe);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pub/:token/upload/:itemId', async (req, res) => {
  try {
    const list  = await getAll();
    const idx   = list.findIndex(a => a.linkToken === req.params.token);
    if (idx < 0) return res.status(404).json({ error: 'Link invalido ou expirado.' });
    const entry = list[idx];
    const item  = (entry.checklist || []).find(c => c.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item nao encontrado.' });
    const { data, name, mime } = req.body;
    if (!data || !name) return res.status(400).json({ error: 'Campos data e name sao obrigatorios.' });
    item.file = { id: 'f_' + Date.now(), name, mime: mime || 'application/octet-stream', data, uploadedAt: new Date().toISOString() };
    item.status = 'enviado';
    item.aiResult = null;
    if (entry.status !== 'completo' && entry.status !== 'migrado') {
      entry.status = 'aguardando_candidato';
    }
    list[idx] = entry;
    await saveAll(list);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── SINGLE ── */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const entry = (await getAll()).find(a => a.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Processo nao encontrado.' });
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── CREATE / UPDATE ── */
router.post('/', requireAuth, async (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.id) return res.status(400).json({ error: 'Payload invalido.' });
    const list = await getAll();
    const idx  = list.findIndex(a => a.id === entry.id);
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    await saveAll(list);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── DELETE ── */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const list = await getAll();
    await saveAll(list.filter(a => a.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── AI VALIDATION ── */
router.post('/:id/validate/:itemId', requireAuth, async (req, res) => {
  try {
    const list  = await getAll();
    const idx   = list.findIndex(a => a.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Processo nao encontrado.' });
    const entry = list[idx];
    const item  = (entry.checklist || []).find(c => c.id === req.params.itemId);
    if (!item)      return res.status(404).json({ error: 'Item nao encontrado.' });
    if (!item.file) return res.status(400).json({ error: 'Nenhum arquivo enviado para este item.' });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();

    const isImage = item.file.mime && item.file.mime.startsWith('image/');
    const isPdf   = item.file.mime === 'application/pdf';

    let messageContent;
    const prompt = `Voce e um assistente especializado em validacao de documentos de admissao no Brasil. Analise o documento enviado e determine se ele corresponde ao tipo esperado: "${item.name}". Responda SOMENTE com um JSON no formato: {"ok": true/false, "reason": "motivo em portugues, maximo 80 caracteres"}. Se for imagem ilegivel ou arquivo corrompido, retorne {"ok": false, "reason": "Documento ilegivel ou formato invalido"}.`;

    if (isImage) {
      const imgType = item.file.mime.replace('image/', '');
      const validTypes = ['jpeg', 'png', 'gif', 'webp'];
      const mediaType  = validTypes.includes(imgType) ? item.file.mime : 'image/jpeg';
      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: item.file.data } },
        { type: 'text', text: prompt },
      ];
    } else if (isPdf) {
      messageContent = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: item.file.data } },
        { type: 'text', text: prompt },
      ];
    } else {
      messageContent = [{ type: 'text', text: `${prompt}\n\nNota: O arquivo nao e uma imagem nem PDF reconhecido (mime: ${item.file.mime}). Retorne {"ok": false, "reason": "Formato de arquivo nao suportado para validacao automatica"}.` }];
    }

    let aiResult = { ok: false, reason: 'Erro ao processar validacao.' };
    try {
      const resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: messageContent }],
      });
      const text = resp.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) aiResult = JSON.parse(match[0]);
    } catch (aiErr) {
      console.error('[admissoes] AI validation error:', aiErr.message);
      aiResult = { ok: false, reason: 'Servico de IA indisponivel.' };
    }

    item.aiResult = aiResult;
    item.status   = aiResult.ok ? 'aprovado' : 'reprovado';
    list[idx] = entry;
    await saveAll(list);
    res.json({ ok: true, aiResult });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── MIGRATE TO RH DOSSIE ── */
router.post('/:id/migrate', requireAuth, async (req, res) => {
  try {
    const list  = await getAll();
    const idx   = list.findIndex(a => a.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Processo nao encontrado.' });
    const entry = list[idx];

    const dossies = (await readData('dossies')) || [];
    const newDossieId = 'dossie_adm_' + Date.now();
    const docs = (entry.checklist || [])
      .filter(c => c.status === 'aprovado' || c.status === 'enviado')
      .map(c => c.name);

    const files = (entry.checklist || [])
      .filter(c => (c.status === 'aprovado' || c.status === 'enviado') && c.file)
      .map(c => ({ id: c.id, name: c.name, mime: c.file.mime, data: c.file.data, uploadedAt: c.file.uploadedAt }));

    const newDossie = {
      id:           newDossieId,
      ts:           Date.now(),
      companyId:    entry.companyId,
      departmentId: entry.departmentId,
      name:         entry.name,
      cpf:          entry.cpf,
      mat:          entry.mat || '',
      cargo:        entry.cargo,
      status:       'ativo',
      docs,
      missing_req:  [],
      total:        docs.length,
      req:          (entry.checklist || []).filter(c => c.required && (c.status === 'aprovado' || c.status === 'enviado')).length,
      files,
      admissaoId:   entry.id,
      createdAt:    new Date().toISOString(),
    };

    dossies.unshift(newDossie);
    await writeData('dossies', dossies.slice(0, 500));

    entry.status = 'migrado';
    entry.migratedDossieId = newDossieId;
    list[idx] = entry;
    await saveAll(list);

    res.json({ ok: true, dossieId: newDossieId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── GENERATE / GET PUBLIC LINK TOKEN ── */
router.get('/:id/link', requireAuth, async (req, res) => {
  try {
    const list  = await getAll();
    const idx   = list.findIndex(a => a.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Processo nao encontrado.' });
    const entry = list[idx];
    if (!entry.linkToken) {
      entry.linkToken = randomBytes(20).toString('hex');
      list[idx] = entry;
      await saveAll(list);
    }
    res.json({ token: entry.linkToken });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── D4SIGN: SEND FOR SIGNATURE ── */
router.post('/:id/d4sign/send', requireAuth, async (req, res) => {
  try {
    const list  = await getAll();
    const idx   = list.findIndex(a => a.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Processo nao encontrado.' });
    const entry = list[idx];

    const { apiKey, docUuid, signatories } = req.body;
    if (!apiKey || !docUuid) return res.status(400).json({ error: 'apiKey e docUuid sao obrigatorios.' });

    // Create signatory list on D4sign
    const listResp = await fetch(`https://secure.d4sign.com.br/api/v1/documents/${docUuid}/createlist?tokenAPI=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ signatories: signatories || [] }),
    });
    if (!listResp.ok) {
      const errBody = await listResp.json().catch(() => ({}));
      return res.status(502).json({ error: 'D4sign createlist: ' + (errBody.message || listResp.status) });
    }

    // Send to sign
    const sendResp = await fetch(`https://secure.d4sign.com.br/api/v1/documents/${docUuid}/sendtosign?tokenAPI=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ skip_email: 0, workflow: 0 }),
    });
    if (!sendResp.ok) {
      const errBody = await sendResp.json().catch(() => ({}));
      return res.status(502).json({ error: 'D4sign sendtosign: ' + (errBody.message || sendResp.status) });
    }

    entry.contrato = entry.contrato || {};
    entry.contrato.modo          = 'd4sign';
    entry.contrato.d4signApiKey  = apiKey;
    entry.contrato.d4signDocUuid = docUuid;
    entry.contrato.d4signSignatories = (signatories || []).map(s => s.email).join(', ');
    entry.contrato.status        = 'aguardando_assinatura';
    entry.contrato.d4signStatus  = 'enviado';
    list[idx] = entry;
    await saveAll(list);

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── D4SIGN: CHECK STATUS ── */
router.get('/:id/d4sign/status', requireAuth, async (req, res) => {
  try {
    const list  = await getAll();
    const entry = list.find(a => a.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Processo nao encontrado.' });

    const apiKey  = entry.contrato?.d4signApiKey;
    const docUuid = entry.contrato?.d4signDocUuid;
    if (!apiKey || !docUuid) return res.status(400).json({ error: 'D4sign nao configurado para este processo.' });

    const r = await fetch(`https://secure.d4sign.com.br/api/v1/documents/${docUuid}?tokenAPI=${apiKey}`);
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      return res.status(502).json({ error: 'D4sign status: ' + (errBody.message || r.status) });
    }
    const doc = await r.json();
    const signed = doc.statusId === 4 || doc.statusId === '4';

    const idx = list.findIndex(a => a.id === req.params.id);
    if (idx >= 0 && signed) {
      list[idx].contrato.status       = 'assinado';
      list[idx].contrato.d4signStatus = 'assinado';
      await saveAll(list);
    } else if (idx >= 0) {
      list[idx].contrato.d4signStatus = String(doc.statusId);
      await saveAll(list);
    }

    res.json({ signed, statusId: doc.statusId, statusName: doc.statusName || '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
