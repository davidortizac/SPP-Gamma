const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CATALOG_PATH = path.join(__dirname, 'catalog.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));

// ─── Catalog helpers ──────────────────────────────────────────────────────────
function loadCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch {
    return { manufacturers: [] };
  }
}

function saveCatalog(catalog) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
}

// ─── Config ───────────────────────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({
    hasServerKey: Boolean(GEMINI_API_KEY),
    defaultModel: GEMINI_MODEL
  });
});

// ─── Catalog CRUD ─────────────────────────────────────────────────────────────
app.get('/api/catalog', (_req, res) => {
  res.json(loadCatalog());
});

// Add manufacturer
app.post('/api/catalog/manufacturers', (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del fabricante es obligatorio.' });
  }
  const catalog = loadCatalog();
  if (catalog.manufacturers.find(m => m.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Ya existe un fabricante con ese nombre.' });
  }
  catalog.manufacturers.push({ name: name.trim(), description: (description || '').trim(), solutions: [] });
  saveCatalog(catalog);
  res.json(catalog);
});

// Update manufacturer
app.put('/api/catalog/manufacturers/:name', (req, res) => {
  const original = decodeURIComponent(req.params.name);
  const { name, description } = req.body || {};
  const catalog = loadCatalog();
  const idx = catalog.manufacturers.findIndex(m => m.name === original);
  if (idx === -1) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  if (name && name.trim() !== original) {
    if (catalog.manufacturers.find(m => m.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(409).json({ error: 'Ya existe un fabricante con ese nombre.' });
    }
  }
  catalog.manufacturers[idx].name = (name || original).trim();
  catalog.manufacturers[idx].description = (description !== undefined ? description : catalog.manufacturers[idx].description).trim();
  saveCatalog(catalog);
  res.json(catalog);
});

// Delete manufacturer
app.delete('/api/catalog/manufacturers/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const catalog = loadCatalog();
  const idx = catalog.manufacturers.findIndex(m => m.name === name);
  if (idx === -1) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  catalog.manufacturers.splice(idx, 1);
  saveCatalog(catalog);
  res.json(catalog);
});

// Add solution to manufacturer
app.post('/api/catalog/manufacturers/:name/solutions', (req, res) => {
  const mfName = decodeURIComponent(req.params.name);
  const { name, products, value } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre de la solución es obligatorio.' });
  }
  const catalog = loadCatalog();
  const mf = catalog.manufacturers.find(m => m.name === mfName);
  if (!mf) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  if (mf.solutions.find(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Ya existe una solución con ese nombre en este fabricante.' });
  }
  mf.solutions.push({
    name: name.trim(),
    products: Array.isArray(products) ? products.map(p => p.trim()).filter(Boolean) : [],
    value: Array.isArray(value) ? value.map(v => v.trim()).filter(Boolean) : []
  });
  saveCatalog(catalog);
  res.json(catalog);
});

// Update solution
app.put('/api/catalog/manufacturers/:mfName/solutions/:solutionName', (req, res) => {
  const mfName = decodeURIComponent(req.params.mfName);
  const originalSolution = decodeURIComponent(req.params.solutionName);
  const { name, products, value } = req.body || {};
  const catalog = loadCatalog();
  const mf = catalog.manufacturers.find(m => m.name === mfName);
  if (!mf) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  const sIdx = mf.solutions.findIndex(s => s.name === originalSolution);
  if (sIdx === -1) return res.status(404).json({ error: 'Solución no encontrada.' });
  mf.solutions[sIdx].name = (name || originalSolution).trim();
  if (Array.isArray(products)) mf.solutions[sIdx].products = products.map(p => p.trim()).filter(Boolean);
  if (Array.isArray(value)) mf.solutions[sIdx].value = value.map(v => v.trim()).filter(Boolean);
  saveCatalog(catalog);
  res.json(catalog);
});

// Delete solution
app.delete('/api/catalog/manufacturers/:mfName/solutions/:solutionName', (req, res) => {
  const mfName = decodeURIComponent(req.params.mfName);
  const solutionName = decodeURIComponent(req.params.solutionName);
  const catalog = loadCatalog();
  const mf = catalog.manufacturers.find(m => m.name === mfName);
  if (!mf) return res.status(404).json({ error: 'Fabricante no encontrado.' });
  const sIdx = mf.solutions.findIndex(s => s.name === solutionName);
  if (sIdx === -1) return res.status(404).json({ error: 'Solución no encontrada.' });
  mf.solutions.splice(sIdx, 1);
  saveCatalog(catalog);
  res.json(catalog);
});

