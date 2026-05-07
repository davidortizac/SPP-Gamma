// scripts/migrate_results.mjs
// Run inside the container: node scripts/migrate_results.mjs
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'gamma',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'gamma',
});

await client.connect();
console.log('[migrate] Connected');

const { rows } = await client.query(`SELECT id, company_name, manufacturer, solution, result_json FROM queries WHERE status = 'done'`);
console.log(`[migrate] Found ${rows.length} done queries`);

for (const row of rows) {
  const raw = row.result_json;
  if (!raw || typeof raw !== 'object') continue;
  // Already normalized?
  if (raw.empresa && raw.resumenEjecutivo) { console.log(`  [skip] id=${row.id} already normalized`); continue; }

  const normalized = normalizeAgentOutput(raw, row.company_name, row.manufacturer, row.solution);
  await client.query(`UPDATE queries SET result_json = $1 WHERE id = $2`, [JSON.stringify(normalized), row.id]);
  console.log(`  [ok] id=${row.id} normalized`);
}

await client.end();
console.log('[migrate] Done');

// ─── Normalizer (same as in queries.js) ───────────────────────────────────────
function normalizeAgentOutput(raw, companyName, manufacturer, solution) {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.empresa && raw.resumenEjecutivo) return raw;

  const rep = raw.reporte_consolidado || raw;
  const emp = rep.empresa || {};
  const rie = rep.riesgos || {};
  const pit = rep.pitch || {};
  const her = rep.herramientas || {};

  const normalizeObjeciones = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (!obj || typeof obj !== 'object') return [];
    return Object.values(obj).map(o => ({ objecion: o.objecion || '', respuesta: o.refutacion_comercial || o.refutacion_tecnica || '' }));
  };

  const normalizeCasos = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([key, c]) => ({ titulo: key.replace(/_/g, ' '), dolor: c.descripcion || c.dolor || '', solucion: c.solucion || '', resultado: c.resultado || '' }));
  };

  const normalizeCompetencias = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (!obj || typeof obj !== 'object') return [];
    return (obj.diferenciadores_clave || []);
  };

  const normalizeArq = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (!obj || typeof obj !== 'object') return [];
    return (obj.componentes_clave || []).map(c => `${c.nombre}: ${(c.elementos || []).join(', ')}`);
  };

  const normalizeNormativo = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj)
      .filter(([k]) => k !== 'mejores_practicas' && k !== 'estandares_internacionales')
      .map(([k, v]) => ({ norma: k.toUpperCase().replace(/_/g, ' '), descripcion: typeof v === 'string' ? v : JSON.stringify(v) }));
  };

  const normalizePreguntas = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (!obj || typeof obj !== 'object') return [];
    return Object.values(obj).filter(v => typeof v === 'string');
  };

  const tiposDatos = (Array.isArray(rie.evaluacion_exposicion_datos) ? rie.evaluacion_exposicion_datos : [])
    .map(d => ({ label: (d.tipo_dato_activo || d.descripcion || '').slice(0, 30), value: d.nivel_exposicion === 'ALTO' ? 80 : d.nivel_exposicion === 'MEDIO-ALTO' ? 60 : 40 }));

  const emailSrc = raw.email_prospeccion || her.email || {};
  const emailNorm = emailSrc.asunto ? { asunto: emailSrc.asunto, cuerpo: emailSrc.cuerpo || '' } : null;

  return {
    empresa: emp.nombre || companyName,
    fabricante: manufacturer,
    solucion: solution,
    resumenEjecutivo: rep.contexto_estrategico
      ? (rep.contexto_estrategico.desafios_negocio_relacionados_ciberseguridad || []).join(' ')
      : (rep.perfilamiento?.descripcion_general || emp.core_negocio || ''),
    perfilamiento: {
      sector: emp.sector || '',
      geografia: emp.geografia || emp.ubicacion || '',
      rol: rep.perfilamiento?.rol_en_industria || '',
      activosCriticos: emp.activos_criticos_tecnologicos || [],
    },
    riesgos: {
      riesgoPrincipal: rie.riesgo_principal || '',
      impacto: (Array.isArray(rie.impacto_potencial) ? rie.impacto_potencial.join(' ') : rie.impacto_potencial) || '',
      tiposDatos,
    },
    pitch: {
      apertura: pit.apertura_consultiva || pit.apertura || '',
      valor: pit.propuesta_valor || pit.valor || '',
      cierre: pit.cierre || '',
    },
    casosDeUso: normalizeCasos(rep.casos_de_uso),
    arquitecturaSugerida: normalizeArq(rep.arquitectura_sugerida),
    competencias: normalizeCompetencias(rep.competencias),
    normativo: normalizeNormativo(rep.normativo),
    preguntasDescubrimiento: normalizePreguntas(rep.preguntas_descubrimiento),
    objeciones: normalizeObjeciones(rep.objeciones),
    herramientas: { email: emailNorm, resumenCISO: null },
    impactoEsperado: rep.impacto_esperado || null,
    fuentes: [],
  };
}
