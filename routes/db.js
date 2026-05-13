/**
 * Storage layer com suporte a tres backends, em ordem de prioridade:
 *
 * 1. Upstash Redis   — configure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN no Vercel
 *                      Crie gratis em: https://console.upstash.com
 *
 * 2. GitHub Contents — configure GITHUB_TOKEN (PAT com repo write) + GITHUB_OWNER + GITHUB_REPO
 *                      Cria/atualiza arquivos JSON no branch "data" do repositorio.
 *
 * 3. Filesystem local — apenas para desenvolvimento. No Vercel usa /tmp (volatil).
 */

const fs   = require('fs');
const path = require('path');

/* ── UPSTASH ─────────────────────────────────────────────────────── */
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY_PREFIX    = 'sbk:';

async function upstashCall(commands) {
  const resp = await fetch(`${UPSTASH_URL}/pipeline`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(commands),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Upstash pipeline ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function upstashGet(name) {
  const results = await upstashCall([['GET', KEY_PREFIX + name]]);
  const raw = results[0]?.result;
  if (!raw) return null;
  return JSON.parse(raw);
}

async function upstashSet(name, data) {
  await upstashCall([['SET', KEY_PREFIX + name, JSON.stringify(data)]]);
}

/* ── GITHUB CONTENTS (fallback) ──────────────────────────────────── */
const GH_TOKEN  = process.env.GITHUB_TOKEN;
const GH_OWNER  = process.env.GITHUB_OWNER || 'cesaraugustobertosilva';
const GH_REPO   = process.env.GITHUB_REPO  || 'BPO-Digital';
const GH_BRANCH = 'data';
const GH_BASE   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents`;

function ghHeaders() {
  return {
    Authorization:          `Bearer ${GH_TOKEN}`,
    Accept:                 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghGet(filePath) {
  const resp = await fetch(`${GH_BASE}/${filePath}?ref=${GH_BRANCH}`, { headers: ghHeaders() });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub GET ${filePath}: ${resp.status}`);
  return resp.json();
}

async function ghPut(filePath, content, sha) {
  const body = {
    message: `data: update ${path.basename(filePath)}`,
    content: Buffer.from(content).toString('base64'),
    branch:  GH_BRANCH,
  };
  if (sha) body.sha = sha;
  const resp = await fetch(`${GH_BASE}/${filePath}`, {
    method:  'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const e   = new Error(`GitHub PUT ${filePath}: ${resp.status} ${err.message || ''}`);
    e.status  = resp.status;
    throw e;
  }
}

async function githubRead(name) {
  const file = await ghGet(`data/${name}.json`);
  if (!file) return null;
  const raw = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return JSON.parse(raw);
}

async function githubWrite(name, data) {
  const content = JSON.stringify(data, null, 2);
  for (let i = 0; i < 3; i++) {
    try {
      const existing = await ghGet(`data/${name}.json`);
      await ghPut(`data/${name}.json`, content, existing?.sha);
      return;
    } catch (e) {
      if (i < 2 && e.status === 422) {
        await new Promise(r => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

/* ── LOCAL FILESYSTEM ────────────────────────────────────────────── */
const LOCAL_DIR = process.env.VERCEL
  ? '/tmp'
  : path.join(__dirname, '..', 'data');

function readLocal(name) {
  try {
    if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
    return JSON.parse(fs.readFileSync(path.join(LOCAL_DIR, `${name}.json`), 'utf8'));
  } catch { return null; }
}

function writeLocal(name, data) {
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOCAL_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

/* ── BACKEND SELECTION ───────────────────────────────────────────── */
const BACKEND = UPSTASH_URL ? 'upstash'
              : GH_TOKEN    ? 'github'
              : 'local';

if (BACKEND === 'local' && process.env.VERCEL) {
  console.warn(
    '[db] DADOS NAO SERAO PERSISTIDOS!\n' +
    '     Configure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN no Vercel.\n' +
    '     Instrucoes: https://console.upstash.com'
  );
} else {
  console.log(`[db] Backend de armazenamento: ${BACKEND}`);
}

/* ── PUBLIC API ──────────────────────────────────────────────────── */
async function readData(name) {
  try {
    if (BACKEND === 'upstash') return await upstashGet(name);
    if (BACKEND === 'github')  return await githubRead(name);
    return readLocal(name);
  } catch (e) {
    console.error(`[db] readData(${name}) falhou:`, e.message);
    return null;
  }
}

async function writeData(name, data) {
  try {
    if (BACKEND === 'upstash') { await upstashSet(name, data); return; }
    if (BACKEND === 'github')  { await githubWrite(name, data); return; }
    writeLocal(name, data);
  } catch (e) {
    console.error(`[db] writeData(${name}) falhou:`, e.message);
    throw e;
  }
}

/* Retorna estado do storage para o endpoint de status */
function storageStatus() {
  return {
    backend:  BACKEND,
    upstash:  !!UPSTASH_URL,
    github:   !!GH_TOKEN,
    volatile: BACKEND === 'local' && !!process.env.VERCEL,
  };
}

module.exports = { readData, writeData, storageStatus };
