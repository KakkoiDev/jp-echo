# Quick round backlog

Designer canvas: https://claude.ai/code/artifact/f130fa64-fbf6-42e7-95d8-37a04867160e
(also https://claude.ai/artifact/WnS8aWWCdDwUpR11uyL1qw; private, share from its menu).

What has been set aside, and why, so nothing gets lost. Newest decisions
first within each group. Quick round's rules are in `audit/quick-round/RULES.md`,
its look in `docs/design/game/DESIGNER-HANDOFF.md`.

## From the audit (26 Nov 2026), not needed before the exam

- **Fix the 13 excluded exam items in their source sets.** Listed with
  reasons in `n2-game-review.js` `EXCLUDED` (and `audit/quick-round/data/excluded.tsv`).
  Fix each in `n2-sets/`, bump `SETS_EDITION`, then remove it from `EXCLUDED`.
- **湿気 in the word list.** `n2-inventory.json` says しっき; Echo's sentence
  teaches しっけ. The game already keys しっけ (`READING_KEY`); the inventory and
  the recall checks outside the game still say しっき.
- **Review the connective excerpts** (228, `audit/quick-round/questions/connective.jsonl`)
  so connective cards can score again. Until then they are practice.
- **Homophones left out** (18 in `EXCLUDED`): each needs a sentence that picks
  one spelling or sense before it returns.
- **Meanings that overlap without sharing a word** ("possible" / "impossible")
  are not caught by `sameSense`; the audit counted 102 candidates to review.
- **Resume a round after an interruption**: keep the round and the pending
  feedback when the app is backgrounded or closed; pause the card meanwhile.
- **Start the listening clock after the audio plays**, and treat a playback
  error as unscored.
- **Count a timeout differently from a real miss** in the recall evidence.
- **Boss attempts independent**: match a run to its exact attempt; handle an
  abandoned boss, a repeated set and a boss finished after midnight.
- **The 24-hour run multiplier** can compete with sleep: reconsider.
- **Glosses**: 宛名 "addressee's name", 発売 "release / going on sale",
  鈍い（のろい） "slow", 留まる "perch"; annotation spans 田んぼ, ごみ箱, 編み物.

## From the designer (canvas, 26 Nov 2026)

Fixes 1–12 are built (v276). Waiting on the owner:

- **Clocks for the coming kinds**: connectives 8 s (today 7), kanji from parts
  5 s, grammar from parts 6 s.
- **Item levels**: each item Lv 0–5; a right answer in under half the clock
  adds one (at most once every 4 hours); any miss, timeout or "I don't know"
  takes one away; Lv 5 is 極 (mastered) and comes up less. Device-only stats.
- **"Rest first" for the boss**: on its arrival the boss can wait on Home.

After 6 December:

- 13 · Boss arrival and half-time intro screens
- 14 · Run ranking in depth (stacked bars, per-section breakdown)
- 15 · Item strength Lv 0–5 (above)
- 16 · Desktop rails and keys
- 17 · Connective cards with job labels on the answer
- 18 · Kanji from parts · grammar from parts

## After the exam: the rank becomes the level

`docs/JLPT-LEVELS-PLAN.md`, phase 4: start at N5, move up a level by passing
that level's boss, reach N0 once N1 is easy; lower levels keep coming back as
review. The promotion and N0 bars are still to be set.

## Done since the audit

- Quick round progress syncs through the gist in the N2 file (`game`, merged
  by `mergeGame` in sync.js) and comes in the N2 export.
- The game has its own Radio screen: Day Radio and Evening recall open on the
  N2 page and come back to the game (`?from=game`); the Night Radio runs inside
  the game with the same plan and cued/held halves as Echo's Radio screen.
- In play, the right answer is no longer spoken (it ran over the next
  question); the review still speaks each miss. ✕ End round leaves a round.
- The game has its own Settings screen (difficulty, bedtime, sound, open on
  launch); switching "Open Echo on Quick round" on in Echo's Settings goes
  straight to the game.
