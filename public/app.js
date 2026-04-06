let currentChart = null;
let appConfig = { hasServerKey: false, defaultModel: 'Gemini 3.1 Flash Lite' };

const state = {
  report: null,
  manufacturers: []
};

function $(id) {
  return document.getElementById(id);
}

// ─── Utilidades Generales ──────────────────────────────────────────────────
function switchTab(tab) {
  const isAnalysis = tab === 'analysis';
  $('tab-analysis').classList.toggle('hidden', !isAnalysis);
  $('tab-catalog').classList.toggle('hidden', isAnalysis);
  $('tabAnalysis').classList.toggle('active', isAnalysis);
  $('tabCatalog').classList.toggle('active', !isAnalysis);
  if (!isAnalysis) renderCatalogEditor();
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toastNotification');
  document.getElementById('toastMessage').textContent = message;
  if (!toast) return;

  document.getElementById('toastIcon').textContent = type === 'error' ? '❌' : (type === 'success' ? '✅' : 'ℹ️');

  // Reset classes
  toast.className = "fixed bottom-5 right-5 px-6 py-4 rounded-lg shadow-2xl transform transition-all duration-300 z-50 flex items-center gap-3 no-print";

  if (type === 'error') toast.classList.add('bg-red-600', 'text-white');
  else if (type === 'success') toast.classList.add('bg-green-600', 'text-white');
  else toast.classList.add('bg-slate-800', 'text-white');

  toast.classList.remove('translate-y-32', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-32', 'opacity-0');
  }, 4000);
}

function toggleAccordion(contentId, arrowId) {
  const content = document.getElementById(contentId);
  const arrow = document.getElementById(arrowId);
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    arrow.style.transform = 'rotate(180deg)';
  } else {
    content.classList.add('hidden');
    arrow.style.transform = 'rotate(0deg)';
  }
}

// ─── Inicialización y Carga de Catálogo ────────────────────────────────────
async function init() {
  await Promise.all([loadConfig(), loadCatalogFromAPI()]);
  loadManufacturers();
  bindEvents();
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();
    $('statusText').textContent = appConfig.hasServerKey
      ? `Servidor listo. Modelo: ${appConfig.defaultModel}.`
      : 'No hay GEMINI_API_KEY en servidor. Usa el campo superior.';
  } catch (_e) {
    $('statusText').textContent = 'Error leyendo la configuración del servidor.';
  }
}

async function loadCatalogFromAPI() {
  try {
    const res = await fetch('/api/catalog');
    const data = await res.json();
    state.manufacturers = data.manufacturers || [];
  } catch (_e) {
    state.manufacturers = [];
  }
}

function loadManufacturers() {
  const select = $('manufacturerSelect');
  select.innerHTML = state.manufacturers
    .map((m, i) => `<option value="${m.name}" ${i === 0 ? 'selected' : ''}>${m.name}</option>`)
    .join('');
  updateSolutions();
}

function updateSolutions() {
  const manufacturer = getSelectedManufacturer();
  const solutionSelect = $('solutionSelect');
  const solutions = manufacturer?.solutions || [];
  solutionSelect.innerHTML = solutions
    .map((s, i) => `<option value="${s.name}" ${i === 0 ? 'selected' : ''}>${s.name}</option>`)
    .join('');
}

function getSelectedManufacturer() {
  const name = $('manufacturerSelect').value;
  return state.manufacturers.find((m) => m.name === name);
}

function bindEvents() {
  $('manufacturerSelect').addEventListener('change', updateSolutions);
  $('companyInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleGenerate();
  });
}

function showLoading(isLoading) {
  const btn = $('generateBtn');
  const loadUI = $('loadingOverlay');
  const currentStatus = $('statusText');
  const reportContainer = $('reportContainer');

  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    loadUI.classList.remove('hidden');
    loadUI.classList.add('flex');
    reportContainer.classList.add('hidden');
    currentStatus.textContent = 'Analizando...';
  } else {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
    loadUI.classList.add('hidden');
    loadUI.classList.remove('flex');
  }
}

