# Echo — redesign handoff

For the agent implementing this in `KakkoiDev/jp-echo`. Drop this file in the repo root (or `docs/`) before starting.

## Where the design lives

If you are reading this from the zip: `design/` holds every artboard as standalone HTML plus `canvas.json` (positions, sizes, titles) and `index.html`, a gallery that opens them all. `screenshots/` are reference renders — made without the web fonts, so metrics differ slightly from the real thing; trust the HTML. `tokens.css`, `motion.css` and `theme-map.json` are copy-in files.

Canvas: https://claude.ai/code/artifact/80f70c60-3306-4e79-ab6d-02fc002fc6b0

Read it with the Artifact tool, not a browser fetch:

- `action: "list_files"` — lists every artboard
- `action: "read_file"`, `path: "project/Main.dc.html"` — one artboard's full source

Each artboard is a self-contained HTML file with **inline styles and real elements** (`<button>`, `<a href>`, `<input>` + `<label>`, `<ruby>`). Lift the structure and the exact numbers from them. Ignore the `<x-dc>`, `<helmet>` and `<script type="text/x-dc">` wrappers — those belong to the design tool.

Copy exact values. Do not round paddings, radii or font sizes to a 4/8px grid.

## October refresh — what changed in the app, and what the boards say about it

The app moved a long way between the first handoff and this one (`app.js` 89 KB → 230 KB). It adopted the design system — the class names, the seal, the overline, the tool rows — so this refresh is not a restyle: it draws the screens that did not exist in September, in the same system, and corrects the few places the build drifted from it. New or rebuilt boards are marked ★ in the table below.

**Practice has four ways in.** The build added a four-button mode bar (`.practice-mode`: Sentence · Discussion · Reading · Extract) above the start screen *and* two welcome rows (`#welcome-modes`). That is two navigations for one choice. The boards keep one: the start screen's "Or practise another way" rows (話 Discussion · 読 Reading · 本 Extract from text), and each mode is a pushed screen with a back arrow — the same shape as the study tool. Drop the mode bar. The composer at the bottom is the same component everywhere; only its label and its verb change (Begin / Send / Write). `Discussion.dc.html` draws turns as bubbles, Echo's on the left, with *Save to Library* on each; `Reading.dc.html` draws a tapped line opening *Save to Library*; `Extract.dc.html` draws cards with the new words marked, one-or-two-word sentences pre-checked, *Import N selected* as the only filled button.

**Review skills.** Each sentence turns through 聴 heard, 読 read, 書 written (`review-modes.js`). The boards put the trio on the card beside the stage chip, active glyph filled; the card title and one line under it say which and why (`Write it` — "You have heard it and read it. This time the Japanese comes from you"). The listening card (`ReviewListen.dc.html`) has no answer box: *Play sentence*, say it back, *Said it — show me*. Review home gains the skill mix card ("In this session you will: 聴 hear 3 · 読 read 2 · 書 write 2") and a `Review | Stats` segmented control; `ReviewStats.dc.html` is a table, three skill tiles, and seven bars. The checked answer shows *Grammar in it* under the sentence — read from the stored analysis, never asked for.

**Words joined the study tool.** `Kanji | Words | Grammar`, three-way. `MapWords.dc.html` bands the 23,000-word dictionary N5→N1 with the same three states (learned / used / not used yet), word rows with reading and gloss, and the same chips, chunking and per-band *Practise*. `MapWord.dc.html` is the word sheet: senses numbered 一 二, your sentences with it, *Say a sentence using it*, and *A way to remember it* with Adjust — written only when asked for, which the hint says. The Library's entry row reads `学 · Kanji, words and grammar · 214 · 318 · 71 ›`, and a second row `音 · Mora memory table` opens `Mora.dc.html`: the kana grid with one anchor image per mora, the small-kana cards, the two diacritics.

**The sentence page grew up.** Underlines carry meaning: a grey dotted underline is a word you can tap (opens `Dictionary.dc.html`), a vermilion one is grammar explained below; a key line under the meaning says which is which. *Hear it as* Casual | Polite. *Grammar in it* lists points as 一 二 三 with level chips and opens the grammar sheet; *How it has gone* is three skill tiles with the next one outlined; History and *Change this sentence* are collapsible rows. `SentenceEdit.dc.html` shows the rewrite open: directions in the composer (Generate), the new sentence with bracketed readings, *Edit furigana* / *Correct furigana*, the meaning, Cancel / Save. *Find missing references* is a quiet text link; delete stays at the bottom.

