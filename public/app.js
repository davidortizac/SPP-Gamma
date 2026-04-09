// ══════════════════════════════════════════════════════
//  app.js  ·  SPP-Gamma v1.1
// ══════════════════════════════════════════════════════
let currentChart = null;
let appConfig    = { hasServerKey: false, defaultModel: 'gemini-2.0-flash' };

// Selecciones multi-brand [{ manufacturer, solution }]
let activeSelections = [];

const state = { report: null, manufacturers: [] };

function $(id) { return document.getElementById(id); }

// ── Tab switching ────────────────────────────────────────────────────────
function switchTab(tab) {
  ['analysis','history','catalog'].forEach(t => {
    $(`tab-${t}`)?.classList.toggle('hidden', t !== tab);
    $(`tab${t.charAt(0).toUpperCase()+t.slice(1)}`)?.classList.toggle('active', t === tab);
  });
  if (tab === 'history')  loadHistory();
  if (tab === 'catalog')  renderCatalogEditor();
}

// ── Toast ────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = $('toastNotification');
  $('toastMessage').textContent = message;
  $('toastIcon').textContent = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  toast.style.background = type === 'error' ? '#9d0b22' : type === 'success' ? '#065f46' : '#1a1a1a';
  toast.classList.remove('translate-y-32','opacity-0');
  setTimeout(() => toast.classList.add('translate-y-32','opacity-0'), 4000);
}

// ── Accordion ────────────────────────────────────────────────────────────
function toggleAccordion(contentId, arrowId) {
  const content = $(contentId), arrow = $(arrowId);
  const hidden = content.classList.contains('hidden');
  content.classList.toggle('hidden', !hidden);
  if (arrow) arrow.style.transform = hidden ? 'rotate(180deg)' : 'rotate(0)';
}

// ── Init ─────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadConfig(), loadCatalogFromAPI(), loadUserInfo()]);
  loadManufacturers();
  bindEvents();
}

async function loadUserInfo() {
  try {
    const r = await fetch('/api/me');
    if (!r.ok) return;
    const u = await r.json();
    const avatarEl = $('userAvatar');
    const nameEl   = $('userName');
    if (u.picture) {
      avatarEl.innerHTML = `<img src="${u.picture}" class="w-full h-full object-cover">`;
    } else {
      avatarEl.textContent = (u.name || u.email || 'G')[0].toUpperCase();
    }
    if (nameEl) nameEl.textContent = u.name || u.email;
    // Token stats
    loadTokenStats();
  } catch {}
}

async function loadTokenStats() {
  try {
    const r = await fetch('/api/stats');
    if (!r.ok) return;
    const s = await r.json();
    const el = $('navTokenBadge');
    if (el && s.total_tokens > 0) {
      $('navTokenCount').textContent = `${s.total_tokens.toLocaleString()} tokens`;
      $('tokenSummary')?.classList.remove('hidden');
    }
  } catch {}
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();
    $('statusText').textContent = appConfig.hasServerKey
      ? `Listo · Modelo: ${appConfig.defaultModel}`
      : '⚠ Sin API Key en servidor.';
  } catch {
    $('statusText').textContent = 'Error leyendo configuración.';
  }
}

async function loadCatalogFromAPI() {
  try {
    const res = await fetch('/api/catalog');
    const data = await res.json();
    state.manufacturers = data.manufacturers || [];
  } catch { state.manufacturers = []; }
}

function loadManufacturers() {
  const sel = $('manufacturerSelect');
  sel.innerHTML = state.manufacturers
    .map((m,i) => `<option value="${m.name}" ${i===0?'selected':''}>${m.name}</option>`)
    .join('');
  updateSolutions();
}

function updateSolutions() {
  const mf = getSelectedManufacturer();
  $('solutionSelect').innerHTML = (mf?.solutions || [])
    .map((s,i) => `<option value="${s.name}" ${i===0?'selected':''}>${s.name}</option>`)
    .join('');
}

function getSelectedManufacturer() {
  return state.manufacturers.find(m => m.name === $('manufacturerSelect').value);
}

function bindEvents() {
  $('manufacturerSelect').addEventListener('change', updateSolutions);
  $('companyInput').addEventListener('keypress', e => { if (e.key === 'Enter') handleGenerate(false); });
}

// ── Multi-brand selection ─────────────────────────────────────────────────
function addSelection() {
  const mf  = $('manufacturerSelect').value;
  const sol = $('solutionSelect').value;
  if (!mf || !sol) return;
  const exists = activeSelections.some(s => s.manufacturer === mf && s.solution === sol);
  if (exists) { showToast('Esa combinación ya está agregada.', 'error'); return; }
  activeSelections.push({ manufacturer: mf, solution: sol });
  renderSelectionTags();
}

