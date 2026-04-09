// ══════════════════════════════════════════════════════════════════════════
//  server.js  ·  SPP-Gamma v1.1
//  · Google OAuth + Login local
//  · Contador de tokens por consulta
//  · Historial / caché de consultas en SQLite
//  · Pitch multi-marca / multi-solución
// ══════════════════════════════════════════════════════════════════════════
require('dotenv').config();

const express        = require('express');
const path           = require('path');
const fs             = require('fs');
const session        = require('express-session');
const passport       = require('./auth');
const { seedAdmin, userDB, queryDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-2.0-flash';
const CATALOG_PATH   = path.join(__dirname, 'catalog.json');

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'gamma_dev_secret_2024',
  resave:            false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 h
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Archivos estáticos públicos (login page) ───────────────────────────────
// login.html sirve sin autenticación
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));
app.get('/login', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'login.html'))
);

// ── Guard: rutas protegidas ────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión.' });
  }
  res.redirect('/login');
}

// La app principal requiere auth
app.use('/', requireAuth, express.static(path.join(__dirname, 'public')));

// ── Auth routes ────────────────────────────────────────────────────────────
// Google OAuth
if (process.env.GOOGLE_CLIENT_ID) {
  app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );
  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=dominio' }),
    (_req, res) => res.redirect('/')
  );
}

// Login local
app.post('/auth/local',
  passport.authenticate('local', { failureRedirect: '/login?error=credenciales' }),
  (_req, res) => res.redirect('/')
);

