// Radio: the studied sentences, played through the night.
//
// The plan follows the sleep-cueing research, then the learner's own choice:
//
//   wind-down  awake in bed. Sentence, its translation, the sentence again —
//              the one part of the night where the meaning belongs.
//   settle     silence (or the noise bed) while you fall asleep.
//   cues       the sentences alone, quiet, spaced out, in the first hours of
//              the night, when deep (NREM) sleep dominates. Cueing studied
//              material there helps memory (Hu et al. 2020, Psychol Bull);
//              a translation played right after a cue cancels the benefit
//              (Schreiner, Lehmann & Rasch 2015, Nat Commun), so none here.
//   night      the rest of the night: sentence, then its translation. The
//              research does not support this part; it is the learner's
//              choice, and Radio says so on the page.
//
// Everything here is pure, so the plan and the order are tested without a
// speech engine. RadioPlayer (speech.js) walks it; app.js draws it.
import {stripFurigana} from "./core.js";

export const RADIO_MINUTE = 60_000;
export const RADIO_DEFAULTS = Object.freeze({windDown: 10, settle: 30, cues: 150, hours: 8});
export const RADIO_HOURS = Object.freeze([6, 7, 8, 9]);

// The phases in order, with their length in minutes. The night fills what is
// left of `hours`; a short night just has less of it.
export function radioPlan(options = {}) {
  const o = {...RADIO_DEFAULTS, ...options};
  const hours = RADIO_HOURS.includes(Number(o.hours)) ? Number(o.hours) : RADIO_DEFAULTS.hours;
  const fixed = o.windDown + o.settle + o.cues;
  return [
    {phase: "wind-down", minutes: o.windDown},
    {phase: "settle", minutes: o.settle},
    {phase: "cues", minutes: o.cues},
    {phase: "night", minutes: Math.max(0, hours * 60 - fixed)},
  ];
}

// Where the night is at `elapsed` ms: the phase, how far into it, and how long
// is left of it. Past the end: {phase:"done"}.
export function radioPhase(elapsed, plan = radioPlan()) {
  let start = 0;
  for (const part of plan) {
    const length = part.minutes * RADIO_MINUTE;
    if (elapsed < start + length) return {phase: part.phase, into: elapsed - start, left: start + length - elapsed};
    start += length;
  }
  return {phase: "done", into: 0, left: 0};
}

// Studied means reviewed at least once. Newest first: the sentence studied
// most recently is played first, and the queue wraps when it runs out.
export function radioQueue(sentences = []) {
  return sentences
    .filter(item => item && item.srs?.last_review && (item.target || item.plainTarget))
    .sort((a, b) => Date.parse(b.srs.last_review) - Date.parse(a.srs.last_review))
    .map(item => ({
      id: item.id,
      target: item.target || item.plainTarget,
      plain: item.plainTarget || stripFurigana(item.target || ""),
      source: item.source || "",
      targetLang: item.targetLang || "ja",
      sourceLang: item.sourceLang || "en",
    }));
}

// Cues fade in over their first ten minutes, so the first one does not land
// at full level on someone who has just fallen asleep. Quiet throughout:
// low-level cues helped at home where loud ones did not (Whitmore et al. 2022).
export const CUE_VOLUME = 0.45, NIGHT_VOLUME = 0.6;
export function cueVolume(into) {
  const fade = Math.min(1, Math.max(0, into / (10 * RADIO_MINUTE)));
  return Math.round((0.15 + (CUE_VOLUME - 0.15) * fade) * 100) / 100;
}

// What one sentence sounds like in each phase: a list of things to say and
// silences to leave, in order.
export function radioSteps(phase, item, into = 0) {
  const say = (text, lang, volume = 1) => ({say: text, lang, volume});
  const pause = seconds => ({pause: seconds * 1000});
  const target = say(item.target, item.targetLang), meaning = item.source ? [say(item.source, item.sourceLang), pause(1.5)] : [];
  if (phase === "wind-down") return [target, pause(1.5), ...meaning, target, pause(4)];
  if (phase === "cues") return [say(item.target, item.targetLang, cueVolume(into)), pause(15)];
  if (phase === "night") return [say(item.target, item.targetLang, NIGHT_VOLUME), pause(3),
    ...(item.source ? [say(item.source, item.sourceLang, NIGHT_VOLUME)] : []), pause(15)];
  return [];
}

export const RADIO_PHASE_COPY = Object.freeze({
  "wind-down": {title: "Wind-down", line: "Sentence, meaning, sentence again. Listen with your eyes closed."},
  settle: {title: "Falling asleep", line: "Quiet while you drift off."},
  cues: {title: "Deep sleep", line: "The sentences alone, softly."},
  night: {title: "Rest of the night", line: "Sentence, then its meaning."},
  done: {title: "Good morning", line: "Radio has stopped."},
});

// "6:40" — when the phase or the night ends, on the person's clock.
export function clockAt(ms) {
  const d = new Date(ms);
  return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
}
