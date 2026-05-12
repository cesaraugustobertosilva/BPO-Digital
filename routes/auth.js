const express = require('express');
const router  = express.Router();
const { verifyPassword, generateToken, getOrSeedUsers, safeUser, requireAuth } = require('./auth-middleware');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Usuario e senha sao obrigatorios.' });
  const user = getOrSeedUsers().find(u => u.username === username);
  if (!user || !verifyPassword(password, user.passwordHash))
    return res.status(401).json({ error: 'Usuario ou senha invalidos.' });
  res.json({ token: generateToken(user.id), user: safeUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json(safeUser(req.user)));

// POST /api/auth/logout
router.post('/logout', (_req, res) => res.json({ ok: true }));

module.exports = router;
