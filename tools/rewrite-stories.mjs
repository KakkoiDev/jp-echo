// Write Echo's own story for each kanji, and commit it.
//
//   ECHO_PROVIDER=google ECHO_API_KEY=... node tools/rewrite-stories.mjs --level 1
//   node tools/rewrite-stories.mjs --only 駅山川 --fresh
//   node tools/rewrite-stories.mjs --dry --only 駅        # print the request, call nothing
//   node tools/rewrite-stories.mjs --workers 8           # more requests in flight (default 4)
//   node tools/rewrite-stories.mjs --lint                # list stories that break a rule, write nothing
//   node tools/rewrite-stories.mjs --fix                 # rewrite exactly those, from facts alone
//
// The model is given facts — the character, its meanings and readings from
// KANJIDIC2, and the names of the parts it is made of from your WaniKani pull
// — and asked for two short paragraphs: one that ties the parts to the
// meaning, one that ties the meaning to the reading. WaniKani's own story is
// shown to it as a reference for structure only, and told not to be reused;
// --fresh withholds it entirely. The prompt forbids religious references and
// profanity, so there is nothing to scrub afterwards.
//
// Output goes to stories.js, which the app ships. A run adds what is missing
// and leaves what exists; --redo replaces. Keys in the environment, never on
// the command line.
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {JOYO} from "../kanji-data.js";
import {READINGS} from "../kanji-readings.js";
import {askModel} from "../api.js";

export const SYSTEM = `You write mnemonic stories for Echo, an app for learning Japanese. A story helps someone remember one kanji: what it means, and how it is read. Write in plain, vivid, everyday English. Two short paragraphs. The first ties the kanji's parts to its meaning; the second ties the meaning to its reading, using an English word or phrase that sounds like the reading, and writes the reading itself in kana once. Call the pieces of a kanji its parts, never radicals. Never mention any religion, deity, or holy figure, and never swear or use a euphemism for swearing; the sound ジ is written jee, never gee. If the kanji's own meaning is such a word — god, lord — use it once, plainly, as the dictionary word it is, and build the story on something else. Plain text only: no HTML, no angle-bracket tags, no markdown. Return JSON only: {"meaning":"...","reading":"..."}.`;

export function request(character, facts, parts, reference, {fresh = false} = {}) {
  const lines = [
    `Kanji: ${character}`,
    `Meaning: ${facts.en.join(", ") || "—"}`,
    `On'yomi: ${facts.on.join("、") || "—"}`,
    `Kun'yomi: ${facts.kun.join("、") || "—"}`,
    parts.length ? `Parts: ${parts.map(p => p.characters ? `${p.meanings[0]} (${p.characters})` : p.meanings[0]).join(", ")}` : "Parts: not known — describe the shape instead",
  ];
  if (reference && !fresh) lines.push("", "For structure only — do not reuse its phrasing, its characters, or its jokes:", `Reference meaning story: ${reference.meaningMnemonic}`, `Reference reading story: ${reference.readingMnemonic}`);
  return lines.join("\n");
}

const FORBIDDEN = /\b(god|gods|jesus|christ|lord|allah|buddha|damn|hell|gee)\b/i;
const MARKUP = /<\/?[a-z][^>]*>/i;
const JARGON = /\bradicals?\b/i;

// What is wrong with a story, if anything. A forbidden word that is the
// kanji's own meaning (神 is god, 主 is lord) is not a fault: the prompt asks
// for it once, as the dictionary word it is.
export function faults(story, facts = {en: []}) {
  if (!story || !story.meaning || !story.reading) return ["missing"];
  const stem = w => w.toLowerCase().replace(/s$/, "");
  const text = story.meaning + " " + story.reading, own = new Set(facts.en.flatMap(m => m.split(/\W+/).map(stem)));
  const out = [];
  const words = [...text.matchAll(new RegExp(FORBIDDEN.source, "gi"))].map(m => m[1].toLowerCase()).filter(w => !own.has(stem(w)));
  if (words.length) out.push("forbidden: " + [...new Set(words)].join(", "));
  if (MARKUP.test(text)) out.push("markup");
  if (JARGON.test(text)) out.push("says radical");
  if (story.meaning.length < 20 || story.reading.length < 20) out.push("too short");
  return out;
}

// Every kanji in the selection whose story has a fault, or no story at all.
export function lint(select, stories) {
  const out = {};
  for (const c of select) { const f = faults(stories[c], READINGS[c]); if (f.length) out[c] = f; }
  return out;
}

