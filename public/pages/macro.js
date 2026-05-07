// public/pages/macro.js — Consultas macro multi-fabricante

import { api }       from '../js/api.js';
import { showToast, fmtDate, confirmDialog } from '../js/components.js';
import { navigate }  from '../js/router.js';

// ── Lista ─────────────────────────────────────────────────────────────────────
export async function renderMacroList() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <h1>Consultas Macro</h1>
          <p>Visión integrada multi-fabricante para una misma cuenta o territorio</p>
        </div>
        <button class="btn btn-primary" onclick="navigate('/macro/new')">+ Nueva macro</button>
      </div>
      <div id="macro-list-wrap"><div class="page-loading"><div class="loader loader-dark loader-lg"></div></div></div>
    </div>`;

  try {
    const data = await api.get('/api/macro');
    const rows = data.macros || [];

    if (rows.length === 0) {
      document.getElementById('macro-list-wrap').innerHTML = `
        <div class="empty-state" style="padding:60px 20px;">
          <div class="empty-state-icon">🌐</div>
          <h3>Sin macro-consultas</h3>
          <p>Combina múltiples análisis para una visión estratégica integrada.</p>
          <button class="btn btn-primary" onclick="navigate('/macro/new')">+ Nueva macro</button>
        </div>`;
      return;
    }

    document.getElementById('macro-list-wrap').innerHTML = `
      <div style="display:grid;gap:16px;">
        ${rows.map(m => `
          <div class="card" style="cursor:pointer;" onclick="navigate('/macro/${m.id}')">
            <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
              <div>
                <p style="font-weight:700;font-size:15px;">${m.name}</p>
                <p style="color:var(--text-secondary);font-size:13px;margin-top:4px;">${m.description || ''}</p>
                <p style="color:var(--text-muted);font-size:11px;margin-top:6px;">${fmtDate(m.created_at)} · ${m.user_name || ''}</p>
              </div>
              <div style="display:flex;gap:6px;">
                <span class="badge">${(m.query_ids || []).length} consultas</span>
                <button class="btn btn-ghost btn-sm" style="color:var(--accent-rose);" onclick="event.stopPropagation();deleteMacro(${m.id})">✕</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;

    globalThis.deleteMacro = async (id) => {
      if (!await confirmDialog('¿Eliminar esta macro-consulta?')) return;
      try {
        await api.delete(`/api/macro/${id}`);
        showToast('Eliminada', 'success');
        await renderMacroList();
      } catch (err) { showToast(err.message, 'error'); }
    };
  } catch (err) {
    document.getElementById('macro-list-wrap').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

// ── Nueva macro ───────────────────────────────────────────────────────────────
export async function renderMacroNew() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-container" style="max-width:800px;">
      <div class="page-header">
        <button class="btn btn-ghost btn-sm" onclick="navigate('/macro')">← Volver</button>
        <h1>Nueva macro-consulta</h1>
        <p>Combina análisis de múltiples fabricantes para una visión estratégica integrada</p>
      </div>
      <div class="card">
        <div class="card-body" style="display:flex;flex-direction:column;gap:20px;">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input id="m-name" class="form-input" placeholder="Ej: Estrategia Bancolombia 2025" />
          </div>
          <div class="form-group">
            <label class="form-label">Descripción</label>
            <input id="m-desc" class="form-input" placeholder="Contexto o alcance de esta visión macro" />
          </div>
          <div class="form-group">
            <label class="form-label">Empresa objetivo (para síntesis IA)</label>
            <input id="m-company" class="form-input" placeholder="Nombre de la empresa" />
          </div>
          <div class="form-group">
            <label class="form-label">País / Región</label>
            <input id="m-country" class="form-input" placeholder="Ej: Colombia" />
          </div>
          <div class="form-group">
            <label class="form-label">Consultas a incluir</label>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Solo consultas completadas. Selecciona las que quieres combinar.</p>
            <div id="queries-checkboxes" style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">
              <div class="page-loading" style="min-height:80px;"><div class="loader loader-dark"></div></div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">API Key Gemini <span style="font-weight:400;color:var(--text-muted);">(para síntesis IA)</span></label>
            <input id="m-apikey" type="password" class="form-input" placeholder="AIza..." />
          </div>
          <div id="m-error" class="alert alert-error hidden"></div>
          <div style="display:flex;gap:12px;align-items:center;">
            <button id="m-submit" class="btn btn-primary btn-lg" onclick="submitMacro()">Crear macro-consulta</button>
            <div id="m-loader" class="hidden" style="display:flex;align-items:center;gap:8px;">
              <div class="loader" style="width:20px;height:20px;border-width:3px;"></div>
              <span style="font-size:13px;color:var(--text-secondary);">Sintetizando análisis con IA...</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Cargar consultas completadas
  try {
    const data = await api.get('/api/queries?status=done&limit=100');
    const rows = data.queries || [];
    const wrap = document.getElementById('queries-checkboxes');

    if (rows.length === 0) {
      wrap.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">No hay consultas completadas. Genera análisis primero.</p>`;
    } else {
      wrap.innerHTML = rows.map(q => `
        <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:8px 12px;border:1px solid var(--surface-200);border-radius:var(--radius-sm);background:var(--surface-0);">
          <input type="checkbox" value="${q.id}" style="accent-color:var(--brand-600);" />
          <span><strong>${q.company_name}</strong> · ${q.manufacturer} / ${q.solution}
            <span style="color:var(--text-muted);"> — ${fmtDate(q.created_at)}</span></span>
        </label>`).join('');
    }
  } catch (_) {
    document.getElementById('queries-checkboxes').innerHTML = `<p style="color:var(--accent-rose);font-size:13px;">Error cargando consultas.</p>`;
  }

  globalThis.submitMacro = async () => {
    const name    = document.getElementById('m-name').value.trim();
    const desc    = document.getElementById('m-desc').value.trim();
    const company = document.getElementById('m-company').value.trim();
    const country = document.getElementById('m-country').value.trim();
    const apiKey  = document.getElementById('m-apikey').value.trim();
    const errEl   = document.getElementById('m-error');
    const btn     = document.getElementById('m-submit');
    const loader  = document.getElementById('m-loader');
    const queryIds = [...document.querySelectorAll('#queries-checkboxes input:checked')].map(i => Number(i.value));

    errEl.classList.add('hidden');
    if (!name) { errEl.textContent = 'El nombre es requerido.'; errEl.classList.remove('hidden'); return; }

    btn.disabled = true;
    loader.classList.remove('hidden');
    loader.style.display = 'flex';

    try {
      const headers = apiKey ? { 'X-Api-Key': apiKey } : {};
      const data = await api.post('/api/macro', { name, description: desc, queryIds, companyName: company, country });
      showToast('Macro-consulta creada', 'success');
      navigate(`/macro/${data.id}`);
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

// ── Detalle macro ─────────────────────────────────────────────────────────────
export async function renderMacroDetail(id) {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-container">
      <button class="btn btn-ghost btn-sm" onclick="navigate('/macro')">← Volver</button>
      <div id="macro-detail-body" style="margin-top:16px;">
        <div class="page-loading"><div class="loader loader-dark loader-lg"></div></div>
      </div>
    </div>`;

  try {
    const data = await api.get(`/api/macro/${id}`);
    const r    = data.result_json || {};
    const body = document.getElementById('macro-detail-body');

    body.innerHTML = `
      <div style="display:grid;gap:24px;">
        <div class="card" style="background:linear-gradient(135deg,var(--brand-900),var(--brand-700));color:#fff;">
          <div class="card-body">
            <h2 style="color:#fff;">${data.name}</h2>
            <p style="color:rgba(255,255,255,.7);margin-top:4px;">${data.description || ''}</p>
            <p style="color:rgba(255,255,255,.5);font-size:12px;margin-top:8px;">${fmtDate(data.created_at)} · ${data.user_name || ''}</p>
          </div>
        </div>

        ${r.resumenMacro ? `
        <div class="card">
          <div class="card-header"><h3>Resumen estratégico</h3></div>
          <div class="card-body"><p style="font-size:14px;line-height:1.8;color:var(--text-secondary);">${r.resumenMacro}</p></div>
        </div>` : ''}

        ${(r.mapaDeRiesgos || []).length > 0 ? `
        <div class="card">
          <div class="card-header"><h3>Mapa de riesgos</h3></div>
          <div class="card-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
            ${r.mapaDeRiesgos.map(m => `
              <div style="border:1px solid var(--surface-200);border-radius:var(--radius-md);padding:14px;font-size:13px;">
                <p style="font-weight:700;color:var(--brand-600);">${m.area}</p>
                <p style="margin-top:4px;color:var(--text-secondary);">${m.riesgo}</p>
                <span class="badge badge-done" style="margin-top:8px;">${m.tecnologia}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}

        ${(r.roadmap || []).length > 0 ? `
        <div class="card">
          <div class="card-header"><h3>Roadmap de implementación</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:12px;">
            ${r.roadmap.map((fase, i) => `
              <div style="display:flex;gap:14px;align-items:flex-start;">
                <div style="width:28px;height:28px;background:var(--brand-600);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${i+1}</div>
                <div style="font-size:13px;">
                  <p style="font-weight:700;">${fase.fase}</p>
                  <p style="color:var(--text-secondary);margin-top:2px;">${fase.descripcion}</p>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                    ${(fase.tecnologias || []).map(t => `<span class="badge">${t}</span>`).join('')}
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}

        ${r.pitchEjecutivo ? `
        <div class="card" style="background:var(--brand-50);border:1px solid var(--brand-100);">
          <div class="card-header"><h3>Pitch ejecutivo integrado</h3></div>
          <div class="card-body"><p style="font-size:14px;line-height:1.8;">${r.pitchEjecutivo}</p></div>
        </div>` : ''}

        <!-- Sub-consultas incluidas -->
        ${(data.sub_queries || []).length > 0 ? `
        <div class="card">
          <div class="card-header"><h3>Análisis incluidos</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
            ${data.sub_queries.map(q => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px solid var(--surface-200);border-radius:var(--radius-sm);font-size:13px;">
                <span><strong>${q.company_name}</strong> · ${q.manufacturer} / ${q.solution}</span>
                <button class="btn btn-ghost btn-sm" onclick="navigate('/queries/${q.id}')">Ver →</button>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>`;
  } catch (err) {
    document.getElementById('macro-detail-body').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
