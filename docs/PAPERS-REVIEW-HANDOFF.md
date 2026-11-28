# The mock papers: a full review

For a reviewer AI model (or a person) who reads Japanese at N1 level or
better and knows the JLPT. Written 28 Nov 2026. Content work: nothing has to
be run.

## Why

Echo is a study app for one learner sitting JLPT N2 on 6 Dec 2026. It ships
mock papers in the real 問題 layout: nineteen at N2, ten each at N5, N4 and
N3 so far. The learner sits them as timed exams and as the game's boss, and
every miss is studied afterwards. **A wrong key, or a question with two
defensible answers, teaches the learner something false and costs points for
a right answer.** These papers were written by AI models and checked by
validators, blind solves and two earlier reviews; this is the full read that
decides whether they are trusted.

## What you are given

`tools/paper-review/input/<paper>.json`, one file per paper (49 files, about
80 kB each; `node tools/paper-review/make-inputs.mjs` makes them). Each is:

```json
{"paper": "n2-set-7", "level": "N2", "edition": "2026.11-r5", "theme": "…",
 "questions": [
  {"index": 0, "skill": "Vocabulary", "mondai": 1, "question": "…", "choices": ["…"], "key": 3, "why": "…"},
  {"index": 52, "skill": "Reading", "mondai": 10, "context": "…passage or script…", "question": "…", "choices": ["…"], "key": 2, "why": "…",
   "decidingLines": {"lines": ["…"], "en": "…"}}
 ]}
```

- `key` is the 1-based index of the right choice; `why` is the paper's own
  explanation (a hint, never the authority).
- `context` is the passage, or for Listening the script (男：, 女：…).
  Listening 問題4 has three choices.
- Grammar 問題8 shows four tiles; `key` is the tile on ★ (the third slot).
- `decidingLines` (N2 only, where present): the one or two lines of the
  passage shown to the learner as "this is where it was", with their English.
- Readings may appear as 漢字【かんじ】.

## What to judge, for every question

1. **The key.** Solve each question yourself before you look at `key`. A
   question is sound only if the key is right **and no other choice is
   defensible** to a careful native reader.
2. **Grammar 問題8.** Try every order of the four tiles. If a second order is
   natural Japanese, the item is unfair, even if it puts the same tile on ★.
3. **Reading and Listening.** The answer must follow from the text alone:
   no outside knowledge, no unstated assumption (a notice for residents,
   workers and students must say which the person is not; a total must say
   what counts toward it).
4. **The level.** Vocabulary, grammar and passage length fit the paper's
   level; a word far above it is a finding (`level`).
5. **Japanese.** Natural, as a JLPT paper would write it. Wrong choices are
   the exam's own kind: plausible to a learner, wrong to a careful reader.
6. **`why` and `decidingLines`** say what is true, and the lines really
   decide the question.

What has already been fixed (do not report it again unless the fix is wrong):
N2 set 4 #33, set 5 #46, set 8 #42 and #45, set 9 #45, set 10 #19, set 14
#39, set 20 #36 (27 Nov); set 2 #71 and #96, set 3 #72, set 7 #43, set 9 #46,
set 15 #64 (28 Nov). Forty-three earlier "unfair" findings on N2 papers 4–20
were judged to be the exam's own kind of wrong choice and left; if you find
one of them really unfair, say so with your reason.

## What to hand back

One JSON file per paper you read, named `<paper>.review.json`:

```json
{
  "paper": "n2-set-7",
  "read": "all",
  "findings": [
    {"index": 43, "field": "answer", "severity": "unfair",
     "problem": "見ながら can also come after 自宅から: 地図を自宅から見ながら…",
     "evidence": "the order you built, or the line of the passage",
     "suggestion": "the exact replacement text (question, choices, key or context)",
     "confidence": "high"}
  ]
}
```

- `read`: `"all"`, or the indexes you read.
- `field`: `answer`, `question`, `choices`, `context`, `why`, `lines`, `level`.
- `severity`: `wrong` (the key marks a wrong choice right), `unfair` (a second
  choice is defensible, or the text cannot decide), `weak` (unnatural
  Japanese, off level, a misleading `why` or line), `note`.
- `suggestion`: the exact new text, so the fix can be applied as written; for
  an 問題8 item, the new tiles and frame, checked for a single natural order.
- `confidence`: `high`, `medium`, `low`. Say `low` rather than guess.
- Nothing for a question that is sound.

Then a short summary in prose: per paper, the counts by severity; every
`wrong` and `unfair` finding in one line each; and anything about a paper or a
level as a whole (a habit of unnatural phrasing, a 問題 type that is
consistently easier or harder than the real exam).

## Rules

- Read N2 first (the exam is N2), then N3, N4, N5. If you cannot read
  everything, hand back complete reviews of whole papers and say which.
- Judge from the paper, never from `why`.
- Do not rewrite papers wholesale. Problems go in `findings`, one per
  problem.
- Official JLPT papers are referenced, never copied: never suggest text taken
  from a real paper.

## What happens next

The maintainer checks each `wrong` and `unfair` finding against the paper,
applies the ones that hold, gives each changed paper a new edition, and has a
second reader solve the changed questions blind before they ship.
