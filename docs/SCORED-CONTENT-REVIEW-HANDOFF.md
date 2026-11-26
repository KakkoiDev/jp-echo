# Scored content no one has read: review handoff

For a reviewer (a person or an AI model) who reads Japanese at N1 level or
better. Written 27 Nov 2026. You are asked to **judge content, not code**.
Nothing has to be run: everything to read is in one file.

## Why this review exists

Echo's game, Quick round, asks a learner preparing JLPT N2 fast
multiple-choice questions: three to eight seconds each, 1,000 a day. A right
answer pays points; a wrong one costs 200 to 400.

Since 27 Nov **every card is scored**. Before that, content no reviewer had
read was shown as "practice" and paid nothing. The owner chose points on
every card, knowing that some of this content is unread. So a wrong answer
key, or two choices that are both right, now takes points from a learner who
answered correctly. This review is how those are found.

The learner trusts what a card says is the answer. Judge each item as a
teacher would: is the answer true, and is every wrong choice really wrong?

## What to read

`tools/scored-review/review-data.json` (generated; do not edit it). Five
parts, in the order of how much they matter.

### A. `parts` (167): prefixes and suffixes

New on 27 Nov. Each entry is a word part of the N2 list (前～, ～気味):
`text`, `reading`, `meaning`, the deck `sentence` (readings in 【】) and its
English. An entry with an `id` has a card:

- the card shows the sentence with `underlined` marked, and asks for its
  meaning; the right choice is `answer`;
- the three wrong choices are drawn from the meanings of other parts, those
  of the same side (prefix or suffix) first: `sameSideWrong` shows some of
  them, `wrongChoices` how many there are in all.

Judge, for each of the 167:

1. **Is `meaning` right for the part**, as a part? Many come from a
   dictionary's word entries and read oddly ("kind of field, ground" for ～場,
   "count for sisters" for ～女). Give the meaning a teacher would give.
2. **Does the sentence use the part in that meaning**, and is the underlined
   stretch really the part (not the same character in another word)?
3. **Is the sentence natural, and are its readings right?**
4. **Could another part's meaning also be a right answer here?** (～所 and
   ～場 are both "place".) Name the pairs that must never be each other's
   wrong choice.
5. For an entry with `noCard`: propose a sentence where the part is written
   exactly once, if the part is worth a card.
6. **Is anything missing?** Parts an N2 learner needs that the list lacks.

### B. `connectives` (228): the right connective for a gap

Built by rule from reading passages of the mock papers: `excerpt` is up to
two sentences before a gap （　） and the gap's own sentence; `answer` is the
connective the passage had; `wrong` are all the connectives the card may
offer instead (three are shown).

Judge, for each:

1. **Is `answer` the only one that fits?** If any entry of `wrong` would
   also be acceptable Japanese in this excerpt, the card is unfair: name it.
2. **Is the excerpt enough to decide?** If the choice needs the text before
   or after it, say so.
3. `shownAfterAnswer` is the line the learner reads after answering (the
   connective's job). Is it right?

### C. `grammarOpen` (48): findings of the first grammar review left open

On 27 Nov a reviewer returned 188 findings on the grammar-from-parts index;
140 were applied. These 48 were applied only in part (31) or not at all (17);
each has a `note` saying what was done and why. The cards built from them
are now scored. For each, say whether what remains **can teach something
false** (then it must be fixed before 6 Dec), or is only less clear than it
could be. The full context is in `tools/grammar-blocks/review-data.json` and
`docs/GRAMMAR-BLOCKS-REVIEW-HANDOFF.md`.

### D. `lines` (106): the deciding lines of reading and listening questions

Not scored: shown in a review of a finished mock paper, where the learner
reads a missed question with its answer. Each entry has the whole `context`,
the `question`, its `choices`, the `key` (1-based), and either `lines` (one
or two sentences copied from the context, said to decide the answer), `en`
(their meaning) and `solved` (whether an AI model picked the key from the
lines alone), or `skip` with a reason.

Judge: **do the lines really decide the answer?** Is `en` accurate? For a
`skip`, is there in fact a deciding line? (The three `wrong` meanings in each
entry are no longer used; ignore them.)

### E. `levels` (N5, N4, N3, N1): the other levels' word cards

About 22,000 cards built by rule from JMdict word lists (`file` names each
list: rows of word, reading, meaning). You cannot read them all, and are not
asked to. Each level has a `sample` of about 120 cards (`prompt`, `answer`,
some of the `wrong` choices). Read the samples and report **patterns** of
error, with examples: meanings that are not the common sense of the word at
that level, readings with a second accepted form, wrong choices that share
the answer's meaning. From the rate you find, say whether a level is fit to
be scored as it is.

This part matters least until 6 Dec 2026: the learner is on N2.

## What to hand back

One JSON file, `scored-content-review.json`, an array. One object per
finding; nothing for an item you find correct.

```json
{
  "part": "A",
  "id": "a:～場",
  "field": "meaning",
  "severity": "wrong",
  "problem": "As a suffix ～場 is 'place for ~, ~ ground', not 'kind of field'.",
  "evidence": "運動場, 駐車場, 売り場",
  "suggestion": "place for ~",
  "confidence": "high"
}
```

- `part`: `A` to `E`.
- `id`: the entry's `id` (for a part with no card, its `text`; in D the key
  such as `n2-set-2#60`; in E the card's `id`, or the level for a pattern).
- `field`: `meaning`, `sentence`, `reading`, `underlined`, `answer`,
  `wrong`, `excerpt`, `lines`, `en`, `pair`, `missing`, `pattern`.
- `severity`: `wrong` (the card marks a right answer wrong, a wrong one
  right, or teaches something false), `unfair` (a second choice is also
  right, or the card cannot be decided from what is shown), `weak` (true but
  could be clearer, or too easy), `note`.
- `suggestion`: the exact replacement where you have one. A meaning is
  English, at most 40 characters, with no Japanese in it. A sentence carries
  its readings as 漢字【かんじ】.
- `confidence`: `high`, `medium`, `low`. Say `low` rather than guess.

Then a short summary in prose: what you read in full and what you sampled,
the count of findings by part and severity, the twenty you would fix first,
and for part E a verdict per level.

## Rules for the review

- Read **all** of A, B, C and D. In E, read every sample card.
- Judge from your own knowledge of Japanese, not from the fact that an item
  passed a validator or an earlier check by an AI model.
- Findings only: do not rewrite the lists, the decks or the papers.
- Where two readings are both defensible, say so and give both.
- `wrong` and `unfair` come first: they are the ones that cost a learner
  points for a right answer.

## What happens to your findings

A maintainer applies them (meanings through `GLOSS_FIX` and pairs through
the exclusion lists in `n2-game-review.js`, sentences in `decks/`, lines in
`tools/boss-keys/`), runs the tests, and regenerates this data with
`node tools/scored-review/make-review.mjs`. When every `wrong` and `unfair`
finding of a part is settled, its `REVIEWED_` flag in `n2-game-review.js` is
set to true: the record that the part has been read.
