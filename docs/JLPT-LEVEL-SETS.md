# Mock exams for N5, N4, N3 and N1

Quick round's boss is a full mock exam. Only N2 had mocks (`n2-sets/`), so
only N2 had a gate. This is the work that gives the other levels theirs.
Status, 26 Nov 2026: **N3 is set up end to end with its first two sets;
N4, N5 and N1 are not started.**

## Sources

The same as N2's, for every level:

| What | Where | How it is used |
|---|---|---|
| Composition of test items (問題 names, order, counts, times) | jlpt.jp/guideline/testsections.html | The blueprint of each level (`jlpt-sets.js`) |
| Scoring sections, pass marks, minimums | jlpt.jp/guideline/results.html | `datasets/jlpt/exam-profiles.json` |
| 公式問題集 (2012) and 第二集 (2018), one paper per level with answers, scripts and audio | jlpt.jp/samples/sample12.html, sample18.html | The reference a set is measured against. Referenced and linked, **never copied into the repo** |

N2's "exams" are two things: the two official workbooks, which the N2 page
links and scores with answer keys only (`keys` in `n2-mock.js`), and the 19
sets in `n2-sets/`, written for Echo by AI on 24 Nov 2026 to the real 問題
layout. The other levels get the same: original sets, built to the level's
layout, measured against the official samples.

**Not yet confirmed.** jlpt.jp was closed for maintenance on 26 Nov 2026, so
the N3 counts in `jlpt-sets.js` are the published composition as known
(`confirmed: false`), not re-read from the page that day. Check them, and the
N3 workbook answer keys' question counts, before N3 scores count.

## Layout and delivery

- `jlpt-sets.js`: `SET_LEVELS` (per level: 問題 blueprint, the levels it may
  draw from, two held-out sets, `confirmed`), `createSets()` (fetch on
  demand), `levelRows()` (a set as exam rows, like `realisticRows`).
- `sets/<level>/index.json` → `{level, edition, sets: {id: theme}}`;
  `sets/<level>/<edition>/<id>.json` → the set. Never precached. The worker
  keeps each set once served in the cache `jp-echo-sets`, which app updates
  leave alone; the index is asked for fresh and falls back to its kept copy.
- `createSets().keep(level)` fetches the whole level. Call it when a player
  reaches a rank, long before the boss, so the boss never needs the network.
- N2's `n2-sets/` is unchanged: precached, `BLUEPRINT` and `SETS_EDITION` in
  `n2-forms.js`, validated by `tools/n2-validate-set.mjs`.
- A set carries what N2 keeps in `tags.json` and `cues.json` inside each
  reading and listening question (`tags`, `cue`), so a fetched set is whole.

## Making sets

1. Author into a scratch folder: `n3-set-N.json`, `{id, level, theme, questions}`.
2. `node tools/validate-level-set.mjs <file> --profile` until it prints OK.
3. Audit (below). Fix, validate again.
4. `node tools/build-level-sets.mjs <folder>` writes `sets/` and the index.
5. `npm test` (`test/jlpt-sets.test.js` holds every shipped set).

Revising a set learners may have sat: `--edition <new name>`, all sets of the
level brought over, so older attempts keep their papers.

## What the validator holds (mechanical)

- The level's 問題 in order, with the count, number of choices and instruction
  of each; questions that share a passage sit together; no passage twice.
- Context lengths per 問題 (passage and script sizes of the real paper).
- Word and grammar targets exist in the level's inventory or a lower one
  (`levels/`), at least 70% in the level's own, none twice in a set.
- 漢字読み: the key is the inventory reading and choices are kana. 表記: the key
  is the inventory spelling. 用法: the prompt is the word, choices are
  sentences. 文の組み立て: three blanks and one ★.
- Every reading and listening question: 1–2 tags from `TAGS`, and a deciding
  line copied exactly from its context. Every script line has a speaker.
- Keys are spread across 1–4 (and 1–3).
- **Level profile**: at most 1.0% of a set's kanji may lie outside the kanji
  used by the level's inventories and those below. Measured the same way,
  N2's sets sit at 1.3–2.2% against the N3 inventories, so the limit separates
  the levels.

## What only an audit can hold

A validator cannot tell whether a question has one right answer. Each set is:

1. **Solved blind** by a second AI that never sees the key or the
   explanation. Every disagreement with the key is examined; the item is
   fixed or the solver's error is recorded.