function removeSelection(idx) {
  activeSelections.splice(idx, 1);
  renderSelectionTags();
}

function renderSelectionTags() {
  const wrap = $('selectionTags');
  const hint = $('selectionHint');
  wrap.innerHTML = activeSelections.map((s, i) => `
    <span class="selection-tag">
      <span>${s.manufacturer} · ${s.solution}</span>
      <button onclick="removeSelection(${i})" title="Quitar">×</button>
    </span>
  `).join('');
  hint.textContent = activeSelections.length === 0
    ? 'Agrega al menos una marca para generar el análisis.'
    : `${activeSelections.length} selección(es) activa(s).`;
}

// ── Generate ──────────────────────────────────────────────────────────────
async function handleGenerate(forceNew = false) {
  const companyName = $('companyInput').value.trim();
  const country     = $('countryInput').value.trim();
  const notes       = $('notesInput').value.trim();

  if (!companyName) { showToast('Indica la empresa objetivo.', 'error'); $('companyInput').focus(); return; }
  if (activeSelections.length === 0) { showToast('Agrega al menos una marca.', 'error'); return; }

  showLoading(true);
  try {
    const response = await fetch('/api/generate-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName,
        selections: activeSelections,
        country, notes,
        forceNew
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error en IA');
    state.report = data;
    renderReport(data);
    showToast('Análisis generado ✓', 'success');
    loadTokenStats();
  } catch (err) {
    showToast(err.message || 'Error inesperado', 'error');
  } finally {
    showLoading(false);
  }
}

function showLoading(isLoading) {
  const btn = $('generateBtn');
  const loadUI = $('loadingOverlay');
  const report = $('reportContainer');
  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('opacity-50','cursor-not-allowed');
    loadUI.classList.remove('hidden'); loadUI.classList.add('flex');
    report.classList.add('hidden');
  } else {
    btn.disabled = false;
    btn.classList.remove('opacity-50','cursor-not-allowed');
    loadUI.classList.add('hidden'); loadUI.classList.remove('flex');
  }
}

