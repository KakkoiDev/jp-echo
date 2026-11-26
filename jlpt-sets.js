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
// context, or up to three of them when the answer needs more than one. tools/validate-level-set.mjs holds a set to its level's blueprint.
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
  {skill: R, mondai: 7, kind: "情報検索", count: 2, options: 4, needsContext: true, group: 2, chars: [350, 900], block: "grammar_reading", instruction: "つぎのお知らせを見て、質問に答えなさい。答えは、1・2・3・4から最もよいものを一つえらびなさい。"},
  {skill: L, mondai: 1, kind: "課題理解", count: 6, options: 4, needsContext: true, group: 1, chars: [150, 480], block: "listening", instruction: "まず質問を聞いてください。それから話を聞いて、問題用紙の1から4の中から、最もよいものを一つえらんでください。"},
  {skill: L, mondai: 2, kind: "ポイント理解", count: 6, options: 4, needsContext: true, group: 1, chars: [150, 480], block: "listening", instruction: "まず質問を聞いてください。そのあと、問題用紙を見てください。それから話を聞いて、1から4の中から、最もよいものを一つえらんでください。"},
  {skill: L, mondai: 3, kind: "概要理解", count: 3, options: 4, needsContext: true, group: 1, chars: [150, 480], block: "listening", instruction: "話の前に質問はありません。まず話を聞いてください。それから、質問とせんたくしを聞いて、1から4の中から、最もよいものを一つえらんでください。"},
  {skill: L, mondai: 4, kind: "発話表現", count: 4, options: 3, needsContext: true, group: 1, chars: [15, 90], block: "listening", instruction: "場面の説明を聞いてください。その人は何と言いますか。1から3の中から、最もよいものを一つえらんでください。"},
  {skill: L, mondai: 5, kind: "即時応答", count: 9, options: 3, needsContext: true, group: 1, chars: [8, 70], block: "listening", instruction: "まず文を聞いてください。それから、そのへんじを聞いて、1から3の中から、最もよいものを一つえらんでください。"},
];

// The other levels, built from the same rows. `I` holds the instruction of
// each kind; N5 and N4 papers print theirs with fewer kanji, which the exam
// screen can restyle. Counts are the published composition as known on 26
// Nov 2026 (after the December 2020 shortening of N4 and N5 and the December
// 2022 shortening of N1 listening); jlpt.jp was closed that day, so these
// three are `confirmed: false` until read against the page and the workbooks.
const I = Object.fromEntries(N3.map(b => [b.kind, b.instruction]));
I["統合理解R"] = "つぎのＡとＢの文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。";
I["主張理解（長文）"] = I["内容理解（長文）"];
I["統合理解"] = "長めの話を聞きます。まず話を聞いてください。それから、質問とせんたくしを聞いて、1から4の中から、最もよいものを一つえらんでください。";
const TARGET = {"漢字読み": "reading", "表記": "spelling", "文脈規定": "meaning", "言い換え類義": "meaning", "用法": "meaning", "文法形式の判断": "meaning"};
const BLOCK = (level, skill) => (skill === L ? "listening" : level === "N1" ? "knowledge_reading" : skill === V ? "vocabulary" : "grammar_reading");
const paper = (level, spec) => { const seen = {}; return spec.map(([skill, kind, count, extra = {}]) => { const mondai = seen[skill] = (seen[skill] || 0) + 1; const context = !(kind in TARGET) && kind !== "文の組み立て";
  return Object.freeze({skill, mondai, kind, count, options: kind === "発話表現" || kind === "即時応答" ? 3 : 4, ...(TARGET[kind] ? {targeted: TARGET[kind]} : {}), ...(kind === "文の組み立て" ? {star: true} : {}),
    ...(context ? {needsContext: true, group: 1} : {}), ...extra, block: BLOCK(level, skill), instruction: I[kind === "統合理解" && skill === R ? "統合理解R" : kind].replace("（５）", "（" + "０１２３４５６"[count] + "）")}); }); };
