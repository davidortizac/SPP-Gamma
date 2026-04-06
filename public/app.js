let currentChart = null;
let appConfig = { hasServerKey: false, defaultModel: 'gemini-2.5-flash' };

const state = {
  report: null,
  manufacturers: []
};

function $(id) {
  return document.getElementById(id);
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  const isAnalysis = tab === 'analysis';
  $('tab-analysis').classList.toggle('hidden', !isAnalysis);
  $('tab-catalog').classList.toggle('hidden', isAnalysis);
  $('tabAnalysis').classList.toggle('active', isAnalysis);
  $('tabCatalog').classList.toggle('active', !isAnalysis);
  if (!isAnalysis) renderCatalogEditor();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
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
      ? `Servidor listo. Modelo por defecto: ${appConfig.defaultModel}.`
      : 'No hay GEMINI_API_KEY en el servidor. Debes pegar una API key en la interfaz.';
  } catch (_e) {
    $('statusText').textContent = 'No fue posible leer la configuración del servidor.';
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
  renderPortfolioInfo();
}

function bindEvents() {
  $('manufacturerSelect').addEventListener('change', () => {
    updateSolutions();
    renderPortfolioInfo();
  });
  $('solutionSelect').addEventListener('change', renderPortfolioInfo);
  $('generateBtn').addEventListener('click', handleGenerate);
  $('demoBtn').addEventListener('click', loadDemo);
  $('companyInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleGenerate();
  });
}

function getSelectedManufacturer() {
  const name = $('manufacturerSelect').value;
  return state.manufacturers.find((m) => m.name === name);
}

function updateSolutions() {
  const manufacturer = getSelectedManufacturer();
  const solutionSelect = $('solutionSelect');
  const solutions = manufacturer?.solutions || [];
  solutionSelect.innerHTML = solutions
    .map((s, i) => `<option value="${s.name}" ${i === 0 ? 'selected' : ''}>${s.name}</option>`)
    .join('');
}

function getSelectedSolution() {
  const manufacturer = getSelectedManufacturer();
  const solutionName = $('solutionSelect').value;
  return manufacturer?.solutions.find((s) => s.name === solutionName);
}

function renderPortfolioInfo() {
  const manufacturer = getSelectedManufacturer();
  const solution = getSelectedSolution();

  $('portfolioInfo').innerHTML = `
    <div>
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Fabricante</p>
      <p class="text-lg font-black text-slate-900">${manufacturer?.name || '-'}</p>
      <p class="text-sm text-slate-600 mt-1">${manufacturer?.description || ''}</p>
    </div>
    <div>
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Solución</p>
      <p class="text-base font-bold text-blue-700">${solution?.name || '-'}</p>
    </div>
    <div>
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Productos sugeridos</p>
      <div class="flex flex-wrap gap-2">
        ${(solution?.products || []).map((p) => `<span class="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-medium">${p}</span>`).join('')}
      </div>
    </div>
    <div>
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Valor esperado</p>
      <div class="flex flex-wrap gap-2">
        ${(solution?.value || []).map((v) => `<span class="rounded-full bg-blue-100 text-blue-900 px-3 py-1 text-xs font-medium">${v}</span>`).join('')}
      </div>
    </div>
  `;
}

function showLoading(isLoading) {
  $('loadingBox').classList.toggle('hidden', !isLoading);
  $('generateBtn').disabled = isLoading;
  $('demoBtn').disabled = isLoading;
}

function showError(message) {
  const el = $('errorText');
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = message;
  el.classList.remove('hidden');
}

async function handleGenerate() {
  showError('');

  const companyName = $('companyInput').value.trim();
  const manufacturer = $('manufacturerSelect').value;
  const solution = $('solutionSelect').value;
  const country = $('countryInput').value.trim();
  const notes = $('notesInput').value.trim();
  const apiKey = $('apiKeyInput').value.trim();

  if (!companyName) {
    showError('Debes indicar la empresa objetivo.');
    return;
  }

  if (!appConfig.hasServerKey && !apiKey) {
    showError('No existe API key en el servidor. Pega una API key de Gemini en el campo superior.');
    return;
  }

  showLoading(true);
  $('statusText').textContent = 'Generando análisis multimarca...';

  try {
    const response = await fetch('/api/generate-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, manufacturer, solution, country, notes, apiKey })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No fue posible generar el análisis.');

    state.report = data;
    renderReport(data);
    $('statusText').textContent = 'Análisis generado correctamente.';
  } catch (error) {
    showError(error.message || 'Error inesperado.');
    $('statusText').textContent = 'Falló la generación del análisis.';
  } finally {
    showLoading(false);
  }
}