**Settings is a page** (`/settings`), with an index of four chips and sub-pages: `SettingsBackup.dc.html` (the secret-gist switch, token, URL, *Back up now* / *Restore from gist*, the status dot, and the backup file export), `SettingsImport.dc.html` (file, URL, the Minihongo starter, Extract from text, the furigana-check progress with Resume), `SettingsAI.dc.html` (service, key, model, Check / Save, remove). *Every day* holds review limits, theme and motion, voices including the two discussion speakers, playback speed, reminders. Reminders are now honest in the UI: the toggle exists, and the line under it says what this device can do — "Echo checks when it is opened… Echo has no server and sends nothing" — which supersedes decision 1 below: ship the toggle, with that line, instead of hiding the section.

**First run** gains step 2 (`Setup2.dc.html`: which way round, and the starter offer with the Minihongo checkbox) and *I have a backup file, or a gist* on Welcome. The empty Library offers the starter and a deck import as two tool rows under "Not sure where to start?".

**Still only in the build, not drawn:** the custom-references card on the study tool (`#custom-references`, Wiktionary/kanjiapi lookups), the speech-provider and grammar sub-pages, the Minihongo cleanup/undo, the side panel on desktop, dark variants of the new sheets. All follow the rules above; none needs a decision.

## Echo anywhere — a proposal, six boards

Not in the build; a proposal the boards make concrete (row *Echo anywhere* on the canvas). The rule: **Echo is a prefill, not a mode.** Select anything — a word, a reading, a sentence, a note — and a toolbar with the seal and six verbs appears on it: Explain · Fix · Rewrite · Look up · Remember · Show me how. Each verb opens the editor a person would use, live from the first moment, with one seal-marked button beside the field (*Let Echo propose*). Nothing is sent until the seal is pressed. Four of the six verbs already exist as separate features (Explain the grammar, Correct furigana, Rewrite with AI, custom references, Adjust on notes); the toolbar is the only new surface and a small registry — verb → context → prompt → where the result lands → how it is verified — is the only new code shape.

Provenance is the trust model: every piece of model-written text carries a chip (**Echo / You / JMdict / Wiktionary…**), both versions are kept, and tapping the chip swaps them. A human edit is never overwritten; a newer suggestion is a quiet line. *Show me how* answers from a bundled manual plus the router's live state, in one sentence, and **points** — a seal ring on the control it means — rather than narrating. *Sources* (Settings) lists where words come from, each with its licence, on/off, and a chip; an entry Echo wrote where every source was silent is marked Echo and never mistaken for a dictionary. One preference, *I write first / Echo offers first*, and each verb can be switched off — with all six off the toolbar is gone and the app is unchanged.

| Board | Shows |
|---|---|
| `EchoSelect.dc.html` | The toolbar on a selected word; what each verb opens; the rule |
| `EchoFix.dc.html` | *Fix*, field first: the reading and meaning editable, the seal beside it, chip You |
| `EchoFixProposed.dc.html` | After the seal: Echo's proposal as a diff, *Use Echo's* / *Keep mine*, the three chips |
| `EchoGuide.dc.html` | *Show me how* on Settings: one line, and the ring on the control it means |
| `EchoSources.dc.html` | Sources with licence, chip and switch; *Add a source* |
| `EchoPreference.dc.html` | *I write first / Echo offers first*; a switch per verb |

## Screen → artboard map

