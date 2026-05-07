// public/js/components.js — Componentes UI reutilizables

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️' };

export function showToast(message, type = 'info', duration = 4000) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${TOAST_ICONS[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
let activeModal = null;

export function openModal({ title, body, confirmText = 'Confirmar', onConfirm, cancelText = 'Cancelar' }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body">${typeof body === 'string' ? body : ''}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>
        ${onConfirm ? `<button class="btn btn-primary" id="modal-confirm">${confirmText}</button>` : ''}
      </div>
    </div>
  `;

  if (typeof body !== 'string' && body instanceof HTMLElement) {
    overlay.querySelector('.modal-body').appendChild(body);
  }

  overlay.querySelector('.modal-close').onclick = closeModal;
  overlay.querySelector('#modal-cancel').onclick = closeModal;
  if (onConfirm) {
    overlay.querySelector('#modal-confirm').onclick = () => { onConfirm(); closeModal(); };
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
  activeModal = overlay;
  return overlay;
}

function escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
    document.removeEventListener('keydown', escHandler);
  }
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
export function confirmDialog(message, title = '¿Estás seguro?') {
  return new Promise((resolve) => {
    openModal({
      title,
      body: `<p style="color:var(--text-secondary);font-size:14px;">${message}</p>`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm: () => resolve(true),
    });
    // Detect cancel via close
    const orig = closeModal;
    activeModal?.querySelector('#modal-cancel')?.addEventListener('click', () => resolve(false), { once: true });
    activeModal?.querySelector('.modal-close')?.addEventListener('click', () => resolve(false), { once: true });
  });
}

// ── Loading spinner ───────────────────────────────────────────────────────────
export function createLoader(message = 'Cargando...') {
  const div = document.createElement('div');
  div.className = 'page-loading';
  div.innerHTML = `<div class="loader loader-dark loader-lg"></div><p>${message}</p>`;
  return div;
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function createEmptyState({ icon = '📭', title, message, actionLabel, onAction } = {}) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-state-icon">${icon}</div>
    ${title ? `<h3>${title}</h3>` : ''}
    ${message ? `<p>${message}</p>` : ''}
    ${actionLabel && onAction ? `<button class="btn btn-primary" id="es-action">${actionLabel}</button>` : ''}
  `;
  if (actionLabel && onAction) {
    div.querySelector('#es-action').onclick = onAction;
  }
  return div;
}

// ── Format date ───────────────────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Truncate ──────────────────────────────────────────────────────────────────
export function truncate(str, n = 50) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}
