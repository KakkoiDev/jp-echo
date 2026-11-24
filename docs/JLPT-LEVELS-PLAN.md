# JLPT levels N5, N4, N3 and N1 — plan

Owner decision, 24 Nov 2026: build the other four levels **after the N2 exam on
6 Dec 2026**. Until then the N2 page is frozen except for exam-week fixes. The
next JLPT after December is July 2027, so waiting loses nothing.

## Goal

Every JLPT level gets what N2 has today: a daily plan that fits the day, word
and grammar first checks, Today's checks, Day Radio, timed practice exams with
results that name what decided each answer, and the evidence view. N2 keeps
its address (`/n2-mock.html`) and all of its data.

## What one level is (measured on N2)

| Part | N2 today | Cost for a new level |
|---|---|---|
| Word and grammar inventory | 1,748 words, 221 grammar (`n2-inventory.json`) | Low: derived from data Echo ships |
| Example-sentence decks | `decks/n2-words.json` (476 KB), `decks/n2-grammar.json` | Medium: AI-written, validated |
| Exam blueprint, timing, scoring | `n2-forms.js` `BLUEPRINT`, `n2-study.js` `SECTIONS` / `PASS_TOTAL` | Medium: hard-coded to N2 today |
| Authored practice exams | 19 sets in `n2-sets/` (1.8 MB), tags and deciding lines | High: the bulk of the work |
| Native review sample | `docs/N2-REVIEW-SAMPLE.md` (pending) | Needs a person |

Inventory sizes available in Echo's own data (`words-data.js` JLPT tags,
`grammar-data.js` bands):

| Level | Words | Grammar points |
|---|---|---|
| N5 | 708 | 132 |
| N4 | 651 | 185 |
| N3 | 2,057 | 220 |
| N2 | 1,681 | 221 |
| N1 | 2,658 | 221 |

## Exam structure per level

Confirm every number against jlpt.jp before coding; these are the current
official structure as understood on 24 Nov 2026.

| Level | Scored sections (max) | Pass total | Section minimum | Times (min) |
|---|---|---|---|---|
| N1 | Language knowledge 60 · Reading 60 · Listening 60 | 100 / 180 | 19 each | 110 language + reading · 55 listening |
| N2 | Language knowledge 60 · Reading 60 · Listening 60 | 90 / 180 | 19 each | 105 language + reading · 50 listening |
| N3 | Language knowledge 60 · Reading 60 · Listening 60 | 95 / 180 | 19 each | 30 vocabulary · 70 grammar + reading · 40 listening |
| N4 | Language knowledge + Reading 120 · Listening 60 | 90 / 180 | 38 · 19 | 25 vocabulary · 55 grammar + reading · 35 listening |
| N5 | Language knowledge + Reading 120 · Listening 60 | 80 / 180 | 38 · 19 | 20 vocabulary · 40 grammar + reading · 30 listening |

N4 and N5 score two sections, not three: results, readiness and the plan must
not assume three sections of 60.

## Phases

### Phase 1 — one JLPT page that takes a level (after 6 Dec)

- Introduce a level parameter: `jlpt.html?level=N3` (or a route), with
  `/n2-mock.html` kept working as level N2, links and data unchanged.
- Move level facts into one table (`jlpt-levels.js`): sections, maxima, pass
  total, section minimums, timings, 問題 blueprint, set index, inventory file.
  `n2-study.js`, `n2-forms.js` and `n2-mock.js` read it instead of constants.
  About 16 places name N2 directly today.
- Every stored record names its level. Existing N2 records without one are
  N2 (no migration that rewrites them). The gist sync file `echo-n2.json`
  becomes per level or carries a level field; keep N2 compatible.
- Tests: N2 behaves exactly as before (snapshot the plan, scoring and results
  for fixed inputs before the refactor), and a two-section level scores
  correctly.
- The Practice goal row, Review card and exam line show the chosen level.

### Phase 2 — inventories and decks for N5, N4, N3, N1

- Build `jlpt-inventory-N*.json` from `words-data.js` and `grammar-data.js`
  with a tool (like `tools/n2-build-content.mjs`); never hand-edit.
- Decks `decks/jlpt-N*-words.json` / `-grammar.json`, one natural sentence per
  item, ids `nX-word-<i>` / `nX-grammar-<i>`, checked by the deck validator.
  Offered on the level page, never imported automatically (CLAUDE.md).
- With these, first checks, Today's checks, Day Radio and the daily plan work
  at every level, before any exam is written.

### Phase 3 — authored practice exams, one level at a time

- Order: the level the owner takes next first (likely N1 after N2, or N3 if
  reviewing), then the rest.
- Per level: a blueprint of its 問題, a set validator, 10–19 authored sets,
  comprehension tags and deciding lines for every reading and listening
  question, two held-out sets for unseen-passage mocks.
- A native-review sample per level before its scores count as readiness.

## Not changing

- Pass probability is never shown; every score names its denominator.
- Decks are offered, never imported. Day Radio evidence stays in `events`.
- The six-hour day budget and the plan's step kinds stay as they are.

## Open questions for the owner

1. Which level comes after N2: N1 (next step up) or another?
2. Should the level page replace the N2 address, or sit beside it?
3. How many authored exams per level are enough to start: 10, or the full 19?
