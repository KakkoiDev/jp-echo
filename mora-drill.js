// The mora drill (Drill, DrillAnswer, DrillDone): hear a sound, find its
// anchor. Free practice — it is never scheduled, never touches FSRS and never
// adds to the Review badge. A round is ten sounds: the ones missed last time
// first, then sounds from the readings of words in your notes, then the rest
// of the table. A miss shows the right anchor and comes back once more at the
// end of the round. Pure: the page keeps the round; only the last misses are
// remembered, so the next round can start with them.
import {MORA_MNEMONICS,MORA_VOICED,MORA_YOON,moraMnemonicTokens} from "./core.js";

export const DRILL_SIZE = 10;
// Every sound with a drawn anchor of its own or a marked one: the base table
// (を shares お's tea, so it is left out), the voiced table and the combined
// sounds with their own anchor.
export const DRILL_POOL = Object.freeze([
  ...Object.keys(MORA_MNEMONICS).filter(kana => kana !== "を"),
  ...Object.keys(MORA_VOICED),
  ...Object.keys(MORA_YOON),
]);

const shuffle = (items, random) => { const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };

export function drillRound({misses = [], readings = [], size = DRILL_SIZE, random = Math.random} = {}) {
  const inPool = kana => DRILL_POOL.includes(kana), picked = [];
  const add = kana => { if (inPool(kana) && !picked.includes(kana) && picked.length < size) picked.push(kana); };
  for (const kana of misses) add(kana);
  for (const reading of shuffle(readings, random)) for (const token of moraMnemonicTokens(reading)) add(token.mora.replace(/^っ/, ""));
  for (const kana of shuffle(DRILL_POOL, random)) add(kana);
  return picked;
}

// Four anchors to choose from: the right one and three of the same kind (a
// voiced sound among voiced ones, so the corner mark never gives it away),
// neighbours in its row first.
const kindOf = kana => kana.length > 1 ? "combined" : MORA_VOICED[kana] ? (MORA_VOICED[kana][1] === "風船" ? "balloon" : "giant") : "base";
export function drillChoices(kana, random = Math.random) {
  const same = DRILL_POOL.filter(other => other !== kana && kindOf(other) === kindOf(kana));
  const row = DRILL_POOL.indexOf(kana), near = same.filter(other => Math.abs(DRILL_POOL.indexOf(other) - row) <= 5);
  const pool = [...shuffle(near, random).slice(0, 2), ...shuffle(same, random)];
  const three = [...new Set(pool)].slice(0, 3);
  return shuffle([kana, ...three], random);
}

// One round's state. answer() returns the next state; a first-try miss is
// queued once more at the end, and only first tries count.
export function startDrill(round) { return {queue: [...round], index: 0, total: round.length, firstTry: 0, misses: [], answered: null}; }
export function answerDrill(state, picked) {
  if (state.answered) return state;
  const kana = state.queue[state.index], right = picked === kana, first = state.index < state.total;
  const misses = !right && first && !state.misses.includes(kana) ? [...state.misses, kana] : state.misses;
  const queue = !right && first ? [...state.queue, kana] : state.queue;
  return {...state, queue, misses, firstTry: state.firstTry + (right && first ? 1 : 0), answered: {kana, picked, right}};
}
export function nextDrill(state) { return {...state, index: state.index + 1, answered: null}; }
export const drillDone = state => state.index >= state.queue.length;
export const drillProgress = state => ({n: Math.min(state.index + 1, state.total), total: state.total, repeat: state.index >= state.total});
