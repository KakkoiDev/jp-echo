import {drillExposure} from "./n2-comprehension.js";
import {parseGoalDate, firstPassEnd} from "./jlpt-goal.js";
// N2 study logic with no DOM: the exam calendar, section estimates, the recall
// queue and the daily goal. n2-mock.js renders it; test/n2-study.test.js holds it.

export const SKILLS = ["Vocabulary", "Grammar", "Reading", "Listening"];
export const SKILL_JA = ["文字・語彙", "文法", "読解", "聴解"];

// JLPT reports N2 as three sections of 0–60. A pass needs 90 of 180 and at
// least 19 in every section. Echo's estimate is the raw share times 60: the
// real test equates scores across sittings, so this is a practice signal only.
export const SECTIONS = [
  {key: "knowledge", ja: "言語知識", en: "Vocabulary · grammar", skills: [0, 1]},
  {key: "reading", ja: "読解", en: "Reading", skills: [2]},
  {key: "listening", ja: "聴解", en: "Listening", skills: [3]},
];
export const PASS_TOTAL = 90, SECTION_MIN = 19, SECTION_MAX = 60;

export const localDay = (date = new Date()) => date.toLocaleDateString("en-CA");

// The hub's head line. With no saved goal the countdown still runs to the next
// standard exam date, so the head names that date rather than "no date".
// Results' practice action names what it opens (bug handoff 25 Nov, #5).
// `rates` is the share right per skill (0 vocabulary … 3 listening) on this
// attempt. Reading and listening open a timed section of that skill from an
// unsat set; language knowledge opens the weak recall queue of whichever of
// words or grammar went worse. Without a scored section, the label says
// what the fallback is.
export function resultPractice(rates = []) {
  const scored = SECTIONS.map(s => {
    const rows = s.skills.filter(k => rates[k]?.n);
    const got = rows.reduce((t, k) => t + rates[k].got, 0), n = rows.reduce((t, k) => t + rates[k].n, 0);
    return {...s, rate: n ? got / n : null};
  }).filter(s => s.rate != null);
  const weakest = scored.sort((a, b) => a.rate - b.rate)[0];
  if (!weakest) return {label: "Recall weak words and grammar", href: "?view=recall&queue=weak"};
  if (weakest.key === "reading") return {label: "Practise reading · a timed 読解 section", section: "reading"};
  if (weakest.key === "listening") return {label: "Practise listening · a timed 聴解 section", section: "listening"};
  const rate = k => rates[k]?.n ? rates[k].got / rates[k].n : 1;
  return rate(1) < rate(0) ? {label: "Recall weak grammar · 文法", href: "?view=recall&type=grammar&queue=weak"}
    : {label: "Recall weak words · 文字・語彙", href: "?view=recall&type=meaning&queue=weak"};
}

// An attempt takes answers, moves and exposure only while a timed section is
// running and not paused (bug handoff 25 Nov, #1): a paused question is
// hidden, so nothing may change it until Resume.
export const answering = state => (state?.phase === "written" || state?.phase === "listening") && !state.pausedAt;

export function examHeadLine({saved, exam, firstPass, format}) {
  return "Exam " + format(exam) + (saved ? " · first pass " + format(firstPass) : "");
}

// The Next card's overline: "Next · step 2 of 6 · 20 min".
export function nextKicker(index, count, minutes) {
  return "Next · step " + (index + 1) + " of " + count + (minutes ? " · " + formatMinutes(minutes) : "");
}

// One reason, matching sprintCheckpoint's latest-two rule (bug handoff
// 25 Nov, #4): two passes on one date are not "2 of 2", and a pass older
// than seven days has already left `recent`.
export function checkpointLine(checkpoint) {
  if (checkpoint.met) return "Both done.";
  const [a, b] = checkpoint.recent;
  if (a?.meets && b?.meets && a.day === b.day) return "Both scores cleared the floor on the same day. Take a fresh mock on another day.";
  return checkpoint.recent.filter(r => r.meets).length + " of 2 in the last seven days.";
}

// A mock tile's state: in progress, over or below the pass line on its best
// run, held back for unseen-passage mocks, or not taken.
export function mockTileState({live = false, best = null, held = false} = {}) {
  if (live) return "live";
  if (best) return best.pass ? "over" : "below";
  return held ? "held" : "new";
}

// History kinds: a whole mock, a timed section, or a drill.
export function historyKind(book, paper) {
  if (!String(book || "").startsWith("adaptive-")) return "exam";
  return paper?.drill && !paper.drill.tag ? "section" : "drill";
}

