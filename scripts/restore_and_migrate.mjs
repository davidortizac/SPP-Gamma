// scripts/restore_and_migrate.mjs
import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'gamma',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'gamma',
});

await client.connect();
console.log('[restore] Connected');

// Raw JSON for id=3 (captured before NULL)
const rawId3 = JSON.parse(fs.readFileSync('/app/scripts/debug_result_id3.json', 'utf8'));
const normalized3 = normalizeAgentOutput(rawId3, 'La Soberana', 'Fortinet AI', 'AI Infrastructure Protection');
await client.query(`UPDATE queries SET result_json = $1 WHERE id = 3`, [JSON.stringify(normalized3)]);
console.log('[restore] id=3 restored and normalized');

// For id=2 we use same raw data with different solution
const normalized2 = normalizeAgentOutput(rawId3, 'La Soberana', 'Fortinet AI', 'FW IA');
await client.query(`UPDATE queries SET result_json = $1 WHERE id = 2`, [JSON.stringify(normalized2)]);
console.log('[restore] id=2 restored and normalized');

await client.end();
console.log('[restore] Done');

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
    return Object.entries(obj).map(([key, c]) => ({
      titulo: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      dolor: c.descripcion || c.dolor || '',
      solucion: c.solucion || '',
      resultado: c.resultado || c.impacto || 'Mejora en la postura de seguridad y continuidad operativa.',
    }));
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
    resumenEjecutivo: rep.perfilamiento?.descripcion_general || rep.contexto_estrategico?.desafios_negocio_relacionados_ciberseguridad?.slice(0,3).join(' · ') || emp.core_negocio || '',
    perfilamiento: {
      sector: emp.sector || '',
      geografia: emp.geografia || emp.ubicacion || '',
      rol: rep.perfilamiento?.rol_en_industria || '',
      activosCriticos: emp.activos_criticos_tecnologicos || [],
    },
    riesgos: {
      riesgoPrincipal: rie.riesgo_principal || '',
      impacto: Array.isArray(rie.impacto_potencial) ? rie.impacto_potencial.slice(0, 3).join(' · ') : (rie.impacto_potencial || ''),
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
