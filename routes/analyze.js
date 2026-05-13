const express   = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const router     = express.Router();

const client = new Anthropic();

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-7',
]);

function hasPdfContent(messages) {
  return messages.some(m =>
    Array.isArray(m.content) &&
    m.content.some(c => c.type === 'document' && c.source?.media_type === 'application/pdf')
  );
}

router.post('/', async (req, res) => {
  try {
    const { model, max_tokens, system, messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: 'Campo messages e obrigatorio.' } });
    }

    const safeModel = ALLOWED_MODELS.has(model) ? model : 'claude-sonnet-4-6';

    const createParams = {
      model:      safeModel,
      max_tokens: Number(max_tokens) || 1000,
      messages,
    };
    if (system) createParams.system = system;

    const betas = [];
    if (hasPdfContent(messages)) betas.push('pdfs-2024-09-25');

    const response = betas.length
      ? await client.beta.messages.create({ ...createParams, betas })
      : await client.messages.create(createParams);

    res.json(response);
  } catch (err) {
    console.error('[analyze]', err.message);
    const status = err.status || 500;
    const msg = err.error?.error?.message || err.message || 'Erro interno';
    res.status(status).json({ error: { message: msg } });
  }
});

module.exports = router;
