// public/pages/query-detail.js — Vista detalle + chat contextual + PDF

import { api }       from '../js/api.js';
import { showToast, confirmDialog } from '../js/components.js';

let chatHistory = [];

export async function renderQueryDetail(id) {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <button class="btn btn-ghost btn-sm" onclick="navigate('/queries')">← Volver</button>
          <h1 id="detail-title">Cargando análisis...</h1>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" onclick="exportPDF()" id="pdf-btn">📥 Descargar PDF</button>
        </div>
      </div>
      <div id="detail-body"><div class="page-loading" style="min-height:300px;"><div class="loader loader-dark loader-lg"></div></div></div>
    </div>`;

  let queryData;
  try {
    queryData = await api.get(`/api/queries/${id}`);
  } catch (err) {
    document.getElementById('detail-body').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    return;
  }

  document.getElementById('detail-title').textContent = `${queryData.company_name} · ${queryData.manufacturer}`;
  chatHistory = Array.isArray(queryData.chat_history) ? queryData.chat_history : [];

  const r = queryData.result_json || {};

  document.getElementById('detail-body').innerHTML = `
    <div id="report-content" style="display:grid;gap:24px;">

      <!-- Resumen ejecutivo -->
      <div class="card">
        <div class="card-header"><h3>Resumen ejecutivo</h3></div>
        <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">
          <div style="font-size:13px;display:flex;flex-direction:column;gap:8px;min-width:0;">
            ${field('Empresa', r.empresa)}
            ${field('Fabricante', r.fabricante)}
            ${field('Solución', r.solucion)}
            ${field('Sector', r.perfilamiento?.sector)}
            ${field('Geografía', r.perfilamiento?.geografia)}
            ${field('Rol objetivo', r.perfilamiento?.rol)}
          </div>
          <div style="background:var(--bg-surface-alt);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;min-width:0;overflow:hidden;">
            <p style="font-size:13px;line-height:1.8;color:var(--text-secondary);word-break:break-word;overflow-wrap:anywhere;">${parseMd(r.resumenEjecutivo)}</p>
          </div>
        </div>
      </div>

      <!-- Riesgos + Activos -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div class="card">
          <div class="card-header"><h3>Riesgos</h3></div>
          <div class="card-body" style="font-size:13px;">
            <p><strong>Riesgo principal:</strong> ${parseMd(r.riesgos?.riesgoPrincipal) || '-'}</p>
            <p style="margin-top:8px;"><strong>Impacto:</strong> ${parseMd(r.riesgos?.impacto) || '-'}</p>
            <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;">
              ${(r.riesgos?.tiposDatos || []).map(d => `<span class="badge badge-pending">${esc(d.label)} ${esc(String(d.value))}%</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Activos críticos</h3></div>
          <div class="card-body">
            ${tagBadges(r.perfilamiento?.activosCriticos)}
          </div>
        </div>
      </div>

      <!-- Pitch -->
      <div class="card">
        <div class="card-header"><h3>Pitch sugerido</h3></div>
        <div class="card-body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
          ${pitchCard('Apertura', r.pitch?.apertura, 'var(--bg-surface-alt)')}
          ${pitchCard('Valor', r.pitch?.valor, 'var(--brand-50)')}
          ${pitchCard('Cierre', r.pitch?.cierre, '#ecfdf5')}
        </div>
      </div>

      <!-- Casos de uso -->
      <div class="card">
        <div class="card-header"><h3>Casos de uso</h3></div>
        <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${(r.casosDeUso || []).map(c => `
            <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;font-size:13px;min-width:0;">
              <p style="font-weight:700;margin-bottom:8px;">${parseMd(c.titulo)}</p>
              <p><strong>Dolor:</strong> ${parseMd(c.dolor)}</p>
              <p style="margin-top:4px;"><strong>Solución:</strong> ${parseMd(c.solucion)}</p>
              <p style="margin-top:4px;color:var(--emerald-600);"><strong>Resultado:</strong> ${parseMd(c.resultado)}</p>
            </div>`).join('')}
        </div>
      </div>

      <!-- Arquitectura + Competencias -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div class="card">
          <div class="card-header"><h3>Arquitectura sugerida</h3></div>
          <div class="card-body">
            ${arquitecturaList(r.arquitecturaSugerida)}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Competencias del fabricante</h3></div>
          <div class="card-body">
            ${competenciasList(r.competencias)}
          </div>
        </div>
      </div>

      <!-- Normativo + Preguntas -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div class="card">
          <div class="card-header"><h3>Normativo aplicable</h3></div>
          <div class="card-body" style="font-size:13px;display:flex;flex-direction:column;gap:10px;">
            ${(r.normativo || []).map(n => `
              <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;min-width:0;">
                <p style="font-weight:700;">${esc(n.norma)}</p>
                <p style="color:var(--text-secondary);margin-top:4px;word-break:break-word;">${parseMd(n.descripcion)}</p>
              </div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Preguntas de descubrimiento</h3></div>
          <div class="card-body" style="font-size:13px;display:flex;flex-direction:column;gap:8px;">
            ${(r.preguntasDescubrimiento || []).map((p,i) => `
              <div style="display:flex;gap:8px;align-items:flex-start;min-width:0;">
                <span style="background:var(--brand-100);color:var(--brand-700);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i+1}</span>
                <p style="word-break:break-word;">${parseMd(p)}</p>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Objeciones -->
      ${(r.objeciones || []).length > 0 ? `
      <div class="card">
        <div class="card-header"><h3>Manejo de objeciones</h3></div>
        <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px;">
          ${(r.objeciones || []).map(o => `
            <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;min-width:0;">
              <p style="font-weight:700;color:var(--rose-600);">⚠ ${parseMd(o.objecion)}</p>
              <p style="margin-top:6px;color:var(--emerald-600);">✓ ${parseMd(o.respuesta)}</p>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Herramientas -->
      ${r.herramientas ? `
      <div class="card">
        <div class="card-header"><h3>Herramientas de venta</h3></div>
        <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px;">
          ${r.herramientas.email ? `
          <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;min-width:0;">
            <p style="font-weight:700;margin-bottom:6px;">📧 Email de prospección</p>
            <p><strong>Asunto:</strong> ${esc(r.herramientas.email.asunto)}</p>
            <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;color:var(--text-secondary);margin-top:8px;background:var(--bg-surface-alt);padding:10px;border-radius:var(--radius-sm);word-break:break-word;overflow-wrap:anywhere;">${esc(r.herramientas.email.cuerpo)}</pre>
          </div>` : ''}
          ${r.herramientas.resumenCISO ? `
          <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;min-width:0;">
            <p style="font-weight:700;margin-bottom:6px;">👔 Resumen C-Level</p>
            <p style="font-weight:600;">${esc(r.herramientas.resumenCISO.titulo)}</p>
            <ul style="padding-left:16px;margin-top:6px;color:var(--text-secondary);">
              ${(r.herramientas.resumenCISO.vinetas || []).map(v => `<li style="word-break:break-word;">${parseMd(v)}</li>`).join('')}
            </ul>
          </div>` : ''}
        </div>
      </div>` : ''}

      <!-- Chat contextual -->
      <div class="card">
        <div class="card-header" style="justify-content:space-between;">
          <h3>Chat contextual</h3>
          <button class="btn btn-ghost btn-sm" style="color:var(--text-muted);" onclick="clearChat(${id})">Limpiar chat</button>
        </div>
        <div class="card-body" style="padding:0;">
          <div id="chat-messages" style="min-height:200px;max-height:420px;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;">
            ${chatHistory.length === 0
              ? `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px;">
                   Pregúntame sobre este análisis, la cuenta o cómo avanzar en la venta.
                 </p>`
              : renderMessages(chatHistory)}
          </div>
          <div style="border-top:1px solid var(--border);padding:12px;display:flex;gap:8px;">
            <input id="chat-input" class="form-input" placeholder="Escribe una pregunta sobre este análisis..."
                   onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat(${id});}" />
            <button class="btn btn-primary" onclick="sendChat(${id})" id="chat-send">Enviar</button>
          </div>
          <div id="chat-loader" class="hidden" style="padding:8px 16px;font-size:12px;color:var(--text-muted);">
            Pensando...
          </div>
        </div>
      </div>

      <!-- Fuentes (collapsible) -->
      ${(r.fuentes || []).length > 0 ? `
      <div class="card">
        <div class="card-body" style="padding:0;">
          <details style="padding:0;">
            <summary style="padding:16px 20px;cursor:pointer;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;list-style:none;user-select:none;">
              <span style="font-size:16px;">🔗</span>
              Fuentes (${(r.fuentes || []).length})
              <span style="margin-left:auto;color:var(--text-muted);font-size:12px;font-weight:400;">Clic para expandir</span>
            </summary>
            <ol style="margin:0;padding:0 20px 16px 40px;font-size:12px;display:flex;flex-direction:column;gap:6px;color:var(--text-secondary);">
              ${(r.fuentes || []).map(f => {
                const isUrl = /^https?:\/\//.test(f);
                const display = esc(f);
                return `<li style="word-break:break-all;">${isUrl ? `<a href="${esc(f)}" target="_blank" rel="noopener" style="color:var(--brand-600);">${display}</a>` : display}</li>`;
              }).join('')}
            </ol>
          </details>
        </div>
      </div>` : ''}
    </div>
  `;

  // Chat handlers
  globalThis.sendChat = async (qId) => {
    const input  = document.getElementById('chat-input');
    const msg    = input.value.trim();
    if (!msg) return;

    const messagesEl = document.getElementById('chat-messages');
    const loader     = document.getElementById('chat-loader');
    const sendBtn    = document.getElementById('chat-send');

    input.value    = '';
    sendBtn.disabled = true;
    loader.classList.remove('hidden');

    chatHistory.push({ role: 'user', content: msg });
    messagesEl.innerHTML = renderMessages(chatHistory);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const data = await api.post(`/api/queries/${qId}/chat`, { message: msg });
      chatHistory = data.history;
      messagesEl.innerHTML = renderMessages(chatHistory);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (err) {
      showToast(err.message, 'error');
      chatHistory.pop();
      messagesEl.innerHTML = renderMessages(chatHistory);
    } finally {
      sendBtn.disabled = false;
      loader.classList.add('hidden');
    }
  };

  globalThis.clearChat = async (qId) => {
    if (!await confirmDialog('¿Borrar el historial de chat? No se puede deshacer.')) return;
    try {
      await api.delete(`/api/queries/${qId}/chat`);
      chatHistory = [];
      const el = document.getElementById('chat-messages');
      el.innerHTML = `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px;">Chat limpiado.</p>`;
      showToast('Historial borrado', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  globalThis.exportPDF = () => {
    if (!globalThis.html2pdf) { showToast('html2pdf no disponible', 'error'); return; }
    showToast('Generando PDF...', 'info');
    const el = document.getElementById('report-content');
    const name = `${queryData.company_name}_${queryData.manufacturer}`.replace(/\s+/g, '_');
    globalThis.html2pdf().set({
      margin: [10, 10, 15, 10],
      filename: `Gamma_${name}_${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(el).save().then(() => showToast('PDF descargado', 'success'));
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape HTML to prevent XSS */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/** Minimal markdown: escape HTML first, then convert **bold** and *italic* */
function parseMd(text) {
  if (!text) return '-';
  return esc(String(text))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function field(label, value) {
  return `<p style="min-width:0;word-break:break-word;"><strong>${esc(label)}:</strong> <span style="color:var(--text-secondary);">${parseMd(value)}</span></p>`;
}

/** Simple badge list for short tag items */
function tagBadges(items = []) {
  if (!items?.length) return '<p style="color:var(--text-muted);font-size:13px;">—</p>';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;">
    ${items.map(i => `<span class="badge">${esc(i)}</span>`).join('')}
  </div>`;
}

/** Numbered list for arquitectura sugerida — no green badges */
function arquitecturaList(items = []) {
  if (!items?.length) return '<p style="color:var(--text-muted);font-size:13px;">—</p>';
  return `<ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:8px;font-size:13px;">
    ${items.map((item, i) => `
      <li style="display:flex;gap:10px;align-items:flex-start;min-width:0;">
        <span style="background:var(--brand-100);color:var(--brand-700);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;">${i+1}</span>
        <span style="color:var(--text-secondary);line-height:1.6;word-break:break-word;">${parseMd(item)}</span>
      </li>`).join('')}
  </ul>`;
}

/** Card list for competencias — supports both string[] (legacy) and {nombre,descripcion}[] */
function competenciasList(items = []) {
  if (!items?.length) return '<p style="color:var(--text-muted);font-size:13px;">—</p>';
  return `<div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
    ${items.map(item => {
      if (typeof item === 'string') {
        return `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;word-break:break-word;">
          <p style="color:var(--text-secondary);">${parseMd(item)}</p>
        </div>`;
      }
      return `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;min-width:0;">
        <p style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">${parseMd(item.nombre)}</p>
        <p style="color:var(--text-secondary);font-size:12px;line-height:1.5;word-break:break-word;">${parseMd(item.descripcion)}</p>
      </div>`;
    }).join('')}
  </div>`;
}

function pitchCard(title, text, bg) {
  return `<div style="background:${bg};border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;font-size:13px;min-width:0;">
    <p style="font-weight:700;margin-bottom:8px;">${esc(title)}</p>
    <p style="color:var(--text-secondary);line-height:1.7;word-break:break-word;">${parseMd(text)}</p>
  </div>`;
}

function renderMessages(history) {
  return history.map(h => {
    const isUser = h.role === 'user';
    return `<div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
      <div style="max-width:75%;padding:10px 14px;border-radius:${isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};
                  background:${isUser ? 'var(--brand-600)' : 'var(--bg-hover)'};
                  color:${isUser ? '#fff' : 'var(--text-primary)'};
                  font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;">
        ${parseMd(h.content)}
      </div>
    </div>`;
  }).join('');
}