| Screen | Artboard | Notes |
|---|---|---|
| Welcome (first run) | `Welcome.dc.html` | New |
| Connect a translator | `Setup.dc.html` | New |
| Practice, start | `Main.dc.html` ★ | Hero + the three other ways in + composer |
| Practice, loop running | `Practice.dc.html` | Replaces `#practice` |
| Practice, no key | `PracticeNoKey.dc.html` | New blocked state |
| Review home | `ReviewHome.dc.html` ★ | Review \| Stats, skill mix |
| Review, prompt (書) | `Review.dc.html` ★ | Skill trio, card title and reason |
| Review, checked | `ReviewAnswer.dc.html` ★ | Diff + Grammar in it + loop + Again/OK |
| Review, finished | `ReviewDone.dc.html` | Replaces `#review-complete` |
| Review, nothing due | `ReviewEmpty.dc.html` | New |
| Library | `History.dc.html` ★ | Two tool rows: the study tool, the Mora table |
| Kanji and grammar, kanji | `Map.dc.html` | Was `#map-view` — now a pushed screen off Library |
| Kanji and grammar, grammar | `MapGrammar.dc.html` | Was `#map-grammar` |
| Kanji and grammar, looking one up | `MapSearch.dc.html` | New — search the wall |
| One kanji | `MapKanji.dc.html` | Restyles `#kanji-dialog`; adds Adjust |
| One grammar point | `MapPoint.dc.html` | Restyles `#grammar-dialog`; adds notes and examples |
| Library, empty | `EmptyLibrary.dc.html` ★ | Starter and deck import rows |
| One sentence | `Sentence.dc.html` ★ | Lookup underlines, register, skills, grammar, collapsibles |
| Delete confirm | `SentenceDelete.dc.html` | New |
| Settings | `Settings.dc.html` ★ | Now a page: `#settings-view` with four sections |
| Setup step 2 | `Setup2.dc.html` ★ | Languages + the starter offer |
| Discussion — set a scene | `DiscussionSetup.dc.html` ★ | `#discussion-setup` |
| Discussion — live | `Discussion.dc.html` ★ | `#discussion-live` |
| Reading practice | `Reading.dc.html` ★ | `#reading` |
| Extract from text | `Extract.dc.html` ★ | `#extract-text` — reach it from Practice, not a mode bar |
| Review — stats | `ReviewStats.dc.html` ★ | `#review-stats` |
| Review — listen (聴) | `ReviewListen.dc.html` ★ | `#review-passive` |
| Words | `MapWords.dc.html` ★ | `#map-words` |
| One word | `MapWord.dc.html` ★ | `#word-dialog` |
| Mora memory table | `Mora.dc.html` ★ | `#mora-view` |
| One sentence — change it | `SentenceEdit.dc.html` ★ | `#sentence-change` open |
| A word, looked up | `Dictionary.dc.html` ★ | `#dictionary-dialog` |
| Settings — backup | `SettingsBackup.dc.html` ★ | `#settings-backup` |
| Settings — import | `SettingsImport.dc.html` ★ | `#settings-import` |
| Settings — AI service | `SettingsAI.dc.html` ★ | `#settings-ai` |
| Dark theme | `*Dark.dc.html` (7) | `[data-theme="dark"]` |
| Desktop | `Desktop*.dc.html` (3) | ≥1024px |
| App icon & splash | `AppIcon.dc.html` | Spec sheet — replaces `icon.svg` |
| Messages & blocked states | `Messages.dc.html` | Spec sheet, not a screen |
| Focus & motion | `Motion.dc.html` | Spec sheet — has live CSS |
| Foundations | `Foundations.dc.html` | Tokens, spec sheet |
| Landing page | `Landing.dc.html` | For `docs/` or a separate deploy |

## Tokens

```css
:root {
  --washi:     #F3F0E7;  /* page ground */
  --panel:     #FBF9F3;  /* raised paper */
  --sumi:      #1C1A17;  /* text */
  --ink-muted: #6B645B;
  --ink-soft:  #55504A;
  --hairline:  #D9D2C1;
  --rule:      #E2DCCE;  /* list separators */
  --seal:      #B8342A;  /* the one accent */
  --seal-deep: #8F2820;  /* seal text on tint */
  --seal-tint: #FAEDE9;
  --seal-edge: #C9705F;
  --indigo:    #2E4A6B;  /* Learning chip only */
  --disabled-bg: #DFD9CB;
  --disabled-fg: #9A9287;
}
[data-theme="dark"] {
  --washi: #191712; --panel: #221F19; --sumi: #F2EEE3;
  --ink-muted: #A49B8C; --ink-soft: #C4BCAC;
  --hairline: #363028; --rule: #2C2820;
  --seal: #E0614B; --seal-deep: #EE8672; --seal-tint: #2A1E1A; --seal-edge: #7A3A30;
}
```

Paper texture, on the page root in both themes:

```css
background-image:
  repeating-linear-gradient(90deg, rgba(28,26,23,.022) 0 1px, transparent 1px 3px),
  repeating-linear-gradient(0deg,  rgba(28,26,23,.014) 0 1px, transparent 1px 4px);
/* dark: rgba(242,238,227, …) at the same alphas */
```

Type — one Google Fonts link, `display=swap`:

```css
--display: 'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif;
--ui: 'Zen Kaku Gothic New', 'Hiragino Sans', 'Yu Gothic', system-ui, sans-serif;
```

Shippori Mincho carries all Japanese and every heading and number. Zen Kaku Gothic New is the interface. Nothing else.

