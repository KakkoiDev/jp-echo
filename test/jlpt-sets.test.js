// The authored mock exams of the levels other than N2: each level's blueprint,
// every shipped set held to it, and delivery on demand (jlpt-sets.js).
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync, existsSync, readdirSync} from "node:fs";
import {SET_LEVELS, LISTENING, READY_KEY, FORMS, blueprintOf, expectedRows, groupsOf, bossMinutes, heldOut, setLevel, setForm, setPath, createSets, levelRows, mixPaper} from "../jlpt-sets.js";
import {validateLevelSet, validatePlan, levelProfile, cuesOf, OUTSIDE_KANJI} from "../tools/validate-level-set.mjs";
import {execFileSync} from "node:child_process";
import {alike, likeness, LIMIT} from "../tools/compare-level-sets.mjs";
import {plan} from "../tools/build-level-sets.mjs";
import {mkdtempSync, writeFileSync, mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {pathToFileURL} from "node:url";
import {TAG} from "../n2-comprehension.js";
import {SETS_EDITION, editionOf, realisticPaperId, realisticRows, setFile} from "../n2-forms.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const profiles = Object.fromEntries(read("../datasets/jlpt/exam-profiles.json").profiles.map(p => [p.level, p]));
const shipped = level => { const dir = new URL("../sets/" + level.toLowerCase() + "/", import.meta.url); return existsSync(new URL("index.json", dir)) ? read("../sets/" + level.toLowerCase() + "/index.json") : null; };

test("the N3 blueprint is the JLPT N3 paper: 35 vocabulary, 23 grammar, 16 reading, 28 listening", () => {
  const count = skill => blueprintOf("N3").filter(b => b.skill === skill).reduce((n, b) => n + b.count, 0);
  assert.deepEqual(["Vocabulary", "Grammar", "Reading", "Listening"].map(count), [35, 23, 16, 28]);
  assert.equal(expectedRows("N3").length, 102);
  // 問題 by 問題, as the 2018 official workbook and the published composition have it.
  const per = skill => blueprintOf("N3").filter(b => b.skill === skill).map(b => b.count);
  assert.deepEqual(["Vocabulary", "Grammar", "Reading", "Listening"].map(per), [[8, 6, 11, 5, 5], [13, 5, 5], [4, 6, 4, 2], [6, 6, 3, 4, 9]]);
  assert.deepEqual(profiles.N3.timedBlocks.map(b => b.minutes), [30, 70, 40]);
  assert.ok(blueprintOf("N3").filter(b => b.skill === "Listening").every(b => LISTENING[b.kind]), "every listening 問題 says how it is presented");
  assert.ok(LISTENING["概要理解"].spoken && LISTENING["発話表現"].printed === "picture");
  const three = blueprintOf("N3").filter(b => b.options === 3).map(b => b.kind);
  assert.deepEqual(three, ["発話表現", "即時応答"], "only the two spoken-reply 問題 have three choices");
});

test("every level's blueprint fits its exam profile: each 問題 sits under one of the level's clocks", () => {
  for (const [level, {blueprint, draws, heldOut: held}] of Object.entries(SET_LEVELS)) {
    const blocks = profiles[level].timedBlocks.map(b => b.id);
    assert.ok(blueprint.every(b => b.instruction && b.kind && blocks.includes(b.block)), level);
    assert.deepEqual([...new Set(blueprint.map(b => b.block))], blocks, level + " uses every clock, in order");
    assert.equal(draws.at(-1), level); assert.equal(held.length, 2, level + " holds two sets out");
    assert.ok(held.every(id => setLevel(id) === level));
    assert.ok(blueprint.filter(b => b.needsContext).every(b => groupsOf(b).reduce((a, n) => a + n, 0) === b.count && b.chars[0] < b.chars[1]), level + ": groups add up to the 問題");
    assert.ok(blueprint.filter(b => b.skill === "Listening").every(b => LISTENING[b.kind]), level);
    assert.equal(new Set(blueprint.map(b => b.skill + b.mondai)).size, blueprint.length, level + ": 問題 numbers are not repeated");
  }
});

test("the other levels: N5 and N4 have no 概要理解, N4 adds 用法, N1 has no 表記 and adds 統合理解", () => {
  const kinds = level => blueprintOf(level).map(b => b.kind), total = (level, form) => expectedRows(level, form).length;
  assert.deepEqual(["N5", "N4", "N3", "N1"].map(l => total(l)), [67, 85, 102, 100]);
  assert.ok(!kinds("N5").includes("概要理解") && !kinds("N5").includes("用法") && kinds("N4").includes("用法") && !kinds("N4").includes("概要理解"));
  assert.ok(!kinds("N1").includes("表記") && kinds("N1").filter(k => k === "統合理解").length === 2);
  assert.deepEqual(groupsOf(blueprintOf("N1").at(-1)), [1, 2], "N1's last listening 問題: one question, then two on one talk");
  assert.deepEqual(Object.keys(SET_LEVELS).filter(l => !SET_LEVELS[l].confirmed), ["N5", "N4", "N1"], "only N3's layout has been read against the official paper");
  assert.deepEqual(SET_LEVELS.N1.draws, ["N5", "N4", "N3", "N2", "N1"]);
});

test("a mini-boss is the same paper at about a third of the length, with every kind of question", () => {
  assert.deepEqual(FORMS, ["boss", "mini"]);
  for (const level of Object.keys(SET_LEVELS)) {
    const boss = blueprintOf(level), mini = blueprintOf(level, "mini");
    assert.deepEqual(mini.map(b => b.kind), boss.map(b => b.kind), level);
    const share = expectedRows(level, "mini").length / expectedRows(level).length;
    assert.ok(share > 0.3 && share < 0.5, level + " " + share);
    assert.ok(mini.every(b => b.count >= 1 && groupsOf(b).reduce((a, n) => a + n, 0) === b.count), level);
  }
  assert.equal(setForm("n4-mini-3"), "mini"); assert.equal(setForm("n4-set-3"), "boss"); assert.equal(setLevel("n4-mini-3"), "N4"); assert.equal(setLevel("n2-set-3"), "N2"); assert.equal(setLevel("x"), "");
  // Half the standard time (owner, 26 Nov 2026): N3 sits 30/70/40, so its boss sits 15/35/20.
  assert.deepEqual(bossMinutes(profiles.N3, "N3"), {vocabulary: 15, grammar_reading: 35, listening: 20});
  assert.deepEqual(bossMinutes(profiles.N1, "N1"), {knowledge_reading: 55, listening: 28});
  const mini = bossMinutes(profiles.N5, "N5", "mini");
  assert.ok(Object.values(mini).every(m => m >= 3) && mini.listening < bossMinutes(profiles.N5, "N5").listening);
});

test("a plan gives each paper its own candidates, a theme and balanced answer positions", () => {
  const dir = mkdtempSync(tmpdir() + "/echo-plan-");
  execFileSync("node", ["tools/plan-level-set.mjs", "N4", "boss", "1-3", dir], {cwd: new URL("../", import.meta.url)});
  execFileSync("node", ["tools/plan-level-set.mjs", "N4", "mini", "1-1", dir], {cwd: new URL("../", import.meta.url)});
  const plans = [1, 2, 3].map(n => JSON.parse(readFileSync(dir + "/n4-set-" + n + ".plan.json", "utf8"))), seen = new Set();
  for (const plan of plans) {
    assert.equal(plan.keys.length, 85);
    const four = plan.keys.filter((k, i) => expectedRows("N4")[i].options === 4), counts = [1, 2, 3, 4].map(k => four.filter(x => x === k).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, "each position equally often");
    for (const b of blueprintOf("N4").filter(b => b.targeted)) assert.equal(plan.pools[b.skill + " 問題" + b.mondai].length, b.count * 3);
    for (const t of Object.values(plan.pools).flat().filter(t => t[0] === "word")) { const k = JSON.stringify(t); assert.ok(!seen.has(k), "no word is offered to two papers planned together: " + k); seen.add(k); }
    assert.match(readFileSync(dir + "/" + plan.id + ".brief.md", "utf8"), /Where each right answer goes/);
  }
  assert.equal(new Set(plans.map(p => p.theme)).size, 3);
  assert.equal(JSON.parse(readFileSync(dir + "/n4-mini-1.plan.json", "utf8")).keys.length, expectedRows("N4", "mini").length);
  // A set is held to its plan.
  const index = shipped("N3"), set = read("../" + setPath("N3", index.edition, "n3-set-1").slice(2));
  const plan = {id: set.id, theme: set.theme, keys: set.questions.map(q => q.key), pools: {"Vocabulary 問題1": [set.questions[0].target]}};
  assert.match(validatePlan(set, plan).join("\n"), /#2: target .* is not one of the plan's candidates/);
  assert.equal(validatePlan(set, {...plan, pools: {}}).length, 0);
  assert.match(validatePlan(set, {...plan, pools: {}, keys: plan.keys.map(k => k % 3 + 1)}).join(), /the plan puts the right answer/);
});

test("every shipped set passes its level's validator, sits within its level and becomes exam rows", () => {
  assert.ok(shipped("N3"), "N3 has sets");
  for (const level of Object.keys(SET_LEVELS)) {
    const index = shipped(level); if (!index) continue;
    assert.equal(index.level, level);
    const dir = "../sets/" + level.toLowerCase() + "/" + index.edition + "/";
    const files = readdirSync(new URL(dir, import.meta.url)).filter(f => f.endsWith(".json"));
    assert.ok(files.length >= 2, level);
    assert.ok(files.every(f => setLevel(f.slice(0, -5)) === level), level);
    assert.deepEqual(readdirSync(new URL("../sets/" + level.toLowerCase() + "/", import.meta.url)).sort(), [index.edition, "index.json"].sort(), level + " ships one edition");
    assert.deepEqual(Object.keys(index.sets).sort(), files.map(f => f.slice(0, -5)).sort(), level + " index names exactly the files");
    const passages = new Set(), targets = new Map();
    for (const f of files) {
      const set = read(dir + f);
      assert.equal(set.id, f.slice(0, -5)); assert.equal(index.sets[set.id], set.theme);
      assert.deepEqual(validateLevelSet(set), [], f);
      assert.ok(levelProfile(set).share <= OUTSIDE_KANJI, f);
      const rows = levelRows(set);
      assert.equal(rows.length, expectedRows(level, setForm(set.id)).length, f);
      assert.ok(rows.every(r => r.instruction && r.label.includes("問題") && r.skill >= 0 && r.source === set.id + "#" + r.index), f);
      assert.ok(rows.filter(r => r.skill === 3).every(r => r.listening && r.cues.length), f + ": listening rows carry their presentation and cues");
      const own = new Set();
      for (const q of set.questions) {
        if (q.skill === "Reading" || q.skill === "Listening") assert.ok(q.tags.every(t => TAG[t]) && cuesOf(q).length && cuesOf(q).every(c => q.context.includes(c)), f);
        if (q.context.length > 60 && !own.has(q.context)) { own.add(q.context); assert.ok(!passages.has(q.context), f + " repeats a passage of another set"); }
        if (q.target) targets.set(JSON.stringify(q.target), (targets.get(JSON.stringify(q.target)) || 0) + 1);
      }
      for (const c of own) passages.add(c);
    }
    // Across a level's sets one item is not asked again and again.
    assert.ok([...targets.values()].every(n => n <= Math.max(2, Math.ceil(files.length / 3))), level + " repeats a target across sets too often");
  }
});

test("no two papers of a level ask nearly the same question", () => {
  // Writers working apart reach for the same scenes; a player who meets one
  // question in two bosses is tested on memory (tools/compare-level-sets.mjs).
  assert.ok(likeness("あした、いっしょに山へ行きませんか。", "あした、いっしょにテニスをしませんか。") >= LIMIT);
  assert.ok(likeness("すみません、駅はどこですか。", "きのうは何を食べましたか。") < 0.3);
  for (const level of Object.keys(SET_LEVELS)) {
    const index = shipped(level); if (!index) continue;
    const sets = Object.keys(index.sets).map(id => read("../" + setPath(level, index.edition, id).slice(2)));
    assert.deepEqual(alike(sets).map(p => p.a.set + "#" + p.a.n + " ~ " + p.b.set + "#" + p.b.n), [], level);
  }
});

test("a mixed paper takes each block from a written paper and never splits a text", () => {
  for (const level of Object.keys(SET_LEVELS)) {
    const index = shipped(level); if (!index || Object.keys(index.sets).length < 3) continue;
    const sets = Object.keys(index.sets).map(id => read("../" + setPath(level, index.edition, id).slice(2)));
    const byId = Object.fromEntries(sets.map(s => [s.id, s])), a = mixPaper(level, sets, {seed: 3});
    assert.equal(a.id, level.toLowerCase() + "-mix-3"); assert.equal(a.questions.length, expectedRows(level).length, level);
    assert.deepEqual(mixPaper(level, sets, {seed: 3}).sources, a.sources, "the same seed is the same paper");
    assert.notDeepEqual(mixPaper(level, sets, {seed: 4}).sources, a.sources);
    assert.ok(new Set(a.sources.map(s => s.split("#")[0])).size > 1, level + ": drawn from more than one paper");
    assert.ok(a.sources.every(s => !heldOut(level).includes(s.split("#")[0])), "held-out papers are never mixed in");
    expectedRows(level).forEach((b, i) => { const q = a.questions[i]; assert.ok(q.skill === b.skill && q.mondai === b.mondai, level + " #" + (i + 1)); });
    // Every question sits with exactly the questions that share its text in its own paper.
    for (const q of a.questions.filter(q => q.context)) {
      const [id] = q.source.split("#"), mates = byId[id].questions.map((x, i) => (x.context === q.context ? id + "#" + i : "")).filter(Boolean);
      assert.ok(mates.every(m => a.sources.includes(m)), level + ": a text keeps all its questions");
    }
    assert.equal(new Set(a.sources).size, a.sources.length);
    const targets = a.questions.filter(q => q.target).map(q => JSON.stringify(q.target));
    assert.equal(new Set(targets).size, targets.length, level + ": no item is asked twice in one sitting");
    const rows = levelRows(a); assert.ok(rows.every((r, i) => r.source === a.sources[i] && r.instruction));
    // What the player met most comes last: a block seen ten times is not picked while fresh ones remain.
    const first = a.sources[0], again = mixPaper(level, sets, {seed: 3, seen: {[first]: 10}});
    assert.notEqual(again.sources[0], first);
  }
  assert.equal(mixPaper("N3", []), null);
});

test("the validator refuses what would make a paper unfair or off-level", () => {
  const index = shipped("N3");
  const id = Object.keys(index.sets)[0], fresh = () => read("../" + setPath("N3", index.edition, id).slice(2));
  const broken = change => { const set = fresh(); change(set); return validateLevelSet(set).join("\n"); };
  const group = (s, mondai, skill = "Reading") => s.questions.filter(q => q.skill === skill && q.mondai === mondai);
  assert.equal(broken(() => {}), "");
  assert.match(broken(s => s.questions.pop()), /expected 102 questions/);
  assert.match(broken(s => { s.questions[0].target = ["word", "就任", "しゅうにん"]; }), /not in the N5\/N4\/N3 inventories/);
  assert.match(broken(s => { s.questions[0].choices[s.questions[0].key - 1] = "ちがう"; }), /漢字読み key must be the reading/);
  assert.match(broken(s => { s.questions.at(-1).choices.push("はい。"); }), /needs 3 non-empty choices/);
  assert.match(broken(s => { s.questions.at(-1).cue = "この文は台本にありません"; }), /cue must be/);
  assert.match(broken(s => { s.questions.at(-1).cue = []; }), /cue must be/);
  assert.match(broken(s => { s.questions.at(-1).tags = ["gist"]; }), /tags from TAGS/);
  assert.match(broken(s => { group(s, 5)[0].context += "。"; }), /must share one context/);
  assert.match(broken(s => { const [a, b] = group(s, 4); b.context = a.context.replace("。", "、"); b.cue = a.cue; }), /a context is used twice/, "punctuation does not make a passage new");
  assert.match(broken(s => { const g = group(s, 3, "Grammar"); g[1].prompt = g[0].prompt; }), /each blank is asked about once/);
  assert.match(broken(s => { const q = s.questions.find(q => q.skill === "Listening"); q.context = q.context.replace(/^[^：]+：/, ""); }), /speaker label/);
  assert.match(broken(s => { const q = s.questions.find(q => q.skill === "Listening"); q.context = q.context.replace(/^[^：]+：/, "架空です："); }), /speaker label/, "a made-up speaker is refused");
  assert.match(broken(s => { for (const q of s.questions) if (q.choices.length === 4) { const right = q.choices[q.key - 1]; q.choices = [right, ...q.choices.filter(c => c !== right)]; q.key = 1; } }), /keys are unbalanced/);
  assert.match(broken(s => { const more = "〈" + "憂鬱な薔薇の挨拶".repeat(8) + "〉"; for (const x of group(s, 6)) x.context = more + x.context.slice(more.length); }), /kanji are outside/);
});

test("what the validator cannot see is named, so nobody mistakes OK for correct", () => {
  // A wrong key inside the range, a cue that is in the text but beside the
  // point, and hard words written in kana all pass: only the blind solve and
  // the review (docs/JLPT-LEVEL-SETS.md) can catch them.
  const index = shipped("N3"), set = read("../" + setPath("N3", index.edition, Object.keys(index.sets)[0]).slice(2));
  const q = set.questions.find(q => q.skill === "Vocabulary" && q.mondai === 3); q.key = q.key % 4 + 1;
  assert.deepEqual(validateLevelSet(set).filter(p => !/unbalanced/.test(p)), []);
  assert.match(readFileSync(new URL("../docs/JLPT-LEVEL-SETS.md", import.meta.url), "utf8"), /What the validator cannot see/);
});

const fakeFetch = (calls, {fail = () => false, files}) => async url => { calls.push(url); const f = fail(url); if (f === "throw") throw new Error("offline"); if (f || !(url in files)) return {ok: false, status: 500}; return {ok: true, json: async () => files[url]}; };
const paper = id => ({id, level: "N3", questions: Array(102).fill({})});
const memory = () => { const m = new Map(); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v)}; };
const E1 = {"./sets/n3/index.json": {level: "N3", edition: "e1", sets: {"n3-set-1": "a", "n3-set-2": "b"}}, "./sets/n3/e1/n3-set-1.json": paper("n3-set-1"), "./sets/n3/e1/n3-set-2.json": paper("n3-set-2")};

