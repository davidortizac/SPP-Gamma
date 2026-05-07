// public/pages/queries.js — Lista de consultas + formulario nueva consulta

import { api }        from '../js/api.js';
import { authState }  from '../js/auth-state.js';
import { showToast, fmtDate, confirmDialog } from '../js/components.js';
import { navigate }   from '../js/router.js';

// ── Lista de consultas ────────────────────────────────────────────────────────
export async function renderQueryList() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div><h1>Consultas</h1><p>Historial de análisis generados</p></div>
        <button class="btn btn-primary" onclick="navigate('/queries/new')">+ Nueva consulta</button>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-body" style="display:flex;gap:12px;flex-wrap:wrap;">
          <input id="filter-company" class="form-input" style="max-width:260px;" placeholder="Buscar empresa..." oninput="filterQueries()" />
          <select id="filter-status" class="form-input" style="max-width:160px;" onchange="filterQueries()">
            <option value="">Todos los estados</option>
            <option value="done">Completadas</option>
            <option value="pending">Pendientes</option>
            <option value="error">Con error</option>
          </select>
        </div>
      </div>

      <div id="queries-table-wrap">
        <div class="page-loading"><div class="loader loader-dark loader-lg"></div></div>
      </div>
    </div>
  `;

  globalThis.filterQueries = debounce(loadQueries, 350);
  await loadQueries();
}

async function loadQueries() {
  const wrap    = document.getElementById('queries-table-wrap');
  const company = document.getElementById('filter-company')?.value || '';
  const status  = document.getElementById('filter-status')?.value  || '';

  try {
    const params = new URLSearchParams({ limit: 50 });
    if (company) params.set('company', company);
    if (status)  params.set('status',  status);
    const data = await api.get(`/api/queries?${params}`);
    const rows = data.queries || [];

    if (rows.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:60px 20px;">
          <div class="empty-state-icon">📭</div>
          <h3>Sin consultas</h3>
          <p>Genera tu primera consulta de análisis de cuenta.</p>
          <button class="btn btn-primary" onclick="navigate('/queries/new')">+ Nueva consulta</button>
        </div>`;
      return;
    }

    wrap.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr>
            <th>Empresa</th><th>Fabricante / Solución</th>
            <th>Usuario</th><th>Estado</th><th>Fecha</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map(q => `
              <tr>
                <td style="font-weight:600;">${q.company_name}</td>
                <td style="color:var(--text-secondary);">${q.manufacturer} · ${q.solution}</td>
                <td style="color:var(--text-muted);font-size:12px;">${q.user_name || ''}</td>
                <td><span class="badge badge-${q.status}">${statusLabel(q.status)}</span></td>
                <td style="color:var(--text-muted);font-size:12px;">${fmtDate(q.created_at)}</td>
                <td style="display:flex;gap:6px;">
                  <button class="btn btn-ghost btn-sm" onclick="navigate('/queries/${q.id}')">Ver →</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--accent-rose);" onclick="deleteQuery(${q.id})">✕</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    globalThis.deleteQuery = async (id) => {
      if (!await confirmDialog('¿Eliminar esta consulta? No se puede deshacer.')) return;
      try {
        await api.delete(`/api/queries/${id}`);
        showToast('Consulta eliminada', 'success');
        await loadQueries();
      } catch (err) { showToast(err.message, 'error'); }
    };
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function statusLabel(s) {
  return s === 'done' ? 'Completada' : s === 'pending' ? 'Pendiente' : 'Error';
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Nueva consulta ────────────────────────────────────────────────────────────
export async function renderQueryNew() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-container" style="max-width:860px;">
      <div class="page-header">
        <button class="btn btn-ghost btn-sm" onclick="navigate('/queries')">← Volver</button>
        <h1>Nueva consulta</h1>
        <p>Genera un análisis consultivo de cuenta asistido por IA</p>
      </div>

      <div class="card">
        <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Empresa objetivo *</label>
            <input id="q-company" class="form-input" placeholder="Ej: Bancolombia, Ecopetrol, Grupo Nutresa" />
          </div>

          <div class="form-group">
            <label class="form-label">País / Región</label>
            <input id="q-country" class="form-input" placeholder="Ej: Colombia, Perú, Latam" />
          </div>

          <div class="form-group">
            <label class="form-label">Fabricante *</label>
            <select id="q-manufacturer" class="form-input" onchange="loadSolutions()">
              <option value="">Cargando...</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Solución *</label>
            <select id="q-solution" class="form-input">
              <option value="">Selecciona fabricante primero</option>
            </select>
          </div>

          <div id="portfolio-preview" class="card" style="grid-column:1/-1;background:var(--brand-50);border:1px solid var(--brand-100);"></div>

          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Referencias de contexto</label>
            <div id="refs-checkboxes" style="display:flex;flex-wrap:wrap;gap:8px;min-height:32px;">
              <span style="font-size:13px;color:var(--text-muted);">Cargando referencias...</span>
            </div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:6px;">Selecciona referencias adicionales para enriquecer el análisis</p>
          </div>

          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">Notas para personalizar</label>
            <textarea id="q-notes" class="form-input" rows="3" placeholder="Ej: enfoque en cumplimiento regulatorio, integración con SOC, prioridad en canales digitales..."></textarea>
          </div>

          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">API Key Gemini <span style="font-weight:400;color:var(--text-muted);">(opcional si el servidor ya la tiene)</span></label>
            <input id="q-apikey" type="password" class="form-input" placeholder="AIza..." />
          </div>

          <div id="q-error" class="alert alert-error hidden" style="grid-column:1/-1;"></div>

          <div style="grid-column:1/-1;display:flex;gap:12px;align-items:center;">
            <button id="q-submit" class="btn btn-primary btn-lg" onclick="submitQuery()">
              Generar análisis
            </button>
            <div id="q-loader" class="hidden" style="display:flex;align-items:center;gap:8px;">
              <div class="loader" style="width:20px;height:20px;border-width:3px;"></div>
              <span style="font-size:13px;color:var(--text-secondary);">Investigando empresa y construyendo análisis...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Cargar catálogo y referencias en paralelo
  const [catalogData, refsData] = await Promise.all([
    api.get('/api/catalog').catch(() => ({ manufacturers: [] })),
    api.get('/api/references').catch(() => ({ references: [] })),
  ]);

  const manufacturers = catalogData.manufacturers || [];
  const refs          = refsData.references || [];

  // Populate manufacturer select
  const mfSel = document.getElementById('q-manufacturer');
  mfSel.innerHTML = manufacturers.map(m =>
    `<option value="${m.name}">${m.name} (${m.category || ''})</option>`
  ).join('');

  // References checkboxes
  const refsWrap = document.getElementById('refs-checkboxes');
  if (refs.length === 0) {
    refsWrap.innerHTML = `<span style="font-size:13px;color:var(--text-muted);">No hay referencias guardadas · <button class="btn btn-ghost btn-sm" onclick="navigate('/references')">Agregar</button></span>`;
  } else {
    refsWrap.innerHTML = refs.map(r => `
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:4px 10px;border:1px solid var(--surface-200);border-radius:var(--radius-sm);background:var(--surface-0);">
        <input type="checkbox" value="${r.id}" style="accent-color:var(--brand-600);" />
        ${r.title}
      </label>`).join('');
  }

  // Load solutions helper
  globalThis.loadSolutions = () => {
    const mf   = manufacturers.find(m => m.name === mfSel.value);
    const sols = mf?.solutions || [];
    const sol  = document.getElementById('q-solution');
    sol.innerHTML = sols.length
      ? sols.map(s => `<option value="${s.name}">${s.name}</option>`).join('')
      : `<option value="">Sin soluciones</option>`;
    updatePreview(mf, sols[0]);
    sol.onchange = () => updatePreview(mf, mf?.solutions.find(s => s.name === sol.value));
  };
  globalThis.loadSolutions();

  function updatePreview(mf, sol) {
    const wrap = document.getElementById('portfolio-preview');
    if (!mf) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px;">
        <div>
          <p style="font-weight:700;color:var(--brand-600);">${mf.name}</p>
          <p style="color:var(--text-secondary);">${mf.description || ''}</p>
          <span class="badge" style="margin-top:6px;">${mf.category || ''}</span>
        </div>
        <div>
          <p style="font-weight:700;">${sol?.name || ''}</p>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
            ${(sol?.products || []).map(p => `<span class="badge">${p}</span>`).join('')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
            ${(sol?.value || []).slice(0,3).map(v => `<span class="badge badge-done" style="font-size:11px;">${v}</span>`).join('')}
          </div>
        </div>
      </div>`;
  }

  globalThis.submitQuery = async () => {
    const company  = document.getElementById('q-company').value.trim();
    const country  = document.getElementById('q-country').value.trim();
    const mf       = document.getElementById('q-manufacturer').value;
    const sol      = document.getElementById('q-solution').value;
    const notes    = document.getElementById('q-notes').value.trim();
    const apiKey   = document.getElementById('q-apikey').value.trim();
    const errEl    = document.getElementById('q-error');
    const btn      = document.getElementById('q-submit');
    const loader   = document.getElementById('q-loader');

    const refIds   = [...document.querySelectorAll('#refs-checkboxes input:checked')].map(i => Number(i.value));

    errEl.classList.add('hidden');
    if (!company) { errEl.textContent = 'La empresa objetivo es requerida.'; errEl.classList.remove('hidden'); return; }
    if (!mf || !sol) { errEl.textContent = 'Selecciona fabricante y solución.'; errEl.classList.remove('hidden'); return; }

    btn.disabled = true;
    loader.classList.remove('hidden');
    loader.style.display = 'flex';

    try {
      const headers = apiKey ? { 'X-Api-Key': apiKey } : {};
      const data = await api.post('/api/queries', {
        companyName: company, manufacturer: mf, solution: sol,
        country, notes, referenceIds: refIds,
      });
      showToast('Análisis generado correctamente', 'success');
      navigate(`/queries/${data.id}`);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      loader.classList.add('hidden');
      loader.style.display = 'none';
    }
  };
}
