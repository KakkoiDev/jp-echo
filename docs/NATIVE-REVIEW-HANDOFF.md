# A native read of what an AI wrote: review handoff

For a native speaker of Japanese, or a reader at that level who teaches
JLPT N2. Written 27 Nov 2026. Content work: nothing has to be run.

## Why

Echo's game, Quick round, prepares one learner for JLPT N2 on 6 Dec. Much of
what it asks was written by AI models in the last days and tested only by
other AI models: blind solves checked that each item has one right answer,
but no person has read the Japanese. A sentence can be correct and still
sound like a translation; a "wrong" choice can be one a teacher would accept.
The learner trusts every item, and a wrong one costs points for a right
answer. **This is the first human read.**

## What to read

`tools/scored-review/native-review-data.json` (about 900 kB), eleven parts.
In order of priority, with what to look for:

| Part | Items | What it is | Look for |
|---|---|---|---|
| `paraphrase` | 239 | One N2 sentence (`ja`, readings in 【】) and four `choices`; `key` is the one that says the same | Is `ja` natural? Does the key really say the same? Could another choice pass? |
| `ordering` | 119 | 問題8: `lead` + four `tiles` (in the right order) + `tail`; the third tile is the answer | Is the sentence natural? **Is any other order of the tiles also natural?** |
| `pairs` | 155 | Two clauses `a` and `b` with a gap; `answer` is the connective | Does only this connective's kind fit? Would しかし, そのため, また also be natural? |
| `gapWrong` | 195 | A grammar sentence with a gap, its `answer`, and three `wrong` choices | Is each wrong choice really wrong there? None should be a teacher-accepted alternative |
| `addedParts` | 28 | Prefixes and suffixes added to the N2 list (不～, ～的, 真～…) with a sentence | Meaning, reading, the sentence |
| `connectives` | 35 | Each connective, its meaning, the line shown after the answer (`after`), and its `pieces` where it is shown built (それ + な + のに) | Meaning and `after` true? Pieces real? |
| `wordPieces` | 646 | Words and patterns shown taken apart: `parts` ([piece, what it adds]) and `literal` | Is each piece real, its gloss true here, the sum leading to the meaning? No folk etymology |
| `partMeanings` | 65 | The meanings given to word parts as parts (～場 "venue, ground for ~") | True as a part? |
| `listLabels` | 17 | Clean labels and meanings for list entries that had a note | True? |
| `examEnglish` | 798 | English shown under the mock papers' sentences (answer in place) | Accurate? Nothing added or dropped? |
| `decidingLines` | 914 | For reading and listening questions: the one or two lines of the passage that decide the answer, and their English | Does the English say what the lines say? |

If you cannot read it all, read the parts in this order and stop where you
must; say what you read.

## What to hand back

One JSON file, `native-review.json`, an array, one object per problem and
nothing for an item that is fine:

```json
{
  "part": "ordering",
  "id": "or-025",
  "severity": "unfair",
  "problem": "練習に can also come before 来月の大会に向けて.",
  "suggestion": "Move 練習に into the lead.",
  "confidence": "high"
}
```

- `part`: one of the part names above.
- `id`: the item's `id`, or `key` for `gapWrong`, `examEnglish` and
  `decidingLines`, or the word for `connectives`, `wordPieces`,
  `partMeanings`, `listLabels`, `addedParts`.
- `severity`: `wrong` (false, or the key is wrong), `unfair` (a second
  answer is acceptable), `unnatural` (correct but not what a native would
  write), `weak` (could be clearer), `note`.
- `suggestion`: the exact replacement where you have one (Japanese with
  readings as 漢字【かんじ】, or English).
- `confidence`: `high`, `medium`, `low`.

Then a short summary: what you read, the counts by part and severity, and
anything about a whole part (a habit of unnatural phrasing, a kind of item
that should not exist).

## What happens next

The maintainer applies each finding, removes an item that cannot be fixed,
and runs the tests. Nothing here is marked "reviewed" until a person has
read it, and this is that read.
