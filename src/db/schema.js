// src/db/schema.js
// Creación de tablas y seed inicial

import { query } from './database.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Categoría por defecto según fabricante ───────────────────────────────────
const CATEGORY_MAP = {
  'Dynatrace':         'observability',
  'Hitachi Vantara':   'infrastructure',
  'Veeam':             'infrastructure',
  'Extreme Networks':  'infrastructure',
  'Nutanix':           'infrastructure',
  'A10 Networks':      'infrastructure',
};
function inferCategory(name) {
  return CATEGORY_MAP[name] || 'security';
}

// ─── DDL ──────────────────────────────────────────────────────────────────────
export async function createTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      name         TEXT    NOT NULL,
      email        TEXT    UNIQUE NOT NULL,
      password_hash TEXT   NOT NULL,
      role         TEXT    NOT NULL DEFAULT 'analyst',
      active       BOOLEAN NOT NULL DEFAULT true,
      permissions  JSONB   DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Migración para añadir permissions a bases de datos existentes
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'`);
  } catch(e) { console.warn('No se pudo añadir columna permissions:', e.message); }

  await query(`
    CREATE TABLE IF NOT EXISTS catalog_manufacturers (
      id          SERIAL PRIMARY KEY,
      name        TEXT    UNIQUE NOT NULL,
      description TEXT,
      category    TEXT    NOT NULL DEFAULT 'security',
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS catalog_solutions (
      id              SERIAL PRIMARY KEY,
      manufacturer_id INTEGER NOT NULL REFERENCES catalog_manufacturers(id) ON DELETE CASCADE,
      name            TEXT    NOT NULL,
      products        JSONB   DEFAULT '[]',
      value_props     JSONB   DEFAULT '[]',
      UNIQUE(manufacturer_id, name)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS queries (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      company_name  TEXT    NOT NULL,
      manufacturer  TEXT    NOT NULL,
      solution      TEXT    NOT NULL,
      country       TEXT,
      notes         TEXT,
      result_json   JSONB,
      chat_history  JSONB   DEFAULT '[]',
      status        TEXT    NOT NULL DEFAULT 'pending',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS macro_queries (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      name        TEXT    NOT NULL,
      description TEXT,
      query_ids   JSONB   NOT NULL DEFAULT '[]',
      result_json JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS references_ctx (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id),
      title          TEXT    NOT NULL,
      url            TEXT,
      content_type   TEXT    DEFAULT 'url',
      extracted_text TEXT,
      active         BOOLEAN NOT NULL DEFAULT true,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('[DB] Tablas verificadas/creadas.');
}

// ─── Seed catálogo desde catalog.json ────────────────────────────────────────
export async function seedCatalog() {
  const catalogPath = path.join(__dirname, '..', '..', 'catalog.json');
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  } catch {
    console.warn('[Seed] catalog.json no encontrado, omitiendo seed de catálogo.');
    return;
  }

  for (const mf of catalog.manufacturers) {
    // Upsert fabricante
    const res = await query(`
      INSERT INTO catalog_manufacturers (name, description, category)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description
      RETURNING id
    `, [mf.name, mf.description || '', inferCategory(mf.name)]);

    const mfId = res.rows[0].id;

    for (const sol of (mf.solutions || [])) {
      await query(`
        INSERT INTO catalog_solutions (manufacturer_id, name, products, value_props)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (manufacturer_id, name) DO UPDATE
          SET products = EXCLUDED.products,
              value_props = EXCLUDED.value_props
      `, [mfId, sol.name,
          JSON.stringify(sol.products || []),
          JSON.stringify(sol.value   || [])]);
    }
  }
  console.log('[Seed] Catálogo cargado en BD.');
}

// ─── Seed admin inicial ───────────────────────────────────────────────────────
export async function seedAdmin() {
  if (process.env.ADMIN_ENABLED !== 'true') {
    console.log('[Seed] ADMIN_ENABLED=false — seed de admin omitido.');
    return;
  }

  const email = process.env.ADMIN_EMAIL    || 'admin@gamma.local';
  const pass  = process.env.ADMIN_PASSWORD || 'Admin1234!';
  const name  = process.env.ADMIN_NAME     || 'Administrador';

  const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (exists.rows.length > 0) {
    console.log('[Seed] Admin ya existe, omitiendo seed.');
    return;
  }

  const hash = await bcrypt.hash(pass, 12);
  await query(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, 'admin')
  `, [name, email, hash]);

  console.log(`[Seed] Admin inicial creado: ${email}`);
}

// ─── Seed configuración inicial ───────────────────────────────────────────────
export async function seedConfig() {
  const defaults = [
    ['gemini_model',  process.env.GEMINI_MODEL  || 'gemini-2.5-flash'],
    ['app_name',      'Gamma Portfolio Explorer'],
  ];

  for (const [key, value] of defaults) {
    await query(`
      INSERT INTO app_config (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO NOTHING
    `, [key, value]);
  }
  console.log('[Seed] Configuración inicial verificada.');
}

// ─── Bootstrap completo ───────────────────────────────────────────────────────
export async function initDatabase() {
  console.log('[DB] Inicializando base de datos...');
  await createTables();
  await seedCatalog();
  await seedAdmin();
  await seedConfig();
  console.log('[DB] Base de datos lista.');
}
