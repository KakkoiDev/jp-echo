// Regenerates words-data.js from JMdict and the JLPT vocabulary lists. Run by hand:
//
//   curl -o data/jmdict/JMdict_e.gz https://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz
//   node tools/build-words-data.mjs
//
// Its own file because its own licence. JMdict is EDRDG's, CC BY-SA 4.0, and
// that obligation travels with words-data.js. Only what the app reads is
// kept: the common words — the ones JMdict itself marks as frequent — and
// every word on a JLPT list, each with one written form, its reading, up to
// three senses of English, the parts of speech that decide how it conjugates,
// and its JLPT level. Around a tenth of the dictionary; the long tail of
// 190,000 entries is not what a learner looks up mid-sentence.
//
// The JLPT lists under tools/jlpt-vocab are Jonathan Waller's (tanos.co.uk,
// CC BY), as collected by jamsinclair and elzup (MIT). A word is on the list
// when its written form and reading both match an entry; kana-only list
// words match a kana-only or usually-kana entry.
import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {gunzipSync} from "node:zlib";

const here = new URL("./", import.meta.url);
const gz = new URL("../data/jmdict/JMdict_e.gz", here), xml = new URL("../data/jmdict/JMdict_e.xml", here);
if (!existsSync(gz) && !existsSync(xml)) throw new Error("No data/jmdict/JMdict_e.gz — download it from https://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz first.");
const text = existsSync(gz) ? gunzipSync(readFileSync(gz)).toString("utf8") : readFileSync(xml, "utf8");
const created = (text.match(/JMdict created: (\d{4}-\d{2}-\d{2})/) || [])[1] || "unknown date";

// JMdict marks frequency on a form: ichi1 (the 10,000-word basic list), news1
// (the top 12,000 in newspapers), spec1/spec2 (common but on neither), gai1
// (common loanwords). nfNN is the newspaper rank in bands of 500, and orders
// a level. ichi2, news2 and gai2 are the next tier down and are not "common".
const COMMON = new Set(["ichi1", "news1", "spec1", "spec2", "gai1"]);
// The parts of speech kept: the ones that say how a word conjugates, plus the
// handful the sheet names. Everything else is dropped rather than shown.
const KEEP_POS = new Set(["v1", "v1-s", "v5u", "v5u-s", "v5k", "v5k-s", "v5g", "v5s", "v5t", "v5n", "v5b", "v5m", "v5r", "v5r-i", "v5aru", "vk", "vs", "vs-i", "vs-s", "vz", "vt", "vi", "adj-i", "adj-ix", "adj-na", "adj-no", "adj-t", "adj-f", "adj-pn", "n", "n-suf", "n-pref", "adv", "adv-to", "exp", "int", "prt", "conj", "pn", "num", "ctr", "pref", "suf", "aux-v", "aux-adj", "aux", "cop"]);

const unescapeXml = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const all = (block, tag) => [...block.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, "g"))].map(m => unescapeXml(m[1]));
// A part of speech or a note arrives as an entity — &v1; — that a real XML
// parser would expand to its description. The entity name is the code.
const codes = (block, tag) => all(block, tag).map(v => (v.match(/^&([^;]+);$/) || [])[1] || v);
const toHiragana = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

// One entry: forms, readings, senses, and what marks it common.
function parseEntry(block) {
  const id = Number((block.match(/<ent_seq>(\d+)<\/ent_seq>/) || [])[1]);
  const kanji = [...block.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)].map(m => ({text: all(m[1], "keb")[0], info: codes(m[1], "ke_inf"), pri: all(m[1], "ke_pri")}));
  const kana = [...block.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)].map(m => ({text: all(m[1], "reb")[0], nokanji: /<re_nokanji\/>/.test(m[1]), restr: all(m[1], "re_restr"), info: codes(m[1], "re_inf"), pri: all(m[1], "re_pri")}));
  const senses = [...block.matchAll(/<sense>([\s\S]*?)<\/sense>/g)].map(m => ({pos: codes(m[1], "pos"), misc: codes(m[1], "misc"), stagk: all(m[1], "stagk"), stagr: all(m[1], "stagr"), gloss: all(m[1], "gloss")}));
  // A sense with no part of speech of its own carries the previous one's.
  for (let i = 1; i < senses.length; i++) if (!senses[i].pos.length) senses[i].pos = senses[i - 1].pos;
  const pris = [...kanji, ...kana].flatMap(f => f.pri);
  const rank = Math.min(99, ...pris.map(p => (p.match(/^nf(\d\d)$/) || [])[1]).filter(Boolean).map(Number));
  return {id, kanji, kana, senses, common: pris.some(p => COMMON.has(p)), rank};
}

