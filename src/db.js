require('dotenv').config();
const { Pool } = require('pg');
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && process.env.NODE_ENV === 'production') {
  const sslMode = new URL(databaseUrl).searchParams.get('sslmode');
  if (!['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
    throw new Error('DATABASE_URL debe usar SSL. En Neon, utiliza la URL que incluye sslmode=require.');
  }
}

const pool = new Pool(databaseUrl
  ? { connectionString: databaseUrl }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'tecnokids'
    });
pool.on('error', e => console.error('Error de PostgreSQL:', e.message));
module.exports = pool;
