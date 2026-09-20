// What can honestly be promised without a backend.
//
// Echo has no server, so nothing can be pushed to a device. Two things still
// work, and neither needs one:
//
//   Periodic Background Sync — the browser wakes the service worker now and
//   then while the app is installed. Chromium only, installed only, and the
//   browser picks the moment, so "20:00" means the first wake after 20:00.
//
//   A check when the app is opened — everywhere else. If something was due
//   earlier today and nothing has been said yet, it is said now.
//
// Whatever happens, at most one a day, only when something is actually due,
// and never a word about streaks.

export const DEFAULT_TIME = "20:00";
export const REMINDER_TAG = "echo-due";

// The same rule as srs.js isDue, kept here so the service worker — which
// cannot import a module — has a one-line copy to match. test/reminders.test.js
// asserts the two agree.
export function isDueRecord(sentence, now = Date.now()) {
  return !sentence?.srs?.due || Date.parse(sentence.srs.due) <= now;
}

export function dueCount(sentences = [], now = Date.now()) {
  return sentences.filter(sentence => isDueRecord(sentence, now)).length;
}

export function parseTime(time = DEFAULT_TIME) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? {hours, minutes} : parseTime(DEFAULT_TIME);
}

// The moment today's reminder is due, in local time.
export function reminderMoment(time = DEFAULT_TIME, now = Date.now()) {
  const {hours, minutes} = parseTime(time);
  const moment = new Date(now);
  moment.setHours(hours, minutes, 0, 0);
  return moment.getTime();
}

export function shouldRemind({enabled = false, time = DEFAULT_TIME, lastShownAt = 0, due = 0, now = Date.now()} = {}) {
  if (!enabled || due < 1) return false;
  const moment = reminderMoment(time, now);
  if (now < moment) return false;
  return !lastShownAt || Number(lastShownAt) < moment;
}

export function reminderText(due) {
  return due === 1 ? "One sentence is due." : `${due} sentences are due.`;
}
