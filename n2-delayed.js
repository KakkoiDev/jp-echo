// Today's checks: one session for yesterday's misses and uncertain answers,
// across print and audio, tested again a day later in a context the learner
// did not see yesterday. Pure (no DOM, no storage) so test/n2-delayed.test.js
// holds it; n2-mock.js renders it as ?view=check.
//
// Evidence stays in its own skill. A print check writes the recall record of
// its dimension (meaning, reading or grammar); an audio check writes a
// listening event. So catching 就任 by ear tomorrow changes the listening
// evidence only, never the written reading.
import {localDay, recallItems} from "./n2-study.js";

const keyOf = target => JSON.stringify(target);
const dayOf = at => at ? localDay(new Date(at)) : "";
export const CHECK_SIZE = 40;
export const CHECK_SOURCE = "delayed-check";
// Older next-day checks from Day Radio's former Yesterday tab count as done.
const CHECK_SOURCES = new Set([CHECK_SOURCE, "check-yesterday"]);
const WHY_RANK = {missed: 0, slow: 1, guessed: 2, heard: 3};
export const WHY_LINE = {missed: "Missed yesterday", slow: "Slow yesterday", guessed: "Guessed yesterday", heard: "Heard on Day Radio yesterday"};

export function previousDay(today = localDay()) {
  return localDay(new Date(new Date(today + "T12:00:00").getTime() - 86_400_000));
}

// The context an exam answer was given in, as examplesFromSets names it.
export const examContextId = row => row.source || String(row.paper || "").split("@")[0] + "#" + row.index;

const dimensionFor = (target, dimension) => target?.[0] === "grammar" ? "grammar" : dimension === "reading" ? "reading" : "meaning";

// Everything from yesterday that deserves a delayed check, one candidate per
// target, modality and dimension. A same-day retry that succeeded does not
// remove a miss: the delayed check is the evidence worth keeping.
function candidates({recall, evidence, events, yesterday}) {
  const out = new Map(), earlierMiss = new Set();
  const add = ({target, modality, dimension, why, at, seen}) => {
    if (!target) return;
    dimension = dimensionFor(target, modality === "audio" ? "meaning" : dimension);
    if (dimension === "reading") modality = "print"; // a kanji reading is a print skill
    const k = keyOf([modality, dimension, target]);
    const prior = out.get(k);
    if (!prior) { out.set(k, {target, modality, dimension, why, at, seen: new Set(seen.filter(Boolean))}); return; }
    seen.filter(Boolean).forEach(id => prior.seen.add(id));
    if (WHY_RANK[why] < WHY_RANK[prior.why]) prior.why = why;
    if (at > prior.at) prior.at = at;
  };
  for (const r of recall) for (const e of r.events?.length ? r.events : [{at: r.updatedAt, grade: r.last}]) {
    const day = dayOf(e.at);
    if (e.grade === "instant") continue;
    if (day < yesterday) earlierMiss.add(keyOf(r.target));
    if (day === yesterday) add({target: r.target, modality: e.modality || "print", dimension: r.dimension, why: e.grade === "slow" ? "slow" : "missed", at: e.at, seen: [e.contextId]});
  }
  for (const row of evidence) {
    if (!row.target || !row.answered || (row.correct && !row.guessed)) continue;
    const day = dayOf(row.at);
    if (day < yesterday && !row.correct) earlierMiss.add(keyOf(row.target));
    if (day === yesterday) add({target: row.target, modality: row.skill === 3 ? "audio" : "print", dimension: row.dimension, why: row.correct ? "guessed" : "missed", at: row.at, seen: [examContextId(row)]});
  }
  for (const e of events) {
    const day = dayOf(e.at);
    if (e.kind === "recall" && e.skill === "listening" && e.grade !== "got") {
      if (day < yesterday) earlierMiss.add(keyOf(e.target));
      if (day === yesterday) add({target: e.target, modality: "audio", dimension: "meaning", why: e.grade === "slow" ? "slow" : "missed", at: e.at, seen: [e.context?.exampleId]});
    } else if (e.kind === "exposure" && day === yesterday) {
      add({target: e.target, modality: "audio", dimension: "meaning", why: "heard", at: e.at, seen: [e.context?.exampleId]});
    }
  }
  return {list: [...out.values()], earlierMiss};
}