test("sets are fetched on demand: the index, then only the set asked for; a failure is tried again", async () => {
  let offline = true; const calls = [], sets = createSets({fetchImpl: fakeFetch(calls, {fail: () => offline && "throw", files: E1}), store: memory()});
  assert.equal(await sets.set("N3", "n3-set-1"), null, "offline and never fetched");
  offline = false;
  assert.equal((await sets.set("N3", "n3-set-1")).id, "n3-set-1");
  assert.equal((await sets.set("N3", "n3-set-1")).id, "n3-set-1");
  assert.deepEqual(calls.slice(1), ["./sets/n3/index.json", "./sets/n3/e1/n3-set-1.json"], "one index, one set, once");
  assert.equal(await sets.set("N3", "n3-set-99"), null, "a set the index does not name is never asked for");
  assert.equal(await sets.set("N3", "n2-set-2"), null); assert.equal(await sets.index("N2"), null, "N2's sets ship with the app (n2-sets/)");
  const empty = createSets({fetchImpl: fakeFetch([], {files: {...E1, "./sets/n3/e1/n3-set-1.json": {id: "n3-set-1", level: "N3", questions: []}}}), store: memory()});
  assert.equal(await empty.set("N3", "n3-set-1"), null, "a paper that is not whole is not a paper");
  assert.deepEqual(heldOut("N3"), ["n3-set-9", "n3-set-10"]);
});

