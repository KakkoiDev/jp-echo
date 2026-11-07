# Echo — designer prompt: close the November discrepancies

Paste everything below the line into the designer AI.

---

You designed the November pass for Echo, a Japanese language-production PWA
(Washi and seal: warm washi paper, Shippori Mincho for display Japanese, Zen
Kaku Gothic New for UI, one vermilion seal accent). That pass is now built and
shipped, in nine PRs, from the bottom two rows of your canvas. Building it
turned up places where the boards and the app disagree, and states no board
draws. This pass closes them, so the next build can match you exactly.

## Sources

- **Your canvas:** https://claude.ai/artifact/GvfDGGMseigok2pDxrKCBZ
- **Echo Design System:** https://claude.ai/artifact/5KU1QLyQHsanMMttrfndY6
- **Original brief, with the owner's answers of 7 Nov:** https://claude.ai/artifact/WaRBRceAcNzkpn37zymcqf
- **What shipped:**
  - the board beside the build, light and dark: https://github.com/KakkoiDev/jp-echo/tree/main/docs/design/november/shots
  - decisions and PR list: https://github.com/KakkoiDev/jp-echo/blob/main/docs/design/november/README.md
- **The code's design tokens:** `styles.css` lines 1–60 at https://github.com/KakkoiDev/jp-echo/blob/main/styles.css

## Rules for this pass

1. **The app wins on tokens and existing primitives.** Draw with the code's
   values (table at the end), not the canvas's. Where your board uses another
   value, update the board.
2. **Don't redesign.** Draw only the states and screens listed here, matching
   the boards that already exist next to them.
3. **Every item needs a verdict.** Each item below ends with **You decide**. Answer
   with one of:
   - **Board** — the code should change to match the board as drawn;
   - **Code** — the board changes to match the build;
   - **New board** — draw it, and name the board.

   One sentence of why for each.
4. **Draw each new board three ways:** 390×664 light and dark, plus the 360px
   width where text could wrap. Add desktop (1280×900) only where the item
   says so.
5. **No new actions.** If a board needs an action Echo doesn't have, flag it as
   "needs owner" instead of drawing it as if it existed.
6. **Leave alone:** the AnchorAudit alternates (よ→鎧, れ→レモン, ち→地図,
   ん→判子, そ→蕎麦, こ→駒) and the redraws of や, め and つ. Those wait for the
   owner, not this pass.

## A. States no board draws (draw them)

**A1. Mora: the Combined section** (`/mora?section=combined`). The build shows
the yōon table with three columns (ya/yu/yo) and a row label, plus a hint about
fused sounds. Pictures appear where a combined sound has its own anchor
(きゃ…りょ); fused sounds show no picture.
- Draw: the section and its title/count line, a cell with its own picture,
  a fused cell, and the voiced variants (じょ as a giant 醤油, ぴゃ as a
  balloon 百).
- Shot: `pr7-mora-combined.png`.
- **You decide:** New board **MoraCombined** (and its dark version).

**A2. Mora: the Specials section** (`/mora?section=specials`). The build has
a "Small っ" card (きって = 木 → 手×2), a modifiers line, ん and を. No board
draws it.
- **You decide:** New board **MoraSpecials** (and its dark version).

**A3. Drill: a wrong answer.** DrillAnswer draws only the right answer. In
the build a wrong pick marks the chosen card, reveals the right one, and the
sound goes back into the round to repeat at the end.
- **You decide:** New board **DrillMiss**.

**A4. Drill: a perfect round.** DrillDone draws a round with misses. With
none, the build shows the same screen with an empty misses list.
- **You decide:** New board **DrillDonePerfect**, or say DrillDone covers it
  and what replaces the misses list.

**A5. Drill: the first sound on iPhone.** iOS Safari won't play sound until
the learner taps, so the first card can't speak by itself. Today the build
shows the card with a Hear button and waits.
- **You decide:** New board **DrillStart**, or confirm the current behaviour.

**A6. Search: the kanji result row.**
- The board draws a 46px tile with a seal border and the meta line
  "umbrella · N2 · met in 1 sentence".
- The build reuses the Kanji map's existing cell (`kanjiCell`). That cell is
  styled by learning state (known, learning or new), so most kanji have no
  seal border.
- **You decide:** **Code** (the search reuses the map cell) or **Board** (search
  gets its own tile). Board means a second look for the same kanji, which the
  rules discourage, so say why if you choose it.

## B. Board and code disagree (pick one)

**B1. Desktop Library.**
- DesktopLibraryTools draws a two-column card list with no sentence pane.
- The app has always shown the list with the open sentence beside it, and
  that's what shipped.
- Shot: `pr9-desktop-library.png`.
- **You decide:** **Code**: redraw DesktopLibraryTools with the sentence pane.
  Or **Board**: then also draw where a sentence opens on desktop (full page?
  overlay?), at 1280×900.

**B2. Desktop Mora: the drill entry.**
- The board puts "Drill: 10 sounds" as a button in the page header.
- The build keeps the phone's drill row ("練 Drill: 10 sounds · Hear a sound,
  find its anchor · about 2 minutes") under the toggles, so one action has
  one look.
