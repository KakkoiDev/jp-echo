// Comprehension as skills, not passages. Each authored reading and listening
// question carries reviewed tags (n2-sets/tags.json, keyed "n2-set-N#index")
// naming the distinction that decided it: an exception, a change of plan, the
// speaker's intent… Misses are grouped by tag so the next step is a drill on
// unseen passages that hinge on the same thing. Pure: test/n2-comprehension.test.js.

export const TAGS = Object.freeze([
  {id: "detail", ja: "事実確認", en: "Stated facts", hint: "find one explicitly stated fact"},
  {id: "exception", ja: "条件・例外", en: "Conditions and exceptions", hint: "a condition, exception or eligibility rule (only if, except, unless) decides the answer"},
  {id: "change", ja: "変更", en: "Changes of plan", hint: "a plan, priority or instruction changes during the text or conversation and the later one wins"},
  {id: "reason", ja: "理由", en: "Reasons", hint: "the stated cause of a decision or event"},
  {id: "intent", ja: "意図", en: "What the speaker means", hint: "what the speaker or writer means, wants or feels when it is not said literally"},
  {id: "inference", ja: "推論", en: "Unstated conclusions", hint: "an unstated conclusion that follows from what is said"},
  {id: "reference", ja: "指示", en: "What これ・それ refer to", hint: "what a demonstrative or そのこと refers back to"},
  {id: "main", ja: "主張・要旨", en: "Main point", hint: "the writer's or speaker's main point or overall gist"},
  {id: "compare", ja: "比較", en: "Comparing views", hint: "comparing two texts, opinions or options"},
  {id: "next", ja: "次の行動", en: "What happens next", hint: "what someone does next or first, the order of steps"},
  {id: "response", ja: "応答", en: "Natural replies", hint: "choosing a natural immediate reply: keigo, nuance, who does what"},
  {id: "numbers", ja: "数量・日時", en: "Numbers and dates", hint: "fees, dates, times or counts that must be combined or calculated"},
]);
export const TAG = Object.freeze(Object.fromEntries(TAGS.map(t => [t.id, t])));

// Two authored forms never feed drills, so a fresh full mock on them is an
// unseen-passage check. Full mocks may still use them.
export const HELD_OUT = Object.freeze(["n2-set-19", "n2-set-20"]);

// A prepared drill reserves its source material even before an answer is
// recorded. Timestamp the first reservation so later practice cannot
// invalidate a full sitting that was already completed.
export function drillExposure(papers) {
  const firstUse = new Map(), sources = new Set();
  for (const p of papers) {
    if (!p.drill) continue;
    const sets = new Set([p.drill.set, p.drill.sample].filter(Boolean));
    for (const q of p.questions || []) {
      if (!q.source) continue;
      sources.add(q.source);
      sets.add(q.source.split("#")[0]);
    }
    for (const id of sets) {
      const at = p.createdAt || "";
      if (!firstUse.has(id) || at < firstUse.get(id)) firstUse.set(id, at);
    }
  }
  return {firstUse, sources};
}

// Where an authored question came from: a copied question keeps `source`; a
// question on a full authored paper (a realistic edition, "…-rN") is its set
// and index. The older template forms share the set ids but not the questions.
export function sourceOf(paper, question) {
  if (question?.source) return question.source;
  if (/^n2-set-\d+$/.test(paper?.book || "") && /-r\d+$/.test(paper?.edition || "") && question) return paper.book + "#" + question.index;
  return null;
}

// A stable passage identity: the first question in its set that shares the
// same context. 即時応答 lines and single texts are their own passage.
export function passageIds(setId, questions) {
  const first = new Map();
  return questions.map((q, i) => {
    if (!q.context) return null;
    if (!first.has(q.context)) first.set(q.context, setId + "#p" + i);
    return first.get(q.context);
  });
}

export const tagsOf = (tagMap, source) => (source && tagMap?.[source]) || [];