// ── Render Report ─────────────────────────────────────────────────────────
function renderReport(data) {
  $('reportContainer').classList.remove('hidden');

  // Token display
  const tok = data._tokens || {};
  const tokenEl = $('tokenDisplay');
  if (tok.total) {
    tokenEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 100-16 8 8 0 000 16zm1-8h3l-4 4.5V13H9l4-4.5V12z"/></svg> ${tok.total.toLocaleString()} tokens (↑${tok.input||0} / ↓${tok.output||0})`;
    tokenEl.className = 'token-badge';
  }
  const cacheEl = $('cacheDisplay');
  if (data._cached) cacheEl.classList.remove('hidden');
  else cacheEl.classList.add('hidden');

  $('displaySolutionIntro').textContent = data.fabricante ? `${data.fabricante} · ${data.solucion}` : '';
  $('displayCompanyNameIntro').textContent = data.empresa;

  $('outEmpresa').textContent    = data.empresa || '-';
  $('outSector').textContent     = data.perfilamiento?.sector || '-';
  $('outRol').textContent        = data.perfilamiento?.rol || '-';
  $('outCore').textContent       = data.perfilamiento?.core || '-';
  $('outImpacto').textContent    = data.resumenEjecutivo || '-';
  $('outFabricante').textContent = data.fabricante || '-';
  $('outPitchValor').textContent = data.pitch?.valor || '-';

  renderList('outArquitecturaList', data.arquitecturaSugerida,
    '<li class="text-sm text-gray-700 flex items-center gap-2"><span style="color:#c8102e;font-size:10px">▶</span>{TEXT}</li>');

  $('outRiesgoResidual').textContent = data.riesgos?.impacto || '-';
  $('outActivosCriticos').innerHTML = (data.perfilamiento?.activosCriticos||[])
    .map(a => `<span class="bg-white border border-gray-200 px-3 py-1 text-xs text-gray-700 rounded-sm shadow-sm">${a}</span>`)
    .join('');
  renderChart(data.riesgos?.tiposDatos || []);

  $('outRompehielo').textContent = data.contextoEstrategico?.rompehielo || data.pitch?.apertura || '-';
  renderList('outPreguntasList', data.preguntasDescubrimiento,
    '<li class="flex items-start gap-2 text-sm text-gray-700"><span style="color:#c8102e;font-weight:700">›</span><span>{TEXT}</span></li>');

  $('normasList').innerHTML = (data.normativo||[]).map(n => `
    <li class="bg-gray-50 border border-gray-100 p-3 rounded-sm">
      <h5 class="font-bold text-gray-800 text-sm mb-1">${n.norma||'-'}</h5>
      <p class="text-sm text-gray-600">${n.descripcion||'-'}</p>
    </li>`).join('');

  $('casosContainer').innerHTML = (data.casosDeUso||[]).map((c,idx) => `
    <div class="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
      <button onclick="toggleAccordion('cu-${idx}','cu-arr-${idx}')"
        class="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 flex justify-between items-center transition-colors">
        <span class="font-bold text-gray-800 text-sm flex items-center gap-2">
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style="background:#c8102e">${idx+1}</span>
          ${c.titulo}
        </span>
        <span id="cu-arr-${idx}" class="text-gray-400 transition-transform text-xs">▼</span>
      </button>
      <div id="cu-${idx}" class="p-4 border-t border-gray-100 hidden space-y-2">
        <div><span class="text-xs font-bold text-gray-400 uppercase">Dolor:</span><p class="text-sm text-gray-700 mt-0.5">${c.dolor}</p></div>
        <div><span class="text-xs font-bold text-gray-400 uppercase">Solución:</span><p class="text-sm text-gray-700 mt-0.5">${c.solucion}</p></div>
        <div class="bg-red-50 p-2 rounded-sm text-sm text-red-900 border border-red-100"><strong>Resultado:</strong> ${c.resultado}</div>
      </div>
    </div>`).join('');

  $('objecionesContainer').innerHTML = (data.objeciones||[]).map(o => `
    <div class="bg-white rounded-sm border border-indigo-100 p-4 shadow-sm relative overflow-hidden">
      <div class="absolute top-0 left-0 w-1 h-full" style="background:#c8102e"></div>
      <p class="font-bold text-indigo-900 text-sm flex items-start gap-2 pl-2">
        <span class="text-gray-400">❓</span>${o.objecion}
      </p>
      <p class="text-sm text-gray-700 mt-2 pl-2 border-t border-dashed border-indigo-50 pt-2">
        <span class="font-bold text-green-600">💡</span> ${o.respuesta}
      </p>
    </div>`).join('');

  $('outResumenTitulo').textContent = data.herramientas?.resumenCISO?.titulo || 'Resumen Ejecutivo';
  renderList('outResumenList', data.herramientas?.resumenCISO?.vinetas,
    '<li class="flex items-start gap-2 bg-gray-50 p-2 rounded-sm border border-gray-100"><span class="text-green-500">✔</span><span class="text-sm text-gray-700">{TEXT}</span></li>');

  $('outEmailAsunto').textContent = data.herramientas?.email?.asunto || '-';
  $('outEmailCuerpo').textContent = data.herramientas?.email?.cuerpo || '-';
  $('outOsintTitular').textContent = data.herramientas?.osint?.titularNoticia || data.riesgos?.riesgoPrincipal || '-';

  const urlEl = $('outOsintUrl');
  const osintUrl = data.herramientas?.osint?.urlNoticia;
  if (osintUrl) { urlEl.href = osintUrl; urlEl.classList.remove('hidden'); }
  else urlEl.classList.add('hidden');

  $('outOsintPitch').textContent = data.herramientas?.osint?.pitchUrgencia || '-';
  renderList('outCompetenciasList', data.competencias,
    '<li class="text-sm text-gray-700 flex items-center gap-2"><span style="color:#c8102e;font-size:10px">▶</span>{TEXT}</li>');

  renderList('antesList', data.impactoAntesDespues?.antes,
    '<li class="flex items-start gap-2 text-sm text-gray-700"><span class="text-red-500 mt-0.5">⊗</span><span>{TEXT}</span></li>');
  renderList('despuesList', data.impactoAntesDespues?.despues,
    '<li class="flex items-start gap-2 text-sm text-gray-200"><span class="text-green-400 mt-0.5">✓</span><span>{TEXT}</span></li>');

  window.scrollTo({ top: $('reportContainer').offsetTop - 20, behavior: 'smooth' });
}

function renderList(id, items=[], tpl='<li>{TEXT}</li>') {
  $(id).innerHTML = (items||[]).map(t => tpl.replace('{TEXT}', t)).join('');
}

