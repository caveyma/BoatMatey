/**
 * Calendar & Alerts Page
 *
 * Aggregates upcoming reminders such as:
 * - Engine warranty expiry dates
 * - Next service due dates
 * - (Future) next haul-out dates
 *
 * For each reminder we expose an "Add to calendar" action which downloads
 * a .ics file so the user can add it into their phone / tablet calendar
 * app without needing BoatMatey to be open.
 */

import { navigate } from '../router.js';
import { createYachtHeader } from '../components/header.js';
import { boatsStorage, enginesStorage, serviceHistoryStorage, hauloutStorage, calendarEventsStorage } from '../lib/storage.js';
import { buildIcsEvent, downloadIcsFile } from '../lib/calendar.js';

let currentBoatId = null;
let currentMonthDate = new Date();
let selectedDateStr = null;

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

function collectEngineWarrantyReminders(boatId) {
  const boat = boatsStorage.get(boatId);
  const engines = enginesStorage.getAll(boatId);
  const reminders = [];

  engines.forEach((engine) => {
    if (!engine.warranty_expiry_date) return;
    reminders.push({
      id: `engine-warranty-${engine.id}`,
      type: 'Engine warranty',
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
      }
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
    reminders.push({
      id: `service-next-${entry.id}`,
      type: 'Next service due',
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
      }
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
    reminders.push({
      id: `haulout-next-${entry.id}`,
      type: 'Next haul-out',
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
      }
    });
  });

  return reminders;
}

function buildRemindersForBoat(boatId) {
  const all = [
    ...collectEngineWarrantyReminders(boatId),
    ...collectNextServiceReminders(boatId),
    ...collectHauloutReminders(boatId)
  ];

  // Only keep ones that still have a valid date string
  const upcoming = all.filter((r) => !!r.date);

  // Sort by date ascending
  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
  return upcoming;
}

function handleAddToCalendar(reminder) {
  const ics = buildIcsEvent({
    uid: reminder.id,
    title: reminder.title,
    description: reminder.description,
    date: reminder.date
  });

  const safeBoat = (reminder.meta && reminder.meta.boatName) || 'boat';
  const filenameSafeBoat = safeBoat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'boat';
  const filename = `boatmatey-${filenameSafeBoat}-${reminder.id}.ics`;

  downloadIcsFile(ics, filename);
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
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">${dateLabel}</h3>
              <p class="text-muted">${reminder.type}</p>
            </div>
            <div>
              <button class="btn-primary calendar-add-btn" data-reminder-id="${reminder.id}">
                Add to calendar
              </button>
            </div>
          </div>
          ${reminder.description ? `<p>${reminder.description.replace(/\\n/g, '<br>')}</p>` : ''}
        </div>
      `;
    })
    .join('');

  // Attach click handlers after rendering
  document.querySelectorAll('.calendar-add-btn').forEach((btn) => {
    const id = btn.getAttribute('data-reminder-id');
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;

    btn.addEventListener('click', () => {
      handleAddToCalendar(reminder);
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

    const badges = [];
    if (activity.reminders) {
      badges.push(`<span class="calendar-badge calendar-badge-reminders">${activity.reminders}</span>`);
    }
    if (activity.appointments) {
      badges.push(`<span class="calendar-badge calendar-badge-appointments">${activity.appointments}</span>`);
    }

    const classes = ['calendar-day', 'calendar-date-cell'];
    if (isToday) classes.push('calendar-today');
    if (isSelected) classes.push('calendar-selected');

    cells.push(`
      <button
        type="button"
        class="${classes.join(' ')}"
        data-date="${iso}"
      >
        <span class="calendar-day-number">${day}</span>
        <span class="calendar-badges">${badges.join('')}</span>
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
      const metaParts = [timeLabel, recurrenceLabel].filter(Boolean).join(' • ');
      const notes = ev.notes ? `<p class="text-muted">${ev.notes}</p>` : '';
      return `
        <div class="calendar-appointment-row">
          <div class="calendar-appointment-main">
            <div class="calendar-appointment-title">${ev.title}</div>
            <div class="calendar-appointment-meta">${metaParts}</div>
            ${notes}
          </div>
          <div class="calendar-appointment-actions">
            <button type="button" class="btn-link calendar-event-export" data-event-id="${ev.id}">
              Add to calendar
            </button>
            <button type="button" class="btn-link btn-danger calendar-event-delete" data-event-id="${ev.id}">
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  // Attach handlers
  listEl.querySelectorAll('.calendar-event-export').forEach((btn) => {
    const id = btn.getAttribute('data-event-id');
    const ev = (baseEvents || []).find((e) => e.id === id);
    if (!ev) return;
    btn.addEventListener('click', () => {
      const ics = buildIcsEvent({
        uid: ev.id,
        title: ev.title,
        description: ev.notes ? `BoatMatey appointment\\n${ev.notes}` : 'BoatMatey appointment',
        date: ev.date
      });
      const safeTitle = ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'appointment';
      downloadIcsFile(ics, `boatmatey-${safeTitle}-${ev.id}.ics`);
    });
  });

  listEl.querySelectorAll('.calendar-event-delete').forEach((btn) => {
    const id = btn.getAttribute('data-event-id');
    btn.addEventListener('click', () => {
      if (!confirm('Delete this appointment?')) return;
      calendarEventsStorage.delete(id);
      const refreshedBase = calendarEventsStorage.getAll(currentBoatId);
      const reminders = buildRemindersForBoat(currentBoatId);
      renderMonthView(reminders, refreshedBase);
      renderAppointmentsForSelectedDate(refreshedBase);
    });
  });
}

export function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML =
      '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');

  const yachtHeader = createYachtHeader('Calendar & Alerts', true, () => navigate(`/boat/${currentBoatId}`));
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-calendar';

  const container = document.createElement('div');
  container.className = 'container';

  const headerBlock = document.createElement('div');
  headerBlock.className = 'page-header';
  headerBlock.innerHTML = `
    <h2>Calendar & Alerts</h2>
    <p class="text-muted">
      See upcoming reminders and add your own appointments for this boat.
      Tap a date in the calendar, add an appointment, and then use "Add to calendar"
      to send it to your phone or tablet's calendar app (Outlook, Apple Calendar, etc.).
    </p>
  `;

  const layout = document.createElement('div');
  layout.id = 'calendar-layout';
  layout.innerHTML = `
    <div class="card" id="calendar-month-card">
      <div class="card-header">
        <div class="calendar-month-header">
          <button type="button" class="btn-link" id="calendar-prev-month">&lt;</button>
          <h3 class="card-title" id="calendar-month-label"></h3>
          <button type="button" class="btn-link" id="calendar-next-month">&gt;</button>
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
        Appointments are stored with this boat and can also be exported to your device calendar.
      </p>
      <div class="form-group">
        <label>Selected date</label>
        <div id="calendar-selected-date-label" class="text-strong"></div>
      </div>
      <form id="calendar-appointment-form">
        <input type="hidden" id="calendar-appointment-date">
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
          <label for="calendar-appointment-notes">Notes</label>
          <textarea id="calendar-appointment-notes" rows="3" placeholder="Location, contact details, booking reference..."></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Save appointment</button>
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

export function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) {
    currentBoatId = boatId;
  }
  if (!currentBoatId) return;

  const reminders = buildRemindersForBoat(currentBoatId);
  const baseEvents = calendarEventsStorage.getAll(currentBoatId);

  // Initialise selected date as today
  selectedDateStr = toIsoDate(new Date());

  // Month navigation
  const prevBtn = document.getElementById('calendar-prev-month');
  const nextBtn = document.getElementById('calendar-next-month');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
      const refreshedBase = calendarEventsStorage.getAll(currentBoatId);
      renderMonthView(reminders, refreshedBase);
      renderAppointmentsForSelectedDate(refreshedBase);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
      const refreshedBase = calendarEventsStorage.getAll(currentBoatId);
      renderMonthView(reminders, refreshedBase);
      renderAppointmentsForSelectedDate(refreshedBase);
    });
  }

  // Appointment form
  const form = document.getElementById('calendar-appointment-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const dateValue = document.getElementById('calendar-appointment-date').value || selectedDateStr;
      const titleEl = document.getElementById('calendar-appointment-title');
      const timeEl = document.getElementById('calendar-appointment-time');
      const repeatEl = document.getElementById('calendar-appointment-repeat');
      const repeatUntilEl = document.getElementById('calendar-appointment-repeat-until');
      const notesEl = document.getElementById('calendar-appointment-notes');

      const title = titleEl.value.trim();
      if (!title) {
        alert('Please enter a title for the appointment.');
        return;
      }

      const event = {
        date: dateValue,
        title,
        time: timeEl.value || null,
        notes: notesEl.value || '',
        recurrence_type: repeatEl.value || 'none',
        recurrence_until: repeatUntilEl.value || null
      };

      calendarEventsStorage.save(event, currentBoatId);

      // Clear form (but keep selected date and repeat settings)
      titleEl.value = '';
      timeEl.value = '';
      notesEl.value = '';

      const updatedBase = calendarEventsStorage.getAll(currentBoatId);
      renderMonthView(reminders, updatedBase);
      renderAppointmentsForSelectedDate(updatedBase);

      // Optionally offer quick export
      if (confirm('Appointment saved. Do you also want to add it to your device calendar now?')) {
        const savedList = updatedBase.filter((e2) => e2.date === event.date && e2.title === event.title);
        const newest = savedList[savedList.length - 1] || event;
        const ics = buildIcsEvent({
          uid: newest.id,
          title: newest.title,
          description: newest.notes ? `BoatMatey appointment\\n${newest.notes}` : 'BoatMatey appointment',
          date: newest.date
        });
        const safeTitle = newest.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'appointment';
        downloadIcsFile(ics, `boatmatey-${safeTitle}-${newest.id}.ics`);
      }
    });
  }

  renderMonthView(reminders, baseEvents);
  renderAppointmentsForSelectedDate(baseEvents);
  renderRemindersList(reminders);
}

export default {
  render,
  onMount
};

