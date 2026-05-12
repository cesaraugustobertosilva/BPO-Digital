/* ── CHECKLIST DATA ──────────────────────────────────────────────── */
const CHECKLIST = [
  { id:'cnh',    name:'CNH / RG / Documento de Identidade', req:true,  checked:false, aiDetected:false, aiReason:'' },
  { id:'cpf',    name:'CPF',                                req:true,  checked:false, aiDetected:false, aiReason:'' },
  { id:'ctrato', name:'Contrato de Trabalho',               req:true,  checked:false, aiDetected:false, aiReason:'' },
  { id:'admiss', name:'Ficha de Admissao',                  req:true,  checked:false, aiDetected:false, aiReason:'' },
  { id:'exame',  name:'Exame Admissional',                  req:true,  checked:false, aiDetected:false, aiReason:'' },
  { id:'resid',  name:'Comprovante de Residencia',          req:false, checked:false, aiDetected:false, aiReason:'' },
  { id:'foto',   name:'Foto 3x4',                           req:false, checked:false, aiDetected:false, aiReason:'' },
];

let docs = [];

/* ── SYSTEM PROMPT ───────────────────────────────────────────────── */
const SYSTEM_PROMPT = `Voce e um assistente especializado em analise de documentos de RH para compliance documental.

Analise o documento ou imagem enviado e responda APENAS em JSON valido, sem nenhum texto extra, com este formato exato:

{
  "tipo_detectado": "nome do tipo de documento detectado",
  "checklist_id": "id do item do checklist que este documento preenche, ou null se nenhum",
  "confianca": "alta | media | baixa",
  "resumo": "resumo em 1 frase curta do que foi encontrado no documento",
  "valido": true,
  "motivo_invalido": null,
  "nome_no_documento": "nome completo da pessoa identificada no documento, ou null se nao encontrado",
  "cpf_no_documento": "CPF encontrado no documento no formato 000.000.000-00, ou null se nao encontrado",
  "multiplas_pessoas": false
}

Os IDs de checklist disponiveis sao:
- "cnh"    -> CNH, RG, Identidade, Passaporte
- "cpf"    -> Documento CPF
- "ctrato" -> Contrato de trabalho, CTPS, Vinculo empregaticio
- "admiss" -> Ficha de admissao, formulario de entrada
- "exame"  -> Exame admissional, atestado medico, laudo medico
- "resid"  -> Comprovante de residencia, conta de luz/agua/gas, extrato bancario com endereco
- "foto"   -> Foto 3x4, foto de perfil profissional

Atencao especial:
- Se o documento contiver dados de MAIS de uma pessoa diferente, defina "multiplas_pessoas": true.
- Extraia o nome e CPF visiveis no documento em "nome_no_documento" e "cpf_no_documento".
- Se o documento nao corresponder a nenhum item da lista, retorne checklist_id como null.`;

/* ── RENDER CHECKLIST ────────────────────────────────────────────── */
let editMode = false;

function renderChecklist() {
  const el = document.getElementById('clist');
  el.innerHTML = CHECKLIST.map(item => {
    const cls   = item.checked ? (item.aiDetected ? 'ai-det' : 'chk') : '';
    const badge = item.aiDetected
      ? '<span class="ibadge bai">IA</span>'
      : (item.req ? '<span class="ibadge breq">Obrigatorio</span>' : '<span class="ibadge bopt">Opcional</span>');
    const reason = item.aiReason
      ? `<div class="cin-reason show">${item.aiReason}</div>`
      : '';

    const toggle = `<div class="req-toggle" onclick="event.stopPropagation()">
      <button class="req-toggle-opt ${item.req ? 'sel-req' : ''}"
        onclick="setReq('${item.id}', true)">Obrigatorio</button>
      <button class="req-toggle-opt ${!item.req ? 'sel-opt' : ''}"
        onclick="setReq('${item.id}', false)">Opcional</button>
    </div>`;

    const editCls = editMode ? 'edit-mode' : '';
    const clickFn = editMode ? '' : `onclick="toggleItem('${item.id}')"`;

    return `<div class="ci ${editCls}" ${clickFn}>
      <div class="cb ${cls}" id="cb_${item.id}"></div>
      <div class="cin" style="flex:1;min-width:0;">
        <div class="cin-name">${item.name}</div>
        ${reason}
        ${badge}
      </div>
      ${toggle}
    </div>`;
  }).join('');
  updateStats();
}

