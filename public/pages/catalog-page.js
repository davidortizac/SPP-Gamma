// public/pages/catalog-page.js — Gestión del catálogo de fabricantes y soluciones

import { api }      from '../js/api.js';
import { authState } from '../js/auth-state.js';
import { showToast, openModal, confirmDialog } from '../js/components.js';

const CATEGORIES = [
  { value: 'security',       label: 'Ciberseguridad' },
  { value: 'infrastructure', label: 'Infraestructura' },
  { value: 'observability',  label: 'Observabilidad' },
];

function catLabel(v) { return CATEGORIES.find(c => c.value === v)?.label || v; }
function catBadge(v) {
  const colors = { security: 'var(--accent-rose)', infrastructure: 'var(--brand-600)', observability: 'var(--accent-indigo)' };
  return `<span class="badge" style="background:${colors[v] || 'var(--surface-200)'};color:#fff;">${catLabel(v)}</span>`;
}

export async function renderCatalog() {
  const content  = document.getElementById('page-content');
  const isAdmin  = authState.isAdmin();

  content.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <h1>Catálogo de portafolio</h1>
          <p>Fabricantes y soluciones del portafolio Gamma</p>
        </div>
        ${isAdmin ? `<button class="btn btn-primary" onclick="addManufacturer()">+ Agregar fabricante</button>` : ''}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
        ${['', 'security', 'infrastructure', 'observability'].map(cat => `
          <button class="btn btn-secondary btn-sm ${cat === '' ? 'active' : ''}"
                  onclick="filterCat('${cat}',this)"
                  style="${cat === '' ? 'background:var(--brand-600);color:#fff;border-color:var(--brand-600);' : ''}">
            ${cat === '' ? 'Todos' : catLabel(cat)}
          </button>`).join('')}
      </div>

      <div id="catalog-grid" class="page-loading" style="min-height:200px;">
        <div class="loader loader-dark loader-lg"></div>
      </div>
    </div>`;

  await loadCatalog('');

  globalThis.filterCat = (cat, btn) => {
    document.querySelectorAll('.page-header ~ div button').forEach(b => {
      b.style.cssText = '';
      b.classList.remove('active');
    });
    btn.style.cssText = 'background:var(--brand-600);color:#fff;border-color:var(--brand-600);';
    loadCatalog(cat);
  };

  if (isAdmin) {
    globalThis.addManufacturer = () => openMfModal(null);
    globalThis.editManufacturer = (id, name, desc, cat) => openMfModal({ id, name, desc, cat });
    globalThis.deleteManufacturer = async (id) => {
      if (!await confirmDialog('¿Deshabilitar este fabricante?')) return;
      try { await api.delete(`/api/catalog/manufacturers/${id}`); showToast('Fabricante deshabilitado', 'success'); await loadCatalog(currentCat); }
      catch (err) { showToast(err.message, 'error'); }
    };
    globalThis.addSolution = (mfId) => openSolModal(null, mfId);
    globalThis.editSolution = (id, name, products, value) => openSolModal({ id, name, products, value });
    globalThis.deleteSolution = async (id) => {
      if (!await confirmDialog('¿Eliminar esta solución?')) return;
      try { await api.delete(`/api/catalog/solutions/${id}`); showToast('Solución eliminada', 'success'); await loadCatalog(currentCat); }
      catch (err) { showToast(err.message, 'error'); }
    };
  }
}

let currentCat = '';

async function loadCatalog(cat) {
  currentCat = cat;
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="page-loading" style="min-height:200px;"><div class="loader loader-dark loader-lg"></div></div>';

  try {
    const data = await api.get('/api/catalog');
    let mfs    = data.manufacturers || [];
    if (cat) mfs = mfs.filter(m => m.category === cat);

    if (mfs.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">📦</div><h3>Sin fabricantes en esta categoría</h3></div>`;
      return;
    }

    const isAdmin = authState.isAdmin();
    grid.innerHTML = `<div style="display:grid;gap:20px;">
      ${mfs.map(mf => `
        <div class="card">
          <div class="card-header" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <h3>${mf.name}</h3>
              ${catBadge(mf.category)}
            </div>
            ${isAdmin ? `
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="editManufacturer(${mf.id},'${esc(mf.name)}','${esc(mf.description)}','${mf.category}')">Editar</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--accent-rose);" onclick="deleteManufacturer(${mf.id})">✕</button>
              <button class="btn btn-secondary btn-sm" onclick="addSolution(${mf.id})">+ Solución</button>
            </div>` : ''}
          </div>
          <div class="card-body" style="padding-top:0;">
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">${mf.description || ''}</p>
            ${mf.solutions.length === 0 ? `<p style="font-size:12px;color:var(--text-muted);">Sin soluciones registradas</p>` : `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
              ${mf.solutions.map(s => `
                <div style="border:1px solid var(--surface-200);border-radius:var(--radius-md);padding:14px;font-size:12px;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
                    <p style="font-weight:700;font-size:13px;">${s.name}</p>
                    ${isAdmin ? `
                    <div style="display:flex;gap:4px;">
                      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="editSolution(${s.id},'${esc(s.name)}',${JSON.stringify(JSON.stringify(s.products || []))},${JSON.stringify(JSON.stringify(s.value || []))})">✎</button>
                      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;color:var(--accent-rose);" onclick="deleteSolution(${s.id})">✕</button>
                    </div>` : ''}
                  </div>
                  ${(s.products || []).length > 0 ? `
                  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">
                    ${s.products.map(p => `<span class="badge" style="font-size:11px;">${p}</span>`).join('')}
                  </div>` : ''}
                  ${(s.value || []).length > 0 ? `
                  <div style="margin-top:8px;display:flex;flex-direction:column;gap:2px;color:var(--text-secondary);">
                    ${s.value.slice(0,3).map(v => `<span>• ${v}</span>`).join('')}
                  </div>` : ''}
                </div>`).join('')}
            </div>`}
          </div>
        </div>`).join('')}
    </div>`;
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

