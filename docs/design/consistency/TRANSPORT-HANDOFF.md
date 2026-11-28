# Quick round: transport family and consistency map, worker handoff

For the worker building Quick round in `KakkoiDev/jp-echo`. Written 28 Nov 2026
by the designer. It covers two new boards: **14 · Transport family** and the
**Consistency map**. Build them in the order below. Anything not on a board:
ask, don't invent (CLAUDE.md, Quick round entry).

## Where the design lives

The canvas is a private Claude Design artifact. You can read it.

- Canvas: https://claude.ai/code/artifact/f130fa64-fbf6-42e7-95d8-37a04867160e
  (also https://claude.ai/artifact/WnS8aWWCdDwUpR11uyL1qw, the same artifact)
- Each board is one file. Read the source with the Artifact tool's read
  action, `path: "project/<File>.dc.html"`. The markup is plain HTML with
  inline styles, so sizes, radii and colours can be copied straight from it.
  `project/canvas.json` lists every board.
- Links to single boards: append `#artboard-<File>` to the canvas URL without
  `.dc.html`, for example `#artboard-Transport` or `#artboard-Map`.

| File | Board | Use it for |
|---|---|---|
| `Transport.dc.html` | 14 · Transport family | the component: glyphs, sizes, states, every place it appears |
| `Map.dc.html` | Consistency map | 18 rules, one look per shared action, what goes, files touched, sizes |
| `Gaps.dc.html` | 11 | Radio and Settings layout (still valid apart from the start buttons) |
| `States.dc.html` | 12 | the game notice (12D), disabled and empty states |
| `RoundEnd.dc.html`, `Boss.dc.html`, `Home.dc.html` | 6, 7, 1 | superseded in places, see below |

### Board tokens → Echo tokens

The boards use short names. In `styles.css`, use Echo's tokens only:

| Board | Echo |
|---|---|
| `--bg` | `--washi` |
| `--card` | `--panel` |
| `--ink` | `--sumi` |
| `--mute` | `--ink-muted` |
| `--line` | `--hairline` |
| `--track` | `--rule` |
| `--seal`, `--seal-on`, `--seal-tint` | the same names |
| `--right`, `--right-tint` | `--chip-learn-fg`, `--chip-learn-bg` |
| `--gold`, `--gold-tint` | the same names |

The Night player's three greys (`#9A9184`, `#857D70`, `#3A342B` on `#000`)
are fixed values for both themes, as in board 11D today. Keep them as
named constants in the night block.

### Where the boards are older than the owner

These owner decisions in CLAUDE.md win over a board's drawing:

- "I don't know" has no "· 0" (27 Nov).
- Connectives are practice.
- Home's rank chip and 読 Sprint dock exist (v288+).

## The colour rule (applies to everything below)

- **Seal**: starting something scored. Play, Face the boss, the boss's Start,
  Next round, Warm-up / Recovery round. One per screen. Never playback.
- **Ink** (`--sumi` ground, `--washi` glyph): anything that plays or moves on:
  every transport control, Next in the reviews.
- **Indigo** (`--chip-learn-*`): the answer only (a right row, a revealed
  reading or meaning, the underline after an answer, a switch that's on).
  Never a button fill.

## 1. Build the Transport component first (M)

One component in `components.js` with its contract in `COMPONENTS.md`
("Transport"). Styles go in the `qr-` block of `styles.css`. Every place listed
under "Use it in" calls it; no screen draws its own play button again.

### Glyphs

24 px viewBox. State glyphs are filled shapes; moves are 2 px strokes with
round caps and joins. Copy the paths from `Transport.dc.html` board A:

| Glyph | Kind | Path (from the board) |
|---|---|---|
| play | filled | `M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z` |
| pause | filled | two rects 3.6 × 14 at x 6.5 and 13.9, y 5, rx 1.2 |
| stop | filled | rect 12 × 12 at 6,6, rx 2.4 |
| replay | stroke | `M4.5 12a7.5 7.5 0 1 0 2.2-5.3` + `M4.5 4v4h4` |
| previous | stroke | `M16 6l-6 6 6 6` + `M7 6v12` |
| next | stroke | `M8 6l6 6-6 6` + `M17 6v12` |
| later | stroke | the existing flag path |
| voice | stroke | the existing speaker path |

No sun, no moon, no ☾. Day and Night are told apart by their **signs** on the
cards: 昼 and 夜, Shippori Mincho 24/800, in a 40 px square with a 1 px
`--hairline` border, radius 10, both in `--sumi`.

### Sizes

| Variant | Spec |
|---|---|
| **start bar** | full width, 60 px, radius 18, `--sumi` ground, `--washi` text 17/900. A 44 px `--washi` disc 8 px from the left holds a 20 px play glyph in `--sumi`. Label, then an optional 12/500 sub-line at 75% opacity |
| **player bar** | 52 · 52 · **64** · 52 · 52 discs, spaced between, padding 12 16 22. Side discs: 1.5 px `--hairline` outline, `--sumi` glyph 22 px. Main disc: `--sumi` fill, `--washi` glyph 26 px |
| **hero disc** | 96 px `--sumi` disc with a 40 px voice glyph (listen card) |
| **night stop** | 72 px disc, 1.5 px `#3A342B` outline, no fill, 24 px stop glyph in `#857D70`, the word "Stop" 13 px under it |

### States

| State | Look |
|---|---|
| ready | play glyph |
| playing | pause glyph; a 3 px progress ring 5 px outside the main disc (`--rule` track, `--sumi` arc) |
| paused | play glyph; the ring holds where it stopped; the head's sub-line ends "· paused" |
| finished | main disc in outline (2 px `--sumi`, no fill) with the replay glyph, "Again" 12/700 under it; replay, later and next go `--hairline` (inert) |
| disabled | `--rule` ground, `--ink-muted` text at full opacity, the disc dashed (1.5 px `--ink-muted`), and a 12 px reason line under the button. Never an opacity fade |
| night | the night stop only |

Reduced motion: the ring jumps and never animates. Every disc keeps an
`aria-label` ("Play", "Pause", "Replay", "Previous", "Next", "Later", "Stop the
Night Radio", "Hear it again").

### Use it in

| Screen | Today (v327) | Becomes | Board |
|---|---|---|---|
| Radio, Day Radio card | indigo 60 px ▶ button | start bar "Start the Day Radio", sub-line "40 items · about 25 min" | 14B |
| Radio, Night Radio card | grey ☾ button | start bar "Start the Night Radio"; disabled with "Play a few rounds first: the night only replays today." | 14B |
| Day Radio player (skin) | ‹ ↻ red "Play" ⚑ Later › | player bar | 14C, 14D |
| Night Radio player | text "Stop" | night stop | 14E |
| Listen card | round play button | hero disc; while the voice plays, the ring runs and the line under reads "Playing · the clock starts when it ends" | 14F |
| Round end at bedtime | indigo / seal buttons | start bar "Evening recall, then sleep" (sub-line "12 items · then the Night Radio") or "Start the Night Radio" | 14G |
| Boss rest, Home rest | indigo / seal Night Radio button | start bar | supersedes 7C, 1C |
| Evening recall (skin) | Echo's controls, skinned | its play/next controls become side and main discs; ask the designer before changing its flow | — |

## 2. Then the consistency map (about 1 day, all S)

Read `Map.dc.html` for the full table. In build order:

1. **Disabled rule** (map 7): one `[disabled]` style in the `qr-` block as
   above, and a reason line wherever a control can be disabled.
2. **One pushed-screen head** (map 10): ‹ 44 px bordered · title 20/900 with a
   12 px `--ink-muted` sub-line for counts · one quiet 44 px icon at the right
   (report; sound on Home). Day Radio's "1 / 40" goes into the sub-line
   ("Listen · 12 of 40"). Report buttons lose their bordered square on Day
   Radio, Evening recall and the boss intro. The round keeps its pips head;
   Home keeps 速 and the rank chip.
3. **No Echo voice panel in the skins** (map 13): `body[data-from=game]` and
   `body[data-boss=true]` hide Echo's panel; the game's one-line notice
   (board 12D) shows on Home only.
4. **One segment** (map 8): `--rule` ground, 4 px inset, 44 px, chosen part on
   `--panel` with a 1 px shadow, 14/700 label, optional 10 px sub-line, no
   glyphs. Day Radio's 聞 Listen / 憶 Recall pills become this.
5. **Signs** (map 12): 昼 夜 読 音 休 as in §1; 速 stays seal-filled, 鬼 stays seal.
   The dock of three gets a sign on all three (Settings: 設).
6. **Card surface** (map 11): `--panel`, 1 px `--hairline`, radius 20, padding
   18; inner rows radius 14. Day Radio's "How Day Radio works" box joins it.
7. **Voice line copy** (map 14): on a card "Say it out loud"; in the review
   and on the radio "Say it with the voice". Remove the per-kind variants.
   "Back next round" moves to the review head's sub-line.
8. **24-hour times** (map 16): "Until 06:30", bedtime "23:30". Format the
   bedtime field's display in 24 h.
9. **Rank chip** (map 18): a 24 px `--seal-tint` chip with `--seal` text, not
   bare text.
10. **Primary buttons** (map 1, 5): seal only as in the colour rule; the dock's
    three outline buttons at one height (52 px).

Map 4, 6, 9, 15 and 17 are already right: leave them alone, but check
Evening recall's reveal uses indigo (15).

## Done means

- `npm test` passes, with a test in `test/` for the Transport contract
  (variants, states, aria-labels, disabled reason present).
- At 375 × 812 and 375 × 667, light and dark: Radio, Day Radio playing,
  paused and finished, Night player, a listen card, bedtime round end, Home,
  Settings, Evening recall and the boss intro all match boards 14 and the map.
- Grep finds no play/stop/moon button markup outside the component.
- No raw colour except the three night greys.
- Reduced motion: no ring animation; the round's clock bar still runs.
- `CACHE` in `sw.js` and the `styles.css?v=` query bumped.
- CLAUDE.md's Quick round entry gets one line naming the Transport component
  and the colour rule; `COMPONENTS.md` gets its contract.

## Not in this handoff (still open, wait for boards)

From `docs/design/game/UNBOARDED-HANDOFF.md` (27 Nov): the new card kinds
(★ slots, sentence-long choices, the reading sprint), the boss review, Home's
last-boss section line, the round-end flag strip, and the boss exam in the
game's look. Also a picture slot for the owner's mora drawings in the kana
card's review. Don't restyle these beyond what the map says until their
boards exist.
