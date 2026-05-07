// src/routes/queries.js
// CRUD de consultas + pipeline de IA (Gemini con Google Search grounding)

import express from 'express';
import { query } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveApiKey, resolveModel } from '../lib/gemini-config.js';

const router = express.Router();

async function callGemini(apiKey, model, prompt, systemPrompt, useSearch = true) {
  console.log(`[Gemini] modelo=${model} search=${useSearch} key_len=${apiKey?.length ?? 0}`);

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 65536,
    },
  };
  if (useSearch) payload.tools = [{ google_search: {} }];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  console.log(`[Gemini] POST ${url.replace(apiKey, '***')}`);

  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  console.log(`[Gemini] HTTP ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const err = await res.text();
    console.error(`[Gemini] Error body: ${err.slice(0, 500)}`);
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 300)}`);
  }

  const result = await res.json();
  const candidate = result?.candidates?.[0];
  const parts     = candidate?.content?.parts || [];

  console.log(`[Gemini] finish_reason=${candidate?.finishReason} parts=${parts.length}`);
  parts.forEach((p, i) => {
    if (p.text)          console.log(`[Gemini] part[${i}] text len=${p.text.length} preview=${p.text.slice(0,80).replace(/\n/g,' ')}`);
    else if (p.functionCall) console.log(`[Gemini] part[${i}] functionCall=${p.functionCall.name}`);
    else                 console.log(`[Gemini] part[${i}] keys=${Object.keys(p).join(',')}`);
  });

  // Concatenar todos los text parts — con search, el JSON puede venir en el último
  const fullText = parts.map(p => p.text || '').join('');
  console.log(`[Gemini] fullText len=${fullText.length}`);

  const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/) || fullText.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    const raw = jsonMatch[1] || jsonMatch[0];
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      console.error('[Gemini] JSON.parse falló:', parseErr.message, '— raw preview:', raw.slice(0, 200));
      throw new Error('JSON de Gemini inválido: ' + parseErr.message);
    }
  }
  console.error('[Gemini] Sin JSON en respuesta. fullText preview:', fullText.slice(0, 500));
  throw new Error('La IA no devolvió JSON válido.');
}

function buildSystemPrompt(manufacturer, solution, country, notes, catalog) {
  const mfInfo = catalog?.find(m => m.name === manufacturer);
  const solInfo = mfInfo?.solutions?.find(s => s.name === solution);

  return `Eres un arquitecto senior de preventa especializado en ciberseguridad, infraestructura y observabilidad para mercados latinoamericanos.

PORTAFOLIO DE REFERENCIA:
- Fabricante: ${manufacturer} (${mfInfo?.description || ''})
- Solución: ${solution}
- Productos clave: ${(solInfo?.products || []).join(', ')}
- Propuesta de valor: ${(solInfo?.value || []).join(', ')}
- País/Región: ${country || 'Latinoamérica'}
- Notas adicionales: ${notes || 'Ninguna'}

INSTRUCCIONES:
1. Investiga la empresa objetivo usando Google Search para obtener información real y actualizada.
2. Identifica el sector, tamaño, noticias recientes, tecnología, y riesgos relevantes.
3. Construye un análisis consultivo enfocado EXCLUSIVAMENTE en el fabricante y solución indicados.
4. El pitch debe ser específico para el contexto real de la empresa, no genérico.
5. Devuelve ÚNICAMENTE un JSON válido sin texto adicional ni markdown.

SCHEMA REQUERIDO:
{
  "empresa": string,
  "fabricante": string,
  "solucion": string,
  "resumenEjecutivo": string,
  "perfilamiento": {
    "sector": string,
    "geografia": string,
    "core": string,
    "rol": string,
    "activosCriticos": string[]
  },
  "riesgos": {
    "tiposDatos": [{"label": string, "value": number}],
    "riesgoPrincipal": string,
    "impacto": string
  },
  "contextoEstrategico": {
    "impacto": string,
    "rompehielo": string
  },
  "pitch": {
    "apertura": string,
    "valor": string,
    "cierre": string
  },
  "casosDeUso": [{"titulo": string, "dolor": string, "solucion": string, "resultado": string}],
  "competencias": [{"nombre": string, "descripcion": string}],
  "normativo": [{"norma": string, "descripcion": string}],
  "preguntasDescubrimiento": string[],
  "arquitecturaSugerida": string[],
  "objeciones": [{"objecion": string, "respuesta": string}],
  "herramientas": {
    "email": {"asunto": string, "cuerpo": string},
    "resumenCISO": {"titulo": string, "vinetas": string[]},
    "osint": {"titularNoticia": string, "pitchUrgencia": string}
  },
  "impactoAntesDespues": {"antes": string[], "despues": string[]},
  "fuentes": string[]
}`;
}

