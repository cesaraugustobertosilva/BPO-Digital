/* ── CONFIRM RESULT MODAL ────────────────────────────────────────── */
function showCrf(ok, title, body, detail) {
  gel('crfIcon').textContent  = ok ? '✓' : '✗';
  gel('crfIcon').className    = 'crf-icon ' + (ok ? 'crf-ok' : 'crf-err');
  gel('crfTitle').textContent = title;
  gel('crfBody').textContent  = body;
  const detEl = gel('crfDetail');
  if (detail) { detEl.textContent = detail; detEl.classList.remove('hidden'); }
  else detEl.classList.add('hidden');
  gel('crfOverlay').classList.remove('hidden');
}
function closeCrf() { gel('crfOverlay').classList.add('hidden'); }

/* ── AUTH ────────────────────────────────────────────────────────── */
const AUTH = {
  token: localStorage.getItem('sbk_token') || null,
  user:  null,
};

function authHdr() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (AUTH.token || ''),
  };
}

async function apiFetch(url, opts = {}) {
  const resp = await fetch(url, { ...opts, headers: { ...authHdr(), ...(opts.headers || {}) } });
  if (resp.status === 401) { doLogout(true); return null; }
  return resp;
}

async function doLogin() {
  const username = gel('loginUser').value.trim();
  const password = gel('loginPass').value;
  const errEl    = gel('loginError');
  const btn      = gel('loginBtn');
  errEl.classList.add('hidden');
  if (!username || !password) { errEl.textContent = 'Preencha usuario e senha.'; errEl.classList.remove('hidden'); return; }
  btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await resp.json();
    if (!resp.ok) { errEl.textContent = data.error || 'Credenciais invalidas.'; errEl.classList.remove('hidden'); return; }
    AUTH.token = data.token;
    AUTH.user  = data.user;
    localStorage.setItem('sbk_token', data.token);
    hideLogin();
    setupFromUser(data.user);
  } catch (e) {
    errEl.textContent = 'Erro de conexao. Tente novamente.'; errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

function doLogout(silent = false) {
  AUTH.token = null; AUTH.user = null;
  localStorage.removeItem('sbk_token');
  STATE.profile = null; STATE.company = null; STATE.department = null;
  gel('userWidget').classList.add('hidden');
  gel('ntIncPill').classList.add('hidden');
  gel('ctxBar').classList.add('hidden');
  showLogin();
  if (!silent) fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

function showLogin() {
  const ov = gel('loginOverlay');
  ov.classList.remove('hidden');
  ov.style.display = '';
  gel('loginUser').value = '';
  gel('loginPass').value = '';
  gel('loginError').classList.add('hidden');
  gel('loginBtn').disabled = false;
  gel('loginBtn').textContent = 'Entrar';
  setTimeout(() => gel('loginUser').focus(), 100);
}

function hideLogin() {
  gel('loginOverlay').style.display = 'none';
}

async function setupFromUser(user) {
  AUTH.user = user;
  const roleLabels = { admin: 'Administrador', multicompany: 'Gestao de Multiplas Empresas', company: 'Gestao de Empresa', department: 'Departamental' };
  gel('userName').textContent  = user.name;
  gel('userRole').textContent  = roleLabels[user.role] || user.role;
  gel('userAvatar').textContent = user.name.charAt(0).toUpperCase();
  gel('userWidget').classList.remove('hidden');
  setupNavModules();

  STATE.profile = user.role;

  if (user.role === 'admin') {
    STATE.company    = null;
    STATE.department = null;
    updateContextBar();
    enterAdminView();
    return;
  }

  if (user.role === 'multicompany') {
    STATE.company    = null;
    STATE.department = null;
    updateContextBar();
    enterMultiCompanyView();
    return;
  }

  // Load company data for company/department users
  if (user.companyId) {
    const companies = await apiGetCompanies();
    STATE.company = companies.find(c => c.id === user.companyId) || null;
  }

  if (user.role === 'department' && user.departmentId && STATE.company) {
    STATE.department = STATE.company.departments.find(d => d.id === user.departmentId) || null;
    resetChecklistFromDept();
  }

  updateContextBar();

  if (user.role === 'company') {
    if (!STATE.company) {
      toast('Sua conta nao esta vinculada a nenhuma empresa. Contate o administrador.');
      doLogout(); return;
    }
    enterCompanyView(); return;
  }
  if (user.role === 'department') {
    if (!STATE.company || !STATE.department) {
      toast('Sua conta nao esta vinculada a um departamento valido. Contate o administrador.');
      doLogout(); return;
    }
    enterDeptView(); return;
  }
}

/* ── MODULE NAV FILTER ───────────────────────────────────────────── */
const ALL_MODULES = ['rh','trabalhista','nf','contratos','documentos'];

function setupNavModules() {
  const mods = AUTH.user?.modules;
  // empty or undefined = all modules allowed
  if (!mods || !mods.length) {
    document.querySelectorAll('.nt[data-mod]').forEach(el => el.classList.remove('hidden'));
    return;
  }
  document.querySelectorAll('.nt[data-mod]').forEach(el => {
    el.classList.toggle('hidden', !mods.includes(el.dataset.mod));
  });
}

async function initApp() {
  if (!AUTH.token) { showLogin(); return; }
  try {
    const resp = await fetch('/api/auth/me', { headers: authHdr() });
    if (!resp.ok) { AUTH.token = null; localStorage.removeItem('sbk_token'); showLogin(); return; }
    const user = await resp.json();
    hideLogin();
    await setupFromUser(user);
  } catch { showLogin(); }
}

/* ── DEFAULT CHECKLIST ───────────────────────────────────────────── */
const DEFAULT_CHECKLIST = [
  { id:'cnh',    name:'CNH / RG / Documento de Identidade', req:true  },
  { id:'cpf',    name:'CPF',                                req:true  },
  { id:'ctrato', name:'Contrato de Trabalho',               req:true  },
  { id:'admiss', name:'Ficha de Admissao',                  req:true  },
  { id:'exame',  name:'Exame Admissional',                  req:true  },
  { id:'resid',  name:'Comprovante de Residencia',          req:false },
  { id:'foto',   name:'Foto 3x4',                           req:false },
];

let CHECKLIST = DEFAULT_CHECKLIST.map(c => ({ ...c, checked:false, aiDetected:false, aiReason:'' }));
let docs = [];

/* ── APP STATE ───────────────────────────────────────────────────── */
const STATE = {
  profile:    null,  // 'admin' | 'company' | 'department'
  company:    null,  // { id, name, departments[] }
  department: null,  // { id, name, checklist[] }
};

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

/* ── HELPERS ─────────────────────────────────────────────────────── */
const gel = id => document.getElementById(id);

function resetChecklistFromDept() {
  const tpl = STATE.department?.checklist || DEFAULT_CHECKLIST;
  CHECKLIST.length = 0;
  tpl.forEach(c => CHECKLIST.push({ ...c, checked:false, aiDetected:false, aiReason:'' }));
}

/* ── VIEW CONTROL ────────────────────────────────────────────────── */
function showView(name) {
  ['mainView','incView','adminView','companyView','multiCompanyView','trabalhistaView','nfView','contratosView','painelView'].forEach(id => {
    const e = gel(id);
    if (e) { e.classList.add('hidden'); e.classList.remove('active'); }
  });
  const nav = gel('mainNav');
  if (['main','inc','trabalhista','nf','contratos','painel'].includes(name)) nav?.classList.remove('hidden');
  else nav?.classList.add('hidden');

  const idMap = { main:'mainView', inc:'incView', admin:'adminView', multiCompanyView:'multiCompanyView', trabalhista:'trabalhistaView', nf:'nfView', contratos:'contratosView', painel:'painelView' };
  const target = gel(idMap[name] || 'companyView');
  if (target) { target.classList.remove('hidden'); if (name === 'inc') target.classList.add('active'); }

  gel('ntLabor')?.classList.toggle('active', name === 'trabalhista');
  gel('ntRH')?.classList.toggle('active', name === 'main');
  gel('ntPainel')?.classList.toggle('active', name === 'painel');
}

function updateContextBar() {
  const bar = gel('ctxBar');
  if (!STATE.profile) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const compEl = gel('ctxCompany');
  const sepEl  = gel('ctxSep');
  const deptEl = gel('ctxDept');
  if (STATE.profile === 'admin') {
    compEl.textContent = 'Administrador';
    sepEl.classList.add('hidden'); deptEl.classList.add('hidden');
    return;
  }
  if (STATE.profile === 'multicompany' && !STATE.company) {
    compEl.textContent = 'Multiplas Empresas';
    compEl.style.cursor = ''; compEl.title = ''; compEl.onclick = null;
    sepEl.classList.add('hidden'); deptEl.classList.add('hidden');
    return;
  }
  compEl.textContent = STATE.company?.name || '';
  if (STATE.department) {
    sepEl.classList.remove('hidden'); deptEl.classList.remove('hidden');
    deptEl.textContent = STATE.department.name;
    // Nome da empresa vira link de volta ao painel de departamentos
    compEl.style.cursor = 'pointer';
    compEl.title = 'Voltar a visao da empresa';
    compEl.onclick = () => { STATE.department = null; updateContextBar(); enterCompanyView(); };
  } else {
    sepEl.classList.add('hidden'); deptEl.classList.add('hidden');
    compEl.style.cursor = '';
    compEl.title = '';
    compEl.onclick = null;
  }
}

/* ── STARTUP FLOW ────────────────────────────────────────────────── */
function showStartup() {
  const ov = gel('suOverlay');
  ov.classList.remove('hidden');
  ov.style.display = '';
  suGoStep('profile');
}

function hideStartup() {
  const ov = gel('suOverlay');
  ov.style.display = 'none';
}

function suGoStep(step) {
  ['suStepProfile','suStepCompany','suStepDept'].forEach(id => gel(id).classList.add('hidden'));
  const map = { profile:'suStepProfile', company:'suStepCompany', dept:'suStepDept' };
  gel(map[step]).classList.remove('hidden');
  const subs = {
    profile: 'Selecione seu perfil de acesso para continuar',
    company: 'Selecione a empresa',
    dept:    'Selecione o departamento',
  };
  gel('suSub').textContent = subs[step];
}

function suBack(step) { suGoStep(step); }

async function selectProfile(profile) {
  STATE.profile = profile; STATE.company = null; STATE.department = null;
  if (profile === 'admin') {
    hideStartup(); updateContextBar(); enterAdminView(); return;
  }
  const companies = await apiGetCompanies();
  renderSuCompanyGrid(companies);
  suGoStep('company');
}

function renderSuCompanyGrid(companies) {
  const grid = gel('suCompanyGrid');
  if (!companies.length) {
    grid.innerHTML = '<div style="color:#6b7280;font-size:13px;text-align:center;padding:16px;">Nenhuma empresa cadastrada.</div>';
    return;
  }
  grid.innerHTML = companies.map(c => {
    const safe = encodeURIComponent(JSON.stringify(c));
    return `<div class="su-company-card" onclick="selectCompany(decodeURIComponent('${safe}'))">
      <div class="su-cc-ico">&#127970;</div>
      <div><div class="su-cc-name">${c.name}</div>
      <div class="su-cc-sub">${c.departments.length} departamento${c.departments.length !== 1 ? 's' : ''}</div></div>
    </div>`;
  }).join('');
}

function selectCompany(companyJson) {
  STATE.company = JSON.parse(typeof companyJson === 'string' ? companyJson : JSON.stringify(companyJson));
  if (STATE.profile === 'company') { hideStartup(); updateContextBar(); enterCompanyView(); return; }
  renderSuDeptGrid(STATE.company.departments);
  suGoStep('dept');
}

function renderSuDeptGrid(departments) {
  const grid = gel('suDeptGrid');
  if (!departments.length) {
    grid.innerHTML = '<div style="color:#6b7280;font-size:13px;text-align:center;padding:16px;">Nenhum departamento. Contate o administrador.</div>';
    return;
  }
  grid.innerHTML = departments.map(d => {
    const safe = encodeURIComponent(JSON.stringify(d));
    return `<div class="su-dept-card" onclick="selectDepartment(decodeURIComponent('${safe}'))">
      <div class="su-dc-ico">&#128101;</div>
      <div class="su-dc-name">${d.name}</div>
    </div>`;
  }).join('');
}

function selectDepartment(deptJson) {
  STATE.department = JSON.parse(typeof deptJson === 'string' ? deptJson : JSON.stringify(deptJson));
  resetChecklistFromDept();
  hideStartup(); updateContextBar(); enterDeptView();
}

function suPromptNewCompany() {
  openPrompt('Nome da empresa', 'Ex.: Acme Legal', async name => {
    const c = await apiPostCompany(name);
    if (c?.id) {
      toast('Empresa "' + c.name + '" criada.');
      renderSuCompanyGrid(await apiGetCompanies());
    }
  });
}

/* ── ENTER VIEWS ─────────────────────────────────────────────────── */
function enterAdminView()   { showView('admin');   renderAdminPanel(); }
function enterCompanyView() {
  showView('company');
  // Update back button for admin (goes back to panel) vs company user (logs out)
  const backBtn = gel('cvBackBtn');
  if (backBtn) {
    const role = AUTH.user?.role;
    if (role === 'admin') backBtn.textContent = '← Painel Admin';
    else if (role === 'multicompany') backBtn.textContent = '← Selecionar Empresa';
    else backBtn.textContent = '→ Sair';
  }
  renderCompanyView();
}
function enterDeptView() {
  showView('main');
  const cfgBtn = gel('cfgClBtn');
  if (cfgBtn) cfgBtn.classList.remove('hidden');
  const ctxSwitch = gel('ctxSwitch');
  if (ctxSwitch) {
    if (AUTH.user?.role === 'admin') {
      ctxSwitch.textContent = '← Painel Admin';
      ctxSwitch.onclick = () => { STATE.department = null; STATE.company = null; updateContextBar(); enterAdminView(); };
    } else if (STATE.company) {
      ctxSwitch.textContent = '← Trocar departamento';
      ctxSwitch.onclick = () => { STATE.department = null; updateContextBar(); enterCompanyView(); };
    } else {
      ctxSwitch.textContent = 'Sair';
      ctxSwitch.onclick = () => doLogout();
    }
  }
  renderChecklist(); renderDocs(); updateIncBadge();
  renderIndexedDossies();
}

async function enterMultiCompanyView() {
  showView('multiCompanyView');
  const grid = gel('mcCompanyGrid');
  grid.innerHTML = '<div class="adm-empty">Carregando...</div>';
  const all = await apiGetCompanies();
  const allowed = AUTH.user?.allowedCompanies || [];
  const companies = allowed.length ? all.filter(c => allowed.includes(c.id)) : all;
  if (!companies.length) {
    grid.innerHTML = '<div class="adm-empty">Nenhuma empresa disponivel. Contate o administrador.</div>';
    return;
  }
  grid.innerHTML = companies.map(c => {
    const safe = encodeURIComponent(JSON.stringify(c));
    return `<div class="su-company-card" onclick="mcSelectCompany(decodeURIComponent('${safe}'))">
      <div class="su-cc-ico">&#127970;</div>
      <div>
        <div class="su-cc-name">${c.name}</div>
        <div class="su-cc-sub">${c.departments.length} departamento${c.departments.length !== 1 ? 's' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function mcSelectCompany(companyJson) {
  STATE.company = JSON.parse(typeof companyJson === 'string' ? companyJson : JSON.stringify(companyJson));
  STATE.department = null;
  updateContextBar();
  enterCompanyView();
}

/* ── API: COMPANIES ──────────────────────────────────────────────── */
async function apiGetCompanies() {
  try { const r = await apiFetch('/api/companies'); if (!r) return []; return r.ok ? r.json() : []; } catch { return []; }
}
async function apiPostCompany(name) {
  const r = await apiFetch('/api/companies', { method:'POST', body:JSON.stringify({name}) });
  if (!r) throw new Error('Sem resposta do servidor.');
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  return r.json();
}
async function apiPostDept(companyId, name) {
  const r = await apiFetch(`/api/companies/${companyId}/departments`, { method:'POST', body:JSON.stringify({name}) });
  if (!r) throw new Error('Sem resposta do servidor.');
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  return r.json();
}
async function apiPutDept(companyId, deptId, data) {
  try {
    const r = await apiFetch(`/api/companies/${companyId}/departments/${deptId}`, { method:'PUT', body:JSON.stringify(data) });
    if (!r) return null;
    return r.ok ? r.json() : null;
  } catch { return null; }
}
async function apiDeleteCompany(id) {
  try { await apiFetch('/api/companies/' + id, { method:'DELETE' }); } catch {}
}
async function apiDeleteDept(companyId, deptId) {
  try { await apiFetch(`/api/companies/${companyId}/departments/${deptId}`, { method:'DELETE' }); } catch {}
}

/* ── ADMIN PANEL ─────────────────────────────────────────────────── */
let adminSelCompany = null;

async function renderAdminPanel() {
  const companies = await apiGetCompanies();
  renderAdminCompanies(companies);
  adminSelCompany = null;
  gel('adminDeptList').innerHTML = '<div class="adm-empty">Selecione uma empresa</div>';
  gel('adminNewDeptBtn').disabled = true;
  renderStorageStatus();
}

async function renderStorageStatus() {
  const el = gel('admStorageStatus');
  if (!el) return;
  try {
    const r = await apiFetch('/api/status');
    if (!r || !r.ok) { el.innerHTML = ''; return; }
    const { storage } = await r.json();
    const icons = { upstash: '&#9729;', github: '&#128200;', local: '&#128193;' };
    const labels = { upstash: 'Upstash Redis', github: 'GitHub Contents', local: 'Filesystem local' };
    const ok = !storage.volatile;
    el.innerHTML = `<div class="adm-storage-badge ${ok ? 'adm-storage-ok' : 'adm-storage-warn'}">
      ${icons[storage.backend] || ''} Storage: <strong>${labels[storage.backend] || storage.backend}</strong>
      ${storage.volatile ? ' &mdash; DADOS NAO PERSISTIDOS (configure Upstash no Vercel)' : ' &mdash; Persistencia ativa'}
    </div>`;
  } catch { el.innerHTML = ''; }
}

function renderAdminCompanies(companies) {
  const list = gel('adminCompanyList');
  if (!companies.length) {
    list.innerHTML = `<div class="adm-empty-state">
      <div class="adm-empty-icon">&#127970;</div>
      <div class="adm-empty-msg">Nenhuma empresa cadastrada.</div>
      <div class="adm-empty-hint">Clique em <strong>+ Adicionar</strong> para criar a primeira empresa.</div>
    </div>`;
    return;
  }
  list.innerHTML = companies.map(c => {
    const sel  = adminSelCompany?.id === c.id ? 'sel' : '';
    const safe = encodeURIComponent(JSON.stringify(c));
    return `<div class="adm-item ${sel}" onclick="adminSelectCompany(decodeURIComponent('${safe}'))">
      <div class="adm-item-ico">&#127970;</div>
      <div class="adm-item-name">${c.name}</div>
      <button class="adm-rename-btn" onclick="event.stopPropagation();adminRenameCompany('${c.id}','${encodeURIComponent(c.name)}')" title="Renomear">&#9998;</button>
      <button class="adm-view-btn"   onclick="event.stopPropagation();adminViewCompany(decodeURIComponent('${safe}'))" title="Visualizar empresa">&#128065;</button>
      <button class="adm-del-btn"    onclick="event.stopPropagation();adminDeleteCompany('${c.id}')" title="Excluir">&#215;</button>
    </div>`;
  }).join('');
}

function adminSelectCompany(json) {
  adminSelCompany = JSON.parse(json);
  gel('adminNewDeptBtn').disabled = false;
  renderAdminDepts(adminSelCompany);
  apiGetCompanies().then(renderAdminCompanies);
}

function renderAdminDepts(company) {
  const list = gel('adminDeptList');
  if (!company.departments.length) {
    list.innerHTML = `<div class="adm-empty-state">
      <div class="adm-empty-icon">&#128101;</div>
      <div class="adm-empty-msg">Nenhum departamento em <strong>${company.name}</strong>.</div>
      <div class="adm-empty-hint">Clique em <strong>+ Adicionar</strong> para criar o primeiro departamento.</div>
    </div>`;
    return;
  }
  const safeC = encodeURIComponent(JSON.stringify(company));
  list.innerHTML = company.departments.map(d => {
    const safeD = encodeURIComponent(JSON.stringify(d));
    return `<div class="adm-item">
      <div class="adm-item-ico">&#128101;</div>
      <div class="adm-item-name">${d.name}</div>
      <button class="adm-rename-btn" onclick="adminRenameDept('${company.id}','${d.id}','${encodeURIComponent(d.name)}')" title="Renomear">&#9998;</button>
      <button class="adm-view-btn"   onclick="adminViewDept(decodeURIComponent('${safeC}'), decodeURIComponent('${safeD}'))" title="Visualizar departamento">&#128065;</button>
      <button class="adm-del-btn"    onclick="adminDeleteDept('${company.id}','${d.id}')" title="Excluir">&#215;</button>
    </div>`;
  }).join('');
}

function adminNewCompany() {
  openPrompt('Nome da empresa', 'Ex.: Acme Legal', async name => {
    const btn = gel('promptOkBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    try {
      const c = await apiPostCompany(name);
      await renderAdminPanel();
      showCrf(true, 'Empresa cadastrada', '"' + c.name + '" foi salva com sucesso no storage (' + (await getBackendLabel()) + ').');
    } catch (e) {
      showCrf(false, 'Erro ao salvar empresa', 'O cadastro nao foi persistido.', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Confirmar'; }
    }
  });
}

function adminRenameCompany(id, encodedName) {
  const current = decodeURIComponent(encodedName);
  openPrompt('Renomear empresa', current, async name => {
    if (!name || name === current) return;
    try {
      const r = await apiFetch(`/api/companies/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
      if (!r || !r.ok) {
        const err = await r?.json().catch(() => ({}));
        showCrf(false, 'Erro ao renomear', 'Nao foi possivel salvar o novo nome.', err?.error || `HTTP ${r?.status}`); return;
      }
      const companies = await apiGetCompanies();
      if (adminSelCompany?.id === id) adminSelCompany = companies.find(c => c.id === id);
      renderAdminCompanies(companies);
      showCrf(true, 'Empresa renomeada', 'Nome atualizado para "' + name + '".');
    } catch (e) { showCrf(false, 'Erro', 'Nao foi possivel renomear.', e.message); }
  });
}

function adminRenameDept(companyId, deptId, encodedName) {
  const current = decodeURIComponent(encodedName);
  openPrompt('Renomear departamento', current, async name => {
    if (!name || name === current) return;
    try {
      const r = await apiFetch(`/api/companies/${companyId}/departments/${deptId}`, { method: 'PUT', body: JSON.stringify({ name }) });
      if (!r || !r.ok) {
        const err = await r?.json().catch(() => ({}));
        showCrf(false, 'Erro ao renomear', 'Nao foi possivel salvar o novo nome.', err?.error || `HTTP ${r?.status}`); return;
      }
      const companies = await apiGetCompanies();
      adminSelCompany = companies.find(c => c.id === companyId);
      if (adminSelCompany) renderAdminDepts(adminSelCompany);
      renderAdminCompanies(companies);
      showCrf(true, 'Departamento renomeado', 'Nome atualizado para "' + name + '".');
    } catch (e) { showCrf(false, 'Erro', 'Nao foi possivel renomear.', e.message); }
  });
}

function adminNewDept() {
  if (!adminSelCompany) return;
  openPrompt('Nome do departamento', 'Ex.: Recursos Humanos', async name => {
    const btn = gel('promptOkBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    try {
      const d = await apiPostDept(adminSelCompany.id, name);
      const companies = await apiGetCompanies();
      adminSelCompany = companies.find(c => c.id === adminSelCompany.id);
      if (adminSelCompany) { renderAdminDepts(adminSelCompany); renderAdminCompanies(companies); }
      showCrf(true, 'Departamento cadastrado', '"' + d.name + '" foi salvo com sucesso.');
    } catch (e) {
      showCrf(false, 'Erro ao salvar departamento', 'O cadastro nao foi persistido.', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Confirmar'; }
    }
  });
}

async function getBackendLabel() {
  try {
    const r = await apiFetch('/api/status');
    if (!r || !r.ok) return 'storage';
    const { storage } = await r.json();
    return { upstash: 'Upstash Redis', github: 'GitHub', local: 'local' }[storage.backend] || storage.backend;
  } catch { return 'storage'; }
}

async function adminDeleteCompany(id) {
  if (!confirm('Excluir esta empresa? Todos os departamentos serao removidos.')) return;
  await apiDeleteCompany(id); toast('Empresa excluida.'); renderAdminPanel();
}

async function adminDeleteDept(companyId, deptId) {
  if (!confirm('Excluir este departamento?')) return;
  await apiDeleteDept(companyId, deptId);
  toast('Departamento excluido.');
  const companies = await apiGetCompanies();
  adminSelCompany = companies.find(c => c.id === companyId);
  if (adminSelCompany) { renderAdminDepts(adminSelCompany); renderAdminCompanies(companies); }
}

async function adminViewCompany(companyJson) {
  STATE.company    = JSON.parse(companyJson);
  STATE.department = null;
  updateContextBar();
  enterCompanyView();
}

function adminViewDept(coJson, deptJson) {
  STATE.company    = JSON.parse(coJson);
  STATE.department = JSON.parse(deptJson);
  resetChecklistFromDept();
  updateContextBar();
  enterDeptView();
}

function goBackFromCompanyView() {
  const role = AUTH.user?.role;
  if (role === 'admin') {
    STATE.company = null; STATE.department = null;
    updateContextBar(); enterAdminView();
  } else if (role === 'multicompany') {
    STATE.company = null; STATE.department = null;
    updateContextBar(); enterMultiCompanyView();
  } else {
    doLogout();
  }
}

/* ── COMPANY VIEW ────────────────────────────────────────────────── */
async function renderCompanyView() {
  gel('cvTitle').textContent = STATE.company?.name || 'Empresa';
  await renderCvDeptCards();
}

async function renderCvDeptCards() {
  const grid  = gel('cvDeptGrid');
  const depts = STATE.company?.departments || [];
  if (!depts.length) {
    grid.innerHTML = '<div class="adm-empty">Nenhum departamento. Clique em "+ Novo departamento".</div>';
    return;
  }
  grid.innerHTML = '<div class="adm-empty">Carregando...</div>';
  const _r1 = await apiFetch('/api/dossies?companyId=' + STATE.company.id);
  const all  = _r1 ? await _r1.json().catch(() => []) : [];
  grid.innerHTML = depts.map(d => {
    const dossies  = all.filter(x => x.departmentId === d.id);
    const critical = dossies.filter(x => (x.missing_req||[]).length >= 2).length;
    const warning  = dossies.filter(x => (x.missing_req||[]).length === 1).length;
    const ok       = dossies.filter(x => (x.missing_req||[]).length === 0).length;
    const safe     = encodeURIComponent(JSON.stringify(d));
    return `<div class="cv-dept-card" onclick="cvEnterDept(decodeURIComponent('${safe}'))">
      <div class="cv-dc-head"><div class="cv-dc-ico">&#128101;</div><div class="cv-dc-name">${d.name}</div></div>
      <div class="cv-dc-stats">
        <div class="cv-dc-stat"><span class="cv-stat-val">${dossies.length}</span><span class="cv-stat-lbl">Dossies</span></div>
        <div class="cv-dc-stat"><span class="cv-stat-val red">${critical}</span><span class="cv-stat-lbl">Criticos</span></div>
        <div class="cv-dc-stat"><span class="cv-stat-val amber">${warning}</span><span class="cv-stat-lbl">Atencao</span></div>
        <div class="cv-dc-stat"><span class="cv-stat-val green">${ok}</span><span class="cv-stat-lbl">Completos</span></div>
      </div>
      <div class="cv-dc-footer">Acessar departamento &rarr;</div>
    </div>`;
  }).join('');
}

function cvEnterDept(json) {
  STATE.department = JSON.parse(json);
  resetChecklistFromDept(); updateContextBar(); enterDeptView();
}

function cvNewDept() {
  openPrompt('Nome do departamento', 'Ex.: Financeiro', async name => {
    try {
      const d = await apiPostDept(STATE.company.id, name);
      const companies = await apiGetCompanies();
      STATE.company = companies.find(c => c.id === STATE.company.id);
      toast('Departamento "' + d.name + '" criado.'); renderCvDeptCards();
    } catch (e) {
      showCrf(false, 'Erro ao salvar departamento', 'O cadastro nao foi persistido.', e.message);
    }
  });
}

async function cvLiveSearch() {
  const n = gel('cvSrchName').value.trim();
  const c = gel('cvSrchCpf').value.trim();
  const m = gel('cvSrchMat').value.trim();
  if (!n && !c && !m) { gel('cvSrWrap').classList.remove('open'); return; }
  await cvRunSearch();
}

async function cvRunSearch() {
  const n   = gel('cvSrchName').value.trim().toLowerCase();
  const c   = gel('cvSrchCpf').value.trim().replace(/\D/g,'');
  const m   = gel('cvSrchMat').value.trim().toLowerCase();
  if (!n && !c && !m) { gel('cvSrWrap').classList.remove('open'); return; }
  const _r2 = await apiFetch('/api/dossies?companyId=' + STATE.company.id);
  const all  = _r2 ? await _r2.json().catch(() => []) : [];
  const hits = all.filter(d => {
    return (n && d.name.toLowerCase().includes(n)) ||
           (c && (d.cpf||'').replace(/\D/g,'').includes(c)) ||
           (m && (d.mat||'').toLowerCase().includes(m));
  });
  const wrap = gel('cvSrWrap'); wrap.classList.add('open');
  gel('cvSrLabel').textContent = hits.length ? hits.length + ' dossie(s) encontrado(s)' : 'Nenhum resultado';
  gel('cvSrList').innerHTML = hits.length ? hits.map(d => {
    const initials = d.name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const date     = new Date(d.ts).toLocaleDateString('pt-BR', {day:'2-digit',month:'short',year:'numeric'});
    const dept     = STATE.company?.departments?.find(dep => dep.id === d.departmentId)?.name || '';
    return `<div class="sresult-item" onclick="cvLoadDossie('${d.id}')">
      <div class="sresult-avatar">${initials}</div>
      <div class="sresult-meta">
        <div class="sresult-name">${d.name}</div>
        <div class="sresult-info">CPF: ${d.cpf||'nao informado'} &middot; ${dept}</div>
      </div>
      <div class="sresult-date">${date}</div>
      <div class="sresult-arrow">&#8250;</div>
    </div>`;
  }).join('') : '<div class="sno-results">Nenhum dossie encontrado.</div>';
}

async function cvLoadDossie(id) {
  const resp  = await apiFetch('/api/dossies/' + id);
  const entry = resp?.ok ? await resp.json() : null;
  if (!entry) return;
  const dept = STATE.company?.departments?.find(d => d.id === entry.departmentId);
  if (dept) { STATE.department = dept; resetChecklistFromDept(); updateContextBar(); }
  gel('cvSrWrap').classList.remove('open');
  enterDeptView();
  gel('eName').value = entry.name;
  gel('eCpf').value  = entry.cpf || '';
  gel('eMat').value  = entry.mat || '';
  chkEmp();
  toast('Dossie de ' + entry.name + ' carregado.');
}

/* ── CHECKLIST EDITOR ────────────────────────────────────────────── */
let cleItems = [];

function openClEditor() {
  if (!STATE.department) return;
  cleItems = (STATE.department.checklist || DEFAULT_CHECKLIST).map(c => ({...c}));
  renderClEditor();
  gel('clEditorOverlay').classList.remove('hidden');
}

function closeClEditor() { gel('clEditorOverlay').classList.add('hidden'); }

function renderClEditor() {
  gel('cleList').innerHTML = cleItems.map((item, i) =>
    `<div class="cle-item">
      <input class="cle-name-input" value="${item.name.replace(/"/g,'&quot;')}"
        oninput="cleItems[${i}].name = this.value" placeholder="Nome do documento">
      <label class="cle-req-toggle">
        <input type="checkbox" ${item.req ? 'checked' : ''} onchange="cleItems[${i}].req = this.checked">
        <span>Obrigatorio</span>
      </label>
      <button class="cle-del-btn" onclick="cleRemoveItem(${i})">&#215;</button>
    </div>`
  ).join('');
}

function cleRemoveItem(i) { cleItems.splice(i, 1); renderClEditor(); }

function cleAddItem() {
  cleItems.push({ id:'item_' + Date.now(), name:'', req:true });
  renderClEditor();
  const inputs = gel('cleList').querySelectorAll('.cle-name-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

async function saveClEditor() {
  const valid = cleItems.filter(c => c.name.trim().length > 0);
  if (!valid.length) { toast('Adicione ao menos um item ao checklist.'); return; }
  const updated = await apiPutDept(STATE.company.id, STATE.department.id, { checklist: valid });
  if (updated) {
    STATE.department = updated;
    const idx = STATE.company.departments.findIndex(d => d.id === updated.id);
    if (idx >= 0) STATE.company.departments[idx] = updated;
    resetChecklistFromDept(); renderChecklist(); closeClEditor();
    renderIndexedDossies();
    const dossies  = await loadDossies();
    const pending  = dossies.filter(d => (d.missing_req || []).length > 0).length;
    if (pending > 0) {
      toast(`Checklist atualizado. ${pending} prontuario${pending !== 1 ? 's' : ''} com documentos pendentes.`);
    } else {
      toast('Checklist do departamento atualizado.');
    }
  }
}

/* ── GENERIC PROMPT ──────────────────────────────────────────────── */
let promptCb = null;

function openPrompt(title, placeholder, cb) {
  gel('promptTitle').textContent = title;
  gel('promptInput').placeholder = placeholder;
  gel('promptInput').value = '';
  promptCb = cb;
  gel('promptOverlay').classList.remove('hidden');
  setTimeout(() => gel('promptInput').focus(), 50);
}

function closePrompt() { gel('promptOverlay').classList.add('hidden'); promptCb = null; }
function confirmPrompt() {
  const val = gel('promptInput').value.trim();
  if (!val) return;
  const cb = promptCb;
  closePrompt();
  if (cb) cb(val);
}

document.addEventListener('keydown', e => {
  if (!gel('promptOverlay').classList.contains('hidden')) {
    if (e.key === 'Enter') confirmPrompt();
    if (e.key === 'Escape') closePrompt();
  }
});

/* ── RENDER CHECKLIST ────────────────────────────────────────────── */
let editMode = false;

function renderChecklist() {
  const el = document.getElementById('clist');
  el.innerHTML = CHECKLIST.map(item => {
    const cls    = item.checked ? (item.aiDetected ? 'ai-det' : 'chk') : '';
    const badge  = item.aiDetected
      ? '<span class="ibadge bai">IA</span>'
      : (item.req ? '<span class="ibadge breq">Obrigatorio</span>' : '<span class="ibadge bopt">Opcional</span>');
    const reason = item.aiReason ? `<div class="cin-reason show">${item.aiReason}</div>` : '';
    const toggle = `<div class="req-toggle" onclick="event.stopPropagation()">
      <button class="req-toggle-opt ${item.req ? 'sel-req' : ''}" onclick="setReq('${item.id}',true)">Obrigatorio</button>
      <button class="req-toggle-opt ${!item.req ? 'sel-opt' : ''}" onclick="setReq('${item.id}',false)">Opcional</button>
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
  if (item) { item.checked = !item.checked; item.aiDetected = false; item.aiReason = ''; renderChecklist(); }
}

/* ── STATS ───────────────────────────────────────────────────────── */
function updateStats() {
  const chk   = CHECKLIST.filter(i => i.checked).length;
  const total = CHECKLIST.length;
  const pct   = total ? Math.round((chk / total) * 100) : 0;
  document.getElementById('pbf').style.width    = pct + '%';
  document.getElementById('pinfo').textContent  = chk + ' / ' + total;
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
  if (!docs.length) { el.innerHTML = '<div class="empty">Nenhum documento enviado ainda</div>'; return; }
  const icoMap = { pdf:'&#128196;', jpg:'&#128444;', jpeg:'&#128444;', png:'&#128444;', docx:'&#128221;', doc:'&#128221;', xlsx:'&#128202;' };
  const clsMap = { pdf:'ico-pdf', jpg:'ico-img', jpeg:'ico-img', png:'ico-img', docx:'ico-doc', doc:'ico-doc', xlsx:'ico-xlsx' };
  el.innerHTML = docs.map(d => {
    const ext = d.name.split('.').pop().toLowerCase();
    const ico = icoMap[ext] || '&#128206;', cls = clsMap[ext] || 'ico-doc';
    let statusHtml = '';
    if      (d.status === 'analyzing') statusHtml = `<div class="dstatus s-analyzing"><div class="spin"></div> Analisando com IA...</div>`;
    else if (d.status === 'done')      statusHtml = `<div class="dstatus s-done">&#10003; ${d.result || 'Identificado'}</div>`;
    else                               statusHtml = `<div class="dstatus s-error">&#10007; ${d.error || 'Erro'}</div>`;
    const analysis = d.analysis ? `<div class="danalysis show">${d.analysis}</div>` : '';
    let alertHtml = '';
    if (d.identityAlert) {
      alertHtml = `<div class="id-alert"><div class="id-alert-icon">&#9888;</div>
        <div class="id-alert-body">
          <div class="id-alert-title">Inspecao humana necessaria</div>
          <div class="id-alert-msg">${d.identityAlert}</div>
          <div class="id-alert-actions">
            <button class="id-alert-confirm" onclick="confirmIdentity(${d.id})">Confirmar mesmo assim</button>
            <button class="id-alert-remove" onclick="remDoc(${d.id})">Remover documento</button>
          </div>
        </div></div>`;
    }
    return `<div class="ditem" id="ditem_${d.id}">
      <div class="dico ${cls}">${ico}</div>
      <div class="dmeta" style="flex:1;min-width:0;">
        <div class="dname" title="${d.name}">${d.name}</div>
        ${statusHtml}${analysis}${alertHtml}
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
  const ext = file.name.split('.').pop().toLowerCase();
  let messages;
  if (['jpg','jpeg','png'].includes(ext)) {
    const b64 = await fileToBase64(file);
    const mt  = ext === 'png' ? 'image/png' : 'image/jpeg';
    messages  = [{ role:'user', content:[
      { type:'image',  source:{ type:'base64', media_type:mt, data:b64 } },
      { type:'text',   text:'Analise este documento de acordo com as instrucoes.' }
    ]}];
  } else if (ext === 'pdf') {
    const b64 = await fileToBase64(file);
    messages  = [{ role:'user', content:[
      { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } },
      { type:'text',     text:'Analise este documento de acordo com as instrucoes.' }
    ]}];
  } else {
    const text = await file.text().catch(() => 'Conteudo nao legivel');
    messages   = [{ role:'user', content:`Analise este documento (${file.name}):\n\n${text.substring(0,3000)}` }];
  }
  const resp = await apiFetch('/api/analyze', {
    method:'POST',
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1000, system:SYSTEM_PROMPT, messages }),
  });
  if (!resp || !resp.ok) {
    const err = resp ? await resp.json().catch(() => ({})) : {};
    const msg = err.error?.message || `HTTP ${resp?.status || 401}`;
    throw new Error(msg.length > 120 ? msg.substring(0, 120) + '...' : msg);
  }
  const data  = await resp.json();
  const raw   = data.content?.find(c => c.type === 'text')?.text || '{}';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

/* ── IDENTITY CHECK ──────────────────────────────────────────────── */
function normalizeStr(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
}

function checkIdentity(result) {
  const empName = normalizeStr(document.getElementById('eName').value);
  const empCpf  = (document.getElementById('eCpf').value || '').replace(/\D/g, '');
  const alerts  = [];
  if (result.multiplas_pessoas) alerts.push('Este documento parece conter dados de mais de uma pessoa.');
  if (result.nome_no_documento && empName.length > 2) {
    const docName = normalizeStr(result.nome_no_documento);
    const match   = empName.split(' ').filter(t => t.length > 2).some(t => docName.split(' ').includes(t));
    if (!match) alerts.push(`Nome no documento: "${result.nome_no_documento}" diverge do colaborador cadastrado.`);
  }
  if (result.cpf_no_documento && empCpf.length === 11) {
    const docCpf = result.cpf_no_documento.replace(/\D/g,'');
    if (docCpf.length === 11 && docCpf !== empCpf) alerts.push(`CPF no documento: ${result.cpf_no_documento} diverge do CPF cadastrado.`);
  }
  return alerts.length ? alerts.join(' ') : null;
}

/* ── PROCESS FILES ───────────────────────────────────────────────── */
async function processFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id   = Date.now() + i;
    const doc  = { id, name:file.name, status:'analyzing', result:'', analysis:'', error:'', identityAlert:null };
    docs.push(doc); renderDocs();
    toast(`Enviando "${file.name}" para analise IA...`);
    try {
      const result   = await analyzeWithAI(file);
      doc.status     = 'done';
      doc.result     = result.tipo_detectado || 'Documento recebido';
      doc.analysis   = result.resumo || '';
      const alertMsg = checkIdentity(result);
      if (alertMsg) { doc.identityAlert = alertMsg; toast(`Alerta de identidade em "${file.name}" inspecao necessaria.`); }
      if (result.checklist_id) {
        const item = CHECKLIST.find(i => i.id === result.checklist_id);
        if (item && !item.checked) {
          item.checked = true; item.aiDetected = true;
          item.aiReason = `IA (${result.confianca}): ${result.resumo}`;
          renderChecklist();
          if (!alertMsg) toast(`Detectado: ${item.name}`);
          document.getElementById('s3').className = 'stp done';
          document.getElementById('sc3').classList.add('done');
          document.getElementById('s4').className = 'stp active';
        }
      } else if (!alertMsg) { toast('Documento recebido, nao mapeado ao checklist.'); }
    } catch (e) {
      doc.status = 'error'; doc.error = e.message.substring(0, 60);
      toast(`Erro: ${e.message.substring(0, 55)}`);
    }
    renderDocs(); updateStats();
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
function mCpfS(input) { mCpf(input); }

/* ── EMPLOYEE CHECK ──────────────────────────────────────────────── */
function chkEmp() {
  const n = document.getElementById('eName').value.trim();
  document.getElementById('s2').className  = n.length > 2 ? 'stp done'   : 'stp active';
  document.getElementById('s3').className  = n.length > 2 ? 'stp active' : 'stp idle';
  n.length > 2
    ? document.getElementById('sc2').classList.add('done')
    : document.getElementById('sc2').classList.remove('done');
  updateStats();
}

/* ── DRAG & DROP / UPLOAD ────────────────────────────────────────── */
function trigUp()       { document.getElementById('fileInput').click(); }
function dOver(e)       { e.preventDefault(); document.getElementById('uzone').classList.add('drag'); }
function dLeave()       { document.getElementById('uzone').classList.remove('drag'); }
function dDrop(e)       { e.preventDefault(); document.getElementById('uzone').classList.remove('drag'); processFiles(Array.from(e.dataTransfer.files)); }
function handleFiles(e) { processFiles(Array.from(e.target.files)); e.target.value = ''; }
function remDoc(id)     { docs = docs.filter(d => d.id !== id); renderDocs(); updateStats(); }

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
function switchTab(tabEl) {
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  if (!tabEl.textContent.includes('RH')) toast('Modulo "' + tabEl.textContent.trim() + '" em desenvolvimento.');
}

function switchTabRH(tabEl) {
  if (gel('trabalhistaView') && !gel('trabalhistaView').classList.contains('hidden')) {
    exitTrabalhistaView();
    return;
  }
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  showView('main');
}

/* ── PAINEL GERENCIAL ────────────────────────────────────────────── */
async function enterPainelView(tabEl) {
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  showView('painel');
  await renderPainelGerencial();
}

async function renderPainelGerencial() {
  const list = await loadDossies();
  const total = list.length;
  const completos   = list.filter(d => (d.missing_req || []).length === 0).length;
  const incompletos = total - completos;
  const taxa = total > 0 ? Math.round((completos / total) * 100) : 0;

  const taxaColor = taxa >= 80 ? 'green' : taxa >= 50 ? '' : 'red';
  const fillClass = taxa >= 80 ? 'fill-green' : taxa >= 50 ? '' : 'fill-red';

  gel('painelCards').innerHTML = `
    <div class="pg-card">
      <div class="pg-card-icon">&#128101;</div>
      <div class="pg-card-val">${total}</div>
      <div class="pg-card-lbl">Total de Prontuarios</div>
      <div class="pg-card-sub">colaboradores cadastrados</div>
    </div>
    <div class="pg-card pg-card-green">
      <div class="pg-card-icon">&#10003;</div>
      <div class="pg-card-val green">${completos}</div>
      <div class="pg-card-lbl">Prontuarios Completos</div>
      <div class="pg-card-sub">todos os itens obrigatorios entregues</div>
    </div>
    <div class="pg-card pg-card-red">
      <div class="pg-card-icon">&#9888;</div>
      <div class="pg-card-val red">${incompletos}</div>
      <div class="pg-card-lbl">Prontuarios Incompletos</div>
      <div class="pg-card-sub">com documentos obrigatorios pendentes</div>
    </div>
    <div class="pg-card ${taxa >= 80 ? 'pg-card-green' : taxa < 50 ? 'pg-card-red' : 'pg-card-amber'}">
      <div class="pg-donut-wrap">
        <svg viewBox="0 0 36 36" class="pg-donut">
          <circle class="pg-donut-bg" cx="18" cy="18" r="15.9155"/>
          <circle class="pg-donut-fill ${fillClass}" cx="18" cy="18" r="15.9155"
            stroke-dasharray="${taxa} ${100 - taxa}"/>
        </svg>
        <div class="pg-donut-info">
          <div class="pg-donut-pct ${taxaColor}">${taxa}%</div>
          <div class="pg-donut-lbl2">taxa de conformidade</div>
        </div>
      </div>
      <div class="pg-card-lbl" style="margin-top:8px">Colaboradores Processados</div>
      <div class="pg-card-sub">${completos} de ${total} com prontuario completo</div>
    </div>
  `;

  const ITEMS = [
    { id:'cnh',    name:'CNH / RG / Identidade',     match:'cnh' },
    { id:'cpf',    name:'CPF',                        match:'cpf' },
    { id:'ctrato', name:'Contrato de Trabalho',       match:'contrato' },
    { id:'admiss', name:'Ficha de Admissao',          match:'admis' },
    { id:'exame',  name:'Exame Admissional',          match:'exame' },
    { id:'resid',  name:'Comprovante de Residencia',  match:'resid' },
    { id:'foto',   name:'Foto 3x4',                   match:'foto' },
  ];

  const counts = {};
  ITEMS.forEach(it => { counts[it.id] = 0; });
  list.forEach(d => {
    const fileIds  = (d.files || []).map(f => f.id);
    const docNames = (d.docs  || []).map(n => n.toLowerCase());
    ITEMS.forEach(it => {
      if (fileIds.includes(it.id) || docNames.some(n => n.includes(it.match))) counts[it.id]++;
    });
  });

  gel('painelItems').innerHTML = ITEMS.map(it => {
    const cnt = counts[it.id];
    const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
    const barClass = pct >= 80 ? 'bar-green' : pct >= 50 ? 'bar-amber' : 'bar-red';
    return `
      <div class="pg-item">
        <div class="pg-item-name">${it.name}</div>
        <div class="pg-bar-track"><div class="pg-bar-fill ${barClass}" style="width:${pct}%"></div></div>
        <div class="pg-item-count">${cnt}/${total}</div>
        <div class="pg-item-pct">${pct}%</div>
      </div>`;
  }).join('');
}

/* ── API: DOSSIES ────────────────────────────────────────────────── */
let _dossiesCache = [];

async function loadDossies() {
  try {
    const params = new URLSearchParams();
    if (STATE.company)    params.set('companyId',    STATE.company.id);
    if (STATE.department) params.set('departmentId', STATE.department.id);
    const resp = await apiFetch('/api/dossies' + (params.toString() ? '?' + params : ''));
    if (!resp) return [];
    const list = resp.ok ? await resp.json() : [];
    _dossiesCache = list;
    return list;
  } catch { return []; }
}

async function saveDossie(entry) {
  await apiFetch('/api/dossies', {
    method:'POST', body:JSON.stringify(entry),
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
function closeImport() { document.getElementById('importOverlay').classList.remove('show'); }

document.getElementById('importOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeImport();
});

function iDragOver(e)  { e.preventDefault(); document.getElementById('izone').classList.add('drag'); }
function iDragLeave()  { document.getElementById('izone').classList.remove('drag'); }
function iDrop(e)      { e.preventDefault(); document.getElementById('izone').classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) processXlsx(f); }
function handleXlsx(e) { const f = e.target.files[0]; if (f) processXlsx(f); e.target.value = ''; }

function processXlsx(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => parseCsvText(e.target.result, file.name);
    reader.readAsText(file, 'UTF-8'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const XLSX = window.XLSX;
      if (!XLSX) { showImportError('SheetJS nao carregado. Use um arquivo .csv.'); return; }
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      parseRows(XLSX.utils.sheet_to_json(ws, { defval:'' }), file.name);
    } catch (err) { showImportError('Nao foi possivel ler a planilha: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
}

function parseCsvText(text, fname) {
  const lines   = text.trim().split(/\r?\n/);
  const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());
  const rows    = lines.slice(1).map(line => {
    const cols = line.split(/[,;]/), obj = {};
    headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
    return obj;
  }).filter(r => Object.values(r).some(v => v));
  parseRows(rows, fname);
}

function parseRows(rows, fname) {
  if (!rows.length) { showImportError('Planilha vazia ou sem dados.'); return; }
  const nameKey = Object.keys(rows[0]).find(k => /doc|nome|item|descri/i.test(k)) || Object.keys(rows[0])[0];
  const reqKey  = Object.keys(rows[0]).find(k => /obrig|required|req|manda/i.test(k));
  importedRows  = rows.map(r => ({
    name: String(r[nameKey] || '').trim(),
    req:  reqKey ? /^(s|sim|yes|true|1|x|obr)/i.test(String(r[reqKey] || '').trim()) : true,
  })).filter(r => r.name.length > 0);
  if (!importedRows.length) { showImportError('Nenhum item valido encontrado.'); return; }
  document.getElementById('ipreviewBody').innerHTML = importedRows.map((r, i) =>
    `<tr><td style="color:#9aaab8;font-size:11px">${i+1}</td><td>${r.name}</td>
     <td><span class="ipreview-req ${r.req ? 'yes' : 'no'}">${r.req ? '&#9679; Obrigatorio' : '&#9675; Opcional'}</span></td></tr>`
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
  importedRows.forEach((r, i) => CHECKLIST.push({ id:'item_'+i, name:r.name, req:r.req, checked:false, aiDetected:false, aiReason:'' }));
  renderChecklist(); closeImport();
  toast(`Checklist atualizado com ${importedRows.length} itens da planilha.`);
}

/* ── FINALIZE ────────────────────────────────────────────────────── */
async function finalize() {
  const name = document.getElementById('eName').value;
  const cpf  = document.getElementById('eCpf').value;
  const mat  = document.getElementById('eMat').value;
  await saveDossie({
    id:           'dossie_' + Date.now(),
    ts:           Date.now(),
    companyId:    STATE.company?.id,
    departmentId: STATE.department?.id,
    name, cpf, mat,
    status:      'ativo',
    docs:        docs.filter(d => d.status === 'done').map(d => d.result || d.name),
    missing_req: CHECKLIST.filter(i => i.req && !i.checked).map(i => i.name),
    total:       CHECKLIST.filter(i => i.checked).length,
    req:         CHECKLIST.filter(i => i.req && i.checked).length,
  });
  await updateIncBadge();
  renderIndexedDossies();
  document.getElementById('successTitle').textContent = `Dossie de ${name} finalizado!`;
  document.getElementById('successSub').textContent   = `CPF: ${cpf || 'nao informado'}  |  Matricula: ${mat || 'nao informada'}`;
  document.getElementById('successOverlay').classList.add('show');
  document.getElementById('s4').className = 'stp done';
  document.getElementById('sc3').classList.add('done');
}

function closeSuccess() {
  document.getElementById('successOverlay').classList.remove('show');
  docs = []; resetChecklistFromDept();
  ['eName','eCpf','eMat'].forEach(id => document.getElementById(id).value = '');
  ['s2','s3','s4'].forEach(id => document.getElementById(id).className = id === 's2' ? 'stp active' : 'stp idle');
  ['sc2','sc3'].forEach(id => document.getElementById(id).classList.remove('done'));
  renderChecklist(); renderDocs(); updateStats();
}

/* ── INCONSISTENCIES VIEW ────────────────────────────────────────── */
let incFilter       = 'all';
let incStatusFilter = 'ativo';

async function showIncView() {
  document.getElementById('mainView').classList.add('hidden');
  document.getElementById('incView').classList.add('active');
  await renderIncTable();
}

function hideIncView() {
  document.getElementById('incView').classList.remove('active');
  if (!STATE.department && STATE.profile === 'admin')        { enterAdminView(); return; }
  if (!STATE.department && STATE.profile === 'multicompany') { STATE.company ? enterCompanyView() : enterMultiCompanyView(); return; }
  if (STATE.profile === 'company' && !STATE.department)      { enterCompanyView(); return; }
  document.getElementById('mainView').classList.remove('hidden');
}

function setIncFilter(f, btn) {
  incFilter = f;
  document.querySelectorAll('.inc-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); renderIncTable();
}

function setIncStatusFilter(f, btn) {
  incStatusFilter = f;
  document.querySelectorAll('.inc-status-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); renderIncTable();
}

function getSeverity(d) {
  const n = (d.missing_req || []).length;
  return n >= 2 ? 'critical' : n === 1 ? 'warning' : 'ok';
}

async function renderIncTable() {
  const list  = await loadDossies();
  const query = (document.getElementById('incSearchInput')?.value || '').toLowerCase();
  const ativos   = list.filter(d => (d.status || 'ativo') === 'ativo').length;
  const inativos = list.filter(d => (d.status || 'ativo') === 'inativo').length;
  let total = list.length, critical = 0, warning = 0, ok = 0;
  list.forEach(d => { const s = getSeverity(d); if (s === 'critical') critical++; else if (s === 'warning') warning++; else ok++; });
  document.getElementById('incTotalCount').textContent    = total;
  document.getElementById('incCriticalCount').textContent = critical;
  document.getElementById('incWarningCount').textContent  = warning;
  document.getElementById('incOkCount').textContent       = ok;
  const elAtivos   = document.getElementById('incAtivosCount');
  const elInativos = document.getElementById('incInativosCount');
  if (elAtivos)   elAtivos.textContent   = ativos;
  if (elInativos) elInativos.textContent = inativos;
  const incCount = critical + warning;
  document.getElementById('incBadge').textContent         = incCount;
  const pill = document.getElementById('ntIncPill');
  if (pill) pill.classList.toggle('hidden', incCount === 0);
  const filtered = list.filter(d => {
    const s      = getSeverity(d);
    const status = d.status || 'ativo';
    return (incFilter === 'all' || s === incFilter) &&
           (incStatusFilter === 'all' || status === incStatusFilter) &&
           (!query || d.name.toLowerCase().includes(query) || (d.cpf||'').includes(query));
  });
  const tbody = document.getElementById('incTableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="inc-empty"><div class="inc-empty-icon">&#9989;</div>Nenhum colaborador encontrado.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(d => {
    const sev      = getSeverity(d);
    const status   = d.status || 'ativo';
    const initials = d.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
    const date     = new Date(d.ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
    const missing  = d.missing_req || [];
    const missingHtml = missing.length
      ? missing.map(m => `<span class="inc-missing-tag">${m}</span>`).join('')
      : '<span style="font-size:11px;color:#2a7c3a;font-weight:300;">Nenhum</span>';
    const sevHtml = sev === 'critical'
      ? `<span class="inc-severity sev-critical">&#9940; Critico</span>`
      : sev === 'warning'
      ? `<span class="inc-severity sev-warning">&#9888; Atencao</span>`
      : `<span class="inc-severity sev-ok">&#10003; Completo</span>`;
    let statusHtml;
    if (status === 'ativo') {
      statusHtml = `<span class="inc-colab-status status-ativo" onclick="event.stopPropagation();openStatusModal('${d.id}')">Ativo</span>`;
    } else {
      const desl = d.dataDesligamento ? new Date(d.dataDesligamento + 'T00:00:00').toLocaleDateString('pt-BR') : '';
      statusHtml = `<span class="inc-colab-status status-inativo" onclick="event.stopPropagation();openStatusModal('${d.id}')">Inativo${desl ? '<br><small>' + desl + '</small>' : ''}</span>`;
    }
    return `<tr onclick="toggleDrawer('${d.id}')">
      <td><div class="inc-name-cell">
        <div class="inc-avatar">${initials}</div>
        <div class="inc-name-meta">
          <div class="inc-name-main">${d.name}</div>
          <div class="inc-name-sub">CPF: ${d.cpf||'nao informado'} &middot; Mat.: ${d.mat||'nao informada'}</div>
        </div>
      </div></td>
      <td>${statusHtml}</td>
      <td><div class="inc-missing-list">${missingHtml}</div></td>
      <td>${sevHtml}</td>
      <td><span class="inc-date">${date}</span></td>
      <td><button class="inc-action-btn" onclick="event.stopPropagation();loadAndGo('${d.id}')">Completar &rarr;</button></td>
    </tr>
    <tr id="drawer_${d.id}" style="background:#f4f7fa;">
      <td colspan="6" style="padding:0;">
        <div class="inc-drawer" id="drawerContent_${d.id}">${buildDrawerContent(d)}</div>
      </td>
    </tr>`;
  }).join('');
}

let _statusModalDossieId = null;

function openStatusModal(id) {
  _statusModalDossieId = id;
  const d = _dossiesCache.find(x => x.id === id);
  if (!d) return;
  const currentStatus = d.status || 'ativo';
  const el = document.getElementById('statusModalName');
  if (el) el.textContent = d.name;
  const sel = document.getElementById('statusModalSelect');
  if (sel) sel.value = currentStatus;
  const desligRow = document.getElementById('statusModalDesligRow');
  if (desligRow) desligRow.classList.toggle('hidden', currentStatus === 'ativo');
  const desligInput = document.getElementById('statusModalDesligInput');
  if (desligInput) desligInput.value = d.dataDesligamento || '';
  const modal = document.getElementById('statusModal');
  if (modal) modal.classList.remove('hidden');
}

function closeStatusModal() {
  const modal = document.getElementById('statusModal');
  if (modal) modal.classList.add('hidden');
  _statusModalDossieId = null;
}

function onStatusModalChange(val) {
  const desligRow = document.getElementById('statusModalDesligRow');
  if (desligRow) desligRow.classList.toggle('hidden', val === 'ativo');
}

async function saveStatusModal() {
  const id = _statusModalDossieId;
  if (!id) return;
  const status = document.getElementById('statusModalSelect')?.value || 'ativo';
  const dataDesligamento = status === 'inativo' ? (document.getElementById('statusModalDesligInput')?.value || '') : '';
  const d = _dossiesCache.find(x => x.id === id);
  if (!d) { toast('Colaborador nao encontrado.'); return; }
  const updated = { ...d, status, dataDesligamento };
  const r = await apiFetch('/api/dossies', {
    method: 'POST',
    body:   JSON.stringify(updated),
  });
  if (r?.ok) {
    const label = status === 'ativo' ? 'Ativo' : 'Inativo';
    toast(`Status de ${d.name} atualizado para ${label}.`);
    closeStatusModal();
    renderIncTable();
  } else {
    toast('Erro ao salvar status. Tente novamente.');
  }
}

function buildDrawerContent(d) {
  const template = STATE.department?.checklist || DEFAULT_CHECKLIST;
  const present  = new Set(d.docs || []);
  const missing  = new Set(d.missing_req || []);
  const chips = template.map(item => {
    const p = present.has(item.name), m = missing.has(item.name);
    const cls = p ? 'present' : m ? 'missing' : 'optional';
    return `<div class="inc-doc-chip ${cls}"><div class="chip-dot ${cls}"></div>
      <span>${p ? '&#10003;' : m ? '&#10007;' : '&#9675;'} ${item.name}${!item.req?' (opt.)':''}</span></div>`;
  }).join('');
  return `<div class="inc-drawer-title">Situacao detalhada do prontuario</div><div class="inc-drawer-grid">${chips}</div>`;
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

async function loadAndGo(id) { await loadDossie(id); hideIncView(); }

async function updateIncBadge() {
  const list  = await loadDossies();
  const count = list.filter(d => (d.missing_req || []).length > 0).length;
  document.getElementById('incBadge').textContent = count;
  const pill = document.getElementById('ntIncPill');
  if (pill) pill.classList.toggle('hidden', count === 0);
}

/* ── SEARCH ──────────────────────────────────────────────────────── */
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
  renderSearchResults(list.filter(d =>
    (n && d.name.toLowerCase().includes(n)) ||
    (c && (d.cpf||'').replace(/\D/g,'').includes(c)) ||
    (m && (d.mat||'').toLowerCase().includes(m))
  ));
}

function renderSearchResults(hits) {
  const wrap = document.getElementById('srWrap'); wrap.classList.add('open');
  document.getElementById('srLabel').textContent = hits.length
    ? hits.length + (hits.length === 1 ? ' dossie encontrado' : ' dossies encontrados') : 'Nenhum resultado';
  if (!hits.length) {
    document.getElementById('srList').innerHTML = '<div class="sno-results">Nenhum dossie encontrado para esses filtros.</div>'; return;
  }
  document.getElementById('srList').innerHTML = hits.map(d => {
    const initials = d.name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const date     = new Date(d.ts).toLocaleDateString('pt-BR', {day:'2-digit',month:'short',year:'numeric'});
    const badges   = (d.docs||[]).slice(0,3).map(b => `<span class="sresult-badge">${b}</span>`).join('');
    const extra    = (d.docs||[]).length > 3 ? `<span class="sresult-badge">+${d.docs.length-3}</span>` : '';
    return `<div class="sresult-item" onclick="loadDossie('${d.id}')">
      <div class="sresult-avatar">${initials}</div>
      <div class="sresult-meta">
        <div class="sresult-name">${d.name}</div>
        <div class="sresult-info">CPF: ${d.cpf||'nao informado'} &middot; Matricula: ${d.mat||'nao informada'}</div>
        <div class="sresult-badges">${badges}${extra}</div>
      </div>
      <div class="sresult-date">${date}</div>
      <div class="sresult-arrow">&#8250;</div>
    </div>`;
  }).join('');
}

function closeSearch() { document.getElementById('srWrap').classList.remove('open'); }

async function loadDossie(id) {
  const resp  = await apiFetch('/api/dossies/' + id);
  const entry = resp?.ok ? await resp.json() : null;
  if (!entry) return;
  document.getElementById('eName').value = entry.name;
  document.getElementById('eCpf').value  = entry.cpf || '';
  document.getElementById('eMat').value  = entry.mat || '';
  closeSearch();
  ['srchName','srchCpf','srchMat'].forEach(f => document.getElementById(f).value = '');
  chkEmp();
  toast(`Dossie de ${entry.name} carregado. Voce pode adicionar novos documentos.`);
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ── ADMIN: USER MANAGEMENT ──────────────────────────────────────── */
let editingUserId = null;
let userFormCompanies = [];

function adminSetTab(tab) {
  ['companies','users'].forEach(t => {
    gel('admTab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('active', t === tab);
    gel('adminTab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('hidden', t !== tab);
  });
  if (tab === 'users') renderUserList();
}

async function renderUserList() {
  const list = gel('adminUserList');
  list.innerHTML = '<div class="adm-empty">Carregando...</div>';
  const resp  = await apiFetch('/api/users');
  if (!resp) return;
  const users = await resp.json();
  const companies = await apiGetCompanies();

  if (!users.length) { list.innerHTML = '<div class="adm-empty">Nenhum usuario cadastrado.</div>'; return; }

  const roleLbl = { admin:'Administrador', multicompany:'Multiplas Empresas', company:'Gestao de Empresa', department:'Departamental' };
  const modLabels = { rh:'RH', trabalhista:'Trabalhista', nf:'NF', contratos:'Contratos', documentos:'Docs' };
  list.innerHTML = `<table class="user-list-table">
    <thead><tr>
      <th>Nome</th><th>Usuario</th><th>Perfil</th><th>Empresa / Departamento</th><th>Modulos</th><th></th>
    </tr></thead>
    <tbody>${users.map(u => {
      const co   = companies.find(c => c.id === u.companyId);
      const dept = co?.departments?.find(d => d.id === u.departmentId);
      const scope = (u.role === 'admin' || u.role === 'multicompany') ? 'Todas' : (co?.name || '') + (dept ? ' / ' + dept.name : '');
      const safe  = encodeURIComponent(JSON.stringify(u));
      const mods  = u.modules?.length
        ? u.modules.map(m => `<span class="mod-chip">${modLabels[m]||m}</span>`).join('')
        : '<span style="font-size:11px;color:#94a3b8">Todos</span>';
      return `<tr>
        <td>${u.name}</td>
        <td style="color:var(--sbk-slate)">@${u.username}</td>
        <td><span class="role-badge ${u.role}">${roleLbl[u.role]||u.role}</span></td>
        <td style="font-size:12px;color:var(--sbk-slate)">${scope}</td>
        <td>${mods}</td>
        <td><div class="user-actions">
          <button class="user-edit-btn" onclick="openUserForm(decodeURIComponent('${safe}'))">Editar</button>
          <button class="user-del-btn"  onclick="deleteUser('${u.id}','${u.name}')">Excluir</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function openUserForm(userJson) {
  editingUserId = null;
  userFormCompanies = await apiGetCompanies();

  const coSel = gel('ufCompany');
  coSel.innerHTML = '<option value="">Selecione...</option>' +
    userFormCompanies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  ufBuildCompanyCheckboxes(userFormCompanies);

  if (userJson) {
    const u = JSON.parse(typeof userJson === 'string' ? userJson : JSON.stringify(userJson));
    editingUserId = u.id;
    gel('userFormTitle').textContent = 'Editar usuario';
    gel('ufPassHint').textContent    = '(deixe vazio para nao alterar)';
    gel('ufName').value     = u.name;
    gel('ufUsername').value = u.username;
    gel('ufPassword').value = '';
    gel('ufRole').value     = u.role;
    if (u.companyId) coSel.value = u.companyId;
    ufRoleChange();
    if (u.departmentId) {
      ufCompanyChange();
      setTimeout(() => { gel('ufDept').value = u.departmentId; }, 50);
    }
    ufSetModules(u.modules || []);
    ufSetAllowedCompanies(u.allowedCompanies || []);
  } else {
    editingUserId = null;
    gel('userFormTitle').textContent = 'Novo usuario';
    gel('ufPassHint').textContent    = '';
    gel('ufName').value = gel('ufUsername').value = gel('ufPassword').value = '';
    gel('ufRole').value = 'department';
    ufRoleChange();
    ufSetModules([]);
    ufSetAllowedCompanies([]);
  }

  gel('ufError').classList.add('hidden');
  gel('userFormOverlay').classList.remove('hidden');
}

function closeUserForm() { gel('userFormOverlay').classList.add('hidden'); }

function ufSetModules(mods) {
  document.querySelectorAll('.uf-mod-cb').forEach(cb => {
    cb.checked = mods.includes(cb.value);
  });
}

function ufBuildCompanyCheckboxes(companies) {
  const grid = gel('ufCompaniesGrid');
  if (!companies.length) {
    grid.innerHTML = '<span style="font-size:12px;color:#94a3b8">Nenhuma empresa cadastrada.</span>';
    return;
  }
  grid.innerHTML = companies.map(c =>
    `<label class="uf-mod-item">
      <input type="checkbox" class="uf-co-cb" value="${c.id}">&#127970; ${c.name}
    </label>`
  ).join('');
}

function ufSetAllowedCompanies(ids) {
  document.querySelectorAll('.uf-co-cb').forEach(cb => {
    cb.checked = ids.includes(cb.value);
  });
}

function ufRoleChange() {
  const role = gel('ufRole').value;
  gel('ufCompanyField').classList.toggle('hidden',   role === 'admin' || role === 'multicompany');
  gel('ufDeptField').classList.toggle('hidden',      role !== 'department');
  gel('ufCompaniesWrap').classList.toggle('hidden',  role !== 'multicompany');
}

function ufCompanyChange() {
  const coId = gel('ufCompany').value;
  const co   = userFormCompanies.find(c => c.id === coId);
  const sel  = gel('ufDept');
  sel.innerHTML = '<option value="">Selecione...</option>' +
    (co?.departments || []).map(d => `<option value="${d.id}">${d.name}</option>`).join('');
}

async function saveUserForm() {
  const role     = gel('ufRole').value;
  const name     = gel('ufName').value.trim();
  const username = gel('ufUsername').value.trim();
  const password = gel('ufPassword').value;
  const coId     = gel('ufCompany').value || null;
  const deptId   = gel('ufDept').value   || null;
  const errEl    = gel('ufError');
  errEl.classList.add('hidden');

  if (!name || !username) { errEl.textContent = 'Nome e usuario sao obrigatorios.'; errEl.classList.remove('hidden'); return; }
  if (!editingUserId && !password) { errEl.textContent = 'Senha obrigatoria para novo usuario.'; errEl.classList.remove('hidden'); return; }
  if (password && password.length < 6) { errEl.textContent = 'Senha deve ter ao menos 6 caracteres.'; errEl.classList.remove('hidden'); return; }

  const modules          = Array.from(document.querySelectorAll('.uf-mod-cb:checked')).map(cb => cb.value);
  const allowedCompanies = Array.from(document.querySelectorAll('.uf-co-cb:checked')).map(cb => cb.value);
  const payload = { name, username, role, companyId: coId, departmentId: deptId, modules, allowedCompanies };
  if (password) payload.password = password;

  const url  = editingUserId ? '/api/users/' + editingUserId : '/api/users';
  const meth = editingUserId ? 'PUT' : 'POST';
  const resp = await apiFetch(url, { method: meth, body: JSON.stringify(payload) });
  if (!resp) return;
  const data = await resp.json();
  if (!resp.ok) { errEl.textContent = data.error || 'Erro ao salvar.'; errEl.classList.remove('hidden'); return; }
  closeUserForm();
  renderUserList();
  toast(editingUserId ? 'Usuario atualizado.' : 'Usuario criado com sucesso.');
}

async function deleteUser(id, name) {
  if (!confirm('Excluir usuario "' + name + '"?')) return;
  const resp = await apiFetch('/api/users/' + id, { method: 'DELETE' });
  if (resp?.ok) { toast('Usuario excluido.'); renderUserList(); }
}

/* ── INDEXED DOSSIE LIST ─────────────────────────────────────────── */
let _idxStatusFilter = 'all';

function setIdxStatusFilter(f, btn) {
  _idxStatusFilter = f;
  ['idxBtnAll','idxBtnAtivo','idxBtnInativo'].forEach(id => { const b = gel(id); if (b) b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderIndexedDossies();
}

async function renderIndexedDossies() {
  const el = gel('indexedDossieList');
  if (!el) return;
  el.innerHTML = '<div class="adm-empty" style="padding:16px;">Carregando...</div>';
  const all  = await loadDossies();
  const list = _idxStatusFilter === 'all'
    ? all
    : all.filter(d => (d.status || 'ativo') === _idxStatusFilter);
  const count = gel('indexedDossieCount');
  if (count) count.textContent = list.length + (list.length === 1 ? ' prontuario' : ' prontuarios');
  if (!list.length) { el.innerHTML = '<div class="adm-empty" style="padding:16px;">Nenhum prontuario encontrado.</div>'; return; }
  el.innerHTML = list.map(d => {
    const sev  = (d.missing_req||[]).length >= 2 ? 'critical' : (d.missing_req||[]).length === 1 ? 'warning' : 'ok';
    const docBadge = sev === 'critical'
      ? '<span class="inc-severity sev-critical" style="font-size:10px;">&#9940; Critico</span>'
      : sev === 'warning'
      ? '<span class="inc-severity sev-warning" style="font-size:10px;">&#9888; Atencao</span>'
      : '<span class="inc-severity sev-ok" style="font-size:10px;">&#10003; Completo</span>';
    const status = d.status || 'ativo';
    const statusBadge = status === 'ativo'
      ? '<span class="inc-colab-status status-ativo" style="font-size:9px;">Ativo</span>'
      : '<span class="inc-colab-status status-inativo" style="font-size:9px;">Inativo</span>';
    const date = new Date(d.ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
    const initials = d.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
    return `<div class="idx-dossie-row" onclick="showDossierModal('${d.id}')">
      <div class="idx-avatar">${initials}</div>
      <div class="idx-meta">
        <div class="idx-name">${d.name}</div>
        <div class="idx-sub">CPF: ${d.cpf||'nao informado'} &middot; Mat.: ${d.mat||'nao informada'}</div>
      </div>
      ${statusBadge}
      ${docBadge}
      <div class="idx-date">${date}</div>
      <div class="idx-arrow">&#8250;</div>
    </div>`;
  }).join('');
}

/* ── DOSSIER DETAIL MODAL ────────────────────────────────────────── */
const CHECKLIST_DEF = [
  { id:'cnh',    name:'CNH / RG / Documento de Identidade', req:true  },
  { id:'cpf',    name:'CPF',                                req:true  },
  { id:'ctrato', name:'Contrato de Trabalho',               req:true  },
  { id:'admiss', name:'Ficha de Admissao',                  req:true  },
  { id:'exame',  name:'Exame Admissional',                  req:true  },
  { id:'resid',  name:'Comprovante de Residencia',          req:false },
  { id:'foto',   name:'Foto 3x4',                           req:false },
];

async function showDossierModal(dossieId) {
  const resp = await apiFetch('/api/dossies/' + dossieId);
  if (!resp || !resp.ok) { toast('Erro ao carregar prontuario.'); return; }
  const d = await resp.json();

  const docsSet  = new Set((d.docs  || []).map(s => s.toLowerCase()));
  const filesMap = {};
  (d.files || []).forEach(f => { filesMap[f.name.toLowerCase()] = f; });

  const deptCl   = STATE.company?.departments?.find(dep => dep.id === d.departmentId);
  const checklist = deptCl?.checklist || CHECKLIST_DEF;

  gel('dmName').textContent = d.name;
  gel('dmMeta').textContent =
    'CPF: ' + (d.cpf || 'nao informado') +
    ' · Mat.: ' + (d.mat || 'nao informada') +
    ' · Indexado em ' + new Date(d.ts).toLocaleDateString('pt-BR');

  const buildItems = items => items.map(item => {
    const present = docsSet.has(item.name.toLowerCase());
    const file    = filesMap[item.name.toLowerCase()];
    const openBtn = (present && file?.previewUrl)
      ? `<a class="dm-open-btn" href="${file.previewUrl}" target="_blank" rel="noopener" title="Abrir documento">&#128065; Abrir</a>`
      : '';
    const isNew = !present && item.req && !(d.missing_req || []).map(m => m.toLowerCase()).includes(item.name.toLowerCase());
    return `<div class="dm-item ${present ? 'dm-ok' : 'dm-miss'}${isNew ? ' dm-new-req' : ''}">
      <span class="dm-icon">${present ? '&#10003;' : '&#9711;'}</span>
      <span class="dm-item-name" style="flex:1;">${item.name}${isNew ? ' <span class="dm-new-badge">novo</span>' : ''}</span>
      ${openBtn}
    </div>`;
  }).join('');

  gel('dmRequired').innerHTML = buildItems(checklist.filter(i => i.req));
  gel('dmOptional').innerHTML = buildItems(checklist.filter(i => !i.req));

  gel('dmEditBtn').onclick = () => { closeDossierModal(); loadDossie(d.id); window.scrollTo({top:0,behavior:'smooth'}); };

  const status = d.status || 'ativo';
  const dmBadge = gel('dmStatusBadge');
  if (dmBadge) {
    dmBadge.className = 'inc-colab-status ' + (status === 'ativo' ? 'status-ativo' : 'status-inativo');
    const desl = (status === 'inativo' && d.dataDesligamento)
      ? ' - ' + new Date(d.dataDesligamento + 'T00:00:00').toLocaleDateString('pt-BR')
      : '';
    dmBadge.textContent = (status === 'ativo' ? 'Ativo' : 'Inativo') + desl;
    dmBadge.dataset.dossieId = d.id;
  }
  dmCancelStatus();

  gel('dossierModal').classList.remove('hidden');
}

function closeDossierModal() {
  gel('dossierModal').classList.add('hidden');
  dmCancelStatus();
}

function dmToggleStatus() {
  const row = gel('dmStatusRow');
  if (!row) return;
  const isOpen = row.style.display === 'block';
  if (isOpen) { dmCancelStatus(); return; }
  const badge = gel('dmStatusBadge');
  const id = badge?.dataset.dossieId;
  const d = _dossiesCache.find(x => x.id === id);
  if (!d) return;
  const status = d.status || 'ativo';
  const sel = gel('dmStatusSelect');
  if (sel) sel.value = status;
  const desligRow = gel('dmDesligRow');
  const desligInput = gel('dmDesligInput');
  if (desligRow) desligRow.style.display = status === 'inativo' ? 'block' : 'none';
  if (desligInput) desligInput.value = d.dataDesligamento || '';
  row.style.display = 'block';
}

function dmOnStatusChange(val) {
  const desligRow = gel('dmDesligRow');
  if (desligRow) desligRow.style.display = val === 'inativo' ? 'block' : 'none';
}

function dmCancelStatus() {
  const row = gel('dmStatusRow');
  if (row) row.style.display = 'none';
}

async function dmSaveStatus() {
  const badge = gel('dmStatusBadge');
  const id = badge?.dataset.dossieId;
  if (!id) return;
  const status = gel('dmStatusSelect')?.value || 'ativo';
  const dataDesligamento = status === 'inativo' ? (gel('dmDesligInput')?.value || '') : '';
  const d = _dossiesCache.find(x => x.id === id);
  if (!d) return;
  const updated = { ...d, status, dataDesligamento };
  const r = await apiFetch('/api/dossies', { method: 'POST', body: JSON.stringify(updated) });
  if (r?.ok) {
    const label = status === 'ativo' ? 'Ativo' : 'Inativo';
    const desl = (status === 'inativo' && dataDesligamento)
      ? ' - ' + new Date(dataDesligamento + 'T00:00:00').toLocaleDateString('pt-BR')
      : '';
    badge.className = 'inc-colab-status ' + (status === 'ativo' ? 'status-ativo' : 'status-inativo');
    badge.textContent = label + desl;
    toast(`Status de ${d.name} atualizado para ${label}.`);
    dmCancelStatus();
    renderIndexedDossies();
  } else {
    toast('Erro ao salvar status.');
  }
}

/* ── TRABALHISTA VIEW ────────────────────────────────────────────── */

// State
const LBR = {
  collaborators: [],   // {id,name,cpf,cargo,admissao,processes:[],lastCheck,status,searching}
  selected:      null, // id of selected collaborator
  demoMode:      false,
  autoTimer:     null,
  countdownTimer:null,
  nextScanAt:    null,
  scanQueue:     [],
  scanIdx:       0,
  riskFilter:    null, // 'alto'|'medio'|'baixo'|'na' — filtro ativo da barra de prioridade
};

/* ── DEMO DATA ── */
const LABOR_DEMO_COLLABS = [
  {
    id:'d1', name:'Carlos Eduardo Mendes', cpf:'342.891.074-55',
    cargo:'Analista de Logistica', admissao:'2019-03-15',
    status:'found', lastCheck: new Date(Date.now()-3*60000).toISOString(),
    processes:[{
      numeroProcesso:'0001234-56.2022.5.02.0078',
      classe:{nome:'Reclamacao Trabalhista - Rito Ordinario'},
      orgaoJulgador:{nome:'78a Vara do Trabalho de Sao Paulo'},
      dataAjuizamento:'2022-08-14', _tribunal:'TRT2', valor:85000,
      assuntos:[{nome:'Horas Extras'},{nome:'FGTS'},{nome:'Verbas Rescisorias'},{nome:'Dano Moral'}],
      partes:[
        {nome:'Carlos Eduardo Mendes',tipoParte:{nome:'Reclamante'}},
        {nome:'Empresa Demo Ltda',    tipoParte:{nome:'Reclamado'}},
      ],
      movimentos:[
        {nome:'Distribuido',                    dataHora:'2022-08-14T09:15:00Z'},
        {nome:'Audiencia inaugural realizada',   dataHora:'2022-11-20T14:00:00Z'},
        {nome:'Em instrucao - aguardando sentenca',dataHora:'2023-04-05T10:00:00Z'},
      ],
      _ai:{
        tipo_acao:'Reclamacao Trabalhista - Verbas Rescisorias e Dano Moral',
        pedidos_provaveis:['Horas extras e reflexos (3 anos)','FGTS + multa 40%','Aviso previo indenizado','Ferias vencidas + 1/3','13o salario proporcional','Dano moral por assedio de metas'],
        empresa_reclamada:'Empresa Demo Ltda',
        fase_atual:'Em instrucao - aguardando sentenca de 1o grau',
        status_resumido:'Em fase de instrucao',
        risco:'alto', valor_causa:'R$ 85.000,00',
        resumo_inicial:'Colaborador demitido em julho/2022 alega nao ter recebido corretamente todas as verbas rescisorias. Pleiteia horas extras de cerca de 3 anos de contrato, alem de dano moral por cobranca abusiva de metas. Audiencia realizada em novembro/2022 sem acordo.',
        inicial_reconstituida:{
          fatos_alegados:'O reclamante, admitido em marco de 2019 como Analista de Logistica, narra que ao longo de aproximadamente 3 anos prestou servico em regime de sobrejornada sistematica, sem o devido pagamento das horas extraordinarias. Alega que, alem da supressao das horas extras, sofreu cobranca abusiva de metas por parte de gestores diretos, configurando assedio moral. Demitido em julho de 2022, afirma que as verbas rescisorias foram pagas de forma incompleta, sem quitacao integral do FGTS e sem o pagamento correto do aviso previo indenizado.',
          fundamentos_juridicos:['CLT art. 59 - limitacao e pagamento das horas extras','CLT art. 223-A a 223-G - dano extrapatrimonial (dano moral)','CLT art. 477 - pagamento das verbas rescisorias','Sumula TST 291 - horas suplementares habituais e reflexos','OJ SDI-1 TST 394 - base de calculo das horas extras'],
          pedidos_detalhados:['Horas extras (50%) + adicional noturno, 3 anos de contrato - estimativa R$ 28.000','FGTS nao recolhido sobre horas extras + multa de 40% - estimativa R$ 12.000','Aviso previo indenizado proporcional (30 + 3 dias) - estimativa R$ 4.500','Ferias vencidas + 1/3 constitucional - estimativa R$ 5.200','13o salario proporcional - estimativa R$ 2.800','Indenizacao por dano moral por assedio de metas - estimativa R$ 30.000'],
          documentos_provaveis:['Carteira de Trabalho (CTPS) com anotacoes do contrato','Contracheques e holerites do periodo','Termo de rescisao contratual (TRCT)','Registro de ponto (cartao ponto ou espelho)','E-mails ou mensagens de cobranca de metas por gestores','Comunicados internos sobre metas e desempenho'],
        },
        pontos_atencao:['Processo em fase de sentenca com valor expressivo','Alegacao de dano moral aumenta exposicao financeira','Verificar controle de ponto do periodo reclamado','Revisar documentacao da rescisao contratual'],
      },
    }],
    _demoRhDocs:{status:'Atencao',docs:[
      {id:'cnh',    name:'CNH / RG / Documento de Identidade',req:true, ok:true, num:'4821 7733 SP/DETRAN',  validade:'15/03/2028',emissao:'08/07/2020'},
      {id:'cpf',    name:'CPF',                               req:true, ok:true, num:'342.891.074-55',       validade:null,        emissao:'12/01/2015'},
      {id:'ctrato', name:'Contrato de Trabalho',              req:true, ok:true, num:'CT-2019/0041',         validade:null,        emissao:'15/03/2019'},
      {id:'admiss', name:'Ficha de Admissao',                 req:true, ok:true, num:'FA-2019/0041',         validade:null,        emissao:'15/03/2019'},
      {id:'exame',  name:'Exame Admissional',                 req:true, ok:false,num:null,                   validade:null,        emissao:null},
      {id:'resid',  name:'Comprovante de Residencia',         req:false,ok:true, num:'Conta de Luz - Enel',  validade:'30/06/2025',emissao:'10/05/2025'},
      {id:'foto',   name:'Foto 3x4',                         req:false,ok:false,num:null,                   validade:null,        emissao:null},
    ]},
  },
  {
    id:'d2', name:'Aline Cristina Fonseca', cpf:'521.047.389-81',
    cargo:'Auxiliar Administrativo', admissao:'2021-01-20',
    status:'clean', lastCheck: new Date(Date.now()-7*60000).toISOString(),
    processes:[],
    _demoRhDocs:{status:'Completo',docs:[
      {id:'cnh',    name:'CNH / RG / Documento de Identidade',req:true, ok:true, num:'7714 8822 SP/SSP',     validade:'22/01/2027',emissao:'10/01/2022'},
      {id:'cpf',    name:'CPF',                               req:true, ok:true, num:'521.047.389-81',       validade:null,        emissao:'03/05/2018'},
      {id:'ctrato', name:'Contrato de Trabalho',              req:true, ok:true, num:'CT-2021/0007',         validade:null,        emissao:'20/01/2021'},
      {id:'admiss', name:'Ficha de Admissao',                 req:true, ok:true, num:'FA-2021/0007',         validade:null,        emissao:'20/01/2021'},
      {id:'exame',  name:'Exame Admissional',                 req:true, ok:true, num:'EX-2021/0007',         validade:'20/01/2026',emissao:'18/01/2021'},
      {id:'resid',  name:'Comprovante de Residencia',         req:false,ok:true, num:'Conta de Agua - Sabesp',validade:'31/05/2025',emissao:'05/05/2025'},
      {id:'foto',   name:'Foto 3x4',                         req:false,ok:true, num:'Arquivo digital',      validade:null,        emissao:'18/01/2021'},
    ]},
  },
  {
    id:'d3', name:'Ricardo Viana Barbosa', cpf:'089.345.671-22',
    cargo:'Supervisor de Operacoes', admissao:'2017-06-01',
    status:'found', lastCheck: new Date(Date.now()-60000).toISOString(),
    processes:[
      {
        numeroProcesso:'0009874-12.2020.5.15.0019',
        classe:{nome:'Reclamacao Trabalhista - Rito Sumario'},
        orgaoJulgador:{nome:'19a Vara do Trabalho de Campinas'},
        dataAjuizamento:'2020-02-03', _tribunal:'TRT15', valor:22500,
        assuntos:[{nome:'Acumulo de Funcoes'},{nome:'Diferenca Salarial'},{nome:'Reflexos'}],
        partes:[
          {nome:'Ricardo Viana Barbosa',tipoParte:{nome:'Reclamante'}},
          {nome:'Empresa Demo Ltda',    tipoParte:{nome:'Reclamado'}},
        ],
        movimentos:[
          {nome:'Distribuido',          dataHora:'2020-02-03T08:00:00Z'},
          {nome:'Sentenca proferida',   dataHora:'2020-09-17T16:00:00Z'},
          {nome:'Transito em julgado',  dataHora:'2021-03-10T00:00:00Z'},
          {nome:'Processo arquivado',   dataHora:'2022-01-25T00:00:00Z'},
        ],
        _ai:{
          tipo_acao:'Adicional por Acumulo de Funcoes',
          pedidos_provaveis:['Adicional por acumulo de funcao','Diferenca salarial retroativa','Reflexos em ferias, 13o e FGTS'],
          empresa_reclamada:'Empresa Demo Ltda',
          fase_atual:'Processo arquivado - encerrado',
          status_resumido:'Encerrado com transito em julgado',
          risco:'baixo', valor_causa:'R$ 22.500,00',
          resumo_inicial:'Processo encerrado. Colaborador pleiteou adicional por desempenho de funcoes superiores nao reconhecidas. Sentenca proferida em setembro/2020, transito em julgado em marco/2021.',
          inicial_reconstituida:{
            fatos_alegados:'O reclamante, admitido em junho de 2017 como Supervisor de Operacoes, narra que passou a exercer cumulativamente funcoes de gestao de equipe e controle operacional sem o correspondente reconhecimento salarial. Alega que, a despeito de acumular atribuicoes tipicas de cargo superior, continuou percebendo remuneracao equivalente ao cargo original, configurando acumulo de funcoes nao remunerado. O processo foi encerrado em 2022 com transito em julgado.',
            fundamentos_juridicos:['CLT art. 456-A - acumulo de funcoes e remuneracao correspondente','Principio da isonomia salarial - CF art. 7o, XXX','Sumula TST 159 - acumulo de funcoes e adicional'],
            pedidos_detalhados:['Adicional por acumulo de funcoes (percentual sobre o salario) - estimativa R$ 12.000','Diferenca salarial retroativa pelo periodo acumulado - estimativa R$ 6.500','Reflexos em ferias + 1/3, 13o salario e FGTS - estimativa R$ 4.000'],
            documentos_provaveis:['Descricao de cargo e funcoes da empresa','Organograma do periodo','E-mails demonstrando exercicio de funcoes superiores','Holerites para calculo da diferenca salarial'],
          },
          pontos_atencao:['Processo encerrado - nenhuma acao necessaria','Manter documentacao por 5 anos apos arquivamento'],
        },
      },
      {
        numeroProcesso:'0003341-88.2023.5.15.0019',
        classe:{nome:'Reclamacao Trabalhista - Rito Ordinario'},
        orgaoJulgador:{nome:'19a Vara do Trabalho de Campinas'},
        dataAjuizamento:'2023-11-27', _tribunal:'TRT15', valor:140000,
        assuntos:[{nome:'Assedio Moral'},{nome:'Dano Moral'},{nome:'Horas Extras'},{nome:'Adicional Noturno'},{nome:'Equiparacao Salarial'}],
        partes:[
          {nome:'Ricardo Viana Barbosa',tipoParte:{nome:'Reclamante'}},
          {nome:'Empresa Demo Ltda',    tipoParte:{nome:'Reclamado'}},
        ],
        movimentos:[
          {nome:'Distribuido',                         dataHora:'2023-11-27T10:00:00Z'},
          {nome:'Citacao realizada',                   dataHora:'2024-01-08T00:00:00Z'},
          {nome:'Audiencia de conciliacao designada',  dataHora:'2024-03-12T00:00:00Z'},
        ],
        _ai:{
          tipo_acao:'Dano Moral e Material por Assedio',
          pedidos_provaveis:['Dano moral por assedio moral continuado','Indenizacao por dano existencial','Horas extras nao pagas (2020-2023)','Adicional noturno','Equiparacao salarial'],
          empresa_reclamada:'Empresa Demo Ltda',
          fase_atual:'Instrucao - audiencia de conciliacao agendada',
          status_resumido:'Em fase inicial, audiencia agendada',
          risco:'alto', valor_causa:'R$ 140.000,00',
          resumo_inicial:'Colaborador ATIVO alega assedio moral sistematico por gestores diretos entre 2020 e 2023. Pleiteia dano moral de R$ 80.000 alem de verbas salariais nao pagas. Audiencia de conciliacao agendada.',
          inicial_reconstituida:{
            fatos_alegados:'O reclamante, ainda ativo como Supervisor de Operacoes, narra que a partir de 2020 passou a ser submetido a tratamento humilhante e constrangedor por parte de gestores diretos, incluindo cobracas excessivas em publico, exclusao de reunioes estrategicas e ameacas reiteradas de demissao. Paralelamente, alega que prestou servico em sobrejornada de forma sistematica sem o pagamento do adicional correspondente, e que colegas com mesma funcao e experiencia recebem remuneracao superior sem justificativa. O acumulado de situacoes configura, segundo a inicial, assedio moral continuado e dano existencial.',
            fundamentos_juridicos:['CLT art. 223-A a 223-G - dano extrapatrimonial (assedio moral)','CLT art. 461 - equiparacao salarial','CLT art. 59 - horas extras e adicional','CF art. 5o, X - inviolabilidade da honra e imagem','Lei 9.029/95 - praticas discriminatorias nas relacoes de trabalho'],
            pedidos_detalhados:['Indenizacao por dano moral por assedio continuado - R$ 80.000','Indenizacao por dano existencial - R$ 20.000','Horas extras (2020-2023) + adicional noturno + reflexos - estimativa R$ 22.000','Diferenca salarial por equiparacao - estimativa R$ 18.000'],
            documentos_provaveis:['Prints de mensagens de WhatsApp/e-mail com conteudo de assedio','Testemunhas indicadas (colegas de trabalho)','Contracheques para comparacao salarial com paradigma','Registros de ponto do periodo','Laudos medicos ou psicologicos se aplicavel'],
          },
          pontos_atencao:['COLABORADOR AINDA ATIVO - situacao critica','Valor elevado com risco real de condenacao','Preservar e-mails e comunicados internos','Envolver juridico e RH imediatamente','Avaliar acordo extrajudicial para mitigar risco'],
        },
      },
    ],
    _demoRhDocs:{status:'Critico',docs:[
      {id:'cnh',    name:'CNH / RG / Documento de Identidade',req:true, ok:true, num:'3390 5512 MG/DETRAN',  validade:'01/06/2026',emissao:'14/02/2021'},
      {id:'cpf',    name:'CPF',                               req:true, ok:true, num:'089.345.671-22',       validade:null,        emissao:'07/08/2010'},
      {id:'ctrato', name:'Contrato de Trabalho',              req:true, ok:false,num:null,                   validade:null,        emissao:null},
      {id:'admiss', name:'Ficha de Admissao',                 req:true, ok:false,num:null,                   validade:null,        emissao:null},
      {id:'exame',  name:'Exame Admissional',                 req:true, ok:true, num:'EX-2017/0031',         validade:'01/06/2022',emissao:'28/05/2017'},
      {id:'resid',  name:'Comprovante de Residencia',         req:false,ok:false,num:null,                   validade:null,        emissao:null},
      {id:'foto',   name:'Foto 3x4',                         req:false,ok:true, num:'Arquivo digital',      validade:null,        emissao:'28/05/2017'},
    ]},
  },
  {
    id:'d4', name:'Fernanda Lima Carvalho', cpf:'673.890.234-09',
    cargo:'Coordenadora de RH', admissao:'2020-08-10',
    status:'clean', lastCheck: new Date(Date.now()-5*60000).toISOString(),
    processes:[],
    _demoRhDocs:{status:'Completo',docs:[
      {id:'cnh',    name:'CNH / RG / Documento de Identidade',req:true, ok:true, num:'2204 9951 SP/SSP',     validade:'10/08/2029',emissao:'03/07/2024'},
      {id:'cpf',    name:'CPF',                               req:true, ok:true, num:'673.890.234-09',       validade:null,        emissao:'16/11/2012'},
      {id:'ctrato', name:'Contrato de Trabalho',              req:true, ok:true, num:'CT-2020/0082',         validade:null,        emissao:'10/08/2020'},
      {id:'admiss', name:'Ficha de Admissao',                 req:true, ok:true, num:'FA-2020/0082',         validade:null,        emissao:'10/08/2020'},
      {id:'exame',  name:'Exame Admissional',                 req:true, ok:true, num:'EX-2020/0082',         validade:'10/08/2025',emissao:'07/08/2020'},
      {id:'resid',  name:'Comprovante de Residencia',         req:false,ok:true, num:'Fatura Internet - Vivo',validade:'30/06/2025',emissao:'01/06/2025'},
      {id:'foto',   name:'Foto 3x4',                         req:false,ok:true, num:'Arquivo digital',      validade:null,        emissao:'07/08/2020'},
    ]},
  },
  {
    id:'d5', name:'Marcelo dos Santos Pereira', cpf:'815.234.067-44',
    cargo:'Motorista', admissao:'2018-04-22',
    status:'found', lastCheck: new Date(Date.now()-9*60000).toISOString(),
    processes:[{
      numeroProcesso:'0007123-44.2024.5.02.0001',
      classe:{nome:'Reclamacao Trabalhista - Vinculo Empregaticio'},
      orgaoJulgador:{nome:'1a Vara do Trabalho de Sao Paulo'},
      dataAjuizamento:'2024-06-05', _tribunal:'TRT2', valor:58000,
      assuntos:[{nome:'Vinculo Empregaticio'},{nome:'FGTS'},{nome:'Ferias'},{nome:'13o Salario'},{nome:'Horas in Itinere'}],
      partes:[
        {nome:'Marcelo dos Santos Pereira',tipoParte:{nome:'Reclamante'}},
        {nome:'Empresa Demo Ltda',         tipoParte:{nome:'Reclamado'}},
      ],
      movimentos:[
        {nome:'Distribuido',       dataHora:'2024-06-05T11:00:00Z'},
        {nome:'Citacao realizada', dataHora:'2024-07-15T00:00:00Z'},
      ],
      _ai:{
        tipo_acao:'Reconhecimento de Vinculo CLT e Verbas Trabalhistas',
        pedidos_provaveis:['Reconhecimento de vinculo empregaticio','FGTS do periodo + multa 40%','Ferias + 1/3','13o salario','Seguro desemprego','Horas in itinere'],
        empresa_reclamada:'Empresa Demo Ltda',
        fase_atual:'Fase inicial - aguardando audiencia',
        status_resumido:'Processo recente, citacao realizada',
        risco:'medio', valor_causa:'R$ 58.000,00',
        resumo_inicial:'Motorista pleiteia reconhecimento formal de vinculo CLT e pagamento de verbas do periodo nao registrado. Alega que parte do contrato foi mascarada como prestacao de servico autonomo sem respaldo legal.',
        inicial_reconstituida:{
          fatos_alegados:'O reclamante narra que prestou servico como motorista para a reclamada por aproximadamente 6 anos, entre 2018 e 2024, sem que houvesse o devido registro em Carteira de Trabalho. Alega que a relacao era formalmente enquadrada como prestacao de servico autonomo (MEI ou pessoa fisica), mas que na pratica se configuravam todos os requisitos da relacao de emprego: pessoalidade, nao eventualidade, oneridade e subordinacao juridica. Pleiteia o reconhecimento do vinculo empregaticio e o pagamento de todas as verbas devidas pelo periodo nao registrado, incluindo as horas de deslocamento ate o local de trabalho (horas in itinere).',
          fundamentos_juridicos:['CLT art. 2o e 3o - conceito de empregado e empregador','CLT art. 29 - obrigatoriedade de registro em CTPS','Sumula TST 90 - horas in itinere','OJ SDI-1 TST 363 - FGTS em vinculo nao reconhecido','CLT art. 477 e 467 - verbas rescisorias e multa'],
          pedidos_detalhados:['Reconhecimento de vinculo empregaticio (2018-2024)','FGTS nao depositado + multa de 40% - estimativa R$ 14.000','Ferias + 1/3 constitucional pelo periodo - estimativa R$ 8.500','13o salario proporcional - estimativa R$ 7.200','Seguro desemprego - estimativa R$ 5.600','Horas in itinere - estimativa R$ 12.000','Aviso previo indenizado proporcional - estimativa R$ 6.400','INSS do periodo nao recolhido (responsabilidade patronal)'],
          documentos_provaveis:['Notas fiscais emitidas pelo reclamante no periodo','Mapas e registros de rotas realizadas','Extratos bancarios de pagamentos recebidos','Testemunhas (outros motoristas da empresa)','Comunicacoes internas da empresa com o reclamante'],
        },
        pontos_atencao:['Verificar natureza juridica do contrato do motorista','Levantar registros de ponto e rotas do periodo','Consultar juridico sobre risco de vinculo informal reconhecido'],
      },
    }],
    _demoRhDocs:{status:'Atencao',docs:[
      {id:'cnh',    name:'CNH / RG / Documento de Identidade',req:true, ok:true, num:'5593 1182 SP/DETRAN',  validade:'22/04/2024',emissao:'10/03/2019',alerta:'CNH VENCIDA - renovar urgente'},
      {id:'cpf',    name:'CPF',                               req:true, ok:true, num:'815.234.067-44',       validade:null,        emissao:'20/02/2014'},
      {id:'ctrato', name:'Contrato de Trabalho',              req:true, ok:true, num:'CT-2018/0023',         validade:null,        emissao:'22/04/2018'},
      {id:'admiss', name:'Ficha de Admissao',                 req:true, ok:true, num:'FA-2018/0023',         validade:null,        emissao:'22/04/2018'},
      {id:'exame',  name:'Exame Admissional',                 req:true, ok:true, num:'EX-2018/0023',         validade:'22/04/2023',emissao:'19/04/2018',alerta:'Exame VENCIDO - agendar periodico'},
      {id:'resid',  name:'Comprovante de Residencia',         req:false,ok:false,num:null,                   validade:null,        emissao:null},
      {id:'foto',   name:'Foto 3x4',                         req:false,ok:true, num:'Arquivo digital',      validade:null,        emissao:'19/04/2018'},
    ]},
  },
  {
    id:'d6', name:'Patricia Gomes Alves', cpf:'198.076.523-37',
    cargo:'Assistente Fiscal', admissao:'2022-03-01',
    status:'pending', lastCheck:null, processes:[],
    _demoRhDocs:{status:'Completo',docs:[
      {id:'cnh',    name:'CNH / RG / Documento de Identidade',req:true, ok:true, num:'9012 3344 SP/SSP',     validade:'01/03/2030',emissao:'20/02/2025'},
      {id:'cpf',    name:'CPF',                               req:true, ok:true, num:'198.076.523-37',       validade:null,        emissao:'14/09/2016'},
      {id:'ctrato', name:'Contrato de Trabalho',              req:true, ok:true, num:'CT-2022/0019',         validade:null,        emissao:'01/03/2022'},
      {id:'admiss', name:'Ficha de Admissao',                 req:true, ok:true, num:'FA-2022/0019',         validade:null,        emissao:'01/03/2022'},
      {id:'exame',  name:'Exame Admissional',                 req:true, ok:true, num:'EX-2022/0019',         validade:'01/03/2027',emissao:'25/02/2022'},
      {id:'resid',  name:'Comprovante de Residencia',         req:false,ok:true, num:'Conta de Luz - Enel',  validade:'30/06/2025',emissao:'12/05/2025'},
      {id:'foto',   name:'Foto 3x4',                         req:false,ok:true, num:'Arquivo digital',      validade:null,        emissao:'25/02/2022'},
    ]},
  },
];

/* ── HELPERS ── */
function laborInitials(name) {
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
function laborAvatarColor(name) {
  const colors = ['#1a3a5c','#0e7490','#065f46','#7c3aed','#b45309','#be185d','#1d4ed8','#166534'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}
function laborRelTime(iso) {
  if (!iso) return 'nunca consultado';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return 'agora mesmo';
  if (diff < 3600) return `ha ${Math.floor(diff/60)} min`;
  return `ha ${Math.floor(diff/3600)}h`;
}
function laborMaskCpf(cpf) {
  return (cpf || '').replace(/(\d{3})\.\d{3}\.(\d{3}-\d{2})/, '$1.***.***-**').replace(/(\d{3})\d{3}(\d{3})(\d{2})/, '$1.***.***-**');
}

/* ── ENTRY / EXIT ── */
function enterTrabalhistaView() {
  showView('trabalhista');
  LBR.selected = null;
  gel('laborRight').innerHTML = `<div class="labor-detail-empty" id="laborDetailEmpty">
    <div class="labor-detail-empty-icon">&#128101;</div>
    <div>Selecione um colaborador ao lado para ver os processos</div>
    <div class="labor-detail-empty-sub">ou use "Varrer todos" para buscar automaticamente</div>
  </div>`;
  laborLoadCollabs();
  laborStartAutoTimer();
}

function exitTrabalhistaView() {
  laborStopAutoTimer();
  if (STATE.department)                      { enterDeptView();            return; }
  if (STATE.company)                         { enterCompanyView();          return; }
  if (STATE.profile === 'admin')             { enterAdminView();            return; }
  if (STATE.profile === 'multicompany')      { enterMultiCompanyView();     return; }
  enterDeptView();
}

/* ── LOAD COLLABORATORS ── */
async function laborLoadCollabs() {
  if (LBR.demoMode) {
    LBR.collaborators = LABOR_DEMO_COLLABS.map(c => ({...c, processes:[...c.processes]}));
  } else {
    const list = await loadDossies();
    LBR.collaborators = list.map((d, i) => ({
      id: d.id || 'c'+i,
      name: d.name || 'Colaborador',
      cpf:  d.cpf  || '',
      cargo: d.cargo || '',
      admissao: d.admissao || '',
      processes: [],
      lastCheck: null,
      status: 'pending',
      searching: false,
    }));
  }
  laborRenderCollabList();
  laborUpdateStats();
}

/* ── RENDER COLLAB LIST ── */
function laborSetRiskFilter(risk) {
  LBR.riskFilter = LBR.riskFilter === risk ? null : risk;
  laborUpdateStats();
  laborRenderCollabList();
}

function laborRenderCollabList(filter) {
  const q    = (filter || gel('laborCollabFilter')?.value || '').toLowerCase();
  let   list = LBR.collaborators.filter(c => !q || c.name.toLowerCase().includes(q) || (c.cpf||'').includes(q));

  if (LBR.riskFilter) {
    if (LBR.riskFilter === 'na') {
      list = list.filter(c => c.processes.some(p => !p._ai));
    } else {
      list = list.filter(c => c.processes.some(p => p._ai?.risco === LBR.riskFilter));
    }
  }

  const el   = gel('laborCollabList');
  if (!list.length) { el.innerHTML = '<div class="labor-collab-empty">Nenhum colaborador encontrado.</div>'; return; }
  el.innerHTML = list.map(c => {
    const bg   = laborAvatarColor(c.name);
    const init = laborInitials(c.name);
    const rt   = laborRelTime(c.lastCheck);
    const sel  = LBR.selected === c.id ? ' lci-selected' : '';
    let badge = '';
    if (c.searching) {
      badge = `<span class="labor-badge searching">&#128257; buscando...</span>`;
    } else if (c.status === 'found') {
      const n = c.processes.length;
      const hasAlto = c.processes.some(p => p._ai?.risco === 'alto');
      badge = `<span class="labor-badge found${hasAlto?' badge-alto':''}">${n} processo${n>1?'s':''}</span>`;
    } else if (c.status === 'clean') {
      badge = `<span class="labor-badge clean">&#10003; Sem processos</span>`;
    } else {
      badge = `<span class="labor-badge pending">Nao consultado</span>`;
    }
    return `<div class="labor-collab-item${sel}" id="lci_${c.id}" onclick="laborSelectCollab('${c.id}')">
      <div class="labor-avatar" style="background:${bg}">${init}</div>
      <div class="labor-ci-info">
        <div class="labor-ci-name">${c.name}</div>
        <div class="labor-ci-meta">${c.cargo || 'Cargo nao informado'} &bull; ${laborMaskCpf(c.cpf)}</div>
        <div class="labor-ci-check">${rt}</div>
      </div>
      <div class="labor-ci-badge">${badge}</div>
    </div>`;
  }).join('');
}

function laborFilterCollab() {
  laborRenderCollabList(gel('laborCollabFilter').value);
}

/* ── SELECT COLLABORATOR ── */
function laborSelectCollab(id) {
  LBR.selected = id;
  laborRenderCollabList();
  const c = LBR.collaborators.find(x => x.id === id);
  if (!c) return;
  laborRenderDetail(c);
}

/* ── RENDER DETAIL PANEL ── */
function laborRenderDetail(c) {
  const bg   = laborAvatarColor(c.name);
  const init = laborInitials(c.name);
  const rt   = laborRelTime(c.lastCheck);
  const isSearching = c.searching;

  let processesHtml = '';
  if (isSearching) {
    processesHtml = `<div class="labor-loading"><div class="labor-spinner"></div><div>Consultando DataJud em todos os TRTs...</div></div>`;
  } else if (!c.lastCheck) {
    processesHtml = `<div class="labor-detail-not-searched">
      <div>Este colaborador ainda nao foi consultado no DataJud.</div>
      <button class="labor-person-search-btn" onclick="laborSearchOne('${c.id}')">&#128269; Buscar agora</button>
    </div>`;
  } else if (c.processes.length === 0) {
    processesHtml = `<div class="labor-detail-clean"><span>&#9989;</span> Nenhum processo trabalhista encontrado para este colaborador no DataJud.</div>`;
  } else {
    processesHtml = `<div class="labor-proc-header">${c.processes.length} processo${c.processes.length>1?'s':''} encontrado${c.processes.length>1?'s':''}</div>` +
      c.processes.map((p, i) => buildLaborCard(p, `${c.id}_${i}`)).join('');
  }

  gel('laborRight').innerHTML = `
    <div class="labor-person-card">
      <div class="labor-person-top">
        <div class="labor-avatar labor-avatar-lg" style="background:${bg}">${init}</div>
        <div class="labor-person-info">
          <div class="labor-person-name">${c.name}</div>
          <div class="labor-person-meta">${c.cargo || 'Cargo nao informado'} ${c.admissao ? '&bull; Admissao: ' + new Date(c.admissao).toLocaleDateString('pt-BR') : ''}</div>
          <div class="labor-person-cpf">CPF: ${c.cpf || 'nao informado'}</div>
          <div class="labor-person-check">Ultima consulta: ${rt}</div>
        </div>
        <button class="labor-person-search-btn" id="lpsb_${c.id}" onclick="laborSearchOne('${c.id}')" ${isSearching?'disabled':''}>
          ${isSearching ? '&#128257; Buscando...' : '&#128269; Buscar processos'}
        </button>
      </div>
    </div>
    <div id="laborDetailProcesses_${c.id}">${processesHtml}</div>
    <div id="laborRhDocs_${c.id}" class="labor-rh-docs-wrap"></div>`;
  laborLoadRhDocs(c);
}

/* ── BUILD PROCESS CARD ── */
/* ── LABOR + RH DOCS ─────────────────────────────────────────────── */
async function laborLoadRhDocs(c) {
  const el = gel(`laborRhDocs_${c.id}`);
  if (!el) return;
  el.innerHTML = '<div class="labor-rh-loading">Buscando documentacao no RH...</div>';

  const list = await loadDossies();
  const cpfClean = (c.cpf || '').replace(/\D/g, '');
  const dossie = list.find(d => {
    if (cpfClean && d.cpf) return d.cpf.replace(/\D/g,'') === cpfClean;
    return d.name.trim().toLowerCase() === c.name.trim().toLowerCase();
  });

  if (!dossie) {
    if (LBR.demoMode && c._demoRhDocs) { laborRenderDemoRhDocs(el, c); return; }
    el.innerHTML = `<div class="labor-rh-empty"><span>&#128196;</span> Colaborador nao localizado no modulo RH.</div>`;
    return;
  }

  laborRenderRhChecklist(el, dossie);
}

function laborRenderRhChecklist(el, dossie) {
  const docsSet  = new Set((dossie.docs  || []).map(s => s.toLowerCase()));
  const filesMap = {};
  (dossie.files || []).forEach(f => { filesMap[f.name.toLowerCase()] = f; });

  const lbrDept    = STATE.company?.departments?.find(dep => dep.id === dossie.departmentId);
  const lbrCl      = lbrDept?.checklist || CHECKLIST_DEF;
  const items = lbrCl.map(item => {
    const ok   = docsSet.has(item.name.toLowerCase());
    const file = filesMap[item.name.toLowerCase()];
    const openBtn = (ok && file?.previewUrl)
      ? `<a class="dm-open-btn" href="${file.previewUrl}" target="_blank" rel="noopener">&#128065; Abrir</a>`
      : '';
    return `<div class="dm-item dm-compact ${ok?'dm-ok':'dm-miss'}">
      <span class="dm-icon">${ok?'&#10003;':'&#9711;'}</span>
      <span class="dm-item-name" style="flex:1;">${item.name}${item.req?'':' <em>(opc.)</em>'}</span>
      ${openBtn}
    </div>`;
  }).join('');

  const sev = (dossie.missing_req||[]).length >= 2 ? 'Critico'
            : (dossie.missing_req||[]).length === 1 ? 'Atencao'
            : 'Completo';
  const sevClass = sev === 'Critico' ? 'sev-critical' : sev === 'Atencao' ? 'sev-warning' : 'sev-ok';

  el.innerHTML = `<div class="labor-rh-docs">
    <div class="labor-rh-docs-header">
      <div class="labor-rh-docs-title">&#128196; Documentacao no RH</div>
      <span class="inc-severity ${sevClass}">${sev}</span>
    </div>
    <div class="dm-checklist dm-two-col">${items}</div>
    <button class="labor-rh-view-btn" onclick="showDossierModal('${dossie.id}')">Ver prontuario completo</button>
  </div>`;
}

function laborRenderDemoRhDocs(el, c) {
  const rh = c._demoRhDocs;
  const sevClass = rh.status === 'Critico' ? 'sev-critical' : rh.status === 'Atencao' ? 'sev-warning' : 'sev-ok';

  const missing = rh.docs.filter(d => !d.ok && d.req).length;
  const present = rh.docs.filter(d => d.ok).length;
  const total   = rh.docs.length;

  // Checklist view (matches screenshot style)
  const checkItems = rh.docs.map(doc => {
    const nameHtml = doc.name + (doc.req ? '' : ' <em>(opc.)</em>');
    const alertHtml = doc.alerta ? `<div class="rh-chk-alerta">&#9888; ${doc.alerta}</div>` : '';
    return `<div class="dm-item dm-compact ${doc.ok ? 'dm-ok' : 'dm-miss'}">
      <span class="dm-icon">${doc.ok ? '&#10003;' : '&#9711;'}</span>
      <span class="dm-item-name">${nameHtml}${alertHtml}</span>
    </div>`;
  }).join('');

  // Detail cards (colored headers with metadata)
  const docIcons  = { cnh:'&#128467;', cpf:'&#128196;', ctrato:'&#128221;', admiss:'&#128203;', exame:'&#9877;', resid:'&#127968;', foto:'&#128247;' };
  const docColors = { cnh:'#1a3a5c', cpf:'#065f46', ctrato:'#7c3aed', admiss:'#0e7490', exame:'#166534', resid:'#b45309', foto:'#be185d' };

  const cards = rh.docs.map(doc => {
    const icon  = docIcons[doc.id]  || '&#128196;';
    const color = docColors[doc.id] || '#334155';
    if (!doc.ok) {
      return `<div class="rh-doc-card rh-doc-miss">
        <div class="rh-doc-header" style="background:${color}22;border-color:${color}44;">
          <span class="rh-doc-icon" style="color:${color};filter:none;">${icon}</span>
          <div class="rh-doc-title" style="color:#64748b;">${doc.name}</div>
          <span class="rh-doc-badge rh-doc-badge-miss">${doc.req ? 'AUSENTE' : 'NAO ENTREGUE'}</span>
        </div>
        <div class="rh-doc-body rh-doc-body-miss">
          <span style="color:#94a3b8;">Documento nao localizado no prontuario</span>
          ${doc.req ? '<span class="rh-doc-alert">Obrigatorio - regularizar</span>' : ''}
        </div>
      </div>`;
    }
    const alertHtml = doc.alerta ? `<div class="rh-doc-alerta">&#9888; ${doc.alerta}</div>` : '';
    return `<div class="rh-doc-card rh-doc-ok">
      <div class="rh-doc-header" style="background:${color};border-color:${color};">
        <span class="rh-doc-icon" style="filter:brightness(0) invert(1);">${icon}</span>
        <div class="rh-doc-title">${doc.name}</div>
        <span class="rh-doc-badge rh-doc-badge-ok">&#10003; OK</span>
      </div>
      <div class="rh-doc-body">
        ${doc.num    ? `<div class="rh-doc-field"><span class="rh-doc-lbl">Numero/Ref.:</span><span class="rh-doc-val">${doc.num}</span></div>` : ''}
        ${doc.emissao? `<div class="rh-doc-field"><span class="rh-doc-lbl">Emissao:</span><span class="rh-doc-val">${doc.emissao}</span></div>` : ''}
        ${doc.validade?`<div class="rh-doc-field"><span class="rh-doc-lbl">Validade:</span><span class="rh-doc-val">${doc.validade}</span></div>` : ''}
        ${alertHtml}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="labor-rh-docs">
    <div class="labor-rh-docs-header">
      <div class="labor-rh-docs-title">&#128196; Documentacao no RH</div>
      <span class="inc-severity ${sevClass}">${rh.status}</span>
    </div>
    ${missing > 0 ? `<div class="rh-doc-missing-alert">&#9888; ${missing} documento${missing>1?'s':''} obrigatorio${missing>1?'s':''} ausente${missing>1?'s':''}</div>` : ''}
    <div class="dm-checklist dm-two-col">${checkItems}</div>
    <button class="labor-rh-view-btn" onclick="this.closest('.labor-rh-docs').querySelector('.rh-demo-detail').classList.toggle('hidden')">
      &#128196; Ver detalhes dos documentos
    </button>
    <div class="rh-demo-detail hidden">
      <div class="rh-doc-count" style="margin:12px 0 8px;font-size:11px;color:#64748b;">${present} de ${total} documentos presentes no prontuario</div>
      <div class="rh-doc-grid">${cards}</div>
    </div>
  </div>`;
}

function laborTribunalUrl(num, trib) {
  const n = (num || '').replace(/\D/g,'');
  if (!n) return null;
  const t = (trib || '').toLowerCase();
  const match = t.match(/trt(\d+)/);
  if (match) return `https://pje.trt${match[1]}.jus.br/consultaprocessual/detalhe-processo/${n}`;
  if (t === 'tst') return `https://consultaprocessual.tst.jus.br/consultaProcessual/consultaTstNumUnica.do?consulta=Consultar&conscsjt=&numeroTst=${n}`;
  return `https://consulta.cnj.jus.br/consulta/processo-numero?processo=${n}`;
}

function buildLaborCard(p, uid) {
  const dateAj = p.dataAjuizamento ? new Date(p.dataAjuizamento).toLocaleDateString('pt-BR') : 'nao informada';
  const partes = p.partes || [];
  const recl   = partes.find(x => /reclamante|autor/i.test(x.tipoParte?.nome || ''));
  const recdo  = partes.find(x => /reclamado|reu/i.test(x.tipoParte?.nome || ''));
  const lastMov= (p.movimentos || []).slice(-1)[0]?.nome || 'sem movimentos';
  const trib   = p._tribunal || p.tribunal || '';
  const num    = p.numeroProcesso || 'nao informado';
  const classe = p.classe?.nome || 'Processo Trabalhista';
  const valor  = p.valor ? 'R$ ' + Number(p.valor).toLocaleString('pt-BR',{minimumFractionDigits:2}) : null;
  const ai     = p._ai || null;
  const assuntos = (p.assuntos || []).map(a => `<span class="labor-assunto-tag">${a.nome}</span>`).join('');
  const tribUrl  = laborTribunalUrl(p.numeroProcesso, trib);

  const riskClass = ai ? (ai.risco==='alto'?'risk-alto':ai.risco==='medio'?'risk-medio':'risk-baixo') : '';
  const riskLabel = ai ? (ai.risco==='alto'?'&#9940; Alto':ai.risco==='medio'?'&#9888; Medio':'&#10003; Baixo') : '';

  const safeP = encodeURIComponent(JSON.stringify(p));
  const aiExpanded = ai ? buildAiPanel(ai) : '';

  return `<div class="labor-card" id="laborCard_${uid}">
    <div class="labor-card-top">
      <div class="labor-card-badge">${trib}</div>
      <div class="labor-card-num">${num}</div>
      <div class="labor-card-date">Ajuizado em ${dateAj}</div>
      ${tribUrl ? `<a class="labor-trib-link" href="${tribUrl}" target="_blank" rel="noopener" title="Abrir no portal do tribunal">&#128196; Ver no tribunal</a>` : ''}
      ${ai ? `<span class="labor-risk-badge ${riskClass}">${riskLabel}</span>` : ''}
    </div>
    <div class="labor-card-body">
      <div class="labor-card-classe">${classe}</div>
      ${assuntos ? `<div class="labor-assuntos">${assuntos}</div>` : ''}
      <div class="labor-partes">
        ${recl  ? `<div class="labor-parte"><span class="labor-parte-lbl recl">Reclamante</span><span class="labor-parte-nome">${recl.nome}</span></div>` : ''}
        ${recdo ? `<div class="labor-parte"><span class="labor-parte-lbl recdo">Reclamado</span><span class="labor-parte-nome">${recdo.nome}</span></div>` : ''}
      </div>
      <div class="labor-last-mov"><span>Ultimo mov.:</span> ${lastMov}</div>
      ${valor ? `<div class="labor-valor">Valor da causa: <strong>${valor}</strong></div>` : ''}
    </div>
    ${ai ? aiExpanded : `
    <div class="labor-card-footer">
      <button class="labor-analyze-btn" id="laborAnalyzeBtn_${uid}" onclick="laborAnalyzeCard('${uid}', decodeURIComponent('${safeP}'))">&#128161; Analisar com IA</button>
    </div>
    <div class="labor-analysis hidden" id="laborAnalysis_${uid}"></div>`}
  </div>`;
}

function buildAiPanel(ai) {
  const riskClass = ai.risco==='alto'?'risk-alto':ai.risco==='medio'?'risk-medio':'risk-baixo';
  const riskLabel = ai.risco==='alto'?'&#9940; Risco Alto':ai.risco==='medio'?'&#9888; Risco Medio':'&#10003; Risco Baixo';
  const pedidos   = (ai.pedidos_provaveis||[]).map(p=>`<li>${p}</li>`).join('');
  const atencao   = (ai.pontos_atencao||[]).map(p=>`<li>${p}</li>`).join('');

  const ini = ai.inicial_reconstituida;
  const iniHtml = ini ? `
    <div class="labor-inicial-section">
      <div class="labor-inicial-header">
        <span class="labor-inicial-icon">&#128220;</span>
        <span class="labor-inicial-title">Peticao Inicial</span>
        <span class="labor-inicial-badge">Reconstituicao por IA</span>
      </div>
      ${ini.fatos_alegados ? `<div class="labor-ai-section"><div class="labor-ai-label">Fatos alegados</div><div class="labor-ai-value labor-ai-resumo labor-ini-fatos">${ini.fatos_alegados}</div></div>` : ''}
      ${ini.pedidos_detalhados?.length ? `<div class="labor-ai-section"><div class="labor-ai-label">Pedidos detalhados</div><ul class="labor-ai-list">${ini.pedidos_detalhados.map(p=>`<li>${p}</li>`).join('')}</ul></div>` : ''}
      ${ini.fundamentos_juridicos?.length ? `<div class="labor-ai-section"><div class="labor-ai-label">Fundamentos juridicos</div><ul class="labor-ai-list labor-ini-fund">${ini.fundamentos_juridicos.map(p=>`<li>${p}</li>`).join('')}</ul></div>` : ''}
      ${ini.documentos_provaveis?.length ? `<div class="labor-ai-section"><div class="labor-ai-label">Documentos provavelmente juntados</div><ul class="labor-ai-list labor-ini-docs">${ini.documentos_provaveis.map(p=>`<li>&#128196; ${p}</li>`).join('')}</ul></div>` : ''}
    </div>` : '';

  return `<div class="labor-analysis">
    <div class="labor-ai-result">
      <div class="labor-ai-header">
        <div class="labor-ai-title">&#128161; Analise da IA</div>
        <span class="labor-risk-badge ${riskClass}">${riskLabel}</span>
      </div>
      <div class="labor-ai-two-col">
        <div class="labor-ai-section"><div class="labor-ai-label">Tipo de acao</div><div class="labor-ai-value">${ai.tipo_acao||'nao identificado'}</div></div>
        <div class="labor-ai-section"><div class="labor-ai-label">Fase atual</div><div class="labor-ai-value">${ai.fase_atual||ai.status_resumido||'nao informado'}</div></div>
      </div>
      <div class="labor-ai-section"><div class="labor-ai-label">Resumo</div><div class="labor-ai-value labor-ai-resumo">${ai.resumo_inicial||'sem resumo'}</div></div>
      ${pedidos ? `<div class="labor-ai-section"><div class="labor-ai-label">Pedidos provaveis</div><ul class="labor-ai-list">${pedidos}</ul></div>` : ''}
      ${atencao ? `<div class="labor-ai-section"><div class="labor-ai-label">Pontos de atencao</div><ul class="labor-ai-list labor-ai-atencao">${atencao}</ul></div>` : ''}
      ${ai.valor_causa&&ai.valor_causa!=='nao informado'?`<div class="labor-ai-section"><div class="labor-ai-label">Valor da causa</div><div class="labor-ai-value"><strong>${ai.valor_causa}</strong></div></div>`:''}
      ${iniHtml}
    </div>
  </div>`;
}

/* ── SEARCH: ONE PERSON ── */
async function laborSearchOne(id) {
  const c = LBR.collaborators.find(x => x.id === id);
  if (!c || c.searching) return;
  c.searching = true;
  laborRenderCollabList();
  if (LBR.selected === id) laborRenderDetail(c);

  if (!LBR.demoMode) {
    try {
      const resp = await apiFetch('/api/labor/search', {
        method:'POST',
        body:  JSON.stringify({ cpf: c.cpf, name: c.name }),
      });
      if (resp && resp.ok) {
        const data = await resp.json();
        c.processes  = data.processes || [];
        c.status     = c.processes.length ? 'found' : 'clean';
      } else { c.status = 'pending'; }
    } catch { c.status = 'pending'; }
  } else {
    // demo: already loaded
    await new Promise(r => setTimeout(r, 1200));
  }
  c.lastCheck = new Date().toISOString();
  c.searching  = false;
  laborRenderCollabList();
  if (LBR.selected === id) laborRenderDetail(c);
  laborUpdateStats();
}

/* ── SEARCH: ALL (queue) ── */
async function laborScanAll() {
  const btn = gel('laborScanAllBtn');
  if (!btn) return;
  btn.disabled = true;
  for (const c of LBR.collaborators) {
    await laborSearchOne(c.id);
    await new Promise(r => setTimeout(r, 400));
  }
  btn.disabled = false;
  laborResetTimer();
  toast('Varredura completa.');
}

/* ── ANALYZE: API call for cards without pre-loaded AI ── */
async function laborAnalyzeCard(uid, processoJson) {
  const processo = JSON.parse(processoJson);
  const btn   = gel(`laborAnalyzeBtn_${uid}`);
  const panel = gel(`laborAnalysis_${uid}`);
  btn.disabled = true; btn.textContent = 'Analisando...';
  panel.classList.remove('hidden');
  panel.innerHTML = '<div class="labor-ai-loading">&#129302; A IA esta analisando o processo...</div>';

  try {
    const resp = await apiFetch('/api/labor/analyze', {
      method:'POST', body:JSON.stringify({ processo }),
    });
    if (!resp) return;
    const ai = await resp.json();
    if (!resp.ok) { panel.innerHTML = `<div class="labor-ai-error">Erro: ${ai.error}</div>`; return; }
    panel.innerHTML = buildAiPanel(ai);
  } catch (e) {
    panel.innerHTML = `<div class="labor-ai-error">Erro: ${e.message}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '&#128161; Reanalisar'; }
  }
}

/* ── STATS BAR ── */
function laborUpdateStats() {
  const total    = LBR.collaborators.length;
  const comProc  = LBR.collaborators.filter(c => c.status==='found').length;
  const totalP   = LBR.collaborators.reduce((a,c)=>a+c.processes.length,0);
  const altoRisk = LBR.collaborators.reduce((a,c)=>a+c.processes.filter(p=>p._ai?.risco==='alto').length,0);
  gel('laborStatsBar').innerHTML = `
    <div class="labor-stat"><div class="labor-sv">${total}</div><div class="labor-sl">Colaboradores</div></div>
    <div class="labor-stat"><div class="labor-sv ${comProc?'sv-warn':''}">${comProc}</div><div class="labor-sl">Com processos</div></div>
    <div class="labor-stat"><div class="labor-sv">${totalP}</div><div class="labor-sl">Processos ativos</div></div>
    <div class="labor-stat"><div class="labor-sv ${altoRisk?'sv-danger':''}">${altoRisk}</div><div class="labor-sl">Risco alto</div></div>`;

  const alto  = LBR.collaborators.reduce((a,c)=>a+c.processes.filter(p=>p._ai?.risco==='alto').length,0);
  const medio = LBR.collaborators.reduce((a,c)=>a+c.processes.filter(p=>p._ai?.risco==='medio').length,0);
  const baixo = LBR.collaborators.reduce((a,c)=>a+c.processes.filter(p=>p._ai?.risco==='baixo').length,0);
  const semAi = totalP - alto - medio - baixo;
  const pct   = v => totalP > 0 ? Math.round(v / totalP * 100) : 0;

  const barEl = gel('laborPriorityBar');
  if (!barEl) return;

  if (totalP === 0) {
    barEl.innerHTML = '';
    return;
  }

  const rf = LBR.riskFilter;

  const segments = [
    { key:'alto',  label:'Risco alto',     count:alto,  cls:'prio-alto',  desc:'Processos com alto potencial de condenacao ou valor elevado' },
    { key:'medio', label:'Risco medio',    count:medio, cls:'prio-medio', desc:'Processos em andamento com risco moderado' },
    { key:'baixo', label:'Risco baixo',    count:baixo, cls:'prio-baixo', desc:'Processos com baixa probabilidade de condenacao significativa' },
    { key:'na',    label:'Nao analisado',  count:semAi, cls:'prio-na',    desc:'Processos ainda sem analise de IA' },
  ].filter(s => s.count > 0);

  const bars = segments.map(s => {
    const active = rf === s.key ? ' prio-seg-active' : (rf && rf !== s.key ? ' prio-seg-dim' : '');
    return `<div class="prio-seg ${s.cls}${active}" style="flex:${s.count}"
      title="${s.label}: ${s.count} processo${s.count>1?'s':''}"
      onclick="laborSetRiskFilter('${s.key}')"></div>`;
  }).join('');

  const clearBtn = rf
    ? `<button class="prio-clear-btn" onclick="laborSetRiskFilter('${rf}')">&#10005; Limpar filtro</button>`
    : '';

  const legend = segments.map(s => {
    const active = rf === s.key ? ' prio-leg-active' : (rf && rf !== s.key ? ' prio-leg-dim' : '');
    return `<div class="prio-leg-item${active}" onclick="laborSetRiskFilter('${s.key}')" title="${s.desc}">
      <span class="prio-leg-dot ${s.cls}"></span>
      <span class="prio-leg-label">${s.label}</span>
      <span class="prio-leg-count">${s.count}</span>
    </div>`;
  }).join('');

  const filterBanner = rf ? (() => {
    const seg = segments.find(s => s.key === rf);
    const filtered = LBR.collaborators.filter(c =>
      rf === 'na' ? c.processes.some(p => !p._ai) : c.processes.some(p => p._ai?.risco === rf)
    ).length;
    return `<div class="prio-filter-banner">
      <span class="prio-filter-dot ${seg?.cls || ''}"></span>
      Exibindo <strong>${filtered} colaborador${filtered!==1?'es':''}</strong> com processos de ${seg?.label || rf}
      <button class="prio-clear-btn" onclick="laborSetRiskFilter('${rf}')">&#10005; Limpar</button>
    </div>`;
  })() : '';

  const criteriosHtml = `
    <div class="prio-criterios">
      <button class="prio-crit-toggle" onclick="this.closest('.prio-criterios').classList.toggle('prio-crit-open')">
        &#9432; Como e determinada a criticidade?
      </button>
      <div class="prio-crit-body">
        <div class="prio-crit-item"><span class="prio-crit-dot prio-alto"></span><strong>Risco alto:</strong> valor da causa elevado, fase avancada (audiencia ou sentenca), pedidos de dano moral, rescisao indireta ou reintegracao</div>
        <div class="prio-crit-item"><span class="prio-crit-dot prio-medio"></span><strong>Risco medio:</strong> processo em instrucao com pedidos de horas extras, equiparacao salarial ou verbas rescisorias em valor moderado</div>
        <div class="prio-crit-item"><span class="prio-crit-dot prio-baixo"></span><strong>Risco baixo:</strong> processo inicial, pedidos de valor reduzido, chances de acordo elevadas ou processo ja arquivado</div>
        <div class="prio-crit-item"><span class="prio-crit-dot prio-na"></span><strong>Nao analisado:</strong> processo localizado mas ainda sem analise da IA — clique em "Analisar com IA" no card do processo</div>
      </div>
    </div>`;

  barEl.innerHTML = `
    <div class="prio-track">${bars}</div>
    <div class="prio-legend">${legend}${clearBtn}</div>
    ${filterBanner}
    ${criteriosHtml}`;
}

/* ── AUTO-TIMER (10 min) ── */
function laborStartAutoTimer() {
  laborStopAutoTimer();
  LBR.nextScanAt = Date.now() + 10 * 60 * 1000;
  LBR.countdownTimer = setInterval(laborTickTimer, 1000);
  LBR.autoTimer = setTimeout(() => { laborScanAll(); }, 10 * 60 * 1000);
  laborTickTimer();
}

function laborStopAutoTimer() {
  if (LBR.autoTimer)      { clearTimeout(LBR.autoTimer);      LBR.autoTimer = null; }
  if (LBR.countdownTimer) { clearInterval(LBR.countdownTimer); LBR.countdownTimer = null; }
}

function laborResetTimer() {
  laborStopAutoTimer();
  laborStartAutoTimer();
}

function laborTickTimer() {
  const label = gel('laborTimerLabel');
  const dot   = gel('laborTimerDot');
  if (!label || !LBR.nextScanAt) return;
  const rem = Math.max(0, Math.floor((LBR.nextScanAt - Date.now()) / 1000));
  const m   = String(Math.floor(rem / 60)).padStart(2,'0');
  const s   = String(rem % 60).padStart(2,'0');
  label.textContent = `Proxima varredura em ${m}:${s}`;
  if (dot) dot.classList.toggle('dot-active', rem > 0);
}

/* ── DEMO MODE ── */
function laborToggleDemo() {
  LBR.demoMode = !LBR.demoMode;
  const btn = gel('laborDemoBtn');
  if (btn) {
    btn.textContent = LBR.demoMode ? '&#127926; Sair do demo' : '&#127926; Demo';
    btn.classList.toggle('demo-active', LBR.demoMode);
  }
  laborLoadCollabs();
  gel('laborRight').innerHTML = `<div class="labor-detail-empty">
    <div class="labor-detail-empty-icon">&#128101;</div>
    <div>Selecione um colaborador</div>
    <div class="labor-detail-empty-sub">${LBR.demoMode ? 'Modo demo ativo com dados ficticioss' : ''}</div>
  </div>`;
}

/* ════════════════════════════════════════════════════════════════════
   MÓDULO: NOTAS FISCAIS
   ════════════════════════════════════════════════════════════════════ */

const NF = {
  list:     [],
  selected: null,
  editing:  false,
  queue:    [],  // { id, name, status:'pending'|'reading'|'ok'|'err'|'review', data, error }
};

/* ── ENTRY ── */
function enterNfView(tabEl) {
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  showView('nf');
  nfLoad();
}

/* ── LOAD ── */
async function nfLoad() {
  const companyId = STATE.company?.id;
  const r = await apiFetch('/api/nf' + (companyId ? '?companyId=' + companyId : ''));
  NF.list = (r && r.ok) ? await r.json() : [];
  nfRenderStats();
  nfRenderList();
}

/* ── STATS ── */
function nfRenderStats() {
  const total       = NF.list.length;
  const fornecedores = new Set(NF.list.map(n => n.cnpj)).size;
  const comValor    = NF.list.filter(n => n.valor).length;
  const valorTotal  = NF.list.reduce((acc, n) => {
    if (!n.valor) return acc;
    const v = parseFloat(n.valor.replace(/[^\d,]/g,'').replace(',','.')) || 0;
    return acc + v;
  }, 0);
  const el = gel('nfStats');
  if (!el) return;
  el.innerHTML = `
    <div class="nf-stat"><div class="nf-sv">${total}</div><div class="nf-sl">NFs cadastradas</div></div>
    <div class="nf-stat"><div class="nf-sv">${fornecedores}</div><div class="nf-sl">Fornecedores</div></div>
    <div class="nf-stat"><div class="nf-sv">${comValor}</div><div class="nf-sl">Com valor</div></div>
    ${valorTotal > 0 ? `<div class="nf-stat"><div class="nf-sv nf-sv-valor">R$ ${valorTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="nf-sl">Valor total</div></div>` : ''}`;
}

/* ── LIST ── */
function nfRenderList() {
  const q   = (gel('nfSearch')?.value || '').toLowerCase();
  const el  = gel('nfList');
  if (!el) return;
  const list = NF.list.filter(n =>
    !q ||
    (n.fornecedor || '').toLowerCase().includes(q) ||
    (n.cnpj       || '').includes(q) ||
    (n.numero     || '').includes(q)
  );
  if (!list.length) {
    el.innerHTML = `<div class="nf-list-empty">${NF.list.length ? 'Nenhuma NF encontrada.' : 'Nenhuma NF cadastrada.'}</div>`;
    return;
  }
  el.innerHTML = list.map(n => {
    const sel = NF.selected === n.id ? ' nf-item-sel' : '';
    const date = n.dataEmissao ? n.dataEmissao : 'Data nao informada';
    return `<div class="nf-item${sel}" onclick="nfSelect('${n.id}')">
      <div class="nf-item-top">
        <span class="nf-item-num">NF ${n.numero || '???'}</span>
        <span class="nf-item-date">${date}</span>
      </div>
      <div class="nf-item-forn">${n.fornecedor}</div>
      <div class="nf-item-cnpj">${n.cnpj}</div>
      ${n.valor ? `<div class="nf-item-valor">${n.valor}</div>` : ''}
    </div>`;
  }).join('');
}

/* ── SELECT ── */
function nfSelect(id) {
  NF.selected = id;
  NF.editing  = true;
  nfRenderList();
  const n = NF.list.find(x => x.id === id);
  if (n) nfShowForm(n);
}

/* ── OPEN BLANK FORM ── */
function nfOpenForm() {
  NF.selected = null;
  NF.editing  = false;
  nfShowForm(null);
}

/* ── RENDER RIGHT PANEL ── */
function nfShowForm(nf) {
  const right = gel('nfRight');
  if (!right) return;
  const isEdit = !!nf;
  right.innerHTML = `
    <div class="nf-panel">

      <!-- AI ZONE -->
      <div class="nf-ai-zone" id="nfAiZone">
        <div class="nf-ai-title">&#128161; Interpretar NF com IA</div>
        <div class="nf-ai-desc">Envie uma imagem ou PDF da nota fiscal e a IA preenchera os campos automaticamente.</div>
        <label class="nf-ai-upload-btn" for="nfFileInput">
          &#128196; Selecionar arquivo (JPG, PNG, PDF)
        </label>
        <input type="file" id="nfFileInput" accept=".jpg,.jpeg,.png,.pdf"
          style="display:none" onchange="nfInterpret(this)">
        <div class="nf-ai-status hidden" id="nfAiStatus"></div>
      </div>

      <!-- FORM -->
      <div class="nf-form-title">${isEdit ? '&#9998; Editar NF' : '&#43; Cadastrar NF'}</div>
      <form class="nf-form" onsubmit="nfSubmit(event)">
        <div class="nf-form-row">
          <div class="nf-field">
            <label class="nf-label">CNPJ <span class="nf-req">*</span></label>
            <input class="nf-input" id="nfCnpj" type="text" placeholder="00.000.000/0001-00"
              value="${nf?.cnpj || ''}" oninput="nfMaskCnpj(this)" maxlength="18" required>
          </div>
          <div class="nf-field">
            <label class="nf-label">N&#186; da NF <span class="nf-req">*</span></label>
            <input class="nf-input" id="nfNumero" type="text" placeholder="000001"
              value="${nf?.numero || ''}" required>
          </div>
        </div>
        <div class="nf-form-row">
          <div class="nf-field">
            <label class="nf-label">Data de Emissao</label>
            <input class="nf-input" id="nfData" type="text" placeholder="DD/MM/AAAA"
              value="${nf?.dataEmissao || ''}" oninput="nfMaskDate(this)" maxlength="10">
          </div>
          <div class="nf-field">
            <label class="nf-label">Valor Total</label>
            <input class="nf-input" id="nfValor" type="text" placeholder="R$ 0,00"
              value="${nf?.valor || ''}">
          </div>
        </div>
        <div class="nf-field">
          <label class="nf-label">Nome do Fornecedor <span class="nf-req">*</span></label>
          <input class="nf-input" id="nfFornecedor" type="text" placeholder="Razao social do emitente"
            value="${nf?.fornecedor || ''}" required>
        </div>
        <div class="nf-form-actions">
          ${isEdit ? `<button type="button" class="nf-btn-del" onclick="nfDelete('${nf.id}')">&#128465; Excluir</button>` : ''}
          <button type="button" class="nf-btn-sec" onclick="nfCancelForm()">Cancelar</button>
          <button type="submit" class="nf-btn-primary">${isEdit ? 'Salvar alteracoes' : 'Cadastrar NF'}</button>
        </div>
      </form>
    </div>`;
}

/* ── AI INTERPRET ── */
/* ── SINGLE FILE INTERPRET (form panel) ── */
async function nfInterpret(input) {
  const file = input.files[0];
  if (!file) return;
  const status = gel('nfAiStatus');
  status.className = 'nf-ai-status nf-ai-loading';
  status.textContent = 'Interpretando NF...';
  try {
    const data = await nfCallInterpret(file);
    if (data.cnpj)        gel('nfCnpj').value      = data.cnpj;
    if (data.numero)      gel('nfNumero').value     = data.numero;
    if (data.dataEmissao) gel('nfData').value       = data.dataEmissao;
    if (data.fornecedor)  gel('nfFornecedor').value = data.fornecedor;
    if (data.valor)       gel('nfValor').value      = data.valor;
    const obs = data.observacao ? ` — ${data.observacao}` : '';
    status.className = 'nf-ai-status nf-ai-ok';
    status.textContent = `Preenchido com confianca ${data.confianca || '?'}${obs}. Revise os campos antes de salvar.`;
  } catch (e) {
    status.className = 'nf-ai-status nf-ai-err';
    status.textContent = 'Erro na interpretacao: ' + e.message;
  }
  input.value = '';
}

/* ── SHARED: call /api/nf/interpret ── */
async function nfCallInterpret(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const mt  = ext === 'pdf' ? 'application/pdf' : (ext === 'png' ? 'image/png' : 'image/jpeg');
  const b64 = await fileToBase64(file);
  const r   = await apiFetch('/api/nf/interpret', {
    method: 'POST',
    body:   JSON.stringify({ fileData: b64, mediaType: mt }),
  });
  if (!r || !r.ok) {
    const err = r ? await r.json().catch(() => ({})) : {};
    throw new Error(err.error || `HTTP ${r?.status || 0}`);
  }
  return r.json();
}

/* ── BULK IMPORT ── */
function nfBulkDrop(e) {
  e.preventDefault();
  gel('nfBulkZone').classList.remove('nf-bulk-drag');
  const files = Array.from(e.dataTransfer.files).filter(f =>
    /\.(jpg|jpeg|png|pdf)$/i.test(f.name)
  );
  if (files.length) nfBulkImport(files);
}

async function nfBulkImport(filesRaw) {
  const files = Array.from(filesRaw);
  if (!files.length) return;

  // Add new items to queue
  const newItems = files.map(f => ({
    id:     'q_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    name:   f.name,
    file:   f,
    status: 'pending',
    data:   null,
    error:  null,
  }));
  NF.queue.push(...newItems);
  nfQueueShow();

  // Process up to 3 in parallel
  const CONCURRENCY = 3;
  const pending = newItems.slice();

  async function processOne(item) {
    item.status = 'reading';
    nfQueueRender();
    try {
      const data = await nfCallInterpret(item.file);
      item.data  = data;
      // Auto-register if confidence is alta or media
      if (data.confianca === 'alta' || data.confianca === 'media') {
        await nfAutoRegister(item);
      } else {
        item.status = 'review';
      }
    } catch (e) {
      item.status = 'err';
      item.error  = e.message.substring(0, 80);
    }
    nfQueueRender();
    nfRenderStats();
    nfRenderList();
  }

  // Semaphore-style concurrency
  const pool = [];
  for (const item of pending) {
    const p = processOne(item).then(() => pool.splice(pool.indexOf(p), 1));
    pool.push(p);
    if (pool.length >= CONCURRENCY) await Promise.race(pool);
  }
  await Promise.all(pool);

  // Reset file input
  const inp = gel('nfBulkInput');
  if (inp) inp.value = '';
}

async function nfAutoRegister(item) {
  const d = item.data;
  if (!d.cnpj || !d.numero || !d.fornecedor) {
    item.status = 'review'; return;
  }
  const r = await apiFetch('/api/nf', {
    method: 'POST',
    body:   JSON.stringify({
      cnpj:        d.cnpj,
      numero:      d.numero,
      dataEmissao: d.dataEmissao || '',
      fornecedor:  d.fornecedor,
      valor:       d.valor || null,
      companyId:   STATE.company?.id || null,
    }),
  });
  if (r && r.ok) {
    const saved  = await r.json();
    NF.list.unshift(saved);
    item.status = 'ok';
    item.nfId   = saved.id;
  } else {
    item.status = 'err';
    item.error  = `HTTP ${r?.status}`;
  }
}

/* ── QUEUE UI ── */
function nfQueueShow() {
  const el = gel('nfQueue');
  if (el) el.classList.remove('hidden');
  nfQueueRender();
}

function nfQueueClear() {
  NF.queue = [];
  const el = gel('nfQueue');
  if (el) el.classList.add('hidden');
}

function nfQueueRender() {
  const listEl = gel('nfQueueList');
  const progEl = gel('nfQueueProgress');
  if (!listEl) return;

  const done  = NF.queue.filter(i => i.status === 'ok').length;
  const total = NF.queue.length;
  if (progEl) progEl.textContent = `${done} de ${total} cadastradas`;

  listEl.innerHTML = NF.queue.map(item => {
    const icons = { pending:'&#9711;', reading:'&#128257;', ok:'&#10003;', err:'&#9888;', review:'&#9998;' };
    const cls   = { pending:'qi-pend', reading:'qi-read', ok:'qi-ok', err:'qi-err', review:'qi-rev' };
    const icon  = icons[item.status] || '?';
    const extra = item.status === 'ok'
      ? `<span class="qi-meta">${item.data?.fornecedor || ''} ${item.data?.numero ? '· NF '+item.data.numero : ''}</span>`
      : item.status === 'review'
      ? `<span class="qi-meta qi-rev-txt">Confianca baixa — <a href="#" onclick="nfQueueReview('${item.id}');return false;">revisar</a></span>`
      : item.status === 'err'
      ? `<span class="qi-meta qi-err-txt">${item.error}</span>`
      : item.status === 'reading'
      ? `<span class="qi-meta">Interpretando...</span>`
      : '';
    return `<div class="nf-queue-item ${cls[item.status] || ''}">
      <span class="qi-icon">${icon}</span>
      <span class="qi-name">${item.name}</span>
      ${extra}
    </div>`;
  }).join('');
}

function nfQueueReview(qid) {
  const item = NF.queue.find(i => i.id === qid);
  if (!item?.data) return;
  nfOpenForm();
  // Pre-fill the form with the interpreted data
  requestAnimationFrame(() => {
    if (item.data.cnpj)        gel('nfCnpj')?.setAttribute('value', item.data.cnpj);
    if (item.data.numero)      gel('nfNumero')?.setAttribute('value', item.data.numero);
    if (item.data.dataEmissao) gel('nfData')?.setAttribute('value', item.data.dataEmissao);
    if (item.data.fornecedor)  gel('nfFornecedor')?.setAttribute('value', item.data.fornecedor);
    if (item.data.valor)       gel('nfValor')?.setAttribute('value', item.data.valor);
    // Trigger re-render from DOM values
    ['nfCnpj','nfNumero','nfData','nfFornecedor','nfValor'].forEach(id => {
      const el = gel(id); if (el) el.value = el.getAttribute('value') || '';
    });
    const obs = item.data.observacao ? ` — ${item.data.observacao}` : '';
    const s = gel('nfAiStatus');
    if (s) { s.className = 'nf-ai-status nf-ai-err'; s.textContent = `Confianca baixa${obs}. Verifique os campos.`; }
    item.status = 'pending'; // remove from review so it doesn't re-appear as review
    NF.queue = NF.queue.filter(i => i.id !== qid);
    nfQueueRender();
  });
}

/* ── MASK HELPERS ── */
function nfMaskCnpj(input) {
  let v = input.value.replace(/\D/g,'').substring(0,14);
  if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/,'$1.$2.$3/$4-$5');
  else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/,'$1.$2.$3/$4');
  else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3}).*/,'$1.$2.$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3}).*/,'$1.$2');
  input.value = v;
}
function nfMaskDate(input) {
  let v = input.value.replace(/\D/g,'').substring(0,8);
  if (v.length > 4) v = v.replace(/^(\d{2})(\d{2})(\d{0,4}).*/,'$1/$2/$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,2}).*/,'$1/$2');
  input.value = v;
}

/* ── SUBMIT ── */
async function nfSubmit(e) {
  e.preventDefault();
  const payload = {
    cnpj:        gel('nfCnpj').value.trim(),
    numero:      gel('nfNumero').value.trim(),
    dataEmissao: gel('nfData').value.trim(),
    fornecedor:  gel('nfFornecedor').value.trim(),
    valor:       gel('nfValor').value.trim() || null,
    companyId:   STATE.company?.id || null,
  };

  const isEdit  = !!NF.selected;
  const url     = isEdit ? `/api/nf/${NF.selected}` : '/api/nf';
  const method  = isEdit ? 'PUT' : 'POST';

  const r = await apiFetch(url, { method, body: JSON.stringify(payload) });
  if (!r || !r.ok) {
    const err = r ? await r.json().catch(() => ({})) : {};
    toast('Erro: ' + (err.error || `HTTP ${r?.status}`)); return;
  }
  toast(isEdit ? 'NF atualizada.' : 'NF cadastrada.');
  nfCancelForm();
  await nfLoad();
}

/* ── DELETE ── */
async function nfDelete(id) {
  if (!confirm('Excluir esta nota fiscal?')) return;
  const r = await apiFetch(`/api/nf/${id}`, { method: 'DELETE' });
  if (!r || !r.ok) { toast('Erro ao excluir.'); return; }
  toast('NF excluida.');
  nfCancelForm();
  await nfLoad();
}

/* ── CANCEL ── */
function nfCancelForm() {
  NF.selected = null;
  NF.editing  = false;
  nfRenderList();
  const right = gel('nfRight');
  if (right) right.innerHTML = `<div class="nf-empty" id="nfEmpty">
    <div class="nf-empty-icon">&#129534;</div>
    <div>Selecione uma NF ao lado ou clique em <strong>+ Nova NF</strong></div>
  </div>`;
}

/* ════════════════════════════════════════════════════════════════════
   MÓDULO: CONTRATOS
   ════════════════════════════════════════════════════════════════════ */

const DEFAULT_CT_SCHEMA = [
  { id: 'f1', label: 'Nome do Cliente',    required: true  },
  { id: 'f2', label: 'CPF / CNPJ',         required: false },
  { id: 'f3', label: 'Cliente Chave',      required: false },
  { id: 'f4', label: 'Cidade',             required: false },
  { id: 'f5', label: 'Estado',             required: false },
  { id: 'f6', label: 'Filial',             required: false },
  { id: 'f7', label: 'Modelo',             required: false },
  { id: 'f8', label: 'Data de Instalacao', required: false },
];

const CT = {
  list:      [],
  editingId: null,
  sortField: 'f1',
  sortAsc:   true,
  schema:    DEFAULT_CT_SCHEMA.map(f => ({ ...f })),
};

let ctSchemaDraft = [];

// Normaliza contratos antigos (formato legado sem .fields) para o formato novo
function ctGetFields(ct) {
  if (ct.fields && Object.keys(ct.fields).length) return ct.fields;
  return {
    f1: ct.nomeCliente    || '',
    f2: ct.cpfCnpj        || '',
    f3: ct.clienteChave   || '',
    f4: ct.cidade         || '',
    f5: ct.estado         || '',
    f6: ct.filial         || '',
    f7: ct.modelo         || '',
    f8: ct.dataInstalacao || '',
  };
}

/* ── ENTRY ── */
function enterContratosView(tabEl) {
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  showView('contratos');
  ctLoad();
}

/* ── SCHEMA API ── */
async function apiGetCtSchema(companyId) {
  if (!companyId) return null;
  try {
    const r = await apiFetch(`/api/companies/${companyId}/ct-schema`);
    if (!r || !r.ok) return null;
    const data = await r.json();
    return Array.isArray(data) && data.length ? data : null;
  } catch { return null; }
}

/* ── LOAD ── */
async function ctLoad() {
  const companyId = STATE.company?.id;
  const [schemaData, r] = await Promise.all([
    apiGetCtSchema(companyId),
    apiFetch('/api/contratos' + (companyId ? '?companyId=' + companyId : '')),
  ]);
  CT.schema = schemaData || DEFAULT_CT_SCHEMA.map(f => ({ ...f }));
  CT.list   = (r && r.ok) ? await r.json() : [];
  const cfgBtn = gel('ctBtnCfgSchema');
  if (cfgBtn) {
    const canCfg = !!companyId;
    cfgBtn.classList.toggle('hidden', !canCfg);
  }
  ctRenderHead();
  ctRenderStats();
  ctRenderTable();
}

/* ── TABLE HEAD ── */
function ctRenderHead() {
  const thead = gel('ctThead');
  if (!thead) return;
  thead.innerHTML = '<tr>' +
    CT.schema.map(f =>
      `<th onclick="ctSort('${f.id}')">${f.label} <span class="ct-sort-icon" id="ctsi_${f.id}"></span></th>`
    ).join('') +
    '<th class="ct-th-action"></th></tr>';
}

/* ── STATS ── */
function ctRenderStats() {
  const total = CT.list.length;
  const el = gel('ctStats');
  if (!el) return;
  const statFields = CT.schema.slice(1, 4);
  const extras = statFields.map(f => {
    const unique = new Set(CT.list.map(c => ctGetFields(c)[f.id]).filter(Boolean)).size;
    return `<div class="ct-stat"><div class="ct-sv">${unique}</div><div class="ct-sl">${f.label}s</div></div>`;
  }).join('');
  el.innerHTML = `<div class="ct-stat"><div class="ct-sv">${total}</div><div class="ct-sl">Contratos</div></div>${extras}`;
}

/* ── SORT ── */
function ctSort(field) {
  if (CT.sortField === field) CT.sortAsc = !CT.sortAsc;
  else { CT.sortField = field; CT.sortAsc = true; }
  ctRenderTable();
}

/* ── TABLE ── */
function ctRenderTable() {
  const q     = (gel('ctSearch')?.value || '').toLowerCase();
  const body  = gel('ctBody');
  const empty = gel('ctEmpty');
  if (!body) return;

  CT.schema.forEach(f => {
    const el = gel('ctsi_' + f.id);
    if (el) el.textContent = CT.sortField === f.id ? (CT.sortAsc ? ' ▲' : ' ▼') : '';
  });

  let list = CT.list.filter(c => {
    if (!q) return true;
    return Object.values(ctGetFields(c)).some(v => (v || '').toLowerCase().includes(q));
  });

  list = list.slice().sort((a, b) => {
    const va = (ctGetFields(a)[CT.sortField] || '').toLowerCase();
    const vb = (ctGetFields(b)[CT.sortField] || '').toLowerCase();
    return CT.sortAsc ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR');
  });

  if (!list.length) {
    body.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  body.innerHTML = list.map(c => {
    const fields = ctGetFields(c);
    const cells  = CT.schema.map((f, i) => {
      const v   = fields[f.id] || '—';
      const cls = i === 0 ? 'ct-td ct-td-name' : 'ct-td';
      return `<td class="${cls}">${v}</td>`;
    }).join('');
    return `<tr class="ct-row" onclick="ctOpenForm('${c.id}')">
      ${cells}
      <td class="ct-td ct-td-action">
        <button class="ct-edit-btn" onclick="event.stopPropagation();ctOpenForm('${c.id}')">&#9998;</button>
      </td>
    </tr>`;
  }).join('');
}

/* ── FORM ── */
function ctOpenForm(id) {
  CT.editingId = id || null;
  const ct = id ? CT.list.find(c => c.id === id) : null;
  gel('ctModalTitle').textContent = ct ? 'Editar Contrato' : 'Novo Contrato';
  gel('ctBtnSave').textContent    = ct ? 'Salvar alteracoes' : 'Cadastrar';
  gel('ctBtnDel').classList.toggle('hidden', !ct);

  const existing = ct ? ctGetFields(ct) : {};
  const grid = gel('ctFormFields');
  if (grid) {
    grid.innerHTML = CT.schema.map((f, i) => {
      const val      = (existing[f.id] || '').replace(/"/g, '&quot;');
      const spanCls  = i === 0 ? ' ct-span2' : '';
      const reqStar  = f.required ? ' <span class="ct-req">*</span>' : '';
      const reqAttr  = f.required ? ' required' : '';
      return `<div class="ct-field${spanCls}">
        <label class="ct-label">${f.label}${reqStar}</label>
        <input class="ct-input" id="ctf_${f.id}" type="text" value="${val}"${reqAttr}>
      </div>`;
    }).join('');
  }

  gel('ctModal').classList.remove('hidden');
  const filesSection = gel('ctFilesSection');
  if (filesSection) {
    filesSection.classList.toggle('hidden', !id);
    if (id) ctRenderFiles();
  }
}

function ctCloseForm() {
  gel('ctModal').classList.add('hidden');
  CT.editingId = null;
}

/* ── MASKS ── */
function ctMaskDoc(input) {
  let v = input.value.replace(/\D/g,'');
  if (v.length <= 11) {
    if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/,'$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3}).*/,'$1.$2.$3');
    else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3}).*/,'$1.$2');
  } else {
    v = v.substring(0,14);
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/,'$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/,'$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3}).*/,'$1.$2.$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3}).*/,'$1.$2');
  }
  input.value = v;
}
function ctMaskDate(input) {
  let v = input.value.replace(/\D/g,'').substring(0,8);
  if (v.length > 4) v = v.replace(/^(\d{2})(\d{2})(\d{0,4}).*/,'$1/$2/$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,2}).*/,'$1/$2');
  input.value = v;
}

/* ── SUBMIT ── */
async function ctSubmit(e) {
  e.preventDefault();
  const fields = {};
  CT.schema.forEach(f => {
    const el = gel('ctf_' + f.id);
    if (el) fields[f.id] = el.value.trim();
  });
  const payload = { fields, companyId: STATE.company?.id || null };
  const isEdit = !!CT.editingId;
  const url    = isEdit ? `/api/contratos/${CT.editingId}` : '/api/contratos';
  const method = isEdit ? 'PUT' : 'POST';
  const r = await apiFetch(url, { method, body: JSON.stringify(payload) });
  if (!r || !r.ok) {
    const err = r ? await r.json().catch(() => ({})) : {};
    toast('Erro: ' + (err.error || `HTTP ${r?.status}`)); return;
  }
  const saved = await r.json();
  await ctLoad();
  if (isEdit) {
    toast('Contrato atualizado.');
    ctCloseForm();
  } else {
    // Apos criar, transiciona para edicao para permitir anexar arquivos
    toast('Contrato cadastrado. Adicione arquivos se necessario.');
    CT.editingId = saved.id;
    gel('ctModalTitle').textContent = 'Editar Contrato';
    gel('ctBtnSave').textContent    = 'Salvar alteracoes';
    gel('ctBtnDel').classList.remove('hidden');
    const filesSection = gel('ctFilesSection');
    if (filesSection) { filesSection.classList.remove('hidden'); ctRenderFiles(); }
  }
}

/* ── SCHEMA MODAL ── */
function ctOpenSchemaModal() {
  ctSchemaDraft = CT.schema.map(f => ({ ...f }));
  ctRenderSchemaFields();
  gel('ctSchemaModal').classList.remove('hidden');
}

function ctCloseSchemaModal() {
  gel('ctSchemaModal').classList.add('hidden');
}

function ctRenderSchemaFields() {
  const el = gel('ctSchemaFields');
  if (!el) return;
  el.innerHTML = ctSchemaDraft.map((f, i) => {
    const isFirst = i === 0;
    const dis     = isFirst ? ' disabled' : '';
    const chk     = (isFirst || f.required) ? ' checked' : '';
    const safeVal = (f.label + '').replace(/"/g, '&quot;');
    return `<div class="ct-schema-row">
      <span class="ct-schema-num">${i + 1}</span>
      <input class="ct-input ct-schema-label-input" id="ctsl_${f.id}" value="${safeVal}" placeholder="Nome do campo"${isFirst ? ' required' : ''}>
      <label class="ct-schema-req-label">
        <input type="checkbox" id="ctsr_${f.id}"${chk}${dis}> Obrig.
      </label>
      <button class="ct-schema-del-btn" onclick="ctSchemaRemoveField('${f.id}')"${dis} title="Remover campo">&#215;</button>
    </div>`;
  }).join('');
  const addBtn = gel('ctSchemaAddBtn');
  if (addBtn) addBtn.disabled = ctSchemaDraft.length >= 10;
}

function ctSchemaAddField() {
  if (ctSchemaDraft.length >= 10) return;
  const usedIds = new Set(ctSchemaDraft.map(f => f.id));
  let nextId = null;
  for (let n = 1; n <= 10; n++) {
    if (!usedIds.has('f' + n)) { nextId = 'f' + n; break; }
  }
  if (!nextId) return;
  ctSchemaDraft.push({ id: nextId, label: '', required: false });
  ctRenderSchemaFields();
  const inp = gel('ctsl_' + nextId);
  if (inp) setTimeout(() => inp.focus(), 30);
}

function ctSchemaRemoveField(id) {
  if (ctSchemaDraft[0]?.id === id) return;
  ctSchemaDraft = ctSchemaDraft.filter(f => f.id !== id);
  ctRenderSchemaFields();
}

async function ctSaveSchema() {
  const schema = ctSchemaDraft.map((f, i) => {
    const labelEl = gel('ctsl_' + f.id);
    const reqEl   = gel('ctsr_' + f.id);
    return {
      id:       f.id,
      label:    (labelEl?.value || '').trim(),
      required: i === 0 ? true : (reqEl?.checked || false),
    };
  }).filter(f => f.label);

  if (!schema.length) { toast('Adicione ao menos um campo com nome.'); return; }
  const companyId = STATE.company?.id;
  if (!companyId) { toast('Nenhuma empresa selecionada.'); return; }

  const r = await apiFetch(`/api/companies/${companyId}/ct-schema`, {
    method: 'PUT',
    body:   JSON.stringify({ fields: schema }),
  });
  if (!r || !r.ok) {
    const err = r ? await r.json().catch(() => ({})) : {};
    toast('Erro: ' + (err.error || 'Falha ao salvar.')); return;
  }
  CT.schema = await r.json();
  ctCloseSchemaModal();
  ctRenderHead();
  ctRenderStats();
  ctRenderTable();
  showCrf(true, 'Campos atualizados', 'A configuracao de campos foi salva. Os novos campos estarao disponiveis ao cadastrar contratos.');
}

/* ── DELETE ── */
async function ctDelete() {
  if (!CT.editingId || !confirm('Excluir este contrato?')) return;
  const r = await apiFetch(`/api/contratos/${CT.editingId}`, { method: 'DELETE' });
  if (!r || !r.ok) { toast('Erro ao excluir.'); return; }
  toast('Contrato excluido.');
  ctCloseForm();
  await ctLoad();
}

/* ── CT FILES ── */
function ctFileIcon(mime) {
  if (!mime) return '&#128196;';
  if (mime.startsWith('image/'))       return '&#128444;';
  if (mime === 'application/pdf')      return '&#128196;';
  if (mime.includes('word'))           return '&#128221;';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '&#128202;';
  return '&#128196;';
}

function ctFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function ctRenderFiles() {
  const el = gel('ctFilesList');
  if (!el || !CT.editingId) return;
  const ct = CT.list.find(c => c.id === CT.editingId);
  const files = ct?.files || [];
  if (!files.length) {
    el.innerHTML = '<div class="ct-files-empty">Nenhum arquivo anexado.</div>';
    return;
  }
  el.innerHTML = files.map(f => `
    <div class="ct-file-item" id="ctfi_${f.id}">
      <span class="ct-file-icon">${ctFileIcon(f.mime)}</span>
      <div class="ct-file-info">
        <div class="ct-file-name">${f.name}</div>
        <div class="ct-file-meta">${ctFileSize(f.size)} &bull; ${f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString('pt-BR') : ''}</div>
      </div>
      <a class="ct-file-open" href="/api/contratos/${CT.editingId}/files/${f.id}" target="_blank" rel="noopener">Abrir</a>
      <button class="ct-file-del" onclick="ctDeleteFile('${f.id}')" title="Remover">&#128465;</button>
    </div>`).join('');
}

async function ctUploadFiles(filesRaw) {
  const files = Array.from(filesRaw);
  if (!files.length || !CT.editingId) return;

  const el = gel('ctFilesList');
  for (const file of files) {
    const tmpId = 'tmp_' + Date.now();
    // Show uploading placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'ct-file-item ct-file-uploading';
    placeholder.id = 'ctfi_' + tmpId;
    placeholder.innerHTML = `<span class="ct-file-icon">&#128257;</span><div class="ct-file-info"><div class="ct-file-name">${file.name}</div><div class="ct-file-meta">Enviando...</div></div>`;
    el?.appendChild(placeholder);

    try {
      const ext  = file.name.split('.').pop().toLowerCase();
      const mime = file.type || (ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg');
      const b64  = await fileToBase64(file);

      const r = await apiFetch(`/api/contratos/${CT.editingId}/files`, {
        method: 'POST',
        body:   JSON.stringify({ name: file.name, mime, data: b64 }),
      });
      if (!r || !r.ok) {
        const err = r ? await r.json().catch(() => ({})) : {};
        throw new Error(err.error || `HTTP ${r?.status}`);
      }
      const saved = await r.json();
      // Update local list
      const ct = CT.list.find(c => c.id === CT.editingId);
      if (ct) { ct.files = ct.files || []; ct.files.push(saved); }
      toast(`"${file.name}" anexado.`);
    } catch (e) {
      toast(`Erro ao enviar "${file.name}": ${e.message}`);
    }
    placeholder.remove();
  }
  gel('ctFileInput').value = '';
  ctRenderFiles();
  ctRenderTable(); // update table in case file count changes
}

async function ctDeleteFile(fid) {
  if (!CT.editingId || !confirm('Remover este arquivo?')) return;
  const r = await apiFetch(`/api/contratos/${CT.editingId}/files/${fid}`, { method: 'DELETE' });
  if (!r || !r.ok) { toast('Erro ao remover arquivo.'); return; }
  const ct = CT.list.find(c => c.id === CT.editingId);
  if (ct) ct.files = (ct.files || []).filter(f => f.id !== fid);
  ctRenderFiles();
}

/* ── INIT ────────────────────────────────────────────────────────── */
initApp();
