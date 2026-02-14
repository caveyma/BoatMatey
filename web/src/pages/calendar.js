/**
 * Calendar & Alerts Page
 *
 * Aggregates upcoming reminders such as:
 * - Engine warranty expiry dates
 * - Next service due dates
 * - Next haul-out dates
 *
 * Appointments and reminders trigger OS notifications (when the app is installed natively).
 */

import { navigate } from '../router.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import { boatsStorage, enginesStorage, serviceHistoryStorage, hauloutStorage, navEquipmentStorage } from '../lib/storage.js';
import { getBoats, getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../lib/dataService.js';
import { ensureNotificationSetup, syncOsNotifications, scheduleBrowserNotifications } from '../lib/notifications.js';

let allBoats = [];
let boatMap = {}; // id -> { boat_name, ... }
let currentMonthDate = new Date();
let selectedDateStr = null;
let editingEventId = null; // when set, form is in edit mode

function toIsoDate(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIsoDate(iso) {
  if (!iso) return null;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Expand recurring appointments between fromDate and toDate (inclusive).
 * Recurrence is defined on the base event via:
 * - recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
 * - recurrence_until: ISO date string (optional)
 */
function expandRecurringEvents(baseEvents, fromDate, toDate) {
  if (!Array.isArray(baseEvents) || !fromDate || !toDate) return [];

  const results = [];
  const startRange = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const endRange = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

  const addOccurrence = (base, dateObj) => {
    if (dateObj < startRange || dateObj > endRange) return;
    const iso = toIsoDate(dateObj);
    results.push({ ...base, date: iso });
  };

  baseEvents.forEach((event) => {
    const start = parseIsoDate(event.date);
    if (!start) return;

    const type = event.recurrence_type || 'none';
    const untilDate = parseIsoDate(event.recurrence_until);

    // Default recurrence horizon: 12 months from start when no explicit "until"
    const defaultEnd = new Date(start.getFullYear(), start.getMonth() + 12, start.getDate());
    const recurrenceEnd = untilDate && untilDate < defaultEnd ? untilDate : defaultEnd;
    const seriesEnd = recurrenceEnd < endRange ? recurrenceEnd : endRange;

    if (type === 'none') {
      addOccurrence(event, start);
      return;
    }

    let cursor = new Date(start.getTime());

    // Move cursor forward to the first occurrence on/after startRange
    const stepFn =
      type === 'daily'
        ? (d) => d.setDate(d.getDate() + 1)
        : type === 'weekly'
        ? (d) => d.setDate(d.getDate() + 7)
        : type === 'monthly'
        ? (d) => d.setMonth(d.getMonth() + 1)
        : (d) => d.setFullYear(d.getFullYear() + 1); // yearly

    while (cursor < startRange) {
      stepFn(cursor);
      if (cursor > seriesEnd) break;
    }

    while (cursor <= seriesEnd) {
      addOccurrence(event, cursor);
      const next = new Date(cursor.getTime());
      stepFn(next);
      cursor = next;
    }
  });

  // Ensure deterministic order
  results.sort((a, b) => new Date(a.date) - new Date(b.date));
  return results;
}

const DEFAULT_REMINDER_HAULOUT = 1440;   // 1 day
const DEFAULT_REMINDER_WARRANTY = 10080; // 1 week
const DEFAULT_REMINDER_SERVICE = 1440;   // 1 day

function collectEngineWarrantyReminders(boatId) {
  const boat = boatsStorage.get(boatId);
  const engines = enginesStorage.getAll(boatId);
  const reminders = [];

  engines.forEach((engine) => {
    if (!engine.warranty_expiry_date) return;
    const mins = engine.warranty_reminder_minutes ?? DEFAULT_REMINDER_WARRANTY;
    if (!mins || mins <= 0) return;
    reminders.push({
      id: `engine-warranty-${engine.id}`,
      boat_id: boatId,
      type: 'Engine warranty',
      editRoute: `/boat/${boatId}/engines/${engine.id}`,
      date: engine.warranty_expiry_date,
      title: `Engine warranty expiry – ${engine.label || engine.model || ''}`.trim(),
      description: [
        boat?.boat_name ? `Boat: ${boat.boat_name}` : null,
        engine.manufacturer || engine.model ? `Engine: ${[engine.manufacturer, engine.model].filter(Boolean).join(' ')}` : null,
        engine.serial_number ? `Serial: ${engine.serial_number}` : null
      ]
        .filter(Boolean)
        .join('\\n'),
      meta: {
        boatName: boat?.boat_name || '',
        engineLabel: engine.label || '',
      },
      reminder_minutes: mins
    });
  });

  return reminders;
}

function collectNextServiceReminders(boatId) {
  const boat = boatsStorage.get(boatId);
  const services = serviceHistoryStorage.getAll(boatId) || [];
  const reminders = [];

  services.forEach((entry) => {
    if (!entry.next_service_due) return;
    const mins = entry.next_service_reminder_minutes ?? DEFAULT_REMINDER_SERVICE;
    if (!mins || mins <= 0) return;
    reminders.push({
      id: `service-next-${entry.id}`,
      boat_id: boatId,
      type: 'Next service due',
      editRoute: `/boat/${boatId}/service/${entry.id}`,
      date: entry.next_service_due,
      title: `Next service due – ${entry.service_type || 'Engine service'}`,
      description: [
        boat?.boat_name ? `Boat: ${boat.boat_name}` : null,
        entry.engine_id ? `Engine ID: ${entry.engine_id}` : null,
        entry.notes ? `Notes: ${entry.notes}` : null
      ]
        .filter(Boolean)
        .join('\\n'),
      meta: {
        boatName: boat?.boat_name || '',
      },
      reminder_minutes: mins
    });
  });

  return reminders;
}

function collectHauloutReminders(boatId) {
  const boat = boatsStorage.get(boatId);
  const haulouts = hauloutStorage.getAll(boatId) || [];
  const reminders = [];

  haulouts.forEach((entry) => {
    if (!entry.next_haulout_due) return;
    const mins = entry.next_haulout_reminder_minutes ?? DEFAULT_REMINDER_HAULOUT;
    if (!mins || mins <= 0) return;
    reminders.push({
      id: `haulout-next-${entry.id}`,
      boat_id: boatId,
      type: 'Next haul-out',
      editRoute: `/boat/${boatId}/haulout/${entry.id}`,
      date: entry.next_haulout_due,
      title: 'Next haul-out due',
      description: [
        boat?.boat_name ? `Boat: ${boat.boat_name}` : null,
        entry.yard_marina ? `Preferred yard/marina: ${entry.yard_marina}` : null,
        entry.recommendations_next_haulout ? `Recommendations: ${entry.recommendations_next_haulout}` : null
      ]
        .filter(Boolean)
        .join('\\n'),
      meta: {
        boatName: boat?.boat_name || '',
      },
      reminder_minutes: mins
    });
  });

  return reminders;
}

function collectNavWarrantyReminders(boatId) {
  const boat = boatsStorage.get(boatId);
  const navItems = navEquipmentStorage.getAll(boatId);
  const reminders = [];

  navItems.forEach((item) => {
    const expiry = item.warranty_expiry_date || item.expiry_date;
    if (!expiry) return;
    const mins = item.warranty_reminder_minutes ?? DEFAULT_REMINDER_WARRANTY;
    if (!mins || mins <= 0) return;
    reminders.push({
      id: `nav-warranty-${item.id}`,
      boat_id: boatId,
      type: 'Warranty expiry',
      editRoute: `/boat/${boatId}/navigation/${item.id}`,
      date: expiry,
      title: `Warranty expiry – ${item.name || 'Navigation equipment'}`.trim(),
      description: [
        boat?.boat_name ? `Boat: ${boat.boat_name}` : null,
        item.manufacturer || item.model ? `Item: ${[item.manufacturer, item.model].filter(Boolean).join(' ')}` : null
      ]
        .filter(Boolean)
        .join('\\n'),
      meta: { boatName: boat?.boat_name || '' },
      reminder_minutes: mins
    });
  });

  return reminders;
}

function buildRemindersForBoat(boatId) {
  const all = [
    ...collectEngineWarrantyReminders(boatId),
    ...collectNextServiceReminders(boatId),
    ...collectHauloutReminders(boatId),
    ...collectNavWarrantyReminders(boatId)
  ];

  // Only keep ones that still have a valid date string
  const upcoming = all.filter((r) => !!r.date);

  // Sort by date ascending
  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
  return upcoming;
}

/**
 * Load all calendar events and reminders across all boats.
 */
async function loadAllCalendarData() {
  const boats = await getBoats();
  allBoats = boats || [];
  boatMap = {};
  allBoats.forEach((b) => {
    boatMap[b.id] = b;
  });

  const baseEvents = [];
  const reminders = [];

  for (const boat of allBoats) {
    if (!boat.id) continue;
    const events = await getCalendarEvents(boat.id);
    const withBoat = events.map((e) => ({
      ...e,
      boat_id: boat.id,
      recurrence_type: e.repeat || 'none',
      recurrence_until: e.repeat_until
    }));
    baseEvents.push(...withBoat);
    reminders.push(...buildRemindersForBoat(boat.id));
  }

  reminders.sort((a, b) => new Date(a.date) - new Date(b.date));
  baseEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  return { baseEvents, reminders };
}

/**
 * Build all notification targets from all boats (calendar events + system reminders).
 * Used by OS & browser notifications (PetHub+-style).
 */
async function buildAllNotificationTargets() {
  const boats = await getBoats();
  const targets = [];
  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth() + 18, now.getDate());

  for (const boat of boats || []) {
    const boatId = boat.id;
    if (!boatId) continue;

    const baseEvents = await getCalendarEvents(boatId);
    const mapped = baseEvents.map((e) => ({
      ...e,
      recurrence_type: e.repeat || 'none',
      recurrence_until: e.repeat_until
    }));
    const expanded = expandRecurringEvents(mapped, now, horizon);

    expanded.forEach((ev) => {
      if (ev.reminder_minutes === null || ev.reminder_minutes === 0) return;
      const mins = typeof ev.reminder_minutes === 'number' ? ev.reminder_minutes : 60;
      targets.push({
        id: ev.id,
        title: ev.title || 'Appointment',
        date: ev.date,
        time: ev.time || null,
        notes: ev.notes || null,
        reminder_minutes: mins
      });
    });

    const sysReminders = buildRemindersForBoat(boatId);
    sysReminders.forEach((r) => {
      targets.push({
        id: r.id,
        title: r.title || r.type || 'Reminder',
        date: r.date,
        time: null,
        notes: r.description || null,
        reminder_minutes: r.reminder_minutes ?? 1440
      });
    });
  }

  return targets;
}

async function syncCalendarNotifications() {
  try {
    const targets = await buildAllNotificationTargets();
    ensureNotificationSetup(targets);
    await syncOsNotifications(targets);
    scheduleBrowserNotifications(targets);
  } catch (e) {
    console.warn('[BoatMatey] Calendar notification sync failed:', e);
  }
}

function renderRemindersList(reminders) {
  const listContainer = document.getElementById('calendar-reminders-list');
  if (!listContainer) return;

  if (!reminders.length) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p>No reminders configured yet.</p>
        <p class="text-muted">
          Add engine warranty expiry dates, next service due dates, or next haul-out dates.
          They will appear here automatically.
        </p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = reminders
    .map((reminder) => {
      const dateLabel = new Date(reminder.date).toLocaleDateString();
      const editBtn = reminder.editRoute
        ? `<a href="#${reminder.editRoute}" class="btn-link">Edit</a>`
        : '';
      return `
        <div class="card calendar-reminder-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">${dateLabel}</h3>
              <p class="text-muted">${reminder.type}</p>
            </div>
            ${editBtn ? `<div class="card-actions">${editBtn}</div>` : ''}
          </div>
          ${reminder.description ? `<p>${reminder.description.replace(/\\n/g, '<br>')}</p>` : ''}
        </div>
      `;
    })
    .join('');

  listContainer.querySelectorAll('.calendar-reminder-card a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const path = link.getAttribute('href').slice(1);
      navigate(path);
    });
  });
}

