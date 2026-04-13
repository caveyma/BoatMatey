/**
 * Optional prompt after logging a service: update matching maintenance schedule rows.
 */

import {
  updateEngineMaintenanceSchedule,
  getEngineMaintenanceSchedules
} from './dataService.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

/**
 * @param {object} options
 * @param {object[]} options.matches — schedule rows
 * @param {string} options.completedDate — YYYY-MM-DD
 * @param {number|null|undefined} options.engineHours
 * @param {string} options.boatId
 * @returns {Promise<void>}
 */
export async function offerUpdateEngineSchedulesAfterService({ matches, completedDate, engineHours, boatId }) {
  if (!matches?.length || !completedDate || !boatId) return;

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
    overlay.setAttribute('aria-labelledby', 'ems-after-svc-title');

    const checkHtml = matches
      .map(
        (m) => `
      <label class="ems-after-svc-row">
        <input type="checkbox" class="ems-after-svc-cb" value="${escapeHtml(m.id)}" checked />
        <span>${escapeHtml((m.task_name || '').trim() || 'Schedule')}</span>
      </label>
    `
      )
      .join('');

    const hoursHint =
      engineHours != null && Number.isFinite(Number(engineHours))
        ? `Engine hours at service: <strong>${escapeHtml(String(engineHours))}</strong>`
        : 'No engine hours on this entry — schedules will update the date only unless you set hours on the entry.';

    overlay.innerHTML = `
      <div class="confirm-modal" style="max-width: 440px;">
        <h2 id="ems-after-svc-title" class="confirm-modal-title">Update maintenance schedule?</h2>
        <p class="confirm-modal-message text-muted" style="margin-top:0;">
          Optional: mark matching scheduled items as completed using this service. Your detailed service record is already saved.
        </p>
        <p class="text-muted" style="font-size: 0.9rem;">${hoursHint}</p>
        <div class="ems-after-svc-list" style="margin: 1rem 0; max-height: 200px; overflow-y: auto;">
          ${checkHtml}
        </div>
        <div class="confirm-modal-actions">
          <button type="button" class="btn-secondary ems-after-svc-skip">Not now</button>
          <button type="button" class="btn-primary ems-after-svc-apply">Update selected</button>
        </div>
      </div>
    `;

    function close() {
      overlay.classList.add('confirm-modal-exit');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 200);
    }

    overlay.querySelector('.ems-after-svc-skip').onclick = () => close();

    overlay.querySelector('.ems-after-svc-apply').onclick = async () => {
      const selected = Array.from(overlay.querySelectorAll('.ems-after-svc-cb:checked')).map((el) => el.value);
      if (selected.length) {
        const lastH =
          engineHours != null && Number.isFinite(Number(engineHours)) ? Number(engineHours) : null;
        for (const id of selected) {
          await updateEngineMaintenanceSchedule(id, {
            last_completed_date: completedDate,
            last_completed_engine_hours: lastH
          });
        }
        await getEngineMaintenanceSchedules(boatId);
      }
      close();
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('confirm-modal-visible'));
    const first = overlay.querySelector('.ems-after-svc-apply');
    if (first) first.focus();
  });
}
