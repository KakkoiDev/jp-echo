# Compounds not yet taken apart: audit handoff

For an auditor (a person or an AI model) who reads Japanese at N1 level or
better and knows how Japanese words and patterns are built. Written 27 Nov
2026. Content work: nothing has to be run.

## What this is for

Echo is a study app for a learner preparing JLPT N2. Its game asks fast
multiple-choice questions on about 1,800 N2 words and 221 grammar patterns.

The learner does not want to memorise each item as a sealed unit. Where a
word or pattern is **made of pieces he already has**, the app shows the
pieces and what they add up to, so that the next unseen compound can be
worked out:

| Asked | Pieces | Read together |
|---|---|---|
| それなのに | それ "that" · な "being so" · のに "even though" | "even though that is so" |
| やむをえない | やむ "stop" · を "(it)" · えない "cannot" | "cannot stop it: unavoidable" |
| ざるを得ない | ざる "old negative" · を · 得ない "cannot" | "cannot avoid doing" |
| 以来 | 以 "from that point" · 来 "coming on" | "from then on" |

224 items are taken apart this way. About 1,600 are still asked whole. Some
of those are true single units. Others are compounds nobody has dissected
yet. **Your job is to find those, and to check the ones already done.**

## What you are given

`tools/scored-review/pieces-data.json` (about 460 kB):

- `dissected` (224): `kind`, `word`, `parts` (each `text` and its `gloss`),
  `literal` (the pieces read together).
- `whole` (about 1,600): everything else the game asks. `kind` is
  `connective`, `grammar pattern` or `word`; each has `word`, `meaning`, for
  words the `reading`, and the example `sentence` (readings in 【】).

## What to do

### 1. Find the compounds in `whole`

Go through every entry. Propose a dissection where **all** of these hold:

- **The pieces are real.** Each is a word, particle, ending, prefix, suffix
  or kanji element that a learner meets elsewhere with the same sense. No
  folk etymology: if the historical origin is not what a learner would
  recognise today, or you are unsure of it, leave the item out or mark
  `confidence: "low"`.
- **The pieces help.** Reading them together leads towards the meaning. A
  split that is true but explains nothing (そ + れ) is not wanted.
- **The pieces are reusable.** The best finds are pieces that recur: なら in
  それなら and なぜなら, ない in しょうがない and くだらない, 以 in 以来, 以上,
  以前, 以外.

Look in particular at:

- **Kana expressions** that are a phrase frozen into a word (なんとなく,
  ひとりでに, もしかしたら, おかげさまで).
- **Two-kanji words whose kanji each carry a clear, common meaning** that
  adds up (反面 "opposite + side", 手前 "hand + front"). Not every kanji
  compound: only where the sum is the meaning, and the learner would gain
  from seeing it. A few hundred words in the list are like this; give the
  clearest ones, not all.
- **Compound verbs** (V-stem + verb): 引き受ける, 取り消す, 思い出す,
  飛び出す. Give the two verbs and what the second adds (出す "out; begin",
  込む "into; fully", 直す "again", 合う "mutually", 切る "completely").
- **Words with a productive prefix or suffix** (不, 無, 非, 未, 再, 的, 性,
  化, 的, 上).
- **Grammar patterns** left whole that are in fact built (しかしながら).

### 2. Check `dissected`

For each of the 224: are the pieces real, is each gloss true of that piece
**in this item**, and does `literal` lead to the meaning? The 66 items of
kind `connective` and `word or pattern` were written quickly by an AI and
have not been reviewed: read those most closely (for example とはいえ,
要するに, いきなり, っこない, ともかく, なにしろ).

## What to hand back

One JSON file, `pieces-audit.json`:

```json
{
  "add": [
    {"word": "引き受ける", "kind": "word",
     "parts": [["引き", "pulling (toward oneself)"], ["受ける", "receive"]],
     "literal": "pull in and receive: take on",
     "family": "V-stem + 受ける",
     "confidence": "high"}
  ],
  "fix": [
    {"word": "とはいえ", "field": "parts",
     "severity": "wrong",
     "problem": "いえ is the potential/concessive of 言う, not 'though one can say'.",
     "suggestion": {"parts": [["と", "(that)"], ["は", "as for"], ["いえ", "even saying"]], "literal": "even saying that"},
     "confidence": "medium"}
  ],
  "pieces": [
    {"piece": "出す", "sense": "out; begin suddenly", "seenIn": ["飛び出す", "思い出す", "言い出す"]}
  ]
}
```

- **`add`**: one object per new dissection.
  - `word` exactly as written in `whole`.
  - `parts`: ordered `[text, gloss]` pairs. **The texts joined must equal the
    word exactly** (same kana and kanji, nothing dropped). A gloss is
    English, at most 40 characters, with no Japanese in it, and says what the
    piece does **here**.
  - `literal`: the pieces read together in plain English, at most 60
    characters, leading to the meaning. Where the sum needs a nudge, write it
    as "sum: meaning" (`"does not pass: worthless"`).
  - `family` (optional): the pattern it belongs to, so related items can be
    taught together.
  - `confidence`: `high`, `medium`, `low`.
- **`fix`**: one object per problem in `dissected`. `severity`: `wrong`
  (teaches something false), `weak` (true but unhelpful or unclear).
  `suggestion` gives the corrected `parts` and `literal`.
- **`pieces`**: the recurring pieces you relied on, each with its sense and
  the words you used it in. This is the list the learner should come to
  own.

Then a short summary in prose: how many entries you read, how many you
propose to add by kind, the twenty most useful (pieces that unlock the most
other words), and what you chose to leave whole and why.

## Rules

- Read all of `whole` and all of `dissected`. If you sample, say exactly
  what you read.
- Quality over count. A learner will trust each split; a false one teaches
  a false rule. When in doubt, leave it out.
- Do not dissect by sound alone, and do not split a kanji into its radicals.
- Do not rewrite meanings or sentences. If one is wrong, add it to `fix`
  with `field: "meaning"` or `"sentence"`.

## How it will be checked

A script checks that each `parts` joins to its `word`, that glosses and
literals are within length and contain no Japanese. A second reader is then
given only the pieces and their glosses, without the word's meaning, and must
pick the meaning among four: a dissection is kept where the pieces alone get
that reader there, or close enough that the `literal` closes the gap.