const N5 = paper("N5", [
  [V, "漢字読み", 7], [V, "表記", 5], [V, "文脈規定", 6], [V, "言い換え類義", 3],
  [G, "文法形式の判断", 9], [G, "文の組み立て", 4], [G, "文章の文法", 4, {group: 4, chars: [180, 420]}],
  [R, "内容理解（短文）", 2, {chars: [70, 220]}], [R, "内容理解（中文）", 2, {group: 2, chars: [200, 400]}], [R, "情報検索", 1, {chars: [150, 520]}],
  [L, "課題理解", 7, {chars: [80, 320]}], [L, "ポイント理解", 6, {chars: [80, 320]}], [L, "発話表現", 5, {chars: [12, 90]}], [L, "即時応答", 6, {chars: [6, 60]}],
]);
const N4 = paper("N4", [
  [V, "漢字読み", 7], [V, "表記", 5], [V, "文脈規定", 8], [V, "言い換え類義", 4], [V, "用法", 4],
  [G, "文法形式の判断", 13], [G, "文の組み立て", 4], [G, "文章の文法", 4, {group: 4, chars: [250, 560]}],
  [R, "内容理解（短文）", 3, {chars: [100, 270]}], [R, "内容理解（中文）", 3, {group: 3, chars: [330, 580]}], [R, "情報検索", 2, {group: 2, chars: [250, 720]}],
  [L, "課題理解", 8, {chars: [110, 420]}], [L, "ポイント理解", 7, {chars: [110, 420]}], [L, "発話表現", 5, {chars: [12, 90]}], [L, "即時応答", 8, {chars: [6, 65]}],
]);
// N1 has no 表記. Its last listening 問題 is two talks: one question, then two
// on one talk (group [1, 2]).
const N1 = paper("N1", [
  [V, "漢字読み", 6], [V, "文脈規定", 7], [V, "言い換え類義", 6], [V, "用法", 6],
  [G, "文法形式の判断", 10], [G, "文の組み立て", 5], [G, "文章の文法", 5, {group: 5, chars: [550, 1150]}],
  [R, "内容理解（短文）", 4, {chars: [170, 340]}], [R, "内容理解（中文）", 9, {group: 3, chars: [430, 780]}], [R, "内容理解（長文）", 4, {group: 4, chars: [850, 1450]}],
  [R, "統合理解", 2, {group: 2, chars: [500, 950]}], [R, "主張理解（長文）", 4, {group: 4, chars: [900, 1550]}], [R, "情報検索", 2, {group: 2, chars: [450, 1250]}],
  [L, "課題理解", 5, {chars: [250, 680]}], [L, "ポイント理解", 6, {chars: [250, 720]}], [L, "概要理解", 5, {chars: [250, 620]}], [L, "即時応答", 11, {chars: [10, 95]}], [L, "統合理解", 3, {group: [1, 2], chars: [450, 1150]}],
]);

// How each listening 問題 is presented on the real paper, which a scored
// sitting must follow (one play, no transcript): `printed` is what the paper
// shows ("choices", "picture" or nothing), `preview` whether there is time to
// read the choices before the talk, `asked` when the question is heard, and
// `spoken` whether the choices themselves are only heard.
export const LISTENING = Object.freeze({
  "課題理解": {printed: "choices", preview: false, asked: "before and after", spoken: false, picture: "sometimes: choices can be pictures"},
  "ポイント理解": {printed: "choices", preview: true, asked: "before and after", spoken: false},
  "概要理解": {printed: "", preview: false, asked: "after", spoken: true},
  "発話表現": {printed: "picture", preview: false, asked: "before", spoken: true, picture: "always: a scene with the speaker marked by an arrow"},
  "即時応答": {printed: "", preview: false, asked: "", spoken: true},
  "統合理解": {printed: "choices in part", preview: false, asked: "after", spoken: false},
});

