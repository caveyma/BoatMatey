/**
 * Engine-level maintenance schedule UI (planning layer; does not replace service/DIY logging).
 */

import { renderIcon } from './icons.js';
import { confirmAction } from './confirmModal.js';
import { showToast } from './toast.js';
import {
  getEngineMaintenanceSchedules,
  createEngineMaintenanceSchedule,
  updateEngineMaintenanceSchedule,
  deleteEngineMaintenanceSchedule
} from '../lib/dataService.js';
import {
  computeEngineScheduleStatus,
  computeScheduleNextDue,
  formatScheduleIntervalSummary,
  getEngineMeterReadingHours
} from '../lib/engineMaintenanceScheduleDue.js';
import {
  ENGINE_MAINTENANCE_SCHEDULE_TEMPLATES,
  getTemplateByKey
} from '../lib/engineMaintenanceScheduleTemplates.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function statusBadgeClass(status) {
  if (status === 'overdue') return 'badge badge-error';
  if (status === 'due_soon') return 'badge badge-warning';
  if (status === 'setup_needed') return 'badge badge-secondary';
  return 'badge badge-success';
}

function statusLabel(status) {
  if (status === 'overdue') return 'Overdue';
  if (status === 'due_soon') return 'Due soon';
  if (status === 'setup_needed') return 'Setup needed';
  return 'OK';
}

