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
