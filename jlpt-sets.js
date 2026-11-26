// Authored mock exams for the JLPT levels other than N2.
//
// N2's sets live in n2-sets/ and ship with the app (n2-forms.js BLUEPRINT).
// Every other level's sets live in sets/<level>/: one index a level
// (sets/n3/index.json: {level, edition, sets: {id: theme}}) and one file a
// set, sets/n3/<edition>/n3-set-1.json. They are fetched only when asked for;
// the service worker keeps each set it has served (cache jp-echo-sets, which
// app updates leave alone), so a set fetched once is there offline from then
// on, like the level inventories (jlpt-levels.js) and the large dictionary.
// A set's address carries its edition, so it never changes: revise a set →
// new edition folder, and older attempts keep their papers.
//
// A set is {id, level, theme, questions}. A question is what an N2 question
// is ({skill, mondai, context, prompt, choices, key, why, target?,
// dimension?}), and every Reading and Listening question also carries what N2
// keeps in tags.json and cues.json: `tags` (1–2 ids from TAGS,
// n2-comprehension.js) and `cue`, the deciding line copied exactly from its
// context. tools/validate-level-set.mjs holds a set to its level's blueprint.
//
// Sources. The papers are original. Their layout follows the official
// composition of test items (jlpt.jp/guideline/testsections.html) and the two
// official workbooks, 日本語能力試験公式問題集 (2012) and 第二集 (2018), at
// jlpt.jp/samples: the same references the N2 page links. Official papers are
// referenced, never copied.

// The official workbook pages, for reference and for linking a learner to the
// real thing. sample12 and sample18 each hold one paper per level.
export const OFFICIAL = Object.freeze({samples: "https://www.jlpt.jp/samples/forlearners.html", composition: "https://www.jlpt.jp/guideline/testsections.html", workbooks: ["https://www.jlpt.jp/samples/sample12.html", "https://www.jlpt.jp/samples/sample18.html"]});

// One row per 問題, in paper order, as n2-forms.js BLUEPRINT has for N2.
// `block` is the clock it is sat under (datasets/jlpt/exam-profiles.json
// timedBlocks), `chars` the length of its context in characters (passage or
// script), `group` how many questions share one context.
const V = "Vocabulary", G = "Grammar", R = "Reading", L = "Listening";
const N3 = [
  {skill: V, mondai: 1, kind: "漢字読み", count: 8, options: 4, targeted: "reading", block: "vocabulary", instruction: "＿＿のことばの読み方として最もよいものを、1・2・3・4から一つえらびなさい。"},
  {skill: V, mondai: 2, kind: "表記", count: 6, options: 4, targeted: "spelling", block: "vocabulary", instruction: "＿＿のことばを漢字で書くとき、最もよいものを、1・2・3・4から一つえらびなさい。"},
  {skill: V, mondai: 3, kind: "文脈規定", count: 11, options: 4, targeted: "meaning", block: "vocabulary", instruction: "（　）に入れるのに最もよいものを、1・2・3・4から一つえらびなさい。"},
  {skill: V, mondai: 4, kind: "言い換え類義", count: 5, options: 4, targeted: "meaning", block: "vocabulary", instruction: "＿＿に意味が最も近いものを、1・2・3・4から一つえらびなさい。"},
  {skill: V, mondai: 5, kind: "用法", count: 5, options: 4, targeted: "meaning", block: "vocabulary", instruction: "つぎのことばの使い方として最もよいものを、1・2・3・4から一つえらびなさい。"},
  {skill: G, mondai: 1, kind: "文法形式の判断", count: 13, options: 4, targeted: "meaning", block: "grammar_reading", instruction: "つぎの文の（　）に入れるのに最もよいものを、1・2・3・4から一つえらびなさい。"},
  {skill: G, mondai: 2, kind: "文の組み立て", count: 5, options: 4, star: true, block: "grammar_reading", instruction: "つぎの文の ★ に入る最もよいものを、1・2・3・4から一つえらびなさい。"},
  {skill: G, mondai: 3, kind: "文章の文法", count: 5, options: 4, needsContext: true, group: 5, chars: [350, 750], block: "grammar_reading", instruction: "つぎの文章を読んで、文章全体の内容を考えて、（１）から（５）の中に入る最もよいものを、1・2・3・4から一つえらびなさい。"},
  {skill: R, mondai: 4, kind: "内容理解（短文）", count: 4, options: 4, needsContext: true, group: 1, chars: [130, 300], block: "grammar_reading", instruction: "つぎの文章を読んで、質問に答えなさい。答えは、1・2・3・4から最もよいものを一つえらびなさい。"},
  {skill: R, mondai: 5, kind: "内容理解（中文）", count: 6, options: 4, needsContext: true, group: 3, chars: [300, 520], block: "grammar_reading", instruction: "つぎの文章を読んで、質問に答えなさい。答えは、1・2・3・4から最もよいものを一つえらびなさい。"},
  {skill: R, mondai: 6, kind: "内容理解（長文）", count: 4, options: 4, needsContext: true, group: 4, chars: [480, 820], block: "grammar_reading", instruction: "つぎの文章を読んで、質問に答えなさい。答えは、1・2・3・4から最もよいものを一つえらびなさい。"},
  {skill: R, mondai: 7, kind: "情報検索", count: 2, options: 4, needsContext: true, group: 2, chars: [350, 900], block: "grammar_reading", instruction: "右のページを見て、質問に答えなさい。答えは、1・2・3・4から最もよいものを一つえらびなさい。"},
  {skill: L, mondai: 1, kind: "課題理解", count: 6, options: 4, needsContext: true, group: 1, chars: [150, 480], block: "listening", instruction: "まず質問を聞いてください。それから話を聞いて、問題用紙の1から4の中から、最もよいものを一つえらんでください。"},
  {skill: L, mondai: 2, kind: "ポイント理解", count: 6, options: 4, needsContext: true, group: 1, chars: [150, 480], block: "listening", instruction: "まず質問を聞いてください。そのあと、問題用紙を見てください。それから話を聞いて、1から4の中から、最もよいものを一つえらんでください。"},
  {skill: L, mondai: 3, kind: "概要理解", count: 3, options: 4, needsContext: true, group: 1, chars: [150, 480], block: "listening", instruction: "話の前に質問はありません。まず話を聞いてください。それから、質問とせんたくしを聞いて、1から4の中から、最もよいものを一つえらんでください。"},
  {skill: L, mondai: 4, kind: "発話表現", count: 4, options: 3, needsContext: true, group: 1, chars: [15, 90], block: "listening", instruction: "場面の説明を聞いてください。その人は何と言いますか。1から3の中から、最もよいものを一つえらんでください。"},
  {skill: L, mondai: 5, kind: "即時応答", count: 9, options: 3, needsContext: true, group: 1, chars: [8, 70], block: "listening", instruction: "まず文を聞いてください。それから、そのへんじを聞いて、1から3の中から、最もよいものを一つえらんでください。"},
];

