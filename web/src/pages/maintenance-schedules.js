import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { getBoat, getEngines } from '../lib/dataService.js';
import {
  getUnifiedMaintenanceSchedules,
  createUnifiedMaintenanceSchedule,
  updateUnifiedMaintenanceSchedule,
  deleteUnifiedMaintenanceSchedule,
  rollForwardUnifiedMaintenanceSchedule,
  backfillMaintenanceScheduleCalendarEvents
} from '../lib/maintenanceSchedules.js';
import {
  getScheduleTypesForCategory,
  getTemplateCategoriesForBoatType,
  getTemplateDefaults,
  normalizeScheduleTypeForCategory
} from '../lib/maintenanceScheduleTemplates.js';
import {
  getOsNotificationPermissionState,
  requestOsNotificationPermission,
  openOsNotificationSettings
} from '../lib/notifications.js';

let currentBoatId = null;
let currentBoat = null;
let allRows = [];
let allEngines = [];

function escapeHtml(value) {
  const d = document.createElement('div');
  d.textContent = value == null ? '' : String(value);
  return d.innerHTML;
}

function statusLabel(status) {
  if (status === 'overdue') return 'Overdue';
  if (status === 'due_soon') return 'Due soon';
  if (status === 'archived') return 'Archived';
  return 'Upcoming';
}

function statusClass(status) {
  if (status === 'overdue') return 'badge badge-error';
  if (status === 'due_soon') return 'badge badge-warning';
  if (status === 'archived') return 'badge badge-secondary';
  return 'badge badge-success';
}

function parseQueryFromHash() {
  const hash = window.location.hash || '';
  const q = hash.includes('?') ? hash.split('?')[1] : '';
  return new URLSearchParams(q);
}

function filteredRows() {
  const q = parseQueryFromHash();
  const status = q.get('status') || '';
  const category = q.get('category') || '';
  const scope = q.get('scope') || '';
  const engineId = q.get('engine') || '';
  const scheduleId = q.get('schedule') || '';
  const archived = q.get('archived') || 'active';
  return allRows.filter((row) => {
    if (archived !== 'all') {
      const shouldArchived = archived === 'only';
      if (!!row.is_archived !== shouldArchived) return false;
    }
    if (status && row.status !== status) return false;
    if (category && row.category !== category) return false;
    if (scope === 'sails-rigging') {
      if (!['Sail & Rigging', 'Winches', 'Rigging'].includes(row.category || '')) return false;
    }
    if (scope === 'engine' && (row.category || '') !== 'Engine') return false;
    if (engineId && row.linked_entity_id !== engineId) return false;
    if (scheduleId && String(row.id) !== String(scheduleId)) return false;
    return true;
  });
}

