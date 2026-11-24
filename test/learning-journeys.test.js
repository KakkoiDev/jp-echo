import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checksSummary} from "../n2-delayed.js";
import {goalDates, formatMinutes} from "../n2-study.js";
import {shortDate, longDate} from "../jlpt-goal.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const app = read("../app.js"), index = read("../index.html"), page = read("../n2-mock.html"), mock = read("../n2-mock.js");

test("dates read as the plan says them, and the first pass defaults to the day before exam week", () => {
  assert.equal(shortDate(new Date(2026, 11, 6)), "Sun 6 Dec");
  assert.equal(longDate(new Date(2026, 11, 2)), "Wednesday 2 December");
  const auto = goalDates(null, new Date(2026, 10, 24));
  assert.equal(shortDate(auto.exam), "Sun 6 Dec"); assert.equal(shortDate(auto.firstPass), "Wed 2 Dec"); assert.equal(auto.custom, false);
  const set = goalDates({exam: "2026-12-06", days: 6, started: "2026-11-24"});
  assert.equal(shortDate(set.firstPass), "Sun 29 Nov"); assert.equal(set.custom, true);
  assert.deepEqual([formatMinutes(275), formatMinutes(70), formatMinutes(360)], ["4 h 35 min", "1 h 10 min", "6 h"]);
});

test("Review's N2 card says what today's checks hold, with a denominator per kind", () => {
  assert.equal(checksSummary([{why: "missed"}, {why: "missed"}, {why: "slow"}, {why: "guessed"}, {why: "heard"}]), "5 from yesterday: 2 misses, 1 slow, 1 guess, 1 Day Radio play");
  assert.equal(checksSummary([]), "Nothing from yesterday");
});

test("Review keeps Start review as its filled button and offers N2 checks even with nothing due (J2Review)", () => {
  assert.match(index, /id="review-n2"/);
  assert.doesNotMatch(index, /id="review-exam-goal"/, "the two text links are replaced by the card");
  assert.match(app, /go\.className="button "\+\(dueCount\?"outline":"primary"\)/, "the card's Start is outlined while sentences are due");
  assert.match(app, /examLine\(\{text:t\("Exam \{exam\} · first pass by \{first\}"/);
  assert.match(app, /renderReviewN2\(due\.length\)/, "rendered on every Review home, whatever is due");
});

test("there is one goal editor: dates under each field, a no-AI note, works before any deck, before/after on change (J1Goal, J3Adjust)", () => {
  assert.equal((page.match(/id="training-form"/g) || []).length, 1);
  for (const id of ["training-exam-date", "training-window", "training-preview", "training-before", "training-after", "training-no-ai"]) assert.match(page, new RegExp('id="' + id + '"'));
  assert.match(page, /The plan works before you import any sentence deck\./);
  assert.match(page, /Past attempts stay as they are\./);
  assert.match(mock, /\$\("training-preview"\)\.hidden = !changed/);
  assert.match(mock, /\$\("training-no-ai"\)\.hidden = aiReady/);
});
