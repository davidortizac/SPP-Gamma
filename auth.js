// ══════════════════════════════════════════════════════════════════════════
//  auth.js  ·  Passport strategies (Google OAuth + Local)  ·  SPP-Gamma v1.1
// ══════════════════════════════════════════════════════════════════════════
require('dotenv').config();
const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy  = require('passport-local').Strategy;
const bcrypt         = require('bcryptjs');
const { userDB }     = require('./db');

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || '';   // ej: "gammaingenieros.com"

// ── Serialize / Deserialize ────────────────────────────────────────────────
passport.serializeUser((user, done)   => done(null, user.id));
passport.deserializeUser((id, done)   => done(null, userDB.findById(id) || false));

// ── Google OAuth 2.0 ──────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || '';

        // Validar dominio si está configurado
        if (ALLOWED_DOMAIN && !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          return done(null, false, {
            message: `Solo usuarios del dominio @${ALLOWED_DOMAIN} tienen acceso.`
          });
        }

        const user = userDB.upsertGoogle(profile);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
}

// ── Local Strategy ─────────────────────────────────────────────────────────
passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  (email, password, done) => {
    try {
      const user = userDB.findByEmail(email.toLowerCase().trim());
      if (!user || !user.password) {
        return done(null, false, { message: 'Credenciales inválidas.' });
      }
      const ok = bcrypt.compareSync(password, user.password);
      if (!ok) return done(null, false, { message: 'Credenciales inválidas.' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

module.exports = passport;