// Per level: the 問題 layout, the levels its targets and kanji may come from
// (its own and those below it), the sets never used for drills or Quick round
// questions (unseen-passage mocks, as HELD_OUT is for N2; the ids are
// reserved, the sets are written last), and where the layout comes from.
// N3 is the layout of the 2018 official workbook (第二集) and of the published
// composition of test items; an independent audit checked both on 26 Nov
// 2026 (docs/JLPT-LEVEL-SETS.md). The 2012 workbook is three questions
// shorter: 9 文脈規定 and 8 即時応答, 99 in all. The counts are a guide
// (目安): a real sitting can differ by a question or two.
const level = (blueprint, draws, n, extra) => Object.freeze({blueprint: Object.freeze(blueprint.map(Object.freeze)), draws: Object.freeze(draws), heldOut: Object.freeze([n + "-set-9", n + "-set-10"]), ...extra});
export const SET_LEVELS = Object.freeze({
  N5: level(N5, ["N5"], "n5", {layout: "published composition as known (after December 2020)", confirmed: false}),
  N4: level(N4, ["N5", "N4"], "n4", {layout: "published composition as known (after December 2020)", confirmed: false}),
  N3: level(N3, ["N5", "N4", "N3"], "n3", {layout: "2018 workbook and published composition", confirmed: true}),
  N1: level(N1, ["N5", "N4", "N3", "N2", "N1"], "n1", {layout: "published composition as known (listening after December 2022)", confirmed: false}),
});
// The sizes of the groups of a 問題 that share one context, in order.
export const groupsOf = b => (Array.isArray(b.group) ? b.group : Array(Math.ceil(b.count / (b.group || 1))).fill(b.group || 1));
// Two forms of paper. "boss" is the whole exam. "mini" is the mini-boss: the
// same 問題 in the same order at about a third of the length, never fewer than
// one whole group of a 問題, so every kind of question still appears.
export const FORMS = Object.freeze(["boss", "mini"]);
const miniCount = b => { const g = Array.isArray(b.group) ? b.group.at(-1) : b.group || 1; return Math.max(g, Math.round(b.count / 3 / g) * g); };
const miniRow = b => Object.freeze({...b, count: miniCount(b), ...(Array.isArray(b.group) ? {group: b.group.at(-1)} : {})});
export const blueprintOf = (level, form = "boss") => { const full = SET_LEVELS[level]?.blueprint; return !full ? null : form === "mini" ? full.map(miniRow) : full; };
export const expectedRows = (level, form = "boss") => (blueprintOf(level, form) || []).flatMap(b => Array(b.count).fill(b));
export const heldOut = level => SET_LEVELS[level]?.heldOut || [];
// A set's id says its level and form: n3-set-4 is a boss, n3-mini-2 a mini-boss.
export const SET_ID = /^n([1-5])-(set|mini)-(\d+)$/;
export const setLevel = id => { const m = SET_ID.exec(String(id || "")); return m ? "N" + m[1] : ""; };
export const setForm = id => { const m = SET_ID.exec(String(id || "")); return !m ? "" : m[2] === "mini" ? "mini" : "boss"; };
// Half the standard time, as the owner set on 26 Nov 2026: the boss is sat
// and graded under time pressure. Minutes per clock for a level and form.
export const bossMinutes = (profile, level, form = "boss") => Object.fromEntries(profile.timedBlocks.map(b => [b.id, Math.max(3, Math.ceil(b.minutes / 2 * (form === "mini" ? expectedRows(level, "mini").filter(r => r.block === b.id).length / Math.max(1, expectedRows(level).filter(r => r.block === b.id).length) : 1)))]));
export const setsDir = level => "./sets/" + String(level).toLowerCase() + "/";
export const setPath = (level, edition, id) => setsDir(level) + edition + "/" + id + ".json";

