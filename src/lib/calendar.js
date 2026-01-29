/**
 * Simple calendar helper utilities for BoatMatey.
 *
 * The goal is to create downloadable .ics files so that users can
 * add reminders into their device calendar (iOS, Android, desktop)
 * without needing the BoatMatey web app open.
 */

/**
 * Convert a yyyy-mm-dd style date string into an all‑day
 * DTSTART/DTEND pair in basic UTC form (yyyymmdd).
 */
function normalizeDateToIcs(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;

  // All‑day events in iCalendar use local dates without time;
  // we still normalise them as yyyymmdd strings.
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = `${year}${pad(month)}${pad(day)}`;

  // DTEND for an all‑day event is the day after DTSTART.
  const date = new Date(year, month - 1, day);
  const end = new Date(date.getTime());
  end.setDate(end.getDate() + 1);
  const endYmd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}`;

  return { start: ymd, end: endYmd };
}

/**
 * Build a minimal iCalendar (.ics) payload for a single all‑day event.
 */
export function buildIcsEvent({
  uid,
  title,
  description = '',
  date,
  url = ''
}) {
  const normalized = normalizeDateToIcs(date);
  if (!normalized) return null;

  const { start, end } = normalized;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours()
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const safeTitle = (title || 'BoatMatey reminder').replace(/\r?\n/g, ' ');
  const safeDescription = (description || '').replace(/\r?\n/g, '\\n');
  const safeUrl = (url || '').replace(/\r?\n/g, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BoatMatey//Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid || `boatmatey-${Date.now()}@local`}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${safeTitle}`,
    safeDescription ? `DESCRIPTION:${safeDescription}` : '',
    safeUrl ? `URL:${safeUrl}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);

  return lines.join('\r\n');
}

/**
 * Trigger a download of an .ics file in the browser.
 * This works on modern mobile and desktop browsers and allows
 * the user to open the file in their calendar app.
 */
export function downloadIcsFile(icsContent, filename = 'boatmatey-event.ics') {
  if (!icsContent) return;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