// ─── AI Profile Generation ────────────────────────────────────────────────────
app.post('/api/generate-profile', async (req, res) => {
  try {
    const {
      companyName,
      manufacturer,
      solution,
      country,
      notes,
      apiKey: customApiKey
    } = req.body || {};

    if (!companyName || !manufacturer || !solution) {
      return res.status(400).json({
        error: 'companyName, manufacturer y solution son obligatorios.'
      });
    }

    const activeKey = (customApiKey || GEMINI_API_KEY || '').trim();
    if (!activeKey) {
      return res.status(400).json({
        error: 'No hay API key configurada. Define GEMINI_API_KEY en Docker o pega una API key en la interfaz.'
      });
    }

    const systemPrompt = `
Eres un arquitecto de preventa senior especializado en ciberseguridad, infraestructura y ventas B2B.
Tu misión es investigar información real sobre la empresa ingresada usando búsqueda web y contextualizar un análisis consultivo 100% enfocado en el fabricante y solución seleccionados.
Resalta el valor de la solución para resolver dolores operativos reales.

Contexto de entrada:
- Empresa: ${companyName}
- Fabricante: ${manufacturer}
- Solución: ${solution}
- País objetivo: ${country || 'No especificado'}
- Notas adicionales: ${notes || 'Ninguna'}

Devuelve ÚNICAMENTE JSON VÁLIDO y estricto, sin bloques markdown de código:
{
  "empresa": "Nombre Oficial",
  "fabricante": "${manufacturer}",
  "solucion": "${solution}",
  "resumenEjecutivo": "Resumen ejecutivo breve y claro del caso de uso principal",
  "perfilamiento": {
    "sector": "Sector real (ej. Financiero, Salud)",
    "geografia": "País o región principal",
    "core": "Qué hace la empresa y cómo gana dinero",
    "rol": "CISO, DPO, CIO o Director de IT objetivo",
    "activosCriticos": ["Tipos de documentos o activos clave 1", "Activo 2", "Activo 3"]
  },
  "riesgos": {
    "tiposDatos": [
      { "label": "Canal expuesto 1", "value": 40 },
      { "label": "Canal expuesto 2", "value": 30 },
      { "label": "Canal expuesto 3", "value": 20 },
      { "label": "Amenaza Interna", "value": 10 }
    ],
    "riesgoPrincipal": "Riesgo primario si no implementan la solución",
    "impacto": "Consecuencia operativa, reputacional y financiera de perder el control o no asegurar el activo."
  },
  "contextoEstrategico": {
    "impacto": "Impacto operativo por inacción.",
    "rompehielo": "Pregunta gancho incisiva de Zero Trust o seguridad estratégica."
  },
  "pitch": {
    "apertura": "Apertura consultiva",
    "valor": "Propuesta de valor de ${manufacturer}",
    "cierre": "Cierre sugerido para accionables"
  },
  "casosDeUso": [
    {
      "titulo": "Fuga de datos por / Brecha por...",
      "dolor": "Dolor operativo actual",
      "solucion": "Solución ${solution}",
      "resultado": "Beneficio tangible"
    }
  ],
  "competencias": [
    "Diferenciador 1", "Diferenciador 2"
  ],
  "normativo": [
    { "norma": "Ley aplicable (GDPR, ISO, locales)", "descripcion": "Cómo o por qué aplica y de qué manera ayuda la solución." }
  ],
  "preguntasDescubrimiento": [
    "Pregunta consultiva 1 al CIO/CISO",
    "Pregunta consultiva 2",
    "Pregunta consultiva 3"
  ],
  "arquitecturaSugerida": [
    "Componente A", "Componente B", "Servicio C"
  ],
  "objeciones": [
    { "objecion": "Objeción común técnica, de coste o fricción 1", "respuesta": "Refutación usando características de la solución" },
    { "objecion": "Otra objeción común", "respuesta": "Refutación sólida" },
    { "objecion": "Otra duda ejecutiva", "respuesta": "Refutación de TCO o riesgo" }
  ],
  "herramientas": {
    "email": {
      "asunto": "Asunto llamativo y personalizado",
      "cuerpo": "Cuerpo persuasivo del correo con saltos de línea \\n para buscar la reunión."
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
  "fuentes": [
    "Dominio público 1", "Dominio 2"
  ]
}
`;

    const payload = {
      contents: [{ parts: [{ text: `Investiga la empresa ${companyName} y genera un perfil comercial y técnico para vender ${solution} de ${manufacturer}.` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${activeKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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

    if (!text) {
      return res.status(502).json({ error: 'La IA no devolvió contenido útil.' });
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      return res.status(502).json({
        error: 'La respuesta de la IA no fue un JSON válido.',
        raw: text,
        details: parseError.message
      });
    }

    res.json(parsed);
  } catch (error) {
    res.status(500).json({
      error: 'Fallo interno del servidor.',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Gamma Portfolio Explorer escuchando en puerto ${PORT}`);
});
