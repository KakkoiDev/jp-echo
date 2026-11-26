# Grammar from its blocks — design and build guide

Status: **built and released as practice cards** (27 Nov 2026). See the [implementation report](GRAMMAR-BLOCKS-IMPLEMENTATION.md): the 40% cap of rule 9 and the gloss rule for one-block patterns were dropped by the owner after the audit.
The author of this page audits the result against "How the work is audited"
at the end. If something here is wrong or cannot be done, say so in your
report; do not quietly do something else.

## 1. What the owner wants

In the owner's words: "I just need to grok how the language works, and then
be able to understand from those basic blocks."

The goal is **transfer**: meeting ～ざるを得ない for the first time and working
out "cannot avoid doing" from ざる (an old ない) + を + 得ない (cannot get),
without having memorised the pattern. Quick round already does this for kanji
readings (CLAUDE.md, "Quick round learns kanji, not word lists"): the unit is
the kanji with its reading, a word is only the example, and a kanji counts as
known once it is read right in a word the game has never shown. Grammar gets
the same treatment: **the unit is the block; a pattern is the example.**

Decisions already made by the owner (do not reopen them):

- A block index is authored content, drafted with a model and checked.
- A record per block, the same shape as the kanji record.
- Honesty about limits: a pattern whose parts do not predict its meaning is
  marked "learn whole", the way 今日 is for readings.
- N2 first: it is the only level with grammar sentences today.
- Radicals and "what a kanji contributes" are **out of scope**. The owner
  declined both ("I'll learn as I go").

## 2. What exists today (read these before writing anything)

| Thing | Where | Notes |
|---|---|---|
| N2 grammar list | `n2-inventory.json` `grammar`: `[key, name, meaning]`, 221 entries | Names carry ～, ①② and （asides）. A pattern with two meanings is two entries (`一応1`, `一応2`). Never hand-edit this file. |
| One sentence per pattern | `decks/n2-grammar.json`, ids `n2-grammar-<index>` | `target` carries 【readings】. Reached through `examplesFromDecks` (day-radio.js). |
| Today's grammar card | `gamePool` in `n2-game.js`, id `g:<key>`, kind `grammar` | The pattern underlined in its sentence; pick the meaning of the whole pattern. Scored. Ids must never change. |
| What to underline | `GRAMMAR_SPANS` (`n2-game-review.js`), `surfaceNeedle` (`n2-game.js`), `patternNeedles` / `exampleSegments` (`n2-delayed.js`) | Reuse these to find a pattern in a sentence. |
| Reviewed corrections | `GLOSS_FIX["g:<key>"]`, `EXCLUDED` (`n2-game-review.js`) | The audited answers; a block's gloss must not contradict them. |
| The model to copy | Kanji first: `kanjiAfter`, `kanjiStates`, `kanjiCoverage`, `kanjiPick`, `newWord` (`n2-game.js`); `kj` merge in `mergeGame` (`sync.js`); tests "Kanji first" in `test/n2-game.test.js` | Same record shape, same "transfer" idea, same sync rule. |
| Practice cards | `practice: true`, `record: true` in `gamePool`; `rememberAnswer` | Unreviewed cards pay no points. `record: true` lets the record move. |
| Other levels' grammar lists | `levels/<version>/n*.json` `grammar` (132, 185, 220, 221 points) | No sentences exist for them. |
| Connectives | `n2-connectives.js` | An earlier small "one job per word" index: a good example of the tone and size of a gloss. |

Measured on the N2 list, so nobody plans on a guess:

- 22 of the 221 patterns visibly contain another listed pattern
  (ざるを得ない ⊃ ざる, 得ない; 以上に ⊃ 以上, 上に; からには ⊃ には).
- A first hand list of 57 common blocks (old negatives, formal nouns,
  particles, endings) touches only 96 of the 221. **So "a few dozen blocks
  cover most of N2" is not true as first claimed to the owner.**
- The rest are mostly of three kinds: particle + a verb in its て form or stem
  (に沿って, に向かって, を巡って, にわたって: the block is the verb's own
  meaning), set adverbs (どうせ, せめて, 要するに, 万が一), and noun phrases
  (を中心に, の下で, を契機に).

