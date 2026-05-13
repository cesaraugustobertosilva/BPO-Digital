const express   = require('express');
const router    = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const CNJ_KEY  = process.env.CNJ_API_KEY || 'cDZHYzlZa0JadVREZDJCendOMFRvQT09';
const CNJ_BASE = 'https://api-publica.datajud.cnj.jus.br';

const TRIBUNAIS_TRABALHISTAS = [
  'trt1','trt2','trt3','trt4','trt5','trt6','trt7','trt8','trt9','trt10',
  'trt11','trt12','trt13','trt14','trt15','trt16','trt17','trt18','trt19',
  'trt20','trt21','trt22','trt23','trt24','tst',
];

async function queryDataJud(index, query) {
  const resp = await fetch(`${CNJ_BASE}/api_publica_${index}/_search`, {
    method:  'POST',
    headers: {
      Authorization:    `APIKey ${CNJ_KEY}`,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.hits?.hits || []).map(h => ({ ...h._source, _tribunal: index.toUpperCase() }));
}

// POST /api/labor/search
router.post('/search', async (req, res) => {
  try {
    const { cpf, name, tribunal } = req.body;
    if (!cpf && !name) return res.status(400).json({ error: 'CPF ou nome obrigatorio.' });

    const cpfFormatted = (cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    const cpfClean     = (cpf || '').replace(/\D/g, '');

    const shouldClauses = [];
    if (name)         shouldClauses.push({ match_phrase: { 'partes.nome': name } });
    if (cpfFormatted) shouldClauses.push({ match_phrase: { 'partes.nome': cpfFormatted } });
    if (cpfClean)     shouldClauses.push({ match:        { 'partes.cpf':  cpfClean } });

    const esQuery = {
      query: {
        nested: {
          path:  'partes',
          query: { bool: { should: shouldClauses, minimum_should_match: 1 } },
        },
      },
      size: 20,
      sort: [{ dataAjuizamento: { order: 'desc' } }],
    };

    const indices = tribunal ? [tribunal] : TRIBUNAIS_TRABALHISTAS;

    // Fan out to all TRTs in parallel, cap at 10 concurrent
    const chunks   = [];
    for (let i = 0; i < indices.length; i += 10) chunks.push(indices.slice(i, i + 10));
    let processes  = [];
    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map(idx => queryDataJud(idx, esQuery)));
      results.forEach(r => { if (r.status === 'fulfilled') processes.push(...r.value); });
    }

    processes.sort((a, b) => new Date(b.dataAjuizamento) - new Date(a.dataAjuizamento));
    res.json({ total: processes.length, processes: processes.slice(0, 30) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/labor/analyze
router.post('/analyze', async (req, res) => {
  try {
    const { processo } = req.body;
    if (!processo) return res.status(400).json({ error: 'Dados do processo obrigatorios.' });

    const client = new Anthropic();
    const prompt = `Voce e um especialista em direito trabalhista brasileiro. Analise os dados deste processo e responda APENAS com JSON valido, sem texto extra:

${JSON.stringify(processo, null, 2)}

Retorne exatamente este formato:
{
  "tipo_acao": "nome da acao trabalhista",
  "pedidos_provaveis": ["lista dos pedidos/verbas mais provaveis com base na classe e movimentos"],
  "empresa_reclamada": "nome da empresa reclamada ou null",
  "fase_atual": "fase processual atual com base nos movimentos",
  "status_resumido": "frase curta sobre o status atual",
  "risco": "alto|medio|baixo",
  "valor_causa": "valor em reais ou nao informado",
  "resumo_inicial": "resumo de 2-3 frases sobre o caso, inferindo os fatos da inicial com base nos dados disponiveis",
  "pontos_atencao": ["lista de pontos criticos para o RH/empresa"],
  "inicial_reconstituida": {
    "fatos_alegados": "narrativa dos fatos da inicial reconstituida com base nos dados do processo (2-4 frases)",
    "fundamentos_juridicos": ["CLT art. X - descricao do motivo", "Sumula TST N - descricao"],
    "pedidos_detalhados": ["Pedido 1 com estimativa de valor se possivel", "Pedido 2..."],
    "documentos_provaveis": ["documento que provavelmente foi juntado na inicial", "..."]
  }
}`;

    const msg = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1800,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw = msg.content.find(c => c.type === 'text')?.text || '{}';
    res.json(JSON.parse(raw.replace(/```json\n?|```/g, '').trim()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