// ── GET /api/queries — lista de consultas ──────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0, status, company } = req.query;
    const isAdmin = req.user.role === 'admin';

    let sql = `
      SELECT q.id, q.company_name, q.manufacturer, q.solution, q.country,
             q.status, q.created_at, q.updated_at,
             u.name AS user_name, u.email AS user_email
      FROM queries q
      JOIN users u ON u.id = q.user_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (!isAdmin) { sql += ` AND q.user_id = $${idx++}`; params.push(req.user.id); }
    if (status)   { sql += ` AND q.status = $${idx++}`;  params.push(status); }
    if (company)  { sql += ` AND q.company_name ILIKE $${idx++}`; params.push(`%${company}%`); }

    sql += ` ORDER BY q.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(Number(limit), Number(offset));

    const result = await query(sql, params);

    // Count
    let countSql = `SELECT COUNT(*) FROM queries q WHERE 1=1`;
    const countParams = [];
    let ci = 1;
    if (!isAdmin) { countSql += ` AND q.user_id = $${ci++}`; countParams.push(req.user.id); }
    if (status)   { countSql += ` AND q.status = $${ci++}`;  countParams.push(status); }
    if (company)  { countSql += ` AND q.company_name ILIKE $${ci++}`; countParams.push(`%${company}%`); }

    const countResult = await query(countSql, countParams);

    res.json({ queries: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Error listando consultas.', details: err.message });
  }
});

// ── GET /api/queries/stats — métricas para dashboard ──────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const filter = isAdmin ? '' : `AND user_id = ${uid}`;

    const [total, done, macro, refs] = await Promise.all([
      query(`SELECT COUNT(*) FROM queries WHERE 1=1 ${filter}`),
      query(`SELECT COUNT(*) FROM queries WHERE status = 'done' ${filter}`),
      query(`SELECT COUNT(*) FROM macro_queries WHERE 1=1 ${isAdmin ? '' : `AND user_id = ${uid}`}`),
      query(`SELECT COUNT(*) FROM references_ctx WHERE active = true ${isAdmin ? '' : `AND user_id = ${uid}`}`),
    ]);

    res.json({
      total:     parseInt(total.rows[0].count),
      done:      parseInt(done.rows[0].count),
      macro:     parseInt(macro.rows[0].count),
      references: parseInt(refs.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo estadísticas.' });
  }
});

// ── GET /api/queries/:id — detalle completo ────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT q.*, u.name AS user_name
       FROM queries q JOIN users u ON u.id = q.user_id
       WHERE q.id = $1 AND (q.user_id = $2 OR $3)`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Consulta no encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error cargando consulta.', details: err.message });
  }
});

// ── POST /api/queries — crear + generar ───────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { companyName, manufacturer, solution, country, notes, referenceIds } = req.body || {};
  const apiKey = await resolveApiKey(req);

  if (!companyName || !manufacturer || !solution) {
    return res.status(400).json({ error: 'companyName, manufacturer y solution son requeridos.' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'Se requiere GEMINI_API_KEY (servidor o header X-Api-Key).' });
  }

  // Crear registro pendiente
  let qId;
  try {
    const ins = await query(
      `INSERT INTO queries (user_id, company_name, manufacturer, solution, country, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
      [req.user.id, companyName, manufacturer, solution, country || null, notes || null]
    );
    qId = ins.rows[0].id;
  } catch (err) {
    return res.status(500).json({ error: 'Error creando consulta.', details: err.message });
  }

  // Cargar catálogo para enriquecer el prompt
  let catalog = [];
  try {
    const mfs = await query('SELECT * FROM catalog_manufacturers WHERE active = true');
    const sols = await query('SELECT cs.*, cm.name AS mf_name FROM catalog_solutions cs JOIN catalog_manufacturers cm ON cm.id = cs.manufacturer_id');
    catalog = mfs.rows.map(m => ({
      name: m.name,
      description: m.description,
      solutions: sols.rows.filter(s => s.manufacturer_id === m.id).map(s => ({
        name: s.name,
        products: s.products || [],
        value: s.value_props || [],
      })),
    }));
  } catch (_) { /* continúa sin catálogo */ }

  // Cargar referencias activas del usuario si se indicaron
  let refContext = '';
  if (Array.isArray(referenceIds) && referenceIds.length > 0) {
    try {
      const refs = await query(
        `SELECT title, url, extracted_text FROM references_ctx
         WHERE id = ANY($1) AND user_id = $2 AND active = true`,
        [referenceIds, req.user.id]
      );
      if (refs.rows.length > 0) {
        refContext = '\n\nREFERENCIAS DE CONTEXTO ADICIONAL:\n' +
          refs.rows.map(r => `- ${r.title}: ${r.url || ''}\n  ${(r.extracted_text || '').slice(0, 500)}`).join('\n');
      }
    } catch (_) { /* ignora */ }
  }

  // Pipeline IA
  try {
    const systemPrompt = buildSystemPrompt(manufacturer, solution, country, notes, catalog) + refContext;
    const userPrompt   = `Investiga la empresa "${companyName}" en ${country || 'Latinoamérica'} y genera un análisis consultivo completo para proponer ${solution} de ${manufacturer}. Usa Google Search para obtener información real y actualizada.`;
    const model        = await resolveModel();

    const parsed = await callGemini(apiKey, model, userPrompt, systemPrompt, true);

    await query(
      `UPDATE queries SET result_json = $1, status = 'done', updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(parsed), qId]
    );

    res.status(201).json({ id: qId, status: 'done', result: parsed });
  } catch (err) {
    await query(
      `UPDATE queries SET status = 'error', updated_at = NOW() WHERE id = $1`,
      [qId]
    );
    res.status(502).json({ id: qId, error: 'Error generando análisis.', details: err.message });
  }
});

// ── DELETE /api/queries/:id ────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM queries WHERE id = $1 AND (user_id = $2 OR $3) RETURNING id`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Consulta no encontrada.' });
    res.json({ message: 'Consulta eliminada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando consulta.', details: err.message });
  }
});

export default router;