// The page's half.
//
// Two editions can be about at once: the one sets/<level>/index.json names
// today, and the one this device holds whole. Only the second is safe for a
// boss, so the loader keeps a small record of it (READY_KEY in localStorage:
// {N3: {edition, sets}}), written by keep(level) only after EVERY set of an
// edition has arrived. A newer index never replaces that record until its own
// sets are all here; until then the device goes on using the edition it has.
//
// index(level)   → today's {level, edition, sets}, or null (offline, broken).
//                  Asked for again after refresh(level) or any failure.
// keep(level)    → fetches every set of today's edition; {edition, sets,
//                  ready}. ready is true once the record names that edition.
//                  Call it when a rank is reached, long before the boss.
// ready(level)   → the record: the edition held whole, or null. Gate the boss
//                  on this, never on index().
// set(level, id) → the set from the edition held whole, else from today's;
//                  null when it cannot be had.
// set(level, id, edition) → that exact edition: how an old attempt
//                  (paper id "<set>@<edition>") reopens its paper.
export const READY_KEY = "echo-jlpt-sets-ready";
const memory = () => { const m = new Map(); return {getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, v); }}; };
const deviceStore = () => { try { if (globalThis.localStorage) return globalThis.localStorage; } catch { /* private mode */ } return memory(); };
const whole = i => !!i && typeof i.edition === "string" && /^[\w.-]+$/.test(i.edition) && !!i.sets && typeof i.sets === "object" && Object.keys(i.sets).every(id => SET_ID.test(id));
export function createSets({fetchImpl = (...args) => fetch(...args), base = "./sets/", store = deviceStore()} = {}) {
  const indexes = new Map(), kept = new Map();
  const dir = level => base + String(level).toLowerCase() + "/";
  const json = url => Promise.resolve().then(() => fetchImpl(url)).then(r => (r && r.ok ? r.json() : null)).catch(() => null);
  const record = () => { try { const all = JSON.parse(store.getItem(READY_KEY) || "{}"); return all && typeof all === "object" ? all : {}; } catch { return {}; } };
  const ready = level => { const r = record()[level]; return whole(r) ? r : null; };
  function index(level) {
    if (!SET_LEVELS[level]) return Promise.resolve(null);
    if (!indexes.has(level)) indexes.set(level, json(dir(level) + "index.json")
      .then(i => (whole(i) && i.level === level ? i : null))
      .then(i => { if (!i) indexes.delete(level); return i; }));
    return indexes.get(level);
  }
  const refresh = level => { indexes.delete(level); return index(level); };
  function file(level, id, edition) {
    const key = level + "/" + edition + "/" + id;
    if (!kept.has(key)) kept.set(key, json(dir(level) + edition + "/" + id + ".json")
      .then(s => (s && s.id === id && s.level === level && Array.isArray(s.questions) && s.questions.length === expectedRows(level, setForm(id)).length ? s : null))
      .then(s => { if (!s) kept.delete(key); return s; }));
    return kept.get(key);
  }
  async function set(level, id, edition) {
    if (!SET_LEVELS[level] || setLevel(id) !== level) return null;
    if (edition) return file(level, id, edition);
    const held = ready(level);
    if (held && Object.hasOwn(held.sets, id)) { const s = await file(level, id, held.edition); if (s) return s; }
    const today = await index(level);
    return today && Object.hasOwn(today.sets, id) ? file(level, id, today.edition) : null;
  }
  async function keep(level) {
    const today = await refresh(level), held = ready(level);
    if (!today) return {edition: held?.edition || "", sets: held ? Object.keys(held.sets) : [], ready: !!held};
    const got = await Promise.all(Object.keys(today.sets).map(id => file(level, id, today.edition)));
    if (got.every(Boolean) && got.length) { try { store.setItem(READY_KEY, JSON.stringify({...record(), [level]: {edition: today.edition, sets: today.sets}})); } catch { /* storage full: stay on the edition held */ } }
    const now = ready(level);
    return {edition: now?.edition || "", sets: now ? Object.keys(now.sets) : [], ready: now?.edition === today.edition};
  }
  return {index, refresh, set, keep, ready};
}

// A set as exam rows, as realisticRows (n2-forms.js) makes for N2: each
// question carries its 問題 number, kind and instruction; skill is 0–3.
export function levelRows(set) {
  const skills = [V, G, R, L], blueprint = blueprintOf(set.level || setLevel(set.id), setForm(set.id)) || [];
  return set.questions.map((q, index) => {
    const b = blueprint.find(b => b.skill === q.skill && b.mondai === q.mondai);
    return {...q, index, skill: skills.indexOf(q.skill), kind: b?.kind, instruction: b?.instruction, block: b?.block,
      label: (q.skill === L ? "聴解 " : "") + "問題" + q.mondai + " · " + (b?.kind || ""), options: q.choices.length, source: set.id + "#" + index,
      ...(q.cue == null ? {} : {cues: Array.isArray(q.cue) ? q.cue : [q.cue]}), ...(q.skill === L && b ? {listening: LISTENING[b.kind]} : {})};
  });
}