Radii: 4px buttons and fields, 3px chips and small controls, 2px status chips, 50% only on the mic button. Hit targets ≥44px. Focus: `2px solid var(--seal)` with `outline-offset: 3px`, on `:focus-visible` only.

## What is a restyle, and what is new behaviour

**Restyle only** (no logic change): practice empty and running, library list, settings sections, review finished, all dark variants, desktop breakpoints.

**Needs new logic:**

1. **Tab navigation.** Practice / Review / Library are peers. The hamburger goes. Review is no longer reached from inside History.
2. **First run.** If no provider key is stored, show Welcome → Setup. Skipping lands on Practice with the "No translator connected" banner and a disabled composer.
3. **Review direction reversed.** Card shows **English**; the learner says the Japanese aloud; "Said it — check and listen" reveals the Japanese, starts the loop, then Again / OK. `srs.js` grading is unchanged — only what the card shows changes.
4. **Answer capture.** A textarea on the prompt screen, dictation via the existing Web Speech path with `lang="ja-JP"`, auto-start behind a setting, text editable before checking.
5. **Diff.** Compare the captured answer to the stored Japanese, mark the differing span in the attempt (wavy underline, `--seal`) and the correct span in the target (`--seal-tint` background). A token-level diff is enough; do not attempt grammar analysis.
6. **Sentence detail + delete.** New route from a library row: replay, edit translation, stats, review history, delete behind a confirm sheet. `db.js` needs a delete.
7. **Reminders.** Settings toggle + time. One notification a day, only when something is due, no streak language. Note: on iOS this needs the PWA installed, and scheduling likely needs a push service — the app currently has no backend. Decide before promising it in the UI.

8. **Coverage replaces the Map tab.** See the section below — this one has a data dependency that has to land first.

## Kanji and grammar (the old Map tab)

Artboards: `Map.dc.html`, `MapGrammar.dc.html`, `MapKanji.dc.html`, `MapDark.dc.html`.

**A study tool behind the Library, not a mode of it.** The Library is the sentence list, as shipped. Under the search/filter card sits one row — `学 · Kanji and grammar these cover · 214 · 71 learned ›` — and it pushes a separate screen with a back arrow and no tab bar, like the sentence detail. Two earlier drafts put kanji and grammar beside the sentences as a switch and then as three equal tabs; the user rejected both, correctly: a discovery tool must not carry the same weight as the primary workflow. Library never "lands" on the tool. The row is drawn only when `targetLang() === "ja"` (`hasGrammar()` already gates the grammar half); for any other language the Library is unchanged. Inside the tool a `Kanji | Grammar` segmented control is the only navigation, and search sits above the wall.

**It is not a fourth tab.** Coverage is computed from the library every time it is asked for — `kanji.js` says so itself, "no second copy of the truth" — so it is a second *view* of the sentences, not a second thing. It moves inside Library behind a `Sentences | Coverage` segmented control, and the tab bar goes back to three. Delete `#map-view` as a route; keep `kanji.js` and `grammar.js` untouched.

**One curriculum.** Today the two halves disagree: grammar is banded by JLPT (`LEVELS = ["N5"…"N1"]`), kanji by Japanese school grade (`bands()` → grade1…grade6 + `secondary`). Both are now JLPT, N5 → N1, so one screen measures one thing and the "secondary school" band — ~1,100 kanji in no useful order — stops existing.

> **Blocker — ship this first.** `kanji-readings.js` has no JLPT field; it carries KANJIDIC2 `grade` only (`grep -c jlpt` → 0). A JLPT list has to be added to the data build before any of this renders. One generated file, ~2,136 rows, `{kanji: level}`, plus a teaching order within each band. The design is drawn against **N5 103 · N4 181 · N3 361 · N2 415 · N1 1,076 = 2,136**, which covers jōyō exactly — if the list you ship bands them differently, the counts on the artboards move with it, and nothing else does. `bands()` gains a JLPT mode; grade banding can stay behind it if you want it as an option.

**The 13,000px problem.** 2,136 cells at a 44px touch target is ~305 rows ≈ 13,000px of uninterrupted scroll, which is what the current build draws. The fix is structural, not cosmetic:

- Bands are **shut by default; one opens at a time.** A shut band is one 60px row: level, a one-line label, `N learned · N to meet`, and a stacked bar.
- The open band gets filter chips — `All` / `To meet` / `In a sentence` / `Learned` — so the wall can be cut to the part you came for.
- Inside the open band the grid is **chunked with an overline every 50** (`1–50 · taught first`), so scrolling has landmarks and "learn them in order" is a thing you can actually do.
- Grid is 7 columns at 46px; do not go to 8, it breaks the 44px minimum.