function loadDemo() {
  const demo = {
    empresa: 'Bancolombia',
    fabricante: 'F5',
    solucion: 'WAAP',
    resumenEjecutivo: 'Bancolombia depende de canales digitales de alto tráfico y expuestos a fraude, automatización maliciosa y presión regulatoria. Una estrategia WAAP ayuda a proteger banca web, APIs y experiencia digital con controles más específicos para aplicaciones críticas.',
    perfilamiento: {
      sector: 'Servicios financieros',
      geografia: 'Colombia y operación regional',
      core: 'Servicios bancarios, canales transaccionales, pagos y productos financieros para personas y empresas.',
      rol: 'CISO / Director de Seguridad / Líder de Canales Digitales',
      activosCriticos: ['Portal transaccional', 'APIs de banca móvil', 'Identidad digital', 'Integraciones con terceros']
    },
    riesgos: {
      tiposDatos: [
        { label: 'Datos transaccionales', value: 35 },
        { label: 'Credenciales y sesiones', value: 25 },
        { label: 'Datos personales', value: 20 },
        { label: 'APIs y metadatos', value: 20 }
      ],
      riesgoPrincipal: 'Abuso de bots, explotación de APIs y ataques sobre aplicaciones expuestas.',
      impacto: 'Fraude, indisponibilidad, sanciones y deterioro de confianza del cliente.'
    },
    casosDeUso: [
      {
        titulo: 'Protección de portal transaccional',
        dolor: 'Aplicaciones críticas con exposición constante a intentos de explotación y automatización maliciosa.',
        solucion: 'WAAP de F5 permite combinar WAF, defensa de bots y protección de APIs con visibilidad centralizada.',
        resultado: 'Menor superficie de fraude y mejor continuidad del servicio.'
      },
      {
        titulo: 'Seguridad de APIs',
        dolor: 'Inventario parcial de APIs y dificultad para detectar comportamiento anómalo.',
        solucion: 'Descubrimiento y protección de APIs en canales móviles y ecosistemas de terceros.',
        resultado: 'Reducción del riesgo de abuso y mejor gobierno del ciclo de vida API.'
      }
    ],
    pitch: {
      apertura: 'Vemos una organización con una dependencia crítica de canales digitales y una superficie de exposición creciente en aplicaciones y APIs.',
      valor: 'F5 WAAP puede ayudarles a unificar protección web, defensa de bots y seguridad de APIs con foco en disponibilidad, visibilidad y reducción de fraude.',
      cierre: 'La siguiente conversación debería centrarse en priorizar aplicaciones y APIs de mayor criticidad para construir una ruta de protección por fases.'
    },
    competencias: ['Protección avanzada de aplicaciones', 'Mitigación de bots y abuso automatizado', 'Visibilidad y postura de APIs'],
    normativo: [
      { norma: 'Habeas Data', descripcion: 'Protección de datos personales y trazabilidad del tratamiento.' },
      { norma: 'Circulares de la SFC', descripcion: 'Controles de seguridad y continuidad en entidades vigiladas.' }
    ],
    preguntasDescubrimiento: [
      '¿Qué aplicaciones y APIs tienen hoy mayor impacto en ingreso o experiencia del cliente?',
      '¿Cómo están detectando abuso automatizado o fraude sobre canales digitales?',
      '¿Tienen visibilidad completa del inventario y exposición de APIs?'
    ],
    arquitecturaSugerida: ['F5 Distributed Cloud WAAP', 'Bot Defense', 'API Security', 'Integración con SIEM/SOC'],
    fuentes: ['bancolombia.com', 'superfinanciera.gov.co', 'f5.com']
  };

  $('companyInput').value = demo.empresa;
  $('countryInput').value = 'Colombia';
  $('manufacturerSelect').value = demo.fabricante;
  updateSolutions();
  $('solutionSelect').value = demo.solucion;
  renderPortfolioInfo();
  renderReport(demo);
  $('statusText').textContent = 'Demo cargada correctamente.';
  showError('');
}

