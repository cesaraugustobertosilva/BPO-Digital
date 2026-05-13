const express = require('express');
const router  = express.Router();
const { verifyPassword, generateToken, getOrSeedUsers, safeUser, requireAuth } = require('./auth-middleware');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Usuario e senha sao obrigatorios.' });
    const users = await getOrSeedUsers();
    const user  = users.find(u => u.username === username);
    if (!user || !verifyPassword(password, user.passwordHash))
      return res.status(401).json({ error: 'Usuario ou senha invalidos.' });
    res.json({ token: generateToken(user.id), user: safeUser(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', requireAuth, (req, res) => res.json(safeUser(req.user)));

router.post('/logout', (_req, res) => res.json({ ok: true }));

module.exports = router;
