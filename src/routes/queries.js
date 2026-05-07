// src/routes/queries.js
// CRUD de consultas + pipeline de IA (Gemini con Google Search grounding)

import express from 'express';
import { query } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveApiKey, resolveModel } from '../lib/gemini-config.js';
import { runAccountAnalysis } from '../agents/runner.js';

const router = express.Router();

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

    res.json({ queries: result.rows, total: Number.parseInt(countResult.rows[0].count, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Error listando consultas.', details: err.message });
  }
});

// ── GET /api/queries/stats — métricas para dashboard ──────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const userFilter = isAdmin ? '' : `AND user_id = ${uid}`;
    const [total, done, macro, refs] = await Promise.all([
      query(`SELECT COUNT(*) FROM queries WHERE 1=1 ${userFilter}`),
      query(`SELECT COUNT(*) FROM queries WHERE status = 'done' ${userFilter}`),
      query(`SELECT COUNT(*) FROM macro_queries WHERE 1=1 ${userFilter}`),
      query(`SELECT COUNT(*) FROM references_ctx WHERE active = true ${userFilter}`),
    ]);

    res.json({
      total:     Number.parseInt(total.rows[0].count, 10),
      done:      Number.parseInt(done.rows[0].count, 10),
      macro:     Number.parseInt(macro.rows[0].count, 10),
      references: Number.parseInt(refs.rows[0].count, 10),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo estadísticas.', details: err?.message });
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
    return res.status(400).json({ error: 'Falta configuración del modelo Gemini. Contacta al administrador.' });
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

  // Cargar catálogo y referencias
  const catalog = await buildCatalogContext();
  const refContext = await buildRefContext(referenceIds, req.user.id);

  // Pipeline IA
  try {
    const model = await resolveModel();
    process.env.GEMINI_MODEL = model;
    if (apiKey) process.env.GEMINI_API_KEY = apiKey; // Ensure ADK has the key

    const rawResponse = await runAccountAnalysis(companyName, manufacturer, solution, country, notes, { catalog, refContext });
    
    // Extraer el JSON final devuelto por el DocumentAgent
    let parsed;
    try {
      const responseText = typeof rawResponse === 'object' && rawResponse?.text ? rawResponse.text : String(rawResponse || '');
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\{[\s\S]*\})/);
      const raw = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : JSON.parse(responseText);
      // Normalizar al esquema esperado por la vista
      parsed = normalizeAgentOutput(raw, companyName, manufacturer, solution);
    } catch(e) {
      console.error("[ADK Parse Error]", e);
      parsed = { error: "El agente no devolvió un JSON válido", raw: rawResponse };
    }

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

async function buildCatalogContext() {
  try {
    const mfs = await query('SELECT * FROM catalog_manufacturers WHERE active = true');
    const sols = await query('SELECT cs.*, cm.name AS mf_name FROM catalog_solutions cs JOIN catalog_manufacturers cm ON cm.id = cs.manufacturer_id');
    return mfs.rows.map(m => ({
      name: m.name,
      description: m.description,
      solutions: sols.rows.filter(s => s.manufacturer_id === m.id).map(s => ({
        name: s.name,
        products: s.products || [],
        value: s.value_props || [],
      })),
    }));
  } catch (err) {
    console.error('Error fetching catalog:', err.message);
    return [];
  }
}

async function buildRefContext(referenceIds, userId) {
  if (!Array.isArray(referenceIds) || referenceIds.length === 0) return '';
  try {
    const refs = await query(
      `SELECT title, url, extracted_text FROM references_ctx
       WHERE id = ANY($1) AND user_id = $2 AND active = true`,
      [referenceIds, userId]
    );
    if (refs.rows.length === 0) return '';
    return '\n\nREFERENCIAS DE CONTEXTO ADICIONAL:\n' +
      refs.rows.map(r => `- ${r.title}: ${r.url || ''}\n  ${(r.extracted_text || '').slice(0, 500)}`).join('\n');
  } catch (err) {
    console.error('Error fetching references:', err.message);
    return '';
  }
}

export default router;

/**
 * Normaliza la salida del agente ADK al esquema que espera la vista.
 * Maneja 3 estructuras posibles que puede devolver el document-agent:
 *   A) { email_prospeccion, reporte_consolidado: { empresa, riesgos, pitch, ... } }
 *   B) { empresa (string), riesgos, pitch, casosDeUso (array), ... }    ← semi-directo con arrays
 *   C) { empresa (string), riesgos, pitch, casosDeUso (array), perfilamiento vacío, ... } ← actual
 */
function normalizeAgentOutput(raw, companyName, manufacturer, solution) {
  if (!raw || typeof raw !== 'object') return raw;

  // ── helpers globales ──────────────────────────────────────────────────────

  /** Convierte objeciones de cualquier formato a [{objecion,respuesta}] */
  const toObjeciones = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.map(o => ({
      objecion: o.objecion || o.titulo || '',
      respuesta: o.respuesta || o.refutacion_comercial || o.refutacion_tecnica || '',
    }));
    return Object.values(obj).map(o => ({
      objecion: o.objecion || '',
      respuesta: o.refutacion_comercial || o.refutacion_tecnica || o.respuesta || '',
    }));
  };

  /** Convierte casos de uso de cualquier formato a [{titulo,dolor,solucion,resultado}] */
  const toCasos = (obj) => {
    if (!obj) return [];
    const arr = Array.isArray(obj) ? obj : Object.entries(obj).map(([k, v]) => ({ titulo: k, ...v }));
    return arr.map(c => ({
      titulo: (c.titulo || c.nombre || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      dolor:  c.dolor || c.problema || c.descripcion || '',
      solucion: c.solucion || c.respuesta || '',
      resultado: c.resultado || c.impacto || 'Mejora en la postura de seguridad y continuidad operativa.',
    }));
  };

  /** Convierte competencias a array de strings o {nombre,descripcion} */
  const toCompetencias = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    if (obj.diferenciadores_clave) return obj.diferenciadores_clave;
    return Object.values(obj).filter(v => typeof v === 'string');
  };

  /** Convierte arquitectura a array de strings */
  const toArquitectura = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.filter(s => typeof s === 'string');
    const comps = obj.componentes_clave || obj.capas || [];
    return comps.map(c => typeof c === 'string' ? c : `${c.nombre || c.capa || ''}: ${(c.elementos || []).join(', ')}`);
  };

  /** Convierte normativo a [{norma,descripcion}] */
  const toNormativo = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.map(n =>
      typeof n === 'string' ? { norma: n.split(':')[0].trim(), descripcion: n } :
      { norma: n.norma || n.nombre || '', descripcion: n.descripcion || n.descripcion_impacto || '' }
    );
    return Object.entries(obj)
      .filter(([k]) => !['mejores_practicas','estandares_internacionales'].includes(k))
      .map(([k, v]) => ({ norma: k.toUpperCase().replace(/_/g, ' '), descripcion: typeof v === 'string' ? v : JSON.stringify(v) }));
  };

  /** Convierte preguntas a array de strings */
  const toPreguntas = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.filter(v => typeof v === 'string');
    return Object.values(obj).filter(v => typeof v === 'string');
  };

  /** Extrae string de riesgo principal (puede ser string u objeto) */
  const toRiesgoPrincipal = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val.titulo || val.riesgo || val.nombre || JSON.stringify(val).slice(0, 200);
  };

  /** Extrae string de impacto (puede ser string, array u objeto) */
  const toImpacto = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.slice(0, 3).join(' · ');
    // objeto con claves financiero, operacional, reputacional…
    return Object.values(val).filter(v => typeof v === 'string').slice(0, 2).join(' · ');
  };

  /** Extrae tipos de datos para los badges */
  const toTiposDatos = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(d => ({
      label: (d.label || d.tipo_dato_activo || d.tipo || d.descripcion || '').slice(0, 30),
      value: d.value ?? (d.nivel_exposicion === 'ALTO' ? 80 : d.nivel_exposicion === 'MEDIO-ALTO' ? 60 : 40),
    }));
    return [];
  };

  // ── ESTRUCTURA C: el agente ya devolvió empresa/fabricante como strings ────
  // con casosDeUso array, normativo array, etc. pero perfilamiento vacío y
  // resumenEjecutivo vacío — enriquecemos los campos vacíos
  if (typeof raw.empresa === 'string' && Array.isArray(raw.casosDeUso)) {
    const rie = raw.riesgos || {};
    const pit = raw.pitch || {};
    const perf = raw.perfilamiento || {};

    // Construir resumen ejecutivo desde impactoEsperado o casosDeUso si está vacío
    let resumen = raw.resumenEjecutivo || '';
    if (!resumen && raw.impactoEsperado) {
      resumen = Object.values(raw.impactoEsperado).filter(v => typeof v === 'string').slice(0, 2).join(' ');
    }
    if (!resumen && raw.casosDeUso?.length) {
      resumen = raw.casosDeUso.slice(0, 2).map(c => c.solucion || c.dolor || '').join(' ');
    }

    // Enriquecer perfilamiento vacío desde casosDeUso/competencias
    const sector = perf.sector || '';
    const activos = perf.activosCriticos?.length ? perf.activosCriticos
      : (raw.competencias || []).slice(0, 4).map(c => typeof c === 'string' ? c : c.nombre || '');

    return {
      empresa: raw.empresa || companyName,
      fabricante: raw.fabricante || manufacturer,
      solucion: raw.solucion || solution,
      resumenEjecutivo: resumen,
      perfilamiento: {
        sector,
        geografia: perf.geografia || '',
        rol: perf.rol || '',
        activosCriticos: activos,
      },
      riesgos: {
        riesgoPrincipal: toRiesgoPrincipal(rie.riesgoPrincipal || rie.riesgo_principal),
        impacto: toImpacto(rie.riesgo || rie.impacto_potencial),
        tiposDatos: toTiposDatos(rie.tiposDatos || rie.evaluacion_exposicion_datos),
      },
      pitch: {
        apertura: pit.apertura || pit.apertura_consultiva || '',
        valor: pit.valor || pit.propuesta_valor || '',
        cierre: pit.cierre || '',
      },
      casosDeUso: toCasos(raw.casosDeUso),
      arquitecturaSugerida: toArquitectura(raw.arquitecturaSugerida || raw.arquitectura_sugerida),
      competencias: toCompetencias(raw.competencias),
      normativo: toNormativo(raw.normativo),
      preguntasDescubrimiento: toPreguntas(raw.preguntasDescubrimiento || raw.preguntas_descubrimiento),
      objeciones: toObjeciones(raw.objeciones),
      herramientas: {
        email: raw.herramientas?.email || null,
        resumenCISO: raw.herramientas?.resumenCISO || null,
      },
      impactoEsperado: raw.impactoEsperado || null,
      fuentes: raw.fuentes || [],
    };
  }

  // ── ESTRUCTURA A: { email_prospeccion, reporte_consolidado: {...} } ─────────
  const rep = raw.reporte_consolidado || raw;
  const emp = rep.empresa || {};
  const rie = rep.riesgos || {};
  const pit = rep.pitch || {};
  const her = rep.herramientas || {};

  const tiposDatos = toTiposDatos(rie.evaluacion_exposicion_datos || rie.tiposDatos);
  const emailSrc = raw.email_prospeccion || her.email || {};
  const emailNorm = emailSrc.asunto ? { asunto: emailSrc.asunto, cuerpo: emailSrc.cuerpo || '' } : null;

  const resumen = rep.perfilamiento?.descripcion_general
    || (rep.contexto_estrategico?.desafios_negocio_relacionados_ciberseguridad || []).slice(0, 3).join(' · ')
    || (typeof emp === 'string' ? '' : emp.core_negocio || '');

  return {
    empresa: (typeof emp === 'string' ? emp : emp.nombre) || companyName,
    fabricante: manufacturer,
    solucion: solution,
    resumenEjecutivo: resumen,
    perfilamiento: {
      sector: (typeof emp === 'object' ? emp.sector : '') || '',
      geografia: (typeof emp === 'object' ? emp.geografia || emp.ubicacion : '') || '',
      rol: rep.perfilamiento?.rol_en_industria || '',
      activosCriticos: (typeof emp === 'object' ? emp.activos_criticos_tecnologicos : []) || [],
    },
    riesgos: {
      riesgoPrincipal: toRiesgoPrincipal(rie.riesgo_principal || rie.riesgoPrincipal),
      impacto: toImpacto(rie.impacto_potencial || rie.impacto),
      tiposDatos,
    },
    pitch: {
      apertura: pit.apertura_consultiva || pit.apertura || '',
      valor: pit.propuesta_valor || pit.valor || '',
      cierre: pit.cierre || '',
    },
    casosDeUso: toCasos(rep.casos_de_uso || rep.casosDeUso),
    arquitecturaSugerida: toArquitectura(rep.arquitectura_sugerida || rep.arquitecturaSugerida),
    competencias: toCompetencias(rep.competencias),
    normativo: toNormativo(rep.normativo),
    preguntasDescubrimiento: toPreguntas(rep.preguntas_descubrimiento || rep.preguntasDescubrimiento),
    objeciones: toObjeciones(rep.objeciones),
    herramientas: { email: emailNorm, resumenCISO: null },
    impactoEsperado: rep.impacto_esperado || null,
    fuentes: [],
  };
}
