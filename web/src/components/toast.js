/**
 * Toast / snackbar for non-blocking feedback (save, error, success).
 * Renders into #toast-container (outside #app so it persists across route changes).
 */

const TOAST_DURATION_MS = 3500;
const TOAST_DURATION_ERROR_MS = 5000;

/**
 * Show a toast message.
 * @param {string} message - Text to show
 * @param {'success'|'error'|'info'} type - Visual style
 * @param {{ onRetry?: () => void }} [options] - If onRetry is set, show a Retry button and keep toast longer
 */
export function showToast(message, type = 'info', options = {}) {
  const { onRetry } = options;
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);
  if (onRetry && typeof onRetry === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-retry-btn';
    btn.textContent = 'Retry';
    btn.addEventListener('click', () => {
      onRetry();
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    });
    toast.appendChild(btn);
  }
  container.appendChild(toast);

  let duration = type === 'error' ? TOAST_DURATION_ERROR_MS : TOAST_DURATION_MS;
  if (onRetry) duration = 15000;
  setTimeout(() => {
    if (!toast.parentNode) return;
    toast.classList.add('toast-exit');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 300);
  }, duration);
}