// The JLPT in Japan sits on the first Sunday of July and of December.
function firstSunday(year, month) {
  const day = new Date(year, month, 1);
  day.setDate(1 + (7 - day.getDay()) % 7);
  return day;
}
export function nextExamDate(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let year = today.getFullYear(); ; year++) {
    for (const month of [6, 11]) {
      const exam = firstSunday(year, month);
      if (exam >= today) return exam;
    }
  }
}
export function daysUntil(date, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date - today) / 86_400_000);
}

// Which skills have closed: the written part once the learner leaves it, the
// listening part only with the results.
export function closedSkills(phase) {
  if (phase === "results") return [0, 1, 2, 3];
  if (phase === "rest" || phase === "listening") return [0, 1, 2];
  return [];
}
// The other levels (jlpt.jp; datasets/jlpt/exam-profiles.json). N3 and N1
// report three sections of 60 like N2; N4 and N5 report two: 言語知識・読解
// out of 120 (minimum 38) and 聴解 out of 60 (minimum 19). minutes: the
// standard clocks, written (vocabulary, grammar and reading together) and
// listening. Echo's exam screen sits the written part on one clock: on the
// real N3, N4 and N5 papers vocabulary has a clock of its own.
const TWO = [
  {key: "knowledge-reading", ja: "言語知識・読解", en: "Vocabulary · grammar · reading", skills: [0, 1, 2], max: 120, min: 38},
  {key: "listening", ja: "聴解", en: "Listening", skills: [3], max: 60, min: 19},
];
const THREE = SECTIONS.map(s => ({...s, max: SECTION_MAX, min: SECTION_MIN}));
export const LEVEL_EXAM = Object.freeze({
  N5: {pass: 80, sections: TWO, minutes: {written: 60, listening: 30}},
  N4: {pass: 90, sections: TWO, minutes: {written: 80, listening: 35}},
  N3: {pass: 95, sections: THREE, minutes: {written: 100, listening: 40}},
  N2: {pass: PASS_TOTAL, sections: SECTIONS, minutes: {written: 105, listening: 50}},
  N1: {pass: 100, sections: THREE, minutes: {written: 110, listening: 55}},
});
// A paper names its level; one without a level is N2, scored as it always was.
export const examOf = paper => LEVEL_EXAM[paper?.level] || LEVEL_EXAM.N2;
export function estimate(paper, attempt) {
  const closed = closedSkills(attempt.phase), exam = examOf(paper);
  const sections = exam.sections.map(section => {
    const items = paper.questions.filter(q => section.skills.includes(q.skill));
    const correct = items.filter(q => attempt.answers[q.index] === q.key).length;
    const open = !items.length || !section.skills.every(s => closed.includes(s) || !items.some(q => q.skill === s));
    const max = section.max ?? SECTION_MAX, min = section.min ?? SECTION_MIN;
    const scaled = items.length ? Math.round(correct / items.length * max) : null;
    return {...section, correct, total: items.length, scaled: open ? null : scaled, ok: open ? null : scaled >= min};
  });
  const scoredSections = sections.filter(s => s.scaled !== null);
  const complete = scoredSections.length === exam.sections.length;
  const total = scoredSections.reduce((sum, s) => sum + s.scaled, 0);
  return {sections, total, complete, pass: complete ? total >= exam.pass && sections.every(s => s.ok) : null, ...(paper?.level && paper.level !== "N2" ? {passTotal: exam.pass, level: paper.level} : {})};
}

// Every finished full exam, oldest first, for the score chart: estimated
// total against the pass line (a score, never a pass probability). Sections
// and drills never score all three sections, so they are left out.
export function scoreSeries(attempts = [], papers = new Map()) {
  return attempts.filter(a => a.phase === "results" && !a.boss && papers.get(a.paper || a.book))
    .map(a => ({a, e: estimate(papers.get(a.paper || a.book), a)}))
    .filter(({e}) => e.complete)
    .sort((x, y) => String(x.a.completedAt || "").localeCompare(String(y.a.completedAt || "")))
    .map(({a, e}) => ({at: a.completedAt || "", value: e.total, ok: !!e.pass, book: a.book}));
}
export function scoreCaption(series = []) {
  if (!series.length) return "";
  const last = series.at(-1), passed = series.filter(p => p.ok).length;
  return series.length + (series.length === 1 ? " finished exam" : " finished exams") + " · last " + last.value + " / 180 · " + passed + " at or over the pass line with every section's minimum";
}

