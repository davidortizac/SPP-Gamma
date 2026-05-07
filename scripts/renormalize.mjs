// scripts/renormalize.mjs — Re-normaliza todos los registros 'done' con el normalizador v2
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
const { rows } = await client.query(`SELECT id, company_name, manufacturer, solution, result_json FROM queries WHERE status='done'`);
console.log(`[renorm] ${rows.length} queries to process`);

for (const row of rows) {
  try {
    const normalized = normalizeAgentOutput(row.result_json, row.company_name, row.manufacturer, row.solution);
    await client.query(`UPDATE queries SET result_json=$1 WHERE id=$2`, [JSON.stringify(normalized), row.id]);
    console.log(`  [ok] id=${row.id} empresa="${normalized.empresa}" casosDeUso=${normalized.casosDeUso?.length} objeciones=${normalized.objeciones?.length}`);
  } catch(e) {
    console.error(`  [err] id=${row.id}: ${e.message}`);
  }
}

await client.end();
console.log('[renorm] Done');

// ── Normalizer v2 (copy of routes/queries.js version) ─────────────────────────
function normalizeAgentOutput(raw, companyName, manufacturer, solution) {
  if (!raw || typeof raw !== 'object') return raw;

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

  const toCompetencias = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    if (obj.diferenciadores_clave) return obj.diferenciadores_clave;
    return Object.values(obj).filter(v => typeof v === 'string');
  };

  const toArquitectura = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.filter(s => typeof s === 'string');
    const comps = obj.componentes_clave || obj.capas || [];
    return comps.map(c => typeof c === 'string' ? c : `${c.nombre || c.capa || ''}: ${(c.elementos || []).join(', ')}`);
  };

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

  const toPreguntas = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.filter(v => typeof v === 'string');
    return Object.values(obj).filter(v => typeof v === 'string');
  };

  const toRiesgoPrincipal = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val.titulo || val.riesgo || val.nombre || JSON.stringify(val).slice(0, 200);
  };

  const toImpacto = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.slice(0, 3).join(' · ');
    return Object.values(val).filter(v => typeof v === 'string').slice(0, 2).join(' · ');
  };

  const toTiposDatos = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(d => ({
      label: (d.label || d.tipo_dato_activo || d.tipo || d.descripcion || '').slice(0, 30),
      value: d.value ?? (d.nivel_exposicion === 'ALTO' ? 80 : d.nivel_exposicion === 'MEDIO-ALTO' ? 60 : 40),
    }));
    return [];
  };

  // ESTRUCTURA C: empresa string + casosDeUso array
  if (typeof raw.empresa === 'string' && Array.isArray(raw.casosDeUso)) {
    const rie = raw.riesgos || {};
    const pit = raw.pitch || {};
    const perf = raw.perfilamiento || {};

    let resumen = raw.resumenEjecutivo || '';
    if (!resumen && raw.impactoEsperado) {
      resumen = Object.values(raw.impactoEsperado).filter(v => typeof v === 'string').slice(0, 2).join(' ');
    }
    if (!resumen && raw.casosDeUso?.length) {
      resumen = raw.casosDeUso.slice(0, 2).map(c => c.solucion || c.dolor || '').join(' ');
    }

    const activos = perf.activosCriticos?.length ? perf.activosCriticos
      : (raw.competencias || []).slice(0, 4).map(c => typeof c === 'string' ? c : c.nombre || '');

    return {
      empresa: raw.empresa || companyName,
      fabricante: raw.fabricante || manufacturer,
      solucion: raw.solucion || solution,
      resumenEjecutivo: resumen,
      perfilamiento: {
        sector: perf.sector || '',
        geografia: perf.geografia || '',
        rol: perf.rol || '',
        activosCriticos: activos,
      },
      riesgos: {
        riesgoPrincipal: toRiesgoPrincipal(rie.riesgoPrincipal || rie.riesgo_principal),
        impacto: toImpacto(rie.impacto || rie.impacto_potencial),
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

  // ESTRUCTURA A
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