// ── Modals ─────────────────────────────────────────────────────────────────────
function openMfModal(mf) {
  const isEdit = Boolean(mf);
  openModal({
    title: isEdit ? 'Editar fabricante' : 'Agregar fabricante',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input id="mf-name" class="form-input" value="${esc(mf?.name || '')}" placeholder="Ej: Palo Alto Networks" />
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea id="mf-desc" class="form-input" rows="2">${esc(mf?.desc || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Categoría *</label>
          <select id="mf-cat" class="form-input">
            ${CATEGORIES.map(c => `<option value="${c.value}" ${c.value === (mf?.cat || 'security') ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>
      </div>`,
    confirmText: isEdit ? 'Guardar' : 'Crear',
    onConfirm: async () => {
      const name = document.getElementById('mf-name').value.trim();
      const desc = document.getElementById('mf-desc').value.trim();
      const cat  = document.getElementById('mf-cat').value;
      if (!name) { showToast('El nombre es requerido', 'error'); return; }
      try {
        if (isEdit) {
          await api.put(`/api/catalog/manufacturers/${mf.id}`, { name, description: desc, category: cat });
        } else {
          await api.post('/api/catalog/manufacturers', { name, description: desc, category: cat });
        }
        showToast(isEdit ? 'Fabricante actualizado' : 'Fabricante creado', 'success');
        await loadCatalog(currentCat);
      } catch (err) { showToast(err.message, 'error'); }
    },
  });
}

function openSolModal(sol, mfId) {
  const isEdit = Boolean(sol);
  const products = isEdit ? (typeof sol.products === 'string' ? JSON.parse(sol.products) : sol.products || []) : [];
  const value    = isEdit ? (typeof sol.value    === 'string' ? JSON.parse(sol.value)    : sol.value    || []) : [];

  openModal({
    title: isEdit ? 'Editar solución' : 'Agregar solución',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input id="sol-name" class="form-input" value="${esc(sol?.name || '')}" placeholder="Ej: WAAP" />
        </div>
        <div class="form-group">
          <label class="form-label">Productos <span style="font-weight:400;color:var(--text-muted);">(uno por línea)</span></label>
          <textarea id="sol-products" class="form-input" rows="3" placeholder="Thunder ADC&#10;Thunder WAF">${products.join('\n')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Propuesta de valor <span style="font-weight:400;color:var(--text-muted);">(una por línea)</span></label>
          <textarea id="sol-value" class="form-input" rows="3" placeholder="Balanceo de aplicaciones&#10;Reducción de latencia">${value.join('\n')}</textarea>
        </div>
      </div>`,
    confirmText: isEdit ? 'Guardar' : 'Crear',
    onConfirm: async () => {
      const name  = document.getElementById('sol-name').value.trim();
      const prods = document.getElementById('sol-products').value.split('\n').map(s => s.trim()).filter(Boolean);
      const vals  = document.getElementById('sol-value').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!name) { showToast('El nombre es requerido', 'error'); return; }
      try {
        if (isEdit) {
          await api.put(`/api/catalog/solutions/${sol.id}`, { name, products: prods, value: vals });
        } else {
          await api.post(`/api/catalog/manufacturers/${mfId}/solutions`, { name, products: prods, value: vals });
        }
        showToast(isEdit ? 'Solución actualizada' : 'Solución creada', 'success');
        await loadCatalog(currentCat);
      } catch (err) { showToast(err.message, 'error'); }
    },
  });
}

function esc(s) { return (s || '').replace(/'/g, "\\'").replace(/\n/g, ' '); }
