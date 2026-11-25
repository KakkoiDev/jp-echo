# Rules (as built, v268)

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
| exam | an authored question (問題1–5 or 7) | as authored | as authored | 4 (問題1), 5 (2, 3), 7 (4), 6 (5), 8 (7) |

- Meanings are the first two senses of the dictionary entry, with any
  Japanese removed so a definition can't give its answer away.
- Words written with ～ (affixes such as ～発) are left out.
- Exam questions come only from sets the learner has already sat, so a set not
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

## Points

Speed is rewarded and mistakes are punished hard (the learner's choice).

- **Right**: 50, plus up to 250 for speed (all 250 if answered at once, none
  at the time limit), times the **combo**: ×1.1 for each right answer in a
  row before it, up to ×2 at ten. A fast answer with a full combo is 600.
- **Wrong**: −200.
- **I don't know** or **time out**: 0.
- A wrong answer, I don't know and a timeout all reset the combo.
- A blind guess among four, even an instant one, averages
  ¼ × 300 − ¾ × 200 = −75 points, so guessing always loses to an honest
  "I don't know". The screen still says "Part of the game. Keep going.": the
  points punish, the words don't.

## Day and boss

- **Daily goal: 1,000 questions.** The round's end shows "N of 1,000
  questions today".
- **The boss**: when the day's 1,000 are done, a full-length mock opens on
  the first set not sat yet (sets 19 and 20 last), about 2 h 50 min with the
  break. Before that it shows as locked.

## Feedback

- Right: the row is tinted, a rising note plays (higher with the combo), and
  the next question comes after 0.25 s.
- Wrong: the picked row is struck through, the right row tinted, a low note,
  "Part of the game. Keep going.", and the next question after 0.8 s.
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