// Done today: a delayed check already saved for this target, modality and
// dimension. Print checks live on the recall record; audio on events.
function checkedToday({recall, events, today}) {
  const done = new Set();
  for (const r of recall) for (const e of r.events || []) if (CHECK_SOURCES.has(e.source) && dayOf(e.at) === today) done.add(keyOf(["print", r.dimension, r.target]));
  for (const e of events) if (e.kind === "recall" && CHECK_SOURCES.has(e.context?.source) && dayOf(e.at) === today) done.add(keyOf(["audio", dimensionFor(e.target, "meaning"), e.target]));
  return done;
}

// Mix meanings, readings and grammar: never two of a kind in a row while
// another kind is waiting, keeping the priority order within each kind.
function interleave(rows) {
  const out = [], rest = [...rows];
  while (rest.length) {
    const last = out.at(-1);
    const i = rest.findIndex(r => !last || r.dimension + r.modality !== last.dimension + last.modality);
    out.push(...rest.splice(i < 0 ? 0 : i, 1));
  }
  return out;
}

// The batch the hub counts and the session opens: the same call in both.
export function delayedChecks({inventory, recall = [], evidence = [], events = [], examples = new Map(), today = localDay(), size = CHECK_SIZE, items = checkItems(inventory)}) {
  const yesterday = previousDay(today);
  const {list, earlierMiss} = candidates({recall, evidence, events, yesterday});
  const done = checkedToday({recall, events, today});
  const rows = list.filter(c => !done.has(keyOf([c.modality, c.dimension, c.target])) && items.get(keyOf([c.dimension, c.target])))
    .map(c => ({...c, recurring: c.why !== "heard" && earlierMiss.has(keyOf(c.target))}))
    .sort((a, b) => WHY_RANK[a.why] - WHY_RANK[b.why] || b.recurring - a.recurring || (b.at || "").localeCompare(a.at || ""));
  return interleave(rows).slice(0, size).map(c => {
    const pool = examples.get(keyOf(c.target)) || [];
    const fresh = pool.find(e => !c.seen.has(e.id));
    const example = fresh || pool[0] || null;
    return {...items.get(keyOf([c.dimension, c.target])), modality: c.modality, dimension: c.dimension, why: c.why, recurring: c.recurring,
      example, context: fresh ? "fresh" : example ? "same" : "none", seen: [...c.seen]};
  });
}

// What a check shows and says, keyed by dimension and target.
export function checkItems(inventory) {
  const map = new Map();
  for (const [dimension, list] of Object.entries(recallItems(inventory))) for (const it of list) {
    map.set(keyOf([dimension, it.target]), {target: it.target, kind: it.target[0], prompt: it.prompt, text: it.prompt.replace(/[〜～]/g, ""), reading: it.reading || "", answer: it.answer});
  }
  return map;
}

// The ask, by modality and dimension.
export function checkAsk(check) {
  if (check.modality === "audio") return check.example ? "Listen. What does the sentence say? Say it, then check" : "Listen. Say what it means, then check";
  if (check.dimension === "reading") return "Read the underlined word aloud, then check";
  if (check.dimension === "grammar") return check.example ? "Say what this pattern does in the sentence" : "Say what it means and use it in a sentence";
  return check.example ? "Say what the underlined word means here" : "Say the meaning, then check";
}

