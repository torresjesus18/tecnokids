const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('./db');
const ProgressService = require('./ProgressService');

const router = express.Router();
const progress = new ProgressService();
// Adapta promesas a Express 4 para que los errores lleguen al middleware final.
const h = fn => (req, res, next) => fn(req, res).catch(next);
// Protege las rutas de progreso, compras, partidas y premios con la sesión vigente.
const auth = (req, res, next) => req.session.userId ? next() : res.status(401).json({ error: 'Inicia sesión para continuar' });

// Registro, hash de contraseña, saldo inicial y sesión se crean como una sola operación.
router.post('/auth/register', h(async (req, res) => {
  const { username = '', email = '', password = '' } = req.body || {};
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'El alias debe tener 3 a 20 letras, números o guion bajo' });
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || email.length > 120) return res.status(400).json({ error: 'Escribe un correo válido' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' });
  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3) RETURNING id', [username, email.toLowerCase(), hash]);
    await client.query('INSERT INTO player_progress (user_id, coins) VALUES ($1, 20)', [r.rows[0].id]);
    await client.query('COMMIT');
    req.session.userId = r.rows[0].id;
    res.status(201).json({ username });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Ese alias o correo ya está en uso' });
    throw e;
  } finally { client.release(); }
}));

router.post('/auth/login', h(async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const r = await pool.query('SELECT id, username, password_hash FROM users WHERE email=$1', [String(email).toLowerCase()]);
  const ok = r.rows[0] && await bcrypt.compare(String(password), r.rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  // Regenerar el identificador evita reutilizar una sesión previa al iniciar sesión.
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Error interno del servidor' });
    req.session.userId = r.rows[0].id;
    res.json({ username: r.rows[0].username });
  });
}));

router.post('/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('tk.sid'); res.json({ ok: true }); }));

router.get('/auth/me', h(async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const r = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId]);
  res.json({ user: r.rows[0] || null });
}));

router.get('/progress', auth, h(async (req, res) => {
  const p = await progress.getProgress(req.session.userId);
  if (!p) return res.status(401).json({ error: 'Inicia sesión para continuar' });
  res.json(p);
}));

router.get('/pc', auth, h(async (req, res) => res.json(await progress.getPc(req.session.userId))));

// Errores "de usuario" (mensajes pensados para el niño) salen con 400; el resto va al manejador general.
const act = fn => h(async (req, res) => {
  try { res.json(await fn(req.session.userId, req.body || {})); }
  catch (e) { if (e.user) return res.status(400).json({ error: e.message }); throw e; }
});
router.post('/shop/buy', auth, act((id, b) => progress.buy(id, String(b.code || ''))));
router.post('/pc/equip', auth, act((id, b) => progress.equip(id, b)));
router.post('/games/start', auth, act((id, b) => progress.startGame(
  id, String(b.game || ''), String(b.difficulty || 'medio'), b.renderMode == null ? undefined : String(b.renderMode)
)));
router.post('/games/finish', auth, act((id, b) => progress.finishGame(id, b.sessionId, b)));
router.get('/roulette', auth, h(async (req, res) => res.json(await progress.roulette(req.session.userId))));
router.post('/roulette/spin', auth, act(id => progress.spin(id)));

module.exports = router;