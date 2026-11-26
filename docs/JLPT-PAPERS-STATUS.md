# Boss papers: where they stand (paused 27 Nov 2026)

Branch `feat/jlpt-level-sets` (worktree `.claude/worktrees/jlpt-sets`), based on
`feat/quick-round-levels` at `0f2aa92`. Not pushed, not merged. `npm run
check` and `npm test` pass (875 tests). The fuller design is in
`docs/JLPT-LEVEL-SETS.md`; this page is the state of the work.

## Papers

| Level | Shipped in `sets/` | In progress in `.papers/done/` | Not written |
|---|---|---|---|
| N5 | 10 | | |
| N4 | 10 | | |
| N3 | 10 | | |
| N2 | 19 in `n2-sets/` (unchanged) | | |
| N1 | 0 | 6 drafts (see below) | 4 (sets 7–10) |

N1 drafts, all passing the validator against their plans:

| Set | State when paused |
|---|---|
| n1-set-1 | Finished: hardened to the N1 guide, 100 / 100 on the blind solve, spoken replies re-solved 30 / 30 after a wrong key was fixed |
| n1-set-2 | Finished: hardened, 99 / 100 on the final solve, the one wrong key (#42) fixed |
| n1-set-3 | Hardened in three passes; the final blind solve was stopped: run it |
| n1-set-4, 5, 6 | Written with the N1 guide and solved blind once (answers in `.papers/answers/`); their edit was stopped before it changed anything: run it, then the final solve |
| n1-set-7 to 10 | Planned (`.papers/plans/`), authors stopped mid-writing; start them again |

Before N1 ships: the level-wide repeat check
(`tools/compare-level-sets.mjs`), then `tools/build-level-sets.mjs`.

`.papers/` is ignored by git and lives only on this machine. It replaced a
temp folder that a reboot erased on 26 Nov (four N3 drafts were rebuilt from
the agents' saved logs).

## How a paper is made (all of it is in the repo)

1. `tools/plan-level-set.mjs` plans it from the level's inventories: candidate
   words and grammar (least used first), a theme, a scene for every text and
   spoken question, and the position of every right answer.
2. A writer follows `tools/level-set-brief.md` + the plan (N1 also
   `tools/paper-pipeline/N1.md`).
3. `tools/validate-level-set.mjs --plan` holds it to the layout and the plan.
4. A blind solve (`tools/paper-pipeline/SOLVER.md`, `blind.mjs`, `score.mjs`).
5. An edit (`EDITOR.md`), then a second blind solve of the edited paper.
6. `tools/compare-level-sets.mjs` across the level; rewrite repeats (`DEDUPE.md`).
7. `tools/build-level-sets.mjs` ships it; `test/jlpt-sets.test.js` holds it.

Writers, solvers and editors were Claude models (Fable for N5 and N4 writing,
Sonnet for everything since the owner's instruction of 26 Nov: no Fable
sub-agents). A second AI's hand-off was checked: its N4 de-duplication
rewrites and its N3 set 3 (after an edit) were kept; its N3 sets 4–10 and N1
sets 1–10 were template-filled and rejected.

## What the audits found, in numbers

- Every shipped paper agreed with its key on every question in its final
  blind solve. That is necessary, not sufficient: see below.
- The first blind solve plus edit changed 8 to 30 questions a paper. Typical:
  weak wrong choices replaced; one to five questions a paper with a second
  acceptable answer; a few wrong explanations; two wrong keys in N1 rewrites
  (both caught by the next solve).
- Writers working apart repeat each other: ten N5 papers had 94 near-identical
  question pairs before scenes were planned; N3 sets 4–10, planned with scenes,
  had one.
- Sonnet's first N1 drafts had N1 prose and N3 questions (about half of each
  paper too easy). With `N1.md` in the brief the count fell to 11–22 a paper.

## Also built

- `mixPaper()` (`jlpt-sets.js`): a boss assembled from the written papers,
  one block per 問題 group from a different paper, a text always with its
  questions, least-seen first, never a held-out paper. No AI, no network.
- A mini-boss form (about a third of each 問題) in the blueprints and the
  planner. No mini papers are written; `mixPaper` cannot yet build one from
  boss papers.
- The owner's rule recorded: the boss is sat and graded at half the standard
  time; promotion is the pass mark plus 10 with the section minimums.

## Not done, and who it waits on

- **The game cannot open any of these papers.** The exam screen and the boss
  still know only N2 (`n2-mock.js`, `n2-game.js`, `n2-study.js`); the list of
  what they need is in `docs/JLPT-LEVEL-SETS.md`. Those files belong to the
  Quick round session.
- N1: finish as in the table above.
- Layouts of N5, N4 and N1 are the published composition as known
  (`confirmed: false`): jlpt.jp was closed on 26 Nov. N3's was checked by an
  outside audit against the 2018 workbook.
- No native review, no audio, no pictures for the listening questions that
  use them on the real paper. N5 and N4 text is written without the spaces
  between words that the real papers print.
- Difficulty: reviewers judged N5 to N3 a little easier than the real papers,
  mostly in the closeness of wrong choices.
- Merge: `CACHE` in `sw.js` is still v288 here; `feat/quick-round-levels` has
  moved past `0f2aa92` and `package.json` will conflict in the check list
  (keep both lines).
