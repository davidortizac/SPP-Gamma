// ══════════════════════════════════════════════════════
//  history.js  ·  SPP-Gamma v1.1
//  Historial de consultas + reutilización desde caché
// ══════════════════════════════════════════════════════

async function loadHistory() {
  const container = document.getElementById('historyContainer');
  container.innerHTML = '<div class="p-8 text-center text-gray-400">Cargando...</div>';

  try {
    const [histRes, statsRes] = await Promise.all([
      fetch('/api/history'),
      fetch('/api/stats')
    ]);
    const rows  = await histRes.json();
    const stats = await statsRes.json();

    // Stats bar
    renderStatsBar(stats);

    if (!rows.length) {
      container.innerHTML = `
        <div class="p-12 text-center text-gray-400">
          <p class="text-4xl mb-3">🔍</p>
          <p class="font-bold text-lg">Sin consultas registradas</p>
          <p class="text-sm mt-1">Las consultas que generes aparecerán aquí para reutilizarlas.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-900 text-white text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3 font-bold">Empresa</th>
              <th class="text-left px-4 py-3 font-bold hidden md:table-cell">Fabricante · Solución</th>
              <th class="text-left px-4 py-3 font-bold hidden lg:table-cell">País</th>
              <th class="text-center px-4 py-3 font-bold">Tokens</th>
              ${rows[0].user_email !== undefined ? '<th class="text-left px-4 py-3 font-bold hidden xl:table-cell">Usuario</th>' : ''}
              <th class="text-left px-4 py-3 font-bold hidden sm:table-cell">Fecha</th>
              <th class="text-center px-4 py-3 font-bold">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows.map(r => buildHistoryRow(r, rows[0].user_email !== undefined)).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="p-8 text-center text-red-500 text-sm">Error cargando historial: ${err.message}</div>`;
  }
}

function renderStatsBar(stats) {
  const bar = document.getElementById('statsBar');
  if (!bar) return;
  if (!stats || stats.total_queries === 0) return;
  bar.classList.remove('hidden');
  bar.innerHTML = `
    <div class="flex flex-wrap gap-3 text-xs">
      <div class="bg-white border border-gray-200 rounded-sm px-3 py-2 text-center shadow-sm">
        <p class="font-black text-gray-900 text-lg">${stats.total_queries}</p>
        <p class="text-gray-500 uppercase tracking-wider font-semibold">Consultas</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-sm px-3 py-2 text-center shadow-sm" style="border-left: 3px solid #c8102e;">
        <p class="font-black text-gray-900 text-lg">${(stats.total_tokens || 0).toLocaleString()}</p>
        <p class="text-gray-500 uppercase tracking-wider font-semibold">Tokens Total</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-sm px-3 py-2 text-center shadow-sm">
        <p class="font-black text-gray-900 text-lg">${(stats.total_input || 0).toLocaleString()}</p>
        <p class="text-gray-500 uppercase tracking-wider font-semibold">Entrada</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-sm px-3 py-2 text-center shadow-sm">
        <p class="font-black text-gray-900 text-lg">${(stats.total_output || 0).toLocaleString()}</p>
        <p class="text-gray-500 uppercase tracking-wider font-semibold">Salida</p>
      </div>
    </div>`;
}

function buildHistoryRow(r, isAdmin) {
  const date  = new Date(r.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  const tokens = r.tokens_total || 0;
  const adminCol = isAdmin
    ? `<td class="px-4 py-3 text-gray-500 hidden xl:table-cell text-xs">${r.user_name || r.user_email || '-'}</td>`
    : '';
  return `
    <tr class="history-row cursor-pointer hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 font-semibold text-gray-900">${escHtml(r.company_name)}</td>
      <td class="px-4 py-3 text-gray-600 hidden md:table-cell">
        <span class="inline-block bg-gray-100 text-gray-800 text-xs font-medium px-2 py-0.5 rounded-sm">${escHtml(r.manufacturer)}</span>
        <span class="text-gray-400 mx-1">·</span>
        <span class="text-xs text-gray-600">${escHtml(r.solution)}</span>
      </td>
      <td class="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">${escHtml(r.country || '—')}</td>
      <td class="px-4 py-3 text-center">
        ${tokens > 0
          ? `<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-sm" style="background:rgba(200,16,46,0.08);color:#c8102e;border:1px solid rgba(200,16,46,0.2)">⚡ ${tokens.toLocaleString()}</span>`
          : `<span class="text-gray-300 text-xs">—</span>`
        }
      </td>
      ${adminCol}
      <td class="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell whitespace-nowrap">${date}</td>
      <td class="px-4 py-3 text-center">
        <button onclick="reuseQuery(${r.id})"
          class="text-xs font-bold px-3 py-1.5 rounded-sm border transition-all"
          style="border-color:#c8102e; color:#c8102e;"
          onmouseover="this.style.background='#c8102e';this.style.color='white'"
          onmouseout="this.style.background='';this.style.color='#c8102e'">
          Reutilizar
        </button>
      </td>
    </tr>`;
}

async function reuseQuery(id) {
  try {
    const res = await fetch(`/api/history/${id}`);
    if (!res.ok) { showToast('No se pudo cargar la consulta.', 'error'); return; }
    const row = await res.json();

    if (!row.result) { showToast('Esta consulta no tiene resultado guardado.', 'error'); return; }

    // Switch to analysis tab and render
    switchTab('analysis');

    // Restore inputs
    if (document.getElementById('companyInput'))
      document.getElementById('companyInput').value = row.company_name || '';
    if (document.getElementById('countryInput'))
      document.getElementById('countryInput').value = row.country || '';

    // Restore selections
    activeSelections = row.manufacturer.split(' + ').map((m, i) => ({
      manufacturer: m.trim(),
      solution: (row.solution.split(' + ')[i] || '').trim()
    }));
    renderSelectionTags();

    // Render result with cached flag
    const data = {
      ...row.result,
      _cached:   true,
      _cachedAt: row.created_at,
      _queryId:  row.id,
      _tokens: {
        input:  row.tokens_input  || 0,
        output: row.tokens_output || 0,
        total:  row.tokens_total  || 0
      }
    };
    state.report = data;
    renderReport(data);
    showToast('Consulta cargada desde historial ⚡', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
