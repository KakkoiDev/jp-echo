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

## v286 (26 Nov 2026): built from the owner's go-ahead

- Item strength Lv 0–5 (board 9, fix 17): squares on the card, "Level up",
  "Lv 2 → 1" on a miss and in the review, the "Lv up" strip at round end, 極
  with a gold frame. Not on the board: the mastered line has no "Seen 61
  times" (no count is kept), and the level takes the corner the "Again" chip
  had.
- Resume (board 12 · B, fix 12), listen cards out without a voice (fix 1),
  no answer before the word is heard and one clock after a hidden tab
  (re-audit), recovery on accuracy only.
- Short screens: under 760 px of height the loop uses 48 px choice rows and
  less air. Not on a board; for the designer to confirm.

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

## The boss exam in Quick round's look (owner, 27 Nov 2026)

The boss is sat on the N2 page's exam screen (intro, questions, break,
listening, results), which wears Echo's Washi look: paper texture, Mincho
titles, outlined rows. Coming from the game it reads as another app. Remake
it to match Quick round ("Blitz on washi"): the game's head and chevron, flat
surfaces, the 14 px clock bar, choices in the UI sans in the thumb zone, the
game's buttons, and results that read as a round end with the verdict and the
rank change. One skin over the same screens and logic, as Day Radio and
Evening recall have (`body[data-from=game]`); never a second exam player.
Needs boards from the designer first: intro, a written question, a reading
passage with its questions, a listening question, the break, pause, the
question grid, results (three sections and two sections), and the rank moving
up or down. Not started.

## A boss's misses (v303, 27 Nov 2026): built without boards

Owner, 27 Nov. First built as cards re-asking the boss's questions on their
deciding lines; the owner saw that this trains memory of one answer, so it
was reworked the same day: the rounds take only what transfers (`bossCards`),
and the questions are read, not answered, in a boss review opened from the
run on Home (`bossReview`).

Built from existing pieces, for the designer to look at:
- **The boss review** is the round's review screen. New on it: the paper's
  question above the answer (`#game-review-ask`, Mincho 17 px, muted, the
  tested word or the filled blank underlined in seal), a sentence-long answer
  set as a line (`.qr-word.line`, sans 19 px, left), a "Full paper" chip in
  the sub line's right slot, and no "Say it with the voice" line.
