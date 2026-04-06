// ─── Catalog Editor ──────────────────────────────────────────────────────────
// Manages the "Gestión de portafolio" tab: full CRUD for manufacturers & solutions.

let catalogData = { manufacturers: [] };
let modalConfirmFn = null;

// ─── Status banner ────────────────────────────────────────────────────────────
function showCatalogStatus(msg, isError = false) {
  const el = document.getElementById('catalogStatusMsg');
  el.textContent = msg;
  el.className = isError
    ? 'text-sm font-medium px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200'
    : 'text-sm font-medium px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200';
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
function openModal(title, bodyHTML, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  modalConfirmFn = onConfirm;
  document.getElementById('modalOverlay').classList.remove('hidden');
  const firstInput = document.querySelector('#modalBody input, #modalBody textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  modalConfirmFn = null;
}

document.getElementById('modalConfirmBtn').addEventListener('click', () => {
  if (modalConfirmFn) modalConfirmFn();
});

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// ─── Render full catalog editor ───────────────────────────────────────────────
async function renderCatalogEditor() {
  const container = document.getElementById('catalogList');
  try {
    const res = await fetch('/api/catalog');
    catalogData = await res.json();
    // Sync with app.js state for the analysis tab selects
    state.manufacturers = catalogData.manufacturers || [];
    loadManufacturers();
  } catch {
    container.innerHTML = '<p class="text-red-500 text-sm">No se pudo cargar el catálogo.</p>';
    return;
  }
  paintCatalog();
}

function paintCatalog() {
  const container = document.getElementById('catalogList');

  if (!catalogData.manufacturers.length) {
    container.innerHTML = `
      <div class="text-center py-16 text-slate-400">
        <p class="text-5xl mb-4">📦</p>
        <p class="font-bold text-lg">Sin fabricantes registrados</p>
        <p class="text-sm mt-1">Usa el botón "Agregar fabricante" para comenzar.</p>
      </div>`;
    return;
  }

  container.innerHTML = catalogData.manufacturers.map((mf, mfIdx) => `
    <div class="bg-white rounded-2xl border border-slate-200 card overflow-hidden">

      <!-- Manufacturer header -->
      <div class="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
           onclick="toggleMf('mf-body-${mfIdx}', 'mf-arrow-${mfIdx}')">
        <div class="flex items-center gap-4">
          <span class="text-2xl">🏢</span>
          <div>
            <p class="font-black text-slate-900 text-lg leading-tight">${mf.name}</p>
            <p class="text-slate-500 text-sm mt-0.5">${mf.description || 'Sin descripción'}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded-full">
            ${mf.solutions.length} solución${mf.solutions.length !== 1 ? 'es' : ''}
          </span>
          <button onclick="event.stopPropagation(); openMfModal('${escAttr(mf.name)}', '${escAttr(mf.description || '')}')"
                  class="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Editar fabricante">✏️</button>
          <button onclick="event.stopPropagation(); deleteMf('${escAttr(mf.name)}')"
                  class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar fabricante">🗑️</button>
          <span id="mf-arrow-${mfIdx}" class="mf-arrow text-slate-400 ml-1 open">▲</span>
        </div>
      </div>

      <!-- Solutions body -->
      <div id="mf-body-${mfIdx}" class="border-t border-slate-100">
        <div class="px-6 py-4 space-y-3">
          ${mf.solutions.length === 0
            ? '<p class="text-slate-400 text-sm italic">Sin soluciones. Agrega la primera.</p>'
            : mf.solutions.map((sol) => `
              <div class="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 gap-4">
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-slate-800">${sol.name}</p>
                  <div class="mt-2 flex flex-wrap gap-1">
                    ${(sol.products || []).map(p => `<span class="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs">${p}</span>`).join('')}
                  </div>
                  <div class="mt-1.5 flex flex-wrap gap-1">
                    ${(sol.value || []).map(v => `<span class="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs">${v}</span>`).join('')}
                  </div>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button onclick="openSolutionModal('${escAttr(mf.name)}', '${escAttr(sol.name)}', '${escAttr((sol.products||[]).join('\n'))}', '${escAttr((sol.value||[]).join('\n'))}')"
                          class="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar solución">✏️</button>
                  <button onclick="deleteSolution('${escAttr(mf.name)}', '${escAttr(sol.name)}')"
                          class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar solución">🗑️</button>
                </div>
              </div>`).join('')}
          <button onclick="openSolutionModal('${escAttr(mf.name)}')"
                  class="w-full mt-2 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 font-bold py-2.5 text-sm transition-colors">
            + Agregar solución
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleMf(bodyId, arrowId) {
  const body = document.getElementById(bodyId);
  const arrow = document.getElementById(arrowId);
  if (!body) return;
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  arrow.textContent = hidden ? '▲' : '▼';
  arrow.classList.toggle('open', hidden);
}

// Escape attribute value (avoid breaking onclick strings)
function escAttr(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n');
}

// ─── Manufacturer CRUD ────────────────────────────────────────────────────────
function openMfModal(existingName = '', existingDesc = '') {
  const isEdit = Boolean(existingName);
  openModal(
    isEdit ? 'Editar fabricante' : 'Agregar fabricante',
    `<div class="space-y-4">
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Nombre del fabricante *</label>
        <input id="mfNameInput" value="${existingName}" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ej: Cisco, CrowdStrike, Kriptos" />
      </div>
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Descripción</label>
        <textarea id="mfDescInput" rows="3" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Breve descripción del fabricante y su especialidad">${existingDesc}</textarea>
      </div>
    </div>`,
    async () => {
      const name = document.getElementById('mfNameInput').value.trim();
      const description = document.getElementById('mfDescInput').value.trim();
      if (!name) { showCatalogStatus('El nombre es obligatorio.', true); return; }

      const url = isEdit
        ? `/api/catalog/manufacturers/${encodeURIComponent(existingName)}`
        : '/api/catalog/manufacturers';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });
      const data = await res.json();
      if (!res.ok) { showCatalogStatus(data.error || 'Error al guardar.', true); return; }

      catalogData = data;
      state.manufacturers = catalogData.manufacturers;
      loadManufacturers();
      closeModal();
      paintCatalog();
      showCatalogStatus(isEdit ? `"${name}" actualizado correctamente.` : `"${name}" agregado al portafolio.`);
    }
  );
}

function deleteMf(name) {
  openModal(
    'Eliminar fabricante',
    `<p class="text-slate-700">¿Eliminar <strong>${name}</strong> y todas sus soluciones? Esta acción no se puede deshacer.</p>`,
    async () => {
      const res = await fetch(`/api/catalog/manufacturers/${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { showCatalogStatus(data.error || 'Error al eliminar.', true); return; }
      catalogData = data;
      state.manufacturers = catalogData.manufacturers;
      loadManufacturers();
      closeModal();
      paintCatalog();
      showCatalogStatus(`"${name}" eliminado del portafolio.`);
    }
  );
}

// ─── Solution CRUD ────────────────────────────────────────────────────────────
function openSolutionModal(mfName, existingSolName = '', existingProducts = '', existingValue = '') {
  const isEdit = Boolean(existingSolName);
  openModal(
    isEdit ? `Editar solución — ${mfName}` : `Agregar solución — ${mfName}`,
    `<div class="space-y-4">
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Nombre de la solución *</label>
        <input id="solNameInput" value="${existingSolName}" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ej: NGFW, XDR, DLP, WAAP" />
      </div>
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Productos (uno por línea)</label>
        <textarea id="solProductsInput" rows="4" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="FortiGate&#10;FortiManager&#10;FortiAnalyzer">${existingProducts.replace(/\\n/g, '\n')}</textarea>
      </div>
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Propuestas de valor (una por línea)</label>
        <textarea id="solValueInput" rows="4" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Segmentación de red&#10;Inspección avanzada&#10;Visibilidad centralizada">${existingValue.replace(/\\n/g, '\n')}</textarea>
      </div>
    </div>`,
    async () => {
      const name = document.getElementById('solNameInput').value.trim();
      const products = document.getElementById('solProductsInput').value.split('\n').map(s => s.trim()).filter(Boolean);
      const value = document.getElementById('solValueInput').value.split('\n').map(s => s.trim()).filter(Boolean);

      if (!name) { showCatalogStatus('El nombre de la solución es obligatorio.', true); return; }

      const url = isEdit
        ? `/api/catalog/manufacturers/${encodeURIComponent(mfName)}/solutions/${encodeURIComponent(existingSolName)}`
        : `/api/catalog/manufacturers/${encodeURIComponent(mfName)}/solutions`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, products, value })
      });
      const data = await res.json();
      if (!res.ok) { showCatalogStatus(data.error || 'Error al guardar.', true); return; }

      catalogData = data;
      state.manufacturers = catalogData.manufacturers;
      loadManufacturers();
      closeModal();
      paintCatalog();
      showCatalogStatus(isEdit ? `Solución "${name}" actualizada.` : `Solución "${name}" agregada a ${mfName}.`);
    }
  );
}

function deleteSolution(mfName, solName) {
  openModal(
    'Eliminar solución',
    `<p class="text-slate-700">¿Eliminar la solución <strong>${solName}</strong> de <strong>${mfName}</strong>? Esta acción no se puede deshacer.</p>`,
    async () => {
      const res = await fetch(
        `/api/catalog/manufacturers/${encodeURIComponent(mfName)}/solutions/${encodeURIComponent(solName)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) { showCatalogStatus(data.error || 'Error al eliminar.', true); return; }
      catalogData = data;
      state.manufacturers = catalogData.manufacturers;
      loadManufacturers();
      closeModal();
      paintCatalog();
      showCatalogStatus(`Solución "${solName}" eliminada.`);
    }
  );
}
