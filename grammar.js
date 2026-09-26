// Which grammar points your own sentences use. A point is a name and a level
// from grammar-data.js; a sentence carries the ids of the points it uses in
// `grammar`, put there by the model when the sentence was tagged. Nothing here
// is scheduled or tested: coverage is read off the library each time.
import {GRAMMAR, LEVELS} from "./grammar-data.js";

export {LEVELS};
export const POINTS = GRAMMAR;
const INDEX = new Map(GRAMMAR.map(point => [point.id, point]));
export const isPoint = id => INDEX.has(id);
export const point = id => INDEX.get(id) || null;
export const hasGrammar = () => GRAMMAR.length > 0;

// A sentence that has never been tagged has no `grammar` at all. One that was
// tagged and found to use nothing has an empty array. The difference matters:
// the first is work still to do, the second is an answer.
export const isTagged = sentence => Array.isArray(sentence?.grammar);
export const untagged = (sentences = []) => sentences.filter(s => s?.id && !isTagged(s));

// Only ids that are on the list survive. The model is told the list, but a
// model is told many things. An id that arrived URL-encoded — the form the
// index used before ids were made readable — is read as its decoded self.
const readable = id => { try { return typeof id === "string" && id.includes("%") ? decodeURIComponent(id) : id; } catch { return id; } };
export const cleanTags = tags => [...new Set((Array.isArray(tags) ? tags : []).map(readable).filter(isPoint))];

// point id -> the ids of your sentences that use it, oldest first.
export function coverage(sentences = []) {
  const map = new Map();
  const ordered = [...sentences].sort((a, b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));
  for (const sentence of ordered) {
    if (!sentence?.id || !isTagged(sentence)) continue;
    for (const id of cleanTags(sentence.grammar)) {
      const ids = map.get(id);
      if (ids) ids.push(sentence.id); else map.set(id, [sentence.id]);
    }
  }
  return map;
}

// Points on a sentence you have actually learned — one at Review — as
// against merely used. The same proxy the kanji wall uses.
export function learned(sentences = []) {
  const known = new Set();
  for (const sentence of sentences) {
    if ((sentence?.srs?.state ?? 0) !== 2) continue;
    for (const id of cleanTags(sentence?.grammar)) known.add(id);
  }
  return known;
}

export const byLevel = () => Object.fromEntries(LEVELS.map(level => [level, GRAMMAR.filter(p => p.level === level)]));

export function summarise(cover, points = GRAMMAR) {
  let met = 0;
  for (const p of points) if (cover.has(p.id)) met++;
  return {met, total: points.length};
}
