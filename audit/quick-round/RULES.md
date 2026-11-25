# Rules (as built, v279)

Source: `n2-game.js` (logic) and `game()` in `n2-mock.js` (screen).

**Blitz chess, not shogi**: a few seconds a question, almost no pause between
questions. Speed is the skill being trained.

## A round

- **10 questions**, all kinds mixed, never two of the same kind in a row.
- Each question shows four choices, a clock, **I don't know** and **Flag**.
- After the round: a **timed review** of each miss (about 5 seconds each:
  the answer, reading, meaning, the sentence with furigana and translation,
  what was picked; the word is spoken). Next skips; Hold stops the timer.
- Then the round's end: points, best, the day's count, the boss, a ranking of
  best rounds, a 14-day chart. **Next round** starts the next one.

## Question kinds

| Kind | Shown | Choose | Wrong choices come from | Seconds |
| --- | --- | --- | --- | --- |
| reading | a word underlined in its sentence, no furigana | its reading | the word's reading with one sound changed: voicing (か↔が), half-voicing (は↔ぱ), small ゃゅょ made big, a long vowel added or dropped (こう↔こ), small っ swapped with く/つ/ち | 3 |
| meaning | a word | its English meaning | meanings of words sharing a kanji first, then any N2 words | 3 |
| definition | an English meaning | the word | words sharing a kanji first, then any | 4 |
| listen | the word, spoken with its reading by the device voice | its meaning | as meaning | 5 |
| homophone | a sentence with one word written as its reading | the word in kanji | words with the same reading, then words sharing a kanji | 5 |
| grammar | a pattern underlined in its sentence | its meaning | meanings of other N2 patterns | 6 |
| connective (practice) | 問題9 文章の文法: up to two sentences of a reading passage, then the next sentence with its connective blanked, "（　）に入るのは？" | the connective | one common connective per job, leaving out every job that could stand in for the answer's (n2-connectives.js `OVERLAP`) | 7 |
| exam | an authored question (問題1–5 or 7) | as authored | as authored | 4 (問題1), 5 (2, 3), 7 (4), 6 (5), 8 (7) |

- Meanings are the first two senses of the dictionary entry, with any
  Japanese removed so a definition can't give its answer away.
- Words written with ～ (affixes such as ～発) are left out.
- **Every wrong choice is wrong**: a choice that shares a content word with
  the answer's meaning is never offered (`sameSense`); a word spelled the same
  way (紅葉 こうよう / もみじ) never supplies a wrong meaning; a listening card
  never offers the meaning of a word that sounds the same; readings accepted
  for the tested sense are never near misses (`ACCEPTED_READINGS`); and every
  card shows four distinct choices or is left out.
- **Left out until fixed**: items listed in `n2-game-review.js` `EXCLUDED`
  (data/excluded.tsv) with the reason for each.
- A word written the same way twice has its reading in its id (`m:紅葉/もみじ`).
- Connective questions come from reading passages (問題10–14 texts) of sets already sat, never sets 19–20. A miss saves no recall record (a connective is not an inventory item) but comes back next round.
- Exam questions are **written sections only** (文字・語彙 and 文法, 問題1–5 and 7): listening items, whose audio the game cannot give, never enter. They come only from sets the learner has already sat, so a set not
  yet sat stays unseen for a full mock. Sets 19 and 20 are never used.

## Which questions come up

Each question's item (word or pattern) is classed from the learner's recall
records:

- **weak**: missed or slow last time;
- **fresh**: never checked;
- **known**: answered instantly last time.

A round takes **last round's misses first** (they come back to be proved),
then 4 weak, 4 fresh and 2 known, then anything to fill 10. Within each class
the question seen longest ago comes first, and the kinds are taken in turn so
grammar, readings and exam questions aren't drowned by the many word
questions. A question seen in the last four hours is used only if nothing
else is left. A miss missed again comes back again.

**Warm-up after a slump.** When a round goes badly (under half right, or
below zero points), the next round is a warm-up: 8 questions the player has
already won (answered right and fast before, or recalled instantly), 1 weak,
1 fresh, and only 2 of the misses. It says "Warm-up round: things you know."
The slump is judged on the last round only: the next round with at least half
right and points of zero or more ends it.

## Home

Quick round opens on its home: **Play**, **Radio** and **Settings**, with a
meter to the next boss and the ranking of runs. Back from a round returns
here.

## Difficulty (Settings)

| Setting | Aims at | Each right / miss moves the level | Round offset | Points |
| --- | --- | --- | --- | --- |
| Easy | 90% right | +0.01 / −0.09 | −0.2 | ×0.75 |
| Normal (adaptive) | 80% right | +0.02 / −0.08 | 0 | ×1 |
| Hard | 65% right | +0.035 / −0.065 | +0.2 | ×1.25 |

Difficulty doesn't scale penalties (the streak does, see Points).

## Pacing

Games pace in waves of tension and release (Left 4 Dead's AI Director:
build-up, peak, relax; puzzle-game sawtooth curves; Schell's interest curve:
hook, rising peaks, climax, resolution). Each round's difficulty is the zone
level (below) plus an offset for that round:

