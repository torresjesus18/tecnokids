// Temporal: aplica sql/migracion-juegos.sql (idempotente) y muestra las insignias.
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');
(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, '../sql/migracion-juegos.sql'), 'utf8'));
  const r = await pool.query('SELECT code, name, icon FROM achievements ORDER BY id');
  console.log(r.rows.map(a => `${a.icon} ${a.code} · ${a.name}`).join('\n'));
  const m = await pool.query('SELECT slug, title, active FROM missions WHERE active ORDER BY id');
  console.log('misiones activas:', m.rows.map(x => x.slug).join(', '));
  await pool.end();
})().catch(async e => { console.error('ERROR', e.message); await pool.end(); process.exit(1); });