function setReq(id, required) {
  const item = CHECKLIST.find(i => i.id === id);
  if (item) { item.req = required; renderChecklist(); }
}

function toggleEditMode() {
  editMode = !editMode;
  const btn = document.getElementById('editReqBtn');
  const bar = document.getElementById('editModeBar');
  btn.classList.toggle('active', editMode);
  btn.textContent = editMode ? '&#10003; Concluir edicao' : '&#9998; Editar';
  bar.classList.toggle('show', editMode);
  renderChecklist();
}

function toggleItem(id) {
  if (editMode) return;
  const item = CHECKLIST.find(i => i.id === id);
  if (item) {
    item.checked    = !item.checked;
    item.aiDetected = false;
    item.aiReason   = '';
    renderChecklist();
  }
}

/* ── STATS ───────────────────────────────────────────────────────── */
function updateStats() {
  const chk   = CHECKLIST.filter(i => i.checked).length;
  const total = CHECKLIST.length;
  const pct   = Math.round((chk / total) * 100);
  document.getElementById('pbf').style.width   = pct + '%';
  document.getElementById('pinfo').textContent = chk + ' / ' + total;
  document.getElementById('stDet').textContent  = chk;
  document.getElementById('stPend').textContent = total - chk;
  document.getElementById('stDocs').textContent = docs.length;
  const reqOk  = CHECKLIST.filter(i => i.req).every(i => i.checked);
  const hasEmp = document.getElementById('eName').value.trim().length > 2;
  document.getElementById('finBtn').disabled = !(reqOk && hasEmp);
}

/* ── RENDER DOCS ─────────────────────────────────────────────────── */
function renderDocs() {
  const el = document.getElementById('doclist');
  if (!docs.length) {
    el.innerHTML = '<div class="empty">Nenhum documento enviado ainda</div>';
    return;
  }
  const icoMap = { pdf:'&#128196;', jpg:'&#128444;', jpeg:'&#128444;', png:'&#128444;', docx:'&#128221;', doc:'&#128221;', xlsx:'&#128202;' };
  const clsMap = { pdf:'ico-pdf', jpg:'ico-img', jpeg:'ico-img', png:'ico-img', docx:'ico-doc', doc:'ico-doc', xlsx:'ico-xlsx' };
  el.innerHTML = docs.map(d => {
    const ext  = d.name.split('.').pop().toLowerCase();
    const ico  = icoMap[ext] || '&#128206;';
    const cls  = clsMap[ext] || 'ico-doc';
    let statusHtml = '';
    if      (d.status === 'analyzing') statusHtml = `<div class="dstatus s-analyzing"><div class="spin"></div> Analisando com IA...</div>`;
    else if (d.status === 'done')      statusHtml = `<div class="dstatus s-done">&#10003; ${d.result || 'Identificado'}</div>`;
    else                               statusHtml = `<div class="dstatus s-error">&#10007; ${d.error || 'Erro'}</div>`;
    const analysis = d.analysis ? `<div class="danalysis show">${d.analysis}</div>` : '';

    let alertHtml = '';
    if (d.identityAlert) {
      alertHtml = `<div class="id-alert" id="idalert_${d.id}">
        <div class="id-alert-icon">&#9888;</div>
        <div class="id-alert-body">
          <div class="id-alert-title">Inspecao humana necessaria</div>
          <div class="id-alert-msg">${d.identityAlert}</div>
          <div class="id-alert-actions">
            <button class="id-alert-confirm" onclick="confirmIdentity(${d.id})">Confirmar mesmo assim</button>
            <button class="id-alert-remove"  onclick="remDoc(${d.id})">Remover documento</button>
          </div>
        </div>
      </div>`;
    }

    return `<div class="ditem" id="ditem_${d.id}">
      <div class="dico ${cls}">${ico}</div>
      <div class="dmeta" style="flex:1;min-width:0;">
        <div class="dname" title="${d.name}">${d.name}</div>
        ${statusHtml}
        ${analysis}
        ${alertHtml}
      </div>
      <button class="drem" onclick="remDoc(${d.id})" title="Remover">&#215;</button>
    </div>`;
  }).join('');
}