// The three recall decks. A target is the stable identity shared with exam
// questions, so a mock miss and a self-check talk about the same thing.
export function recallItems(inventory) {
  return {
    meaning: inventory.words.map(([w, r, m]) => ({target: ["word", w, r], prompt: w, reading: r, answer: m})),
    reading: inventory.words.filter(([w, r]) => w !== r).map(([w, r, m]) => ({target: ["word", w, r], prompt: w, reading: r, answer: m})),
    grammar: grammarItems(inventory.grammar),
  };
}
// A pattern with two meanings is listed twice (一応 ①, 一応 ②). The prompt is
// the pattern alone; sense/senses say which meaning, and the example sentence
// shows it in use.
const SENSE = /\s*([①-⑨])\s*$/;
function grammarItems(grammar) {
  const base = name => name.replace(SENSE, "");
  const count = new Map();
  for (const [, name] of grammar) if (SENSE.test(name)) count.set(base(name), (count.get(base(name)) || 0) + 1);
  return grammar.map(([id, name, hint]) => {
    const m = SENSE.exec(name), senses = m ? Math.max(count.get(base(name)), "①②③④⑤⑥⑦⑧⑨".indexOf(m[1]) + 1) : 0;
    return {target: ["grammar", id], prompt: base(name), answer: hint, ...(senses > 1 ? {sense: "①②③④⑤⑥⑦⑧⑨".indexOf(m[1]) + 1, senses} : {})};
  });
}
export const recallId = (type, target) => JSON.stringify([type, ...target]);
function evidenceFits(type, row) {
  if (!row.target || !row.answered || row.skill === 3) return false;
  return type === "grammar" ? row.target[0] === "grammar" : row.target[0] === "word" && row.dimension === type;
}

// The newest event decides. An old mock miss no longer makes a target weak
// once a later self-check or exam answer came back clean, and the reverse.
export function weakTargets(type, recall, evidence) {
  const latest = new Map();
  const see = (key, at, weak) => {
    const last = latest.get(key);
    if (!last || (at || "") >= (last.at || "")) latest.set(key, {at: at || "", weak});
  };
  for (const row of evidence) if (evidenceFits(type, row)) see(JSON.stringify(row.target), row.at, !row.correct || row.guessed);
  for (const r of recall) if (r.dimension === type) {
    const events = r.events?.length ? r.events : [{at: r.updatedAt, grade: r.last}];
    for (const e of events) see(JSON.stringify(r.target), e.at, e.grade !== "instant");
  }
  return latest;
}

// Priority: weak first, then never checked, then checked once, then items
// already recalled instantly on two days. Today's checks wait for tomorrow.
export function recallQueue({type, filter = "daily", inventory, recall = [], evidence = [], today = localDay(), size = 20}) {
  const records = new Map(recall.filter(r => r.dimension === type).map(r => [r.id, r]));
  const status = weakTargets(type, recall, evidence);
  const rows = [], later = [];
  recallItems(inventory)[type].forEach((item, order) => {
    const id = recallId(type, item.target), r = records.get(id);
    const weak = !!status.get(JSON.stringify(item.target))?.weak;
    if (filter === "weak" && !weak) return;
    if (filter === "new" && r) return;
    const priority = weak ? 0 : !r ? 1 : r.days?.length >= 2 && r.last === "instant" ? 3 : 2;
    const row = {item, id, r, type, weak, priority, order, last: status.get(JSON.stringify(item.target))?.at || ""};
    (r?.day === today && filter !== "weak" ? later : rows).push(row);
  });
  const order = (a, b) => a.priority - b.priority || (a.priority === 1 ? a.order - b.order : a.last.localeCompare(b.last));
  rows.sort(order);
  return (rows.length ? rows : later.sort(order)).slice(0, size);
}

// detail travels on the event: source, modality, context, assistance and
// active time (activeMs) when the screen measured them.
export function recallRecord(previous, {id, type, item}, grade, now = new Date(), detail = {}) {
  const day = localDay(now);
  return {id, target: item.target, dimension: type, prompt: item.prompt, answer: item.answer, last: grade, day,
    updatedAt: now.toISOString(), checks: (previous?.checks || 0) + 1,
    days: grade === "instant" ? [...new Set([...(previous?.days || []), day])] : [],
    events: [...(previous?.events || []), {at: now.toISOString(), grade, ...detail}]};
}

// Reserve the last three pre-exam days for consolidation.
const CONSOLIDATION_DAYS = 3;
export function dailyGoal({inventory, recall = [], examDate, firstPassDate, now = new Date()}) {
  const today = localDay(now);
  const types = ["meaning", "grammar"];
  const total = inventory.words.length + inventory.grammar.length;
  const mine = recall.filter(r => types.includes(r.dimension));
  const firstToday = mine.filter(r => localDay(new Date(r.events?.[0]?.at || r.updatedAt)) === today).length;
  const checkedToday = recall.filter(r => (r.events || []).some(e => localDay(new Date(e.at)) === today)).length;
  const unchecked = total - mine.length;
  const daysLeft = Math.max(0, firstPassDate ? daysUntil(firstPassDate, now) + 1 : daysUntil(examDate, now) - CONSOLIDATION_DAYS);
  return {goal: daysLeft ? Math.ceil((unchecked + firstToday) / daysLeft) : 0, firstToday, checkedToday, unchecked, daysLeft, total};
}