// Logout
app.post('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// Sesión actual (para el frontend)
app.get('/api/me', requireAuth, (req, res) => {
  const { id, email, name, picture, role } = req.user;
  res.json({ id, email, name, picture, role });
});

// ── Catalog helpers ────────────────────────────────────────────────────────
function loadCatalog() {
  try { return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')); }
  catch { return { manufacturers: [] }; }
}
function saveCatalog(catalog) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
}

// ── Config ─────────────────────────────────────────────────────────────────
app.get('/api/config', requireAuth, (_req, res) => {
  res.json({
    hasServerKey:   Boolean(GEMINI_API_KEY),
    defaultModel:   GEMINI_MODEL,
    googleAuthEnabled: Boolean(process.env.GOOGLE_CLIENT_ID)
  });
});

// ── Catalog CRUD ───────────────────────────────────────────────────────────
app.get('/api/catalog', requireAuth, (_req, res) => res.json(loadCatalog()));

app.post('/api/catalog/manufacturers', requireAuth, (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre del fabricante es obligatorio.' });
  const catalog = loadCatalog();
  if (catalog.manufacturers.find(m => m.name.toLowerCase() === name.trim().toLowerCase()))
    return res.status(409).json({ error: 'Ya existe un fabricante con ese nombre.' });
  catalog.manufacturers.push({ name: name.trim(), description: (description || '').trim(), solutions: [] });
  saveCatalog(catalog);
  res.json(catalog);
});

app.put('/api/catalog/manufacturers/:name', requireAuth, (req, res) => {
  const original = decodeURIComponent(req.params.name);
  const { name, description } = req.body || {};
  const catalog = loadCatalog();
  const idx = catalog.manufacturers.findIndex(m => m.name === original);
  if (idx === -1) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  if (name && name.trim() !== original) {
    if (catalog.manufacturers.find(m => m.name.toLowerCase() === name.trim().toLowerCase()))
      return res.status(409).json({ error: 'Ya existe un fabricante con ese nombre.' });
  }
  catalog.manufacturers[idx].name = (name || original).trim();
  catalog.manufacturers[idx].description = (description !== undefined ? description : catalog.manufacturers[idx].description).trim();
  saveCatalog(catalog);
  res.json(catalog);
});

app.delete('/api/catalog/manufacturers/:name', requireAuth, (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const catalog = loadCatalog();
  const idx = catalog.manufacturers.findIndex(m => m.name === name);
  if (idx === -1) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  catalog.manufacturers.splice(idx, 1);
  saveCatalog(catalog);
  res.json(catalog);
});

app.post('/api/catalog/manufacturers/:name/solutions', requireAuth, (req, res) => {
  const mfName = decodeURIComponent(req.params.name);
  const { name, products, value } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre de la solución es obligatorio.' });
  const catalog = loadCatalog();
  const mf = catalog.manufacturers.find(m => m.name === mfName);
  if (!mf) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  if (mf.solutions.find(s => s.name.toLowerCase() === name.trim().toLowerCase()))
    return res.status(409).json({ error: 'Ya existe una solución con ese nombre.' });
  mf.solutions.push({
    name: name.trim(),
    products: Array.isArray(products) ? products.map(p => p.trim()).filter(Boolean) : [],
    value:    Array.isArray(value)    ? value.map(v => v.trim()).filter(Boolean)    : []
  });
  saveCatalog(catalog);
  res.json(catalog);
});

app.put('/api/catalog/manufacturers/:mfName/solutions/:solutionName', requireAuth, (req, res) => {
  const mfName   = decodeURIComponent(req.params.mfName);
  const origSol  = decodeURIComponent(req.params.solutionName);
  const { name, products, value } = req.body || {};
  const catalog  = loadCatalog();
  const mf = catalog.manufacturers.find(m => m.name === mfName);
  if (!mf) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  const sIdx = mf.solutions.findIndex(s => s.name === origSol);
  if (sIdx === -1) return res.status(404).json({ error: 'Solución no encontrada.' });
  mf.solutions[sIdx].name = (name || origSol).trim();
  if (Array.isArray(products)) mf.solutions[sIdx].products = products.map(p => p.trim()).filter(Boolean);
  if (Array.isArray(value))    mf.solutions[sIdx].value    = value.map(v => v.trim()).filter(Boolean);
  saveCatalog(catalog);
  res.json(catalog);
});

app.delete('/api/catalog/manufacturers/:mfName/solutions/:solutionName', requireAuth, (req, res) => {
  const mfName  = decodeURIComponent(req.params.mfName);
  const solName = decodeURIComponent(req.params.solutionName);
  const catalog = loadCatalog();
  const mf = catalog.manufacturers.find(m => m.name === mfName);
  if (!mf) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  const sIdx = mf.solutions.findIndex(s => s.name === solName);
  if (sIdx === -1) return res.status(404).json({ error: 'Solución no encontrada.' });
  mf.solutions.splice(sIdx, 1);
  saveCatalog(catalog);
  res.json(catalog);
});

// ── Query History ──────────────────────────────────────────────────────────
app.get('/api/history', requireAuth, (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const rows = isAdmin ? queryDB.listAll() : queryDB.listByUser(req.user.id);
  res.json(rows);
});

app.get('/api/history/:id', requireAuth, (req, res) => {
  const row = queryDB.getById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Consulta no encontrada.' });
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && row.user_id !== req.user.id)
    return res.status(403).json({ error: 'Sin acceso.' });
  res.json(row);
});

app.get('/api/stats', requireAuth, (req, res) => {
  res.json(queryDB.tokenStats(req.user.id));
});

