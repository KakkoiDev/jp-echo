# Grammar from its parts: designer handoff

For the designer of Quick round ("Blitz on washi"). Written 27 Nov 2026.
Board 18, "kanji from parts · grammar from parts", was listed and never
drawn. The grammar half is now built and live (v300) with existing pieces
only, so it needs your eye. Nothing below is on a board.

The canvas and the standing rules are in `DESIGNER-HANDOFF.md` beside this
file; the open items across the game are in `docs/QUICK-ROUND-BACKLOG.md`.

## What it is

The learner works out an N2 grammar pattern from its building blocks: ざる
(an old negative) + を + 得ない (cannot get) → "cannot avoid doing". Three
new card kinds share the grammar places of a round (about one card in eight):

| Kind | Head label | What the card shows | What is picked |
|---|---|---|---|
| Block | GRAMMAR BLOCK | One short sentence, the block underlined | The block's short gloss, among three others |
| Build | BUILD GRAMMAR | The pattern's sentence, the pattern underlined, and **a row of its parts, each with its gloss** | The meaning of the whole pattern |
| Infer | INFER GRAMMAR | The same sentence and underline, no parts | The meaning of the whole pattern |

All three carry the dashed practice frame and the tag "Practice · not
scored": they pay no points until their content has been reviewed.

Block and Infer use the existing grammar card unchanged. **Build is the one
with something new: the row of parts.**

## The row of parts, as built

Screenshots at 375 px: `shots/grammar-build-375-light.png` (three parts) and
`shots/grammar-build-375-dark.png` (four parts).

- It sits inside the card, under the sentence and above the "Say the
  sentence out loud" line.
- Each part is one existing chip (`.qr-chip`, the neutral tone): the Japanese
  piece, then its English gloss, in the UI sans, 11 px bold.
- The chips are centred and wrap; the gap is 4 px; 8 px above the row.
- A chip grows in height when its gloss wraps (the standard chip is one line,
  24 px).
- Markup: `#game-grammar-parts.qr-grammar-parts`; two rules in `styles.css`
  under the Quick round block.

## What to design

1. **The row itself.** It was made from chips because chips existed. Is a row
   of pills right for "this pattern is made of these pieces", or should it
   read as an equation (ざる + を + 得ない), a ruled list, or furigana-like
   notes under the underlined pattern? The pieces are in sentence order and
   that order matters.
2. **Japanese against English inside one part.** Today both are the same
   size and weight, separated by a space. The Japanese piece is what the
   learner looks for; the gloss is the hint.
3. **How it scales.** The real range:

   | Parts on a build card | Patterns |
   |---|---|
   | 2 | 81 |
   | 3 | 47 |
   | 4 | 21 |
   | 5 | 9 |
   | 6 | 2 |

   - Longest glosses are 37 characters ("provides a channel or continuous
     span").
   - Heaviest card: にしても～にしても, six parts, each with a gloss of 25 to
     30 characters. At 375 px that is six stacked lines of chips.
   - Other long ones: か～ないかのうちに (6), に越したことはない,
     ないわけにはいかない, のではないだろうか, という点から考えると (5 each).
   - One pattern has a piece with no gloss (the っ in ところだった); today it
     is a chip with the Japanese alone.
4. **Room on short screens.** Under 760 px of height the loop already
   tightens (48 px choice rows). A five- or six-part row pushes the four
   choices down; they must stay on screen without scrolling. Decide what
   gives: smaller parts, two columns, a collapsed row that opens on tap, or
   fewer lines of sentence.
5. **The link to the underline.** The pattern is underlined in the sentence
   (in pieces when it is split: にしろ…にしろ). Should each part point at its
   piece of the underline, or is the row independent?
6. **After the answer.** Today the row stays as it was. On a right answer the
   card tints indigo, on a wrong one seal. Should the parts do anything: light
   up in turn, show the literal reading ("cannot succeed in not doing it")?
   There is a `literal` line for every multi-part pattern that the card does
   not show yet.
7. **The review after the round.** A missed build or infer card appears in
   the review like a grammar miss: the sentence, the pattern, the meaning.
   The parts are not shown there. They probably should be: that is where the
   learner studies the miss.
8. **A block being proved.** When an infer card is answered right on a
   pattern never shown before, its blocks are "proved" (the game's word:
   transfer). Nothing marks that moment. It is the reward the feature builds
   to, like a kanji read right in a new word. One beat, not a screen.
9. **Head labels.** "GRAMMAR BLOCK", "BUILD GRAMMAR", "INFER GRAMMAR" are
   working names. They sit where "GRAMMAR" sits today.
10. **Home.** One quiet line in the run card: "N2 grammar · 0 of 162 blocks
    known". It shares the card with the run count and the boss line. Say
    where it belongs, or whether it belongs on Home at all.

## Constraints

- Echo's tokens only: `--washi`, `--panel`, `--sumi`, `--ink-muted`,
  `--hairline`, `--seal`, `--chip-learn-*` (indigo, for right), `--gold`
  (bonus). No new colour or font. Japanese that is display text is in the
  Mincho (`--display`); UI text in the sans (`--ui`).
- Light, dark and system themes; 375 px wide first.
- Nothing may depend on hover. The row is read, not tapped, unless you
  design a tap.
- The clock bar and the four choices in the thumb zone do not move.
- A practice card keeps the dashed frame and the "not scored" tag.
- Reduced motion stills any animation you add; the clock bar is exempt.

## What to hand back

Boards at 375 px, light and dark, for:

- a build card with 2 parts, with 4, and with 6 (にしても～にしても), before
  an answer;
- the same card answered right and answered wrong;
- a build card on a short screen (667 px high);
- the review of a missed build card;
- the "proved" beat on an infer card;
- Home with the grammar line.

For each change, what it touches and a rough size, as on the earlier fix
lists.