export function coverage(inventory, recall, evidence) {
  const items = recallItems(inventory);
  return Object.fromEntries(Object.entries(items).map(([type, list]) => {
    const records = recall.filter(r => r.dimension === type);
    const latest = weakTargets(type, recall, evidence);
    const automatic = records.filter(r => r.days?.length >= 2 && r.last === "instant" && !latest.get(JSON.stringify(r.target))?.weak).length;
    const weak = [...latest.values()].filter(v => v.weak).length;
    return [type, {total: list.length, checked: records.length, automatic, weak}];
  }));
}

// Six hours a day, breaks included: the learner's budget before the exam.
export const DAY_MINUTES = 360;
// Seconds per recall check until the learner's own pace is measured.
export const DEFAULT_PACE = 36;
// Median active seconds per recall check over the last week, from checks
// whose screen measured it (activeMs); null until there are enough.
export function measuredPace(recall = [], now = new Date(), {min = 15} = {}) {
  const since = now.getTime() - 7 * 86_400_000;
  const ms = recall.flatMap(r => r.events || []).filter(e => e.activeMs > 0 && e.activeMs < 180_000 && Date.parse(e.at) >= since).map(e => e.activeMs).sort((a, b) => a - b);
  if (ms.length < min) return null;
  return Math.min(120, Math.max(8, Math.round(ms[Math.floor(ms.length / 2)] / 1000)));
}

// Minutes per block. A regular day and a mock day both fill six hours,
// breaks included; minutes a block does not need roll to the next one.
export const BUDGET = Object.freeze({
  regular: Object.freeze({check: 35, first: 95, reading: 55, listening: 50, targeted: 55, radio: 30, breaks: 40}),
  mock: Object.freeze({check: 35, mock: 155, review: 50, first: 65, radio: 15, breaks: 40}),
});
const firstCapacity = (minutes, pace) => Math.floor(minutes * 60 / pace);
const dayAfter = (now, n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);

// When first checks finish at the learner's pace. todayLeft is what still
// fits today; later days average two regular days and a mock day.
// A custom first-pass end (the training goal) replaces the default cut-off.
export function firstCheckForecast({unchecked, todayLeft = 0, pace = DEFAULT_PACE, examDate, firstPassDate = null, now = new Date()}) {
  const daysLeft = Math.max(0, firstPassDate ? daysUntil(firstPassDate, now) + 1 : daysUntil(examDate, now) - CONSOLIDATION_DAYS);
  const lastDay = firstPassDate ? new Date(firstPassDate.getFullYear(), firstPassDate.getMonth(), firstPassDate.getDate())
    : new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate() - CONSOLIDATION_DAYS - 1);
  const perDay = Math.round((2 * firstCapacity(BUDGET.regular.first, pace) + firstCapacity(BUDGET.mock.first, pace)) / 3);
  if (!unchecked) return {done: true, finish: null, spill: 0, perDay, lastDay, daysLeft, onTime: true};
  const after = Math.max(0, unchecked - todayLeft);
  const finish = dayAfter(now, after ? Math.ceil(after / perDay) : 0);
  const spill = Math.max(0, after - perDay * Math.max(0, daysLeft - 1));
  return {done: false, finish, spill, perDay, lastDay, daysLeft, onTime: !!daysLeft && finish <= lastDay};
}

// Trim a plan to the day's budget in order; steps with no minutes stay.
export function capMinutes(steps, budget = DAY_MINUTES) {
  let used = 0;
  const out = [];
  for (const step of steps) {
    const minutes = Math.max(0, Number(step.minutes) || 0);
    if (minutes && used >= budget) continue;
    const take = Math.min(minutes, budget - used);
    used += take;
    out.push({...step, minutes: take});
  }
  return out;
}