**Three states, and not by colour alone.** Filled seal square, ivory glyph = *learned*. Ivory square, 1.5px seal border = *in one of your sentences*. Ivory square, hairline border, faint glyph = *not met*. Fill weight carries the meaning; the legend spells out all three with counts. Grammar rows use the same three as a 20px swatch — filled with a tick, outlined, hairline.

**"Met" stops being the headline.** The summary leads with `214 learned, 389 met` and one sentence saying what each word means. Met measures what you happened to type; learned is the thing the app is for.

**Your own sentence comes first.** On both sheets the leading action is *Say a sentence using 学* with the mic and Check, inside the sheet — `#kanji-say` / `#grammar-say` already exist and dictation follows `inputLang`. *Or let Echo write one* is a quiet text link. The composer does not need to open.

**Learning is per band, not global.** The one primary button lives in the footer of the band you have open — *Practise the 42 you haven't met* — and it does what `nextUnmet()` already does, walking that band's order. There is no global Learn button competing with it.

**Tagging is not a chore for the user.** `Tag {n} sentences` currently sits in the primary slot on the grammar half — the app asking the user to run its own bookkeeping. It becomes a quiet status line, *18 of your 24 sentences have been read for grammar*, with a text-button escape hatch; the batches should run on their own when a translator key exists.

**Accessibility.** Both `role="tablist"`s need `aria-controls` pointing at the panel they switch (neither has it today). Band headers are `<button aria-expanded>`, not divs. Cells are links with an accessible name of the form "学 — learned, in 3 of your sentences" — the glyph alone is not enough.

**Search** (`MapSearch.dc.html`) sits above the wall and searches whichever half is showing — kanji by character, reading or meaning; grammar by name or gloss. Everything it needs is already in `READINGS` (`on[]`, `kun[]`, `en[]`) and `GRAMMAR` (`title`, `hint`), so it is an in-memory filter over ~2,136 and ~979 rows: no index, no network, works offline, which is worth saying on screen because the rest of Coverage is offline too.

