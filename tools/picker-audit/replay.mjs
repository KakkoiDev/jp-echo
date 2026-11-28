// Replays Quick round's card picker for several kinds of player and checks its rules on every round.
//   node tools/picker-audit/replay.mjs                 four fresh players
//   node tools/picker-audit/replay.mjs --state f.json  plus a player from a saved N2 file (echo-n2.json: {game, recall})
// It prints, per player: round sizes, the kinds asked, how far items climbed their ladders, and every rule broken
// (an item twice in a round, a long card in a round, a card inside its rest, a card off its ladder rung, a miss not
// back). docs/PICKER-AUDIT-HANDOFF.md says which flags are intended. Never commit a learner's saved state.
import {readFileSync} from "node:fs";
const R = new URL("../../", import.meta.url).pathname, arg = process.argv.indexOf("--state"), statePath = arg > 0 ? process.argv[arg + 1] : null;
const G = await import(R + "n2-game.js"); const {examplesFromDecks} = await import(R + "day-radio.js"); const {READINGS} = await import(R + "kanji-readings.js");
const read = p => JSON.parse(readFileSync(R + p, "utf8")), items = f => read(f).items;
const inventory = read("n2-inventory.json"), examples = examplesFromDecks(inventory, [read("decks/n2-words.json"), read("decks/n2-grammar.json")]);
const ids = Object.keys(read("n2-sets/index.json")), sets = ids.map(id => read("n2-sets/" + id + ".json"));
const extras = {paraphrase: items("n2-paraphrase.json"), pairs: items("n2-pairs.json"), ordering: items("n2-ordering.json"), pieces: read("n2-word-pieces.json").pieces, gapWrong: read("n2-gap-wrong.json").wrong};
const n2Cards = G.gamePool({inventory, examples, sets, sat: new Set(["n2-set-2"]), parts: read("n2-kanji-parts.json"), grammarBlocks: read("n2-grammar-blocks.json"), extras});
const n2Pool = n2Cards.filter(q => !G.grammarBlockCard(q)), grammarCards = n2Cards.filter(G.grammarBlockCard);
const man = read("levels/manifest.json"), review = read("level-review.json");
const lvl = l => G.gamePool({inventory: read("levels/" + man.version + "/" + l.toLowerCase() + ".json"), level: l, review});
const levelsFrom = l => ["N5", "N4", "N3", "N2", "N1"].slice(["N5", "N4", "N3", "N2", "N1"].indexOf(l)).map(x => man.kanji[x]).join("");
const saved = statePath ? JSON.parse(readFileSync(statePath, "utf8")) : null;
function run(name, {pool, reviewPool = [], kanji = null, grammar = null, kanjiOrder = "", glyphs = [], kana = [], state = {}, recall = [], rate = .7, rounds = 200, boss = []}) {
  let st = state, seed = 7, now = Date.parse("2026-11-29T09:00:00Z"); const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const v = {}, bump = (k, ex) => { v[k] = v[k] || {n: 0, ex: []}; v[k].n++; if (v[k].ex.length < 3) v[k].ex.push(ex); };
  const kinds = {}; let recov = 0, last = [], sizes = new Set();
  const stepsAtStart = {...(st.step || {})};
  for (let r = 0; r < rounds; r++) {
    if (r && r % 20 === 0) now += 6 * 3600_000;
    const slump = G.inSlump(st); if (slump) recov++;
    const bossNow = G.bossQueue({cards: boss, state: st, key: "b1"}); const {round} = G.nextRound({pool, review: reviewPool, kanji, grammarCards: grammar, glyphs, kana, kanjiOrder, state: st, recall, random, now, boss: bossNow});
    sizes.add(round.length);
    if (round.length > G.ROUND_SIZE) bump("round over 10", round.length);
    const gate = G.ladderGate([...pool, ...reviewPool, ...(kanji?.examples || [])], st.step || {}, {calm: slump, history: {tried: st.tried, missed: st.missed, wins: st.wins}});
    const keys = new Set();
    for (const q of round) {
      kinds[q.kind] = (kinds[q.kind] || 0) + 1;
      const key = G.stepKey(q); if (keys.has(key)) bump("item twice", round.filter(c => G.stepKey(c) === key).map(c => c.id + (c.comeback ? "(C)" : "") + (c.focus ? "(K:" + c.why + ")" : "") + (c.kind === "kana" ? "(kana)" : "")).join("+")); keys.add(key);
      if (G.LONG_KINDS.has(q.kind) || q.kind === "sprint") bump("long card in a round", q.id);
      if (slump && q.kind === "kana" && !q.comeback) bump("kana in recovery", q.id);
      const seen = st.seen?.[q.id] || 0, lv = st.lv?.[q.id] || 0;
      if (!q.comeback && !q.boss && seen && q.kind !== "kana") { const rest = slump && st.wins?.[q.id] && lv < 5 ? G.CALM_REST : G.restFor(lv); if (now - seen < rest) bump("inside its rest" + (q.focus ? " (kanji place)" : "") + (q.kind === "kana" ? " (kana)" : ""), q.id + " lv" + lv + " " + Math.round((now - seen) / 60000) + "min" + (slump ? " calm" : "")); }
      if (!q.comeback && !q.boss && G.ladderOf(q.kind) && !gate(q)) { const sib = [...pool, ...reviewPool].filter(c => G.stepKey(c) === key).map(c => c.id + ":t" + (st.tried?.[c.id] || 0) + "m" + (st.missed?.[c.id] || 0) + "w" + (st.wins?.[c.id] || 0) + "s" + (st.seen?.[c.id] ? Math.round((now - st.seen[c.id]) / 60000) : "-")); bump("off its rung" + (q.focus ? " (kanji place)" : "") + (q.review ? " (review)" : ""), q.id + " slump " + slump + " step " + (st.step || {})[key] + " " + JSON.stringify(q.why || "") + " sib " + sib.join(" ")); }
    }
    const here = new Set(round.map(q => q.id)), lost = last.filter(id => !here.has(id));
    if (lost.length && !slump && round.length) bump("miss not back", lost.slice(0, 3).join(","));
    last = []; let right = 0;
    for (const q of round) { const ok = random() < rate; if (ok) right++; else last.push(q.id); st = G.rememberAnswer(st, {q, outcome: ok ? "right" : "wrong", fast: ok && random() < .7, now}); now += 9000; }
    st = G.rememberRound(st, {score: 0, questions: round, misses: round.length - right, scored: round.length, now}); now += 20000;
  }
  const steps = Object.values(st.step || {}), climbed = Object.entries(st.step || {}).filter(([k, s]) => s > (stepsAtStart[k] ?? 0)).length;
  // Stuck: answered right 3+ times on one kind, yet the item's step still points at that kind.
  const stuck = [];
  for (const q of pool) { const L = G.ladderOf(q.kind); if (!L) continue; const right = (st.tried?.[q.id] || 0) - (st.missed?.[q.id] || 0); const s = st.step?.[G.stepKey(q)]; if (right >= 3 && s !== undefined && s <= L.indexOf(q.kind) && L.indexOf(q.kind) < L.length - 1) stuck.push(q.id); }
  console.log("\n== " + name + ": rounds " + rounds + ", recovery " + recov + ", sizes " + [...sizes].join("/"));
  console.log("kinds", JSON.stringify(kinds));
  console.log("items climbed", climbed, "by step", [0,1,2,3,4,5].map(i => i + ":" + steps.filter(x => x === i).length).join(" "), "stuck", stuck.length, stuck.slice(0, 4).join(" "));
  for (const [k, e] of Object.entries(v)) console.log("VIOLATION", k, e.n, JSON.stringify(e.ex));
}
const n2Kanji = G.kanjiCards(READINGS, levelsFrom("N2"), []);
if (saved) run("saved player, N2, 70% right", {pool: n2Pool, grammar: grammarCards, kanjiOrder: G.kanjiOrderOf(n2Pool), glyphs: n2Kanji, state: saved.game, recall: saved.recall || [], boss: n2Pool.filter(q => q.kind === "reading").slice(0, 6)});
run("new N2 player, 70% right", {pool: n2Pool, grammar: grammarCards, kanjiOrder: G.kanjiOrderOf(n2Pool), glyphs: n2Kanji});
run("new N2 player, 40% right", {pool: n2Pool, grammar: grammarCards, kanjiOrder: G.kanjiOrderOf(n2Pool), glyphs: n2Kanji, rate: .4});
const n3 = lvl("N3"), lower3 = [...lvl("N5"), ...lvl("N4")];
run("new N3 player, kanji first", {pool: n3, reviewPool: lower3, kanji: {order: G.askableKanji(man.kanji.N3, [n3, lower3, n2Pool]), examples: [...lower3, ...n2Pool.filter(q => q.kanji)]}, glyphs: G.kanjiCards(READINGS, levelsFrom("N3"), [])});
const n5 = lvl("N5");
run("new N5 player, kana", {pool: n5, kanji: {order: G.askableKanji(man.kanji.N5, [n5, n2Pool]), examples: n2Pool.filter(q => q.kanji)}, glyphs: G.kanjiCards(READINGS, levelsFrom("N5"), []), kana: G.kanaCards()});
