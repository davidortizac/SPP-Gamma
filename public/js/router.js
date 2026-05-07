// public/js/router.js — Hash-based SPA Router con sidebar y permisos

import { authState }       from './auth-state.js';
import { renderLogin }     from '../pages/login.js';
import { renderDashboard } from '../pages/dashboard.js';

// Lazy imports de páginas adicionales
async function getQueries()    { return import('../pages/queries.js');      }
async function getQueryDetail(){ return import('../pages/query-detail.js'); }
async function getMacro()      { return import('../pages/macro.js');        }
async function getReferences() { return import('../pages/references.js');   }
async function getCatalog()    { return import('../pages/catalog-page.js'); }
async function getAdmin()      { return import('../pages/admin.js');        }

// ── SVG icons ─────────────────────────────────────────────────────────────────
const ICONS = {
  dashboard:   `<svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  queries:     `<svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  macro:       `<svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  references:  `<svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  catalog:     `<svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  admin:       `<svg class="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>`,
};

// ── Route registry ────────────────────────────────────────────────────────────
const routes = [
  { path: '/',            exact: true,  handler: () => navigate('/dashboard') },
  { path: '/login',       exact: true,  handler: () => renderLogin() },
  { path: '/dashboard',   exact: true,  handler: () => renderDashboard(),                        requiresAuth: true },
  { path: '/queries/new', exact: true,  handler: async () => { const m = await getQueries();     m.renderQueryNew(); },              requiresAuth: true, permission: 'queries' },
  { path: '/queries',     exact: true,  handler: async () => { const m = await getQueries();     m.renderQueryList(); },             requiresAuth: true, permission: 'queries' },
  { path: '/queries',     exact: false, handler: async (p) => { const m = await getQueryDetail(); m.renderQueryDetail(p.split('/')[2]); }, requiresAuth: true, permission: 'queries' },
  { path: '/macro/new',   exact: true,  handler: async () => { const m = await getMacro();       m.renderMacroNew(); },              requiresAuth: true, permission: 'macro' },
  { path: '/macro',       exact: true,  handler: async () => { const m = await getMacro();       m.renderMacroList(); },             requiresAuth: true, permission: 'macro' },
  { path: '/macro',       exact: false, handler: async (p) => { const m = await getMacro();      m.renderMacroDetail(p.split('/')[2]); }, requiresAuth: true, permission: 'macro' },
  { path: '/references',  exact: true,  handler: async () => { const m = await getReferences();  m.renderReferences(); },            requiresAuth: true, permission: 'references' },
  { path: '/catalog',     exact: true,  handler: async () => { const m = await getCatalog();     m.renderCatalog(); },               requiresAuth: true, permission: 'catalog' },
  { path: '/admin',       exact: false, handler: async () => { const m = await getAdmin();       m.renderAdmin(); },                 requiresAuth: true, requiresAdmin: true },
];

// ── Navigation ────────────────────────────────────────────────────────────────
export function navigate(path) {
  globalThis.location.hash = `#${path}`;
}

// ── Sidebar update ────────────────────────────────────────────────────────────
function updateSidebar(currentPath) {
  const sidebar = document.getElementById('app-sidebar');
  const main    = document.getElementById('app-main');
  const mhdr    = document.getElementById('mobile-header');

  if (!authState.isLoggedIn()) {
    sidebar.classList.add('hidden');
    main.classList.add('no-sidebar');
    mhdr.classList.add('hidden');
    return;
  }

  sidebar.classList.remove('hidden');
  main.classList.remove('no-sidebar');
  mhdr.classList.remove('hidden');

  // Avatar e info de usuario
  const name     = authState.user?.name || '';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const roleLabel = authState.isAdmin() ? 'Administrador' : 'Analista';
  document.getElementById('sidebar-avatar').textContent   = initials;
  document.getElementById('sidebar-username').textContent = name;
  document.getElementById('sidebar-role').textContent     = roleLabel;

  // Items del nav
  const navItems = [
    { path: '/dashboard',  label: 'Dashboard',   icon: ICONS.dashboard,  always: true },
    { path: '/queries',    label: 'Consultas',    icon: ICONS.queries,    perm: 'queries' },
    { path: '/macro',      label: 'Macro',        icon: ICONS.macro,      perm: 'macro' },
    { path: '/references', label: 'Referencias',  icon: ICONS.references, perm: 'references' },
    { path: '/catalog',    label: 'Catálogo',     icon: ICONS.catalog,    perm: 'catalog' },
    { path: '/admin',      label: 'Administración', icon: ICONS.admin,    adminOnly: true },
  ];

  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = navItems
    .filter(item => {
      if (item.adminOnly) return authState.isAdmin();
      if (item.perm)      return authState.hasPermission(item.perm);
      return true; // always visible
    })
    .map(item => {
      const active = item.path === currentPath ||
                     (item.path !== '/dashboard' && currentPath.startsWith(item.path));
      return `<button class="sidebar-item${active ? ' active' : ''}"
                      data-path="${item.path}"
                      onclick="navigate('${item.path}')">
        ${item.icon}
        <span>${item.label}</span>
      </button>`;
    })
    .join('');
}

// ── Router core ───────────────────────────────────────────────────────────────
async function handleRoute() {
  const hash = globalThis.location.hash || '#/';
  const path = hash.slice(1).split('?')[0] || '/';

  // Cerrar sidebar en mobile al navegar
  if (window.innerWidth <= 768) {
    globalThis.closeSidebar?.();
  }

  // Auth guard
  if (!authState.isLoggedIn() && path !== '/login') {
    updateSidebar('/login');
    renderLogin();
    return;
  }
  if (authState.isLoggedIn() && path === '/login') {
    navigate('/dashboard');
    return;
  }

  // Match de ruta
  let matched = routes.find(r => r.exact && r.path === path);
  if (!matched) matched = routes.find(r => !r.exact && path.startsWith(r.path + '/'));

  if (!matched) {
    navigate(authState.isLoggedIn() ? '/dashboard' : '/login');
    return;
  }

  // Guard admin
  if (matched.requiresAdmin && !authState.isAdmin()) {
    navigate('/dashboard');
    return;
  }

  // Guard permiso
  if (matched.permission && !authState.hasPermission(matched.permission)) {
    navigate('/dashboard');
    return;
  }

  updateSidebar(path);
  await matched.handler(path);
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initRouter() {
  globalThis.addEventListener('hashchange', handleRoute);
  handleRoute();
}
