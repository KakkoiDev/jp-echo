# Mock exams for N5, N4, N3 and N1

Quick round's boss is a full mock exam. Only N2 had mocks (`n2-sets/`), so
only N2 had a gate. This is the work that gives the other levels theirs.
Status, 26 Nov 2026: **two validated N3 drafts, their validator and a fetch
route. Nothing can sit them yet**: the exam screen and the boss still know
only N2 (see the last section). Sets 3–10 of N3, and N4, N5 and N1, are not
started. An independent audit of commit `bbbc667` by a model from another
maker found the gaps this revision closes or lists; its findings are marked
"audit" below.

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

**The N3 layout.** 35 vocabulary (8/6/11/5/5), 23 grammar (13/5/5), 16
reading (4/6/4/2), 28 listening (6/6/3/4/9), 102 in all; clocks 30, 70 and 40
minutes. The audit checked this against the published composition and the
2018 workbook's key: the same. The 2012 workbook is three shorter (9 文脈規定,
8 即時応答; 99 in all), and the counts are a guide, so a real sitting can
differ by a question or two. The author could not open jlpt.jp on the day
(maintenance) and has not re-read the pages; `confirmed: true` rests on the
audit.

## Layout and delivery

- `jlpt-sets.js`: `SET_LEVELS` (per level: 問題 blueprint, the levels it may
  draw from, two reserved held-out ids, where the layout comes from),
  `LISTENING` (how each listening 問題 is presented on the real paper),
  `createSets()` (the loader), `levelRows()` (a set as exam rows).
- `sets/<level>/index.json` → `{level, edition, sets: {id: theme}}`;
  `sets/<level>/<edition>/<id>.json` → the set. Never precached. The worker
  keeps each set once served in the cache `jp-echo-sets`, which app updates
  leave alone; the index is asked for fresh and falls back to its kept copy
  when the network fails or answers with an error.
- **Two editions can be about at once.** `keep(level)` fetches every set of
  today's edition and only then records it as the edition this device holds
  whole (`READY_KEY` in localStorage). `set(level, id)` opens from that
  edition first; a newer index alone never takes a paper away. `ready(level)`
  is the gate for a boss. `set(level, id, edition)` reopens the paper of an
  old attempt.
- An edition is immutable: `tools/build-level-sets.mjs` refuses to rewrite a
  set file with other bytes, validates the whole batch before writing
  anything, and writes the index last. A change is a new edition with every
  set of the level.
- N2's `n2-sets/` is unchanged.
- A set carries what N2 keeps in `tags.json` and `cues.json` inside each
  reading and listening question: `tags`, and `cue`, one deciding span or up
  to three when the answer needs a condition, two facts or a back-reference.

Not done in delivery: old editions are never evicted (that needs to know
which attempts still point at them); `jlpt-sets.js` is not precached because
nothing imports it yet (add it to `ASSETS` with the first import); `CACHE`
is still v288 on this branch, so the merge with `feat/quick-round-levels`
takes a new version number. That branch has moved on from `0f2aa92`:
`package.json` conflicts in the check list (keep both), and `sw.js` and
`CLAUDE.md` changed on both sides.

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
  of each; questions that share a passage sit together; no passage twice,
  punctuation and spacing aside; each 文章の文法 blank asked once.
- Context lengths per 問題.
- Word and grammar targets exist in the level's inventory or a lower one
  (`levels/`), none twice in a set.
- 漢字読み: the key is the inventory reading and choices are kana. 表記: the key
  is the inventory spelling. 用法: the prompt is the word, choices are
  sentences. 文の組み立て: three blanks and one ★.
- Every reading and listening question: 1–2 tags from `TAGS`, and one to
  three cues copied exactly from its context. Every script line is spoken by
  男 or 女 (numbered when there are two).
- Keys are spread across 1–4 (and 1–3).

## What the validator cannot see

`OK` means well-formed, not correct. The audit showed each of these passing:

- A wrong key that is inside the range (except 漢字読み and 表記, whose keys
  are tied to the inventory).