The index must therefore have several kinds of block (section 3), and the
builder reports the real coverage instead of assuming it.

## 3. The model

**Block.** The smallest piece that keeps a meaning across patterns. Kinds:

| `type` | What it is | Examples |
|---|---|---|
| `negative` | Old or bound negatives | ず, ざる, ぬ, まい, ない |
| `noun` | A noun doing grammar's work | わけ, もの, こと, はず, ところ, 限り, 次第, 上, 際, 末 |
| `particle` | A particle or a fixed stack of them | に, を, には, からには, として |
| `verb` | A verb whose meaning carries the pattern, in the form it takes | 沿う (に沿って), 得る (得ない), かねる, 巡る, 伴う |
| `ending` | A suffix or auxiliary | がち, っぽい, がたい, つつ, べき, よう |
| `word` | An adverb or set word with no smaller parts | どうせ, せめて, 要するに |

**Pattern.** One entry of the inventory, described as an ordered list of
parts. Each part is a block, or plain glue (a particle used in its ordinary
way may still be a block: を in ざるを得ない is).

**Transparency**, measured, never asserted by the writer (section 5):

- `clear`: someone who knows the blocks can pick the meaning.
- `partial`: the blocks narrow it down but a nuance must be learned.
- `opaque`: learn it whole (ものの, 一応). It still lists its parts for
  recognition, but it is never used as a transfer test.

A `word` block that is the whole pattern is always `opaque` as a pattern:
there is nothing to build it from.

## 4. The data: `n2-grammar-blocks.json`

One generated-and-reviewed file at the repo root, precached like
`n2-inventory.json` (it is small). Shape:

```json
{
  "version": 1,
  "blocks": {
    "zaru": {
      "form": "ざる",
      "forms": ["ざる", "ず", "ぬ"],
      "type": "negative",
      "gloss": "not doing (an old ない)",
      "ja": "行【い】かざるを得【え】ない。",
      "en": "I have no choice but to go.",
      "level": "N2"
    }
  },
  "patterns": {
    "ざるを得ない": {
      "parts": [
        {"text": "ざる", "block": "zaru"},
        {"text": "を", "block": "wo"},
        {"text": "得ない", "block": "enai"}
      ],
      "literal": "cannot get by without doing",
      "transparency": "clear",
      "solved": {"by": "blocks-only", "right": true}
    }
  }
}
```

Rules, all held by a validator (`tools/validate-grammar-blocks.mjs`) and by
tests:

1. Every key of `n2-inventory.json` `grammar` has exactly one pattern entry.
   A two-meaning pattern (`一応1`, `一応2`) has one entry per key; they may
   share parts and must differ in `literal`.
2. `parts[].text`, joined, equals one surface form of the pattern: the
   inventory name with ～, ①② and （asides） removed, one alternative of a
   name split on ・ (use `patternNeedles`). A part with no `block` is glue
   and is at most two kana.
3. Every `block` id a part names exists. `form` is in `forms`. Every part's
   `text` is one of its block's `forms`, or a conjugated form of a `verb`
   block listed in its `forms`.
4. A block id is lowercase ASCII (`[a-z0-9-]+`), stable, never reused for
   another meaning. Two meanings of one form are two blocks (`mono-thing`,
   `mono-ought`).
5. (Changed after the content review of 27 Nov 2026: the "must not be the
   meaning of a pattern" half of this rule was dropped, and a part may carry
   its own `gloss` for the form shown. See the implementation report.)
   `gloss` is English, at most 40 characters, contains no Japanese (the
   `JP` rule in `n2-game.js`), and is **not** the meaning of any pattern
   that contains the block: a gloss must not give a card's answer away
   (check with `sameSense`).
6. `ja` / `en` for a block: one short sentence using the block, with
   【readings】 on every kanji (as the decks have). It may be the deck
   sentence of a pattern that contains it.
7. `literal` is required unless `transparency` is `opaque`; it is the parts'
   glosses read together, not the dictionary meaning.
8. `transparency` is one of `clear`, `partial`, `opaque`, and for `clear`
   and `partial` the entry carries `solved` (section 5).