// ─── Generación de Análisis ─────────────────────────────────────────────────
async function handleGenerate() {
  const companyName = $('companyInput').value.trim();
  const manufacturer = $('manufacturerSelect').value;
  const solution = $('solutionSelect').value;
  const country = $('countryInput').value.trim();
  const notes = $('notesInput').value.trim();
  const apiKey = $('apiKeyInput').value.trim();

  if (!companyName) {
    showToast('Debes indicar la empresa objetivo.', 'error');
    $('companyInput').focus();
    return;
  }

  if (!appConfig.hasServerKey && !apiKey) {
    showToast('Pega una API key de Gemini en la esquina superior derecha.', 'error');
    return;
  }

  showLoading(true);

  try {
    const response = await fetch('/api/generate-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, manufacturer, solution, country, notes, apiKey })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Fallo en IA');

    state.report = data;
    renderReport(data);
    showToast('Análisis generado exitosamente', 'success');
  } catch (error) {
    showToast(error.message || 'Error inesperado generando perfil', 'error');
  } finally {
    showLoading(false);
  }
}

function renderReport(data) {
  $('reportContainer').classList.remove('hidden');
  $('statusText').textContent = 'Análisis completado';

  // Headers
  $('displaySolutionIntro').textContent = `${data.fabricante} - ${data.solucion}`;
  $('displayCompanyNameIntro').textContent = data.empresa;

  // 1. Visión Ejecutiva
  $('outEmpresa').textContent = data.empresa || '-';
  $('outSector').textContent = data.perfilamiento?.sector || '-';
  $('outRol').textContent = data.perfilamiento?.rol || '-';
  $('outCore').textContent = data.perfilamiento?.core || '-';
  $('outImpacto').textContent = data.resumenEjecutivo || '-';

  // 2. Propuesta / Pitch
  $('outFabricante').textContent = data.fabricante || '-';
  $('outPitchValor').textContent = data.pitch?.valor || '-';
  renderSimpleList('outArquitecturaList', data.arquitecturaSugerida, '<li class="text-sm text-slate-700 flex items-center gap-2"><div class="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>{TEXT}</li>');

  // 3. Riesgos
  $('outRiesgoResidual').textContent = data.riesgos?.impacto || '-';
  $('outActivosCriticos').innerHTML = (data.perfilamiento?.activosCriticos || []).map(a =>
    `<span class="bg-white border border-slate-200 shadow-sm px-3 py-1 text-xs text-slate-700 rounded-full">${a}</span>`
  ).join('');
  renderChart(data.riesgos?.tiposDatos || []);

  // 4. Preguntas
  $('outRompehielo').textContent = data.contextoEstrategico?.rompehielo || data.pitch?.apertura || '-';
  renderSimpleList('outPreguntasList', data.preguntasDescubrimiento, '<li class="flex items-start gap-2 text-sm text-slate-700"><span class="text-blue-500 font-bold">»</span><span>{TEXT}</span></li>');

  // 5. Normativo
  const normasList = $('normasList');
  normasList.innerHTML = (data.normativo || []).map(n => `
        <li class="bg-slate-50 border border-slate-200 p-4 rounded-md">
            <h5 class="font-bold text-slate-800 text-sm mb-1">${n.norma || '-'}</h5>
            <p class="text-sm text-slate-600">${n.descripcion || '-'}</p>
        </li>
    `).join('');

  // 6. Casos Uso
  const casosCont = $('casosContainer');
  casosCont.innerHTML = (data.casosDeUso || []).map((c, idx) => `
        <div class="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <button onclick="toggleAccordion('cu-cont-${idx}', 'cu-arr-${idx}')" class="w-full text-left px-5 py-4 bg-slate-50 hover:bg-slate-100 flex justify-between items-center transition-colors">
                <span class="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span class="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">${idx + 1}</span>
                    ${c.titulo}
                </span>
                <span id="cu-arr-${idx}" class="text-slate-400 transition-transform">▼</span>
            </button>
            <div id="cu-cont-${idx}" class="p-5 border-t border-slate-200 hidden space-y-3 bg-white">
                <div><span class="text-xs font-bold text-slate-400 uppercase">Dolor Operativo:</span><p class="text-sm text-slate-700 mt-1">${c.dolor}</p></div>
                <div><span class="text-xs font-bold text-slate-400 uppercase">Propuesta ${data.fabricante}:</span><p class="text-sm text-slate-700 mt-1">${c.solucion}</p></div>
                <div class="bg-blue-50 p-3 rounded text-sm text-blue-800 border border-blue-100"><span class="font-bold">Resultado:</span> ${c.resultado}</div>
            </div>
        </div>
    `).join('');

  // 7. Objeciones
  const objCont = $('objecionesContainer');
  objCont.innerHTML = (data.objeciones || []).map((o, idx) => `
        <div class="bg-white rounded-lg border border-indigo-100 p-4 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <p class="font-bold text-indigo-900 text-sm flex items-start gap-2">
                <span class="text-indigo-400">❓</span> ${o.objecion}
            </p>
            <p class="text-sm text-slate-700 mt-2 pl-6 border-t border-indigo-50 pt-2 border-dashed">
                <span class="font-bold text-green-600">💡 Respuesta:</span> ${o.respuesta}
            </p>
        </div>
    `).join('');

  // 8. Resumen C-Level
  $('outResumenTitulo').textContent = data.herramientas?.resumenCISO?.titulo || 'Resumen Ejecutivo';
  renderSimpleList('outResumenList', data.herramientas?.resumenCISO?.vinetas, '<li class="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-100"><span class="text-green-500">✔</span><span class="text-sm text-slate-700">{TEXT}</span></li>');

  // 9. Email
  $('outEmailAsunto').textContent = data.herramientas?.email?.asunto || '-';
  $('outEmailCuerpo').textContent = data.herramientas?.email?.cuerpo || '-';

  // 10. OSINT
  $('outOsintTitular').textContent = data.herramientas?.osint?.titularNoticia || data.riesgos?.riesgoPrincipal || '-';

  // Mapeo dinamico de URL en UI si existe
  const osintUrl = data.herramientas?.osint?.urlNoticia;
  const urlEl = $('outOsintUrl');
  if (osintUrl) {
    urlEl.textContent = "Ver Fuente / Referencia Mapeada";
    urlEl.href = osintUrl;
    urlEl.classList.remove('hidden');
  } else {
    urlEl.classList.add('hidden');
  }

  $('outOsintPitch').textContent = data.herramientas?.osint?.pitchUrgencia || '-';
  renderSimpleList('outCompetenciasList', data.competencias, '<li class="text-sm text-slate-700 flex items-center gap-2 w-full"><div class="w-1 h-1 bg-slate-400 rounded-full"></div>{TEXT}</li>');

  // 11. Antes / Despues
  renderSimpleList('antesList', data.impactoAntesDespues?.antes, '<li class="flex items-start gap-2 text-sm text-slate-700"><span class="text-red-500 mt-0.5">⊗</span> <span>{TEXT}</span></li>');
  renderSimpleList('despuesList', data.impactoAntesDespues?.despues, '<li class="flex items-start gap-2 text-sm text-slate-200"><span class="text-blue-400 mt-0.5">✓</span> <span>{TEXT}</span></li>');

  window.scrollTo({ top: $('reportContainer').offsetTop - 20, behavior: 'smooth' });
}

