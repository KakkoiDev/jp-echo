// Day Radio: N2 words and grammar you hesitate over, played while you are
// awake. Listen plays the target, its meaning and a natural example; Recall
// plays a prompt, leaves a pause, then reveals. The next-day check is Today's
// checks (n2-delayed.js), one session for print and audio.
// Pure queue and step logic plus a small player with speech injected, so it is
// tested without a speech engine (test/day-radio.test.js).
import {recallItems, weakTargets, localDay} from "./n2-study.js";

const keyOf = target => JSON.stringify(target);
const plainText = s => String(s || "").replace(/【[^】]*】/g, "");

// One entry per target, with what Day Radio needs to say it.
export function radioItems(inventory) {
  const items = recallItems(inventory);
  const map = new Map();
  for (const it of items.meaning) map.set(keyOf(it.target), {target: it.target, kind: "word", text: it.prompt, reading: it.reading, meaning: it.answer});
  for (const it of items.grammar) map.set(keyOf(it.target), {target: it.target, kind: "grammar", text: it.prompt.replace(/[〜～]/g, ""), meaning: it.answer});
  return map;
}

// Deck sentences (decks/n2-*.json) are the natural examples: n2-word-<i> and
// n2-grammar-<i> index the inventory.
export function examplesFromDecks(inventory, decks = []) {
  const out = new Map();
  for (const deck of decks) for (const s of deck?.sentences || []) {
    const m = /^n2-(word|grammar)-(\d+)$/.exec(s.id || "");
    if (!m) continue;
    const entry = (m[1] === "word" ? inventory.words : inventory.grammar)[Number(m[2])];
    if (!entry) continue;
    const target = m[1] === "word" ? ["word", entry[0], entry[1]] : ["grammar", entry[0]];
    out.set(keyOf(target), [...(out.get(keyOf(target)) || []), {id: s.id, ja: s.target, en: s.source}]);
  }
  return out;
}
// Exam questions that test a target give a second, different context.
export function examplesFromSets(sets = []) {
  const out = new Map();
  for (const set of sets) for (const [i, q] of (set?.questions || []).entries()) {
    if (!q.target || !/[。？！]/.test(q.prompt || "") || /＿＿|（　）/.test(q.prompt)) continue;
    // Keep the sentence, not the question line after it (…読み方はどれか。).
    const ja = q.prompt.replace(/[【】]/g, "").replace(/[^。？！]*(どれ|どの|何)[^。？！]*[。？]\s*$/, "").trim();
    if (!/[。！？]$/.test(ja) || ja.length < 6) continue;
    out.set(keyOf(q.target), [...(out.get(keyOf(q.target)) || []), {id: set.id + "#" + i, ja: q.target[0] === "word" ? withReading(ja, q.target[1], q.target[2]) : ja, en: ""}]);
  }
  return out;
}

// Listening evidence is its own skill: hearing a word on Day Radio or failing
// to catch it never changes the written-reading or meaning records.
export function listeningWeak(events = []) {
  const latest = new Map();
  for (const e of events) {
    if (e.kind !== "recall" || e.skill !== "listening") continue;
    const k = keyOf(e.target), last = latest.get(k);
    if (!last || e.at >= last.at) latest.set(k, {at: e.at, weak: e.grade !== "got"});
  }
  return latest;
}

// Weak targets first (any skill, newest evidence deciding), then items marked
// "practice later", then a share of never-checked items so the queue keeps
// moving forward. Items heard today go to the back.
export function dayQueue({inventory, recall = [], evidence = [], events = [], later = [], size = 40, freshShare = .25, today = localDay(), items = radioItems(inventory)}) {
  const weak = new Map();
  for (const type of ["meaning", "reading", "grammar"]) for (const [k, v] of weakTargets(type, recall, evidence)) if (v.weak && (!weak.has(k) || weak.get(k) < v.at)) weak.set(k, v.at);
  for (const [k, v] of listeningWeak(events)) if (v.weak && (!weak.has(k) || weak.get(k) < v.at)) weak.set(k, v.at);
  const lastHeard = new Map();
  for (const event of events) {
    if (event.kind !== "exposure") continue;
    const key = keyOf(event.target);
    if (!lastHeard.has(key) || event.at > lastHeard.get(key)) lastHeard.set(key, event.at);
  }
  const heardToday = new Set([...lastHeard].filter(([, at]) => localDay(new Date(at)) === today).map(([key]) => key));
  const checked = new Set(recall.map(r => keyOf(r.target)));
  const pick = [], seen = new Set();
  const add = (k, why) => { const it = items.get(k); if (it && !seen.has(k)) { seen.add(k); pick.push({...it, why}); } };
  const laterKeys = later.map(keyOf);
  const weakKeys = [...weak.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([k]) => k);
  const fresh = Math.min(Math.max(0, size - 1), Math.round(size * freshShare));
  for (const k of laterKeys) if (pick.length < size - fresh) add(k, "later");
  for (const k of weakKeys) if (pick.length < size - fresh) add(k, "weak");
  const keys = [...items.keys()].sort((a, b) => (lastHeard.get(a) || "").localeCompare(lastHeard.get(b) || ""));
  for (const k of keys) {
    if (pick.length >= size) break;
    if (!checked.has(k) && !weak.has(k)) add(k, "new");
  }
  for (const k of [...weakKeys, ...keys]) {
    if (pick.length >= size) break;
    add(k, weak.has(k) ? "weak" : "review");
  }
  return [...pick.filter(p => !heardToday.has(keyOf(p.target))), ...pick.filter(p => heardToday.has(keyOf(p.target)))];
}