9. A block used by only one pattern is allowed but must carry
   `"single": true`; the validator prints how many there are. The build
   fails if more than 40% of blocks are single: that is a list of patterns
   under another name, not an index of blocks.
10. `level` is the lowest level whose grammar list contains the form
    (`levels/…` and the N2 inventory), or `N5` for the basic particles.

The validator prints, and the builder reports: blocks by type, patterns by
transparency, the share of patterns with at least one block shared with
another pattern, and the single blocks.

## 5. How the index is written

Never by hand in one pass, and never trusted because a model wrote it.

1. **Draft blocks first.** One writer proposes the block list from the 221
   names and meanings (types, forms, glosses). A second pass merges
   duplicates and splits blocks that hide two meanings.
2. **Split patterns in batches of about 20**, each writer given the block
   list and the batch. A writer may add a block; additions are merged
   centrally, never per batch.
3. **Measure transparency with a blind solve.** A solver that has never
   seen the pattern's meaning gets only the parts and their glosses and
   four meanings (the right one and three from patterns sharing a block),
   and picks one. Record `solved: {by: "blocks-only", right}`. Right →
   `clear`. Wrong, but right once the deck sentence is added
   (`by: "blocks+sentence"`) → `partial`. Wrong both times → `opaque`, or
   the split is bad: fix the split or the glosses and solve again, once.
4. **Check against the reviewed answers.** No `literal` may contradict
   `GLOSS_FIX["g:<key>"]` or the inventory meaning.
5. Run the validator; fix; commit the file together with the tool and tests.

Workers: the owner's standing rule is **no Fable sub-agents** (they drained
the weekly credit): spawn writers and solvers on Sonnet. Keep the briefs in
the repo (`tools/grammar-blocks/WRITER.md`, `SOLVER.md`), as the paper
pipeline does (`tools/paper-pipeline/`), so the work survives a stopped
session. Keep drafts in a git-ignored work folder inside the repo, not in a
temp folder a reboot erases.

## 6. The game

All in `n2-game.js` (pure, tested), wired in `game()` in `n2-mock.js`.

### Cards

Existing `g:<key>` cards are unchanged and stay scored. Three new kinds, all
`practice: true, record: true` until reviewed (add a switch beside
`REVIEWED_LEVELS` in `n2-game-review.js`; do not reuse that one):

| Kind | Id | Shows | Asks | Wrong choices |
|---|---|---|---|---|
| `block` | `b:<blockId>` | The block's sentence, the block underlined | The block's gloss | Glosses of blocks of the same `type` |
| `build` | `gb:<key>` | The deck sentence, the pattern underlined, and under it the parts with their glosses | The meaning of the whole | Meanings of patterns sharing a block (`near`), then others |
| `infer` | `gi:<key>` | The deck sentence, the pattern underlined, **no glosses** | The meaning of the whole | As `build` |

Every card holds the pool's bar: four distinct choices, no wrong choice that
shares the answer's meaning (`sameSense`), nothing in `EXCLUDED`. `infer`
cards exist only for `clear` and `partial` patterns. Each card carries
`blocks: [ids]`, as word cards carry `kanji`.

### The record

`gb` in the game state, one entry per block id, the shape of `kj`:
`[met, right, missed, transfer, last seen, weak]`.