- Shot: `pr9-desktop-mora.png`.
- **You decide:** Board or Code.

**B3. Mora: where ん goes.**
- The board puts ん in the わ row, fifth column (わ · · を ん).
- The build's data puts を in that slot and ん on a row of its own.
- **You decide:** Board (then confirm the phone layout too) or Code.

**B4. Mora toggles at 390px.** Pictures / Furigana / English / Test yourself
wrap onto two lines at 390 (and at 360). The board shows one line.
- **You decide:** Draw the 360 and 390 layouts: shorter labels, a scroll
  row, or two lines on purpose.

**B5. Sentence menu: "Write it again".**
- SentenceMenu has "新 Write it again — Echo makes a fresh version; you keep
  both". Echo has no such action.
- The build put the existing "Edit, or correct with Echo" there.
- **You decide:** **Code**: redraw the row with the existing action and its
  copy. Or flag it **needs owner** as a new feature.

**B6. Sentence page: the echo counter.**
- The old page showed the number of echoes.
- SentenceFocus doesn't draw it, so the build hides it. The count still shows
  in the Library rows and in Practice's "Pick up where you left off" (12×).
- **You decide:** where the count goes on SentenceFocus, if anywhere.

**B7. The learner composer.**
- PracticeReturning draws the label "Practise a sentence", the placeholder
  "Something you want to say, in English", and an outlined → send button.
- The build kept Echo's shared composer, which every learner input uses:
  its own label and placeholder, and a filled send button.
- **You decide:** **Code** (the boards use the shared composer), or
  **Board**. Board changes the composer everywhere it appears, including
  Discussion, Reading and Review, so draw it in those too.

**B8. Library search.**
- LibraryTools dropped the Library's sentence search.
- The build moved it into the filter sheet (FilterButton) rather than remove
  a feature. Search also exists at `/search`.
- Shot: `pr3-filter-sheet.png`.
- **You decide:** Code (keep it in the sheet: draw it there), or say it goes.

**B9. Review: the skill mix.**
- ReviewHome draws the skill mix one way.
- The build keeps the existing 聴 読 書 glyph tiles (SkillGlyph), the one look
  for skills.
- Shot: `pr4-review.png`.
- **You decide:** Code (update the board) or Board.

**B10. Review: the evening Radio window.**
- The brief says Radio is offered "from 7 pm".
- The build shows it from 19:00 to 04:59, so a learner going to bed after
  midnight still sees it.
- **You decide:** confirm the window, or give the end time.

**B11. Mora: the voiced explanation.**
- An earlier owner-approved change (#105) had a long explanation of the
  giant (巨大).
- MoraVoiced replaced it with two mark cards ("゛ 巨大 giant and heavy",
  "゜ 風船 a balloon that pops"), and the build follows the board.
- Shot: `pr7-mora-voiced.png`.
- **You decide:** confirm the cards replace the long text, or say where
  the long text lives.

**B12. Practice: hero emphasis and ripple.**
- The build follows PracticeReturning: the hero's emphasis word is ink, not
  seal, and the background ripple is hidden.
- That changed the earlier code.
- Shot: `pr4-practice-returning.png`.
- **You decide:** confirm, or put them back.

**B13. Word sheet (WordNote).**
- The WordNote board restructures the word sheet.
- The build only added the AnchorStrip to Echo's note, because the board
  doesn't account for everything the current sheet holds: the dictionary
  entry, its kanji, example sentences from the learner's library, Echo's note,
  and the AI explanation.
- Shot: `pr7-word-note.png`.
- **You decide:** redraw WordNote with every current section placed (or say
  which ones go and where they move to).

## C. Tokens: update the boards to the code

The boards use some values that differ from `styles.css`. The code wins, so
please re-export the dark boards with these values. Known difference: the
dark-theme line colour. Dark boards use `#3D362D` for lines; the code's dark
`--hairline` is `#363028` and `--rule` is `#2C2820` (`#3D362D` is the code's
`--disabled-bg`).

The tokens to use:

| Token | Light | Dark |
|---|---|---|
| --washi | #F3F0E7 | #191712 |
| --panel | #FBF9F3 | #221F19 |
| --sumi | #1C1A17 | #F2EEE3 |
| --ink-soft | #55504A | #C4BCAC |
| --ink-muted | #6B645B | #A49B8C |
| --hairline | #D9D2C1 | #363028 |
| --rule | #E2DCCE | #2C2820 |
| --seal | #B8342A | #E0614B |
| --seal-deep | #8F2820 | #EE8672 |
| --seal-tint | #FAEDE9 | #2A1E1A |
| --faint | #B0A99C | #7D7568 |

"System" follows the device and uses the same two palettes.

## What to send back

1. A list from A1 to C, one line each: the verdict (Board / Code / New
   board / needs owner) and why.
2. The new boards (A1–A5 and any New board in B), light and dark, named as above.
3. The updated boards, re-exported with the code tokens. Name each one you changed.
4. Anything you found that this list missed, in the same form.

When you've sent them, the build will follow in one PR per area: mora,
drill, search, sentence, desktop, review/practice, tokens. Each PR will show
your board beside the build.
