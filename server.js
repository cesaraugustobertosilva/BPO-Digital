require('dotenv').config();
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/dossies', require('./routes/dossies'));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sobe o servidor apenas quando executado diretamente (local).
// No Vercel, o modulo e importado como funcao serverless.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SBK Portal Documental rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