- `met`: any card holding the block was answered (`block`, `build`, `infer`,
  and today's `g:` card of a pattern that contains it).
- `right` / `missed`: on `block` cards (its own gloss) and `infer` cards.
- `transfer`: an `infer` card answered right, of a pattern **never shown**
  (no `g:`, `gb:` or `gi:` card of that key in `seen`), every one of whose
  blocks was already met. This is the proof.
- `weak`: 1 after a miss on a `block` or `infer` card, until one is right.

A block is known after one transfer or three right answers (use the same
constants object pattern as `KANJI_KNOWN`). `mergeGame` merges `gb` exactly
as it merges `kj` (counts take the larger; last seen and weak follow the
later sighting). Add `gb` to nothing else: it is not learning evidence
outside the game and never enters `recall`.

### Picking

N2 rounds are picked by card (`pickRound`) and stay so for words, exam and
connective cards. Only the places a round gives to grammar change: they are
picked by block, with `kanjiPick` as the model:

1. `weak`: a missed block again, in another pattern if there is one.
2. `new`: a block never met, by `level` then by how many patterns use it
   (most used first): its `block` card, then a `build` card of a pattern
   whose other blocks are already met.
3. `prove`: a met, unproven block: an `infer` card of a pattern never shown
   whose blocks are all met.

Places left over go to proving before anything new. If no block card fits,
the place falls back to today's `g:` card, so a round is always full. Do not
change how many places grammar gets; do not touch `flowMix`, the comeback
rule or the recovery round.

### What must not change

- No existing id, no saved progress, no scored N2 card.
- The scoring rules (`POINTS`, `payoutCap`), the boss, the rank, the run clock.
- `n2-inventory.json` and the deck (a sentence that fails to hold its
  pattern is listed in the report, not rewritten here).

## 7. The screen

**Nothing here is on a designer board** (board 18, "kanji from parts ·
grammar from parts", was listed and never drawn). Quick round's markup and
styles follow the boards, so:

- Build the `block` and `infer` cards with the existing grammar card as it
  is (sentence, underline, four choices): they need no new layout.
- The `build` card needs one new thing: the row of parts with glosses. Use
  existing pieces only (`.qr-chip`, the review's reading line) and list it
  in `docs/QUICK-ROUND-BACKLOG.md` for the designer, with a screenshot path.
- Home may gain one count, "N2 grammar · 12 of N blocks known", in the same
  quiet line the kanji count uses. No new surface.
- Any CSS change bumps `styles.css?v=` in `index.html`, `n2-mock.html` and
  `sw.js`; any shipped change bumps `CACHE` in `sw.js`.

## 8. Order of work, and what done looks like

Work on a branch of your own from `main`. Do not commit to `main` or push.
`npm run check` and `npm test` pass at every step. Report after each step.

1. **The index.** `n2-grammar-blocks.json`, `tools/validate-grammar-blocks.mjs`,
   the briefs, `test/grammar-blocks.test.js` holding rules 1–10 of section 4.
   Done: the validator passes on all 221; the report gives the counts the
   validator prints and names every `opaque` pattern.
2. **The record and the cards.** `gb`, the three card kinds in `gamePool`
   (behind `parts`-style optional input so the pool without the file is
   exactly today's pool), `mergeGame`, tests like the "Kanji first" tests.
   Done: `gamePool` without the index deep-equals today's pool; with it, the
   new ids exist and hold the bar; a simulated player's blocks go from met
   to known.
3. **Picking and the screen.** Block-first grammar places, the `build`
   card's parts row, the Home count. Done: seen in a browser at 375 px in
   light and dark, with screenshots named in the report; a round at rank N2
   still has its usual mix of kinds.
4. **Later, separately:** patterns of other levels as unseen tests (N1
   patterns built from N2 blocks) once they have sentences; reviewing the
   new cards so they can score.

## 9. How the work is audited

The auditor will not take the report's word for any of this.

**The index**
- Runs the validator and the tests from a clean checkout.
- Reads a random 30 patterns in full: is the split the one a teacher would
  make, are the glosses true for every pattern that uses the block, does
  any gloss give an answer away, is `literal` honest?
- Re-runs the blind solve on a random 30 with a different model than the
  one that wrote them, and compares `transparency`. More than 5 of 30
  disagreeing fails the step.
- Checks the single-block share and reads every `opaque` entry: is it
  really opaque, or was the split lazy?
- Checks no entry contradicts `GLOSS_FIX` or the inventory.

**The code**
- `gamePool` without the index equals the pool on `main`, card for card.
- Every new card: four distinct choices, the answer not among the wrong
  ones, no wrong choice sharing the answer's meaning.
- `transfer` cannot be earned on a pattern already shown, or with an unmet
  block (tries both).
- No points, day count change beyond what a `record` card does today, no
  `recall` write, no change to any saved N2 id.
- `mergeGame` on two devices: counts the larger, no block lost.
- Plays ten rounds in a browser and reads every grammar card shown.

**The report** must say, plainly: what is built, what was seen by eye, what
was only tested, the measured coverage (not the hoped one), every pattern
left `opaque`, every deck sentence found wanting, and what waits on the
owner or the designer.