function openModal(htmlInner, onMountModal) {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    root.className = 'modal-root';
    document.body.appendChild(root);
  }
  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="confirm-modal" style="max-width: 420px;">
      ${htmlInner}
    </div>
  `;
  root.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('confirm-modal-visible'));

  const close = () => {
    overlay.classList.add('confirm-modal-exit');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  if (onMountModal) onMountModal(overlay, close);
  return { overlay, close };
}

/**
 * @param {HTMLElement} host
 * @param {{ boatId: string, engineId: string, engine: object|null, isNew: boolean, archived: boolean }} opts
 */
export async function mountEngineMaintenanceScheduleSection(host, opts) {
  const { boatId, engineId, engine, isNew, archived } = opts;
  if (!host || !boatId) return () => {};

  const meterHours = getEngineMeterReadingHours(engine);

  function renderShell() {
    host.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'engine-maint-schedule-card';
    card.innerHTML = `
      <h3>Scheduled maintenance</h3>
      <p class="text-muted" style="margin-top:0;">
        Plan recurring tasks by calendar and/or engine hours. Logging work stays on the <strong>Service</strong> page — this section only tracks what is due next.
      </p>
      ${meterHours == null ? '<p class="text-muted" style="font-size:0.9rem;">Tip: set <strong>Current engine hours (meter)</strong> above for hour-based status.</p>' : ''}
      <div id="engine-maint-schedule-body"></div>
    `;
    host.appendChild(card);
  }

  renderShell();
  const body = () => host.querySelector('#engine-maint-schedule-body');

  if (isNew) {
    body().innerHTML =
      '<p class="text-muted">Save this engine first, then you can add maintenance schedules here.</p>';
    return () => {};
  }

  let teardown = false;
  const refresh = async () => {
    if (teardown) return;
    const b = body();
    if (!b) return;
    b.innerHTML = '<p class="text-muted">Loading…</p>';
    const all = await getEngineMaintenanceSchedules(boatId);
    const rows = all.filter((s) => s.engine_id === engineId && s.is_active !== false);
    const archivedRows = all.filter((s) => s.engine_id === engineId && s.is_active === false);

    const engMeter = getEngineMeterReadingHours(engine);
    const today = new Date();

    const lines = rows
      .map((s) => {
        const st = computeEngineScheduleStatus(s, { today, currentEngineHours: engMeter });
        const { nextDueDate, nextDueHours } = computeScheduleNextDue(s);
        return { s, st, nextDueDate, nextDueHours };
      })
      .sort((a, b) => (a.s.task_name || '').localeCompare(b.s.task_name || ''));

    const rowsHtml = lines.length
      ? lines
          .map(({ s, st, nextDueDate, nextDueHours }) => {
            const interval = formatScheduleIntervalSummary(s);
            const nd =
              nextDueDate != null
                ? escapeHtml(nextDueDate)
                : '<span class="text-muted">—</span>';
            const nh =
              nextDueHours != null
                ? escapeHtml(String(nextDueHours))
                : '<span class="text-muted">—</span>';
            return `
          <div class="engine-maint-schedule-row card" style="margin-bottom: var(--spacing-md); padding: var(--spacing-md);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;flex-wrap:wrap;">
              <div>
                <strong>${escapeHtml((s.task_name || '').trim() || 'Task')}</strong>
                ${s.category ? `<span class="text-muted" style="font-size:0.9rem;"> · ${escapeHtml(s.category)}</span>` : ''}
                <div class="text-muted" style="font-size:0.9rem;margin-top:0.25rem;">${escapeHtml(interval)}</div>
              </div>
              <span class="${statusBadgeClass(st)}">${escapeHtml(statusLabel(st))}</span>
            </div>
            <div style="margin-top:0.5rem;font-size:0.9rem;">
              <span><strong>Next due (date):</strong> ${nd}</span>
              &nbsp;·&nbsp;
              <span><strong>Next due (hours):</strong> ${nh}</span>
            </div>
            ${s.notes ? `<p class="text-muted" style="margin:0.5rem 0 0;font-size:0.9rem;">${escapeHtml(s.notes)}</p>` : ''}
            ${
              archived
                ? ''
                : `<div class="form-actions" style="margin-top:0.75rem;margin-bottom:0;">
              <button type="button" class="btn-secondary engine-maint-btn-complete" data-id="${escapeHtml(s.id)}">Mark completed</button>
              <button type="button" class="btn-secondary engine-maint-btn-edit" data-id="${escapeHtml(s.id)}">Edit</button>
              <button type="button" class="btn-link btn-danger engine-maint-btn-archive" data-id="${escapeHtml(s.id)}">Archive</button>
              <button type="button" class="btn-link btn-danger engine-maint-btn-delete" data-id="${escapeHtml(s.id)}">Delete</button>
            </div>`
            }
          </div>
        `;
          })
          .join('')
      : '<p class="text-muted">No active schedule items yet.</p>';

    const templateOpts = ENGINE_MAINTENANCE_SCHEDULE_TEMPLATES.map(
      (t) => `<option value="${escapeHtml(t.key)}">${escapeHtml(t.task_name)}</option>`
    ).join('');

    b.innerHTML = `
      ${rowsHtml}
      ${
        archived
          ? ''
          : `
      <div class="form-group">
        <label for="engine_maint_template_pick">Add from template (optional)</label>
        <select id="engine_maint_template_pick" class="form-control">
          <option value="">Choose a template…</option>
          ${templateOpts}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" id="engine_maint_add_from_tpl">${renderIcon('plus')} Add from template</button>
        <button type="button" class="btn-primary" id="engine_maint_add_custom">${renderIcon('plus')} Custom item</button>
      </div>
      `
      }
      ${
        archivedRows.length && !archived
          ? `<p class="text-muted" style="font-size:0.85rem;">${archivedRows.length} archived item(s) hidden.</p>`
          : ''
      }
    `;

    if (!archived) {
      b.querySelector('#engine_maint_add_custom')?.addEventListener('click', () => openEditDialog(null));
      b.querySelector('#engine_maint_add_from_tpl')?.addEventListener('click', () => {
        const sel = b.querySelector('#engine_maint_template_pick');
        const key = sel?.value;
        if (!key) {
          showToast('Pick a template first.', 'info');
          return;
        }
        const tpl = getTemplateByKey(key);
        if (tpl) {
          openEditDialog(null, {
            task_name: tpl.task_name,
            category: tpl.category,
            interval_months: tpl.interval_months,
            interval_hours: tpl.interval_hours,
            template_key: tpl.key
          });
        }
      });

      b.querySelectorAll('.engine-maint-btn-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const row = all.find((x) => x.id === id);
          if (row) openEditDialog(row);
        });
      });
      b.querySelectorAll('.engine-maint-btn-complete').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const row = all.find((x) => x.id === id);
          if (row) openCompleteDialog(row);
        });
      });
      b.querySelectorAll('.engine-maint-btn-archive').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const ok = await confirmAction({
            title: 'Archive this schedule item?',
            message: 'It will no longer appear in active lists or dashboard reminders.',
            confirmLabel: 'Archive',
            danger: false
          });
          if (!ok) return;
          await updateEngineMaintenanceSchedule(id, { is_active: false });
          await getEngineMaintenanceSchedules(boatId);
          showToast('Schedule archived', 'info');
          refresh();
        });
      });
      b.querySelectorAll('.engine-maint-btn-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const row = all.find((x) => x.id === id);
          const label = ((row?.task_name || '').trim() || 'This schedule').slice(0, 120);
          const ok = await confirmAction({
            title: 'Delete this schedule?',
            message: `${label} will be removed permanently. This cannot be undone.`,
            confirmLabel: 'Delete',
            danger: true
          });
          if (!ok) return;
          await deleteEngineMaintenanceSchedule(id);
          await getEngineMaintenanceSchedules(boatId);
          showToast('Schedule deleted', 'info');
          refresh();
        });
      });
    }
  };

  function openCompleteDialog(schedule) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const defDate = `${y}-${m}-${d}`;
    const meter = getEngineMeterReadingHours(engine);

    openModal(
      `
      <h2 class="confirm-modal-title">Mark completed</h2>
      <p class="text-muted" style="margin-top:0;">Updates last-done values and recalculates next due.</p>
      <div class="form-group">
        <label for="ems_complete_date">Completed date</label>
        <input type="date" id="ems_complete_date" class="form-control" value="${escapeHtml(defDate)}" />
      </div>
      <div class="form-group">
        <label for="ems_complete_hours">Engine hours at completion</label>
        <input type="number" step="0.1" id="ems_complete_hours" class="form-control" value="${meter != null ? escapeHtml(String(meter)) : ''}" placeholder="e.g. 450" />
      </div>
      <div class="confirm-modal-actions">
        <button type="button" class="btn-secondary" id="ems_complete_cancel">Cancel</button>
        <button type="button" class="btn-primary" id="ems_complete_save">Save</button>
      </div>
    `,
      (overlay, close) => {
        overlay.querySelector('#ems_complete_cancel').onclick = () => close();
        overlay.querySelector('#ems_complete_save').onclick = async () => {
          const date = overlay.querySelector('#ems_complete_date')?.value?.trim();
          const hRaw = overlay.querySelector('#ems_complete_hours')?.value?.trim();
          const h = hRaw ? parseFloat(hRaw) : null;
          if (!date) {
            showToast('Date required', 'error');
            return;
          }
          await updateEngineMaintenanceSchedule(schedule.id, {
            last_completed_date: date,
            last_completed_engine_hours: h != null && Number.isFinite(h) ? h : null
          });
          await getEngineMaintenanceSchedules(boatId);
          showToast('Schedule updated', 'info');
          close();
          refresh();
        };
      }
    );
  }

  function openEditDialog(existing, prefill = null) {
    const e = existing || {};
    const p = prefill || {};
    const task = e.task_name ?? p.task_name ?? '';
    const cat = e.category ?? p.category ?? '';
    const im = e.interval_months ?? p.interval_months ?? '';
    const ih = e.interval_hours ?? p.interval_hours ?? '';
    const notes = e.notes ?? p.notes ?? '';
    const tplKey = e.template_key ?? p.template_key ?? '';

    openModal(
      `
      <h2 class="confirm-modal-title">${existing ? 'Edit schedule' : 'Add schedule'}</h2>
      <p class="text-muted" style="margin-top:0;">Set at least one interval (months and/or hours).</p>
      <div class="form-group">
        <label for="ems_task">Task name</label>
        <input type="text" id="ems_task" class="form-control" value="${escapeHtml(task)}" required />
      </div>
      <div class="form-group">
        <label for="ems_cat">Category (optional)</label>
        <input type="text" id="ems_cat" class="form-control" value="${escapeHtml(cat)}" placeholder="e.g. Engine Oil" />
      </div>
      <div class="form-group">
        <label for="ems_im">Interval (months)</label>
        <input type="number" min="1" id="ems_im" class="form-control" value="${im !== '' && im != null ? escapeHtml(String(im)) : ''}" placeholder="e.g. 12" />
      </div>
      <div class="form-group">
        <label for="ems_ih">Interval (engine hours)</label>
        <input type="number" min="1" id="ems_ih" class="form-control" value="${ih !== '' && ih != null ? escapeHtml(String(ih)) : ''}" placeholder="e.g. 100" />
      </div>
      <div class="form-group">
        <label for="ems_notes">Notes (optional)</label>
        <textarea id="ems_notes" class="form-control" rows="2">${escapeHtml(notes)}</textarea>
      </div>
      <div class="confirm-modal-actions">
        <button type="button" class="btn-secondary" id="ems_edit_cancel">Cancel</button>
        <button type="button" class="btn-primary" id="ems_edit_save">Save</button>
      </div>
    `,
      (overlay, close) => {
        overlay.querySelector('#ems_edit_cancel').onclick = () => close();
        overlay.querySelector('#ems_edit_save').onclick = async () => {
          const taskName = overlay.querySelector('#ems_task')?.value?.trim();
          const months = overlay.querySelector('#ems_im')?.value?.trim();
          const hours = overlay.querySelector('#ems_ih')?.value?.trim();
          const imN = months ? parseInt(months, 10) : null;
          const ihN = hours ? parseInt(hours, 10) : null;
          if (!taskName) {
            showToast('Task name required', 'error');
            return;
          }
          if (!((imN && imN > 0) || (ihN && ihN > 0))) {
            showToast('Set at least one positive interval (months or hours).', 'error');
            return;
          }
          const payload = {
            engine_id: engineId,
            task_name: taskName,
            category: overlay.querySelector('#ems_cat')?.value?.trim() || null,
            notes: overlay.querySelector('#ems_notes')?.value?.trim() || null,
            interval_months: imN && imN > 0 ? imN : null,
            interval_hours: ihN && ihN > 0 ? ihN : null,
            template_key: tplKey || null,
            last_completed_date: e.last_completed_date ?? null,
            last_completed_engine_hours: e.last_completed_engine_hours ?? null,
            is_active: true
          };
          if (existing) {
            await updateEngineMaintenanceSchedule(existing.id, payload);
          } else {
            const created = await createEngineMaintenanceSchedule(boatId, payload);
            if (!created) {
              showToast('Could not create schedule.', 'error');
              return;
            }
          }
          await getEngineMaintenanceSchedules(boatId);
          showToast(existing ? 'Schedule saved' : 'Schedule added', 'info');
          close();
          refresh();
        };
      }
    );
  }

  await refresh();
  return () => {
    teardown = true;
  };
}
