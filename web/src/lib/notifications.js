/**
 * BoatMatey OS & Browser Notifications
 *
 * Mirrors PetHub+ behavior:
 * - Capacitor LocalNotifications: schedule native OS notifications (Android/iOS)
 *   that fire even when the app is closed
 * - Browser fallback: Web Notifications API + setTimeout for in-browser usage
 *
 * Notification targets are built from calendar appointments + system reminders
 * (engine warranty, next service, haul-out). Each has a reminder offset (minutes
 * before the event) that determines when the notification fires.
 */

// In-browser: scheduled timeouts (max 7 days ahead, like PetHub)
let scheduledTimeouts = [];

function stableIntId(str) {
  try {
    const s = String(str || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) & 0x7fffffff || 1;
  } catch (e) {
    return Math.floor(Math.random() * 1000000000);
  }
}

/**
 * Compute when to fire the notification (event time minus reminder offset).
 * @param item { id, title, date, time?, reminder_minutes? }
 * @returns Date or null
 */
export function getNotificationScheduleAt(item) {
  if (!item || !item.date) return null;
  const dateStr = String(item.date);
  const timeStr = (item.time && /^\d{2}:\d{2}/.test(String(item.time)))
    ? String(item.time).slice(0, 5)
    : '09:00';
  const d = new Date(dateStr + 'T' + timeStr);
  if (isNaN(d.getTime())) return null;

  const offset = typeof item.reminder_minutes === 'number'
    ? item.reminder_minutes
    : parseInt(item.reminder_minutes || '0', 10) || 0;
  if (offset > 0) {
    d.setMinutes(d.getMinutes() - offset);
  }
  return d;
}

function canUseCapacitorLocalNotifications() {
  try {
    return !!(
      typeof window !== 'undefined' &&
      window.Capacitor?.Plugins?.LocalNotifications &&
      typeof window.Capacitor.Plugins.LocalNotifications.schedule === 'function'
    );
  } catch (e) {
    return false;
  }
}

function isNative() {
  try {
    return !!(window.Capacitor?.isNativePlatform?.());
  } catch (e) {
    return false;
  }
}

function getLocalNotifications() {
  try {
    const p = window.Capacitor?.Plugins;
    return p?.LocalNotifications || p?.LocalNotification || null;
  } catch (e) {
    return null;
  }
}

async function ensurePermsAndChannel() {
  if (!isNative()) return { ok: false, reason: 'not_native' };
  const LN = getLocalNotifications();
  if (!LN) return { ok: false, reason: 'plugin_missing' };

  try {
    const perm = await LN.checkPermissions();
    const granted = perm && (perm.display === 'granted' || perm.receive === 'granted');
    if (!granted && typeof LN.requestPermissions === 'function') {
      const req = await LN.requestPermissions();
      const granted2 = req && (req.display === 'granted' || req.receive === 'granted');
      if (!granted2) return { ok: false, reason: 'not_granted' };
    }
  } catch (e) {}

  try {
    await LN.createChannel({
      id: 'boatmatey_reminders',
      name: 'BoatMatey Reminders',
      description: 'Calendar reminders for appointments, engine service, haul-out, etc.',
      importance: 5,
      visibility: 1,
      sound: 'default'
    });
  } catch (e) {}

  return { ok: true };
}

/**
 * Schedule OS-level notifications (Capacitor). Only works in native app.
 * @param items Array of { id, title, date, time?, reminder_minutes?, notes? }
 */
export async function syncOsNotifications(items) {
  window.boatmateyRemindersForOs = Array.isArray(items) ? items : [];

  if (!canUseCapacitorLocalNotifications()) return { ok: false, reason: 'plugin_unavailable' };

  const LN = getLocalNotifications();
  if (!LN) return { ok: false, reason: 'plugin_missing' };

  const ok = await ensurePermsAndChannel();
  if (!ok.ok) return ok;

  const now = new Date();
  const horizon = new Date(now.getTime());
  horizon.setMonth(horizon.getMonth() + 18);
  const MAX_ITEMS = 200;

  const toSchedule = [];
  for (const item of items) {
    const at = getNotificationScheduleAt(item);
    if (!at || at.getTime() <= now.getTime() || at.getTime() > horizon.getTime()) continue;

    const body = [item.date + (item.time ? ' ' + item.time : ''), item.notes].filter(Boolean).join(' · ');
    toSchedule.push({
      id: stableIntId(item.id || item.title + '|' + item.date),
      title: 'BoatMatey – ' + (item.title || 'Reminder'),
      body: body || item.title || '',
      schedule: { at },
      extra: { source: 'boatmatey', rid: String(item.id || ''), type: 'calendar' },
      channelId: 'boatmatey_reminders'
    });
    if (toSchedule.length >= MAX_ITEMS) break;
  }

  let pending = [];
  try {
    const p = await LN.getPending();
    pending = (p?.notifications || []).filter(n => n?.extra?.source === 'boatmatey');
  } catch (e) {}

  const desiredIds = new Set(toSchedule.map(n => n.id));
  const toCancel = pending.filter(n => !desiredIds.has(n.id)).map(n => ({ id: n.id }));
  if (toCancel.length) {
    try { await LN.cancel({ notifications: toCancel }); } catch (e) {}
  }

  if (toSchedule.length) {
    try {
      await LN.schedule({ notifications: toSchedule });
    } catch (e) {
      return { ok: false, reason: String(e?.message || e) };
    }
  }

  return { ok: true, scheduled: toSchedule.length, cancelled: toCancel.length };
}

function canUseBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function requestBrowserNotificationPermission() {
  if (!canUseBrowserNotifications()) return;
  if (Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (e) {}
  }
}

function clearScheduledTimeouts() {
  scheduledTimeouts.forEach(id => clearTimeout(id));
  scheduledTimeouts = [];
}

function showBrowserNotification(item) {
  const title = 'BoatMatey – ' + (item.title || 'Reminder');
  const body = [item.date + (item.time ? ' ' + item.time : ''), item.notes].filter(Boolean).join(' · ');
  if (canUseBrowserNotifications() && Notification.permission === 'granted') {
    try { new Notification(title, { body }); return; } catch (e) {}
  }
  alert(title + '\n\n' + body);
}

/**
 * Schedule in-browser notifications (setTimeout + Web Notifications).
 * Only schedules items due in the next 7 days.
 */
export function scheduleBrowserNotifications(items) {
  clearScheduledTimeouts();
  if (!Array.isArray(items) || !items.length) return;

  const now = new Date();
  const MAX_MS = 7 * 24 * 60 * 60 * 1000;

  items.forEach(item => {
    const at = getNotificationScheduleAt(item);
    if (!at) return;
    const diff = at.getTime() - now.getTime();
    if (diff <= 0 || diff > MAX_MS) return;

    const id = setTimeout(() => showBrowserNotification(item), diff);
    scheduledTimeouts.push(id);
  });
}

let notificationSetupDone = false;

/**
 * Lazy init: request permissions and schedule. Call when Calendar is used.
 */
export function ensureNotificationSetup(items = []) {
  if (notificationSetupDone && !items.length) return;
  notificationSetupDone = true;

  requestBrowserNotificationPermission();
  if (items.length) {
    scheduleBrowserNotifications(items);
    syncOsNotifications(items).catch(e => console.warn('[BoatMatey] OS notification sync failed:', e));
  }
}
