import {rubySegments, segmentHtml} from "./core.js";

const wordSegmenter = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter("ja", {granularity: "word"})
  : null;

// Japanese has no spaces, so the two sides are aligned character by character —
// the only unit both a dictated answer and a stored sentence agree on.
export function tokenize(value = "") {
  return [...value];
}

// Longest common subsequence over tokens, walked back into a run-length script.
export function diffTokens(from = [], to = []) {
  const rows = from.length, columns = to.length;
  const table = Array.from({length: rows + 1}, () => new Uint32Array(columns + 1));
  for (let row = rows - 1; row >= 0; row--)
    for (let column = columns - 1; column >= 0; column--)
      table[row][column] = from[row] === to[column]
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
  const script = [];
  let row = 0, column = 0;
  const push = (type, token) => {
    const last = script[script.length - 1];
    if (last && last.type === type) last.tokens.push(token);
    else script.push({type, tokens: [token]});
  };
  while (row < rows && column < columns) {
    if (from[row] === to[column]) push("same", from[row++]), column++;
    else if (table[row + 1][column] >= table[row][column + 1]) push("removed", from[row++]);
    else push("added", to[column++]);
  }
  while (row < rows) push("removed", from[row++]);
  while (column < columns) push("added", to[column++]);
  return script;
}

function changedIndexes(from, to) {
  const removed = new Set(), added = new Set();
  let row = 0, column = 0;
  for (const step of diffTokens(from, to)) {
    if (step.type === "same") { row += step.tokens.length; column += step.tokens.length; }
    else if (step.type === "removed") for (const _ of step.tokens) removed.add(row++);
    else for (const _ of step.tokens) added.add(column++);
  }
  return {removed, added};
}

// A mark that covers half a word reads as a typo rather than a correction, so
// every changed character pulls in the word around it.
function wordRanges(text) {
  if (!wordSegmenter) return [...text].map((character, index) => [index, index + 1]);
  return [...wordSegmenter.segment(text)].map(part => [part.index, part.index + part.segment.length]);
}

function widenToWords(text, changed) {
  if (!changed.size) return changed;
  const widened = new Set();
  for (const [start, end] of wordRanges(text)) {
    let hit = false;
    for (let index = start; index < end; index++) if (changed.has(index)) { hit = true; break; }
    if (!hit) continue;
    if (!text.slice(start, end).trim()) continue;
    for (let index = start; index < end; index++) widened.add(index);
  }
  for (const index of changed) if (text[index] && text[index].trim()) widened.add(index);
  return widened;
}

function runs(length, changed, emit) {
  const parts = [];
  for (let index = 0; index < length; index++) {
    const mark = changed.has(index);
    const last = parts[parts.length - 1];
    if (last && last.changed === mark) last.pieces.push(emit(index));
    else parts.push({changed: mark, pieces: [emit(index)]});
  }
  return parts;
}

const plainTarget = segments => segments.map(segment => segment.text).join("");

// What the learner said, with the parts that are not in the sentence marked.
export function markAttempt(attempt = "", target = "") {
  const said = attempt.normalize("NFKC");
  const {removed} = changedIndexes([...said], [...plainTarget(rubySegments(target))]);
  return runs(said.length, widenToWords(said, removed), index => said[index])
    .map(part => ({text: part.pieces.join(""), changed: part.changed}));
}

// The sentence itself, with the parts the learner missed marked. A kanji run and
// its reading are one unit, so a mark never separates them.
export function markTarget(attempt = "", target = "") {
  const segments = rubySegments(target);
  const plain = plainTarget(segments);
  const {added} = changedIndexes([...attempt.normalize("NFKC")], [...plain]);
  let changed = widenToWords(plain, added);
  let offset = 0;
  for (const segment of segments) {
    const start = offset, end = offset + segment.text.length;
    offset = end;
    if (!segment.reading) continue;
    let hit = false;
    for (let index = start; index < end; index++) if (changed.has(index)) { hit = true; break; }
    if (hit) for (let index = start; index < end; index++) changed.add(index);
  }
  const parts = [];
  offset = 0;
  for (const segment of segments) {
    const start = offset;
    offset += segment.text.length;
    if (segment.reading) {
      append(parts, changed.has(start), segmentHtml(segment));
      continue;
    }
    for (const part of runs(segment.text.length, new Set([...changed].map(index => index - start)), index => segment.text[index]))
      append(parts, part.changed, segmentHtml({text: part.pieces.join("")}));
  }
  return parts;
}

function append(parts, changed, html) {
  const last = parts[parts.length - 1];
  if (last && last.changed === changed) last.html += html;
  else parts.push({html, changed});
}

export function isExactMatch(attempt = "", target = "") {
  return attempt.normalize("NFKC") === plainTarget(rubySegments(target)).normalize("NFKC");
}
