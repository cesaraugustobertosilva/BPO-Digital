const express = require('express');
const router  = express.Router();
const { hashPassword, readUsers, writeUsers, getOrSeedUsers, safeUser, requireAuth, requireAdmin } = require('./auth-middleware');

router.use(requireAuth, requireAdmin);

// GET /api/users
router.get('/', (_req, res) => {
  try { res.json(getOrSeedUsers().map(safeUser)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users
router.post('/', (req, res) => {
  try {
    const { username, name, role, companyId, departmentId, password } = req.body;
    if (!username || !name || !role || !password)
      return res.status(400).json({ error: 'Campos obrigatorios: username, name, role, password.' });
    const list = getOrSeedUsers();
    if (list.find(u => u.username === username))
      return res.status(400).json({ error: 'Nome de usuario ja em uso.' });
    const user = {
      id: 'user_' + Date.now(), username, name, role,
      companyId:    companyId    || null,
      departmentId: departmentId || null,
      passwordHash: hashPassword(password),
    };
    list.push(user);
    writeUsers(list);
    res.json(safeUser(user));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  try {
    const list = getOrSeedUsers();
    const idx  = list.findIndex(u => u.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Usuario nao encontrado.' });
    const { password, passwordHash, ...updates } = req.body;
    list[idx] = { ...list[idx], ...updates, id: list[idx].id };
    if (password) list[idx].passwordHash = hashPassword(password);
    writeUsers(list);
    res.json(safeUser(list[idx]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'Nao e possivel excluir o proprio usuario.' });
    writeUsers(getOrSeedUsers().filter(u => u.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