function renderReport(data) {
  $('reportSection').classList.remove('hidden');
  $('rEmpresa').textContent = data.empresa || '-';
  $('rFabricante').textContent = data.fabricante || '-';
  $('rSolucion').textContent = data.solucion || '-';
  $('rSector').textContent = data.perfilamiento?.sector || '-';
  $('rGeografia').textContent = data.perfilamiento?.geografia || '-';
  $('rRol').textContent = data.perfilamiento?.rol || '-';
  $('rResumen').textContent = data.resumenEjecutivo || '-';
  $('rRiesgoPrincipal').textContent = data.riesgos?.riesgoPrincipal || '-';
  $('rImpacto').textContent = data.riesgos?.impacto || '-';
  $('pApertura').textContent = data.pitch?.apertura || '-';
  $('pValor').textContent = data.pitch?.valor || '-';
  $('pCierre').textContent = data.pitch?.cierre || '-';

  renderSimpleList('activosList', data.perfilamiento?.activosCriticos, 'bg-slate-50 border-slate-200');
  renderSimpleList('competenciasList', data.competencias, 'bg-blue-50 border-blue-100');
  renderSimpleList('arquitecturaList', data.arquitecturaSugerida, 'bg-emerald-50 border-emerald-100');
  renderSimpleList('preguntasList', data.preguntasDescubrimiento, 'bg-slate-50 border-slate-200');
  renderSimpleList('fuentesList', data.fuentes, 'bg-slate-50 border-slate-200');

  const normativoList = $('normativoList');
  normativoList.innerHTML = '';
  (data.normativo || []).forEach((item) => {
    normativoList.innerHTML += `
      <li class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p class="font-bold text-slate-900">${item.norma || '-'}</p>
        <p class="text-slate-600 mt-1">${item.descripcion || ''}</p>
      </li>
    `;
  });

  const casos = $('casosContainer');
  casos.innerHTML = '';
  (data.casosDeUso || []).forEach((item) => {
    casos.innerHTML += `
      <div class="rounded-xl border border-slate-200 p-4 bg-slate-50">
        <h4 class="font-black text-slate-900">${item.titulo || '-'}</h4>
        <p class="text-sm mt-2"><span class="font-bold">Dolor:</span> ${item.dolor || ''}</p>
        <p class="text-sm mt-2"><span class="font-bold">Solución:</span> ${item.solucion || ''}</p>
        <p class="text-sm mt-2"><span class="font-bold">Resultado:</span> ${item.resultado || ''}</p>
      </div>
    `;
  });

  renderChart(data.riesgos?.tiposDatos || []);
  window.scrollTo({ top: document.body.scrollHeight * 0.15, behavior: 'smooth' });
}

function renderSimpleList(elementId, items = [], classes = '') {
  const el = $(elementId);
  el.innerHTML = '';
  (items || []).forEach((item) => {
    el.innerHTML += `<li class="rounded-xl border p-3 ${classes}">${item}</li>`;
  });
}

function renderChart(dataObj) {
  const ctx = $('riskChart').getContext('2d');
  if (currentChart) currentChart.destroy();

  currentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dataObj.map((d) => d.label),
      datasets: [{
        data: dataObj.map((d) => d.value),
        backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#64748b'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      cutout: '62%'
    }
  });
}

// ─── PDF Download ─────────────────────────────────────────────────────────────
async function downloadPDF() {
  const btn = $('downloadPdfBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Generando…`;

  try {
    const element = $('reportSection');

    // Forzar que el gráfico se renderice antes de capturar
    if (currentChart) currentChart.update();

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#f8fafc',
      windowWidth: 1280
    });

    const { jsPDF } = globalThis.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const printW = pageW - margin * 2;
    const printH = (canvas.height * printW) / canvas.width;

    let posY = margin;
    let remaining = printH;
    let srcY = 0;

    // Portada: título y metadatos en primera página antes del contenido
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Gamma Portfolio Explorer', margin, posY);
    posY += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    const empresa = state.report?.empresa || '';
    const fabricante = state.report?.fabricante || '';
    const solucion = state.report?.solucion || '';
    pdf.text(`Empresa: ${empresa}   |   Fabricante: ${fabricante}   |   Solución: ${solucion}`, margin, posY);
    posY += 4;
    pdf.text(`Generado el ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, posY);
    posY += 6;

    // Línea divisora
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.4);
    pdf.line(margin, posY, pageW - margin, posY);
    posY += 4;

    // Primer fragmento de imagen en la página 1
    const firstSliceH = Math.min(remaining, pageH - posY - margin);
    const firstSliceCanvas = document.createElement('canvas');
    firstSliceCanvas.width = canvas.width;
    firstSliceCanvas.height = (firstSliceH * canvas.width) / printW;
    const firstCtx = firstSliceCanvas.getContext('2d');
    firstCtx.drawImage(canvas, 0, srcY, canvas.width, firstSliceCanvas.height, 0, 0, canvas.width, firstSliceCanvas.height);
    pdf.addImage(firstSliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, posY, printW, firstSliceH);
    srcY += firstSliceCanvas.height;
    remaining -= firstSliceH;

    // Páginas adicionales
    while (remaining > 1) {
      pdf.addPage();
      const sliceH = Math.min(remaining, pageH - margin * 2);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = (sliceH * canvas.width) / printW;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, printW, sliceH);
      srcY += sliceCanvas.height;
      remaining -= sliceH;
    }

    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = [empresa, fabricante, fecha].filter(Boolean).join('_').replaceAll(/\s+/g, '-');
    pdf.save(`${nombre}.pdf`);
  } catch (err) {
    console.error(err);
    showError('No fue posible generar el PDF. Intenta de nuevo.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

init();
