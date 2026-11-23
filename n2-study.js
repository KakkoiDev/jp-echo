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
export function estimate(paper, attempt) {
  const closed = closedSkills(attempt.phase);
  const sections = SECTIONS.map(section => {
    const items = paper.questions.filter(q => section.skills.includes(q.skill));
    const correct = items.filter(q => attempt.answers[q.index] === q.key).length;
    const open = !items.length || !section.skills.every(s => closed.includes(s) || !items.some(q => q.skill === s));
    const scaled = items.length ? Math.round(correct / items.length * SECTION_MAX) : null;
    return {...section, correct, total: items.length, scaled: open ? null : scaled, ok: open ? null : scaled >= SECTION_MIN};
  });
  const scoredSections = sections.filter(s => s.scaled !== null);
  const complete = scoredSections.length === SECTIONS.length;
  const total = scoredSections.reduce((sum, s) => sum + s.scaled, 0);
  return {sections, total, complete, pass: complete ? total >= PASS_TOTAL && sections.every(s => s.ok) : null};
}

// The three recall decks. A target is the stable identity shared with exam
// questions, so a mock miss and a self-check talk about the same thing.
export function recallItems(inventory) {
  return {
    meaning: inventory.words.map(([w, r, m]) => ({target: ["word", w, r], prompt: w, reading: r, answer: m})),
    reading: inventory.words.filter(([w, r]) => w !== r).map(([w, r, m]) => ({target: ["word", w, r], prompt: w, reading: r, answer: m})),
    grammar: inventory.grammar.map(([id, name, hint]) => ({target: ["grammar", id], prompt: name, answer: hint})),
  };
}
export const recallId = (type, target) => JSON.stringify([type, ...target]);
function evidenceFits(type, row) {
  if (!row.target || !row.answered) return false;
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

export function recallRecord(previous, {id, type, item}, grade, now = new Date()) {
  const day = localDay(now);
  return {id, target: item.target, dimension: type, prompt: item.prompt, answer: item.answer, last: grade, day,
    updatedAt: now.toISOString(), checks: (previous?.checks || 0) + 1,
    days: grade === "instant" ? [...new Set([...(previous?.days || []), day])] : [],
    events: [...(previous?.events || []), {at: now.toISOString(), grade}]};
}

// First checks of words and grammar, spread so every target has been seen
// two days before the exam (the last days are for mocks and weak items).
export function dailyGoal({inventory, recall = [], examDate, now = new Date()}) {
  const today = localDay(now);
  const types = ["meaning", "grammar"];
  const total = inventory.words.length + inventory.grammar.length;
  const mine = recall.filter(r => types.includes(r.dimension));
  const firstToday = mine.filter(r => localDay(new Date(r.events?.[0]?.at || r.updatedAt)) === today).length;
  const checkedToday = recall.filter(r => (r.events || []).some(e => localDay(new Date(e.at)) === today)).length;
  const unchecked = total - mine.length;
  const daysLeft = Math.max(1, daysUntil(examDate, now) - 2);
  return {goal: Math.ceil((unchecked + firstToday) / daysLeft), firstToday, checkedToday, unchecked, daysLeft, total};
}

export function coverage(inventory, recall, evidence) {
  const items = recallItems(inventory);
  return Object.fromEntries(Object.entries(items).map(([type, list]) => {
    const records = recall.filter(r => r.dimension === type);
    const automatic = records.filter(r => r.days?.length >= 2 && r.last === "instant").length;
    const weak = [...weakTargets(type, recall, evidence).values()].filter(v => v.weak).length;
    return [type, {total: list.length, checked: records.length, automatic, weak}];
  }));
}

// The day, in the order a person studies it: warm up on yesterday's weak
// items, first-check new material, sit exam practice, go over the misses,
// then stop. The last days drop new material; the eve and the day itself
// are about rest and logistics. Pure, so the coach can replace it and the
// tests can hold it.
export function todayPlan({days, goal = {goal: 0, firstToday: 0, unchecked: 0}, weak = 0, running = null, nextMock = null,
  lastMockAt = "", latestResults = null, aiReady = false, now = new Date()}) {
  const steps = [];
  const sinceMock = lastMockAt ? daysUntil(new Date(now.getFullYear(), now.getMonth(), now.getDate()), new Date(lastMockAt)) : Infinity;
  if (days === 0) return {phase: "exam-day", headline: "Exam day. You have done the work.", steps: [
    {kind: "checklist", glyph: "券", title: "Before you leave", line: "Ticket, pencils, watch — the checklist below"},
    {kind: "recall", glyph: "温", title: "Ten calm minutes", line: "Only items you already know, to warm up", href: "?view=recall&queue=daily", minutes: 10},
    {kind: "rest", glyph: "息", title: "Breathe on the way", line: "One minute, any time you feel rushed"}]};
  if (days === 1) return {phase: "eve", headline: "Tomorrow is the exam. Keep today light.", steps: [
    {kind: "recall", glyph: "温", title: "Weak items, once", line: Math.min(weak, 30) + " items · 15 minutes, then stop", href: "?view=recall&queue=weak", minutes: 15},
    {kind: "checklist", glyph: "券", title: "Pack tonight", line: "The checklist below, then the route and the time"},
    {kind: "rest", glyph: "眠", title: "Sleep early", line: "Sleep fixes what you studied this week. No new material tonight."}]};
  if (weak) steps.push({kind: "recall", glyph: "温", title: "Warm up · your weak items", line: Math.min(weak, 20) + " of " + weak + " · say each one aloud before you check", href: "?view=recall&queue=weak", minutes: 15});
  const final = days <= 3;
  if (!final && goal.unchecked) {
    const left = Math.max(0, goal.goal - goal.firstToday);
    steps.push({kind: "recall", glyph: "憶", title: left ? "New words and grammar" : "New checks done for today", line: left ? left + " first checks left today · rounds of 20" : goal.firstToday + " first checks today. More is a bonus.", href: "?view=recall&queue=new", minutes: Math.ceil(left / 20) * 12, done: !left});
  }
  if (running) steps.push({kind: "mock", glyph: "試", title: "Finish your mock", line: running.title + " · " + running.progress, href: "?book=" + running.book, minutes: 60});
  else if (nextMock && (sinceMock >= 3 || days === 4) && days > 2) steps.push({kind: "mock", glyph: "試", title: "Full mock in exam conditions", line: nextMock.title + " · 155 minutes with a break", href: "?book=" + nextMock.id, minutes: 155});
  else steps.push({kind: "generate", glyph: "狙", title: "Practice exam on your weak points", line: aiReady ? "20 new questions in the real 問題 formats · about 30 minutes" : "Add an AI provider in Echo Settings to generate these", minutes: 30, disabled: !aiReady});
  if (latestResults) steps.push({kind: "review", glyph: "直", title: "Go over the misses", line: "Read why each answer is right, then drill them", href: latestResults, minutes: 20});
  steps.push({kind: "rest", glyph: "休", title: "Wind down", line: "Breathe, hear your sentences, stop for the day"});
  if (final) steps.unshift({kind: "checklist", glyph: "券", title: "Exam week", line: "No new material now: weak items, one last mock, and the checklist"});
  const minutes = steps.reduce((sum, s) => sum + (s.minutes || 0), 0);
  return {phase: final ? "final" : "build", headline: final ? "Exam week: consolidate, don't cram." : "About " + Math.round(minutes / 60 * 2) / 2 + " hours today, in this order.", steps, minutes};
}

export const EXAM_CHECKLIST = Object.freeze([
  ["ticket", "受験票 — exam voucher, with your photo attached"],
  ["pencils", "HB pencils (not mechanical) and an eraser"],
  ["watch", "A watch without alarms; phones are switched off and put away"],
  ["id", "Photo ID"],
  ["route", "Route to the venue and when to leave, checked tonight"],
  ["food", "Water and a light snack for the break"],
  ["layer", "A warm layer — exam rooms are often cold in December"],
]);