// Reading and listening evidence per tag over the last `days`. A guess counts
// as a miss; a blank counts against pacing, not the tag.
export function comprehensionStats({papers = [], evidence = [], tagMap = {}, now = new Date(), days = 14}) {
  const byId = new Map(papers.map(p => [p.id, p]));
  const since = now.getTime() - days * 86_400_000;
  const stats = new Map(TAGS.map(t => [t.id, {...t, n: 0, wrong: 0, blank: 0, last: ""}]));
  for (const row of evidence) {
    if (row.skill !== 2 && row.skill !== 3) continue;
    if (row.at && Date.parse(row.at) < since) continue;
    const paper = byId.get(row.paper), q = paper?.questions?.[row.index];
    const tags = tagsOf(tagMap, sourceOf(paper, q));
    tags.forEach((id, i) => {
      const s = stats.get(id); if (!s) return;
      if (!row.answered) { if (i === 0) s.blank++; return; }
      s.n++;
      if (!row.correct || row.guessed) { s.wrong++; if ((row.at || "") > s.last) s.last = row.at || ""; }
    });
  }
  return [...stats.values()].map(s => ({...s, rate: s.n ? s.wrong / s.n : 0}));
}

// The distinction to repair: at least `min` answered questions and the
// highest miss share (then more misses, then the most recent).
export function weakestTag(stats, {min = 3, floor = .34} = {}) {
  return stats.filter(s => s.n >= min && s.wrong >= 2 && s.rate >= floor)
    .sort((a, b) => b.rate - a.rate || b.wrong - a.wrong || b.last.localeCompare(a.last))[0] || null;
}

// A short drill from authored questions whose deciding tag is `tag`, from
// sets the learner has not sat and that are not held out. Each question keeps
// its whole passage or script, and its source for later evidence.
export function tagDrill({tag, sets = [], tagMap = {}, exclude = new Set(), seen = new Set(), size = 8}) {
  const pool = [];
  for (const set of sets) {
    if (!set?.id || exclude.has(set.id) || HELD_OUT.includes(set.id)) continue;
    const familiar = new Set(set.questions.filter((q,i) => seen.has(set.id+"#"+i) && q.context).map(q => q.context));
    set.questions.forEach((q, index) => {
      const source = set.id + "#" + index;
      if ((q.skill === "Reading" || q.skill === "Listening") && tagsOf(tagMap, source)[0] === tag && !seen.has(source) && !familiar.has(q.context)) pool.push({q, index, source, set: set.id});
    });
  }
  // Spread across sets, reading before listening, as on the paper.
  const bySet = new Map();
  for (const p of pool) bySet.set(p.set, [...(bySet.get(p.set) || []), p]);
  const out = [];
  while (out.length < size && [...bySet.values()].some(l => l.length)) for (const list of bySet.values()) if (list.length && out.length < size) out.push(list.shift());
  return out.sort((a, b) => (a.q.skill === "Listening") - (b.q.skill === "Listening"));
}

// Tags for one attempt's misses and guesses, most frequent first, for results.
export function attemptTags({paper, attempt, tagMap = {}}) {
  const counts = new Map();
  for (const q of paper?.questions || []) {
    if (q.skill !== 2 && q.skill !== 3) continue;
    const tags = tagsOf(tagMap, sourceOf(paper, q));
    if (!tags.length) continue;
    const id = tags[0], c = counts.get(id) || {...TAG[id], n: 0, wrong: 0};
    c.n++;
    if (attempt.answers[q.index] !== q.key || attempt.guesses?.[q.index]) c.wrong++;
    counts.set(id, c);
  }
  return [...counts.values()].filter(c => c.wrong).sort((a, b) => b.wrong - a.wrong || b.n - a.n);
}

// One-tap causes for a missed comprehension question (stored on the attempt).
export const CAUSES = Object.freeze([
  ["words", "A word I didn't know"],
  ["cue", "Missed the deciding line"],
  ["question", "Misread the question"],
  ["time", "Ran out of time"],
]);
