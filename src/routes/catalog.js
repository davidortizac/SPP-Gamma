// src/routes/catalog.js
// CRUD del catálogo de fabricantes y soluciones (admin only para escritura)

import express from 'express';
import { query } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

// GET /api/catalog — público para la app (se protege por requireAuth en server.js)
router.get('/', requireAuth, async (req, res) => {
  try {
    const mfResult = await query(
      'SELECT * FROM catalog_manufacturers WHERE active = true ORDER BY name'
    );
    const solResult = await query(
      `SELECT cs.*, cm.name AS manufacturer_name
       FROM catalog_solutions cs
       JOIN catalog_manufacturers cm ON cm.id = cs.manufacturer_id
       WHERE cm.active = true
       ORDER BY cm.name, cs.name`
    );

    const manufacturers = mfResult.rows.map(mf => ({
      ...mf,
      solutions: solResult.rows
        .filter(s => s.manufacturer_id === mf.id)
        .map(s => ({
          id:        s.id,
          name:      s.name,
          products:  s.products  || [],
          value:     s.value_props || [],
        }))
    }));

    res.json({ manufacturers });
  } catch (err) {
    res.status(500).json({ error: 'Error cargando catálogo.', details: err.message });
  }
});

// GET /api/catalog/categories — lista de categorías válidas
router.get('/categories', requireAuth, (_req, res) => {
  res.json([
    { value: 'security',        label: 'Ciberseguridad' },
    { value: 'infrastructure',  label: 'Infraestructura' },
    { value: 'observability',   label: 'Observabilidad' },
  ]);
});

// POST /api/catalog/manufacturers — admin
router.post('/manufacturers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, category } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (!['security','infrastructure','observability'].includes(category)) {
      return res.status(400).json({ error: 'Categoría inválida.' });
    }

    const result = await query(
      `INSERT INTO catalog_manufacturers (name, description, category)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING
       RETURNING *`,
      [name.trim(), (description || '').trim(), category]
    );
    if (!result.rows[0]) return res.status(409).json({ error: 'Ya existe un fabricante con ese nombre.' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error creando fabricante.', details: err.message });
  }
});

// PUT /api/catalog/manufacturers/:id — admin
router.put('/manufacturers/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, category } = req.body || {};
    const { id } = req.params;

    const result = await query(
      `UPDATE catalog_manufacturers
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category)
       WHERE id = $4
       RETURNING *`,
      [name?.trim(), description?.trim(), category, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Fabricante no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando fabricante.', details: err.message });
  }
});

// DELETE /api/catalog/manufacturers/:id — admin (soft delete)
router.delete('/manufacturers/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('UPDATE catalog_manufacturers SET active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Fabricante deshabilitado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando fabricante.', details: err.message });
  }
});

// POST /api/catalog/manufacturers/:mfId/solutions — admin
router.post('/manufacturers/:mfId/solutions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, products, value } = req.body || {};
    const mfId = req.params.mfId;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre de la solución es obligatorio.' });

    const result = await query(
      `INSERT INTO catalog_solutions (manufacturer_id, name, products, value_props)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (manufacturer_id, name) DO NOTHING
       RETURNING *`,
      [mfId, name.trim(),
       JSON.stringify(Array.isArray(products) ? products : []),
       JSON.stringify(Array.isArray(value) ? value : [])]
    );
    if (!result.rows[0]) return res.status(409).json({ error: 'Ya existe esa solución para este fabricante.' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error creando solución.', details: err.message });
  }
});

// PUT /api/catalog/solutions/:id — admin
router.put('/solutions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, products, value } = req.body || {};
    const result = await query(
      `UPDATE catalog_solutions
       SET name      = COALESCE($1, name),
           products  = COALESCE($2, products),
           value_props = COALESCE($3, value_props)
       WHERE id = $4
       RETURNING *`,
      [name?.trim(),
       products ? JSON.stringify(products) : null,
       value    ? JSON.stringify(value)    : null,
       req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Solución no encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando solución.', details: err.message });
  }
});

// DELETE /api/catalog/solutions/:id — admin
router.delete('/solutions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM catalog_solutions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Solución eliminada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando solución.', details: err.message });
  }
});

export default router;