function renderFilters(container) {
  const q = parseQueryFromHash();
  const categories = [...new Set(allRows.map((r) => r.category).filter(Boolean))].sort();
  container.innerHTML = `
    <div class="list-tools">
      <select id="maintenance-filter-status" class="form-control">
        <option value="">All statuses</option>
        <option value="overdue" ${q.get('status') === 'overdue' ? 'selected' : ''}>Overdue</option>
        <option value="due_soon" ${q.get('status') === 'due_soon' ? 'selected' : ''}>Due in 30 days</option>
        <option value="upcoming" ${q.get('status') === 'upcoming' ? 'selected' : ''}>Upcoming</option>
      </select>
      <select id="maintenance-filter-category" class="form-control">
        <option value="">All categories</option>
        ${categories.map((c) => `<option value="${escapeHtml(c)}" ${q.get('category') === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <select id="maintenance-filter-archived" class="form-control">
        <option value="active" ${(!q.get('archived') || q.get('archived') === 'active') ? 'selected' : ''}>Active only</option>
        <option value="all" ${q.get('archived') === 'all' ? 'selected' : ''}>Active + archived</option>
        <option value="only" ${q.get('archived') === 'only' ? 'selected' : ''}>Archived only</option>
      </select>
    </div>
  `;
  container.querySelectorAll('select').forEach((el) => {
    el.addEventListener('change', () => {
      const params = parseQueryFromHash();
      const statusVal = container.querySelector('#maintenance-filter-status')?.value || '';
      const categoryVal = container.querySelector('#maintenance-filter-category')?.value || '';
      const archivedVal = container.querySelector('#maintenance-filter-archived')?.value || 'active';
      if (statusVal) params.set('status', statusVal); else params.delete('status');
      if (categoryVal) params.set('category', categoryVal); else params.delete('category');
      if (archivedVal && archivedVal !== 'active') params.set('archived', archivedVal); else params.delete('archived');
      const query = params.toString();
      navigate(`/boat/${currentBoatId}/maintenance-schedules${query ? `?${query}` : ''}`);
    });
  });
}

function rowMetaText(row) {
  const parts = [];
  if (row.category) parts.push(row.category);
  if (row.schedule_type) parts.push(row.schedule_type);
  if (row.linked_name) parts.push(row.linked_name);
  if (row.interval_months != null) parts.push(`Every ${row.interval_months}m`);
  if (row.interval_hours != null) parts.push(`Every ${row.interval_hours}h`);
  if (row.next_due_at) parts.push(`Due ${row.next_due_at}`);
  if (row.next_due_hours != null) parts.push(`Due at ${row.next_due_hours}h`);
  return parts.join(' · ');
}

async function toggleArchive(row, archived) {
  await updateUnifiedMaintenanceSchedule(row, { is_archived: archived });
  showToast(archived ? 'Schedule archived' : 'Schedule restored', 'info');
  await loadRows();
}

function drawSection(host, title, rows) {
  const sec = document.createElement('section');
  sec.className = 'card';
  sec.innerHTML = `<h3>${escapeHtml(title)} <span class="text-muted">(${rows.length})</span></h3>`;
  if (!rows.length) {
    sec.innerHTML += '<p class="text-muted">No items in this section.</p>';
    host.appendChild(sec);
    return;
  }
  const list = document.createElement('div');
  for (const row of rows) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '0.65rem';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <strong>${escapeHtml(row.title || 'Maintenance schedule')}</strong>
          <p class="text-muted" style="margin:0.25rem 0 0;">${escapeHtml(rowMetaText(row))}</p>
        </div>
        <span class="${statusClass(row.status)}">${statusLabel(row.status)}</span>
      </div>
      ${row.notes ? `<p style="margin:0.5rem 0 0;">${escapeHtml(row.notes)}</p>` : ''}
      <div class="form-actions" style="margin-top:0.6rem;border-top:none;padding-top:0;">
        <button type="button" class="btn-secondary js-complete">Mark completed</button>
        <button type="button" class="btn-secondary js-edit">Edit</button>
        <button type="button" class="btn-secondary js-archive">${row.is_archived ? 'Unarchive' : 'Archive'}</button>
        <button type="button" class="btn-link btn-danger js-delete">Delete</button>
      </div>
    `;
    card.querySelector('.js-complete')?.addEventListener('click', async () => {
      const doneDate = window.prompt('Completed date (YYYY-MM-DD)', fmtYmd(new Date()));
      if (!doneDate) return;
      const doneHoursRaw = window.prompt('Completed hours (optional)', row.last_completed_hours ?? '');
      const doneHours = doneHoursRaw == null || doneHoursRaw === '' ? null : Number(doneHoursRaw);
      if (row.source === 'central') {
        await rollForwardUnifiedMaintenanceSchedule(row, doneDate, Number.isFinite(doneHours) ? doneHours : null);
      } else {
        await updateUnifiedMaintenanceSchedule(row, {
          last_completed_at: doneDate,
          last_completed_hours: Number.isFinite(doneHours) ? doneHours : null
        });
      }
      showToast('Schedule rolled forward', 'success');
      await loadRows();
    });
    card.querySelector('.js-edit')?.addEventListener('click', () => openScheduleDialog(row));
    card.querySelector('.js-archive')?.addEventListener('click', () => toggleArchive(row, !row.is_archived));
    card.querySelector('.js-delete')?.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: 'Delete this schedule?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true
      });
      if (!ok) return;
      await deleteUnifiedMaintenanceSchedule(row);
      showToast('Schedule deleted', 'info');
      await loadRows();
    });
    list.appendChild(card);
  }
  sec.appendChild(list);
  host.appendChild(sec);
}

function getDefaultCategories(existingCategory = null) {
  const visible = getTemplateCategoriesForBoatType(currentBoat?.boat_type || '');
  if (existingCategory && !visible.includes(existingCategory)) {
    // Preserve editability for existing schedules in now-hidden categories.
    return [existingCategory, ...visible];
  }
  return visible;
}

function fmtYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonths(baseDate, months) {
  const d = new Date(baseDate.getTime());
  d.setMonth(d.getMonth() + Number(months || 0));
  return d;
}