test("a boss is gated on the edition the device holds whole, and a newer index never takes it away", async () => {
  const store = memory(); let files = {...E1}, down = () => false;
  const open = () => createSets({fetchImpl: fakeFetch([], {fail: url => down(url), files}), store});
  let sets = open();
  assert.equal(sets.ready("N3"), null, "nothing kept yet: no boss");
  assert.deepEqual(await sets.keep("N3"), {edition: "e1", sets: ["n3-set-1", "n3-set-2"], ready: true});
  assert.equal(JSON.parse(store.getItem(READY_KEY)).N3.edition, "e1");
  // A new edition is published; this device has only seen its index (the
  // worker still answers e1's files from its cache, e2's are not here).
  files = {...E1, "./sets/n3/index.json": {level: "N3", edition: "e2", sets: {"n3-set-1": "a", "n3-set-2": "b"}}};
  sets = open();
  assert.equal((await sets.index("N3")).edition, "e2");
  assert.equal((await sets.set("N3", "n3-set-1")).id, "n3-set-1", "the edition held whole still opens");
  assert.deepEqual(await sets.keep("N3"), {edition: "e1", sets: ["n3-set-1", "n3-set-2"], ready: false}, "e2 is not promoted until all of it is here");
  assert.equal(sets.ready("N3").edition, "e1");
  // The index answers 500, or the network is gone: the kept edition stays.
  down = url => url.endsWith("index.json"); sets = open();
  assert.equal(await sets.index("N3"), null);
  assert.equal((await sets.set("N3", "n3-set-2")).id, "n3-set-2");
  assert.equal((await sets.keep("N3")).edition, "e1");
  down = () => false; assert.equal((await sets.index("N3")).edition, "e2", "and the index is asked for again");
  // e2 arrives whole: now it is the edition, and an old attempt still opens its e1 paper by edition.
  files = {...files, "./sets/n3/e2/n3-set-1.json": paper("n3-set-1"), "./sets/n3/e2/n3-set-2.json": paper("n3-set-2")};
  sets = open();
  assert.deepEqual(await sets.keep("N3"), {edition: "e2", sets: ["n3-set-1", "n3-set-2"], ready: true});
  assert.equal((await sets.set("N3", "n3-set-1", "e1")).id, "n3-set-1");
  assert.equal(await sets.set("N3", "n3-set-1", "e0"), null);
});

