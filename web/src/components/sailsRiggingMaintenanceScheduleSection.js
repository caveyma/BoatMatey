/**
 * Sails & rigging maintenance schedule UI (planning layer; separate from service history).
 */

import { renderIcon } from './icons.js';
import { confirmAction } from './confirmModal.js';
import { showToast } from './toast.js';
import {
  getSailsRiggingMaintenanceSchedules,
  createSailsRiggingMaintenanceSchedule,
  updateSailsRiggingMaintenanceSchedule,
  deleteSailsRiggingMaintenanceSchedule
} from '../lib/dataService.js';
import {
  computeSailsRiggingScheduleStatus,
  computeSailsScheduleNextDue,
  formatSailsScheduleIntervalSummary
} from '../lib/sailsRiggingMaintenanceScheduleDue.js';
import {
  SAILS_RIGGING_MAINTENANCE_SCHEDULE_TEMPLATES,
  getSailsTemplateByKey
} from '../lib/sailsRiggingMaintenanceScheduleTemplates.js';

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
 * @param {{ boatId: string, archived: boolean }} opts
 */
export async function mountSailsRiggingMaintenanceScheduleSection(host, opts) {
  const { boatId, archived } = opts;
  if (!host || !boatId) return () => {};

  function renderShell() {
    host.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'sails-rig-maint-schedule-card';
    card.innerHTML = `
      <h3>Sails & rigging maintenance schedule</h3>
      <p class="text-muted" style="margin-top:0;">
        Plan recurring inspections and service by calendar. Logging completed work stays on the <strong>Service</strong> page — this section only tracks what is due next.
      </p>
      <div id="sails-rig-maint-schedule-body"></div>
    `;
    host.appendChild(card);
  }

  renderShell();
  const body = () => host.querySelector('#sails-rig-maint-schedule-body');

  let teardown = false;
  const refresh = async () => {
    if (teardown) return;
    const b = body();
    if (!b) return;
    b.innerHTML = '<p class="text-muted">Loading…</p>';
    const all = await getSailsRiggingMaintenanceSchedules(boatId);
    const rows = all.filter((s) => s.is_active !== false);
    const archivedRows = all.filter((s) => s.is_active === false);

    const lines = rows
      .map((s) => {
        const st = computeSailsRiggingScheduleStatus(s);
        const { nextDueDate } = computeSailsScheduleNextDue(s);
        return { s, st, nextDueDate };
      })
      .sort((a, b) => (a.s.task_name || '').localeCompare(b.s.task_name || ''));

    const rowsHtml = lines.length
      ? lines
          .map(({ s, st, nextDueDate }) => {
            const interval = formatSailsScheduleIntervalSummary(s);
            const nd =
              nextDueDate != null
                ? escapeHtml(nextDueDate)
                : '<span class="text-muted">—</span>';
            return `
          <div class="sails-rig-maint-schedule-row card" style="margin-bottom: var(--spacing-md); padding: var(--spacing-md);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;flex-wrap:wrap;">
              <div>
                <strong>${escapeHtml((s.task_name || '').trim() || 'Task')}</strong>
                ${s.category ? `<span class="text-muted" style="font-size:0.9rem;"> · ${escapeHtml(s.category)}</span>` : ''}
                <div class="text-muted" style="font-size:0.9rem;margin-top:0.25rem;">${escapeHtml(interval)}</div>
              </div>
              <span class="${statusBadgeClass(st)}">${escapeHtml(statusLabel(st))}</span>
            </div>
            <div style="margin-top:0.5rem;font-size:0.9rem;">
              <span><strong>Next due:</strong> ${nd}</span>
            </div>
            ${s.notes ? `<p class="text-muted" style="margin:0.5rem 0 0;font-size:0.9rem;">${escapeHtml(s.notes)}</p>` : ''}
            ${
              archived
                ? ''
                : `<div class="form-actions" style="margin-top:0.75rem;margin-bottom:0;">
              <button type="button" class="btn-secondary sails-rig-maint-btn-complete" data-id="${escapeHtml(s.id)}">Mark completed</button>
              <button type="button" class="btn-secondary sails-rig-maint-btn-edit" data-id="${escapeHtml(s.id)}">Edit</button>
              <button type="button" class="btn-link btn-danger sails-rig-maint-btn-archive" data-id="${escapeHtml(s.id)}">Archive</button>
              <button type="button" class="btn-link btn-danger sails-rig-maint-btn-delete" data-id="${escapeHtml(s.id)}">Delete</button>
            </div>`
            }
          </div>
        `;
          })
          .join('')
      : '<p class="text-muted">No active schedule items yet.</p>';

    const templateOpts = SAILS_RIGGING_MAINTENANCE_SCHEDULE_TEMPLATES.map(
      (t) => `<option value="${escapeHtml(t.key)}">${escapeHtml(t.task_name)}</option>`
    ).join('');

    b.innerHTML = `
      ${rowsHtml}
      ${
        archived
          ? ''
          : `
      <div class="form-group">
        <label for="sails_rig_maint_template_pick">Add from template (optional)</label>
        <select id="sails_rig_maint_template_pick" class="form-control">
          <option value="">Choose a template…</option>
          ${templateOpts}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" id="sails_rig_maint_add_from_tpl">${renderIcon('plus')} Add from template</button>
        <button type="button" class="btn-primary" id="sails_rig_maint_add_custom">${renderIcon('plus')} Custom item</button>
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
      b.querySelector('#sails_rig_maint_add_custom')?.addEventListener('click', () => openEditDialog(null));
      b.querySelector('#sails_rig_maint_add_from_tpl')?.addEventListener('click', () => {
        const sel = b.querySelector('#sails_rig_maint_template_pick');
        const key = sel?.value;
        if (!key) {
          showToast('Pick a template first.', 'info');
          return;
        }
        const tpl = getSailsTemplateByKey(key);
        if (tpl) {
          openEditDialog(null, {
            task_name: tpl.task_name,
            category: tpl.category,
            interval_months: tpl.interval_months,
            template_key: tpl.key
          });
        }
      });

      b.querySelectorAll('.sails-rig-maint-btn-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const row = all.find((x) => x.id === id);
          if (row) openEditDialog(row);
        });
      });
      b.querySelectorAll('.sails-rig-maint-btn-complete').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const row = all.find((x) => x.id === id);
          if (row) openCompleteDialog(row);
        });
      });
      b.querySelectorAll('.sails-rig-maint-btn-archive').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const ok = await confirmAction({
            title: 'Archive this schedule item?',
            message: 'It will no longer appear in active lists or dashboard reminders.',
            confirmLabel: 'Archive',
            danger: false
          });
          if (!ok) return;
          await updateSailsRiggingMaintenanceSchedule(id, { is_active: false });
          await getSailsRiggingMaintenanceSchedules(boatId);
          showToast('Schedule archived', 'info');
          refresh();
        });
      });
      b.querySelectorAll('.sails-rig-maint-btn-delete').forEach((btn) => {
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
          await deleteSailsRiggingMaintenanceSchedule(id);
          await getSailsRiggingMaintenanceSchedules(boatId);
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

    openModal(
      `
      <h2 class="confirm-modal-title">Mark completed</h2>
      <p class="text-muted" style="margin-top:0;">Sets last completed date and recalculates the next due date from your interval.</p>
      <div class="form-group">
        <label for="srms_complete_date">Completed date</label>
        <input type="date" id="srms_complete_date" class="form-control" value="${escapeHtml(defDate)}" />
      </div>
      <div class="form-group">
        <label for="srms_complete_notes">Notes (optional)</label>
        <textarea id="srms_complete_notes" class="form-control" rows="2" placeholder="e.g. inspected at mast base"></textarea>
      </div>
      <div class="confirm-modal-actions">
        <button type="button" class="btn-secondary" id="srms_complete_cancel">Cancel</button>
        <button type="button" class="btn-primary" id="srms_complete_save">Save</button>
      </div>
    `,
      (overlay, close) => {
        overlay.querySelector('#srms_complete_cancel').onclick = () => close();
        overlay.querySelector('#srms_complete_save').onclick = async () => {
          const date = overlay.querySelector('#srms_complete_date')?.value?.trim();
          const noteExtra = overlay.querySelector('#srms_complete_notes')?.value?.trim();
          if (!date) {
            showToast('Date required', 'error');
            return;
          }
          let notes = schedule.notes || '';
          if (noteExtra) {
            const stamp = `Completed ${date}: ${noteExtra}`;
            notes = notes ? `${notes}\n${stamp}` : stamp;
          }
          await updateSailsRiggingMaintenanceSchedule(schedule.id, {
            last_completed_date: date,
            ...(noteExtra ? { notes } : {})
          });
          await getSailsRiggingMaintenanceSchedules(boatId);
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
    const notes = e.notes ?? p.notes ?? '';
    const tplKey = e.template_key ?? p.template_key ?? '';

    openModal(
      `
      <h2 class="confirm-modal-title">${existing ? 'Edit schedule' : 'Add schedule'}</h2>
      <p class="text-muted" style="margin-top:0;">Interval is in whole months (calendar-based).</p>
      <div class="form-group">
        <label for="srms_task">Task name</label>
        <input type="text" id="srms_task" class="form-control" value="${escapeHtml(task)}" required />
      </div>
      <div class="form-group">
        <label for="srms_cat">Category (optional)</label>
        <input type="text" id="srms_cat" class="form-control" value="${escapeHtml(cat)}" placeholder="e.g. Standing rigging" />
      </div>
      <div class="form-group">
        <label for="srms_im">Interval (months) *</label>
        <input type="number" min="1" id="srms_im" class="form-control" value="${im !== '' && im != null ? escapeHtml(String(im)) : ''}" placeholder="e.g. 12" required />
      </div>
      <div class="form-group">
        <label for="srms_last">Last completed (optional)</label>
        <input type="date" id="srms_last" class="form-control" value="${escapeHtml(e.last_completed_date || '')}" />
      </div>
      <div class="form-group">
        <label for="srms_notes">Notes (optional)</label>
        <textarea id="srms_notes" class="form-control" rows="2">${escapeHtml(notes)}</textarea>
      </div>
      <div class="confirm-modal-actions">
        <button type="button" class="btn-secondary" id="srms_edit_cancel">Cancel</button>
        <button type="button" class="btn-primary" id="srms_edit_save">Save</button>
      </div>
    `,
      (overlay, close) => {
        overlay.querySelector('#srms_edit_cancel').onclick = () => close();
        overlay.querySelector('#srms_edit_save').onclick = async () => {
          const taskName = overlay.querySelector('#srms_task')?.value?.trim();
          const months = overlay.querySelector('#srms_im')?.value?.trim();
          const imN = months ? parseInt(months, 10) : null;
          if (!taskName) {
            showToast('Task name required', 'error');
            return;
          }
          if (!imN || imN <= 0) {
            showToast('Set a positive interval in months.', 'error');
            return;
          }
          const lastRaw = overlay.querySelector('#srms_last')?.value?.trim();
          const payload = {
            task_name: taskName,
            category: overlay.querySelector('#srms_cat')?.value?.trim() || null,
            notes: overlay.querySelector('#srms_notes')?.value?.trim() || null,
            interval_months: imN,
            last_completed_date: lastRaw || null,
            template_key: tplKey || null,
            is_active: true
          };
          if (existing) {
            await updateSailsRiggingMaintenanceSchedule(existing.id, payload);
          } else {
            const created = await createSailsRiggingMaintenanceSchedule(boatId, payload);
            if (!created) {
              showToast('Could not create schedule.', 'error');
              return;
            }
          }
          await getSailsRiggingMaintenanceSchedules(boatId);
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
