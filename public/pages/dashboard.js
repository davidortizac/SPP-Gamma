// public/pages/dashboard.js — Dashboard por perfil de usuario

import { authState } from '../js/auth-state.js';
import { api }       from '../js/api.js';
import { fmtDate }   from '../js/components.js';

const hasPerm = (p) => authState.hasPermission(p);

export async function renderDashboard() {
  const content = document.getElementById('page-content');
  const user    = authState.user;

  content.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <h1>Hola, ${user.name.split(' ')[0]}</h1>
          <p>Panel de control · <span class="badge badge-${user.role === 'admin' ? 'pending' : 'done'}">${user.role === 'admin' ? 'Administrador' : 'Analista'}</span></p>
        </div>
        <button class="btn btn-primary btn-lg" onclick="navigate('/queries/new')">+ Nueva consulta</button>
      </div>

      <!-- Stats -->
      <div id="stats-row" class="grid-4" style="margin-bottom:32px;">
        <div class="stat-card"><div class="stat-icon blue">🔍</div><div><div class="stat-value" id="stat-total">—</div><div class="stat-label">Consultas totales</div></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value" id="stat-done">—</div><div class="stat-label">Completadas</div></div></div>
        <div class="stat-card"><div class="stat-icon amber">🌐</div><div><div class="stat-value" id="stat-macro">—</div><div class="stat-label">Macro-consultas</div></div></div>
        <div class="stat-card"><div class="stat-icon indigo">📎</div><div><div class="stat-value" id="stat-refs">—</div><div class="stat-label">Referencias activas</div></div></div>
      </div>

      <!-- About + Accesos rápidos -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;" class="about-grid">
        <div class="card">
          <div class="card-header"><span style="font-size:18px;">🎯</span><h3>Gamma Portfolio Explorer</h3></div>
          <div class="card-body" style="font-size:14px;color:var(--text-secondary);line-height:1.8;">
            <p style="margin-bottom:12px;">
              Plataforma de <strong style="color:var(--text-primary);">inteligencia de preventa</strong> del equipo Gamma.
              Usa IA (Gemini + Google Search) para investigar empresas objetivo y generar análisis comerciales completos alineados al portafolio multimarca.
            </p>
            <ul style="padding-left:20px;">
              <li>Perfil de empresa con contexto real (Google Search)</li>
              <li>Pitch, manejo de objeciones y email de prospección</li>
              <li>Chat contextual post-análisis</li>
              <li>Consultas macro multi-fabricante</li>
              <li>Referencias de contexto personalizables</li>
            </ul>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span style="font-size:18px;">⚡</span><h3>Accesos rápidos</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
            ${hasPerm('queries') ? `
            <button class="btn btn-secondary btn-full" style="justify-content:flex-start;gap:12px;" onclick="navigate('/queries/new')">
              <span style="font-size:16px;">🔍</span><span>Generar nuevo análisis de cuenta</span>
            </button>
            <button class="btn btn-ghost btn-full" style="justify-content:flex-start;gap:12px;" onclick="navigate('/queries')">
              <span style="font-size:16px;">📋</span><span>Ver historial de consultas</span>
            </button>` : ''}
            ${hasPerm('macro') ? `
            <button class="btn btn-ghost btn-full" style="justify-content:flex-start;gap:12px;" onclick="navigate('/macro/new')">
              <span style="font-size:16px;">🌐</span><span>Crear consulta macro multi-fabricante</span>
            </button>` : ''}
            ${hasPerm('references') ? `
            <button class="btn btn-ghost btn-full" style="justify-content:flex-start;gap:12px;" onclick="navigate('/references')">
              <span style="font-size:16px;">📎</span><span>Gestionar referencias de contexto</span>
            </button>` : ''}
            ${hasPerm('catalog') ? `
            <button class="btn btn-ghost btn-full" style="justify-content:flex-start;gap:12px;" onclick="navigate('/catalog')">
              <span style="font-size:16px;">📦</span><span>Ver catálogo de portafolio</span>
            </button>` : ''}
            ${user.role === 'admin' ? `
            <button class="btn btn-ghost btn-full" style="justify-content:flex-start;gap:12px;color:var(--amber-600);" onclick="navigate('/admin')">
              <span style="font-size:16px;">⚙️</span><span>Panel de administración</span>
            </button>` : ''}
          </div>
        </div>
      </div>

      <!-- Consultas recientes -->
      <div class="card">
        <div class="card-header" style="justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;"><span style="font-size:18px;">🕐</span><h3>Consultas recientes</h3></div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('/queries')">Ver todas →</button>
        </div>
        <div id="recent-queries">
          <div class="page-loading" style="min-height:120px;"><div class="loader loader-dark"></div></div>
        </div>
      </div>
    </div>
  `;

  // Cargar stats y recientes en paralelo
  const [statsData, queriesData] = await Promise.allSettled([
    api.get('/api/queries/stats'),
    api.get('/api/queries?limit=5'),
  ]);

  if (statsData.status === 'fulfilled') {
    const s = statsData.value;
    document.getElementById('stat-total').textContent = s.total ?? '—';
    document.getElementById('stat-done').textContent  = s.done  ?? '—';
    document.getElementById('stat-macro').textContent = s.macro ?? '—';
    document.getElementById('stat-refs').textContent  = s.references ?? '—';
  }

  const recentEl = document.getElementById('recent-queries');
  if (queriesData.status === 'fulfilled') {
    const rows = queriesData.value.queries || [];
    if (rows.length === 0) {
      recentEl.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          <div class="empty-state-icon">📭</div>
          <h3>Sin consultas aún</h3>
          <p>Genera tu primera consulta para ver el historial aquí.</p>
          <button class="btn btn-primary" onclick="navigate('/queries/new')">+ Nueva consulta</button>
        </div>`;
    } else {
      recentEl.innerHTML = `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>Empresa</th><th>Fabricante / Solución</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              ${rows.map(q => {
                let statusLabel;
                if (q.status === 'done')    statusLabel = 'Completada';
                else if (q.status === 'pending') statusLabel = 'Pendiente';
                else statusLabel = 'Error';
                return `<tr>
                  <td style="font-weight:600;">${q.company_name}</td>
                  <td style="color:var(--text-secondary);">${q.manufacturer} · ${q.solution}</td>
                  <td><span class="badge badge-${q.status}">${statusLabel}</span></td>
                  <td style="color:var(--text-muted);font-size:12px;">${fmtDate(q.created_at)}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="navigate('/queries/${q.id}')">Ver →</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }
  } else {
    recentEl.innerHTML = `<div class="alert alert-info" style="margin:16px;">No se pudo cargar el historial.</div>`;
  }
}
