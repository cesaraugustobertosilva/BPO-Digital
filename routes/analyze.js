const express   = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const router     = express.Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-7',
  'claude-sonnet-4-20250514',
]);

router.post('/', async (req, res) => {
  try {
    const { model, max_tokens, system, messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: 'Campo messages e obrigatorio.' } });
    }

    const safeModel = ALLOWED_MODELS.has(model) ? model : 'claude-sonnet-4-6';

    const response = await client.messages.create({
      model:      safeModel,
      max_tokens: Number(max_tokens) || 1000,
      system,
      messages,
    });

    res.json(response);
  } catch (err) {
    console.error('[analyze]', err.message);
    const status = err.status || 500;
    res.status(status).json({ error: { message: err.message } });
  }
});

module.exports = router;