function renderSimpleList(elementId, items = [], template = '<li>{TEXT}</li>') {
  const el = $(elementId);
  el.innerHTML = (items || []).map(item => template.replace('{TEXT}', item)).join('');
}

function renderChart(dataObj) {
  const ctx = $('dataRiskChart').getContext('2d');
  if (currentChart) currentChart.destroy();

  currentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dataObj.map((d) => d.label),
      datasets: [{
        data: dataObj.map((d) => d.value),
        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#64748b'],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: function (context) { return ' ' + context.label + ': ' + context.raw + '%'; } } }
      },
      cutout: '65%'
    }
  });
}

function exportToPDF() {
  showToast('Generando reporte PDF, espera un momento...', 'info');
  const element = document.getElementById('reportContainer');
  const empresaNombre = document.getElementById('outEmpresa').textContent || 'Empresa';

  // Ocultar el botón de exportar del DOM temporalmente
  const btn = document.getElementById('downloadPdfBtn');
  if(btn) btn.style.display = 'none';

  const opt = {
    margin:       [10, 10, 15, 10], // top, left, bottom, right
    filename:     `Gamma_Strategy_${empresaNombre.replace(/\s+/g, '_')}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 1200 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['css', 'legacy'], avoid: ['section', '.bg-white'] }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    if(btn) btn.style.display = 'flex';
    showToast('PDF descargado exitosamente', 'success');
  }).catch(err => {
    showToast('Error al generar PDF', 'error');
    console.error(err);
  });
}

function loadDemo() {
  $('companyInput').value = "Banco Industrial Test";
  showToast("Mock Data Loaded, use 'Generar' si quieres consultar la IA", "info");

  const mockData = {
    "empresa": "Banco Industrial Test",
    "fabricante": getSelectedManufacturer()?.name || "Palo Alto Networks",
    "solucion": $('solutionSelect').value || "Prisma SD-WAN",
    "resumenEjecutivo": "Transformación de infraestructura perimetral hacia redes escalables con enfoque Zero Trust.",
    "perfilamiento": {
      "sector": "Sector Financiero y Banca",
      "geografia": "Latinoamérica Central",
      "core": "Intermediación financiera, banca digital y corporativa.",
      "rol": "CIO / CTO de Infraestructura IT",
      "activosCriticos": ["Portal Core Bancario", "Conexión de Sucursales", "Datos PCI"]
    },
    "riesgos": {
      "tiposDatos": [
        { "label": "Canal Digital", "value": 40 },
        { "label": "Conexión Sucursales", "value": 35 },
        { "label": "Datos PCI", "value": 25 }
      ],
      "riesgoPrincipal": "Indisponibilidad en la red transaccional por enlaces caídos.",
      "impacto": "Interrupción de transacciones, afectación en ATMs y multas por SLA nulos."
    },
    "contextoEstrategico": {
      "impacto": "La gestión individual de routers MPLS es insostenible.",
      "rompehielo": "¿Cómo están garantizando resiliencia 100% de la red de sucursales ante caídas de ISP?"
    },
    "pitch": {
      "apertura": "He visto la expansión en las nuevas agencias digitales.",
      "valor": "Con la solución de SD-WAN podemos reducir el OPEX de MPLS e inyectar seguridad ML en cada rama.",
      "cierre": "Evaluemos un piloto no invasivo de SD-WAN en 2 oficinas."
    },
    "casosDeUso": [
      {
        "titulo": "Reemplazo de MPLS Obsoleto",
        "dolor": "Contratos costosos de MPLS, dificultad de escalar.",
        "solucion": "Migrar a conexiones de banda ancha usando SD-WAN seguro.",
        "resultado": "Bajar OPEX un 40% mejorando latencias al Cloud Core."
      }
    ],
    "competencias": [
      "Capacidad de SD-WAN nativo basado en Machine Learning.",
      "Gestión desde Panorama unificada."
    ],
    "normativo": [
      { "norma": "Cumplimiento PCI-DSS", "descripcion": "Cifrado requerido en cualquier conexión externa que lleve transacciones." }
    ],
    "preguntasDescubrimiento": [
      "¿Cuáles son los cuellos de botella actuales hacia la nube pública?",
      "¿Manejan las políticas de VPN localmente o de manera centralizada?"
    ],
    "arquitecturaSugerida": [
      "Dispositivos SD-WAN tipo ION",
      "Orquestación en la nube",
      "Firewall de siguiente generación"
    ],
    "objeciones": [
      { "objecion": "Es muy caro migrar 100 sitios de golpe.", "respuesta": "Se plantea un modelo de convivencia y despliegue por grupos críticos primero." }
    ],
    "herramientas": {
      "email": {
        "asunto": "Optimización Segura de Red de Sucursales - Banca Test",
        "cuerpo": "Hola [Nombre],\n\nHe estado investigando la apertura de agencias de Banca Test y..."
      },
      "resumenCISO": {
        "titulo": "Modernización de Conectividad con Telemetría e IA",
        "vinetas": ["Reducción de caídas de ISP", "Ahorro sobre líneas dedicadas"]
      },
      "osint": {
        "titularNoticia": "Entidad bancaria detiene operaciones por 8h debido a falla de capa 2",
        "pitchUrgencia": "Buscamos evitar el escenario de desconexión mediante enlaces redundantes L7 automatizados."
      }
    },
    "impactoAntesDespues": {
      "antes": ["Costos MPLS altos", "Fallas por enlace único", "Actualización router a router manual"],
      "despues": ["Agilidad Cloud Opex", "Active-Active resiliencia", "Zero Touch Provisioning Cero Contacto"]
    }
  };

  state.report = mockData;
  renderReport(mockData);
}

init();
