// public/pages/queries.js — Lista de consultas + formulario nueva consulta

import { api }        from '../js/api.js';

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
  if (s === 'done') return 'Completada';
  if (s === 'pending') return 'Pendiente';
  return 'Error';
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Nueva consulta ────────────────────────────────────────────────────────────
export async function renderQueryNew(queryParams) {
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

          <div id="q-error" class="alert alert-error hidden" style="grid-column:1/-1;"></div>

          <div style="grid-column:1/-1;display:flex;gap:12px;align-items:center;">
            <button id="q-submit" class="btn btn-primary btn-lg" onclick="submitQuery()">
              ⚡ Generar análisis
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Analysis Loading Overlay -->
    <div id="gamma-overlay" class="hidden" style="
      position:fixed;inset:0;z-index:9999;
      background:rgba(10,10,20,0.92);
      backdrop-filter:blur(8px);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:0;opacity:0;transition:opacity 0.4s ease;
    ">
      <!-- Radar animation -->
      <div style="position:relative;width:120px;height:120px;margin-bottom:32px;">
        <div id="gamma-radar" style="
          width:120px;height:120px;border-radius:50%;
          border:2px solid rgba(99,102,241,0.3);
          position:absolute;top:0;left:0;
          animation:radarPulse 2s ease-in-out infinite;
        "></div>
        <div style="
          width:80px;height:80px;border-radius:50%;
          border:2px solid rgba(99,102,241,0.5);
          position:absolute;top:20px;left:20px;
          animation:radarPulse 2s ease-in-out 0.4s infinite;
        "></div>
        <div style="
          width:44px;height:44px;border-radius:50%;
          background:linear-gradient(135deg,#6366f1,#8b5cf6);
          position:absolute;top:38px;left:38px;
          display:flex;align-items:center;justify-content:center;
          font-size:20px;
          box-shadow:0 0 30px rgba(99,102,241,0.6);
          animation:corePulse 1.5s ease-in-out infinite;
        ">&#9889;</div>
        <!-- Sweep line -->
        <div id="gamma-sweep" style="
          position:absolute;top:50%;left:50%;
          width:58px;height:2px;
          background:linear-gradient(to right,rgba(99,102,241,0.8),transparent);
          transform-origin:left center;
          animation:sweep 3s linear infinite;
          border-radius:2px;
        "></div>
      </div>

      <!-- Title + company -->
      <h2 id="gamma-ov-title" style="color:#fff;font-size:22px;font-weight:700;margin:0;text-align:center;letter-spacing:-0.5px;">Iniciando Gamma Intelligence…</h2>
      <p id="gamma-ov-company" style="color:rgba(255,255,255,0.5);font-size:14px;margin:6px 0 32px;"></p>

      <!-- Agent pipeline -->
      <div id="gamma-agents" style="display:flex;flex-direction:column;gap:10px;width:380px;">
        <!-- Filled by JS -->
      </div>

      <!-- Progress bar -->
      <div style="width:380px;margin-top:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span id="gamma-stage-label" style="font-size:12px;color:rgba(255,255,255,0.6);">Preparando agentes…</span>
          <span id="gamma-pct" style="font-size:12px;color:rgba(255,255,255,0.4);">0%</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
          <div id="gamma-progress" style="height:100%;width:0%;background:linear-gradient(to right,#6366f1,#8b5cf6);border-radius:4px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);"></div>
        </div>
      </div>

      <!-- Tip -->
      <div id="gamma-tip" style="
        margin-top:28px;max-width:400px;
        background:rgba(99,102,241,0.12);
        border:1px solid rgba(99,102,241,0.25);
        border-radius:12px;padding:14px 18px;
        font-size:12px;color:rgba(255,255,255,0.55);
        line-height:1.7;text-align:center;
        transition:opacity 0.4s ease;
      ">
        <span style="color:rgba(255,255,255,0.3);margin-right:6px;">&#128161;</span>
        <span id="gamma-tip-text">Gamma analiza información pública, tendencias del sector y el portafolio activo del fabricante para construir una estrategia de cuenta hiper-personalizada.</span>
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

  // Si estamos clonando, cargar datos
  const cloneId = queryParams?.get('cloneId');
  if (cloneId) {
    try {
      const q = await api.get(`/api/queries/${cloneId}`);
      if (q) {
        document.getElementById('q-company').value = q.company_name || '';
        document.getElementById('q-country').value = q.country || '';
        if (manufacturers.some(m => m.name === q.manufacturer)) {
          mfSel.value = q.manufacturer;
          globalThis.loadSolutions();
          const sol = document.getElementById('q-solution');
          if (Array.from(sol.options).some(o => o.value === q.solution)) {
            sol.value = q.solution;
          }
        }
        document.getElementById('q-notes').value = q.notes || '';
      }
    } catch (e) {
      console.warn('No se pudo cargar la consulta a clonar', e);
    }
  }

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
    const errEl    = document.getElementById('q-error');
    const btn      = document.getElementById('q-submit');

    const refIds = [...document.querySelectorAll('#refs-checkboxes input:checked')].map(i => Number(i.value));

    errEl.classList.add('hidden');
    if (!company) { errEl.textContent = 'La empresa objetivo es requerida.'; errEl.classList.remove('hidden'); return; }
    if (!mf || !sol) { errEl.textContent = 'Selecciona fabricante y solución.'; errEl.classList.remove('hidden'); return; }

    btn.disabled = true;
    startGammaOverlay(company, mf, sol);

    try {
      const data = await api.post('/api/queries', {
        companyName: company, manufacturer: mf, solution: sol,
        country, notes, referenceIds: refIds,
      });
      showToast('Análisis generado correctamente', 'success');
      stopGammaOverlay();
      navigate(`/queries/${data.id}`);
    } catch (err) {
      stopGammaOverlay();
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  };
}

// ── Gamma Analysis Overlay ────────────────────────────────────────────────────
const AGENTS = [
  { icon: '&#128269;', name: 'Research Agent',  label: 'Investigando la empresa y el sector…',        pct: 15  },
  { icon: '&#128737;', name: 'Risk Agent',       label: 'Evaluando riesgos y exposición cibernética…',  pct: 45  },
  { icon: '&#128188;', name: 'Pitch Agent',      label: 'Construyendo estrategia de pitch comercial…', pct: 70  },
  { icon: '&#128196;', name: 'Document Agent',   label: 'Consolidando el informe final…',              pct: 90  },
];

const TIPS = [
  'Gamma analiza información pública, tendencias del sector y el portafolio del fabricante para construir una estrategia hiper-personalizada.',
  'El Risk Agent evalúa exposición de datos, regulaciones aplicables y vectores de ataque específicos del sector del cliente.',
  'El Pitch Agent genera argumentos de valor diferencial según el rol del decisor (CISO, CTO, CEO) y el momento del ciclo de compra.',
  'El Document Agent consolida todo en un reporte estructurado con casos de uso, objeciones y un email de prospección listo para usar.',
  'Puedes regenerar el análisis en cualquier momento usando el botón “↺ Regenerar” para actualizar el contenido con el portafolio más reciente.',
];

let _overlayInterval = null;
let _tipInterval = null;

function injectOverlayStyles() {
  if (document.getElementById('gamma-overlay-styles')) return;
  const s = document.createElement('style');
  s.id = 'gamma-overlay-styles';
  s.textContent = `
    @keyframes radarPulse {
      0%,100% { transform:scale(1); opacity:0.4; }
      50%      { transform:scale(1.08); opacity:0.9; }
    }
    @keyframes corePulse {
      0%,100% { box-shadow:0 0 20px rgba(99,102,241,0.5); }
      50%      { box-shadow:0 0 45px rgba(99,102,241,0.9); }
    }
    @keyframes sweep {
      from { transform:rotate(0deg); }
      to   { transform:rotate(360deg); }
    }
    @keyframes agentSlideIn {
      from { opacity:0; transform:translateX(-12px); }
      to   { opacity:1; transform:translateX(0); }
    }
    @keyframes agentPulse {
      0%,100% { background:rgba(99,102,241,0.15); }
      50%      { background:rgba(99,102,241,0.28); }
    }
    .gamma-agent-row { animation: agentSlideIn 0.4s ease forwards; opacity:0; }
    .gamma-agent-active { animation: agentPulse 1.6s ease-in-out infinite !important; }
  `;
  document.head.appendChild(s);
}

function startGammaOverlay(company, mf, sol) {
  injectOverlayStyles();
  const ov = document.getElementById('gamma-overlay');
  if (!ov) return;

  // Set title
  document.getElementById('gamma-ov-title').textContent = 'Gamma Intelligence trabajando…';
  document.getElementById('gamma-ov-company').textContent = `${company}  ·  ${mf}  ·  ${sol}`;

  // Build agent rows (all pending)
  const agentsEl = document.getElementById('gamma-agents');
  agentsEl.innerHTML = AGENTS.map((a, i) => `
    <div id="gamma-agent-${i}" class="gamma-agent-row" style="
      display:flex;align-items:center;gap:12px;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:10px;padding:10px 14px;
      animation-delay:${i * 0.1}s;
      transition:background 0.4s, border-color 0.4s;
    ">
      <span style="font-size:20px;">${a.icon}</span>
      <div style="flex:1;min-width:0;">
        <p style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.8);margin:0;">${a.name}</p>
        <p id="gamma-agent-label-${i}" style="font-size:11px;color:rgba(255,255,255,0.35);margin:0;margin-top:2px;">${a.label}</p>
      </div>
      <span id="gamma-agent-status-${i}" style="font-size:18px;">&#9643;</span>
    </div>
  `).join('');

  // Show overlay
  ov.classList.remove('hidden');
  ov.style.display = 'flex';
  requestAnimationFrame(() => { ov.style.opacity = '1'; });

  // Progress animation
  let currentAgent = -1;
  const stageDurations = [14000, 70000, 50000, 30000]; // ~real timings
  const totalSteps = AGENTS.length;
  let elapsed = 0;
  let currentPct = 0;

  function advanceStage(idx) {
    // Mark previous done
    if (idx > 0) {
      const prevRow = document.getElementById(`gamma-agent-${idx-1}`);
      const prevStatus = document.getElementById(`gamma-agent-status-${idx-1}`);
      if (prevRow) { prevRow.style.background = 'rgba(34,197,94,0.1)'; prevRow.style.borderColor = 'rgba(34,197,94,0.25)'; prevRow.classList.remove('gamma-agent-active'); }
      if (prevStatus) prevStatus.innerHTML = '&#10003;';
      document.getElementById(`gamma-agent-label-${idx-1}`).style.color = 'rgba(34,197,94,0.7)';
    }
    if (idx >= AGENTS.length) return;

    // Activate current
    const row = document.getElementById(`gamma-agent-${idx}`);
    const status = document.getElementById(`gamma-agent-status-${idx}`);
    if (row) { row.style.background = 'rgba(99,102,241,0.15)'; row.style.borderColor = 'rgba(99,102,241,0.35)'; row.classList.add('gamma-agent-active'); }
    if (status) status.innerHTML = '<span style="display:inline-block;animation:corePulse 0.8s infinite;font-size:12px;">&#9679;</span>';
    document.getElementById(`gamma-agent-label-${idx}`).style.color = 'rgba(255,255,255,0.7)';

    // Update stage label
    document.getElementById('gamma-stage-label').textContent = AGENTS[idx].label;
    currentAgent = idx;
  }

  // Advance stages based on timing
  let totalElapsed = 0;
  advanceStage(0);
  for (let i = 1; i < AGENTS.length; i++) {
    totalElapsed += stageDurations[i-1];
    setTimeout(() => advanceStage(i), totalElapsed);
  }

  // Smooth progress bar
  const targetPcts = [0, 15, 45, 70, 88];
  let pctIdx = 0;
  _overlayInterval = setInterval(() => {
    const agent = document.getElementById('gamma-agent-0'); // still alive check
    if (!agent) { clearInterval(_overlayInterval); return; }

    // Interpolate toward next target
    const nextPct = pctIdx < targetPcts.length - 1 ? targetPcts[pctIdx + 1] : 92;
    if (currentPct < nextPct) {
      currentPct = Math.min(currentPct + 0.3, nextPct);
      document.getElementById('gamma-progress').style.width = `${currentPct}%`;
      document.getElementById('gamma-pct').textContent = `${Math.round(currentPct)}%`;
    }
  }, 300);

  // Stage index for progress
  let stageTarget = 0;
  const stageTimer = setInterval(() => {
    stageTarget = Math.min(stageTarget + 1, targetPcts.length - 1);
    pctIdx = stageTarget;
    if (stageTarget >= targetPcts.length - 1) clearInterval(stageTimer);
  }, 18000);

  // Rotating tips
  let tipIdx = 0;
  _tipInterval = setInterval(() => {
    const tipEl = document.getElementById('gamma-tip');
    const tipText = document.getElementById('gamma-tip-text');
    if (!tipEl || !tipText) { clearInterval(_tipInterval); return; }
    tipEl.style.opacity = '0';
    setTimeout(() => {
      tipIdx = (tipIdx + 1) % TIPS.length;
      tipText.textContent = TIPS[tipIdx];
      tipEl.style.opacity = '1';
    }, 400);
  }, 9000);
}

function stopGammaOverlay() {
  clearInterval(_overlayInterval);
  clearInterval(_tipInterval);
  const ov = document.getElementById('gamma-overlay');
  if (!ov) return;

  // Mark all done
  AGENTS.forEach((_, i) => {
    const row = document.getElementById(`gamma-agent-${i}`);
    const status = document.getElementById(`gamma-agent-status-${i}`);
    if (row) { row.style.background = 'rgba(34,197,94,0.1)'; row.style.borderColor = 'rgba(34,197,94,0.25)'; row.classList.remove('gamma-agent-active'); }
    if (status) status.innerHTML = '&#10003;';
  });

  // Fill bar
  const progress = document.getElementById('gamma-progress');
  const pct = document.getElementById('gamma-pct');
  if (progress) progress.style.width = '100%';
  if (pct) pct.textContent = '100%';

  // Fade out after a brief moment
  setTimeout(() => {
    ov.style.opacity = '0';
    setTimeout(() => {
      ov.style.display = 'none';
      ov.classList.add('hidden');
    }, 400);
  }, 600);
}