function buildMonthGridData(reminders, appointments) {
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const activityByDate = {};
  reminders.forEach((r) => {
    if (!r.date) return;
    const key = r.date;
    activityByDate[key] = activityByDate[key] || { reminders: 0, appointments: 0 };
    activityByDate[key].reminders += 1;
  });
  appointments.forEach((ev) => {
    if (!ev.date) return;
    const key = ev.date;
    activityByDate[key] = activityByDate[key] || { reminders: 0, appointments: 0 };
    activityByDate[key].appointments += 1;
  });

  return { startDay, daysInMonth, activityByDate };
}

function renderMonthView(reminders, baseEvents) {
  const monthLabelEl = document.getElementById('calendar-month-label');
  const gridEl = document.getElementById('calendar-month-grid');
  if (!monthLabelEl || !gridEl) return;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  monthLabelEl.textContent = `${monthNames[currentMonthDate.getMonth()]} ${currentMonthDate.getFullYear()}`;

  const monthStart = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
  const monthEnd = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0);
  const expandedAppointments = expandRecurringEvents(baseEvents, monthStart, monthEnd);

  const { startDay, daysInMonth, activityByDate } = buildMonthGridData(reminders, expandedAppointments);
  const todayIso = toIsoDate(new Date());
  if (!selectedDateStr) {
    selectedDateStr = toIsoDate(new Date());
  }

  const cells = [];

  // Weekday headings
  const weekdayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  cells.push(
    weekdayLabels
      .map(
        (d) => `
      <div class="calendar-day calendar-heading">${d}</div>
    `
      )
      .join('')
  );

  // Empty cells before first day
  for (let i = 0; i < startDay; i++) {
    cells.push('<div class="calendar-day calendar-empty"></div>');
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), day);
    const iso = toIsoDate(dateObj);
    const activity = activityByDate[iso] || { reminders: 0, appointments: 0 };
    const isToday = iso === todayIso;
    const isSelected = iso === selectedDateStr;
    const hasActivity = (activity.reminders || 0) + (activity.appointments || 0) > 0;

    const classes = ['calendar-day', 'calendar-date-cell'];
    if (isToday) classes.push('calendar-today');
    if (isSelected) classes.push('calendar-selected');
    if (hasActivity) classes.push('calendar-has-activity');

    cells.push(`
      <button
        type="button"
        class="${classes.join(' ')}"
        data-date="${iso}"
      >
        <span class="calendar-day-number">${day}</span>
      </button>
    `);
  }

  gridEl.innerHTML = cells.join('');

  gridEl.querySelectorAll('.calendar-date-cell').forEach((btn) => {
    btn.addEventListener('click', () => {
      const iso = btn.getAttribute('data-date');
      if (!iso) return;
      selectedDateStr = iso;
      renderMonthView(reminders, baseEvents);
      renderAppointmentsForSelectedDate(baseEvents);
    });
  });
}