test("the build is all or nothing and an edition never changes", () => {
  const index = shipped("N3"), dir = mkdtempSync(tmpdir() + "/echo-sets-"), root = pathToFileURL(dir + "/sets/"), src = dir + "/in";
  mkdirSync(src); mkdirSync(dir + "/sets/n3/" + index.edition, {recursive: true});
  const ids = Object.keys(index.sets), text = id => readFileSync(new URL("../" + setPath("N3", index.edition, id).slice(2), import.meta.url), "utf8");
  for (const id of ids) { writeFileSync(src + "/" + id + ".json", text(id)); writeFileSync(dir + "/sets/n3/" + index.edition + "/" + id + ".json", text(id)); }
  writeFileSync(dir + "/sets/n3/index.json", JSON.stringify(index));
  assert.deepEqual(plan(src, root).problems, [], "the same bytes again is no change");
  const bad = JSON.parse(text(ids[1])); bad.questions.pop(); writeFileSync(src + "/" + ids[1] + ".json", JSON.stringify(bad));
  assert.match(plan(src, root, "next").problems.join(), /expected 102 questions/, "one rejected file stops the run; the caller writes nothing");
  const edited = JSON.parse(text(ids[1])); edited.theme += "２"; writeFileSync(src + "/" + ids[1] + ".json", JSON.stringify(edited));
  assert.match(plan(src, root).problems.join(), /an edition never changes/);
  const next = plan(src, root, "next");
  assert.deepEqual(next.problems, []); assert.equal(JSON.parse(next.indexes[0][1]).edition, "next");
  assert.ok(next.writes.every(([url]) => url.pathname.includes("/n3/next/")));
  writeFileSync(src + "/" + ids[0] + ".json", "{}"); 
  assert.ok(plan(src, root, "next").problems.length, "a new edition must bring every set");
});

