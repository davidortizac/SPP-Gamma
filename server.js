// server.js — SPP-Gamma v2.0
import 'dotenv/config';
import express from 'express';
import path    from 'node:path';
import { fileURLToPath } from 'node:url';

import { initDatabase } from './src/db/schema.js';

import authRouter       from './src/routes/auth.js';
import catalogRouter    from './src/routes/catalog.js';
import queriesRouter    from './src/routes/queries.js';
import chatRouter       from './src/routes/chat.js';
import macroRouter      from './src/routes/macro.js';
import referencesRouter from './src/routes/references.js';
import adminRouter      from './src/routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware globales ───────────────────────────────────────────────────────
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));

// ─── Rutas públicas ───────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ─── Config pública ───────────────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({
    hasServerKey: Boolean(process.env.GEMINI_API_KEY),
    defaultModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    appName:      'Gamma Portfolio Explorer',
  });
});

// ─── Rutas protegidas ─────────────────────────────────────────────────────────
app.use('/api/catalog',    catalogRouter);
app.use('/api/queries',    queriesRouter);
app.use('/api/queries/:id/chat', chatRouter);
app.use('/api/macro',      macroRouter);
app.use('/api/references', referencesRouter);
app.use('/api/admin',      adminRouter);

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Inicialización ───────────────────────────────────────────────────────────
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n🚀 Gamma Portfolio Explorer v2.0`);
      console.log(`   Puerto: ${PORT}`);
      console.log(`   Modelo: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
      console.log(`   Admin:  ${process.env.ADMIN_EMAIL || 'no configurado'}\n`);
    });
  } catch (err) {
    console.error('[Boot] Error iniciando servidor:', err.message);
    process.exit(1);
  }
}

start();