function openScheduleDialog(existing = null) {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    root.className = 'modal-root';
    document.body.appendChild(root);
  }
  const e = existing || {};
  const categories = getDefaultCategories(e.category || null);
  const activeCategory = e.category || categories[0] || 'General Maintenance';
  const activeTypes = getScheduleTypesForCategory(activeCategory);
  const activeType = normalizeScheduleTypeForCategory(activeCategory, e.schedule_type || activeTypes[0] || 'Custom');
  const activeFrequency = e.frequency_mode || e.frequency_type || 'date';
  const remindDays =
    e.remind_offset_days != null && Number.isFinite(Number(e.remind_offset_days))
      ? Number(e.remind_offset_days)
      : 7;
  const remindPreset =
    remindDays === 1 ? '1' :
    remindDays === 3 ? '3' :
    remindDays === 7 ? '7' :
    remindDays === 14 ? '14' :
    remindDays === 30 ? '30' : 'custom';
  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay confirm-modal-visible';
  overlay.innerHTML = `
    <div class="confirm-modal" style="max-width: 560px;">
      <h2 class="confirm-modal-title">${existing ? 'Edit schedule' : 'Add schedule'}</h2>
      <div class="form-group">
        <label for="ms_title">Schedule title</label>
        <input id="ms_title" class="form-control" value="${escapeHtml(e.title || '')}" placeholder="e.g. Port engine annual service">
      </div>
      <div class="form-group">
        <label for="ms_category">Category</label>
        <select id="ms_category" class="form-control">
          ${categories.map((c) => `<option value="${escapeHtml(c)}" ${activeCategory === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="ms_schedule_type_wrap">
        <label for="ms_schedule_type">Schedule type</label>
        <select id="ms_schedule_type" class="form-control">
          ${activeTypes.map((t) => `<option value="${escapeHtml(t)}" ${activeType === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
        </select>
        <p id="ms_defaults_hint" class="text-muted" style="margin:0.35rem 0 0;font-size:0.85rem;display:none;">Defaults from template applied. You can edit all fields.</p>
      </div>
      <div class="form-group">
        <label for="ms_linked_engine">Linked engine (optional)</label>
        <select id="ms_linked_engine" class="form-control">
          <option value="">None</option>
          ${allEngines.map((eng) => `<option value="${escapeHtml(eng.id)}" ${e.linked_entity_id === eng.id ? 'selected' : ''}>${escapeHtml(eng.label || eng.name || 'Engine')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="ms_freq">Frequency mode</label>
        <select id="ms_freq" class="form-control">
          <option value="date" ${activeFrequency === 'date' ? 'selected' : ''}>Date only</option>
          <option value="hours" ${activeFrequency === 'hours' ? 'selected' : ''}>Hours only</option>
          <option value="date_and_hours" ${activeFrequency === 'date_and_hours' ? 'selected' : ''}>Date + hours</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="ms_interval_months">Interval months</label>
          <input type="number" id="ms_interval_months" class="form-control" min="1" value="${e.interval_months ?? ''}">
        </div>
        <div class="form-group">
          <label for="ms_interval_hours">Interval hours</label>
          <input type="number" id="ms_interval_hours" class="form-control" min="1" value="${e.interval_hours ?? ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="ms_last_date">Last completed date (optional)</label>
          <input type="date" id="ms_last_date" class="form-control" value="${escapeHtml(e.last_completed_at || '')}">
        </div>
        <div class="form-group">
          <label for="ms_last_hours">Last completed hours (optional)</label>
          <input type="number" id="ms_last_hours" class="form-control" value="${e.last_completed_hours ?? ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="ms_due_date">Next due date (optional)</label>
          <input type="date" id="ms_due_date" class="form-control" value="${escapeHtml(e.next_due_at || '')}">
        </div>
        <div class="form-group">
          <label for="ms_due_hours">Next due hours (optional)</label>
          <input type="number" id="ms_due_hours" class="form-control" value="${e.next_due_hours ?? ''}">
        </div>
      </div>
      <div class="form-group">
        <label for="ms_notes">Notes (optional)</label>
        <textarea id="ms_notes" class="form-control" rows="2">${escapeHtml(e.notes || '')}</textarea>
      </div>
      <div class="form-group">
        <h3 style="margin:0 0 0.35rem;">Reminder</h3>
        <label for="ms_remind_offset">Remind me</label>
        <select id="ms_remind_offset" class="form-control">
          <option value="1" ${remindPreset === '1' ? 'selected' : ''}>1 day before</option>
          <option value="3" ${remindPreset === '3' ? 'selected' : ''}>3 days before</option>
          <option value="7" ${remindPreset === '7' ? 'selected' : ''}>1 week before</option>
          <option value="14" ${remindPreset === '14' ? 'selected' : ''}>2 weeks before</option>
          <option value="30" ${remindPreset === '30' ? 'selected' : ''}>30 days before</option>
          <option value="custom" ${remindPreset === 'custom' ? 'selected' : ''}>Custom</option>
        </select>
      </div>
      <div class="form-group" id="ms_remind_custom_wrap" style="${remindPreset === 'custom' ? '' : 'display:none;'}">
        <label for="ms_remind_custom_days">Custom reminder (days before due)</label>
        <input type="number" id="ms_remind_custom_days" class="form-control" min="1" value="${remindPreset === 'custom' ? remindDays : ''}">
      </div>
      <div class="form-group" style="margin-top:0.25rem;">
        <label class="inline-choice">
          <input type="checkbox" id="ms_notification_enabled" ${e.notification_enabled !== false ? 'checked' : ''}>
          <span>Enable reminder notification</span>
        </label>
      </div>
      <div class="confirm-modal-actions">
        <button type="button" class="btn-link" id="ms_reset_defaults">Reset to template defaults</button>
        <button type="button" class="btn-secondary" id="ms_cancel">Cancel</button>
        <button type="button" class="btn-primary" id="ms_save">Save schedule</button>
      </div>
      <p id="ms_permission_hint" class="text-muted" style="margin-top:0.5rem;font-size:0.85rem;display:none;"></p>
      <button type="button" id="ms_permission_action" class="btn-link" style="display:none;"></button>
    </div>
  `;
  const close = () => overlay.remove();
  overlay.addEventListener('click', (evt) => { if (evt.target === overlay) close(); });
  root.appendChild(overlay);
  const dirty = {
    title: false,
    frequency: false,
    intervalMonths: false,
    intervalHours: false,
    dueDate: false,
    dueHours: false,
    reminderOffset: false
  };
  const titleEl = overlay.querySelector('#ms_title');
  const freqEl = overlay.querySelector('#ms_freq');
  const intervalMonthsEl = overlay.querySelector('#ms_interval_months');
  const intervalHoursEl = overlay.querySelector('#ms_interval_hours');
  const dueDateEl = overlay.querySelector('#ms_due_date');
  const dueHoursEl = overlay.querySelector('#ms_due_hours');
  const categoryEl = overlay.querySelector('#ms_category');
  const typeEl = overlay.querySelector('#ms_schedule_type');
  const hintEl = overlay.querySelector('#ms_defaults_hint');
  const reminderOffsetEl = overlay.querySelector('#ms_remind_offset');
  const reminderCustomWrapEl = overlay.querySelector('#ms_remind_custom_wrap');
  const reminderCustomDaysEl = overlay.querySelector('#ms_remind_custom_days');
  const notificationEnabledEl = overlay.querySelector('#ms_notification_enabled');
  const permissionHintEl = overlay.querySelector('#ms_permission_hint');
  const permissionActionEl = overlay.querySelector('#ms_permission_action');
  if (titleEl) titleEl.addEventListener('input', () => { dirty.title = true; });
  if (freqEl) freqEl.addEventListener('input', () => { dirty.frequency = true; });
  if (intervalMonthsEl) intervalMonthsEl.addEventListener('input', () => { dirty.intervalMonths = true; });
  if (intervalHoursEl) intervalHoursEl.addEventListener('input', () => { dirty.intervalHours = true; });
  if (dueDateEl) dueDateEl.addEventListener('input', () => { dirty.dueDate = true; });
  if (dueHoursEl) dueHoursEl.addEventListener('input', () => { dirty.dueHours = true; });
  if (reminderOffsetEl) reminderOffsetEl.addEventListener('input', () => { dirty.reminderOffset = true; });

  function setScheduleTypes(category, selected) {
    const types = getScheduleTypesForCategory(category);
    if (!typeEl) return;
    typeEl.innerHTML = types.map((t) => `<option value="${escapeHtml(t)}"${selected === t ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('');
  }

  function applyTemplateDefaults(force = false) {
    const category = categoryEl?.value || 'Other';
    const selectedType = typeEl?.value || 'Custom';
    const defaults = getTemplateDefaults(category, selectedType);
    if (!defaults) return;
    let applied = false;
    if ((force || !dirty.title) && titleEl && selectedType !== 'Custom') {
      titleEl.value = selectedType;
      applied = true;
    }
    if ((force || !dirty.frequency) && freqEl) {
      freqEl.value = defaults.frequency_mode;
      applied = true;
    }
    if ((force || !dirty.intervalMonths) && intervalMonthsEl) {
      intervalMonthsEl.value = defaults.interval_months == null ? '' : String(defaults.interval_months);
      applied = true;
    }
    if ((force || !dirty.intervalHours) && intervalHoursEl) {
      intervalHoursEl.value = defaults.interval_hours == null ? '' : String(defaults.interval_hours);
      applied = true;
    }
    if (!dirty.dueDate && dueDateEl) {
      dueDateEl.value =
        defaults.interval_months != null
          ? fmtYmd(addMonths(new Date(), defaults.interval_months))
          : '';
      applied = true;
    }
    if ((force || !dirty.dueHours) && dueHoursEl) {
      dueHoursEl.value = defaults.interval_hours == null ? '' : String(defaults.interval_hours);
      applied = true;
    }
    if ((force || !dirty.reminderOffset) && reminderOffsetEl) {
      const off = Number(defaults.remind_offset_days || 7);
      const preset = [1, 3, 7, 14, 30].includes(off) ? String(off) : 'custom';
      reminderOffsetEl.value = preset;
      if (reminderCustomWrapEl) reminderCustomWrapEl.style.display = preset === 'custom' ? '' : 'none';
      if (preset === 'custom' && reminderCustomDaysEl) reminderCustomDaysEl.value = String(off);
      applied = true;
    }
    if (hintEl) hintEl.style.display = applied ? '' : 'none';
  }

  categoryEl?.addEventListener('change', () => {
    setScheduleTypes(categoryEl.value || 'Other', 'Custom');
    applyTemplateDefaults();
  });
  typeEl?.addEventListener('change', async () => {
    const anyDirty = Object.values(dirty).some(Boolean);
    if (anyDirty) {
      const ok = await confirmAction({
        title: 'Apply new template defaults?',
        message: 'You already edited fields manually. Apply template defaults now?',
        confirmLabel: 'Apply'
      });
      if (!ok) return;
    }
    applyTemplateDefaults();
  });
  reminderOffsetEl?.addEventListener('change', () => {
    const isCustom = reminderOffsetEl.value === 'custom';
    if (reminderCustomWrapEl) reminderCustomWrapEl.style.display = isCustom ? '' : 'none';
  });
  overlay.querySelector('#ms_reset_defaults')?.addEventListener('click', () => applyTemplateDefaults(true));
  notificationEnabledEl?.addEventListener('change', () => {
    void updatePermissionHint();
  });
  permissionActionEl?.addEventListener('click', async () => {
    const state = await getOsNotificationPermissionState();
    if (state === 'denied') await openOsNotificationSettings();
    else await requestOsNotificationPermission();
    await updatePermissionHint();
  });

  async function updatePermissionHint() {
    if (!notificationEnabledEl?.checked) {
      if (permissionHintEl) permissionHintEl.style.display = 'none';
      if (permissionActionEl) permissionActionEl.style.display = 'none';
      return;
    }
    const state = await getOsNotificationPermissionState();
    if (state === 'granted' || state === 'unavailable') {
      if (permissionHintEl) permissionHintEl.style.display = 'none';
      if (permissionActionEl) permissionActionEl.style.display = 'none';
      return;
    }
    if (permissionHintEl) {
      permissionHintEl.style.display = '';
      permissionHintEl.textContent =
        state === 'denied'
          ? 'Notifications are enabled in this schedule, but OS permission is denied.'
          : 'Allow OS notification permission to receive reminders for this schedule.';
    }
    if (permissionActionEl) {
      permissionActionEl.style.display = '';
      permissionActionEl.textContent = state === 'denied' ? 'Open app settings' : 'Allow notifications';
    }
  }

  setScheduleTypes(activeCategory, activeType);
  void updatePermissionHint();
  overlay.querySelector('#ms_cancel')?.addEventListener('click', close);
  overlay.querySelector('#ms_save')?.addEventListener('click', async () => {
    const title = overlay.querySelector('#ms_title')?.value?.trim() || '';
    if (!title) {
      showToast('Schedule title is required.', 'error');
      return;
    }
    const remindOffsetRaw = overlay.querySelector('#ms_remind_offset')?.value || '7';
    const remindCustomDaysRaw = overlay.querySelector('#ms_remind_custom_days')?.value || '';
    let remindOffsetDays = remindOffsetRaw === 'custom' ? parseInt(remindCustomDaysRaw, 10) : parseInt(remindOffsetRaw, 10);
    if (!Number.isFinite(remindOffsetDays) || remindOffsetDays <= 0) remindOffsetDays = 7;
    const payload = {
      title,
      category: overlay.querySelector('#ms_category')?.value || 'General Maintenance',
      schedule_type: overlay.querySelector('#ms_schedule_type')?.value || 'Custom',
      linked_entity_type: overlay.querySelector('#ms_linked_engine')?.value ? 'engine' : null,
      linked_entity_id: overlay.querySelector('#ms_linked_engine')?.value || null,
      frequency_mode: overlay.querySelector('#ms_freq')?.value || 'date',
      frequency_type: overlay.querySelector('#ms_freq')?.value || 'date',
      interval_months: overlay.querySelector('#ms_interval_months')?.value || null,
      interval_hours: overlay.querySelector('#ms_interval_hours')?.value || null,
      last_completed_at: overlay.querySelector('#ms_last_date')?.value || null,
      last_completed_hours: overlay.querySelector('#ms_last_hours')?.value || null,
      next_due_at: overlay.querySelector('#ms_due_date')?.value || null,
      next_due_hours: overlay.querySelector('#ms_due_hours')?.value || null,
      remind_offset_days: remindOffsetDays,
      notification_enabled: !!overlay.querySelector('#ms_notification_enabled')?.checked,
      notes: overlay.querySelector('#ms_notes')?.value?.trim() || null,
      notification_id: e.notification_id || null,
      is_archived: !!e.is_archived
    };
    if (existing) await updateUnifiedMaintenanceSchedule(existing, payload);
    else await createUnifiedMaintenanceSchedule(currentBoatId, payload);
    close();
    await loadRows();
    showToast(existing ? 'Schedule updated' : 'Schedule added', 'success');
  });
}

function renderList() {
  const host = document.getElementById('maintenance-schedules-list');
  if (!host) return;
  host.innerHTML = '';
  const rows = filteredRows();
  const activeRows = rows.filter((r) => !r.is_archived);
  if (!activeRows.length) {
    host.innerHTML = `
      <div class="card empty-state">
        <h3>No maintenance schedules yet</h3>
        <p class="text-muted">Add your first schedule to keep track of servicing, inspections, haul-outs, and other important jobs.</p>
        <button type="button" class="btn-primary" id="maintenance-empty-add">${renderIcon('plus')} Add Schedule</button>
      </div>
    `;
    host.querySelector('#maintenance-empty-add')?.addEventListener('click', () => openScheduleDialog());
    return;
  }
  drawSection(host, 'Overdue', rows.filter((r) => r.status === 'overdue' && !r.is_archived));
  drawSection(host, 'Due in 30 days', rows.filter((r) => r.status === 'due_soon' && !r.is_archived));
  drawSection(host, 'Upcoming', rows.filter((r) => r.status === 'upcoming' && !r.is_archived));
  drawSection(host, 'Archived', rows.filter((r) => r.is_archived));
}

async function loadRows() {
  allRows = await getUnifiedMaintenanceSchedules(currentBoatId);
  const filters = document.getElementById('maintenance-schedules-filters');
  if (filters) renderFilters(filters);
  renderList();
}

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  const wrapper = document.createElement('div');
  wrapper.appendChild(createYachtHeader('Maintenance Schedules', { showSettings: true }));
  const page = document.createElement('div');
  page.className = 'page-content card-color-maintenance-schedules';
  page.appendChild(createBackButton(`/boat/${currentBoatId}`));
  const container = document.createElement('div');
  container.className = 'container';
  container.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
        <div>
          <h2 style="margin:0;">Maintenance Schedules</h2>
          <p class="text-muted" style="margin:0.25rem 0 0;">Track upcoming maintenance and reminders</p>
        </div>
        <button id="maintenance-add-btn" class="btn-primary">${renderIcon('plus')} Add Schedule</button>
      </div>
    </div>
    <div id="maintenance-schedules-filters" style="margin:0.65rem 0;"></div>
    <div id="maintenance-schedules-list"></div>
  `;
  page.appendChild(container);
  wrapper.appendChild(page);
  return wrapper;
}

async function onMount(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  currentBoat = await getBoat(currentBoatId);
  allEngines = await getEngines(currentBoatId);
  await backfillMaintenanceScheduleCalendarEvents(currentBoatId);
  document.getElementById('maintenance-add-btn')?.addEventListener('click', () => openScheduleDialog());
  await loadRows();
}

export default {
  render,
  onMount
};