// Where the learner's one context came from, said plainly.
export function contextNote(check) {
  if (check.context === "fresh") return check.seen.length ? "A sentence you did not see yesterday." : "";
  if (check.context === "same") return "Only one sentence for this, so it is the one you saw yesterday.";
  return check.modality === "audio" ? "No sentence for this yet: you will hear the word itself." : "No sentence for this yet: the word alone.";
}

// The sentence for print, with the target underlined when it is written there.
// Returns parts so the screen builds DOM without markup strings.
export function sentenceParts(check) {
  const plain = String(check.example?.ja || "").replace(/【[^】]*】/g, "");
  if (!plain) return [];
  const needle = check.text && plain.includes(check.text) ? check.text : "";
  if (!needle) return [{text: plain}];
  const at = plain.indexOf(needle);
  return [{text: plain.slice(0, at)}, {text: needle, mark: true}, {text: plain.slice(at + needle.length)}].filter(p => p.text);
}

// The detail every delayed check saves with its grade.
// activeMs: visible time on the item, shown to graded. responseMs: shown to
// the reveal (the attempt). replays: extra plays of the audio (assistance).
export function checkDetail(check, {activeMs = 0, responseMs = 0, replays = 0} = {}) {
  return {source: CHECK_SOURCE, modality: check.modality, why: check.why, contextId: check.example?.id || null,
    context: check.context, assistance: replays ? "replayed " + replays : "none", replays,
    activeMs: Math.max(0, Math.round(activeMs)), responseMs: Math.max(0, Math.round(responseMs))};
}

// Grades: print keeps recall's three; audio writes got / slow / missed.
export const audioGrade = grade => grade === "instant" ? "got" : grade === "slow" ? "slow" : "missed";

// Next-day accuracy over the last week: the share of delayed checks answered
// instantly (print) or caught (audio). Kept apart from first-check counts.
export function delayedAccuracy({recall = [], events = [], now = new Date(), days = 7}) {
  const since = now.getTime() - days * 86_400_000, grades = [];
  for (const r of recall) for (const e of r.events || []) if (CHECK_SOURCES.has(e.source) && Date.parse(e.at) >= since && Date.parse(e.at) <= now.getTime()) grades.push(e.grade === "instant");
  for (const e of events) if (e.kind === "recall" && CHECK_SOURCES.has(e.context?.source) && Date.parse(e.at) >= since && Date.parse(e.at) <= now.getTime()) grades.push(e.grade === "got");
  const correct = grades.filter(Boolean).length;
  return {n: grades.length, correct, rate: grades.length ? correct / grades.length : null};
}

// "14 from yesterday: 6 misses, 3 slow, 2 guesses, 3 Day Radio plays"
export function checksSummary(checks = []) {
  const n = why => checks.filter(c => c.why === why).length;
  const parts = [[n("missed"), "miss", "misses"], [n("slow"), "slow", "slow"], [n("guessed"), "guess", "guesses"], [n("heard"), "Day Radio play", "Day Radio plays"]]
    .filter(([k]) => k).map(([k, one, many]) => k + " " + (k === 1 ? one : many));
  return checks.length ? checks.length + " from yesterday: " + parts.join(", ") : "Nothing from yesterday";
}