function confirmIdentity(docId) {
  const d = docs.find(x => x.id === docId);
  if (d) { d.identityAlert = null; renderDocs(); }
}

/* ── FILE -> BASE64 ──────────────────────────────────────────────── */
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Erro ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

/* ── AI ANALYSIS ─────────────────────────────────────────────────── */
async function analyzeWithAI(file) {
  const ext     = file.name.split('.').pop().toLowerCase();
  const isImage = ['jpg','jpeg','png'].includes(ext);
  const isPdf   = ext === 'pdf';
  let   messages;

  if (isImage) {
    const b64 = await fileToBase64(file);
    const mt  = ext === 'png' ? 'image/png' : 'image/jpeg';
    messages  = [{ role:'user', content:[
      { type:'image',  source:{ type:'base64', media_type:mt, data:b64 } },
      { type:'text',   text:'Analise este documento de acordo com as instrucoes.' }
    ]}];
  } else if (isPdf) {
    const b64 = await fileToBase64(file);
    messages  = [{ role:'user', content:[
      { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } },
      { type:'text',     text:'Analise este documento de acordo com as instrucoes.' }
    ]}];
  } else {
    const text = await file.text().catch(() => 'Conteudo nao legivel');
    messages   = [{ role:'user', content:`Analise este documento (${file.name}):\n\n${text.substring(0,3000)}` }];
  }

  const resp = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 1000,
      system:     SYSTEM_PROMPT,
      messages,
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  const data  = await resp.json();
  const raw   = data.content?.find(c => c.type === 'text')?.text || '{}';
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/* ── IDENTITY CHECK ──────────────────────────────────────────────── */
function normalizeStr(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();
}

function checkIdentity(result) {
  const empName = normalizeStr(document.getElementById('eName').value);
  const empCpf  = (document.getElementById('eCpf').value || '').replace(/\D/g, '');
  const alerts  = [];

  if (result.multiplas_pessoas) {
    alerts.push('Este documento parece conter dados de mais de uma pessoa.');
  }

  if (result.nome_no_documento && empName.length > 2) {
    const docName   = normalizeStr(result.nome_no_documento);
    const empTokens = empName.split(' ').filter(t => t.length > 2);
    const docTokens = docName.split(' ').filter(t => t.length > 2);
    const hasMatch  = empTokens.some(t => docTokens.includes(t));
    if (!hasMatch) {
      alerts.push(`Nome no documento: "${result.nome_no_documento}" diverge do colaborador cadastrado.`);
    }
  }

  if (result.cpf_no_documento && empCpf.length === 11) {
    const docCpf = result.cpf_no_documento.replace(/\D/g, '');
    if (docCpf.length === 11 && docCpf !== empCpf) {
      alerts.push(`CPF no documento: ${result.cpf_no_documento} diverge do CPF cadastrado.`);
    }
  }

  return alerts.length ? alerts.join(' ') : null;
}

/* ── PROCESS FILES ───────────────────────────────────────────────── */
async function processFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id   = Date.now() + i;
    const doc  = { id, name:file.name, status:'analyzing', result:'', analysis:'', error:'', identityAlert: null };
    docs.push(doc);
    renderDocs();
    toast(`Enviando "${file.name}" para analise IA...`);

    try {
      const result = await analyzeWithAI(file);
      doc.status   = 'done';
      doc.result   = result.tipo_detectado || 'Documento recebido';
      doc.analysis = result.resumo || '';

      const alertMsg = checkIdentity(result);
      if (alertMsg) {
        doc.identityAlert = alertMsg;
        toast(`Alerta de identidade em "${file.name}" inspecao necessaria.`);
      }

      if (result.checklist_id) {
        const item = CHECKLIST.find(i => i.id === result.checklist_id);
        if (item && !item.checked) {
          item.checked    = true;
          item.aiDetected = true;
          item.aiReason   = `IA (${result.confianca}): ${result.resumo}`;
          renderChecklist();
          if (!alertMsg) toast(`Detectado: ${item.name}`);
          document.getElementById('s3').className = 'stp done';
          document.getElementById('sc3').classList.add('done');
          document.getElementById('s4').className = 'stp active';
        }
      } else if (!alertMsg) {
        toast('Documento recebido, nao mapeado ao checklist.');
      }
    } catch (e) {
      doc.status = 'error';
      doc.error  = e.message.substring(0, 60);
      toast(`Erro: ${e.message.substring(0, 55)}`);
    }

    renderDocs();
    updateStats();
  }
}

