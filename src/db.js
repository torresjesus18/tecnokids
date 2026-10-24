require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'tecnokids'
    });
pool.on('error', e => console.error('Error de PostgreSQL:', e.message));
module.exports = pool;
