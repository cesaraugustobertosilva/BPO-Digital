require('dotenv').config();
const express    = require('express');
const path       = require('path');
const ipFilter   = require('./middleware/ipFilter');
const { requireAuth } = require('./routes/auth-middleware');
const { storageStatus } = require('./routes/db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(ipFilter);
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/analyze',   requireAuth, require('./routes/analyze'));
app.use('/api/companies', requireAuth, require('./routes/companies'));
app.use('/api/dossies',   requireAuth, require('./routes/dossies'));
app.use('/api/labor',     requireAuth, require('./routes/labor'));

// Diagnostico de storage (admin only via token)
app.get('/api/status', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin apenas.' });
  res.json({ ok: true, storage: storageStatus(), user: req.user?.username });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`SBK Portal Documental rodando em http://localhost:${PORT}`));
}

module.exports = app;
