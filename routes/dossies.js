const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const DATA_DIR  = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'dossies.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readDossies() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function writeDossies(list) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

function seed() {
  const now = Date.now();
  return [
    {
      id: 'demo1', ts: now - 86400000 * 2,
      name: 'Ana Beatriz Souza', cpf: '123.456.789-00', mat: '00541',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional'],
      missing_req: [], total: 5, req: 5,
    },
    {
      id: 'demo2', ts: now - 86400000 * 5,
      name: 'Carlos Eduardo Lima', cpf: '987.654.321-00', mat: '00312',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho'],
      missing_req: ['Ficha de Admissao', 'Exame Admissional'], total: 3, req: 3,
    },
    {
      id: 'demo3', ts: now - 86400000 * 8,
      name: 'Fernanda Costa Ribeiro', cpf: '456.789.123-00', mat: '00218',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao', 'Exame Admissional', 'Foto 3x4'],
      missing_req: [], total: 6, req: 5,
    },
    {
      id: 'demo4', ts: now - 86400000 * 3,
      name: 'Ricardo Almeida Neto', cpf: '321.654.987-00', mat: '00710',
      docs: ['CPF', 'Contrato de Trabalho', 'Ficha de Admissao'],
      missing_req: ['CNH / RG / Documento de Identidade', 'Exame Admissional'], total: 3, req: 3,
    },
    {
      id: 'demo5', ts: now - 86400000 * 1,
      name: 'Juliana Martins Freitas', cpf: '111.222.333-00', mat: '00889',
      docs: ['CNH / RG / Documento de Identidade', 'CPF', 'Contrato de Trabalho', 'Ficha de Admissao'],
      missing_req: ['Exame Admissional'], total: 4, req: 4,
    },
  ];
}

function getOrSeed() {
  const list = readDossies();
  if (!list.length) {
    const s = seed();
    writeDossies(s);
    return s;
  }
  return list;
}

router.get('/', (_req, res) => {
  try { res.json(getOrSeed()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', (req, res) => {
  try {
    const entry = getOrSeed().find(d => d.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Dossie nao encontrado.' });
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.id) return res.status(400).json({ error: 'Payload invalido.' });
    const list = getOrSeed();
    const idx  = list.findIndex(d => d.id === entry.id);
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    writeDossies(list.slice(0, 500));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    writeDossies(getOrSeed().filter(d => d.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