// The day, in the order a person studies it, inside six hours with breaks:
// yesterday's delayed checks, first checks of new material, timed reading and
// listening every day (or a full mock), targeted work on weak points, Day
// Radio, then stop. The last days drop new material; the eve and the day
// itself are about rest and logistics. Pure, so the coach can replace it and
// the tests can hold it.
// In the last two weeks full mocks follow the sprint checkpoint (two fresh
// first sittings on separate days within seven days); a missed checkpoint
// turns targeted time into repairing its weakest section. A custom first-pass
// goal (goal.custom) may keep new material going into the last days.
export function todayPlan({days, checkpoint = null, comprehension = null, baseline = false, goal = {goal: 0, firstToday: 0, unchecked: 0}, weak = 0, running = null, nextMock = null,
  lastMockAt = "", latestResults = null, aiReady = false, checks = 0, pace = null, examDate = null, firstPassDate = null, now = new Date()}) {
  const custom = !!(goal.custom && goal.goal && goal.unchecked);
  const sinceMock = lastMockAt ? daysUntil(new Date(now.getFullYear(), now.getMonth(), now.getDate()), new Date(lastMockAt)) : Infinity;
  if (days === 0) return {phase: "exam-day", headline: "Exam day. You have done the work.", steps: [
    {kind: "checklist", glyph: "券", title: "Before you leave", line: "Ticket, pencils, watch — the checklist below"},
    {kind: "radio", glyph: "温", title: "Ten calm minutes", line: "Day Radio on the way: hear words, no pressure to answer", href: "?view=radio&mode=listen", minutes: 10},
    {kind: "rest", glyph: "息", title: "Breathe on the way", line: "One minute, any time you feel rushed"}]};
  if (days === 1 && !custom) return {phase: "eve", headline: "Tomorrow is the exam. Keep today light.", steps: [
    {kind: "recall", glyph: "温", title: "Weak items, once", line: Math.min(weak, 30) + " items · 15 minutes, then stop", href: "?view=recall&queue=weak", minutes: 15},
    {kind: "checklist", glyph: "券", title: "Pack tonight", line: "The checklist below, then the route and the time"},
    {kind: "rest", glyph: "眠", title: "Sleep early", line: "Sleep fixes what you studied this week. No new material tonight."}]};
  const p = pace || DEFAULT_PACE, minutesFor = n => Math.ceil(n * p / 60);
  const final = days <= CONSOLIDATION_DAYS;
  const latest = checkpoint?.recent?.[0];
  const sprint = !!checkpoint && days <= 14;
  const examIn = run => days + daysUntil(new Date(now.getFullYear(), now.getMonth(), now.getDate()), new Date(run.attempt.completedAt));
  const checkpointDue = sprint && days >= 2 && (!latest ||
    (days <= 7 && examIn(latest) > 7) || (days <= 3 && examIn(latest) > 3 && !checkpoint.met));
  const mockDay = !!running || !!(nextMock && (sprint ? checkpointDue : (sinceMock >= 3 || days === 4) && days > 2));
  const repair = sprint && latest && !latest.meets ? [...latest.sections].sort((a, b) => a.rate - b.rate)[0] : null;
  const b = BUDGET[mockDay ? "mock" : "regular"];
  const steps = [];
  let spare = 0;

  // A new learner starts with a short sample of all four skills (J1Today):
  // it tells the plan where to start. Its minutes come out of targeted work.
  if (baseline && !running) steps.push({kind: "sample", glyph: "試", title: "Short sample of all four skills", line: "Your baseline: tells today’s plan where to start", minutes: 20});
  const checkMinutes = checks ? Math.min(b.check, Math.max(5, minutesFor(checks))) : 0;
  spare += b.check - checkMinutes;
  if (checks) steps.push({kind: "check", glyph: "昨", title: "Today's checks", line: checks + " from yesterday · misses and guesses, in print and by ear, in a new context", href: "?view=check", minutes: checkMinutes});

  if (running) steps.push({kind: "mock", glyph: "試", title: "Finish your mock", line: running.title + " · " + running.progress, href: "?book=" + running.book, minutes: 90});
  else if (mockDay) steps.push({kind: "mock", glyph: "試", title: "Full mock in exam conditions", line: nextMock.title + " · 155 minutes with a break", href: "?book=" + nextMock.id, minutes: b.mock});
  if (mockDay) {
    spare += running ? b.mock - 90 : 0;
    steps.push({kind: "review", glyph: "直", title: "Go over the mock", line: "Each miss: find the sentence or line that decides it, then drill the words", href: latestResults || undefined, minutes: b.review});
  }

  // Targeted minutes with nothing to target (no misses, no weak items, no AI)
  // go to first checks instead of leaving the day short.
  const acquire = (!final || custom) && goal.goal > 0 && goal.unchecked;
  const targetedNeed = (latestResults ? 20 : 0) + (comprehension ? 20 : 0) + (repair ? 30 + (aiReady ? 15 : 0) : aiReady ? 30 : 0);
  if (!mockDay && !weak && acquire) spare += Math.max(0, b.targeted - targetedNeed);
  const targetedBase = !mockDay && !weak && acquire ? Math.min(b.targeted, targetedNeed) : b.targeted;
  let forecast = null, overflow = null;
  if (acquire) {
    const pool = b.first + spare;
    const capacity = firstCapacity(pool, p);
    const left = Math.max(0, Math.min(goal.goal, capacity) - goal.firstToday);
    const minutes = left ? minutesFor(left) : 0;
    spare = pool - minutes;
    const short = goal.goal > capacity;
    // What the schedule needs today but the six hours cannot hold (J1Overload).
    const wanted = Math.max(0, goal.goal - goal.firstToday);
    // A few minutes over is noise; a quarter hour or more is worth a decision.
    if (wanted > left && minutesFor(wanted) - minutes >= 15) overflow = {checks: wanted - left, minutes: minutesFor(wanted) - minutes};
    steps.push({kind: "recall", glyph: "憶", title: left ? "Word and grammar first checks" : "New checks done for today",
      line: left ? (goal.firstToday ? goal.firstToday + " of " + (goal.firstToday + left) + " done today · " : left + " unchecked N2 words and grammar points · ") + "rounds of 20" : goal.firstToday + " first checks today. More is a bonus.",
      href: "?view=recall&queue=new", minutes, done: !left, ...(left && goal.firstToday ? {progress: {done: goal.firstToday, of: goal.firstToday + left}} : {})});
    if (examDate) forecast = firstCheckForecast({unchecked: goal.unchecked, todayLeft: Math.max(0, capacity - goal.firstToday), pace: p, examDate, firstPassDate, now});
  }

  if (!mockDay) {
    steps.push({kind: "section", section: "reading", glyph: "読", title: "Timed reading", line: "問題10–14 from a set you have not sat · 21 questions, then read why", minutes: b.reading});
    steps.push({kind: "section", section: "listening", glyph: "聴", title: "Listening, one play each", line: "問題1–5 from a set you have not sat · 32 questions", minutes: b.listening});
    let targeted = targetedBase + spare - (baseline && !running ? 20 : 0);
    spare = 0;
    if (latestResults) { steps.push({kind: "review", glyph: "直", title: "Go over the misses", line: "Read why each answer is right, then drill them", href: latestResults, minutes: 20}); targeted -= 20; }
    // The comprehension distinction missed most lately, on unseen passages.
    if (comprehension && targeted >= 20) {
      steps.push({kind: "drill", tag: comprehension.id, glyph: "解", title: "Comprehension · " + comprehension.ja, line: comprehension.en + " · " + comprehension.wrong + " of " + comprehension.n + " missed lately · unseen passages", minutes: 20});
      targeted -= 20;
    }
    if (repair) {
      steps.push({kind: "review", glyph: "直", title: "Repair " + repair.name, line: "Find the decisive cue in the answers you missed or guessed. Then try a different example.",
        href: "?book=" + latest.attempt.book + "&attempt=" + encodeURIComponent(latest.attempt.id), minutes: Math.max(0, Math.min(30, targeted))});
      targeted -= 30;
      if (aiReady && targeted >= 15) { steps.push({kind: "generate", glyph: "狙", title: "Check the same skill on fresh questions", line: "10 targeted questions", count: 10,
        focus: repair.name === "Reading" || repair.name === "Listening" ? repair.name : "weak", minutes: 15}); targeted -= 15; }
    } else if (aiReady && targeted >= 30) { steps.push({kind: "generate", glyph: "狙", title: "Practice exam on your weak points", line: "New questions in the real 問題 formats, from your misses", minutes: 30}); targeted -= 30; }
    if (weak && targeted > 0) steps.push({kind: "recall", glyph: "温", title: "Your weak items", line: weak + " weak · say each one aloud before you check", href: "?view=recall&queue=weak", minutes: targeted});
    else if (!aiReady && !weak && !repair) steps.push({kind: "generate", glyph: "狙", title: "Practice exam on your weak points", line: "Add an AI provider in Echo Settings to generate these", minutes: 0, disabled: true});
  } else if (weak && spare > 0) {
    steps.push({kind: "recall", glyph: "温", title: "Your weak items", line: weak + " weak · say each one aloud before you check", href: "?view=recall&queue=weak", minutes: spare});
  }
  steps.push({kind: "radio", glyph: "耳", title: "Day Radio", line: "Your weak words and grammar by ear — on a walk, cooking, commuting", href: "?view=radio&mode=listen", minutes: b.radio});
  steps.push({kind: "rest", glyph: "休", title: "Breaks, then stop", line: "Five to ten minutes between blocks; breathe, and stop for the day", minutes: b.breaks});
  if (final && !custom) steps.unshift({kind: "checklist", glyph: "券", title: "Exam week", line: "No new material now: delayed checks, weak items, timed sections and the checklist"});
  const capped = capMinutes(steps);
  const minutes = capped.reduce((sum, s) => sum + (s.minutes || 0), 0);
  const hours = Math.round(minutes / 60 * 2) / 2;
  return {phase: final && !custom ? "final" : "build", headline: (final ? "Exam week: consolidate, don't cram. " : "") + "About " + hours + " hours today, breaks included.",
    steps: capped, minutes, forecast, pace: p, measured: !!pace, overflow: overflow && {...overflow, needs: minutes + overflow.minutes, fits: DAY_MINUTES}};
}

