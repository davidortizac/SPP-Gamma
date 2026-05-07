// src/routes/chat.js — Chat contextual sobre una consulta existente

import express from 'express';
import { query } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveApiKey, resolveModel } from '../lib/gemini-config.js';

const router = express.Router({ mergeParams: true });

// POST /api/queries/:id/chat
router.post('/', requireAuth, async (req, res) => {
  const { message } = req.body || {};
  const apiKey = await resolveApiKey(req);

  if (!message?.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  if (!apiKey)          return res.status(400).json({ error: 'Se requiere GEMINI_API_KEY.' });

  // Cargar consulta
  const qResult = await query(
    `SELECT * FROM queries WHERE id = $1 AND (user_id = $2 OR $3)`,
    [req.params.id, req.user.id, req.user.role === 'admin']
  );
  const qRow = qResult.rows[0];
  if (!qRow) return res.status(404).json({ error: 'Consulta no encontrada.' });
  if (!qRow.result_json) return res.status(400).json({ error: 'La consulta no tiene resultados aún.' });

  const history    = Array.isArray(qRow.chat_history) ? qRow.chat_history : [];
  const resultJson = JSON.stringify(qRow.result_json).slice(0, 4000);

  // Construir conversación
  const systemPrompt = `Eres un experto en preventa de tecnología de Gamma. Estás ayudando al equipo de ventas a profundizar en el análisis de ${qRow.company_name} para la solución ${qRow.solution} de ${qRow.manufacturer}.

CONTEXTO DEL ANÁLISIS GENERADO:
${resultJson}

Responde de manera concisa, práctica y enfocada en ayudar al vendedor. Si te preguntan algo fuera del contexto del análisis, redirige amablemente hacia temas de ventas y la cuenta analizada.`;

  const contents = [
    ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const model = await resolveModel();
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: `Gemini API ${response.status}`, details: err.slice(0,200) });
    }

    const result  = await response.json();
    const answer  = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';

    // Guardar en historial
    const newHistory = [
      ...history,
      { role: 'user',  content: message },
      { role: 'model', content: answer  },
    ].slice(-40); // máx 40 turnos

    await query(
      `UPDATE queries SET chat_history = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(newHistory), qRow.id]
    );

    res.json({ answer, history: newHistory });
  } catch (err) {
    res.status(500).json({ error: 'Error en chat.', details: err.message });
  }
});

// DELETE /api/queries/:id/chat — limpiar historial
router.delete('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE queries SET chat_history = '[]', updated_at = NOW()
       WHERE id = $1 AND (user_id = $2 OR $3) RETURNING id`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Consulta no encontrada.' });
    res.json({ message: 'Historial de chat borrado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error limpiando historial.' });
  }
});

export default router;