/* ── CPF MASK ────────────────────────────────────────────────────── */
function mCpf(input) {
  let v = input.value.replace(/\D/g,'').substring(0,11);
  if      (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  input.value = v;
}

/* ── EMPLOYEE CHECK ──────────────────────────────────────────────── */
function chkEmp() {
  const n = document.getElementById('eName').value.trim();
  if (n.length > 2) {
    document.getElementById('s2').className  = 'stp done';
    document.getElementById('s3').className  = 'stp active';
    document.getElementById('sc2').classList.add('done');
  } else {
    document.getElementById('s2').className  = 'stp active';
    document.getElementById('s3').className  = 'stp idle';
    document.getElementById('sc2').classList.remove('done');
  }
  updateStats();
}

/* ── DRAG & DROP / UPLOAD ────────────────────────────────────────── */
function trigUp()    { document.getElementById('fileInput').click(); }
function dOver(e)    { e.preventDefault(); document.getElementById('uzone').classList.add('drag'); }
function dLeave()    { document.getElementById('uzone').classList.remove('drag'); }
function dDrop(e)    { e.preventDefault(); document.getElementById('uzone').classList.remove('drag'); processFiles(Array.from(e.dataTransfer.files)); }
function handleFiles(e) { processFiles(Array.from(e.target.files)); e.target.value = ''; }

/* ── REMOVE DOC ──────────────────────────────────────────────────── */
function remDoc(id) { docs = docs.filter(d => d.id !== id); renderDocs(); updateStats(); }

/* ── TOAST ───────────────────────────────────────────────────────── */
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('tmsg').textContent = msg;
  t.classList.add('vis');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('vis'), 4500);
}

/* ── SWITCH TAB ──────────────────────────────────────────────────── */
function switchTab(el) {
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (!el.textContent.includes('RH')) toast('Modulo "' + el.textContent.trim() + '" em desenvolvimento.');
}

/* ── API: DOSSIES ────────────────────────────────────────────────── */
async function loadDossies() {
  try {
    const resp = await fetch('/api/dossies');
    return resp.ok ? resp.json() : [];
  } catch { return []; }
}

async function saveDossie(entry) {
  await fetch('/api/dossies', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(entry),
  });
}

/* ── IMPORT MODAL ────────────────────────────────────────────────── */
let importedRows = [];

function openImport() {
  importedRows = [];
  document.getElementById('ipreview').classList.remove('show');
  document.getElementById('iApplyBtn').disabled = true;
  document.getElementById('iModalInfo').textContent = 'Nenhum arquivo carregado';
  document.getElementById('ipreviewBody').innerHTML = '';
  document.getElementById('xlsxInput').value = '';
  document.getElementById('importOverlay').classList.add('show');
}

function closeImport() {
  document.getElementById('importOverlay').classList.remove('show');
}

document.getElementById('importOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeImport();
});

function iDragOver(e)  { e.preventDefault(); document.getElementById('izone').classList.add('drag'); }
function iDragLeave()  { document.getElementById('izone').classList.remove('drag'); }
function iDrop(e) {
  e.preventDefault();
  document.getElementById('izone').classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f) processXlsx(f);
}
function handleXlsx(e) {
  const f = e.target.files[0];
  if (f) processXlsx(f);
  e.target.value = '';
}

function processXlsx(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => parseCsvText(e.target.result, file.name);
    reader.readAsText(file, 'UTF-8');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const XLSX = window.XLSX;
      if (!XLSX) { showImportError('SheetJS nao carregado. Use um arquivo .csv.'); return; }
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      parseRows(rows, file.name);
    } catch (err) {
      showImportError('Nao foi possivel ler a planilha: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseCsvText(text, fname) {
  const lines   = text.trim().split(/\r?\n/);
  const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());
  const rows    = lines.slice(1).map(line => {
    const cols = line.split(/[,;]/);
    const obj  = {};
    headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
    return obj;
  }).filter(r => Object.values(r).some(v => v));
  parseRows(rows, fname);
}