- A cue that is in the text but beside the point, or half of what decides.
- A target that the sentence no longer tests.
- Hard words in running text. The **kanji profile** (at most 1.0% of kanji
  occurrences outside the kanji of the level's inventories) only measures
  spelling coverage: it can be diluted, ignores hard words in kana, and
  flags names. It is a diagnostic, not a measure of level. The **70% of
  targets from the level's own inventory** is an authoring budget, not a
  JLPT rule; these two sets are at 94% and 90% and are still easy.
- Whether a wrong choice is acceptable Japanese, whether two orders work,
  whether the Japanese is natural, whether an item is too easy.
- Likeness to another set or to a published item.

## What only an audit can hold

Each set is, in order:

1. **Solved blind** by a second AI that sees only the paper. Every
   disagreement with the key is examined.
2. **Reviewed** with the key for a second defensible answer, a wrong use that
   is in fact acceptable, unnatural Japanese, explanations that teach the
   wrong reason, and cues that leave out a needed premise.
3. **Compared with the official workbook of its level**, section by section
   (distractor closeness, passage density, script length), and checked for
   scenarios too close to an official item.
4. **Compared with the level's other sets** for repeated targets and repeated
   scenes. Two authors working apart wrote the same note to ゆうた about
   curry, a parcel and the laundry.

Blind agreement is necessary and proves little: all three blind solves
agreed with every key, and the audit still found 25 defective items.

| Round | Who | Result |
|---|---|---|
| 1 | Authors: Claude Fable 5.2, one session per set | Validator OK |
| 2 | Blind solve: Claude Opus | 102 / 102 on each set; one item flagged |
| 3 | Review with keys: Claude Fable 5.2 | 14 items fixed (no wrong key, one second answer) |
| 4 | Independent audit of `bbbc667`: a model from another maker, blind solve first, then the 2018 official N3 workbook side by side | 102 / 102 on each; 0 wrong keys; 14 defective items in set 1, 11 in set 2 |
| 5 | This revision, edition `2026-11-r2` | Every item in the audit's table changed as it asked or replaced; see below |
| 6 | Blind solve of `2026-11-r2`: Claude Opus | 102 / 102 on each, all marked sure; one wording note (set 1 #62's key said she must sign, the note only lets her), fixed after the solve and not solved again |

What round 5 changed. Set 1: #5, #11, #41, #56, #93, #99 explanations
corrected; #19 new sentence; #33 the 無駄 distractor that was usable replaced;
#47 the sentence now shows the speaker did the cleaning; #58 distractors that
need the writer's goal; #62 replaced (it was close to a 2018 official
listening scene, and its key added "alone"); #68, #73, #85 cues completed.
Set 2: #11, #39, #45 explanations and #39's sentence; #47 and #69 wording;
#60, #71, #78, #82, #88 cues completed; #62 replaced, and #22, #27, #91, #94,
#96 rewritten, because they repeated set 1.

**Not changed, and known.** Against the 2018 workbook the audit found the
sets generally easier in distractor and discourse work ("half a notch" was
never measured): 表記 leans on invented compounds where the real paper mixes
real competing words; grammar choices are unrelated forms where the real
paper uses close variants and short dialogues; 文の組み立て reduces to fixed
chunks; reading wrong choices rarely attach a true fact to the wrong cause
or person; 即時応答 stems are 8–22 characters against 21–33, with wrong replies
that fall on sight (set 1 #97, #100; set 2 #98); some items give a strong
guess without the text (set 1 #61, set 2 #89). Set 2's 文章の文法 passage
follows the same arc as the 2018 one (a newcomer joins a local habit after
an encounter) with different events; replace it before the set is reserved
for promotion. The two sets share 16 of 48 targets, several with the same wrong choices (預ける, おかげで, 余裕), and still repeat scenes: 待った？ answered 今来たところ (set 1 #100, set 2 #101) and a walk to the station to look at the shops (set 1 #66–68, set 2 #61). **These two sets are
practice drafts, not promotion papers.** `docs/JLPT-SET-AUTHOR-BRIEF.md` now
asks the next authors for what was missing.

## Still needed before a level's scores count

- A native review, and a native-review sample per level as
  `docs/N2-REVIEW-SAMPLE.md` is for N2.
- Pictures. The real N5–N3 papers print a scene for 発話表現 and sometimes
  picture choices for 課題理解. These sets narrate the scene, which changes
  what is tested: fine for labelled practice, not for a scored sitting.
- Audio: real pace and pauses. Script lengths say nothing about them.
- The held-out sets (`n3-set-9`, `n3-set-10`) do not exist yet; the ids are
  reserved. Promotion needs real unseen papers, kept out of drills, Quick
  round, Radio and review, and a record of when that pool runs out.
- A decision from the owner: the plan says promotion is a **standard-time**
  mock on an unseen paper, while today's boss halves the written clock and
  is kept out of checkpoint evidence. Either the promotion sitting is a
  separate full-time mode, or the half-time boss cannot promote.
- The practice estimate is raw share × the section maximum; the real score
  is scaled. It needs a margin before it drives a promotion.

## What the exam screen still needs to sit a non-N2 paper

No app code imports `jlpt-sets.js`. In order:

1. **Opening a paper.** `getPaper` (`n2-mock.js`) knows `bookIds`, `setFile`
   and the official keys, and refuses `n3-set-1`. Add the level route: the
   paper is `createSets().set(level, id)` through `levelRows(set)`, saved as
   `id@edition` with `level` on the paper and the attempt (records without
   one are N2). Route classification, workbook numbering, the links to the
   official samples, and source, review and report ids all become level- and
   edition-aware. The saved paper snapshot stays the authority for an old
   attempt.
2. **Clocks, skills and score sections are three different things.** N3, N4
   and N5 sit three clocks (vocabulary; grammar and reading; listening: 30/70/40,
   25/55/35, 20/40/30 min); leaving the vocabulary block locks its answers.
   The screen has two phases and a rest. Beyond `SECTIONS`, `PASS_TOTAL` and
   `estimate` (`n2-study.js`), this touches closed skills, ranges,
   transitions, what stays locked after a reload, the intro and break
   screens (N3's 言語知識 is only half answered after the first clock: the
   break must not show it), charts, history, pass lines, drill routing, and
   choosing attempts by level and by standard or speed mode.
3. **Scores.** N3 and N1: three sections of 60, minimum 19 each, pass 95 and
   100. **N4 and N5: two sections**, 言語知識・読解 out of 120 (minimum 38)
   and 聴解 out of 60 (minimum 19), pass 90 and 80.
   `datasets/jlpt/exam-profiles.json` has these.
4. **Listening as on the paper** (`LISTENING`, on every listening row). The
   screen shows the prompt and choices of a four-choice item from the start
   and lets the learner replay. On the real test 概要理解 gives the question
   and all four choices by ear after the talk; ポイント理解 gives time to
   read the choices first; 発話表現 and 即時応答 speak three choices; 発話表現
   shows a picture. A scored sitting needs that sequence, one play; replay
   and transcript belong to an unscored practice mode. Narration, question,
   dialogue turns and spoken choices are separate things: today every line
   has a 男/女 label only so the device has a voice to use.
5. **Tags and cues** come from `n2-sets/tags.json` and `cues.json` through
   `tagMap`; for a level set they are on the row (`tags`, `cues`), hidden
   until review.
6. **The boss.** `bossSet` and the rank gate (`n2-game.js`) work on N2's
   `bookIds`. Per level: call `keep(level)` when the rank is reached, open
   the boss only when `ready(level)` names an edition and the chosen set
   opens, take the set sat longest ago, never a held-out one for practice.
   `BOSS_MINUTES` is N2's.
7. **Held-out sets** per level are `heldOut(level)`; drills, Quick round's
   exam questions and Radio skip them. They must not be used up when the
   practice pool runs dry.