// What is already done today, so a finished step stays in the plan, ticked,
// instead of vanishing (report 1ccf9988: "I'm always doing the first item").
// Counts come from the records themselves: delayed checks, finished papers by
// kind, Day Radio plays.
const CHECK_TAGS = new Set(["delayed-check", "check-yesterday"]);
export function doneToday({recall = [], events = [], attempts = [], papers = [], now = new Date()} = {}) {
  const today = localDay(now), on = at => !!at && localDay(new Date(at)) === today;
  const done = {check: 0, radio: 0, sections: new Set(), drills: new Set(), sample: false, generated: 0, mock: ""};
  for (const r of recall) for (const e of r.events || []) if (CHECK_TAGS.has(e.source) && on(e.at)) done.check++;
  for (const e of events) {
    if (!on(e.at)) continue;
    if (e.kind === "recall" && CHECK_TAGS.has(e.context?.source)) done.check++;
    else if (e.context?.source === "day-radio") done.radio++;
  }
  const byId = new Map(papers.map(p => [p.id, p]));
  for (const a of attempts) {
    if (a.phase !== "results" || !on(a.completedAt)) continue;
    const p = byId.get(a.paper || a.book), d = p?.drill;
    if (d?.section) done.sections.add(d.section);
    else if (d?.tag) done.drills.add(d.tag);
    else if (d?.sample) done.sample = true;
    else if (String(a.book || "").startsWith("adaptive-")) done.generated++;
    else done.mock = p?.title || a.book;
  }
  return done;
}
// The plan with today's finished steps ticked. A step the plan drops once it
// is finished (Today's checks, today's mock) comes back, ticked, in its place.
export function markDone(plan, done) {
  if (!plan || !done) return plan;
  const steps = plan.steps.map(s => {
    const tick = s.kind === "section" ? done.sections.has(s.section)
      : s.kind === "drill" ? done.drills.has(s.tag)
      : s.kind === "sample" ? done.sample
      : s.kind === "generate" ? done.generated > 0 && !s.disabled
      : s.kind === "radio" ? done.radio > 0
      : s.kind === "check" ? false : !!s.done;
    const line = s.kind === "radio" && done.radio ? s.line + " · " + done.radio + " heard today" : s.line;
    return tick || s.done ? {...s, line, done: true} : {...s, line};
  });
  const at = steps[0]?.kind === "checklist" ? 1 : 0;
  if (!steps.some(s => s.kind === "mock") && done.mock) steps.splice(at, 0, {kind: "mock", glyph: "試", title: "Full mock", line: done.mock + " · finished today", minutes: 0, done: true});
  if (!steps.some(s => s.kind === "check") && done.check) steps.splice(at, 0, {kind: "check", glyph: "昨", title: "Today's checks", line: done.check + " checked today · all done", href: "?view=check", minutes: 0, done: true});
  return {...plan, steps};
}