function parseRows(rows, fname) {
  if (!rows.length) { showImportError('Planilha vazia ou sem dados.'); return; }

  const nameKey = Object.keys(rows[0]).find(k => /doc|nome|item|descri/i.test(k)) || Object.keys(rows[0])[0];
  const reqKey  = Object.keys(rows[0]).find(k => /obrig|required|req|manda/i.test(k));

  importedRows = rows
    .map(r => ({
      name: String(r[nameKey] || '').trim(),
      req:  reqKey ? /^(s|sim|yes|true|1|x|obr)/i.test(String(r[reqKey] || '').trim()) : true,
    }))
    .filter(r => r.name.length > 0);

  if (!importedRows.length) { showImportError('Nenhum item valido encontrado.'); return; }

  const tbody = document.getElementById('ipreviewBody');
  tbody.innerHTML = importedRows.map((r, i) =>
    `<tr>
      <td style="color:#9aaab8;font-size:11px">${i+1}</td>
      <td>${r.name}</td>
      <td><span class="ipreview-req ${r.req ? 'yes' : 'no'}">${r.req ? '&#9679; Obrigatorio' : '&#9675; Opcional'}</span></td>
    </tr>`
  ).join('');

  document.getElementById('ipreview').classList.add('show');
  document.getElementById('ipreviewLabel').textContent = fname;
  document.getElementById('ipreviewCount').textContent = importedRows.length + ' itens';
  document.getElementById('iModalInfo').innerHTML = `<strong>${importedRows.length} itens</strong> prontos para aplicar`;
  document.getElementById('iApplyBtn').disabled = false;
}

function showImportError(msg) {
  document.getElementById('iModalInfo').textContent = msg;
  document.getElementById('iApplyBtn').disabled = true;
  document.getElementById('ipreview').classList.remove('show');
}

function applyImport() {
  if (!importedRows.length) return;
  CHECKLIST.length = 0;
  importedRows.forEach((r, i) => {
    CHECKLIST.push({ id:'item_'+i, name:r.name, req:r.req, checked:false, aiDetected:false, aiReason:'' });
  });
  renderChecklist();
  closeImport();
  toast(`Checklist atualizado com ${importedRows.length} itens da planilha.`);
}

/* ── FINALIZE ────────────────────────────────────────────────────── */
async function finalize() {
  const name = document.getElementById('eName').value;
  const cpf  = document.getElementById('eCpf').value;
  const mat  = document.getElementById('eMat').value;

  const missingReq = CHECKLIST.filter(i => i.req && !i.checked).map(i => i.name);

  await saveDossie({
    id:          'dossie_' + Date.now(),
    ts:          Date.now(),
    name, cpf, mat,
    docs:        docs.filter(d => d.status === 'done').map(d => d.result || d.name),
    missing_req: missingReq,
    total:       CHECKLIST.filter(i => i.checked).length,
    req:         CHECKLIST.filter(i => i.req && i.checked).length,
  });

  await updateIncBadge();
  document.getElementById('successTitle').textContent = `Dossie de ${name} finalizado!`;
  document.getElementById('successSub').textContent   = `CPF: ${cpf || 'nao informado'}  |  Matricula: ${mat || 'nao informada'}`;
  document.getElementById('successOverlay').classList.add('show');
  document.getElementById('s4').className = 'stp done';
  document.getElementById('sc3').classList.add('done');
}

function closeSuccess() {
  document.getElementById('successOverlay').classList.remove('show');
  docs = [];
  CHECKLIST.forEach(i => { i.checked = false; i.aiDetected = false; i.aiReason = ''; });
  ['eName','eCpf','eMat'].forEach(id => document.getElementById(id).value = '');
  ['s2','s3','s4'].forEach(id => document.getElementById(id).className = id === 's2' ? 'stp active' : 'stp idle');
  ['sc2','sc3'].forEach(id => document.getElementById(id).classList.remove('done'));
  renderChecklist();
  renderDocs();
  updateStats();
}

/* ── INCONSISTENCIES VIEW ────────────────────────────────────────── */
let incFilter = 'all';

async function showIncView() {
  document.getElementById('mainView').classList.add('hidden');
  document.getElementById('incView').classList.add('active');
  await renderIncTable();
}

function hideIncView() {
  document.getElementById('incView').classList.remove('active');
  document.getElementById('mainView').classList.remove('hidden');
}