| Beat | When | Offset | Bonus chance |
| --- | --- | --- | --- |
| hook | first round after 30 minutes away | −0.3 | ×1 |
| breather | rounds 1, 6, 11… since the last boss | −0.25 | ×1 |
| easy | rounds 2, 7… | −0.1 | ×1 |
| steady | rounds 3, 8… | 0 | ×1 |
| hard | rounds 4, 9… | +0.1 | ×1 |
| peak | rounds 5, 10… | +0.2 | ×2 |
| final stretch | the last 50 questions before the boss | +0.25 | ×2 |

The first question of a hook, breather, peak or stretch round names it.

## The zone (difficulty curve)

A hidden level from 0 (easy) to 1 (hard), starting at 0.5, keeps the player
right about **80%** of the time: each right answer raises it by 0.02, each
miss lowers it by 0.08, so it settles where 0.8 × 0.02 = 0.2 × 0.08.
Learning is fastest near that error rate (Wilson et al. 2019) and it is where
a game feels hard but winnable. The level changes three things:

- **The mix** of a round: at 0, 1 weak, 2 new and 7 known; at 1, 5 weak, 5
  new, none known (rounded in between).
- **The clock**: ×1.3 at 0 down to ×0.8 at 1, rounded to half a second,
  never under 2 seconds.
- **How close the wrong choices are**: at 0 none of the confusable choices
  (sharing a kanji) is forced in; at 1 all three are.

The warm-up after a slump (below) overrides the mix for one round.

## Surprise

- About **one question in eight is a bonus**: "Bonus ×3", tinted, worth three
  times the points if right, no extra penalty if wrong. Never on a question
  that came back from last round.
- **Jackpots**: reaching a combo of 5 or 10 is celebrated with its own sound
  and line. It pays no points, so it can't make guessing pay.

## Points

Speed is rewarded and mistakes are punished hard (the learner's choice).

- **Right**: 50, plus up to 250 for speed (all 250 if answered at once, none
  at the time limit), times the **combo**: ×1.1 for each right answer in a
  row before it, up to ×2 at ten.
- **Wrong**: −200, times the same step for the streak it breaks: −200 with no
  streak, −300 on a streak of 5, −400 on 10 or more. Gambling a long streak
  on a guess is the risky move.
- **I don't know** or **time out**: 0. A wrong answer, I don't know, a timeout
  and a flag all reset the combo.
- **The cap**: the whole positive payout of one answer (speed, combo, bonus
  ×3, difficulty) is capped at 200 × (choices − 1) − 50 = **550**.
- **Guessing never pays**: a blind guess never beats "I don't know" on one
  answer, and not over two either (a lucky guess that keeps the streak alive
  for the next card). A test checks every difficulty, streak and bonus.
- Jackpots (combo 5 and 10) are a sound and a line, no points. Flags score 0.
  Connective cards are practice and score nothing.

## The boss and runs

- **Every 1,000 questions** answered since the last boss, the boss opens: the
  real full mock of the first set not sat yet (sets 19 and 20 last) with the
  **written section at half time** (53 minutes) and listening at its own
  length (50 minutes), since its audio cannot be shortened.
- Taking it closes a **run**: the 1,000 questions' points. When the boss is
  finished, its estimated score (0–180) joins the run at 1,000 points per
  exam point. Runs are **ranked by the merged score**; each keeps both parts
  (questions' points, exam total and section scores) for the in-depth view.
- **The run clock** starts on the run's first answer. If the boss is
  finished within **24 hours** the whole run counts **×1.5**, within
  **48 hours ×1.2**, after that ×1. The home shows the live multiplier and
  the time left on it.
- A boss sitting never counts as a standard mock: it is left out of the
  sprint checkpoint and the readiness chart.
- After the boss is finished, the home says **rest** for the rest of that day
  (Play stays a tap away).
- The day's count against 1,000 a day and the 14-day chart stay as they were.

## Bedtime

From the learner's bedtime (Settings, default 23:30) until 5 am, a round's
end says "The night keeps today's work" and its main button becomes
**Evening recall, then sleep** (or **Start the Night Radio** when nothing is
left to recall). **One more round** stays one tap away.

## Feedback

- Right: the row is tinted, a rising note plays (higher with the combo), and
  the next question comes after 0.25 s.
- Wrong: the picked row is struck through, the right row tinted, a low note,
  "Part of the game. Keep going.", and the next question after 0.8 s.
- The answer is not spoken during play (at blitz pace it ran over the next question); the review speaks each missed word with its reading.
- Each card carries a reminder to say it out loud.
- Sounds are generated on the device; a Sound button turns them off.

## What is saved

- **A right answer saves nothing** in the learning records: picking from four
  is easier than recalling, so it is not evidence of knowing the item.
- **A miss, a timeout or I don't know** saves a missed recall check (source
  `game`) for the item, so it also comes back in Evening recall, the Night
  Radio and the next day's checks.
- **Game stats** stay on the device: when each question was last seen, the
  misses waiting for the next round, day totals, the round history and the
  best score.
- **Flag**: one tap saves a report with the question exactly as shown (kind,
  prompt, sentence, the four choices, the expected answer, what was picked,
  the source for exam items), then moves on. It reaches the maintainer through
  the learner's backup gist.
