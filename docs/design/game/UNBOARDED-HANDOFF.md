# Built without boards: designer handoff

For the designer of Quick round ("Blitz on washi"). Written 27 Nov 2026.

Since board 13 the owner asked for a run of features before the JLPT on
6 Dec, and they were built with existing pieces only, no board. Everything
below is live (v319 and after) and needs your eye. The canvas and the
standing rules are in `DESIGNER-HANDOFF.md` beside this file; open items are
in `docs/QUICK-ROUND-BACKLOG.md`.

## How to see them

Open `https://echo.kakkoi.dev/n2-mock.html?view=game` on a phone (375 px
first). Most cards come up in ordinary rounds; to get one at once, play a few
rounds or ask the owner for a device state. The boss screens open from Home
when a boss is due (`?book=n2-set-3&boss=1` opens one directly; starting it
starts the clock).

## What was built

### Cards in a round

| # | Card (head label) | What it shows | Where the markup lives |
|---|---|---|---|
| 1 | **Meaning** (changed) | The deck sentence with the word underlined, instead of the word alone; 4 s | `#game-sentence` |
| 2 | **Word part** | 前～ / ～気味: the sentence, the part underlined, its meaning to pick | as a grammar card |
| 3 | **Word part · fill the gap** | 昨日から少し風邪（　）だ。 and the sentence's English under it; parts to pick | `.qr-en` under the sentence (new) |
| 4 | **Grammar · fill the gap** | The pattern's sentence with a gap, its English under it, four forms | same as 3 |
| 5 | **Connective** | One connective large; where it is built of pieces (それ + な + のに) the pieces as board 13's ruled list | board 13 list |
| 6 | **Connective · fill the gap** | Two short clauses and a gap; four connectives | the gap of board 11 · F |
| 7 | **Sentence order · ★** | Lead text, three ruled slots with ★ on the third, tail text; four tiles | `.qr-blank.star` (new) |
| 8 | **Same meaning** | One sentence; four sentence-long choices | `.qr-ch.s`: 15 px, three lines (new) |
| 9 | **Reading sprint** | A short passage that scrolls inside the card, its question under a hairline, four choices, 90 s | `.qr-sent .qr-ask` (new) |
| 10 | **Exam · 問題n** (changed) | The paper's marked word is underlined in seal instead of shown in 【 】 | `.qr-big.exam u` |

After an answer, a word or pattern made of pieces (やむ + を + えない) says
them in the line's slot as "piece by piece …", like board 13 · D–E.

### The review after a round

- Every card is spoken once (it used to be some kinds only).
- A missed exam question now reads like a word card: the word or pattern
  large, its meaning large, the paper's sentence with the answer in place
  and its English, then the why.
- A missed card made of pieces shows the pieces and the "piece by piece"
  line (board 13 · G's slot).

### The boss review (new screen)

Tapping a finished run on Home opens it: every wrong or unsure answer of
that boss, on the round's review screen, read and never answered.

- Head: a back chevron at the left of the "Boss review · 3 of 45" line, and a
  "Full paper" chip at the right.
- A word or pattern: as the round's review. A reading or listening question:
  the question above (`#game-review-ask`, Mincho 15–17 px, muted), the right
  choice as a line (`.qr-word.line`, sans 17–19 px), the pick struck, the
  deciding line from the passage in the example card, its English, the why.
- 5 s a card, 8 s for reading and listening; hold and Next as in the round.

### Home

- The run row reads "Run 1 · ×1.5 · **Boss review** · 261,488 ›".
- Under the chart: "Last boss · 言語知識 30/60 · 読解 20/60 · 聴解 51/60", with
  "(under 19)" on a section below its minimum. It sits as a second tiny line
  under the rank line (`#game-home-sections`).
- The dock's pair is now three: **読 Sprint**, 音 Radio, Settings.
- The rank segment is gone from Settings: only the boss moves the rank.

### The round end

When a card was flagged in the round, a strip offers one tap to say why:
"Flagged · 〈word〉" and six chips (Wrong answer, Meaning, Reading, Voice,
Odd Japanese, Other). Never asked during play.

### The boss exam (skin, no new screens)

When the exam is a boss, the N2 page's exam screens wear the game's look
(`body[data-boss=true]`, the block after the Day Radio skin in styles.css):

- Intro: 鬼 in seal instead of the 試 seal box; the game's chevron; the
  primary button as the game's Play button (60 px, seal).
- Questions: the clock in the sans, a 14 px bar, the 問題 label as an
  uppercase overline, passages as flat panel cards, choices as the game's
  rows (16 px radius, indigo when chosen, sans 17 px bold).
- Break and results: the game's buttons; "Back to Quick round".

Seen at 375 px: the intro and one written question. **Not seen:** a reading
passage, listening, the break, pause, the question grid, results.

## What to design

1. **Every card of the table**: is each right as built? In particular the
   new pieces: the English line under a gap sentence (3, 4), the ★ slot (7),
   three-line sentence choices (8), the scrolling passage with its question
   (9). Card 9 is the only long card in the game: does it belong in a round's
   look at all, or does it want its own?
2. **The boss review**: head, the question-over-answer layout, the long
   answer as a line, the deciding line. It is now the main way the owner
   studies a boss.
3. **Home**: the section line (is a tiny line right for the most useful
   number on the screen?), the dock of three, the run row's label.
4. **The flag strip** at the round end.
5. **The boss exam**: boards for intro, a written question, a reading
   passage with its questions, a listening question, the break, pause, the
   question grid, results (three sections and two), and the rank moving up
   or down. This is the backlog item "The boss exam in Quick round's look";
   the skin is a stand-in until your boards.

## Constraints (unchanged)

- Echo's tokens only (`--washi`, `--panel`, `--sumi`, `--ink-muted`,
  `--hairline`, `--seal`, `--chip-learn-*`, `--gold`). No new colour or font.
- Light, dark and system themes; 375 px first; nothing behind hover.
- The clock bar and the four choices in the thumb zone do not move; under
  760 px of height the four choices and "I don't know" stay on screen.
- Reduced motion stills any animation; the clock bar is exempt.

## What to hand back

Boards at 375 px, light and dark, for the items above, and for each change
what it touches and a rough size, as on the earlier fix lists.