// One item's evidence by skill (J2Evidence). Each skill keeps its own record;
// one never moves another. Titles use the copy contract only: heard, checked
// once, recalled on another day, understood in a new passage.
const fmtDay = at => { const d = new Date(at); return d.getDate() + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]; };
const DIM_LABEL = {meaning: "意味 Meaning", reading: "読み Reading", grammar: "文法 Grammar"};
export function evidenceFor(target, {recall = [], events = [], evidence = [], paperTitle = () => ""} = {}) {
  const key = keyOf(target), written = [], listening = [];
  for (const r of recall.filter(r => keyOf(r.target) === key)) {
    const evs = r.events?.length ? r.events : [{at: r.updatedAt, grade: r.last}];
    const first = evs[0];
    written.push({done: true, title: "Checked once · " + (first.grade === "instant" ? "right" : first.grade === "slow" ? "slow" : "missed"), line: "Word check, " + DIM_LABEL[r.dimension], date: fmtDay(first.at), at: first.at});
    const later = evs.filter(e => dayOf(e.at) > dayOf(first.at));
    const recalled = later.find(e => e.grade === "instant");
    if (recalled) written.push({done: true, title: "Recalled on another day · right", line: (CHECK_SOURCES.has(recalled.source) ? "Today's checks" : "Word check") + ", " + DIM_LABEL[r.dimension], date: fmtDay(recalled.at), at: recalled.at});
    else if (later.length) written.push({done: false, title: "Recalled on another day · not yet", line: "Missed or slow on " + fmtDay(later.at(-1).at), date: fmtDay(later.at(-1).at), at: later.at(-1).at});
    else if (first.grade !== "instant") written.push({done: false, title: "Recalled on another day · 0 of 1 planned", line: "Comes back in Today's checks", date: fmtDay(new Date(new Date(first.at).getTime() + 86_400_000)), at: first.at});
    const fresh = evs.find(e => CHECK_SOURCES.has(e.source) && e.context === "fresh" && e.grade === "instant");
    if (fresh) written.push({done: true, title: "Understood in a new passage", line: "Today's checks, a sentence not seen before", date: fmtDay(fresh.at), at: fresh.at});
  }
  for (const row of evidence.filter(x => x.target && keyOf(x.target) === key && x.answered)) {
    const into = row.skill === 3 ? listening : written;
    into.push({done: row.correct && !row.guessed, title: row.correct && !row.guessed ? (row.skill === 3 ? "Understood in a new passage" : "Checked once · right") : row.skill === 3 ? "Missed in a dialogue" : "Missed in a mock", line: paperTitle(row.paper) || "Mock exam", date: fmtDay(row.at), at: row.at});
  }
  const heard = events.filter(e => e.kind === "exposure" && keyOf(e.target) === key);
  if (heard.length) listening.push({done: true, title: heard.length === 1 ? "Heard once" : "Heard " + heard.length + " times", line: "Day Radio · Listen", date: fmtDay(heard.at(-1).at), at: heard.at(-1).at});
  for (const e of events.filter(e => e.kind === "recall" && keyOf(e.target) === key)) {
    const got = e.grade === "got", check = CHECK_SOURCES.has(e.context?.source);
    listening.push({done: got, title: check ? (got ? "Recalled on another day · right" : "Recalled on another day · missed") : got ? "Caught by ear" : "Missed by ear",
      line: check ? "Today's checks" + (e.context?.context === "fresh" ? ", a sentence not heard before" : "") : "Day Radio · Recall", date: fmtDay(e.at), at: e.at});
    if (check && got && e.context?.context === "fresh") listening.push({done: true, title: "Understood in a new passage", line: "Today's checks, new sentence", date: fmtDay(e.at), at: e.at});
  }
  const byTime = (a, b) => (a.at || "").localeCompare(b.at || "");
  return {written: written.sort(byTime), listening: listening.sort(byTime)};
}

// The one line shown after an audio check (J2CheckAnswered): what this check
// added and that the written record did not move.
export function evidenceLine(target, {recall = [], events = []} = {}) {
  const key = keyOf(target);
  const heard = events.filter(e => e.kind === "exposure" && keyOf(e.target) === key).at(-1);
  const written = recall.filter(r => keyOf(r.target) === key && r.dimension !== "grammar").sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
  const parts = [];
  if (heard) parts.push("Heard " + fmtDay(heard.at) + " on Day Radio");
  const writtenPart = written ? "Your written " + (written.dimension === "reading" ? "reading" : "meaning") + " record (checked " + (written.checks === 1 ? "once" : written.checks + " times") + ", " + fmtDay(written.updatedAt) + ") is unchanged." : "Your written record is unchanged.";
  return (parts.length ? parts.join(" · ") + ". " : "") + writtenPart;
}
