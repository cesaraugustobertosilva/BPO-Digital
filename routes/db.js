const fs   = require('fs');
const path = require('path');

const GH_TOKEN  = process.env.GITHUB_TOKEN;
const GH_OWNER  = process.env.GITHUB_OWNER || 'cesaraugustobertosilva';
const GH_REPO   = process.env.GITHUB_REPO  || 'BPO-Digital';
const GH_BRANCH = 'data';
const GH_BASE   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents`;

const LOCAL_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');

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

async function readData(name) {
  if (!GH_TOKEN) return readLocal(name);
  try {
    const file = await ghGet(`data/${name}.json`);
    if (!file) return null;
    const raw = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[db] readData ${name}:`, e.message);
    return null;
  }
}

async function writeData(name, data) {
  if (!GH_TOKEN) { writeLocal(name, data); return; }
  const content = JSON.stringify(data, null, 2);
  for (let i = 0; i < 3; i++) {
    try {
      const existing = await ghGet(`data/${name}.json`);
      await ghPut(`data/${name}.json`, content, existing?.sha);
      return;
    } catch (e) {
      if (i < 2 && e.status === 422) { await new Promise(r => setTimeout(r, 300 * (i + 1))); continue; }
      throw e;
    }
  }
}

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

module.exports = { readData, writeData };