// A shortened day (J3Short): keep what decides tomorrow — the delayed checks
// and weak items, the weakest timed section, Day Radio, a break — inside
// `minutes`, and list what moves to tomorrow. Nothing is deleted.
export function shortenPlan(plan, minutes = 90) {
  const share = {check: 35, section: 35, radio: 15, rest: 5};
  const keep = [], moved = [];
  const first = (pred) => plan.steps.find(s => pred(s) && !keep.includes(s));
  const checks = first(s => s.kind === "check") || first(s => s.kind === "recall" && /weak/.test(s.href || ""));
  const section = first(s => s.kind === "section" && s.weakest) || first(s => s.kind === "section" && s.section === "listening") || first(s => s.kind === "section");
  const radio = first(s => s.kind === "radio");
  for (const [step, budget] of [[checks, share.check], [section, share.section], [radio, share.radio]]) if (step) keep.push({...step, minutes: Math.min(step.minutes || budget, budget)});
  keep.push({kind: "rest", glyph: "休", title: "Break", line: "", minutes: share.rest});
  for (const s of plan.steps) if (!keep.some(k => k.title === s.title) && s.minutes && s.kind !== "rest") moved.push(s);
  const total = keep.reduce((n, s) => n + (s.minutes || 0), 0);
  const scale = total > minutes ? minutes / total : 1;
  return {steps: keep.map(s => ({...s, minutes: Math.max(1, Math.round(s.minutes * scale))})), moved, minutes: Math.min(total, minutes), of: plan.minutes || DAY_MINUTES};
}

