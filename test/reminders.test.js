import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_TIME, dueCount, isDueRecord, reminderMoment, reminderText, shouldRemind} from "../reminders.js";
import {isDue} from "../srs.js";

const at = (day, hour, minute = 0) => new Date(2026, 0, day, hour, minute).getTime();

test("the service worker's due rule matches srs.js", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  const cases = [
    {},
    {srs: {}},
    {srs: {due: "2026-01-09T12:00:00Z"}},
    {srs: {due: "2026-01-10T12:00:00Z"}},
    {srs: {due: "2026-01-11T12:00:00Z"}},
  ];
  for (const sentence of cases)
    assert.equal(isDueRecord(sentence, now.getTime()), isDue(sentence, now), JSON.stringify(sentence));
  assert.equal(dueCount(cases, now.getTime()), 4);
});

test("nothing is said before the chosen time", () => {
  assert.equal(shouldRemind({enabled: true, time: "20:00", due: 3, now: at(1, 19, 59)}), false);
  assert.equal(shouldRemind({enabled: true, time: "20:00", due: 3, now: at(1, 20, 0)}), true);
});

test("nothing is said when nothing is due", () => {
  assert.equal(shouldRemind({enabled: true, time: "20:00", due: 0, now: at(1, 21)}), false);
});

test("nothing is said when the toggle is off", () => {
  assert.equal(shouldRemind({enabled: false, time: "20:00", due: 3, now: at(1, 21)}), false);
});

test("at most one a day", () => {
  const spoken = at(1, 20, 1);
  assert.equal(shouldRemind({enabled: true, time: "20:00", due: 3, lastShownAt: spoken, now: at(1, 23)}), false);
  assert.equal(shouldRemind({enabled: true, time: "20:00", due: 3, lastShownAt: spoken, now: at(2, 20, 1)}), true);
});

test("opening the app late still gets the reminder", () => {
  assert.equal(shouldRemind({enabled: true, time: "08:00", due: 2, lastShownAt: at(1, 8, 5), now: at(2, 23)}), true);
});

test("a bad time falls back to the default rather than throwing", () => {
  assert.equal(reminderMoment("nonsense", at(1, 12)), reminderMoment(DEFAULT_TIME, at(1, 12)));
});

test("the reminder counts, and says nothing about streaks", () => {
  assert.equal(reminderText(1), "One sentence is due.");
  assert.equal(reminderText(7), "7 sentences are due.");
  for (const due of [1, 7]) assert.doesNotMatch(reminderText(due), /streak|day in a row|don't break/i);
});