// The JLPT lists: (written form, reading) -> level, easiest level winning.
// A list row is a study card, not a dictionary entry: "足; 脚" with "あし",
// "～円", "運動" read "うんどうする", "(〜を) とお", a kana word with its kanji
// in the reading column. Each becomes the plain pairs it names.
const isKana = s => /^[ぁ-ゖァ-ヺー]+$/.test(s);
function pairsOf(expression, reading) {
  const clean = s => s.replace(/[～〜]/g, "").replace(/\([^)]*\)/g, "").replace(/（[^）]*）/g, "").trim();
  const exps = expression.split(/;\s*/).map(clean).filter(Boolean), reads = reading.split(/;\s*/).map(clean).filter(Boolean);
  const pairs = [];
  for (const e of exps) for (const r of (reads.length ? reads : [e])) {
    pairs.push([e, r]);
    if (/する$/.test(r) && !/する$/.test(e)) pairs.push([e, r.slice(0, -2)]);
    if (/する$/.test(e) && /する$/.test(r)) pairs.push([e.slice(0, -2), r.slice(0, -2)]);
    if (isKana(e) && !isKana(r)) pairs.push([r, e]);
  }
  return pairs.filter(([e, r]) => e && r && isKana(r));
}
const jlpt = new Map();
for (const level of ["N1", "N2", "N3", "N4", "N5"]) {
  const rows = readFileSync(new URL(`./jlpt-vocab/${level.toLowerCase()}.csv`, here), "utf8").split("\n").slice(1);
  for (const row of rows) {
    const [expression, reading] = row.split(",");
    if (expression) for (const [e, r] of pairsOf(expression, reading || "")) jlpt.set(e + "\t" + r, level);
  }
}
const listed = jlpt.size;

// Which entries a list word can mean, in dictionary order. A kana-only or
// usually-kana entry takes a kana-only list word; otherwise the first common
// entry, else the first. The same list word never lands twice.
const candidates = new Map();
const parsed = [];
for (const m of text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
  const e = parseEntry(m[1]);
  if (!e.kana.length || !e.senses.some(s => s.gloss.length)) continue;
  parsed.push(e);
  const readings = e.kana.map(r => r.text);
  const keys = new Set();
  for (const k of e.kanji) for (const r of readings) if (jlpt.has(k.text + "\t" + r)) keys.add(k.text + "\t" + r);
  // A kana-only list word: any entry read that way can be it. Which one is
  // decided below — a kana-only or usually-kana entry first, then a common one.
  for (const r of readings) if (jlpt.has(r + "\t" + r)) keys.add(r + "\t" + r);
  for (const key of keys) { const list = candidates.get(key); if (list) list.push(e); else candidates.set(key, [e]); }
}
const levelOf = new Map();
for (const [key, list] of candidates) {
  const [form] = key.split("\t"), kanaWord = isKana(form);
  const usuallyKana = e => !e.kanji.length || e.senses[0].misc.includes("uk");
  const chosen = (kanaWord && (list.find(e => usuallyKana(e) && e.common) || list.find(usuallyKana))) || list.find(e => e.common) || list[0];
  const level = jlpt.get(key), had = levelOf.get(chosen.id);
  if (!had || level > had) levelOf.set(chosen.id, level); // "N5" > "N4" as strings: the easier level wins
}