export const RECALL_PAUSES = Object.freeze([3, 5, 8]);
// What one item sounds like. Each step is {say, lang} or {pause} or
// {reveal:true} (the screen shows the answer). Without an example the item
// still plays, and the screen says so.
// A word as the voice should say it: its kanji carry the reading, so a device
// voice never guesses (重役 is じゅうやく, never おもやく). speechText turns
// 【readings】 into what is spoken; the screen shows the word itself.
export const spokenWord = (text, reading) => reading && text && text !== reading && !text.includes("【") ? text + "【" + reading + "】" : (text || reading || "");
// A sentence with its tested word annotated, for examples that came without
// readings (exam prompts). Only an exact, unannotated occurrence is changed.
export function withReading(ja, text, reading) {
  if (!ja || !text || !reading || text === reading || ja.includes(text + "【")) return ja || "";
  const at = ja.indexOf(text);
  return at < 0 ? ja : ja.slice(0, at) + spokenWord(text, reading) + ja.slice(at + text.length);
}
export function daySteps(mode, item, example, {pause = 5} = {}) {
  const word = item.kind === "word" ? spokenWord(item.text, item.reading) : item.text;
  if (mode === "listen") return [
    {say: word, lang: "ja"}, {pause: 700},
    {say: item.meaning, lang: "en"}, {pause: 700},
    ...(example ? [{say: example.ja, lang: "ja"}, {pause: 600}, ...(example.en ? [{say: example.en, lang: "en"}, {pause: 600}] : [])] : []),
    {say: word, lang: "ja"}, {pause: 1400}];
  // Recall: the sentence when there is one (a fresh context), else the word.
  return [
    {say: example ? example.ja : word, lang: "ja"}, {pause: pause * 1000, ring: true},
    {reveal: true}, {say: word, lang: "ja"}, {pause: 400}, {say: item.meaning, lang: "en"}, {pause: 1800}];
}

// The example to use: Listen takes the first deck sentence; Recall and the
// next-day check prefer one the learner did not hear last time.
export function chooseExample(examples = [], heardIds = new Set()) {
  return examples.find(e => !heardIds.has(e.id)) || examples[0] || null;
}

// Next-day checks moved to one session for print and audio: n2-delayed.js.

export function radioEvent({target, kind, skill = "listening", grade, source, mode, exampleId, detail = {}, now = new Date()}) {
  return {id: (globalThis.crypto?.randomUUID?.() || String(now.getTime()) + Math.random()), target, kind, skill, ...(grade ? {grade} : {}),
    at: now.toISOString(), context: {...detail, source, mode, ...(exampleId ? {exampleId} : {})}};
}

// The player: walks the queue from an index, one item at a time, and can be
// paused, skipped, repeated and resumed. speak/wait are injected.
export class DayPlayer {
  constructor({speak, wait = ms => new Promise(r => setTimeout(r, ms)), cancel = () => {}, onItem = () => {}, onReveal = () => {}, onRing = () => {}, onComplete = () => {}, onDone = () => {}} = {}) {
    Object.assign(this, {speak, wait, cancel, onItem, onReveal, onRing, onComplete, onDone}); this.run = 0; this.running = false; this.index = 0;
  }
  start(queue, {index = 0, steps, voiceFor = () => null, rate = 1} = {}) {
    if (!queue.length) return false;
    this.queue = queue; this.steps = steps; this.voiceFor = voiceFor; this.rate = rate;
    this.index = Math.min(Math.max(0, index), queue.length - 1);
    const run = ++this.run; this.running = true; this.loop(run); return true;
  }
  async loop(run) {
    while (run === this.run && this.index < this.queue.length) {
      const item = this.queue[this.index];
      let audible = true;
      this.onItem(item, this.index);
      for (const step of this.steps(item)) {
        if (run !== this.run) return;
        if (step.reveal) this.onReveal(item, this.index);
        else if (step.say) {
          const ended = await this.speak(plainOr(step), {lang: step.lang, rate: this.rate, voice: this.voiceFor(step.lang)});
          if (ended === false) audible = false;
        }
        else { if (step.ring) this.onRing(item, step.pause); await this.wait(step.pause); }
      }
      if (run !== this.run) return;
      if (audible) await this.onComplete(item, this.index);
      if (run !== this.run) return;
      this.index++;
    }
    if (run === this.run) { this.running = false; this.onDone(); }
  }
  jump(index) { if (!this.queue) return; const was = this.running; this.stop(); this.index = Math.min(Math.max(0, index), this.queue.length - 1); if (was) this.resume(); }
  resume() { if (this.queue && this.index < this.queue.length) this.start(this.queue, {index: this.index, steps: this.steps, voiceFor: this.voiceFor, rate: this.rate}); }
  stop() { this.run++; this.running = false; this.cancel(); }
}
// English is spoken as written; Japanese keeps its 【readings】 for speechText.
const plainOr = step => step.lang === "ja" ? step.say : plainText(step.say);
