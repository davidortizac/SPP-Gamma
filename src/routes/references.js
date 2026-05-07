// src/routes/references.js — Referencias de contexto para enriquecer análisis

import express from 'express';
import { query } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/references
router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const sql = `
      SELECT r.*, u.name AS user_name
      FROM references_ctx r JOIN users u ON u.id = r.user_id
      WHERE r.active = true ${isAdmin ? '' : 'AND r.user_id = $1'}
      ORDER BY r.created_at DESC
    `;
    const result = await query(sql, isAdmin ? [] : [req.user.id]);
    res.json({ references: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error listando referencias.', details: err.message });
  }
});

// POST /api/references
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, url, content_type = 'url', extracted_text } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'El título es obligatorio.' });
    if (!url?.trim() && !extracted_text?.trim()) {
      return res.status(400).json({ error: 'Se requiere URL o texto extraído.' });
    }

    const result = await query(
      `INSERT INTO references_ctx (user_id, title, url, content_type, extracted_text)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, title.trim(), url?.trim() || null,
       content_type, extracted_text?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error creando referencia.', details: err.message });
  }
});

// PUT /api/references/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, url, extracted_text } = req.body || {};
    const result = await query(
      `UPDATE references_ctx
       SET title = COALESCE($1, title),
           url   = COALESCE($2, url),
           extracted_text = COALESCE($3, extracted_text)
       WHERE id = $4 AND (user_id = $5 OR $6) RETURNING *`,
      [title?.trim(), url?.trim(), extracted_text?.trim(),
       req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Referencia no encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando referencia.', details: err.message });
  }
});

// DELETE /api/references/:id (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE references_ctx SET active = false
       WHERE id = $1 AND (user_id = $2 OR $3) RETURNING id`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Referencia no encontrada.' });
    res.json({ message: 'Referencia eliminada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando referencia.' });
  }
});

export default router;