function renderChart(dataObj) {
  const ctx = $('dataRiskChart').getContext('2d');
  if (currentChart) currentChart.destroy();
  currentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dataObj.map(d => d.label),
      datasets: [{
        data: dataObj.map(d => d.value),
        backgroundColor: ['#c8102e','#1a1a1a','#6b7280','#e5e7eb'],
        borderWidth: 2, borderColor: '#fff', hoverOffset: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}%` } }
      },
      cutout: '65%'
    }
  });
}

function exportToPDF() {
  showToast('Generando PDF...', 'info');
  const btn = $('downloadPdfBtn');
  if (btn) btn.style.display = 'none';
  window.scrollTo(0,0);
  const empresaNombre = $('outEmpresa').textContent || 'Empresa';
  html2pdf().set({
    margin: [10,10,15,10],
    filename: `Gamma_Strategy_${empresaNombre.replace(/\s+/g,'_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 1200, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css','legacy'], avoid: ['section','.gamma-card'] }
  }).from($('reportContainer')).save().then(() => {
    if (btn) btn.style.display = 'flex';
    showToast('PDF descargado ✓', 'success');
  }).catch(() => showToast('Error al generar PDF', 'error'));
}

// ── Demo ──────────────────────────────────────────────────────────────────
function loadDemo() {
  $('companyInput').value = 'Banco Industrial Test';
  if (activeSelections.length === 0 && state.manufacturers.length) {
    const mf = state.manufacturers[0];
    activeSelections.push({ manufacturer: mf.name, solution: mf.solutions[0]?.name || 'Demo' });
    renderSelectionTags();
  }
  const mockData = {
    empresa:'Banco Industrial Test', fabricante:'Palo Alto Networks', solucion:'Prisma SD-WAN',
    resumenEjecutivo:'Transformación perimetral hacia redes escalables con Zero Trust.',
    perfilamiento:{ sector:'Banca', geografia:'Latinoamérica', core:'Intermediación financiera y banca digital', rol:'CIO/CTO de Infraestructura', activosCriticos:['Core Bancario','Sucursales','Datos PCI'] },
    riesgos:{ tiposDatos:[{label:'Canal Digital',value:40},{label:'Sucursales',value:35},{label:'PCI',value:25}],
      riesgoPrincipal:'Indisponibilidad de red transaccional.', impacto:'Interrupción de transacciones y multas SLA.' },
    contextoEstrategico:{ impacto:'Gestión de routers MPLS insostenible.', rompehielo:'¿Cómo garantizan 100% de resiliencia en sucursales ante caídas de ISP?' },
    pitch:{ apertura:'Vi su expansión en agencias digitales.', valor:'SD-WAN reduce OPEX de MPLS e inyecta seguridad ML en cada rama.', cierre:'Propongo un piloto no invasivo en 2 oficinas.' },
    casosDeUso:[{ titulo:'Reemplazo de MPLS Obsoleto', dolor:'Contratos MPLS costosos y difíciles de escalar.', solucion:'Migrar a banda ancha con SD-WAN seguro.', resultado:'Reducción OPEX 40% y mejora de latencias al cloud.' }],
    competencias:['SD-WAN nativo basado en ML.','Gestión unificada desde Panorama.'],
    normativo:[{ norma:'PCI-DSS', descripcion:'Cifrado obligatorio en conexiones con transacciones.' }],
    preguntasDescubrimiento:['¿Cuáles son los cuellos de botella hacia la nube?','¿Políticas de VPN centralizadas o locales?'],
    arquitecturaSugerida:['Dispositivos SD-WAN tipo ION','Orquestación en nube','NGFW siguiente generación'],
    objeciones:[{ objecion:'Es caro migrar 100 sitios.', respuesta:'Modelo de convivencia y despliegue por grupos críticos.' }],
    herramientas:{
      email:{ asunto:'Optimización Segura de Red de Sucursales', cuerpo:'Hola [Nombre],\n\nHe visto la apertura de nuevas agencias digitales...' },
      resumenCISO:{ titulo:'Modernización de Conectividad con IA', vinetas:['Reducción de caídas de ISP','Ahorro sobre líneas dedicadas'] },
      osint:{ titularNoticia:'Entidad bancaria fuera de servicio 8h por falla de capa 2', pitchUrgencia:'Evitar desconexión con enlaces L7 redundantes.' }
    },
    impactoAntesDespues:{
      antes:['Costos MPLS elevados','Fallas por enlace único','Actualización router a router manual'],
      despues:['Agilidad cloud-first','Active-Active resiliencia','Zero Touch Provisioning']
    },
    _tokens:{ input:1200, output:850, total:2050 }, _cached:false
  };
  state.report = mockData;
  renderReport(mockData);
}

init();
