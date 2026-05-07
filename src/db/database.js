// src/db/database.js
// Pool de conexiones PostgreSQL — singleton

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'gamma',
  user:     process.env.DB_USER     || 'gamma',
  password: process.env.DB_PASSWORD || 'gamma_secret',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en cliente PostgreSQL:', err.message);
});

/**
 * Ejecuta una query con parámetros.
 * @param {string} text   - SQL
 * @param {Array}  params - Parámetros posicionales
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] query (${duration}ms): ${text.slice(0, 80)}`);
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

export { pool };
export default { query, pool };