const out = [];
for (const e of parsed) {
  const level = levelOf.get(e.id) || null;
  if (!e.common && !level) continue;
  // The written form: the first kanji form unless the word is usually kana,
  // in which case the reading is what you would see, and the kanji is "also".
  const usuallyKana = e.senses[0].misc.includes("uk") || !e.kanji.length;
  const head = e.kanji.find(k => !k.info.some(i => i === "iK" || i === "oK" || i === "io")) || e.kanji[0] || null;
  const reading = (head ? e.kana.find(r => !r.nokanji && (!r.restr.length || r.restr.includes(head.text))) : null) || e.kana[0];
  const w = usuallyKana ? reading.text : head.text;
  const k = usuallyKana && head ? head.text : null;
  // Senses that belong to this form, up to three, up to three glosses each.
  const senses = e.senses.filter(s => (!s.stagk.length || !head || s.stagk.includes(head.text)) && (!s.stagr.length || s.stagr.includes(reading.text)) && s.gloss.length && !s.misc.some(m => m === "arch" || m === "obs"));
  const en = (senses.length ? senses : e.senses.filter(s => s.gloss.length)).slice(0, 3).map(s => s.gloss.slice(0, 3).join("; "));
  const pos = [...new Set((senses[0] || e.senses[0]).pos.filter(p => KEEP_POS.has(p)))].slice(0, 3);
  const word = {id: e.id, w, r: reading.text};
  if (k) word.k = k;
  word.en = en; word.pos = pos;
  if (level) word.jlpt = level;
  word.rank = e.rank; word.reading = toHiragana(reading.text);
  out.push(word);
}
// Level order first, N5 to N1 then the common words on no list; within a
// level the newspaper rank, then reading order, so Practise walks the most
// common first and the rest as a dictionary would.
const LEVELS = ["N5", "N4", "N3", "N2", "N1", null];
out.sort((a, b) => LEVELS.indexOf(a.jlpt || null) - LEVELS.indexOf(b.jlpt || null) || a.rank - b.rank || a.reading.localeCompare(b.reading, "ja") || a.id - b.id);

// The generator asserts rather than warns: a source that has changed shape
// should stop the build, not ship a thin dictionary.
const counts = {};
for (const w of out) counts[w.jlpt || "none"] = (counts[w.jlpt || "none"] || 0) + 1;
const matched = out.filter(w => w.jlpt).length;
if (out.length < 20000) throw new Error(`only ${out.length} words: expected the common subset to be over 20,000`);
if (matched < listed * 0.85) throw new Error(`only ${matched} of the ${listed} JLPT list words matched an entry`);
for (const level of ["N5", "N4", "N3", "N2", "N1"]) if ((counts[level] || 0) < 500) throw new Error(`${level}: only ${counts[level] || 0} words`);

const lines = out.map(({rank, reading, ...w}) => JSON.stringify(w));
writeFileSync(new URL("../words-data.js", here), `// Generated by tools/build-words-data.mjs — do not edit by hand.
//
// The common words of JMdict — ${out.length.toLocaleString("en")} of them — and every word on a JLPT
// list. Each is {id, w, r, k, en, pos, jlpt}: the JMdict entry number; the
// written form you would see; its reading; the kanji form when the word is
// usually written in kana; up to three senses of English; the parts of speech
// as JMdict codes (v1, v5k, adj-i, n…), which decide how the app matches a
// conjugated form; and the JLPT level, absent for a common word on no list.
// Ordered by level, N5 first, then by how common the word is in print.
//
// This file is derived from JMdict (created ${created}), © Electronic
// Dictionary Research and Development Group (EDRDG), used under Creative
// Commons Attribution-ShareAlike 4.0 — https://www.edrdg.org/edrdg/licence.html .
// This file is therefore itself CC BY-SA 4.0; that obligation is this
// file's, not the app's. The JLPT levels are from Jonathan Waller's lists
// (tanos.co.uk, CC BY), via jamsinclair/open-anki-jlpt-decks and
// elzup/jlpt-word-list (MIT).
export const WORDS=[
${lines.join(",\n")}
];
`);
console.log("words-data.js:", out.length, "words, JLPT matched", matched, "of", listed, JSON.stringify(counts));
