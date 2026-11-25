// Night Radio from today's N2 work. Sleep cueing strengthens what was studied
// that day; it does not teach anything new (Schreiner & Rasch 2015). So the
// night plays the N2 items the learner missed, was slow on, guessed or heard
// on Day Radio today: the same batch Today's checks will open tomorrow
// (delayedChecks with tomorrow as "today").
//
// To let the learner see whether it helps them, the night may cue only half
// of that batch (a fixed split by day and item). Tomorrow's checks test both
// halves, and nightComparison counts how each half did. The split is kept on
// this device (localStorage "echo-n2-night"); it is not learning evidence and
// never reaches the recall records, events, backups or the gist.
// Pure (no DOM, no storage): test/n2-night.test.js holds it.
import {localDay} from "./n2-study.js";
import {delayedChecks, previousDay, CHECK_SOURCE} from "./n2-delayed.js";
import {spokenWord} from "./japanese-readings.js";

const keyOf = target => JSON.stringify(target);
export const NIGHT_KEY = "echo-n2-night";
export const NIGHT_LIMIT = 40, NIGHT_KEEP = 60, NIGHT_MIN_SPLIT = 4;

export function nextDay(day) {
  return localDay(new Date(new Date(day + "T12:00:00").getTime() + 86_400_000));
}
// Before 5 am the night still belongs to the day that was studied.
export function studyDay(now = new Date()) {
  const day = localDay(now);
  return now.getHours() < 5 ? previousDay(day) : day;
}

// A fixed coin per day and item, so reopening the screen keeps the halves.
function coin(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 2 === 0;
}

// Tonight's items, one per target. Each carries its natural example (the deck
// sentence Recall shows), so the cue is the context the learner studied.
// compare: cue half and hold the other half back, when there are enough.
export function nightPlan({inventory, recall = [], evidence = [], events = [], examples = new Map(), day = studyDay(), compare = true, limit = NIGHT_LIMIT}) {
  const seen = new Set(), items = [];
  for (const check of delayedChecks({inventory, recall, evidence, events, today: nextDay(day), size: Infinity})) {
    const key = keyOf(check.target);
    if (seen.has(key)) continue;
    seen.add(key);
    const example = (examples.get(key) || [])[0] || null;
    const word = check.kind === "word" ? spokenWord(check.text, check.reading) : check.text;
    items.push({id: "n2-night:" + key, key, why: check.why, prompt: check.prompt,
      target: example?.ja || word, source: example?.en || check.answer, targetLang: "ja", sourceLang: "en"});
  }
  const split = compare && items.length >= NIGHT_MIN_SPLIT;
  const cued = [], held = [];
  for (const item of items) (!split || coin(day + item.key) ? cued : held).push(item);
  // Over the limit, the extra items are neither cued nor counted as held.
  return {day, compare: split, cued: cued.slice(0, limit), held: held.slice(0, limit)};
}

// What the device keeps about a night: the day and the two halves, by key.
export function nightRecord(plan, now = new Date()) {
  return {day: plan.day, at: now.toISOString(), compare: plan.compare, cued: plan.cued.map(i => i.key), held: plan.held.map(i => i.key)};
}
// One record per day, newest last, the latest NIGHT_KEEP nights.
export function keepNight(nights = [], record) {
  return [...nights.filter(n => n && n.day !== record.day), record].sort((a, b) => a.day.localeCompare(b.day)).slice(-NIGHT_KEEP);
}

// The next day's delayed checks, per target: right only if every check of it
// that day was instant (print) or got (by ear).
function checksOn(day, {recall, events}) {
  const out = new Map();
  const put = (target, right) => { const k = keyOf(target); out.set(k, (out.get(k) ?? true) && right); };
  for (const r of recall) for (const e of r.events || []) if (e.source === CHECK_SOURCE && e.at && localDay(new Date(e.at)) === day) put(r.target, e.grade === "instant");
  for (const e of events) if (e.kind === "recall" && e.context?.source === CHECK_SOURCE && e.at && localDay(new Date(e.at)) === day) put(e.target, e.grade === "got");
  return out;
}

// Cued against held, over the compared nights whose next-day checks exist.
// Small numbers say little; the screen says so.
export function nightComparison({nights = [], recall = [], events = []}) {
  const tally = {cued: {right: 0, n: 0}, held: {right: 0, n: 0}, nights: 0};
  for (const night of nights) {
    if (!night?.compare) continue;
    const results = checksOn(nextDay(night.day), {recall, events});
    let counted = false;
    for (const half of ["cued", "held"]) for (const key of night[half] || []) {
      if (!results.has(key)) continue;
      tally[half].n++; if (results.get(key)) tally[half].right++; counted = true;
    }
    if (counted) tally.nights++;
  }
  return tally;
}

export function comparisonLine({cued, held, nights}) {
  if (!nights) return "";
  const share = h => h.n ? Math.round(100 * h.right / h.n) + "%" : "–";
  const base = "Next-day checks after " + nights + " night" + (nights === 1 ? "" : "s") + ": cued " + cued.right + " of " + cued.n + " (" + share(cued) + "), not cued " + held.right + " of " + held.n + " (" + share(held) + ").";
  return base + (cued.n + held.n < 60 ? " Too few yet to tell." : "");
}