// Per level: the 問題 layout, the levels its targets and kanji may come from
// (its own and those below it), the sets never used for drills or Quick round
// questions (unseen-passage mocks, as HELD_OUT is for N2), and whether the
// layout was checked against jlpt.jp. `confirmed` is false for N3: the site
// was closed for maintenance on 26 Nov 2026, so the counts are the published
// composition as known, to be checked against the page before scores count.
export const SET_LEVELS = Object.freeze({
  N3: Object.freeze({blueprint: Object.freeze(N3.map(Object.freeze)), draws: Object.freeze(["N5", "N4", "N3"]), heldOut: Object.freeze(["n3-set-9", "n3-set-10"]), confirmed: false}),
});
export const blueprintOf = level => SET_LEVELS[level]?.blueprint || null;
export const expectedRows = level => (blueprintOf(level) || []).flatMap(b => Array(b.count).fill(b));
export const heldOut = level => SET_LEVELS[level]?.heldOut || [];
export const setLevel = id => { const m = /^n([1-5])-set-\d+$/.exec(String(id || "")); return m ? "N" + m[1] : ""; };
export const setsDir = level => "./sets/" + String(level).toLowerCase() + "/";
export const setPath = (level, edition, id) => setsDir(level) + edition + "/" + id + ".json";

// The page's half. index(level) resolves to {level, edition, sets} or null;
// set(level, id) to the set, or null when it cannot be had (offline and never
// fetched, unknown id). A failed fetch is tried again next time. keep(level)
// fetches every set of the level so the worker holds them: call it when the
// boss is still far off, so the boss never needs the network when it arrives.
export function createSets({fetchImpl = (...args) => fetch(...args), base = "./sets/"} = {}) {
  const indexes = new Map(), kept = new Map();
  const dir = level => base + String(level).toLowerCase() + "/";
  const json = url => fetchImpl(url).then(r => (r && r.ok ? r.json() : null)).catch(() => null);
  function index(level) {
    if (!SET_LEVELS[level]) return Promise.resolve(null);
    if (!indexes.has(level)) indexes.set(level, json(dir(level) + "index.json")
      .then(i => (i && i.edition && i.sets && typeof i.sets === "object" ? i : null))
      .then(i => { if (!i) indexes.delete(level); return i; }));
    return indexes.get(level);
  }
  function set(level, id) {
    const key = level + "/" + id;
    if (!kept.has(key)) kept.set(key, index(level)
      .then(i => (i && Object.hasOwn(i.sets, id) ? json(dir(level) + i.edition + "/" + id + ".json") : null))
      .then(s => (s && s.id === id && Array.isArray(s.questions) ? s : null))
      .then(s => { if (!s) kept.delete(key); return s; }));
    return kept.get(key);
  }
  const keep = async level => { const i = await index(level); if (!i) return []; const got = await Promise.all(Object.keys(i.sets).map(id => set(level, id))); return got.filter(Boolean).map(s => s.id); };
  return {index, set, keep};
}

// A set as exam rows, as realisticRows (n2-forms.js) makes for N2: each
// question carries its 問題 number, kind and instruction; skill is 0–3.
export function levelRows(set) {
  const skills = [V, G, R, L], blueprint = blueprintOf(set.level || setLevel(set.id)) || [];
  return set.questions.map((q, index) => {
    const b = blueprint.find(b => b.skill === q.skill && b.mondai === q.mondai);
    return {...q, index, skill: skills.indexOf(q.skill), kind: b?.kind, instruction: b?.instruction, block: b?.block,
      label: (q.skill === L ? "聴解 " : "") + "問題" + q.mondai + " · " + (b?.kind || ""), options: q.choices.length, source: set.id + "#" + index};
  });
}