- `.qr-ch.s`: sentence-long Japanese choices at 15 px on three lines (an exam
  card's long choices were cut at two).

Open:
- **Deciding lines exist for sets 2 and 3 only** (97 of 106 questions).
  Elsewhere a reading or listening review card has the question, the answer
  and the why, with no line from the passage.
- **The lines and their English are AI-drafted**, checked by a blind solve,
  not by a reader. The three "wrong meanings" written for each are unused now.
- **Few listed N2 words sit in a deciding line**, so most passage cards come
  from the rest of the passage. Patterns are found only when written whole.
- **A listening line goes to the voice without readings.**
- 問題8 and 問題9 misses bring nothing into the rounds (no target); they are
  in the review.

## Word parts: prefixes and suffixes (v305, 27 Nov 2026): built without boards

Built as a grammar card in shape, head label "Word part" (working name).
Open:
- **Unreviewed, and scored since `SCORE_ALL`.** Several glosses of the list are poor for a
  part ("kind of field, ground" for ～場, "count for sisters" for ～女), and
  wrong choices are other parts' glosses, often far from the answer.
- **18 of 167 have no card**: the part shows twice in its sentence, is
  conjugated there (～過ぎる, ～きる), or the entry is not a clean part
  ("しわ (かおの～)").
- **No 問題3-style card yet**: a word with a gap and four parts to choose
  from, which is how the paper asks it.
- N5, N4, N3 and N1 lists hold no parts (they come from JMdict's word lists).

## Grammar from its blocks

Two handoffs wait on other people (27 Nov 2026):
- **Content review** by a reader of Japanese (person or model):
  `docs/GRAMMAR-BLOCKS-REVIEW-HANDOFF.md`, with everything to read in
  `tools/grammar-blocks/review-data.json`. The cards stay unscored until it
  is done.
- **Design**: answered by board 13, "Grammar from its parts", and built in
  v301 (all seven changes of its build list). Differences from the board,
  for the designer:
  - The review keeps one underline under the pattern; the board cuts it per
    part there too (the review sentence carries furigana).
  - On a 375 × 667 screen the five-row card with a two-line sentence and a
    two-line choice overflowed by 11 px at the board's sizes. Five rows are
    24 px there, not 26, and the sentence is 1.6 lines high.
  - 2 of the 156 build cards keep one underline (を～に任せる, お～願う):
    their parts do not fill the reviewed underline exactly.
  - The stamp's sound is two short triangle tones, not a sampled wood block.

The local preview uses existing Quick round grammar cards and adds a row of
chips for the parts and their glosses. The designer still needs to review the
row at 375 px in both themes, including long glosses and narrow wrapping.
Capture the screenshots at
`docs/design/game/shots/grammar-build-375-light.png` and
`docs/design/game/shots/grammar-build-375-dark.png`. See the
[implementation report](GRAMMAR-BLOCKS-IMPLEMENTATION.md) for the preview URL
and the content release checks.

## Ranks N5 to N1 (v288, 26 Nov 2026): the first step, built without boards

Built: inventories for N5, N4, N3 and N1 (`levels/`, fetched and kept), word
cards for them (reading, meaning, which word, listen), the rank in the game
state and the sync, a round at rank N3 = eight N3 cards and two from N5 and N4.

Decided by the owner (26 Nov) and built in v289: questions build the item
record, only the boss moves the rank. Promotion at the pass total plus 10
with section minimums; 150 or more also opens the next boss at once; the
second failed boss in a row moves the rank down. The rank moves only to a
level that has a boss, so today every verdict waits (only N2 has mocks). The
rank's level comes first in a round; lower levels take two places; the level
above joins those places once 95% of the rank's words have been met.

The gate judges the half-time boss as it is sat (owner, 26 Nov): promotion
has no separate full-time sitting.

Kanji first (v290, owner 26 Nov: "we were focusing on the compounds and
roots of each kanji and grammar points"). A level is its kanji, not its word
list: N3 is 638 kanji. Rounds at a rank of word cards pick a kanji, then a
word for it; Home counts kanji known. In a simulation at 80% right, all 638
N3 kanji are met in about 200 rounds and known in about 300, having shown
about a third of the level's cards.

Open after v290:
- **N2 is still picked by card.** Its record keeps kanji too, but its rounds
  and Home are unchanged. Kanji-first picking for N2 is the owner's call.
- **A word from another level can score.** A kanji-first round at N3 may use
  an N2 word as its example; that card is N2's, so it pays points and a miss
  saves an N2 recall check.
- **Wrong readings borrowed from other words** (援助: たすける, きゅうじょ) are
  easier to rule out than the 問題1 traps. Better: swap in another reading of
  the same kanji (行: こう / ぎょう). Needs the audit before these cards score.
- **Irregular words** (今日, 大人: 2–9% of a level) do not split; their kanji
  are tracked without a reading.
- **Kanji from parts as its own card** (board 18) and **grammar points** as
  the second unit: grammar outside N2 still has no cards (no decks).
- **Home's kanji count** ("N3 kanji · 1 of 638 known · 11 met") is not on a board.

A boss at every rank (v291, owner 27 Nov: "I want the app to be functional
asap, do as if the N1 files were already there"). N5, N4 and N3 open their
own papers from the game; the rank moves on the result. Known gaps:
- **N1 has no papers yet** (two finished drafts, none shipped): at N1 there
  is no boss and the rank cannot move from there until they ship in `sets/n1/`.
- **One written clock.** The real N3, N4 and N5 papers time vocabulary apart.
- **Listening** plays as on the N2 screen (replay allowed, choices shown), not
  the one-play sequence of the real paper; no pictures.
- **Results of a level paper** still offer N2 practice (a timed N2 section).
- **Level papers are reachable only as bosses**: there is no list to sit one freely.
- **Level cards pay no points**, so a run at N5 to N3 scores only its boss.

Waiting on the owner:
- **Mock exams for N5, N4, N3 and N1**: in their own session. Add each level
  to `BOSS_LEVELS` (n2-game.js) once its sets and its exam screen exist.
- **Where a new player starts.** The plan says N5; today a state with no rank
  is N2, because only N2 is scored. To switch once N5 can score.
- **Review at N2.** N2 rounds mix in no lower level while those cards are
  unscored (they would slow the run to the boss). They join once reviewed.
- **Reviewing the new levels' cards** so they can score (`REVIEWED_LEVELS`):
  the same audit N2 had. Their meanings are JMdict's first sense, unedited
  (e.g. 適度 "moderate" beside "appropriate, suitable"; long glosses on N5
  particles and counters).

For the designer (none of this is on a board):
- **The rank on Home**: today the tiny line under the chart ("Rank N3 ·
  practice, not scored yet · change in Settings").
- **The rank in Settings**: a five-way segment (N5 … N1) with a hint; it goes
  once promotion is decided, or stays as "test out of a level".
- **The card tag**: "N3 practice · not scored" and "N5 review · not scored" on
  the existing practice tag.
- **Home's run card at a rank without a boss** now reads "N3 words · 1 of
  2,055 known · 8 met · no N3 boss yet" in the run card's own pieces; "Best
  runs" and the 14-day chart still show beneath, empty.
- **The last boss verdict** is a clause in the tiny line under the chart.
- **Item level on an unscored card**: the practice tag takes the corner the
  squares use, so the level only shows in the review and the "Lv up" strip.

Left for later (not started): example-sentence decks for N5, N4, N3 and N1;
grammar, connective and exam cards for them; mock exams (bosses) for levels
other than N2; N0. Misses on another level's cards save no recall check, so
they do not reach Today's checks, Evening recall or the Night Radio.

## After the exam: the rank becomes the level

**To reassess after 6 Dec 2026 (owner, 27 Nov):**
- **Word parts for N5, N4, N3 and N1.** Prefixes and suffixes exist at every
  level, but those lists (built from JMdict's word lists) hold none; only
  N2's list has them (167). Decide where each level's parts come from, give
  them sentences, and build their cards as N2's (`affixCards`).
- **Unreviewed content is scored (`SCORE_ALL`, v305).** The owner chose
  points on every card over waiting for reviews. Still unread by a reviewer:
  the other levels' pools, the grammar pieces (3 "wrong" findings open), the
  167 word parts (poor glosses such as ～場 "kind of field, ground"), the
  connective excerpts. A wrong key now costs points; the flag button is the
  remedy until each is reviewed.

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
