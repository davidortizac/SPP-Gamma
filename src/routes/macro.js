// src/routes/macro.js — Consultas macro multi-fabricante

import express from 'express';
import { query } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveApiKey, resolveModel } from '../lib/gemini-config.js';

const router = express.Router();

// GET /api/macro
router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const sql = `
      SELECT m.*, u.name AS user_name
      FROM macro_queries m JOIN users u ON u.id = m.user_id
      WHERE ${isAdmin ? '1=1' : 'm.user_id = $1'}
      ORDER BY m.created_at DESC
    `;
    const result = await query(sql, isAdmin ? [] : [req.user.id]);
    res.json({ macros: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error listando macro-consultas.', details: err.message });
  }
});

// GET /api/macro/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*, u.name AS user_name FROM macro_queries m JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND (m.user_id = $2 OR $3)`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Macro-consulta no encontrada.' });

    const macro = result.rows[0];
    // Cargar sub-consultas referenciadas
    const queryIds = Array.isArray(macro.query_ids) ? macro.query_ids : [];
    let subQueries = [];
    if (queryIds.length > 0) {
      const qr = await query(
        `SELECT id, company_name, manufacturer, solution, status FROM queries WHERE id = ANY($1)`,
        [queryIds]
      );
      subQueries = qr.rows;
    }

    res.json({ ...macro, sub_queries: subQueries });
  } catch (err) {
    res.status(500).json({ error: 'Error cargando macro-consulta.', details: err.message });
  }
});

// POST /api/macro — crear (puede combinar consultas existentes o generar nueva)
router.post('/', requireAuth, async (req, res) => {
  const { name, description, queryIds = [], companyName, country, notes } = req.body || {};
  const apiKey = await resolveApiKey(req);

  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  // Validar que las sub-consultas existen y el usuario tiene acceso
  let resolvedIds = [];
  let subResults  = [];
  if (queryIds.length > 0) {
    const qr = await query(
      `SELECT id, company_name, manufacturer, solution, result_json
       FROM queries WHERE id = ANY($1) AND status = 'done' AND (user_id = $2 OR $3)`,
      [queryIds, req.user.id, req.user.role === 'admin']
    );
    subResults  = qr.rows;
    resolvedIds = subResults.map(r => r.id);
  }

  // Insertar pending
  let macroId;
  try {
    const ins = await query(
      `INSERT INTO macro_queries (user_id, name, description, query_ids)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.user.id, name.trim(), description || '', JSON.stringify(resolvedIds)]
    );
    macroId = ins.rows[0].id;
  } catch (err) {
    return res.status(500).json({ error: 'Error creando macro-consulta.', details: err.message });
  }

  // Si hay sub-consultas con resultados, generar síntesis con IA
  if (subResults.length > 0 && apiKey) {
    try {
      const context = subResults.map(q => {
        const r = q.result_json || {};
        return `## ${q.manufacturer} / ${q.solution} para ${q.company_name}
Resumen ejecutivo: ${r.resumenEjecutivo || '-'}
Riesgo principal: ${r.riesgos?.riesgoPrincipal || '-'}
Pitch: ${r.pitch?.valor || '-'}
Arquitectura: ${(r.arquitecturaSugerida || []).join(', ')}`;
      }).join('\n\n');

      const systemPrompt = `Eres un consultor senior de Gamma que construye estrategias multi-tecnología.
Analiza los análisis individuales por fabricante y genera una visión macro integrada para la cuenta "${companyName || 'la empresa analizada'}" en ${country || 'Latinoamérica'}.
Notas adicionales: ${notes || 'Ninguna'}

Devuelve ÚNICAMENTE JSON con:
{
  "nombre": string,
  "empresaObjetivo": string,
  "resumenMacro": string,
  "mapaDeRiesgos": [{"area": string, "riesgo": string, "tecnologia": string}],
  "arquitecturaIntegrada": string[],
  "roadmap": [{"fase": string, "descripcion": string, "tecnologias": string[]}],
  "pitchEjecutivo": string,
  "valorTotal": string,
  "preguntasClave": string[]
}`;

      const model  = await resolveModel();
      const url    = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const apiRes = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: context }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      });

      if (apiRes.ok) {
        const result = await apiRes.json();
        const text   = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          await query(
            `UPDATE macro_queries SET result_json = $1 WHERE id = $2`,
            [JSON.stringify(parsed), macroId]
          );
          return res.status(201).json({ id: macroId, result: parsed });
        }
      }
    } catch (synthErr) { console.warn('[Macro] Síntesis IA fallida:', synthErr.message); }
  }

  res.status(201).json({ id: macroId, result: null });
});

// DELETE /api/macro/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM macro_queries WHERE id = $1 AND (user_id = $2 OR $3) RETURNING id`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Macro-consulta no encontrada.' });
    res.json({ message: 'Macro-consulta eliminada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando macro-consulta.', details: err.message });
  }
});

export default router;
