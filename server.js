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
Tu misión es construir un análisis comercial y técnico para una cuenta objetivo y mapearla con una solución de un fabricante específico.

Debes investigar información pública sobre la empresa usando búsqueda web y devolver ÚNICAMENTE un JSON válido.
No incluyas markdown, comentarios, texto adicional ni bloque de código.

Contexto de entrada:
- Empresa: ${companyName}
- Fabricante: ${manufacturer}
- Solución: ${solution}
- País objetivo: ${country || 'No especificado'}
- Notas adicionales: ${notes || 'Ninguna'}

Devuelve exactamente esta estructura JSON:
{
  "empresa": "Nombre de la empresa",
  "fabricante": "${manufacturer}",
  "solucion": "${solution}",
  "resumenEjecutivo": "Resumen ejecutivo breve y claro",
  "perfilamiento": {
    "sector": "Sector o industria real",
    "geografia": "País o región principal",
    "core": "Qué hace la empresa y cómo gana dinero",
    "rol": "Cargo objetivo a contactar",
    "activosCriticos": ["Activo 1", "Activo 2", "Activo 3"]
  },
  "riesgos": {
    "tiposDatos": [
      { "label": "Tipo de dato 1", "value": 35 },
      { "label": "Tipo de dato 2", "value": 25 },
      { "label": "Tipo de dato 3", "value": 20 },
      { "label": "Tipo de dato 4", "value": 20 }
    ],
    "riesgoPrincipal": "Principal riesgo asociado a la empresa y a la solución",
    "impacto": "Impacto operativo, financiero o reputacional"
  },
  "casosDeUso": [
    {
      "titulo": "Caso de uso 1",
      "dolor": "Problema observado o probable",
      "solucion": "Cómo ayuda la solución seleccionada",
      "resultado": "Beneficio esperado"
    }
  ],
  "pitch": {
    "apertura": "Apertura comercial consultiva",
    "valor": "Propuesta de valor específica del fabricante y la solución",
    "cierre": "Cierre sugerido para siguiente paso"
  },
  "competencias": [
    "Capacidad del fabricante alineada al caso",
    "Capacidad técnica relevante",
    "Diferencial competitivo"
  ],
  "normativo": [
    { "norma": "Norma o regulación", "descripcion": "Por qué aplica" }
  ],
  "preguntasDescubrimiento": [
    "Pregunta 1",
    "Pregunta 2",
    "Pregunta 3"
  ],
  "arquitecturaSugerida": [
    "Componente o producto 1",
    "Componente o producto 2",
    "Componente o producto 3"
  ],
  "fuentes": [
    "Dominio o fuente pública 1",
    "Dominio o fuente pública 2"
  ]
}`;

    const payload = {
      contents: [{ parts: [{ text: `Investiga la empresa ${companyName} y genera un perfil comercial y técnico para vender ${solution} de ${manufacturer}.` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ google_search: {} }]
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
