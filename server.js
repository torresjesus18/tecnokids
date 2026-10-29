require('dotenv').config();
// Punto de entrada: configura Express, sesiones persistentes, archivos públicos y API.
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./src/db');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatorio en producción.');
}
// Render termina TLS en un proxy; Express necesita confiar en ese proxy para cookies seguras.
if (isProduction) app.set('trust proxy', 1);

app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'tk.sid',
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'cambia-esto-en-el-env',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 7 * 864e5 }
}));
// Render usa esta ruta para comprobar que la aplicación también puede consultar PostgreSQL.
app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).send('ok');
  } catch (error) {
    console.error('Health check falló:', error);
    res.status(503).send('database unavailable');
  }
});
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', require('./src/routes'));
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Algo falló en el servidor. Inténtalo de nuevo.' });
});
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TecnoKids listo en http://localhost:${port}`));
