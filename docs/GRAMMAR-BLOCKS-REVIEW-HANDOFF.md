# Grammar blocks: content review handoff

For a reviewer (a person or an AI model) who reads Japanese at N1 level or
better. Written 27 Nov 2026. You are asked to **judge content, not code**.
Nothing has to be run: everything to read is in one file.

## Why this review exists

Echo's game, Quick round, teaches JLPT N2 grammar from its building blocks,
so a learner can work out a pattern never met: ざる (an old negative) + を +
得ない (cannot get) → "cannot avoid doing". The index of blocks was drafted
by AI models and checked by other AI models, but **no one has yet read every
gloss and every split as a teacher would**. Until that is done the cards are
practice and pay no points.

The learner will trust these glosses. A gloss that is wrong, or true in one
pattern and false in another, teaches something false.

## What to read

`tools/grammar-blocks/review-data.json` (about 170 KB, generated; do not edit
it). It holds:

- `blocks` (188): `id`, `form`, `forms`, `type`, `level`, `gloss`, an
  `example` sentence with its English, `basic` (true for 26 particles and
  endings of N5 and N4, which have no card of their own), and `usedIn`: every
  pattern that uses the block, with that pattern's meaning.
- `patterns` (221, the whole N2 grammar list): `key`, `name`, `meaning` (the
  reviewed answer the game uses), the deck `sentence`, the ordered `parts`
  (each with the gloss of its block), `literal` (the parts read together),
  `transparency`, and `oneBlock`.
- `confusablePairs` (33): patterns never offered as each other's wrong choice.

Background, only if you want it: `docs/GRAMMAR-BLOCKS.md` (the design) and
`docs/GRAMMAR-BLOCKS-IMPLEMENTATION.md` (what was built and audited).

## How the learner meets this

- **Block card.** The block's example sentence with the block underlined;
  the learner picks its `gloss` among the glosses of three other blocks of
  the same `type`.
- **Build card.** The pattern's sentence with the pattern underlined, and
  under it each part with its gloss; the learner picks the pattern's
  `meaning`.
- **Infer card.** The same without the glosses.

So a gloss is read in two places: alone, as an answer, and under a pattern,
as a hint. It must be true in both.

## What to judge

### For each block

1. **Is the gloss true?** For the form itself, in ordinary Japanese.
2. **Is it true in every pattern of `usedIn`?** This is the important one. A
   block is one meaning shared by its patterns. If the form means something
   different in one of them, the block must be split in two. Known doubtful
   cases to look at first:
   - `eru` ("get or attain") also glosses the part 得ない, where the negation
     is missing from the hint.
   - `naru` ("becomes a new state") is used for ならない in てはならない,
     ねばならない, てならない, にほかならない and のみならず. Is "become" the
     right reading in all of them, or is some of this the copula なり?
   - `suru-assume` ("takes something as a premise") across にしたら,
     としては, からすると, からして, は別として.
   - `ue` ("an upper layer") across 上に, その上, 上は; and `jou` for 〜上.
   - `koto`, the three `mono-…` blocks, `tokoro-point`, `wake`.
3. **Does the gloss teach, or dodge?** Many glosses were written to avoid
   sharing any word with a pattern's meaning, and came out abstract ("marks
   an endpoint or link" for に, "the inside of a boundary" for うち). Say
   where a plainer gloss would be truer and still not give a pattern's answer
   away.
4. **Is the example sentence natural Japanese,** does it really use the block
   in the glossed sense, and are its readings (【】) right?
5. **Are the `forms` right?** Every listed form must be a form of this block
   and no other.
6. **Is the `type` right** (`negative`, `noun`, `particle`, `verb`,
   `ending`, `word`)?

### For each pattern

1. **Is the split the one a teacher would make?** Not a false etymology, not
   a split that hides the real boundary.
2. **Is `literal` an honest reading of the parts**, and does it lead towards
   `meaning` rather than away from it?
3. **Is `transparency` right?**
   - `clear`: the parts alone give the meaning. (157; each was solved by an
     AI model from the glosses alone, with the Japanese hidden. That test was
     easy: the wrong choices were far from the answer.)
   - `partial`: the parts narrow it down; a nuance must be learned. (3)
   - `opaque`: learn it whole. All 61 one-block patterns are here by rule;
     for those, check only that the block's gloss is a fair short meaning.
   Say which `clear` ones you think a learner could **not** work out.
4. **Is `meaning` itself right?** It comes from the N2 list and its earlier
   review. If it is wrong or lopsided (中を is given as "In, On, Into, Inside
   of"), say so: it is outside the block index but it is what the card asks.
5. **Does the sentence show the pattern in the glossed sense?**

### Across patterns

- **Pairs a learner cannot tell apart by meaning.** `confusablePairs` has 33.
  Name any pair that is missing (two patterns whose English meanings both fit
  the other's sentence), and any pair listed that is in fact easy to tell
  apart.
- **Blocks that should be one**, or one block that should be two.
- **The 26 `basic` blocks** are assumed known by an N2 learner. Say if any is
  not basic in the sense its patterns use it.

## What to hand back

One JSON file, `grammar-blocks-review.json`, an array. One object per
finding; nothing for an entry you find correct.

```json
{
  "kind": "block",
  "id": "naru",
  "field": "gloss",
  "severity": "wrong",
  "problem": "In にほかならない the ならない is the negative of the copula なり, not of 成る.",
  "evidence": "に他ならない = 〜以外のものではない",
  "suggestion": "Split: naru (becomes) for ことになっている, が気になる; a new block for the copula.",
  "confidence": "high"
}
```

- `kind`: `block`, `pattern`, `pair` or `general`.
- `id`: the block id, the pattern `key`, or for a pair `"keyA ⇄ keyB"`.
- `field`: `gloss`, `forms`, `type`, `example`, `parts`, `literal`,
  `transparency`, `meaning`, `sentence`, `pair`.
- `severity`: `wrong` (teaches something false), `misleading` (true but
  likely to be misread), `weak` (could be clearer), `note`.
- `suggestion`: the exact replacement text where you have one. A gloss is
  English, at most 40 characters, with no Japanese in it.
- `confidence`: `high`, `medium`, `low`. Say `low` rather than guess.

Then a short summary in prose: how many entries you read, how many findings
of each severity, the ten you would fix first, and anything about the whole
approach you think is mistaken.

## Rules for the review

- Read **all** 188 blocks and all 221 patterns. If you sample, say exactly
  what you read and what you did not.
- Judge from your own knowledge of Japanese. Do not assume an entry is right
  because it passed a validator or an earlier check.
- Do not rewrite the index, the inventory or the deck. Findings only.
- Where two readings are both defensible, say so and give both.

## What happens to your findings

A maintainer applies them to `n2-grammar-blocks.json` (through the draft in
`tools/grammar-blocks/draft.json`), runs
`node tools/validate-grammar-blocks.mjs n2-grammar-blocks.json` and the
tests, and regenerates this data with
`node tools/grammar-blocks/make-review.mjs`. The cards may score only after
every `wrong` and `misleading` finding is settled
(`REVIEWED_GRAMMAR_BLOCKS` in `n2-game-review.js`).
