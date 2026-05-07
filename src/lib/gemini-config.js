// src/lib/gemini-config.js — Resolución de API key y modelo desde DB o env

import { query } from '../db/database.js';

/**
 * Devuelve la API key efectiva para Gemini:
 * 1. Header x-api-key de la request (override por usuario)
 * 2. Valor almacenado en app_config (configurado desde admin panel)
 * 3. Variable de entorno GEMINI_API_KEY
 */
export async function resolveApiKey(req) {
  const headerKey = (req.headers['x-api-key'] || '').trim();
  if (headerKey) {
    console.log('[Gemini] API key: header x-api-key');
    return headerKey;
  }

  try {
    const r = await query(`SELECT value FROM app_config WHERE key = 'gemini_api_key'`);
    if (r.rows[0]?.value) {
      console.log('[Gemini] API key: app_config (BD)');
      return r.rows[0].value;
    }
  } catch (dbErr) {
    console.warn('[Gemini] No se pudo leer api_key de BD:', dbErr.message);
  }

  const envKey = (process.env.GEMINI_API_KEY || '').trim();
  if (envKey) {
    console.log(`[Gemini] API key: env (${envKey.slice(0,8)}...${envKey.slice(-4)})`);
  } else {
    console.error('[Gemini] ⚠ No hay API key configurada (env vacío, sin header, sin BD)');
  }
  return envKey;
}

/**
 * Devuelve el modelo Gemini efectivo:
 * 1. Valor en app_config.gemini_model
 * 2. Variable de entorno GEMINI_MODEL
 * 3. Default: gemini-2.5-flash
 */
export async function resolveModel() {
  try {
    const r = await query(`SELECT value FROM app_config WHERE key = 'gemini_model'`);
    if (r.rows[0]?.value) return r.rows[0].value;
  } catch (_) { /* ignora */ }

  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}