function renderAppointmentsForSelectedDate(baseEvents) {
  const listEl = document.getElementById('calendar-appointments-list');
  const dateLabelEl = document.getElementById('calendar-selected-date-label');
  const dateInputEl = document.getElementById('calendar-appointment-date');
  if (!listEl || !dateLabelEl || !dateInputEl) return;

  if (!selectedDateStr) {
    selectedDateStr = toIsoDate(new Date());
  }

  const displayDate = new Date(selectedDateStr);
  dateLabelEl.textContent = displayDate.toLocaleDateString();
  dateInputEl.value = selectedDateStr;
  const dayStart = displayDate;
  const dayEnd = displayDate;
  const expandedForDay = expandRecurringEvents(baseEvents || [], dayStart, dayEnd);
  const events = expandedForDay.filter((ev) => ev.date === selectedDateStr);

  if (!events.length) {
    listEl.innerHTML = '<p class="text-muted">No appointments for this day yet.</p>';
    return;
  }

  const recurrenceLabels = {
    daily: 'Repeats daily',
    weekly: 'Repeats weekly',
    monthly: 'Repeats monthly',
    yearly: 'Repeats yearly'
  };

  listEl.innerHTML = events
    .map((ev) => {
      const timeLabel = ev.time || 'All day';
      const recurrenceType = ev.recurrence_type && ev.recurrence_type !== 'none' ? ev.recurrence_type : null;
      const recurrenceLabel = recurrenceType ? recurrenceLabels[recurrenceType] || '' : '';
      const boatLabel = ev.boat_id && boatMap[ev.boat_id] ? boatMap[ev.boat_id].boat_name : '';
      const metaParts = [boatLabel, timeLabel, recurrenceLabel].filter(Boolean).join(' • ');
      const notes = ev.notes ? `<p class="text-muted">${ev.notes}</p>` : '';
      return `
        <div class="calendar-appointment-row">
          <div class="calendar-appointment-main">
            <div class="calendar-appointment-title">${ev.title}</div>
            <div class="calendar-appointment-meta">${metaParts}</div>
            ${notes}
          </div>
          <div class="calendar-appointment-actions">
            <button type="button" class="btn-link calendar-event-edit" data-event-id="${ev.id}">Edit</button>
            <button type="button" class="btn-link btn-danger calendar-event-delete" data-event-id="${ev.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');

  listEl.querySelectorAll('.calendar-event-edit').forEach((btn) => {
    const id = btn.getAttribute('data-event-id');
    btn.addEventListener('click', () => {
      const ev = (baseEvents || []).find((e) => e.id === id);
      if (!ev) return;
      populateFormForEdit(ev);
    });
  });

  listEl.querySelectorAll('.calendar-event-delete').forEach((btn) => {
    const id = btn.getAttribute('data-event-id');
    btn.addEventListener('click', async () => {
      const ok = await confirmAction({ title: 'Delete this appointment?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
      if (!ok) return;
      await deleteCalendarEvent(id);
      editingEventId = null;
      resetFormToAddMode();
      const { baseEvents: refreshedBase, reminders } = await loadAllCalendarData();
      renderMonthView(reminders, refreshedBase);
      renderAppointmentsForSelectedDate(refreshedBase);
      syncCalendarNotifications();
    });
  });
}

function populateFormForEdit(ev) {
  editingEventId = ev.id;
  document.getElementById('calendar-appointment-date').value = ev.date || selectedDateStr;
  document.getElementById('calendar-appointment-boat').value = ev.boat_id || '';
  document.getElementById('calendar-appointment-title').value = ev.title || '';
  document.getElementById('calendar-appointment-time').value = ev.time ? ev.time.slice(0, 5) : '';
  document.getElementById('calendar-appointment-repeat').value = ev.repeat || ev.recurrence_type || 'none';
  document.getElementById('calendar-appointment-repeat-until').value = ev.repeat_until || ev.recurrence_until || '';
  document.getElementById('calendar-appointment-reminder').value = ev.reminder_minutes != null ? String(ev.reminder_minutes) : '';
  document.getElementById('calendar-appointment-notes').value = ev.notes || '';
  const submitBtn = document.querySelector('#calendar-appointment-form button[type="submit"]');
  const cancelBtn = document.getElementById('calendar-appointment-cancel');
  if (submitBtn) submitBtn.textContent = 'Update appointment';
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function resetFormToAddMode() {
  editingEventId = null;
  document.getElementById('calendar-appointment-title').value = '';
  document.getElementById('calendar-appointment-time').value = '';
  document.getElementById('calendar-appointment-repeat').value = 'none';
  document.getElementById('calendar-appointment-repeat-until').value = '';
  document.getElementById('calendar-appointment-reminder').value = '';
  document.getElementById('calendar-appointment-notes').value = '';
  const submitBtn = document.querySelector('#calendar-appointment-form button[type="submit"]');
  const cancelBtn = document.getElementById('calendar-appointment-cancel');
  if (submitBtn) submitBtn.textContent = 'Save appointment';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

export function render(params = {}) {
  const wrapper = document.createElement('div');

  const yachtHeader = createYachtHeader('Calendar & Alerts');
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-calendar';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  const headerBlock = document.createElement('div');
  headerBlock.className = 'page-header';
  headerBlock.innerHTML = `
    <h2>Calendar & Alerts</h2>
    <p class="text-muted">
      See reminders from all your boats and add appointments. Choose which boat each appointment belongs to.
    </p>
  `;

  const layout = document.createElement('div');
  layout.id = 'calendar-layout';
  layout.innerHTML = `
    <div class="card" id="calendar-month-card">
      <div class="card-header">
        <div class="calendar-month-header">
          <button type="button" class="btn-link" id="calendar-prev-month" aria-label="Previous month">&lt; Prev</button>
          <h3 class="card-title" id="calendar-month-label"></h3>
          <button type="button" class="btn-link" id="calendar-next-month" aria-label="Next month">Next &gt;</button>
          <button type="button" class="btn-secondary" id="calendar-today" style="margin-left: auto;">Today</button>
        </div>
      </div>
      <div
        id="calendar-month-grid"
        class="calendar-month-grid"
        style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:0.25rem;"
      ></div>
    </div>

    <div class="card" id="calendar-appointment-card">
      <h3>Appointments</h3>
      <p class="text-muted">
        Add appointments and choose which boat they belong to. Set a reminder to get notified.
      </p>
      <div class="form-group">
        <label>Selected date</label>
        <div id="calendar-selected-date-label" class="text-strong"></div>
      </div>
      <form id="calendar-appointment-form">
        <input type="hidden" id="calendar-appointment-date">
        <div class="form-group" id="calendar-boat-select-wrap">
          <label for="calendar-appointment-boat">Boat *</label>
          <select id="calendar-appointment-boat" required>
            <option value="">Select a boat</option>
          </select>
        </div>
        <div class="form-group">
          <label for="calendar-appointment-title">Title *</label>
          <input type="text" id="calendar-appointment-title" required placeholder="e.g. Engine service booking">
        </div>
        <div class="form-group">
          <label for="calendar-appointment-time">Time (optional)</label>
          <input type="time" id="calendar-appointment-time">
        </div>
        <div class="form-group">
          <label for="calendar-appointment-repeat">Repeat</label>
          <select id="calendar-appointment-repeat">
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div class="form-group">
          <label for="calendar-appointment-repeat-until">Repeat until (optional)</label>
          <input type="date" id="calendar-appointment-repeat-until">
          <p class="text-muted">If left blank, the repeat continues for up to the next 12 months.</p>
        </div>
        <div class="form-group">
          <label for="calendar-appointment-reminder">Reminder</label>
          <select id="calendar-appointment-reminder">
            <option value="">None</option>
            <option value="5">5 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="120">2 hours before</option>
            <option value="1440">1 day before</option>
            <option value="2880">2 days before</option>
            <option value="10080">1 week before</option>
          </select>
          <p class="text-muted">You will receive a notification at this time before the appointment.</p>
        </div>
        <div class="form-group">
          <label for="calendar-appointment-notes">Notes</label>
          <textarea id="calendar-appointment-notes" rows="3" placeholder="Location, contact details, booking reference..."></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Save appointment</button>
          <button type="button" class="btn-link" id="calendar-appointment-cancel" style="display: none; margin-left: 0.5rem;">Cancel</button>
        </div>
      </form>
      <div class="form-group" style="margin-top:1rem;">
        <h4>Appointments for selected day</h4>
        <div id="calendar-appointments-list"></div>
      </div>
    </div>
  `;

  const listContainer = document.createElement('div');
  listContainer.id = 'calendar-reminders-list';

  container.appendChild(headerBlock);
  container.appendChild(layout);
  container.appendChild(listContainer);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

export async function onMount(params = {}) {
  const { baseEvents, reminders } = await loadAllCalendarData();

  selectedDateStr = toIsoDate(new Date());

  const boatSelect = document.getElementById('calendar-appointment-boat');
  const boatWrap = document.getElementById('calendar-boat-select-wrap');
  const activeBoats = allBoats.filter((b) => (b.status || 'active') === 'active');
  if (boatSelect && boatWrap) {
    boatSelect.innerHTML = '<option value="">Select a boat</option>';
    activeBoats.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.boat_name || 'Unnamed Boat';
      boatSelect.appendChild(opt);
    });
    if (activeBoats.length === 0) {
      boatWrap.style.opacity = '0.6';
      boatSelect.disabled = true;
    }
  }

  const prevBtn = document.getElementById('calendar-prev-month');
  const nextBtn = document.getElementById('calendar-next-month');
  if (prevBtn) {
    prevBtn.addEventListener('click', async () => {
      currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
      const { baseEvents: refreshedBase, reminders: refreshedReminders } = await loadAllCalendarData();
      renderMonthView(refreshedReminders, refreshedBase);
      renderAppointmentsForSelectedDate(refreshedBase);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
      const { baseEvents: refreshedBase, reminders: refreshedReminders } = await loadAllCalendarData();
      renderMonthView(refreshedReminders, refreshedBase);
      renderAppointmentsForSelectedDate(refreshedBase);
    });
  }
  const todayBtn = document.getElementById('calendar-today');
  if (todayBtn) {
    todayBtn.addEventListener('click', async () => {
      const now = new Date();
      currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
      selectedDateStr = toIsoDate(now);
      const { baseEvents: refreshedBase, reminders: refreshedReminders } = await loadAllCalendarData();
      renderMonthView(refreshedReminders, refreshedBase);
      renderAppointmentsForSelectedDate(refreshedBase);
    });
  }

  const form = document.getElementById('calendar-appointment-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const boatId = document.getElementById('calendar-appointment-boat')?.value;
      if (!boatId && activeBoats.length > 0 && !editingEventId) {
        showToast('Please select a boat for this appointment.', 'error');
        return;
      }
      if (activeBoats.length === 0 && !editingEventId) {
        showToast('Add a boat first to create appointments.', 'error');
        return;
      }
      const dateValue = document.getElementById('calendar-appointment-date').value || selectedDateStr;
      const titleEl = document.getElementById('calendar-appointment-title');
      const timeEl = document.getElementById('calendar-appointment-time');
      const repeatEl = document.getElementById('calendar-appointment-repeat');
      const repeatUntilEl = document.getElementById('calendar-appointment-repeat-until');
      const reminderEl = document.getElementById('calendar-appointment-reminder');
      const notesEl = document.getElementById('calendar-appointment-notes');
      const title = titleEl.value.trim();
      if (!title) {
        showToast('Please enter a title for the appointment.', 'error');
        return;
      }
      setSaveButtonLoading(form, true, 'Save appointment');
      try {

      const reminderVal = reminderEl?.value ? parseInt(reminderEl.value, 10) : null;

      const payload = {
        date: dateValue,
        title,
        time: timeEl.value || null,
        notes: notesEl.value || '',
        repeat: repeatEl.value === 'none' ? null : repeatEl.value,
        repeat_until: repeatUntilEl.value || null,
        reminder_minutes: Number.isFinite(reminderVal) ? reminderVal : null
      };

      if (editingEventId) {
        await updateCalendarEvent(editingEventId, payload);
        editingEventId = null;
        resetFormToAddMode();
      } else {
        const created = await createCalendarEvent(boatId, payload);
      }

      const { baseEvents: updatedBase, reminders: updatedReminders } = await loadAllCalendarData();
      renderMonthView(updatedReminders, updatedBase);
      renderAppointmentsForSelectedDate(updatedBase);
      syncCalendarNotifications();
      } finally {
        setSaveButtonLoading(form, false, 'Save appointment');
      }
    });
  }

  const cancelBtn = document.getElementById('calendar-appointment-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      editingEventId = null;
      resetFormToAddMode();
    });
  }

  renderMonthView(reminders, baseEvents);
  renderAppointmentsForSelectedDate(baseEvents);
  renderRemindersList(reminders);

  setTimeout(() => syncCalendarNotifications(), 400);
}

export default {
  render,
  onMount
};

