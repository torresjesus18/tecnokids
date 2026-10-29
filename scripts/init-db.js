const fs = require('fs'), path = require('path');
const pool = require('../src/db');
// Inicializa solo el esquema base; las funciones nuevas requieren sus migraciones aparte.
(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8'));
    console.log('Base de datos lista: tablas y datos iniciales creados.');
  } catch (e) {
    console.error('No se pudo inicializar la base de datos:', e.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
