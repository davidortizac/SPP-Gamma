// public/pages/login.js — Página de login premium

import { api }         from '../js/api.js';
import { authState }   from '../js/auth-state.js';
import { showToast }   from '../js/components.js';
import { navigate }    from '../js/router.js';

export function renderLogin() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <img src="/imagenes/Logo-Gamma-Ingenieros-(Negro).png" alt="Gamma" onerror="this.style.display='none'">
          <div class="login-logo-divider"></div>
          <span class="login-logo-label">Portfolio Explorer</span>
        </div>
        <h1 class="login-title">Bienvenido</h1>
        <p class="login-subtitle">Plataforma de inteligencia de preventa</p>

        <!-- Tabs -->
        <div class="login-tabs">
          <button id="tab-login" class="login-tab active" onclick="window._loginTab('login')">Iniciar sesión</button>
          <button id="tab-register" class="login-tab" onclick="window._loginTab('register')">Registrarse</button>
        </div>

        <!-- Login form -->
        <form id="form-login" autocomplete="on">
          <div class="form-group">
            <label class="form-label">Correo electrónico</label>
            <input type="email" id="login-email" class="form-input" placeholder="usuario@gamma.com" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" id="login-password" class="form-input" placeholder="••••••••" autocomplete="current-password" required>
          </div>
          <div id="login-error" class="alert alert-error hidden" style="margin-bottom:16px;"></div>
          <button type="submit" class="btn btn-primary btn-lg btn-full" id="login-btn">
            <span id="login-btn-text">Entrar</span>
            <span id="login-btn-loader" class="loader hidden"></span>
          </button>
        </form>

        <!-- Register form -->
        <form id="form-register" class="hidden" autocomplete="on">
          <div class="form-group">
            <label class="form-label">Nombre completo</label>
            <input type="text" id="reg-name" class="form-input" placeholder="Tu nombre" autocomplete="name" required>
          </div>
          <div class="form-group">
            <label class="form-label">Correo electrónico</label>
            <input type="email" id="reg-email" class="form-input" placeholder="usuario@gamma.com" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña <span style="color:var(--text-muted);font-weight:400;">(mínimo 8 caracteres)</span></label>
            <input type="password" id="reg-password" class="form-input" placeholder="••••••••" autocomplete="new-password" required>
          </div>
          <div id="reg-error" class="alert alert-error hidden" style="margin-bottom:16px;"></div>
          <button type="submit" class="btn btn-primary btn-lg btn-full" id="reg-btn">
            <span id="reg-btn-text">Crear cuenta</span>
            <span id="reg-btn-loader" class="loader hidden"></span>
          </button>
        </form>

        <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:24px;">
          Gamma Portfolio Explorer © ${new Date().getFullYear()}
        </p>
      </div>
    </div>
  `;

  // Tab switching
  window._loginTab = (tab) => {
    const isLogin = tab === 'login';
    document.getElementById('form-login').classList.toggle('hidden', !isLogin);
    document.getElementById('form-register').classList.toggle('hidden', isLogin);
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
  };

  // Login submit
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn     = document.getElementById('login-btn');
    const loader  = document.getElementById('login-btn-loader');
    const errEl   = document.getElementById('login-error');
    const email   = document.getElementById('login-email').value.trim();
    const password= document.getElementById('login-password').value;

    errEl.classList.add('hidden');
    btn.disabled = true;
    loader.classList.remove('hidden');

    try {
      const data = await api.post('/api/auth/login', { email, password });
      authState.save(data.token, data.user);
      showToast(`Bienvenido, ${data.user.name}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      loader.classList.add('hidden');
    }
  });

  // Register submit
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = document.getElementById('reg-btn');
    const loader = document.getElementById('reg-btn-loader');
    const errEl  = document.getElementById('reg-error');
    const name   = document.getElementById('reg-name').value.trim();
    const email  = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    errEl.classList.add('hidden');
    btn.disabled = true;
    loader.classList.remove('hidden');

    try {
      const data = await api.post('/api/auth/register', { name, email, password });
      authState.save(data.token, data.user);
      showToast(`Cuenta creada. Bienvenido, ${data.user.name}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      loader.classList.add('hidden');
    }
  });
}
