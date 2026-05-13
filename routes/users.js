const express = require('express');
const router  = express.Router();
const { readData, writeData } = require('./db');
const { hashPassword, getOrSeedUsers, safeUser, requireAuth, requireAdmin } = require('./auth-middleware');

router.use(requireAuth, requireAdmin);

router.get('/', async (_req, res) => {
  try {
    res.json((await getOrSeedUsers()).map(safeUser));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { username, name, role, companyId, departmentId, password, modules } = req.body;
    if (!username || !name || !role || !password)
      return res.status(400).json({ error: 'Campos obrigatorios: username, name, role, password.' });
    const list = await getOrSeedUsers();
    if (list.find(u => u.username === username))
      return res.status(400).json({ error: 'Nome de usuario ja em uso.' });
    const user = {
      id: 'user_' + Date.now(), username, name, role,
      companyId:    companyId    || null,
      departmentId: departmentId || null,
      modules:      Array.isArray(modules) ? modules : [],
      passwordHash: hashPassword(password),
    };
    list.push(user);
    await writeData('users', list);
    res.json(safeUser(user));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const list = await getOrSeedUsers();
    const idx  = list.findIndex(u => u.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Usuario nao encontrado.' });
    const { password, passwordHash, ...updates } = req.body;
    list[idx] = { ...list[idx], ...updates, id: list[idx].id };
    if (password) list[idx].passwordHash = hashPassword(password);
    await writeData('users', list);
    res.json(safeUser(list[idx]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'Nao e possivel excluir o proprio usuario.' });
    const list = await getOrSeedUsers();
    await writeData('users', list.filter(u => u.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