export async function rewrite({select, subjects = null, stories = {}, fresh = false, redo = false, limit = Infinity, dry = false, ask = askModel, settings = {}, pause = async () => {}, log = () => {}, now = () => new Date().toISOString(), save = async () => {}, saveEvery = 10, backoff = async () => {}, workers = 1}) {
  const byChar = new Map((subjects?.kanji || []).map(k => [k.characters, k]));
  const radical = new Map((subjects?.radicals || []).map(r => [r.id, r]));
  const out = {...stories};
  let made = 0, skipped = 0, failed = 0, next = 0, inFlight = 0, saving = Promise.resolve();
  // Saves are queued one after another, so two workers reaching a multiple
  // of saveEvery at once never write the file over each other.
  const persist = () => (saving = saving.then(() => save(out)));

  async function one(character) {
    const facts = READINGS[character];
    if (!facts) { log(`${character}: not joyo, skipped`); skipped++; return; }
    const wk = byChar.get(character) || null;
    const parts = (wk?.components || []).map(id => radical.get(id)).filter(Boolean);
    const text = request(character, facts, parts, wk, {fresh});
    if (dry) { log(`--- ${character} ---\n${text}`); return; }
    // A request that fails — a rate limit, a dropped connection — costs this
    // kanji one retry after a pause, never the run: what was written stays
    // written, and the next run picks up what is missing.
    let story = null, broke = false, error = null;
    inFlight++;
    try {
      for (let attempt = 0; attempt < 2 && !story; attempt++) {
        let raw;
        try { raw = await ask(broke ? text + "\n\nYour previous answer broke a rule. Write it again: no religious reference, no swearing, no gee, no tags, and call the pieces parts." : text, SYSTEM, settings); }
        catch (e) { error = e; await backoff(attempt); continue; }
        const meaning = String(raw?.meaning || "").trim(), reading = String(raw?.reading || "").trim();
        if (meaning && reading && faults({meaning, reading}, facts).length === 0) story = {meaning, reading}; else broke = true;
      }
      if (!story) { log(`${character}: ${error ? "request failed (" + (error.message || error) + ")" : "the model could not keep to the rules"}, skipped`); failed++; return; }
      out[character] = {...story, made: now(), fresh: fresh || !wk};
      made++;
      log(`${character}: written (${made})`);
      if (made % saveEvery === 0) persist();
    } finally { inFlight--; }
    await pause();
  }

  // Workers share one cursor over the selection; each takes the next
  // character the moment it is free. --limit counts what is written or in
  // flight, so no worker starts a story that would overshoot it.
  async function worker() {
    while (next < select.length) {
      if (made + inFlight >= limit) return;
      const character = select[next++];
      if (out[character] && !redo) { skipped++; continue; }
      await one(character);
    }
  }
  await Promise.all(Array.from({length: Math.max(1, Math.min(workers, select.length || 1))}, worker));
  if (made) persist();
  await saving;
  return {stories: out, made, skipped, failed};
}

export function render(stories) {
  const ordered = {};
  for (const c of JOYO) if (stories[c]) ordered[c] = stories[c];
  return `// Echo's own stories, one per kanji, written by tools/rewrite-stories.mjs
// and committed here. Unlike the reference they were worked from, these are
// ours. ${Object.keys(ordered).length} of ${[...JOYO].length}.

export const STORIES = ${JSON.stringify(ordered, null, 1)};
`;
}

if (process.argv[1]?.endsWith("rewrite-stories.mjs")) {
  const args = process.argv.slice(2), flag = n => args.includes(n), val = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const level = val("--level"), only = val("--only");
  let select = only ? [...only] : level ? [...JOYO].filter(c => String(READINGS[c]?.grade) === level) : [...JOYO];
  const {STORIES} = await import("../stories.js");
  if (flag("--lint") || flag("--fix")) {
    const bad = lint(select, STORIES);
    for (const [c, f] of Object.entries(bad)) console.log(`${c}: ${f.join("; ")}`);
    console.log(`${Object.keys(bad).length} of ${select.length} to fix`);
    if (flag("--lint")) process.exit(0);
    select = Object.keys(bad);
  }
  const subjectsPath = new URL("../data/wanikani/subjects.json", import.meta.url);
  const subjects = existsSync(subjectsPath) ? JSON.parse(readFileSync(subjectsPath, "utf8")) : null;
  if (!subjects) console.warn("no data/wanikani/subjects.json — writing from facts alone, with no parts named");
  try { process.loadEnvFile(); } catch {}  // .env in the working directory, if there is one
  const provider = process.env.ECHO_PROVIDER || "google", key = process.env.ECHO_API_KEY || "";
  const settings = {provider, providerKeys: {[provider]: key}, providerModels: process.env.ECHO_MODEL ? {[provider]: process.env.ECHO_MODEL} : {}, localEndpoint: process.env.ECHO_ENDPOINT};
  const target = new URL("../stories.js", import.meta.url), wait = ms => new Promise(r => setTimeout(r, ms));
  // --fix rewrites the flagged stories from facts alone: the ones that leaked
  // the reference's markup did so by leaning on it.
  const result = await rewrite({select, subjects, stories: STORIES, fresh: flag("--fresh") || flag("--fix"), redo: flag("--redo") || flag("--fix"), dry: flag("--dry"),
    limit: val("--limit") ? Number(val("--limit")) : Infinity, settings, pause: () => wait(300), log: console.log,
    save: stories => writeFileSync(target, render(stories)),  // every ten, so a dead run keeps its work
    backoff: attempt => wait(attempt ? 30000 : 10000),  // a rate limit wants a real pause, not 300ms
    workers: val("--workers") ? Number(val("--workers")) : 4});  // requests in flight at once
  if (!flag("--dry")) {
    console.log(`stories.js: ${Object.keys(result.stories).length} stories — ${result.made} written, ${result.skipped} kept, ${result.failed} failed`);
  }
}