function setIncFilter(f, el) {
  incFilter = f;
  document.querySelectorAll('.inc-filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderIncTable();
}

function getSeverity(d) {
  const missing = (d.missing_req || []).length;
  if (missing >= 2) return 'critical';
  if (missing === 1) return 'warning';
  return 'ok';
}

async function renderIncTable() {
  const list  = await loadDossies();
  const query = (document.getElementById('incSearchInput')?.value || '').toLowerCase();

  let total = list.length, critical = 0, warning = 0, ok = 0;
  list.forEach(d => {
    const sev = getSeverity(d);
    if (sev === 'critical') critical++;
    else if (sev === 'warning') warning++;
    else ok++;
  });
  document.getElementById('incTotalCount').textContent    = total;
  document.getElementById('incCriticalCount').textContent = critical;
  document.getElementById('incWarningCount').textContent  = warning;
  document.getElementById('incOkCount').textContent       = ok;
  document.getElementById('incBadge').textContent         = critical + warning;

  let filtered = list.filter(d => {
    const sev    = getSeverity(d);
    const matchF = incFilter === 'all' || sev === incFilter;
    const matchQ = !query ||
      d.name.toLowerCase().includes(query) ||
      (d.cpf || '').includes(query);
    return matchF && matchQ;
  });

  const tbody = document.getElementById('incTableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="inc-empty">
        <div class="inc-empty-icon">&#9989;</div>
        Nenhum dossie encontrado para este filtro.
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(d => {
    const sev       = getSeverity(d);
    const initials  = d.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
    const date      = new Date(d.ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
    const missing   = d.missing_req || [];
    const missingHtml = missing.length
      ? missing.map(m => `<span class="inc-missing-tag">${m}</span>`).join('')
      : '<span style="font-size:11px;color:#2a7c3a;font-weight:300;">Nenhum</span>';
    const sevHtml = sev === 'critical'
      ? `<span class="inc-severity sev-critical">&#9940; Critico</span>`
      : sev === 'warning'
      ? `<span class="inc-severity sev-warning">&#9888; Atencao</span>`
      : `<span class="inc-severity sev-ok">&#10003; Completo</span>`;

    return `<tr onclick="toggleDrawer('${d.id}')">
      <td>
        <div class="inc-name-cell">
          <div class="inc-avatar">${initials}</div>
          <div class="inc-name-meta">
            <div class="inc-name-main">${d.name}</div>
            <div class="inc-name-sub">CPF: ${d.cpf||'nao informado'} &middot; Mat.: ${d.mat||'nao informada'}</div>
          </div>
        </div>
      </td>
      <td><div class="inc-missing-list">${missingHtml}</div></td>
      <td>${sevHtml}</td>
      <td><span class="inc-date">${date}</span></td>
      <td><button class="inc-action-btn" onclick="event.stopPropagation(); loadAndGo('${d.id}')">Completar dossie &rarr;</button></td>
    </tr>
    <tr id="drawer_${d.id}" style="background:#f4f7fa;">
      <td colspan="5" style="padding:0;">
        <div class="inc-drawer" id="drawerContent_${d.id}">
          ${buildDrawerContent(d)}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function buildDrawerContent(d) {
  const allItems = [
    {name:'CNH / RG / Documento de Identidade', req:true},
    {name:'CPF', req:true},
    {name:'Contrato de Trabalho', req:true},
    {name:'Ficha de Admissao', req:true},
    {name:'Exame Admissional', req:true},
    {name:'Comprovante de Residencia', req:false},
    {name:'Foto 3x4', req:false},
  ];
  const present = new Set(d.docs || []);
  const missing = new Set(d.missing_req || []);

  const chips = allItems.map(item => {
    const isPresent = present.has(item.name);
    const isMissing = missing.has(item.name);
    const cls  = isPresent ? 'present' : (isMissing ? 'missing' : 'optional');
    const dot  = isPresent ? 'present' : (isMissing ? 'missing' : 'optional');
    const icon = isPresent ? '&#10003;' : (isMissing ? '&#10007;' : '&#9675;');
    return `<div class="inc-doc-chip ${cls}">
      <div class="chip-dot ${dot}"></div>
      <span>${icon} ${item.name}${!item.req?' (opt.)':''}</span>
    </div>`;
  }).join('');

  return `<div class="inc-drawer-title">Situacao detalhada do prontuario</div>
    <div class="inc-drawer-grid">${chips}</div>`;
}

let openDrawerId = null;
function toggleDrawer(id) {
  if (openDrawerId && openDrawerId !== id) {
    const prev = document.getElementById('drawerContent_' + openDrawerId);
    if (prev) prev.classList.remove('open');
  }
  const el = document.getElementById('drawerContent_' + id);
  if (!el) return;
  el.classList.toggle('open');
  openDrawerId = el.classList.contains('open') ? id : null;
}

async function loadAndGo(id) {
  await loadDossie(id);
  hideIncView();
}

async function updateIncBadge() {
  const list  = await loadDossies();
  const count = list.filter(d => (d.missing_req || []).length > 0).length;
  document.getElementById('incBadge').textContent = count;
}

/* ── SEARCH ──────────────────────────────────────────────────────── */
function mCpfS(input) {
  let v = input.value.replace(/\D/g,'').substring(0,11);
  if      (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  input.value = v;
}

function liveSearch() {
  const n = document.getElementById('srchName').value.trim();
  const c = document.getElementById('srchCpf').value.trim();
  const m = document.getElementById('srchMat').value.trim();
  if (!n && !c && !m) { closeSearch(); return; }
  runSearch();
}

async function runSearch() {
  const n = document.getElementById('srchName').value.trim().toLowerCase();
  const c = document.getElementById('srchCpf').value.trim().replace(/\D/g,'');
  const m = document.getElementById('srchMat').value.trim().toLowerCase();
  if (!n && !c && !m) { closeSearch(); return; }

  const list = await loadDossies();
  const hits = list.filter(d => {
    const dn = d.name.toLowerCase();
    const dc = (d.cpf || '').replace(/\D/g,'');
    const dm = (d.mat || '').toLowerCase();
    return (n && dn.includes(n)) || (c && dc.includes(c)) || (m && dm.includes(m));
  });

  renderSearchResults(hits);
}

function renderSearchResults(hits) {
  const wrap  = document.getElementById('srWrap');
  const label = document.getElementById('srLabel');
  const list  = document.getElementById('srList');

  wrap.classList.add('open');
  label.textContent = hits.length
    ? hits.length + (hits.length === 1 ? ' dossie encontrado' : ' dossies encontrados')
    : 'Nenhum resultado';

  if (!hits.length) {
    list.innerHTML = '<div class="sno-results">Nenhum dossie encontrado para esses filtros.</div>';
    return;
  }

  list.innerHTML = hits.map(d => {
    const initials = d.name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const date     = new Date(d.ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
    const badges   = (d.docs || []).slice(0,3).map(b => `<span class="sresult-badge">${b}</span>`).join('');
    const extra    = (d.docs || []).length > 3 ? `<span class="sresult-badge">+${d.docs.length - 3}</span>` : '';
    return `<div class="sresult-item" onclick="loadDossie('${d.id}')">
      <div class="sresult-avatar">${initials}</div>
      <div class="sresult-meta">
        <div class="sresult-name">${d.name}</div>
        <div class="sresult-info">CPF: ${d.cpf || 'nao informado'} &middot; Matricula: ${d.mat || 'nao informada'}</div>
        <div class="sresult-badges">${badges}${extra}</div>
      </div>
      <div class="sresult-date">${date}</div>
      <div class="sresult-arrow">&#8250;</div>
    </div>`;
  }).join('');
}

function closeSearch() {
  document.getElementById('srWrap').classList.remove('open');
}

async function loadDossie(id) {
  const list  = await loadDossies();
  const entry = list.find(d => d.id === id);
  if (!entry) return;
  document.getElementById('eName').value = entry.name;
  document.getElementById('eCpf').value  = entry.cpf || '';
  document.getElementById('eMat').value  = entry.mat || '';
  closeSearch();
  ['srchName','srchCpf','srchMat'].forEach(f => document.getElementById(f).value = '');
  chkEmp();
  toast(`Dossie de ${entry.name} carregado. Voce pode adicionar novos documentos.`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── INIT ────────────────────────────────────────────────────────── */
renderChecklist();
renderDocs();
updateIncBadge();
