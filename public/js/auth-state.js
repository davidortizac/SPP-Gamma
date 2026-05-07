// public/js/auth-state.js — Estado de sesión frontend

const AUTH_KEY = 'gamma_auth';

const ALL_PERMISSIONS = ['queries', 'macro', 'references', 'catalog'];

export const authState = {
  token: null,
  user:  null,

  load() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.token = data.token || null;
      this.user  = data.user  || null;
    } catch { this.clear(); }
  },

  save(token, user) {
    this.token = token;
    this.user  = user;
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
  },

  clear() {
    this.token = null;
    this.user  = null;
    localStorage.removeItem(AUTH_KEY);
  },

  isLoggedIn() { return Boolean(this.token && this.user); },
  isAdmin()    { return this.user?.role === 'admin'; },

  /** Devuelve true si el usuario tiene el permiso indicado (admin siempre tiene todos) */
  hasPermission(perm) {
    if (this.isAdmin()) return true;
    const perms = this.user?.permissions;
    if (!Array.isArray(perms)) return true; // backwards-compat: si no hay campo, permitir todo
    return perms.includes(perm);
  },

  /** Lista de permisos del usuario actual */
  getPermissions() {
    if (this.isAdmin()) return [...ALL_PERMISSIONS];
    return this.user?.permissions || [...ALL_PERMISSIONS];
  },
};

authState.load();
