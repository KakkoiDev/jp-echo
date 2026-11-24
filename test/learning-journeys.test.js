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

test("Today is PlanSteps with one Start button; over budget, a shortened day and after the exam are states of it", () => {
  assert.match(mock, /planSteps\(plan\.steps\.map/);
  assert.match(page, /id="plan-start"/);
  assert.match(mock, /drawPlan\(base, ctx, \{title: "What stays today", primary: false\}\)/, "the overload panel holds the one filled button (J1Overload)");
  assert.match(mock, /"Keep " \+ dates\.firstPass\.getDate\(\)/);
  assert.match(mock, /Choose a later first-pass date/);
  assert.match(mock, /Moving work never deletes it\./);
  assert.match(mock, /shortenPlan\(base, state\.short\)/, "J3Short");
  assert.match(mock, /Moved to tomorrow/);
  assert.match(mock, /Your plan has stopped\. Results day is in/, "J3After");
  assert.match(mock, /Start maintenance · 15 min a day/);
  assert.match(mock, /mock attempts, each with its paper edition/);
});

test("back after a gap, Review offers Resume, Shorten today and Adjust the goal with a revised estimate (J3Return)", () => {
  assert.match(app, /gap>=3&&days>0/);
  assert.match(app, /Welcome back — last session \{date\}\./);
  assert.match(app, /First pass was \{was\} → now about \{now\}/);
  assert.match(app, /Left to check once: \{left\} of \{total\} items/);
  assert.match(app, /"\.\/n2-mock\.html\?shorten=90"/);
  assert.match(app, /Resume · today’s plan, 6 h"\),"\.\/n2-mock\.html","button "\+\(dueCount\?"outline":"primary"\)/);
});

import {evidenceFor, evidenceLine} from "../n2-delayed.js";
import {radioEvent} from "../day-radio.js";
import {recallRecord, recallId, todayPlan} from "../n2-study.js";
test("evidence keeps written and listening apart, in the copy contract's words (J2Evidence)", () => {
  const target = ["word", "就任", "しゅうにん"];
  const row = {id: recallId("meaning", target), type: "meaning", item: {target, prompt: "就任", reading: "しゅうにん", answer: "taking office"}};
  const written = recallRecord(null, row, "instant", new Date("2026-11-21T09:00:00"));
  const events = [
    radioEvent({target, kind: "exposure", source: "day-radio", mode: "listen", now: new Date("2026-11-25T09:00:00")}),
    radioEvent({target, kind: "exposure", source: "day-radio", mode: "listen", now: new Date("2026-11-25T10:00:00")}),
    radioEvent({target, kind: "recall", grade: "got", source: "delayed-check", mode: "check", detail: {context: "fresh"}, now: new Date("2026-11-26T09:00:00")}),
  ];
  const missedByEar = {target, skill: 3, answered: true, correct: false, guessed: false, at: "2026-11-24T10:00:00", paper: "n2-set-7@2026.11-r3"};
  const ev = evidenceFor(target, {recall: [written], events, evidence: [missedByEar], paperTitle: () => "Mock 07"});
  assert.deepEqual(ev.written.map(r => r.title), ["Checked once · right"]);
  assert.deepEqual(ev.listening.map(r => r.title), ["Missed in a dialogue", "Heard 2 times", "Recalled on another day · right", "Understood in a new passage"]);
  assert.deepEqual(ev.listening.map(r => r.done), [false, true, true, true]);
  const allowed = /^(Checked once|Recalled on another day|Understood in a new passage|Heard|Missed in a (dialogue|mock)|Caught by ear|Missed by ear)/;
  assert.ok([...ev.written, ...ev.listening].every(r => allowed.test(r.title)));
  assert.match(evidenceLine(target, {recall: [written], events}), /Heard 25 Nov on Day Radio\. Your written meaning record \(checked once, 21 Nov\) is unchanged\./);
});

test("a new learner's day starts with a 20-minute short sample of all four skills (J1Today)", () => {
  const goal = {goal: 150, firstToday: 0, unchecked: 1500};
  const plan = todayPlan({days: 12, goal, baseline: true, examDate: new Date(2026, 11, 6), now: new Date(2026, 10, 24, 9)});
  assert.equal(plan.steps[0].kind, "sample"); assert.equal(plan.steps[0].minutes, 20);
  assert.ok(plan.minutes <= 360);
  assert.ok(!todayPlan({days: 12, goal, examDate: new Date(2026, 11, 6), now: new Date(2026, 10, 24, 9)}).steps.some(s => s.kind === "sample"));
});

test("results: a short session shows a denominator per section; a full paper offers practising its weakest section (J1Done, J2Result)", () => {
  assert.match(mock, /got \+ " of " \+ questions\.length \+ " right"/);
  assert.match(mock, /r\.got \+ " of " \+ r\.items\.length/);
  assert.match(mock, /"Practise listening", "\?view=radio&mode=recall"/);
  assert.match(page, /id="result-next"[^>]*>Back to the plan/);
  assert.match(mock, /The line that decided it/);
});

test("Radio opens on Day and Night as equals, with a resume bar holding the one filled button (RadioEntrances)", () => {
  assert.match(index, /<span class="overline">Day or night<\/span>/);
  assert.match(index, /Day · awake listening/); assert.match(index, /Night · while you sleep/);
  assert.match(index, /Night never counts as a check\./);
  assert.match(app, /Paused · Day Radio, sentence \{n\} of \{total\}/);
  assert.match(app, /\$\("#radio-start"\)\.classList\.toggle\("primary",!paused\)/);
  assert.match(page, /Not yet \/ Got it marks this play only\. It never changes your written reading record\./);
});

test("the N2 page says what still works offline, without a voice, after a failed save and without a provider (St*)", () => {
  assert.match(mock, /You’re offline\. Everything on this page still works/);
  assert.match(mock, /Needs a connection now: Plan my day with AI · Make a practice exam/);
  assert.match(mock, /No Japanese voice on this device\./);
  assert.match(mock, /el\("div", \{class: "notice alert", role: "alert"\}/, "a failed save is the one alert");
  assert.match(mock, /Your last answer wasn’t saved\./);
  assert.match(mock, /text: "Try again"/); assert.match(mock, /text: "Back up now"/);
  assert.match(page, /role="status" id="n2-saved"/, "a saved grade is announced once");
  assert.equal((mock.match(/saveFailed\(/g) || []).length >= 4, true, "recall, checks and Day Radio all use it");
  assert.match(page, /Use the standard plan/); assert.match(mock, /Plan my day with AI needs an AI service\. The standard plan below is ready without one\./);
  assert.doesNotMatch(mock, /warn\("Could not save/);
});