- Match a pasted character exactly first, then kana against `on`/`kun` (strip KANJIDIC's dot: `まな.ぶ` → `まなぶ`), then a substring of `en`. Romaji needs a small kana table — ~50 lines, no new data.
- The field is `lang="ja"` `type="search"`: that is what makes the phone offer its Japanese handwriting keyboard, which is how you actually look up a kanji you cannot read. Free, and it disappears the moment someone "tidies up" the attribute.
- Results are rows — cell in its state, meanings, `N5 · learned · in 3 of your sentences` — opening the same sheet as a cell.
- **Not jōyō** is a real result, not an empty one. 綺 has no cell and no band; say that plainly and offer to write a sentence with it anyway. The composer takes any text; only the wall is jōyō-only.
- **No radical or stroke lookup.** `kanji-readings.js` carries `on`, `kun`, `en`, `grade` and nothing else — no radical, no stroke count, no frequency (`grep -c strokes` → 0). Radical search would need those fields added to the build, the same shape of job as the JLPT list. Handwriting input covers most of what it would buy; don't promise it in the UI until the data is there.

**How learning works (both halves), as the app already does it.** "Practise the N you haven't met" on a band = `startLearn()` scoped to that band: `nextUnmet()` from `settings.learnAt`, opening the sheet with the learn bar (`#kanji-learn-nav`: ‹ Previous · N left to meet · Next ›). On the sheet: *Say a sentence using 学* → `translate()` → `carries(card, 学)` — the sentence is kept only if the Japanese really contains the kanji, otherwise handed back; *Or let Echo write one* → `compose({kanji, known})`, pointed at kanji you have already met so filling one gap does not open three. Grammar is the same shape, but the check is `tagGrammar()` on the one new sentence against the one point — the model's own opinion, and the code says so: it catches a sentence that plainly doesn't use the point, not one the model merely agrees with. Keep that caveat in the UI copy. "Learned" for a kanji means at least one sentence carrying it has reached `srs.state === 2` (Review) — a proxy, and the summary copy says so.

**What deleting does.** Coverage is recomputed from the library on every read (`kanji.js`: "no second copy of the truth"; grammar tags live on the sentence). Delete the last sentence carrying 遅 and 遅 goes back to *not met*; delete the only graduated one and it drops from *learned* to *in a sentence*. This is the right behaviour — the wall is a mirror, not a trophy case — but it must not be a surprise, so the delete confirm sheet now says it: "It is the only sentence you have with 遅 and 電, and the only one using 〜ています — those go back to not met." Computed from `sentenceKanji()` minus the rest of the library; cheap. `learnAt` needs no repair: `nextUnmet(..., {inclusive:true})` already copes with the pointer landing on a now-unmet kanji.

**The tagging button.** Facts: a sentence made through Translate carries no `grammar` field; only sentences made from the grammar sheet are tagged at creation. So untagged sentences accumulate and the grammar wall undercounts until `tagUntagged()` runs: `ceil(N/30)` requests on the user's key, each carrying all 979 point ids in the prompt. The author made it explicit so the cost is visible before pressing, and that principle stands — the earlier draft's "runs in the background" is withdrawn. What changes is the slot: it is no longer the primary button on the grammar half. It is a status line with a price and a text button: *6 of your 24 sentences haven't been read for grammar yet, so they count for nothing here. Reading them is one request on your key. — Read them.* Optional for the build: a Settings toggle "Read new sentences for grammar automatically (one request per 30)", default off.

**Echo-written notes, adjustable, backed up.** The kanji story (`stories.js`, bundled, 2,131/2,136) and, new, per grammar point: *In one breath* (explanation), *A way to remember it* (mnemonic), *Two to try* (examples). Grammar notes are written by `ask()` on first open, on the user's key, and cached. Every note block has **Adjust**: one field ("Tell Echo what to change") + Rewrite, or edit the text directly; *Reset to Echo's* restores the original. Storage: a `notes` store keyed by kanji or point id — `{text, made, by: "echo"|"you"}` — for the story it is an override, the bundle is never edited. Backup JSON includes `notes`; restore applies them. Example sentences are suggestions with a **Keep** button: Keep runs `saveGrammarSentence(card, point)` and it becomes an ordinary sentence — scheduled, exported, indistinguishable. Un-kept examples are not stored. Anki: recommend putting a point's explanation/mnemonic on the cards of sentences tagged with it as an extra field, not as cards of their own (a recommendation, not a decision).

**The kanji sheet** (`MapKanji.dc.html`) restyles `#kanji-dialog` and is not new: tap a cell, get readings, meaning, band, state, and *your* sentences that carry it, each linking to `Sentence.dc.html`. A kanji you have not met shows the same sheet with the sentence list replaced by the one button. Everything on it except stroke count and frequency is already in `READINGS` and `coverage()`.

**Copy that must not regress:** the microphone line. The shadowing loop never opens the mic; dictation (composer or review) uses the browser's speech recognition and that audio is handled by the browser vendor. The README's blanket "the learner's voice is never recorded" needs the same correction.

## The animation shipped and nobody saw it — read before touching motion

`motion.css` went into `styles.css` verbatim and runs: `.is-playing` is toggled by the loop's `onState`, the keyframes fire, `transform-box` is right. It was **invisible, not absent**, for three reasons, and the fix for each is now in `motion.css`:

1. **The compact form was drawn with the full-ring weights.** The only moving echo on a playing screen is the arc pair: a 76px SVG cropped to 42px, 2px stroke, `stroke-opacity: 0.234` — a value measured on 196px rings with a 1px stroke. At phone size it is a pale smudge. New: 96 × 96, cropped to 48, stroke 1.6, **0.5 still / 0.7 moving**, and the arc fade ends at 0.15 so three arcs on a 0.8s stagger never all vanish at once. Measured on-device this time; frames are in the package under `screenshots/motion-*.png`.
2. **The rings never appeared where anything plays.** `.ripple.echo` exists on Welcome, Review home and the empties — all still by rule. New: the same ripple sits behind the sentence on Practice, the checked review and the sentence page, marked `.live`, and receives `.is-playing` from the same `onState` line (`.arcs > .echo, .ripple.echo.live`). Live rings behind text carry 0.30 while playing. `Practice.dc.html` now draws it.
3. **Settings → Motion defaults to Device, and Android battery saver reports reduced motion.** Section 7 honours that, correctly. The Settings line already says so; keep it, and keep *Always on* as the override. If a tester "never sees it" on Android, ask about battery saver before anything else.

Acceptance for the motion PR: on a phone, start the loop and look away from the screen for a second — if you cannot tell from the corner of your eye that audio is playing, the weights are wrong.

## Identity assets

Spec: `AppIcon.dc.html`. The mark is 響 in ivory (`#FCF7EE`) on a full-bleed vermilion (`#B8342A`) square, glyph at 70% of the tile, nudged down 2% for optical centring. Never add rounded corners — every platform applies its own mask.

Author `icon.svg` by hand at 512×512 (a `<rect>` and a `<text>` in Shippori Mincho, or the glyph converted to a path so it doesn't depend on a font being installed — prefer the path). Generate the rest from it with `sharp` or `rsvg-convert`; don't hand-draw each size.

| File | Notes |
|---|---|
| `icon.svg` | Source of truth, 512×512, glyph as a path |
| `icon-192.png`, `icon-512.png` | manifest, `"purpose": "any"` |
| `icon-maskable-512.png` | `"purpose": "maskable"`, full bleed, glyph inside the 80% safe zone |
| `apple-touch-icon.png` | 180×180, no alpha channel |
| `favicon.ico` | 32px with 響, 16px as a plain vermilion square — the glyph is illegible at 16 and a solid colour reads better in a tab strip |
| `mask-icon.svg` | Safari pinned tab: 響 solid black on transparent |
| `splash/*.png` | iOS startup images, one per device size: washi ground, seal, "Echo" below |

Manifest and head changes:

```jsonc
"name": "Echo — Japanese shadowing",
"short_name": "Echo",
"background_color": "#F3F0E7",
"theme_color": "#F3F0E7",
"display": "standalone"
```

```html
<meta name="theme-color" content="#F3F0E7">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#191712">
```

Two live bugs this fixes: `theme-color` is currently `#f2f0e9`, one character off the new washi and visible as a seam under the status bar; and the manifest still says JP Echo in both name fields.

Android generates its own splash from `background_color` plus the 512 icon, so it gets the seal on washi with no wordmark. Only iOS needs the image files. No spinner on either — the app opens in well under a second.

Remember `sw.js`: new asset filenames must be added to the precache list, and the cache version bumped, or installed users keep the old icon.

## Decisions taken so you don't have to

These were open questions in earlier drafts. Each is now a call; overturn one only with a reason in the PR.

1. **Reminders: ship the toggle with the truth under it.** (Revised in October.) The build now checks on open, or via Periodic Background Sync where the browser offers it, and `#remind-reach` says which applies on this device. Keep that line; never promise a push. Superseded: the earlier call to hide the section.
2. **Icons: two files, two purposes.** `icon-512.png` with `"purpose": "any"` — full-bleed seal, glyph at 70%. `icon-maskable-512.png` with `"purpose": "maskable"` — same ground, glyph at 60% so it survives Android's circle/squircle mask. Never one file for both.
3. **Anki export is `Echo.apkg`.** The deck name inside is `Echo` too. `JP Echo` is gone everywhere except git history.
4. **Grammar auto-tagging is a Settings toggle, default off.** "Read new sentences for grammar automatically — one request per 30 sentences." The explicit *Read them* button stays as the manual path. Cheaper prompt while you are there: send `id = title` only, drop the hints — halves the 979-line prompt at no loss the model has shown it needs.
5. **Learned = a carrying sentence at Review.** Keep the proxy. Don't invent a per-kanji test; the app's promise is that you learn kanji by saying sentences.
6. **Notes go in the backup and on Anki cards as a field, never as their own cards.** `notes` store keyed by kanji or point id; `{text, made, by}`; story overrides the same way. In `.apkg`, a sentence card carries the notes of the points it is tagged with in one extra field.
7. **The study tool is Japanese-only.** `targetLang() === "ja"` gates the entry row; nothing else in the Library changes for other languages.
8. **Empty library still opens the tool.** With zero sentences every cell is faint and every band reads `0 learned · N to meet`. *Practise* works from zero — that is the on-ramp. Copy from the app: "Add a sentence and the kanji it uses will light up here."
9. **Offline with no cached note:** the block shows one line, "Connect to write this one", Adjust disabled. Readings, meanings, bands and the bundled story never need the network.
10. **Desktop (≥1024) layout for the tool:** the band list is the left column at 400px, the open band's grid fills the right, and a tapped kanji or point opens as a right-hand panel in place of the grid — the same three-column rhythm as `DesktopLibrary.dc.html`. Not drawn; derive it.
11. **Search is live.** The prototype's search field is a link to the results board; in the build it is an `<input>` filtering in memory, debounced 150ms, from the first character. `lang="ja"` on the input is a requirement (handwriting keyboard), not a nicety.
12. **Explanations are Echo's own words.** The grammar index was read from a Bunpro account; Echo's explanation, mnemonic and examples must be written from the title and gloss only, never from Bunpro's text. Same rule the stories already follow for WaniKani.

### The chosen segment is seal-tinted, never sumi

A rule that changed in October: a selected segment, chip or scene is drawn like every other "on" in the app — `#FAEDE9` ground, `#8F2820` text, weight 500, and for a segmented control a 2px seal line along its bottom edge (`box-shadow: inset 0 -2px 0 var(--seal)`). Not a sumi fill with ivory text, which the build's `.segmented [aria-selected=true]` currently does and which reads as a foreign, black block on washi. Change that rule in `styles.css`; the toggles (`Furigana`, `English`) already use the tint, so the system becomes one idiom. Sumi fill stays reserved for nothing in the light theme; seal fill stays for *states* (learned, due) and the one filled primary.

### Dark theme for the new sheets

`MapKanji`, `MapPoint`, `MapSearch` and `MapGrammar` have no dark artboard. They do not need one: `theme-map.json` in this package is the exact light→dark hex substitution the dark boards were generated with, and it is mechanical. Apply it via the tokens, not per-element.

### A layout trap the artboards had

Every board is a fixed-height flex column with `overflow: hidden`. When content exceeds the height, flex items *shrink* — a 42px control silently became 15px and lost its text. The boards now carry `x-dc>div>*{flex-shrink:0}` so overflow clips instead of squashing. In the app, the equivalent is: never put a fixed-height flex column around content of unknown length without `flex-shrink: 0` on the children, or `min-height: 0` only where you mean it.

### Data sources still to pick

- **JLPT kanji list.** Candidate: Jonathan Waller's lists (tanos.co.uk, CC BY) — the N5 103 / N4 181 / N3 361 / N2 415 / N1 1,076 split the boards use is one common reading of them. Verify the licence before vendoring; record it in the same header comment style `kanji-readings.js` uses for KANJIDIC2.
- **Radicals and stroke counts** (for a future radical search): KANJIDIC2 has both; add them to `build-kanji-readings.mjs` when the time comes, not before.

## Suggested PR sequence

Do not do this in one PR.

1. `design-system` — fonts, tokens, `styles.css` rewritten, existing screens restyled. No DOM restructuring beyond classes. Reviewable by eye against the artboards.
1b. `identity` — icons, favicon, manifest, theme-color, splash, service-worker cache bump. Small, independent, and safe to merge on its own.
2. `tab-navigation` — three tabs, Review home, Library renamed, Settings reachable from every tab. The Map tab is removed here; `#map-view` moves under Library behind the Sentences / Coverage switch, restyled but otherwise as it is.
2b. `jlpt-kanji-data` — the JLPT list in the data build, `bands()` gains a JLPT mode. Data only, no UI. Nothing in `coverage` is worth designing until this lands.
2c. `kanji-and-grammar` — the study tool as a pushed screen off Library, collapsible bands, chips, chunked grid, per-band Practise, search, tagging demoted, delete-consequence line. Depends on 2b.
2d. `notes` — Echo-written explanation/mnemonic/examples per grammar point, Adjust on every note including the kanji story, `notes` store + backup/restore, Keep on examples. Depends on 2c.
3. `review-production-flow` — reversed card, answer capture, diff, the new review screens.
4. `sentence-detail` — detail route, edit, delete + confirm.
5. `first-run` — Welcome, Setup, blocked states, the whole `Messages.dc.html` set.
6. `reminders` — only once a push service exists (decision 1). Until then the section is not rendered.

Each PR: branch off `main`, conventional commit, PR body with a Summary section and a screenshot of the screen beside its artboard. Squash merge. Self-merge is fine on this repo once `npm test` and `npm run check` pass — run both locally first.

## Acceptance checks per PR

- `npm test` and `npm run check` pass.
- Both themes rendered and compared against the light and dark artboards.
- Keyboard: Tab reaches every control and the focus ring is visible on all of them.
- Text contrast ≥4.5:1 (3:1 at 24px+). Caption grey and vermilion fills under white are the two that historically fail.
- Service worker still serves the app offline after a hard reload.
- Existing library data survives the upgrade — no schema change without a migration.
- For `kanji-and-grammar`: the band counts on screen add up to 2,136 and to 979, every cell is ≥44px, with every band shut the view fits in under three screens of scroll, and switching the target language away from Japanese removes the entry row and nothing else.
- For `notes`: a note adjusted, backed up, restored on a clean profile comes back as adjusted; an example that was never Kept is absent from the backup.

## Out of scope

Anything not on the canvas. If the agent thinks a screen is missing, it should say so in the PR rather than invent one.
