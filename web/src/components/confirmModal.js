/**
 * Confirmation modal for destructive or important actions (replace confirm()).
 * Renders into #modal-root so it persists and is above page content.
 */

/**
 * Show a confirmation modal. Returns a Promise that resolves to true if confirmed, false if cancelled.
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} [options.message] - Body text
 * @param {string} [options.confirmLabel='Confirm'] - Primary button label
 * @param {string} [options.cancelLabel='Cancel'] - Cancel button label
 * @param {boolean} [options.danger=false] - If true, confirm button uses danger style
 */
export function confirmAction(options) {
  const {
    title,
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = true
  } = options;

  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    root.className = 'modal-root';
    document.body.appendChild(root);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirm-modal-title');

    overlay.innerHTML = `
      <div class="confirm-modal">
        <h2 id="confirm-modal-title" class="confirm-modal-title">${escapeHtml(title)}</h2>
        ${message ? `<p class="confirm-modal-message">${escapeHtml(message)}</p>` : ''}
        <div class="confirm-modal-actions">
          <button type="button" class="btn-secondary confirm-modal-cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn-primary ${danger ? 'btn-danger' : ''} confirm-modal-confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.classList.add('confirm-modal-exit');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    }

    overlay.querySelector('.confirm-modal-cancel').onclick = () => close(false);
    overlay.querySelector('.confirm-modal-confirm').onclick = () => close(true);
    overlay.onclick = (e) => {
      if (e.target === overlay) close(false);
    };
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
    });

    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('confirm-modal-visible'));

    const confirmBtn = overlay.querySelector('.confirm-modal-confirm');
    if (confirmBtn) confirmBtn.focus();
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Choose how to apply an action to a repeating calendar series (same semantics as PetHub+: this / future / all).
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {'delete'|'edit'} [options.mode='delete']
 * @returns {Promise<'this'|'future'|'all'|null>}
 */
export function chooseRecurringScope(options) {
  const { title, message = '', mode = 'delete' } = options;

  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    root.className = 'modal-root';
    document.body.appendChild(root);
  }

  const choices =
    mode === 'delete'
      ? [
          { id: 'this', label: 'This date only', danger: false },
          { id: 'future', label: 'This date and future dates', danger: false },
          { id: 'all', label: 'Entire series', danger: true }
        ]
      : [
          { id: 'this', label: 'This date only', danger: false },
          { id: 'future', label: 'This date and future dates', danger: false },
          { id: 'all', label: 'Entire series', danger: false }
        ];

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'recurring-scope-title');

    const buttonsHtml = choices
      .map(
        (c) =>
          `<button type="button" class="${c.danger ? 'btn-primary btn-danger' : 'btn-secondary'} recurring-scope-choice" data-scope="${c.id}" style="width:100%;justify-content:center;">${escapeHtml(c.label)}</button>`
      )
      .join('');

    overlay.innerHTML = `
      <div class="confirm-modal" style="max-width: 420px;">
        <h2 id="recurring-scope-title" class="confirm-modal-title">${escapeHtml(title)}</h2>
        ${message ? `<p class="confirm-modal-message">${escapeHtml(message)}</p>` : ''}
        <div class="confirm-modal-actions" style="flex-direction: column; gap: 0.5rem; align-items: stretch;">
          ${buttonsHtml}
          <button type="button" class="btn-link recurring-scope-cancel" style="margin-top: 0.25rem;">Cancel</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.classList.add('confirm-modal-exit');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    }

    overlay.querySelectorAll('.recurring-scope-choice').forEach((btn) => {
      btn.onclick = () => close(btn.getAttribute('data-scope'));
    });
    overlay.querySelector('.recurring-scope-cancel').onclick = () => close(null);
    overlay.onclick = (e) => {
      if (e.target === overlay) close(null);
    };
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(null);
      }
    });

    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('confirm-modal-visible'));
    const first = overlay.querySelector('.recurring-scope-choice');
    if (first) first.focus();
  });
}
