# Quick round as one object: designer handoff

For the designer of Quick round ("Blitz on washi"). Written 28 Nov 2026.

From now on the owner works on **Quick round only**. This handoff is about
making everything a player meets from Quick round read as one thing: the
game's own screens, and the screens it opens in its skin (Day Radio, Evening
recall, the Night Radio, the boss exam). Echo's other pages are out of scope.

The standing rules are in `CLAUDE.md` (the Quick round entries, Visual
invariants) and `docs/design/game/DESIGNER-HANDOFF.md`; the earlier open asks
are in `docs/design/game/UNBOARDED-HANDOFF.md` (everything built without
boards) and stay open.

## 1. First: one way to play sound (the owner's ask)

> "I don't like the plain Play and Stop button in the Day Radio and the moon for
> the Night Radio. I want the design to be harmonized." (owner, 28 Nov)

Quick round has no shared playback control. Each screen made its own:

| Where | Control today | Screenshot |
|---|---|---|
| Radio screen, Day Radio card | Indigo 60 px button, ▶ triangle + "Start the Day Radio" | `01-game-radio.jpg` |
| Radio screen, Night Radio card | Grey 60 px button, ☾ moon + "Start the Night Radio" | `01-game-radio.jpg` |
| Day Radio player (game skin) | Bottom bar: ‹ · ↻ · red text button **"Play"** / "Pause" · ⚑ Later · › | `02-day-radio-game-skin.jpg` |
| Night Radio player (full screen, dark) | Text button **"Stop"** | `n2-mock.html` `#game-night-stop` |
| Evening recall (game skin) | Echo's check controls, skinned | `?view=evening&from=game` |
| A listen card in a round | Round play button | `n2-mock.html` `#game-say` |
| Round end at bedtime | "Evening recall, then sleep" / "Start the Night Radio" | `#game-sleep` |

**What to design:** one transport family for all of them.

- The glyphs: play, pause, stop, replay, previous, next, and "start the
  radio" (Day and Night). One icon set, one stroke weight. Whether the radio
  keeps a sign of its own (晝 / 夜, a sun and a moon, or none) is your call,
  but Day and Night should be one pair, not ▶ and ☾.
- The sizes: the 60 px start button of the Radio screen, a player's bottom
  bar, the round button on a listen card.
- The states: ready, playing, paused, finished, disabled with its reason
  ("Play a few rounds first"), and the Night player's low-light state (a dark
  full screen at 2 a.m., one control).

When it is drawn it becomes one component, and every row above uses it.

## 2. Then: a consistency map of Quick round

For each action that appears in more than one Quick round screen, one look.
The ones we have seen differ:

- **Primary buttons.** Play on Home (seal, 60 px), the Day Radio start
  (indigo), the Night Radio start (grey), the boss intro (the game's Play
  button over the exam page), "Next" in the review (ink).
- **Segmented controls.** Day Radio's Listen / Recall (its own pill pair),
  Radio's "Stop after" hours, Settings' difficulty: close, not the same.
- **Heads.** Home's head (seal 速, title, rank chip, sound), the round's
  one-line head, the Radio and Settings heads, the boss review head, Day
  Radio's head in the skin (title, counts, report button in a square).
- **Cards.** The round card, the Radio cards, the run card on Home, Day
  Radio's word card and example card in the skin.
- **The colour of a reading.** Indigo in the skin's Day Radio and the
  round's review; check every place a reading or a right answer shows.
- **Disabled states.** Some say why ("Play a few rounds first"), some only
  grey out.
- **The voice line.** "Say it out loud", "Say it with the voice · back next
  round": wording and placement vary by card kind.

Please add what you find. Screens to walk: Home, a round (every card kind),
the review, the round end (and at bedtime), Radio, Settings, the boss review,
the reading sprint, Day Radio and Evening recall in the skin, the Night Radio,
the boss exam in its skin.

## 3. Built without boards since the last handoff

Besides the list in `UNBOARDED-HANDOFF.md`:

- **Kanji card** (v326): the kanji large, its meaning to pick among four.
  Its review shows the readings, the meanings and up to three words that
  carry it (`05-kanji-card.jpg`, `06-kanji-review.jpg`).
- **Kana card** (v327, for a player at N5): the kana large, "Say it out loud",
  its romaji to pick (`04-kana-card.jpg`). The owner's drawn mora pictures
  (`anchors/`) would belong in its review; the review has no picture slot yet.

## What to hand back

1. Boards for the transport family: glyphs, sizes, states, the Night player.
   Light and dark, 375 px first.
2. The consistency map: one row per shared action, its one look, and which
   of today's variants goes.
3. For each change, what it touches and a rough size, as on the earlier fix
   lists.

## Constraints (unchanged)

- Echo's tokens only (`--washi`, `--panel`, `--sumi`, `--ink-muted`,
  `--hairline`, `--seal`, `--chip-learn-*`, `--gold`); no new colour or font.
- Light, dark and system themes; 375 px first; nothing behind hover.
- In a round, the clock bar and the four choices in the thumb zone do not
  move.
- Reduced motion stills any animation (the round's clock bar is exempt).
- The Night Radio needs the screen on: its player must stay readable and
  calm at the lowest brightness.