test("the exam opens bundled N2 bosses without the downloaded levels, including on resume", async () => {
  const screen = readFileSync(new URL("../n2-mock.js", import.meta.url), "utf8");
  const route = screen.match(/^const isLevelSet = .*;$/m)[0];
  const loader = screen.slice(screen.indexOf("async function getPaper("), screen.indexOf("/* ───────── Hub"));
  const files = [], papers = new Map(), id = "n2-set-2";
  const getPaper = vm.runInNewContext(route + "\n" + loader + "\ngetPaper", {
    SET_LEVELS, setLevel, materials: async () => {},
    access: async (_, op, value) => op === "get" ? papers.get(value) : papers.set(value.id, value),
    realistic: book => book === id, realisticPaperId, realisticRows, setFile, SETS_EDITION, editionOf,
    titleOf: book => book, json: async file => { files.push(file); return read("../" + file); },
    gameSets: {ready: () => assert.fail("a bundled N2 boss must not use the downloaded level loader")},
  });
  const paper = await getPaper(id);
  assert.equal(paper.id, realisticPaperId(id));
  assert.deepEqual(paper.questions, realisticRows(read("../n2-sets/" + id + ".json")));
  assert.equal(await getPaper(id, paper.id), paper);
  assert.deepEqual(files, [setFile(id)]);
});