// After the exam (J3After) the plan stops; maintenance is Today's checks and
// one Day Radio round, no new first checks.
export function maintenancePlan({checks = 0, pace = null} = {}) {
  const p = pace || DEFAULT_PACE;
  const steps = [];
  if (checks) steps.push({kind: "check", glyph: "昨", title: "Today's checks", line: checks + " from yesterday", href: "?view=check", minutes: Math.min(10, Math.max(3, Math.ceil(checks * p / 60)))});
  steps.push({kind: "radio", glyph: "耳", title: "Day Radio", line: "One round of your weak items by ear", href: "?view=radio&mode=listen", minutes: 15 - (steps[0]?.minutes || 0) || 10});
  return {phase: "maintenance", headline: "Maintenance · about 15 min a day", steps, minutes: steps.reduce((n, s) => n + s.minutes, 0)};
}
// JLPT results come out about two months later: late January for December, late August for July.
export const resultsMonth = exam => exam.getMonth() === 11 ? "late January" : exam.getMonth() === 6 ? "late August" : "about two months";

export const EXAM_CHECKLIST = Object.freeze([
  ["ticket", "受験票 — exam voucher, with your photo attached"],
  ["pencils", "HB pencils (not mechanical) and an eraser"],
  ["watch", "A watch without alarms; phones are switched off and put away"],
  ["id", "Photo ID"],
  ["route", "Route to the venue and when to leave, checked tonight"],
  ["food", "Water and a light snack for the break"],
  ["layer", "A warm layer — exam rooms are often cold in December"],
]);

// A conservative practice benchmark. Evaluate first sittings and count flagged
// correct answers as uncertain. This score is independent of JLPT scaled scores.
export function sprintCheckpoint(attempts, papers, eligibleBooks, now = new Date()) {
  const {firstUse} = drillExposure(papers.values(), attempts);
  const first = new Map();
  for (const a of [...attempts].sort((x,y) => (x.startedAt || "").localeCompare(y.startedAt || ""))) {
    // A boss sitting (Quick round, half time) is not a standard sitting.
    if (eligibleBooks.includes(a.book) && !a.boss && !first.has(a.book)) first.set(a.book, a);
  }
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const runs = [];
  for (const a of first.values()) {
    const finish = new Date(a.completedAt), paper = papers.get(a.paper || a.book);
    if (firstUse.has(a.book) && firstUse.get(a.book) <= a.completedAt) continue;
    if (a.unscorable || a.phase !== "results" || !a.startedAt || !(finish >= cutoff && finish <= now) ||
        localDay(new Date(a.startedAt)) !== localDay(finish) || !paper || !Array.isArray(a.guesses)) continue;
    const sections = SECTIONS.map(section => {
      const rows = paper.questions.filter(q => section.skills.includes(q.skill));
      const correct = rows.filter(q => !a.guesses[q.index] && a.answers[q.index] === q.key).length;
      return {name:section.en, rate:rows.length ? correct / rows.length : 0, correct, count:rows.length};
    });
    if (sections.some(s => !s.count)) continue;
    const average = sections.reduce((sum,s) => sum+s.rate,0)/sections.length;
    runs.push({attempt:a, sections, average, day:localDay(finish), meets:average >= .70 && sections.every(s=>s.rate >= .60)});
  }
  runs.sort((a,b)=>b.attempt.completedAt.localeCompare(a.attempt.completedAt));
  const recent = runs.slice(0,2);
  const met = recent.length === 2 && recent[0].day !== recent[1].day && recent.every(r=>r.meets);
  return {recent, met};
}

// The exam and the first-pass end the plan works to: the learner's goal when
// set, else the next JLPT date and the last day before exam week.
export function goalDates(goal = null, now = new Date()) {
  const exam = goal ? parseGoalDate(goal.exam) : nextExamDate(now);
  const custom = goal?.days ? firstPassEnd(goal) : null;
  const firstPass = custom || new Date(exam.getFullYear(), exam.getMonth(), exam.getDate() - CONSOLIDATION_DAYS - 1);
  return {exam, firstPass, custom: !!custom, set: !!goal};
}
export const formatMinutes = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? h + " h" + (r ? " " + r + " min" : "") : r + " min"; };