// ── AI Profile Generation  (multi-brand / multi-solution) ─────────────────
app.post('/api/generate-profile', requireAuth, async (req, res) => {
  try {
    const {
      companyName,
      selections,      // NUEVO: [{ manufacturer, solution }] — array multi-brand
      manufacturer,    // legacy single-brand fallback
      solution,        // legacy
      country,
      notes,
      apiKey: customApiKey,
      forceNew         // si true, ignora la caché
    } = req.body || {};

    if (!companyName) {
      return res.status(400).json({ error: 'companyName es obligatorio.' });
    }

    // Normalizar selecciones (soporta multi-brand y single-brand)
    const items = Array.isArray(selections) && selections.length
      ? selections
      : [{ manufacturer: manufacturer || '', solution: solution || '' }];

    if (!items.length || !items[0].manufacturer || !items[0].solution) {
      return res.status(400).json({ error: 'Se requiere al menos un par fabricante/solución.' });
    }

    const activeKey = (customApiKey || GEMINI_API_KEY || '').trim();
    if (!activeKey) {
      return res.status(400).json({
        error: 'No hay API key configurada. Define GEMINI_API_KEY en el servidor.'
      });
    }

    // ── Caché: si es consulta idéntica (single-brand) y no se fuerza nueva ──
    if (!forceNew && items.length === 1) {
      const cached = queryDB.findCached(companyName, items[0].manufacturer, items[0].solution);
      if (cached && cached.result_json) {
        try {
          const result = JSON.parse(cached.result_json);
          return res.json({
            ...result,
            _cached: true,
            _cachedAt: cached.created_at,
            _queryId: cached.id,
            _tokens: {
              input: cached.tokens_input,
              output: cached.tokens_output,
              total: cached.tokens_total
            }
          });
        } catch {}
      }
    }

    // ── Construir listado de marcas para el prompt ─────────────────────────
    const selectionText = items.map(
      (s, i) => `${i + 1}. Fabricante: ${s.manufacturer} | Solución: ${s.solution}`
    ).join('\n');

    const primaryMfr = items[0].manufacturer;
    const primarySol = items[0].solution;

    const systemPrompt = `
Eres un arquitecto de preventa senior especializado en ciberseguridad, infraestructura y ventas B2B.
Tu misión es investigar información real sobre la empresa ingresada usando búsqueda web y contextualizar
un análisis consultivo 100% enfocado en los fabricantes y soluciones seleccionados.
Resalta el valor de cada solución para resolver dolores operativos reales.

Contexto de entrada:
- Empresa: ${companyName}
- País objetivo: ${country || 'No especificado'}
- Notas adicionales: ${notes || 'Ninguna'}
- Selección de portafolio:
${selectionText}

${items.length > 1 ? `
IMPORTANTE: El pitch debe cubrir TODAS las soluciones listadas arriba de forma integrada,
mostrando cómo trabajan juntas. En los casosDeUso y objeciones incluye referencias a múltiples fabricantes.
El campo "fabricante" y "solucion" del JSON deben reflejar TODAS las marcas seleccionadas.
` : ''}

Devuelve ÚNICAMENTE JSON VÁLIDO y estricto, sin bloques markdown de código:
{
  "empresa": "Nombre Oficial",
  "fabricante": "${items.map(s => s.manufacturer).join(' + ')}",
  "solucion": "${items.map(s => s.solution).join(' + ')}",
  "resumenEjecutivo": "Resumen ejecutivo breve y claro del caso de uso principal",
  "perfilamiento": {
    "sector": "Sector real (ej. Financiero, Salud)",
    "geografia": "País o región principal",
    "core": "Qué hace la empresa y cómo gana dinero",
    "rol": "CISO, DPO, CIO o Director de IT objetivo",
    "activosCriticos": ["Activo 1", "Activo 2", "Activo 3"]
  },
  "riesgos": {
    "tiposDatos": [
      { "label": "Canal expuesto 1", "value": 40 },
      { "label": "Canal expuesto 2", "value": 30 },
      { "label": "Canal expuesto 3", "value": 20 },
      { "label": "Amenaza Interna", "value": 10 }
    ],
    "riesgoPrincipal": "Riesgo primario si no implementan la solución",
    "impacto": "Consecuencia operativa, reputacional y financiera."
  },
  "contextoEstrategico": {
    "impacto": "Impacto operativo por inacción.",
    "rompehielo": "Pregunta gancho incisiva de Zero Trust o seguridad estratégica."
  },
  "pitch": {
    "apertura": "Apertura consultiva",
    "valor": "Propuesta de valor integrada de todas las marcas seleccionadas",
    "cierre": "Cierre sugerido para accionables"
  },
  "casosDeUso": [
    {
      "titulo": "Fuga de datos por / Brecha por...",
      "dolor": "Dolor operativo actual",
      "solucion": "Solución combinada",
      "resultado": "Beneficio tangible"
    }
  ],
  "competencias": ["Diferenciador 1", "Diferenciador 2"],
  "normativo": [
    { "norma": "Ley aplicable (GDPR, ISO, locales)", "descripcion": "Cómo aplica y cómo ayuda la solución." }
  ],
  "preguntasDescubrimiento": [
    "Pregunta consultiva 1 al CIO/CISO",
    "Pregunta consultiva 2",
    "Pregunta consultiva 3"
  ],
  "arquitecturaSugerida": ["Componente A", "Componente B", "Servicio C"],
  "objeciones": [
    { "objecion": "Objeción común 1", "respuesta": "Refutación usando características de la solución" },
    { "objecion": "Otra objeción", "respuesta": "Refutación sólida" },
    { "objecion": "Duda ejecutiva", "respuesta": "Refutación de TCO o riesgo" }
  ],
  "herramientas": {
    "email": {
      "asunto": "Asunto llamativo y personalizado",
      "cuerpo": "Cuerpo persuasivo del correo con saltos de línea \\n"
    },
    "resumenCISO": {
      "titulo": "Resumen Ejecutivo para C-Level",
      "vinetas": ["Viñeta ejecutiva 1", "Viñeta ejecutiva 2", "Viñeta ejecutiva 3"]
    },
    "osint": {
      "titularNoticia": "Titular de una brecha reciente real en su sector",
      "urlNoticia": "https://url-publica-para-referenciar.com",
      "pitchUrgencia": "Argumento de impacto o urgencia para la reunión"
    }
  },
  "impactoAntesDespues": {
    "antes": ["Deficiencia perimetral 1", "Visibilidad ciega 2", "Gestión manual 3"],
    "despues": ["Control persistente 1", "Cumplimiento normativo 2", "Automatización 3"]
  },
  "fuentes": ["Dominio público 1", "Dominio 2"]
}
`;

    const userPrompt = items.length > 1
      ? `Investiga la empresa ${companyName} y genera un pitch de preventa integrado para las marcas: ${items.map(s => `${s.manufacturer} (${s.solution})`).join(', ')}.`
      : `Investiga la empresa ${companyName} y genera un perfil comercial y técnico para vender ${primarySol} de ${primaryMfr}.`;

    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ google_search: {} }]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${activeKey}`;
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Gemini API error ${response.status}`,
        details: errorText
      });
    }

    const result = await response.json();
    let text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: 'La IA no devolvió contenido útil.' });

    // Extraer JSON limpio
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    let parsed;
    try { parsed = JSON.parse(text); }
    catch (parseError) {
      return res.status(502).json({
        error:   'La respuesta de la IA no fue un JSON válido.',
        raw:     text,
        details: parseError.message
      });
    }

    // ── Tokens: la API de Gemini los devuelve en usageMetadata ────────────
    const usage = result?.usageMetadata || {};
    const tokIn  = usage.promptTokenCount     || 0;
    const tokOut = usage.candidatesTokenCount || 0;
    const tokTot = usage.totalTokenCount      || (tokIn + tokOut);

    // ── Guardar en historial ───────────────────────────────────────────────
    const queryId = queryDB.save({
      userId:      req.user?.id,
      companyName,
      manufacturer: items.map(s => s.manufacturer).join(' + '),
      solution:     items.map(s => s.solution).join(' + '),
      country,
      notes,
      resultJson:   parsed,
      tokensInput:  tokIn,
      tokensOutput: tokOut,
      tokensTotal:  tokTot,
      modelUsed:    GEMINI_MODEL
    });

    res.json({
      ...parsed,
      _cached:  false,
      _queryId: queryId,
      _tokens: { input: tokIn, output: tokOut, total: tokTot }
    });

  } catch (error) {
    console.error('[generate-profile]', error);
    res.status(500).json({ error: 'Fallo interno del servidor.', details: error.message });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
seedAdmin();

app.listen(PORT, () => {
  console.log(`\n🚀 Gamma Portfolio Explorer v1.1`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✅ configurado' : '⚠️  no configurado (login local activo)'}`);
  console.log(`   Dominio permitido: ${process.env.ALLOWED_DOMAIN || 'cualquiera'}\n`);
});
