// src/middleware/requireAdmin.js
// Guard de rol admin — debe usarse siempre después de requireAuth

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores.' });
  }
  next();
}
