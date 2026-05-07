// src/routes/admin.js — Panel de administración

import express from 'express';
import bcrypt  from 'bcryptjs';
import { query } from '../db/database.js';
import { requireAuth }  from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ── Usuarios ───────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, active, permissions, created_at, updated_at FROM users ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error listando usuarios.', details: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role = 'analyst' } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos.' });
    }
    if (!['admin','analyst'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    const hash   = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active, created_at`,
      [name.trim(), email.toLowerCase().trim(), hash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está registrado.' });
    res.status(500).json({ error: 'Error creando usuario.', details: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, role, active, password, permissions } = req.body || {};
    let hash = null;
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres.' });
      hash = await bcrypt.hash(password, 12);
    }

    const permsValue = Array.isArray(permissions) ? JSON.stringify(permissions) : null;

    const result = await query(
      `UPDATE users SET
         name          = COALESCE($1, name),
         email         = COALESCE($2, email),
         role          = COALESCE($3, role),
         active        = COALESCE($4, active),
         password_hash = COALESCE($5, password_hash),
         permissions   = COALESCE($6::jsonb, permissions),
         updated_at    = NOW()
       WHERE id = $7
       RETURNING id, name, email, role, active, permissions, updated_at`,
      [name?.trim(), email?.toLowerCase().trim(), role,
       active === undefined ? null : active, hash, permsValue, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando usuario.', details: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    // No se puede eliminar el propio admin
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
    }
    await query('UPDATE users SET active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'Usuario desactivado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error desactivando usuario.', details: err.message });
  }
});

// ── Configuración de app ───────────────────────────────────────────────────────
router.get('/config', async (_req, res) => {
  try {
    const result = await query('SELECT key, value FROM app_config ORDER BY key');
    const config = {};
    result.rows.forEach(r => { config[r.key] = r.value; });
    // Estado de la key: DB tiene precedencia sobre env
    const dbKey = config.gemini_api_key || '';
    const envKey = process.env.GEMINI_API_KEY || '';
    const activeKey = dbKey || envKey;
    config.gemini_key_masked  = activeKey
      ? `${'•'.repeat(Math.max(0, activeKey.length - 4))}${activeKey.slice(-4)}`
      : '';
    let source = 'none';
    if (dbKey) source = 'db';
    else if (envKey) source = 'env';
    config.gemini_key_source = source;
    delete config.gemini_api_key; // no enviar la key real al frontend
    config.server_model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Error leyendo configuración.', details: err.message });
  }
});

router.put('/config', async (req, res) => {
  try {
    const updates = req.body || {};
    const allowed = ['gemini_model', 'app_name', 'gemini_api_key'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        await query(
          `INSERT INTO app_config (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, String(updates[key])]
        );
      }
    }
    res.json({ message: 'Configuración actualizada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando configuración.', details: err.message });
  }
});

// ── Estadísticas de base de datos ─────────────────────────────────────────────
router.get('/db/stats', async (_req, res) => {
  try {
    const tables = ['users', 'catalog_manufacturers', 'catalog_solutions',
                    'queries', 'macro_queries', 'references_ctx', 'app_config'];
    const counts = {};
    for (const table of tables) {
      const r = await query(`SELECT COUNT(*) FROM ${table}`);
      counts[table] = Number.parseInt(r.rows[0].count, 10);
    }

    // Tamaño de BD
    const sizeRes = await query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`
    );
    counts._db_size = sizeRes.rows[0].size;

    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo estadísticas.', details: err.message });
  }
});

// ── Backup: exportar datos como JSON ──────────────────────────────────────────
router.get('/db/backup', async (_req, res) => {
  try {
    const [users, manufacturers, solutions, queries_r, macro, refs, config] = await Promise.all([
      query('SELECT id, name, email, role, active, created_at FROM users'),
      query('SELECT * FROM catalog_manufacturers'),
      query('SELECT * FROM catalog_solutions'),
      query('SELECT id, user_id, company_name, manufacturer, solution, country, status, created_at FROM queries'),
      query('SELECT * FROM macro_queries'),
      query('SELECT * FROM references_ctx'),
      query('SELECT * FROM app_config'),
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      users: users.rows,
      catalog_manufacturers: manufacturers.rows,
      catalog_solutions: solutions.rows,
      queries: queries_r.rows,
      macro_queries: macro.rows,
      references: refs.rows,
      app_config: config.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gamma-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.json(backup);
  } catch (err) {
    res.status(500).json({ error: 'Error generando backup.', details: err.message });
  }
});

// ── Historial Global de Consultas ──────────────────────────────────────────────
router.get('/queries', async (req, res) => {
  try {
    const result = await query(
      `SELECT q.id, q.company_name, q.manufacturer, q.solution, q.created_at, u.name as user_name 
       FROM queries q 
       JOIN users u ON q.user_id = u.id 
       ORDER BY q.created_at DESC`
    );
    res.json({ queries: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error listando consultas globales.', details: err.message });
  }
});

router.delete('/queries/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM queries WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Consulta no encontrada.' });
    res.json({ message: 'Consulta eliminada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando consulta.', details: err.message });
  }
});

export default router;
