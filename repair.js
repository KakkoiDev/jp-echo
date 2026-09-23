// One-time repairs for data a bug wrote, as distinct from migrateSentence,
// which handles deliberate schema changes. Everything here is evidence-based:
// a repair that cannot prove a record is damaged leaves it alone, because the
// cost of flipping a correct card is the same as the bug it is fixing.
import {stripFurigana} from "./core.js";

// The swap button reversed the stored pair instead of the input language, and
// the pair persists. A device left swapped therefore reopens typing the
// language it is learning, and files every card it makes the wrong way round
// — quietly, because nothing on screen names the direction.
//
// basePair is the direction that button was lit against. Its existence means
// the device ran that build, and its being the exact reverse of the stored
// pair means the device was left swapped. That is the whole repair.
export function repairPair(settings) {
  const base = settings.basePair;
  if (!base) return false;
  const reversed = base.sourceLang === settings.targetLang && base.targetLang === settings.sourceLang;
  if (reversed) { settings.sourceLang = base.sourceLang; settings.targetLang = base.targetLang; }
  delete settings.basePair;
  return reversed;
}

export function isReversed(record, pair) {
  return !!record && record.sourceLang === pair.targetLang && record.targetLang === pair.sourceLang
    && record.sourceLang !== record.targetLang;
}

// A card written while the pair was reversed holds the sentence you typed in
// source and its translation in target — the opposite of every other card.
//
// Flipping cannot restore the readings: the sentence went in without them and
// the model was never asked for them, so the kana are simply not in the
// record. Plain kana in the right field beats furigana in the wrong one.
export function flipSentence(record) {
  const source = record.target, target = record.source;
  const plain = stripFurigana(target).trim();
  return {...record,
    sourceLang: record.targetLang, targetLang: record.sourceLang,
    source, target, plainTarget: plain,
    casualTarget: target, plainCasualTarget: plain,
    politeTarget: target, plainPoliteTarget: plain};
}

// The pair the oldest card was written with.
//
// Setup writes a pair before any card exists, and the swap button that
// reversed it shipped two releases later, so the earliest card is a record of
// the direction that was actually chosen — made before anything could reverse
// it. basePair was the intended evidence and it was seeded too late to be
// worth anything; this was here the whole time.
export function earliestPair(items = []) {
  const dated = items.filter(item => item && item.sourceLang && item.targetLang && item.createdAt);
  if (!dated.length) return null;
  const first = dated.reduce((oldest, item) => item.createdAt < oldest.createdAt ? item : oldest);
  return {sourceLang: first.sourceLang, targetLang: first.targetLang};
}

// Only the exact reverse counts. A pair that differs some other way is
// someone learning something else, not a device left swapped.
export function pairLooksSwapped(settings, evidence) {
  return !!evidence
    && evidence.sourceLang === settings.targetLang
    && evidence.targetLang === settings.sourceLang
    && evidence.sourceLang !== evidence.targetLang;
}
