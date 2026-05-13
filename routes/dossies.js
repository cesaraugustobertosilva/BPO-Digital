const express = require('express');
const router  = express.Router();
const { requireAuth } = require('./auth-middleware');
const { readData, writeData } = require('./db');

function docUrl(type, data) {
  const q = new URLSearchParams({ type, ...data });
  return `/demo/doc.html?${q}`;
}

function laborDemoSeed() {
  const now = Date.now();
  return [
    {
      id: 'dl1', ts: now - 86400000 * 2, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Carlos Eduardo Mendes', cpf: '342.891.074-55', mat: '00841', cargo: 'Analista de Logistica',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Comprovante de Residencia'],
      missing_req: ['Exame Admissional'], total: 5, req: 4,
      files: [
        { id:'cnh',   name:'CNH / RG / Documento de Identidade', previewUrl: docUrl('cnh',   { nome:'Carlos Eduardo Mendes', cpf:'342.891.074-55', num:'4821 7733 SP/DETRAN', emissao:'08/07/2020', validade:'15/03/2028', cargo:'Analista de Logistica' }) },
        { id:'cpf',   name:'CPF',                                previewUrl: docUrl('cpf',   { nome:'Carlos Eduardo Mendes', cpf:'342.891.074-55', emissao:'12/01/2015' }) },
        { id:'ctrato',name:'Contrato de Trabalho',               previewUrl: docUrl('ctrato',{ nome:'Carlos Eduardo Mendes', cpf:'342.891.074-55', num:'CT-2019/0041', emissao:'15/03/2019', cargo:'Analista de Logistica', mat:'00841', empresa:'SBK Legal Operations' }) },
        { id:'admiss',name:'Ficha de Admissao',                  previewUrl: docUrl('admiss',{ nome:'Carlos Eduardo Mendes', cpf:'342.891.074-55', num:'FA-2019/0041', emissao:'15/03/2019', cargo:'Analista de Logistica', mat:'00841', empresa:'SBK Legal Operations' }) },
        { id:'resid', name:'Comprovante de Residencia',          previewUrl: docUrl('resid', { nome:'Carlos Eduardo Mendes', cpf:'342.891.074-55', num:'Conta de Luz - Enel', emissao:'10/05/2025', validade:'30/06/2025' }) },
      ],
    },
    {
      id: 'dl2', ts: now - 86400000 * 5, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Aline Cristina Fonseca', cpf: '521.047.389-81', mat: '00523', cargo: 'Auxiliar Administrativo',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional', 'Comprovante de Residencia', 'Foto 3x4'],
      missing_req: [], total: 7, req: 5,
      files: [
        { id:'cnh',   name:'CNH / RG / Documento de Identidade', previewUrl: docUrl('cnh',   { nome:'Aline Cristina Fonseca', cpf:'521.047.389-81', num:'7714 8822 SP/SSP', emissao:'10/01/2022', validade:'22/01/2027', cargo:'Auxiliar Administrativo' }) },
        { id:'cpf',   name:'CPF',                                previewUrl: docUrl('cpf',   { nome:'Aline Cristina Fonseca', cpf:'521.047.389-81', emissao:'03/05/2018' }) },
        { id:'ctrato',name:'Contrato de Trabalho',               previewUrl: docUrl('ctrato',{ nome:'Aline Cristina Fonseca', cpf:'521.047.389-81', num:'CT-2021/0007', emissao:'20/01/2021', cargo:'Auxiliar Administrativo', mat:'00523', empresa:'SBK Legal Operations' }) },
        { id:'admiss',name:'Ficha de Admissao',                  previewUrl: docUrl('admiss',{ nome:'Aline Cristina Fonseca', cpf:'521.047.389-81', num:'FA-2021/0007', emissao:'20/01/2021', cargo:'Auxiliar Administrativo', mat:'00523', empresa:'SBK Legal Operations' }) },
        { id:'exame', name:'Exame Admissional',                  previewUrl: docUrl('exame', { nome:'Aline Cristina Fonseca', cpf:'521.047.389-81', num:'EX-2021/0007', emissao:'18/01/2021', validade:'20/01/2026', cargo:'Auxiliar Administrativo', empresa:'SBK Legal Operations' }) },
        { id:'resid', name:'Comprovante de Residencia',          previewUrl: docUrl('resid', { nome:'Aline Cristina Fonseca', cpf:'521.047.389-81', num:'Conta de Agua - Sabesp', emissao:'05/05/2025', validade:'31/05/2025' }) },
        { id:'foto',  name:'Foto 3x4',                           previewUrl: docUrl('foto',  { nome:'Aline Cristina Fonseca', cpf:'521.047.389-81', cargo:'Auxiliar Administrativo' }) },
      ],
    },
    {
      id: 'dl3', ts: now - 86400000 * 8, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Ricardo Viana Barbosa', cpf: '089.345.671-22', mat: '00317', cargo: 'Supervisor de Operacoes',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Exame Admissional', 'Foto 3x4'],
      missing_req: ['Contrato de Trabalho', 'Ficha de Admissao'], total: 4, req: 2,
      files: [
        { id:'cnh',   name:'CNH / RG / Documento de Identidade', previewUrl: docUrl('cnh',   { nome:'Ricardo Viana Barbosa', cpf:'089.345.671-22', num:'3390 5512 MG/DETRAN', emissao:'14/02/2021', validade:'01/06/2026', cargo:'Supervisor de Operacoes' }) },
        { id:'cpf',   name:'CPF',                                previewUrl: docUrl('cpf',   { nome:'Ricardo Viana Barbosa', cpf:'089.345.671-22', emissao:'07/08/2010' }) },
        { id:'exame', name:'Exame Admissional',                  previewUrl: docUrl('exame', { nome:'Ricardo Viana Barbosa', cpf:'089.345.671-22', num:'EX-2017/0031', emissao:'28/05/2017', validade:'01/06/2022', cargo:'Supervisor de Operacoes', empresa:'SBK Legal Operations' }) },
        { id:'foto',  name:'Foto 3x4',                           previewUrl: docUrl('foto',  { nome:'Ricardo Viana Barbosa', cpf:'089.345.671-22', cargo:'Supervisor de Operacoes' }) },
      ],
    },
    {
      id: 'dl4', ts: now - 86400000 * 3, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Fernanda Lima Carvalho', cpf: '673.890.234-09', mat: '00620', cargo: 'Coordenadora de RH',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional', 'Comprovante de Residencia', 'Foto 3x4'],
      missing_req: [], total: 7, req: 5,
      files: [
        { id:'cnh',   name:'CNH / RG / Documento de Identidade', previewUrl: docUrl('cnh',   { nome:'Fernanda Lima Carvalho', cpf:'673.890.234-09', num:'2204 9951 SP/SSP', emissao:'03/07/2024', validade:'10/08/2029', cargo:'Coordenadora de RH' }) },
        { id:'cpf',   name:'CPF',                                previewUrl: docUrl('cpf',   { nome:'Fernanda Lima Carvalho', cpf:'673.890.234-09', emissao:'16/11/2012' }) },
        { id:'ctrato',name:'Contrato de Trabalho',               previewUrl: docUrl('ctrato',{ nome:'Fernanda Lima Carvalho', cpf:'673.890.234-09', num:'CT-2020/0082', emissao:'10/08/2020', cargo:'Coordenadora de RH', mat:'00620', empresa:'SBK Legal Operations' }) },
        { id:'admiss',name:'Ficha de Admissao',                  previewUrl: docUrl('admiss',{ nome:'Fernanda Lima Carvalho', cpf:'673.890.234-09', num:'FA-2020/0082', emissao:'10/08/2020', cargo:'Coordenadora de RH', mat:'00620', empresa:'SBK Legal Operations' }) },
        { id:'exame', name:'Exame Admissional',                  previewUrl: docUrl('exame', { nome:'Fernanda Lima Carvalho', cpf:'673.890.234-09', num:'EX-2020/0082', emissao:'07/08/2020', validade:'10/08/2025', cargo:'Coordenadora de RH', empresa:'SBK Legal Operations' }) },
        { id:'resid', name:'Comprovante de Residencia',          previewUrl: docUrl('resid', { nome:'Fernanda Lima Carvalho', cpf:'673.890.234-09', num:'Fatura Internet - Vivo', emissao:'01/06/2025', validade:'30/06/2025' }) },
        { id:'foto',  name:'Foto 3x4',                           previewUrl: docUrl('foto',  { nome:'Fernanda Lima Carvalho', cpf:'673.890.234-09', cargo:'Coordenadora de RH' }) },
      ],
    },
    {
      id: 'dl5', ts: now - 86400000 * 1, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Marcelo dos Santos Pereira', cpf: '815.234.067-44', mat: '00423', cargo: 'Motorista',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional', 'Foto 3x4'],
      missing_req: [], total: 6, req: 5,
      files: [
        { id:'cnh',   name:'CNH / RG / Documento de Identidade', previewUrl: docUrl('cnh',   { nome:'Marcelo dos Santos Pereira', cpf:'815.234.067-44', num:'5593 1182 SP/DETRAN', emissao:'10/03/2019', validade:'22/04/2024', cargo:'Motorista' }) },
        { id:'cpf',   name:'CPF',                                previewUrl: docUrl('cpf',   { nome:'Marcelo dos Santos Pereira', cpf:'815.234.067-44', emissao:'20/02/2014' }) },
        { id:'ctrato',name:'Contrato de Trabalho',               previewUrl: docUrl('ctrato',{ nome:'Marcelo dos Santos Pereira', cpf:'815.234.067-44', num:'CT-2018/0023', emissao:'22/04/2018', cargo:'Motorista', mat:'00423', empresa:'SBK Legal Operations' }) },
        { id:'admiss',name:'Ficha de Admissao',                  previewUrl: docUrl('admiss',{ nome:'Marcelo dos Santos Pereira', cpf:'815.234.067-44', num:'FA-2018/0023', emissao:'22/04/2018', cargo:'Motorista', mat:'00423', empresa:'SBK Legal Operations' }) },
        { id:'exame', name:'Exame Admissional',                  previewUrl: docUrl('exame', { nome:'Marcelo dos Santos Pereira', cpf:'815.234.067-44', num:'EX-2018/0023', emissao:'19/04/2018', validade:'22/04/2023', cargo:'Motorista', empresa:'SBK Legal Operations' }) },
        { id:'foto',  name:'Foto 3x4',                           previewUrl: docUrl('foto',  { nome:'Marcelo dos Santos Pereira', cpf:'815.234.067-44', cargo:'Motorista' }) },
      ],
    },
    {
      id: 'dl6', ts: now - 86400000 * 4, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Patricia Gomes Alves', cpf: '198.076.523-37', mat: '00912', cargo: 'Assistente Fiscal',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional', 'Comprovante de Residencia', 'Foto 3x4'],
      missing_req: [], total: 7, req: 5,
      files: [
        { id:'cnh',   name:'CNH / RG / Documento de Identidade', previewUrl: docUrl('cnh',   { nome:'Patricia Gomes Alves', cpf:'198.076.523-37', num:'9012 3344 SP/SSP', emissao:'20/02/2025', validade:'01/03/2030', cargo:'Assistente Fiscal' }) },
        { id:'cpf',   name:'CPF',                                previewUrl: docUrl('cpf',   { nome:'Patricia Gomes Alves', cpf:'198.076.523-37', emissao:'14/09/2016' }) },
        { id:'ctrato',name:'Contrato de Trabalho',               previewUrl: docUrl('ctrato',{ nome:'Patricia Gomes Alves', cpf:'198.076.523-37', num:'CT-2022/0019', emissao:'01/03/2022', cargo:'Assistente Fiscal', mat:'00912', empresa:'SBK Legal Operations' }) },
        { id:'admiss',name:'Ficha de Admissao',                  previewUrl: docUrl('admiss',{ nome:'Patricia Gomes Alves', cpf:'198.076.523-37', num:'FA-2022/0019', emissao:'01/03/2022', cargo:'Assistente Fiscal', mat:'00912', empresa:'SBK Legal Operations' }) },
        { id:'exame', name:'Exame Admissional',                  previewUrl: docUrl('exame', { nome:'Patricia Gomes Alves', cpf:'198.076.523-37', num:'EX-2022/0019', emissao:'25/02/2022', validade:'01/03/2027', cargo:'Assistente Fiscal', empresa:'SBK Legal Operations' }) },
        { id:'resid', name:'Comprovante de Residencia',          previewUrl: docUrl('resid', { nome:'Patricia Gomes Alves', cpf:'198.076.523-37', num:'Conta de Luz - Enel', emissao:'12/05/2025', validade:'30/06/2025' }) },
        { id:'foto',  name:'Foto 3x4',                           previewUrl: docUrl('foto',  { nome:'Patricia Gomes Alves', cpf:'198.076.523-37', cargo:'Assistente Fiscal' }) },
      ],
    },
  ];
}

function seed() {
  const now = Date.now();
  return [
    ...laborDemoSeed(),
    {
      id: 'demo1', ts: now - 86400000 * 10, companyId: 'comp_demo', departmentId: 'dept_rh',
      name: 'Ana Beatriz Souza', cpf: '123.456.789-00', mat: '00541', cargo: 'Analista',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional'],
      missing_req: [], total: 5, req: 5,
    },
  ];
}

const LABOR_DEMO_IDS = new Set(['dl1','dl2','dl3','dl4','dl5','dl6']);

async function getOrSeed() {
  let list = await readData('dossies') || [];
  const existingIds = new Set(list.map(d => d.id));
  const demos = laborDemoSeed();
  const missingDemos = demos.filter(d => !existingIds.has(d.id));
  if (missingDemos.length || !list.length) {
    if (!list.length) list = seed();
    else {
      list = list.filter(d => !LABOR_DEMO_IDS.has(d.id));
      list = [...demos, ...list];
    }
    await writeData('dossies', list.slice(0, 500));
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
