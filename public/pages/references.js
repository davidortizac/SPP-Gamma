// public/pages/references.js — Referencias de contexto para enriquecer análisis

import { api }       from '../js/api.js';
import { showToast, openModal, closeModal, confirmDialog, fmtDate } from '../js/components.js';

export async function renderReferences() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <h1>Referencias de contexto</h1>
          <p>Agrega URLs o textos que enriquecen el contexto de tus análisis de cuenta</p>
        </div>
        <button class="btn btn-primary" onclick="openRefModal()">+ Agregar referencia</button>
      </div>

      <div class="card" style="margin-bottom:20px;background:var(--brand-50);border:1px solid var(--brand-100);">
        <div class="card-body" style="font-size:13px;color:var(--text-secondary);">
          <strong>¿Cómo usar referencias?</strong> Al generar una nueva consulta, selecciona las referencias activas
          para que la IA las considere como contexto adicional. Útil para incluir listas de empresas, reportes
          sectoriales, bases de datos públicas o documentos de estrategia.
        </div>
      </div>

      <div id="refs-list-wrap">
        <div class="page-loading"><div class="loader loader-dark loader-lg"></div></div>
      </div>
    </div>`;

  globalThis.openRefModal = () => openNewRefModal();
  await loadRefs();
}

async function loadRefs() {
  const wrap = document.getElementById('refs-list-wrap');
  try {
    const data = await api.get('/api/references');
    const refs = data.references || [];

    if (refs.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding:60px 20px;">
          <div class="empty-state-icon">📎</div>
          <h3>Sin referencias</h3>
          <p>Agrega URLs de documentos públicos, bases de datos o páginas de contexto para enriquecer tus análisis.</p>
          <button class="btn btn-primary" onclick="openRefModal()">+ Agregar referencia</button>
        </div>`;
      return;
    }

    wrap.innerHTML = `
      <div style="display:grid;gap:12px;">
        ${refs.map(r => `
          <div class="card">
            <div class="card-body" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
              <div style="flex:1;">
                <p style="font-weight:700;font-size:14px;">${r.title}</p>
                ${r.url ? `<a href="${r.url}" target="_blank" rel="noopener" style="font-size:12px;color:var(--brand-600);word-break:break-all;">${r.url}</a>` : ''}
                ${r.extracted_text ? `<p style="font-size:12px;color:var(--text-muted);margin-top:4px;white-space:pre-wrap;">${r.extracted_text.slice(0,200)}${r.extracted_text.length > 200 ? '…' : ''}</p>` : ''}
                <p style="font-size:11px;color:var(--text-muted);margin-top:6px;">${fmtDate(r.created_at)} · ${r.content_type || 'url'}</p>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;">
                <button class="btn btn-ghost btn-sm" onclick="editRef(${r.id},'${escJs(r.title)}','${escJs(r.url||'')}','${escJs(r.extracted_text||'')}')">Editar</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--accent-rose);" onclick="deleteRef(${r.id})">✕</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;

    globalThis.deleteRef = async (id) => {
      if (!await confirmDialog('¿Eliminar esta referencia?')) return;
      try { await api.delete(`/api/references/${id}`); showToast('Referencia eliminada', 'success'); await loadRefs(); }
      catch (err) { showToast(err.message, 'error'); }
    };

    globalThis.editRef = (id, title, url, text) => openEditRefModal(id, title, url, text);

  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function openNewRefModal() {
  openModal({
    title: 'Agregar referencia',
    body: refForm(),
    confirmText: 'Guardar',
    onConfirm: async () => {
      const title = document.getElementById('ref-title').value.trim();
      const url   = document.getElementById('ref-url').value.trim();
      const text  = document.getElementById('ref-text').value.trim();
      if (!title) { showToast('El título es requerido', 'error'); return; }
      try {
        await api.post('/api/references', { title, url, extracted_text: text, content_type: url ? 'url' : 'text' });
        showToast('Referencia agregada', 'success');
        await loadRefs();
      } catch (err) { showToast(err.message, 'error'); }
    },
  });
}

function openEditRefModal(id, title, url, text) {
  openModal({
    title: 'Editar referencia',
    body: refForm(title, url, text),
    confirmText: 'Guardar',
    onConfirm: async () => {
      const t = document.getElementById('ref-title').value.trim();
      const u = document.getElementById('ref-url').value.trim();
      const x = document.getElementById('ref-text').value.trim();
      if (!t) { showToast('El título es requerido', 'error'); return; }
      try {
        await api.put(`/api/references/${id}`, { title: t, url: u, extracted_text: x });
        showToast('Referencia actualizada', 'success');
        await loadRefs();
      } catch (err) { showToast(err.message, 'error'); }
    },
  });
}

function refForm(title = '', url = '', text = '') {
  return `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label class="form-label">Título *</label>
        <input id="ref-title" class="form-input" value="${escAttr(title)}" placeholder="Ej: Base 1000 empresas Supersociedades 2024" />
      </div>
      <div class="form-group">
        <label class="form-label">URL <span style="font-weight:400;color:var(--text-muted);">(opcional)</span></label>
        <input id="ref-url" class="form-input" value="${escAttr(url)}" placeholder="https://..." />
        <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Pega la URL del documento o recurso público</p>
      </div>
      <div class="form-group">
        <label class="form-label">Texto extraído <span style="font-weight:400;color:var(--text-muted);">(opcional)</span></label>
        <textarea id="ref-text" class="form-input" rows="4" placeholder="Pega aquí el contenido relevante del documento...">${escAttr(text)}</textarea>
        <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Si pegas texto, la IA lo usará directamente como contexto adicional</p>
      </div>
    </div>`;
}

function escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function escJs(s)   { return (s || '').replace(/'/g, "\\'").replace(/\n/g, ' '); }
