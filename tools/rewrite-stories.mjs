// Write Echo's own story for each kanji, and commit it.
//
//   ECHO_PROVIDER=google ECHO_API_KEY=... node tools/rewrite-stories.mjs --level 1
//   node tools/rewrite-stories.mjs --only 駅山川 --fresh
//   node tools/rewrite-stories.mjs --dry --only 駅        # print the request, call nothing
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

export const SYSTEM = `You write mnemonic stories for Echo, an app for learning Japanese. A story helps someone remember one kanji: what it means, and how it is read. Write in plain, vivid, everyday English. Two short paragraphs. The first ties the kanji's parts to its meaning; the second ties the meaning to its reading, using an English word or phrase that sounds like the reading. Never mention any religion, deity, or holy figure, and never swear or use a euphemism for swearing. Return JSON only: {"meaning":"...","reading":"..."}. No markdown.`;

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

const FORBIDDEN = /\b(god|jesus|christ|lord|allah|buddha|damn|hell)\b/i;

export async function rewrite({select, subjects = null, stories = {}, fresh = false, redo = false, limit = Infinity, dry = false, ask = askModel, settings = {}, pause = async () => {}, log = () => {}, now = () => new Date().toISOString()}) {
  const byChar = new Map((subjects?.kanji || []).map(k => [k.characters, k]));
  const radical = new Map((subjects?.radicals || []).map(r => [r.id, r]));
  const out = {...stories};
  let made = 0, skipped = 0, failed = 0;
  for (const character of select) {
    if (made >= limit) break;
    if (out[character] && !redo) { skipped++; continue; }
    const facts = READINGS[character];
    if (!facts) { log(`${character}: not joyo, skipped`); skipped++; continue; }
    const wk = byChar.get(character) || null;
    const parts = (wk?.components || []).map(id => radical.get(id)).filter(Boolean);
    const text = request(character, facts, parts, wk, {fresh});
    if (dry) { log(`--- ${character} ---\n${text}`); continue; }
    let story = null;
    for (let attempt = 0; attempt < 2 && !story; attempt++) {
      const raw = await ask(attempt ? text + "\n\nYour previous answer broke a rule. Write it again, with no religious reference and no swearing." : text, SYSTEM, settings);
      const meaning = String(raw?.meaning || "").trim(), reading = String(raw?.reading || "").trim();
      if (meaning && reading && !FORBIDDEN.test(meaning + " " + reading)) story = {meaning, reading};
    }
    if (!story) { log(`${character}: the model could not keep to the rules, skipped`); failed++; continue; }
    out[character] = {...story, made: now(), fresh: fresh || !wk};
    made++;
    log(`${character}: written (${made})`);
    await pause();
  }
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
  const select = only ? [...only] : level ? [...JOYO].filter(c => String(READINGS[c]?.grade) === level) : [...JOYO];
  const subjectsPath = new URL("../data/wanikani/subjects.json", import.meta.url);
  const subjects = existsSync(subjectsPath) ? JSON.parse(readFileSync(subjectsPath, "utf8")) : null;
  if (!subjects) console.warn("no data/wanikani/subjects.json — writing from facts alone, with no parts named");
  try { process.loadEnvFile(); } catch {}  // .env in the working directory, if there is one
  const provider = process.env.ECHO_PROVIDER || "google", key = process.env.ECHO_API_KEY || "";
  const settings = {provider, providerKeys: {[provider]: key}, providerModels: process.env.ECHO_MODEL ? {[provider]: process.env.ECHO_MODEL} : {}, localEndpoint: process.env.ECHO_ENDPOINT};
  const {STORIES} = await import("../stories.js");
  const result = await rewrite({select, subjects, stories: STORIES, fresh: flag("--fresh"), redo: flag("--redo"), dry: flag("--dry"),
    limit: val("--limit") ? Number(val("--limit")) : Infinity, settings, pause: () => new Promise(r => setTimeout(r, 300)), log: console.log});
  if (!flag("--dry")) {
    writeFileSync(new URL("../stories.js", import.meta.url), render(result.stories));
    console.log(`stories.js: ${Object.keys(result.stories).length} stories — ${result.made} written, ${result.skipped} kept, ${result.failed} failed`);
  }
}
