const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const migrations = [
  'migracion-juegos.sql',
  'migracion-ruleta.sql',
  'migracion-rom.sql',
  'migracion-nuevos-juegos.sql'
];

async function setupDatabase() {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const schema = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8');
    await client.query(schema);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query('COMMIT');

    for (const name of migrations) {
      await client.query('BEGIN');
      try {
        const applied = await client.query(
          'SELECT 1 FROM schema_migrations WHERE name = $1',
          [name]
        );
        if (applied.rowCount) {
          await client.query('ROLLBACK');
          continue;
        }

        if (name === 'migracion-juegos.sql') {
          const existingSchema = await client.query(`
            SELECT
              to_regclass('public.user_pc') IS NOT NULL
              AND to_regclass('public.user_components') IS NOT NULL
              AND to_regclass('public.game_sessions') IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'player_progress'
                  AND column_name = 'coins'
              )
              AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'missions'
                  AND column_name = 'active'
              )
              AND EXISTS (
                SELECT 1 FROM achievements WHERE code = 'primer_arranque'
              ) AS applied
          `);
          if (existingSchema.rows[0].applied) {
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
            await client.query('COMMIT');
            console.log(`Migración existente registrada: ${name}`);
            continue;
          }
        }

        const sql = fs.readFileSync(path.join(__dirname, '../sql', name), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`Migración aplicada: ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    console.log('Base de datos lista.');
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

setupDatabase().catch(error => {
  console.error('No se pudo preparar la base de datos:', error.message);
  process.exitCode = 1;
});
