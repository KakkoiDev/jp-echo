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

## Conformance pass (v280, 26 Nov 2026)

Every screen was measured against the boards at 375 px (rects and computed
styles, light and dark). The canvas now also has board 12 (missing states) and
the designer's "v278 against the boards" review with a new ranked fix list.

Built in v280: Home A–D to the board (64 px head, 28 px chips, boss card,
rest above a quiet run card, the countdown tiers, D alone on the screen), the
live run clock (ticks every second; a sync can't reset it), the score column
(round N / ×1.x combo / combo 0, chips from three in a row), the float in the
combo slot, true minus signs and seal below zero, beat ribbons above the
clock, the final-stretch strip, kanji choices in the Mincho, the English
prompt, exam blanks, the listen card, wrapped sentences from the left, the
flag state and toast, the long pick, furigana overhang, same-sound line in
the example card, round end A–C and the new-best screen, the first-open
empties (board 12 · D), the game's own one-line voice notice, Settings'
Bedtime row, Radio's disabled Start.

Still open (need logic, content or a designer answer):
- Review fix list 1 (listen cards out of the mix without a voice), 3 is built,
  4 (which-kanji wrong choices), 9 (boss arrival and intro), 10 (voice-failed
  card as drawn), 11 (loading), 12 (resume), 15–20.
- The first-ever round is still paced as a hook by `pace()`; only its ribbon
  says "First round".
- Jackpot copy: the boards promise +500 / +1,500, the rules pay nothing, so
  the ribbon and the 十 screen show no number. Designer to reword.
- `--right-on` (dark #141820) has no Echo token: `--panel` stands in.
- Home B's "?" projection row, the night screen's "cue N of M", level chips.

## Radio in the game (v283, 26 Nov 2026): built without boards, for the designer

Owner: "the radio screen and feature feels half baked": only the night looked
startable, and Day Radio opened an Echo-styled screen. Built from the boards'
pieces; the designer should correct any of this:

- **Radio screen (changes board 11 · C).** Each card ends in its own 60 px
  start button in its glyph's colour (昼 indigo, 夜 seal); the bottom dock is
  gone. Day has a Listen / Recall segment above its button, like "Stop after".
- **Day Radio and Evening recall keep Echo's screens and logic** (`?view=radio`,
  `?view=evening`, with `from=game`) and wear the game's look through one skin
  after the Quick round block in styles.css (`body[data-from=game]`): 64 px head with the
  chevron, 8 px progress bar, flat washi, sans UI, 20 px-radius cards, the word
  in Mincho 44/700, the reading in indigo, 52 px buttons (Missed seal-tint,
  Slow outlined, Instant indigo, Show answer ink, Play seal), pause chips as
  pills, the done screen as a round end (72 px button).
- **Night screen.** "cue 41 · 17 sentences tonight": the cues run for a time,
  not a count, so there is no honest "of 136".
- Not done: the game's Sound switch does not apply on those two screens.

## After the exam: the rank becomes the level

`docs/JLPT-LEVELS-PLAN.md`, phase 4: start at N5, move up a level by passing
that level's boss, reach N0 once N1 is easy; lower levels keep coming back as
review. The promotion and N0 bars are still to be set.

## Re-audit of v276 (26 Nov 2026): status

Fixed in v278: homophone kana (the reading stays on screen), sense cues for
words spelled alike (紅葉), glosses (留まる, 鈍い, 発売, 宛名, 白髪, ご苦労様,
手前, 甲斐がある), reading cards drop a sentence whose form differs (生ずる),
the listen clock starts after playback and a failed playback is unscored,
stale speech and callbacks are dropped, practice is exposure only (no
accuracy, level, day, boss, run clock, wins, repeats or bonus), flags and
practice leave the round's accuracy, a hidden tab pauses the card, the boss
closes its run when the sitting starts (exact attempt id), rest follows the
finish (after midnight too), the audit export shows underline, practice and
the filtered near misses, four authored prompts left out for review.

Still open from the re-audit:
- **Resume a round after a reload**: needs a design (the boards have no resume state).
- **Connective excerpts** (@461 ただし fits, @96 しかし fits, @197 starts mid-quote):
  still practice until reviewed.
- ~~10 grammar highlights that the stem match still misses.~~ Done in v284: `GRAMMAR_SPANS` (n2-game-review.js) names the piece or pieces to underline, and `exampleSegments` marks a pattern that sits in the sentence in pieces.
- **Legacy ids** (old wins and comebacks under bare ids) are dropped, not migrated.

## Done since the audit

- The combo-guess advantage is closed (v279): a wrong answer costs −200 × the
  streak step it breaks, and the per-answer cap is 550, so a guess loses over
  one card and over two.

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
