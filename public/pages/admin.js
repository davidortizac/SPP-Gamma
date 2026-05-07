// public/pages/admin.js — Panel de administración (admin only)

import { api }      from '../js/api.js';
import { showToast, openModal, confirmDialog, fmtDate } from '../js/components.js';

let activeTab = 'users';

const ALL_PERMS = [
  { key: 'queries',    label: 'Consultas',   desc: 'Crear y ver análisis de cuentas' },
  { key: 'macro',      label: 'Macro',        desc: 'Consultas multi-fabricante' },
  { key: 'references', label: 'Referencias',  desc: 'Gestionar contexto de referencia' },
  { key: 'catalog',    label: 'Catálogo',     desc: 'Ver catálogo de fabricantes' },
];

export async function renderAdmin() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-container">
      <div class="page-header">
        <h1>Administración</h1>
        <p>Gestión de usuarios, configuración del sistema y base de datos</p>
      </div>

      <div class="tab-bar">
        ${[
          { id: 'users',  label: 'Usuarios' },
          { id: 'config', label: 'Configuración' },
          { id: 'queries',label: 'Historial Global' },
          { id: 'db',     label: 'Base de datos' },
        ].map(t => `
          <button class="tab-btn${t.id === activeTab ? ' active' : ''}" onclick="switchAdminTab('${t.id}')">${t.label}</button>
        `).join('')}
      </div>

      <div id="admin-tab-content">
        <div class="page-loading"><div class="loader loader-dark loader-lg"></div></div>
      </div>
    </div>`;

  globalThis.switchAdminTab = (tab) => {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.textContent.trim().toLowerCase() === tab ||
        b.getAttribute('onclick')?.includes(`'${tab}'`));
    });
    loadTab(tab);
  };

  await loadTab(activeTab);
}

async function loadTab(tab) {
  const wrap = document.getElementById('admin-tab-content');
  wrap.innerHTML = '<div class="page-loading" style="min-height:200px;"><div class="loader loader-dark loader-lg"></div></div>';
  if (tab === 'users')   return loadUsersTab(wrap);
  if (tab === 'config')  return loadConfigTab(wrap);
  if (tab === 'queries') return loadGlobalQueriesTab(wrap);
  if (tab === 'db')      return loadDbTab(wrap);
}

// ── Global Queries ─────────────────────────────────────────────────────────────
async function loadGlobalQueriesTab(wrap) {
  try {
    const { queries = [] } = await api.get('/api/admin/queries');

    wrap.innerHTML = `
      <div class="card" style="overflow:hidden;">
        <div class="card-header">
          <h3>Consultas de todos los usuarios</h3>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Solución</th>
                <th>Usuario</th>
                <th>Fecha</th>
                <th style="width:100px;"></th>
              </tr>
            </thead>
            <tbody>
              ${queries.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">No hay consultas registradas.</td></tr>' : ''}
              ${queries.map(q => `
                <tr>
                  <td style="font-weight:600;">${esc(q.company_name)}</td>
                  <td>${esc(q.manufacturer)} - ${esc(q.solution)}</td>
                  <td style="color:var(--text-secondary);">${esc(q.user_name)}</td>
                  <td style="font-size:12px;color:var(--text-muted);">${fmtDate(q.created_at)}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" style="color:var(--rose-600);" onclick="deleteGlobalQuery(${q.id})">Borrar</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    globalThis.deleteGlobalQuery = async (id) => {
      if (!await confirmDialog('¿Estás seguro de que deseas eliminar permanentemente esta consulta?')) return;
      try {
        await api.delete(`/api/admin/queries/${id}`);
        showToast('Consulta eliminada', 'success');
        loadGlobalQueriesTab(wrap);
      } catch (err) { showToast(err.message, 'error'); }
    };
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

// ── Users ──────────────────────────────────────────────────────────────────────
async function loadUsersTab(wrap) {
  try {
    const { users = [] } = await api.get('/api/admin/users');

    wrap.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button class="btn btn-primary" onclick="addUser()">+ Nuevo usuario</button>
      </div>
      <div class="card" style="overflow:hidden;">
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Accesos</th>
                <th>Estado</th>
                <th>Creado</th>
                <th style="width:120px;"></th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td style="font-weight:600;">${esc(u.name)}</td>
                  <td style="color:var(--text-secondary);">${esc(u.email)}</td>
                  <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'analyst'}">${u.role === 'admin' ? 'Admin' : 'Analista'}</span></td>
                  <td style="font-size:12px;color:var(--text-muted);">${permSummary(u)}</td>
                  <td><span class="badge badge-${u.active ? 'done' : 'error'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td style="font-size:12px;color:var(--text-muted);">${fmtDate(u.created_at)}</td>
                  <td>
                    <div style="display:flex;gap:6px;">
                      <button class="btn btn-ghost btn-sm" onclick="editUser(${u.id})">Editar</button>
                      ${u.active ? `<button class="btn btn-ghost btn-sm" style="color:var(--rose-600);" onclick="deactivateUser(${u.id})">Desactivar</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    // Guardar referencia local para el modal de edición
    globalThis._adminUsers = users;

    globalThis.addUser    = () => openUserModal(null);
    globalThis.editUser   = (id) => {
      const u = (globalThis._adminUsers || []).find(x => x.id === id);
      if (u) openUserModal(u);
    };
    globalThis.deactivateUser = async (id) => {
      if (!await confirmDialog('¿Desactivar este usuario?')) return;
      try {
        await api.delete(`/api/admin/users/${id}`);
        showToast('Usuario desactivado', 'success');
        loadUsersTab(wrap);
      } catch (err) { showToast(err.message, 'error'); }
    };
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

function permSummary(u) {
  if (u.role === 'admin') return 'Todos los accesos';
  const perms = Array.isArray(u.permissions) ? u.permissions : ALL_PERMS.map(p => p.key);
  if (perms.length === 0) return 'Sin accesos';
  if (perms.length === ALL_PERMS.length) return 'Acceso completo';
  return perms.map(k => ALL_PERMS.find(p => p.key === k)?.label || k).join(', ');
}

function openUserModal(user) {
  const isEdit  = Boolean(user);
  let curPerms = ALL_PERMS.map(p => p.key);
  if (isEdit && Array.isArray(user.permissions)) {
    curPerms = user.permissions;
  }
  const isAdminUser = user?.role === 'admin';
  
  let activeHtml = '';
  if (isEdit) {
    const checkedAttr = user?.active ? 'checked' : '';
    activeHtml = `
        <div class="form-group" style="margin:0;">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input id="u-active" type="checkbox" ${checkedAttr} style="accent-color:var(--brand-600);" />
            <span style="font-size:13.5px;font-weight:500;color:var(--text-primary);">Usuario activo</span>
          </label>
        </div>`;
  }

  openModal({
    title: isEdit ? 'Editar usuario' : 'Nuevo usuario',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Nombre completo</label>
          <input id="u-name" class="form-input" value="${esc(user?.name || '')}" placeholder="Nombre del usuario" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Correo electrónico</label>
          <input id="u-email" type="email" class="form-input" value="${esc(user?.email || '')}" placeholder="correo@empresa.com" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Contraseña ${isEdit ? '<small>(dejar vacío para no cambiar)</small>' : ''}</label>
          <input id="u-pass" type="password" class="form-input" placeholder="Mínimo 8 caracteres" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Rol</label>
          <select id="u-role" class="form-input form-select" onchange="updatePermVisibility()">
            <option value="analyst" ${user?.role === 'admin' ? '' : 'selected'}>Analista</option>
            <option value="admin"   ${user?.role === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
        </div>

        <div id="u-perms-section" ${isAdminUser ? 'style="display:none;"' : ''}>
          <label class="form-label" style="margin-bottom:10px;">Módulos habilitados</label>
          <div style="display:grid;gap:8px;">
            ${ALL_PERMS.map(p => `
              <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;transition:var(--transition);"
                     onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <input type="checkbox" id="perm-${p.key}" ${curPerms.includes(p.key) ? 'checked' : ''}
                       style="margin-top:2px;accent-color:var(--brand-600);flex-shrink:0;" />
                <div>
                  <div style="font-size:13.5px;font-weight:500;color:var(--text-primary);">${p.label}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:1px;">${p.desc}</div>
                </div>
              </label>`).join('')}
          </div>
        </div>

        ${activeHtml}
      </div>`,
    confirmText: isEdit ? 'Guardar cambios' : 'Crear usuario',
    onConfirm: async () => {
      const name  = document.getElementById('u-name').value.trim();
      const email = document.getElementById('u-email').value.trim();
      const pass  = document.getElementById('u-pass').value;
      const role  = document.getElementById('u-role').value;
      const active = isEdit ? document.getElementById('u-active').checked : true;
      const permissions = role === 'admin'
        ? ALL_PERMS.map(p => p.key)
        : ALL_PERMS.filter(p => document.getElementById(`perm-${p.key}`)?.checked).map(p => p.key);

      if (!name || !email) { showToast('Nombre y email son requeridos', 'error'); return; }
      if (!isEdit && !pass) { showToast('La contraseña es requerida', 'error'); return; }

      const body = { name, email, role, active, permissions };
      if (pass) body.password = pass;

      try {
        if (isEdit) {
          await api.put(`/api/admin/users/${user.id}`, body);
          showToast('Usuario actualizado', 'success');
        } else {
          await api.post('/api/admin/users', body);
          showToast('Usuario creado', 'success');
        }
        const wrap = document.getElementById('admin-tab-content');
        loadUsersTab(wrap);
      } catch (err) { showToast(err.message, 'error'); }
    },
  });

  // Mostrar/ocultar permisos según rol seleccionado
  globalThis.updatePermVisibility = () => {
    const role = document.getElementById('u-role')?.value;
    const sec  = document.getElementById('u-perms-section');
    if (sec) sec.style.display = role === 'admin' ? 'none' : '';
  };
}

// ── Config ─────────────────────────────────────────────────────────────────────
async function loadConfigTab(wrap) {
  try {
    const cfg = await api.get('/api/admin/config');
    let keyStatus;
    if (cfg.gemini_key_source === 'db')       keyStatus = `<span style="color:var(--emerald-600);">✓ Configurada desde el panel</span> · ${esc(cfg.gemini_key_masked)}`;
    else if (cfg.gemini_key_source === 'env') keyStatus = `<span style="color:var(--brand-600);">⚙ Desde variable de entorno</span> · ${esc(cfg.gemini_key_masked)}`;
    else                                      keyStatus = `<span style="color:var(--rose-600);">✗ Sin API key — las consultas fallarán</span>`;

    wrap.innerHTML = `
      <div style="max-width:600px;display:flex;flex-direction:column;gap:20px;">
        <div class="card">
          <div class="card-header"><h3>Gemini API</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:16px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">API Key</label>
              <div style="display:flex;gap:8px;">
                <input id="cfg-apikey" type="password" class="form-input"
                       placeholder="${cfg.gemini_key_source === 'none' ? 'Pega tu API key aquí' : cfg.gemini_key_masked}"
                       style="flex:1;font-family:monospace;font-size:13px;" />
                <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap;" onclick="toggleApiKeyVisibility()">Ver</button>
              </div>
              <p class="form-hint">${keyStatus} · Deja en blanco para mantener la actual.</p>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label">Modelo Gemini</label>
              <select id="cfg-model" class="form-input form-select">
                ${['gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash','gemini-1.5-flash'].map(m =>
                  `<option value="${m}" ${(cfg.gemini_model || cfg.server_model) === m ? 'selected' : ''}>${m}</option>`
                ).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Aplicación</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:16px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Nombre de la aplicación</label>
              <input id="cfg-name" class="form-input" value="${escAttr(cfg.app_name || 'Gamma Portfolio Explorer')}" />
            </div>
          </div>
        </div>

        <div id="cfg-msg" class="alert alert-success hidden">Configuración guardada correctamente.</div>
        <button class="btn btn-primary" onclick="saveConfig()">Guardar configuración</button>
      </div>`;

    globalThis.toggleApiKeyVisibility = () => {
      const input = document.getElementById('cfg-apikey');
      input.type = input.type === 'password' ? 'text' : 'password';
    };

    globalThis.saveConfig = async () => {
      const model  = document.getElementById('cfg-model').value;
      const name   = document.getElementById('cfg-name').value.trim();
      const apiKey = document.getElementById('cfg-apikey').value.trim();
      const body   = { gemini_model: model, app_name: name };
      if (apiKey) body.gemini_api_key = apiKey;
      try {
        await api.put('/api/admin/config', body);
        showToast('Configuración guardada', 'success');
        document.getElementById('cfg-msg').classList.remove('hidden');
        document.getElementById('cfg-apikey').value = '';
        setTimeout(() => loadConfigTab(wrap), 800);
      } catch (err) { showToast(err.message, 'error'); }
    };
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

// ── DB ─────────────────────────────────────────────────────────────────────────
async function loadDbTab(wrap) {
  try {
    const stats = await api.get('/api/admin/db/stats');
    const tables = [
      { key: 'users',                  label: 'Usuarios' },
      { key: 'catalog_manufacturers',  label: 'Fabricantes' },
      { key: 'catalog_solutions',      label: 'Soluciones' },
      { key: 'queries',                label: 'Consultas' },
      { key: 'macro_queries',          label: 'Macro-consultas' },
      { key: 'references_ctx',         label: 'Referencias' },
      { key: 'app_config',             label: 'Configuración' },
    ];

    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:20px;">

        <div class="card">
          <div class="card-header">
            <h3>Estado de la base de datos</h3>
            <span style="margin-left:auto;font-size:13px;color:var(--text-muted);">Tamaño: <strong style="color:var(--text-primary);">${esc(stats._db_size)}</strong></span>
          </div>
          <div class="card-body">
            <div class="grid-4" style="gap:12px;">
              ${tables.map(t => `
                <div class="stat-card" style="padding:14px 16px;">
                  <div class="stat-icon blue" style="font-size:14px;">🗃</div>
                  <div>
                    <div class="stat-value" style="font-size:22px;">${stats[t.key] ?? '—'}</div>
                    <div class="stat-label">${t.label}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Copia de seguridad</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px;">
            <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.7;">
              Exporta todos los datos de la plataforma en formato JSON: usuarios, catálogo, consultas, macro-consultas y referencias.
            </p>
            <a href="/api/admin/db/backup" target="_blank" class="btn btn-secondary" style="width:fit-content;">
              Descargar backup JSON
            </a>
          </div>
        </div>

        <div class="card" style="border-color:var(--amber-600);opacity:.9;">
          <div class="card-header">
            <h3 style="color:var(--amber-600);">Mantenimiento avanzado</h3>
          </div>
          <div class="card-body" style="font-size:13.5px;color:var(--text-secondary);line-height:1.7;">
            <p>Para operaciones avanzadas (vacuum, restauración, migraciones), conecta directamente a PostgreSQL:</p>
            <code style="display:block;margin-top:10px;padding:10px 14px;background:var(--bg-surface-alt);border:1px solid var(--border);border-radius:var(--radius-md);font-size:12px;color:var(--text-primary);">
              docker exec -it gamma-db psql -U gamma -d gamma
            </code>
          </div>
        </div>
      </div>`;
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

function esc(s)     { return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function escAttr(s) { return String(s || '').replaceAll('"', '&quot;'); }