2. **Reviewed** by a third pass for a second defensible answer, unnatural
   Japanese, off-level language and answers reachable without the text.

The results for each batch are in the table below. This is the trust step
the owner set (26 Nov 2026) until a native review exists; it is not one.

| Set | Validator | Blind solve (agree / asked) | Review findings fixed | Native review |
|---|---|---|---|---|
| n3-set-1 アルバイトと学校の毎日 | OK · 0.3% kanji outside | 102 / 102 | 8: two unnatural lines (#68, #89), two weak items (#58, #62), one mislabelled explanation (#96), three 即時応答 with replies too easy to reject (#97, #99, #100) | not done |
| n3-set-2 引っ越しと新しい町 | OK · 0.2% kanji outside | 102 / 102 (one flagged as unsure, #56) | 6: one second answer (#39), その/あの (#56), a shared option pool (#45, #47), a string-match reading item (#69), one mislabelled explanation (#90) | not done |

Authors, solvers and reviewers were all Claude models in separate sessions
(author and reviewer: Fable 5.2; blind solver: Opus, with only the paper). A
model from another maker has not read them yet; "several AIs" is not met in
the sense of several makers.

**Where the two sets sit against the real paper (reviewers' judgement, from
knowledge of the test, not a side-by-side comparison):** format and tone are
right; overall about half a notch easy. 即時応答 and 発話表現 wrong replies are
too easy to reject, 文の組み立て is settled by particles alone, 短文 are simpler
than real ones, and 表記 uses some non-existent spellings. 情報検索 is at or
slightly above the real difficulty. The next batch's brief should ask for
near-miss replies, two locally plausible orders in 文の組み立て, one
cross-paragraph inference per 中文 and 長文, and real-kanji 表記 distractors.

The two sets share 16 of about 45 targets. Give the next authors the list of
targets already used; the level has 2,055 words and 220 grammar points.

## Still needed before a level's scores count

- The blueprint confirmed on jlpt.jp (N3: pending, site closed on the day).
- Each set compared by a person with the official workbook of its level for
  difficulty and length (the passages' lengths are held to ranges; difficulty
  is not measured by anything here).
- A native-review sample per level, as `docs/N2-REVIEW-SAMPLE.md` is for N2.
- Drawings: the real N5–N3 papers use pictures in 課題理解 and 発話表現.
  These sets describe the scene in words instead.

## What the exam screen still needs to sit a non-N2 paper

Nothing here makes `n2-mock.html` open an N3 set. In order:

1. **Level table** (phase 1 of `docs/JLPT-LEVELS-PLAN.md`). `n2-study.js`
   `SECTIONS`, `PASS_TOTAL`, `SECTION_MIN`, `SECTION_MAX` and `estimate()` are
   N2's. Read them from `datasets/jlpt/exam-profiles.json` by the paper's
   level: N3 and N1 score three sections of 60 (pass 95 and 100); **N4 and N5
   score two**, 言語知識・読解 out of 120 (minimum 38) and 聴解 out of 60
   (minimum 19), pass 90 and 80.
2. **Three clocks.** The screen has two phases, `written` and `listening`,
   with a rest between. N3, N4 and N5 sit three blocks: vocabulary (30 / 25 /
   20 min), grammar and reading (70 / 55 / 40), listening (40 / 35 / 30);
   leaving the vocabulary block locks its answers. Each blueprint row names
   its `block`; `levelRows()` puts it on every row.
3. **Opening a paper.** `openPaper` knows `bookIds` and `setFile` (N2). A
   level set opens through `createSets().set(level, id)` and `levelRows(set)`,
   as paper `id@edition` with `level` on the paper and the attempt (records
   without one are N2).
4. **発話表現** (N3, N4, N5; three choices). The script is one narrated line
   and the choices are spoken on the real test; `instructionFor` and the
   three-choice handling assume 即時応答.
5. **Tags and cues** are read from `n2-sets/tags.json` and `cues.json` by
   `tagMap`; for a level set they are on the row (`q.tags`, `q.cue`).
6. **The boss.** `bossSet` (n2-game.js) picks among `bookIds`; per level it
   picks from the level's index, the set sat longest ago first, never needing
   a fetch at that moment (`keep(level)` earlier). `BOSS_MINUTES` halves N2's
   written clock; each level needs its own.
7. **Held-out sets** per level are `heldOut(level)`; drills and Quick round's
   exam questions must skip them, as they skip `HELD_OUT` for N2.
