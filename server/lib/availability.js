'use strict';
// Weekly availability windows (in the clinician's timezone) -> concrete UTC slots for the next N days.

function tzOffsetMs(ts, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000;
}
// Wall-clock time in tz -> UTC ms (handles DST).
function zonedToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMs(guess, tz);
  t = guess - tzOffsetMs(t, tz);
  return t;
}
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const validTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const validTz = (tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };

/**
 * windows: [{weekday, start_time, end_time}], booked: Set of ISO start strings.
 * Returns ISO UTC start strings, ascending, at least `minNoticeH` hours from now.
 */
function generateSlots({ windows, timezone, sessionMinutes = 50, bufferMinutes = 10, booked = new Set(), days = 14, minNoticeH = 2, now = Date.now() }) {
  const out = [];
  const [y0, m0, d0] = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(now)).split('-').map(Number);
  const step = sessionMinutes + bufferMinutes;
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(y0, m0 - 1, d0 + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate(), wd = day.getUTCDay();
    for (const w of windows.filter((x) => x.weekday === wd)) {
      for (let t = toMin(w.start_time); t + sessionMinutes <= toMin(w.end_time); t += step) {
        const utc = zonedToUtc(y, m, d, Math.floor(t / 60), t % 60, timezone);
        const iso = new Date(utc).toISOString();
        if (utc >= now + minNoticeH * 3600_000 && !booked.has(iso)) out.push(iso);
      }
    }
  }
  return [...new Set(out)].sort();
}

module.exports = { generateSlots, zonedToUtc, validTime, validTz, toMin };