test("the worker keeps a set once served, in its own cache, and never precaches sets", async () => {
  const script = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.ok(!/["']\.\/sets\//.test(script.match(/const ASSETS=\[.*?\];/s)[0]), "sets are not in the precache");
  const stores = {}, handlers = {}; let online = true, broken = false, network = 0;
  const caches = {open: async name => { const m = stores[name] ||= new Map(); return {match: async r => m.get(r.url), put: async (r, v) => m.set(r.url, v)}; }, keys: async () => [], delete: async () => {}};
  const self = {location: {origin: "https://echo.test"}, registration: {scope: "https://echo.test/"}, clients: {claim: async () => {}}, addEventListener: (n, h) => handlers[n] = h};
  vm.runInNewContext(script, {self, URL, Request: class {}, Response: class {}, caches, fetch: async r => { network++; if (!online) throw new Error("offline"); return {ok: !broken, status: broken ? 500 : 200, body: r.url, clone() { return this; }}; }});
  const get = async path => { let p; handlers.fetch({request: {url: "https://echo.test" + path, method: "GET", mode: "cors"}, respondWith: x => p = x}); return p; };
  const file = "/" + setPath("N3", shipped("N3").edition, "n3-set-1").slice(2);
  assert.ok(existsSync(new URL(".." + file, import.meta.url)));
  assert.equal((await get(file)).body, "https://echo.test" + file);
  await get("/sets/n3/index.json");
  assert.deepEqual(Object.keys(stores), ["jp-echo-sets"]);
  broken = true;
  assert.ok((await get("/sets/n3/index.json")).ok, "a 500 for the index answers with the kept copy");
  assert.equal((await get("/sets/n3/x/n3-set-7.json")).status, 500, "a set never served has nothing to fall back to");
  assert.equal(stores["jp-echo-sets"].size, 2, "a failed answer is not kept");
  broken = false; online = false; const before = network;
  assert.equal((await get(file)).body, "https://echo.test" + file, "kept offline: a boss needs no network");
  assert.equal(network, before, "a kept set never asks the network");
  assert.ok((await get("/sets/n3/index.json")).ok, "the index falls back to its kept copy");
});
