// ══════════════════════════════════════════════════════════════════════════
//  db.js  ·  SQLite database layer  ·  SPP-Gamma v1.1
// ══════════════════════════════════════════════════════════════════════════
const Database = require('better-sqlite3');
const path     = require('path');
const bcrypt   = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'spp_gamma.db');

// Asegurar que la carpeta data/ exista
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

const db = new Database(DB_PATH);

// ── Activar WAL + FK ───────────────────────────────────────────────────────
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    UNIQUE NOT NULL,
    name        TEXT,
    picture     TEXT,
    google_id   TEXT    UNIQUE,
    password    TEXT,                       -- bcrypt hash (login local)
    role        TEXT    NOT NULL DEFAULT 'user',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS queries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    company_name    TEXT    NOT NULL,
    manufacturer    TEXT    NOT NULL,
    solution        TEXT    NOT NULL,
    country         TEXT,
    notes           TEXT,
    result_json     TEXT,               -- respuesta completa de la IA en JSON
    tokens_input    INTEGER DEFAULT 0,
    tokens_output   INTEGER DEFAULT 0,
    tokens_total    INTEGER DEFAULT 0,
    model_used      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_queries_user   ON queries(user_id);
  CREATE INDEX IF NOT EXISTS idx_queries_key    ON queries(company_name, manufacturer, solution);
`);

// ── Seed: usuario admin local si no existe ──────────────────────────────────
function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gammaingenieros.com';
  const adminPass  = process.env.ADMIN_PASSWORD || 'Gamma2024!';
  const existing   = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPass, 10);
    db.prepare(`
      INSERT INTO users (email, name, password, role)
      VALUES (?, 'Admin Gamma', ?, 'admin')
    `).run(adminEmail, hash);
    console.log(`[DB] Admin local creado: ${adminEmail}`);
  }
}

// ── User helpers ────────────────────────────────────────────────────────────
const userDB = {
  findById:       (id)    => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  findByEmail:    (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
  findByGoogleId: (gid)   => db.prepare('SELECT * FROM users WHERE google_id = ?').get(gid),

  upsertGoogle(profile) {
    const existing = this.findByGoogleId(profile.id);
    if (existing) {
      db.prepare('UPDATE users SET name=?, picture=? WHERE id=?')
        .run(profile.displayName, profile.photos?.[0]?.value, existing.id);
      return this.findById(existing.id);
    }
    const email   = profile.emails?.[0]?.value;
    const byEmail = email ? this.findByEmail(email) : null;
    if (byEmail) {
      // Vincular Google a cuenta local existente
      db.prepare('UPDATE users SET google_id=?, picture=? WHERE id=?')
        .run(profile.id, profile.photos?.[0]?.value, byEmail.id);
      return this.findById(byEmail.id);
    }
    const info = db.prepare(`
      INSERT INTO users (email, name, picture, google_id, role)
      VALUES (?, ?, ?, ?, 'user')
    `).run(email, profile.displayName, profile.photos?.[0]?.value, profile.id);
    return this.findById(info.lastInsertRowid);
  }
};

// ── Query helpers ───────────────────────────────────────────────────────────
const queryDB = {
  /** Buscar resultado idéntico previo (cache) */
  findCached(companyName, manufacturer, solution) {
    return db.prepare(`
      SELECT * FROM queries
      WHERE company_name = ? AND manufacturer = ? AND solution = ?
        AND result_json IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).get(companyName, manufacturer, solution);
  },

  /** Guardar consulta nueva */
  save({ userId, companyName, manufacturer, solution, country, notes,
         resultJson, tokensInput, tokensOutput, tokensTotal, modelUsed }) {
    const info = db.prepare(`
      INSERT INTO queries
        (user_id, company_name, manufacturer, solution, country, notes,
         result_json, tokens_input, tokens_output, tokens_total, model_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId || null, companyName, manufacturer, solution,
      country || null, notes || null,
      resultJson ? JSON.stringify(resultJson) : null,
      tokensInput || 0, tokensOutput || 0, tokensTotal || 0, modelUsed || null
    );
    return info.lastInsertRowid;
  },

  /** Historial de un usuario (sin el JSON completo para listar) */
  listByUser(userId, limit = 50) {
    return db.prepare(`
      SELECT id, company_name, manufacturer, solution, country,
             tokens_total, model_used, created_at
      FROM queries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit);
  },

  /** Historial global (admin) */
  listAll(limit = 200) {
    return db.prepare(`
      SELECT q.id, q.company_name, q.manufacturer, q.solution, q.country,
             q.tokens_input, q.tokens_output, q.tokens_total, q.model_used, q.created_at,
             u.email AS user_email, u.name AS user_name
      FROM queries q
      LEFT JOIN users u ON u.id = q.user_id
      ORDER BY q.created_at DESC
      LIMIT ?
    `).all(limit);
  },

  /** Obtener resultado completo por ID */
  getById(id) {
    const row = db.prepare('SELECT * FROM queries WHERE id = ?').get(id);
    if (row && row.result_json) {
      try { row.result = JSON.parse(row.result_json); } catch {}
    }
    return row;
  },

  /** Estadísticas de tokens por usuario */
  tokenStats(userId) {
    return db.prepare(`
      SELECT
        COUNT(*) AS total_queries,
        SUM(tokens_input)  AS total_input,
        SUM(tokens_output) AS total_output,
        SUM(tokens_total)  AS total_tokens
      FROM queries WHERE user_id = ?
    `).get(userId);
  }
};

module.exports = { db, userDB, queryDB, seedAdmin };
