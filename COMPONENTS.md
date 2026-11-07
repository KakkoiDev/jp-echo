# Echo component library

Echo follows one UI rule: **one action, one implementation**.

Reusable interaction behavior lives in `components.js`. A screen may configure a
component with data and callbacks, but must not recreate its DOM/event behavior.

## Components

### LearnerComposer
The only general learner-language input primitive.

Owns:
- text input
- source/target language switch
- microphone/dictation
- submit action
- keyboard submit
- dictation and action status

Used anywhere the learner is expected to express language: Practice, Discussion,
Kanji, Grammar, Words, and future exercises.

Search and configuration fields are deliberately excluded because they are not
language-production actions.

### AIAdjuster
The only primitive for asking Echo to change generated/editable learning content.

Owns:
- adjustment instruction
- microphone/dictation for the instruction
- rewrite action
- optional manual-save/delete/regenerate hooks

The caller supplies the existing content as model context. Instructions can ask
for simpler/more complex/more natural/more precise output or any other revision.

### SkillGlyph
`skillGlyph(mode,{state,size})` and `skillTrio(current,{size,label})`: the one
mark for a review skill (聴 listen, 読 read, 書 write). States `default`,
`current`, `inactive`, and `filled` (a seal mark in a figure: the skill mix,
the stats tiles, a skill already done). Tiles are `aria-hidden`; the caller
labels the group.

### GrammarList
`grammarList(items,{onOpen})`, items from `grammarListItems()` in grammar.js:
the answered grammar of a sentence as a numbered list (`kanjiNumeral`): the
phrase over its gloss, the level as a chip at the row end, a chevron. Used on
the sentence page and the revealed review answer only.

### SettingsRow
`.settings-row` (static markup in Settings): title, one-line status, chevron,
64 px floor, `--rule` divider. Opens a settings sub-page.

### FlagButton
`renderFlagButton(button, sentence)` and `flagSvg` (components.js): the one
flag. The glyph is the drawn Icons/flag line, never ⚑; pressed, it fills.
Three forms from one function: an `.icon-button` in a session bar (named by
`aria-label`), a `.settings-row` in a menu sheet, or a labelled text button on
the sentence page. `toggleSentenceFlag` in app.js owns the write.

### MenuSheet
`.sheet-dialog.menu-sheet` with `.settings-row.menu-row` rows: an overline,
the subject, then one row per action (icon, title, one line of what happens);
a destructive row adds `.menu-row-danger`. Practice's ⋯ (`#practice-more`) is
the first: edit, flag, open its page, delete. Opening it never touches the
loop. Put further per-sentence actions here, not as links under a sentence.

Note: the app imports components.js for these three. Older behaviour still has
inline copies in app.js; move them here as they are touched.

## Rule for new UI

Before adding controls, ask what action they perform. If the action already
exists here, reuse the component. If it does not, add one component here first,
then consume it from the screen.

Do not copy component markup into a new screen. Do not add a second dictation,
language-switch, submit, AI-adjust, save, or playback implementation merely
because the surrounding screen is different.


## Visual contract

Components do not invent their own aesthetic. Their visuals come from Echo's
existing design tokens and shared primitives in `styles.css`.

When a component needs a new state or variant:
1. Prefer an existing Echo control/surface.
2. Express differences with semantic component state, not copied markup.
3. Use existing tokens; do not hard-code a new palette.
4. Verify light/dark/system and narrow mobile.
5. If the visual concept is genuinely new, make it reusable here rather than
   styling one screen locally.

A component API should expose meaning (for example `mode="discussion"`), not
arbitrary styling knobs. This keeps callers from slowly fragmenting the design.


## Primitive rule

Every interactive control is a component, including apparently trivial controls.
Static HTML declares a component host with `data-ui`; `components.js` owns the
primitive implementation and hydration.

Primitive vocabulary:
- `Button` / `IconButton`
- `RecordButton`
- `LanguageSwitchButton`
- `SubmitButton`
- `TextInput` / `TextArea`
- `Status`
- native checkbox/radio/range/select controls wrapped by shared component styling

Higher-level components compose these primitives; they do not copy their icons or
interaction behavior. A screen-specific ID is allowed for orchestration, but a
screen-specific implementation of a generic control is not.

During migration, legacy CSS classes may remain on component hosts to preserve
the established visual design. They are compatibility styling, not permission to
create a new primitive.

### ExpandableList
`expandableList({host,items,render,limit=5,moreLabel,lessLabel})` renders only
the first five items initially. Its shared button toggles the complete list and
the initial subset, exposes `aria-expanded` / `aria-controls`, and resets when
the caller opens a new list. Vocabulary sentence lists use this component.

### FitTextArea
`fitTextArea(field)` expands a generated-content textarea to show its full
value. Sentence editing uses it for the sentence and its separate meaning.

### KanjiFamilyBrowser

The Kanji tab's semantic-family catalogue uses the existing `Button`, `Input`,
`Select` and tappable sentence/loop primitives; it does not create new review
or speech controls. `kanji-families.js` owns read-only validation, search and
derived progress. `app.js` orchestrates the existing Kanji sheet, the theme
filter and one-at-a-time **Add sentence** via `importBackupData`.

The family JSON file is precached in the service worker. Never insert all
catalogue sentences into the local library automatically. Sentence reviews,
playback, dictionary lookup and backup retain their existing owners.

The Kanji Family screen separates **authored example sentences** from **other JMdict words containing the same kanji**. The latter are indexed by `dictionaryIndex` from `words-data.js` and paginated in the detail sheet, linking to Echo's existing Word modal. Dictionary-only words are not assigned synthetic example sentences or SRS state. See `decks/KANJI-FAMILIES-COVERAGE-AUDIT.md` for all-family coverage.

The Kanji Families panel uses native nested `<details>`/`<summary>`: the outer section is collapsed on Kanji navigation, and topic groups inside use JLPT-wall `kanjiCell` buttons. Search renders matching character cells directly; the browser only loads its family data when expanded. No extra family-row cards or fixed initial expansion.

**Group by (November design).** The Kanji tab now has one wall with two
orders: `#kanji-group` (JLPT level | Meaning), URL state as `/kanji?group=meaning`.
Meaning draws `familyTopics()` — the eighteen curriculum themes folded into ten
— through the same `renderKanjiBand` as the JLPT wall, so cells, states, chips
and "Practise the ones you haven't met" are shared. The old `#family-panel`
browser above is no longer shown (it stays in the markup for its tests); remove
it and `renderKanjiFamilies` together once nothing depends on them.

### Radio
`/radio`, reached from the Review home's 夜 Radio row (a `library-tool
two-line` row, the same as "Or practise another way"). `radio.js` owns the
night plan (`radioPlan`, `radioPhase`), the queue (`radioQueue`: reviewed at
least once, most recently reviewed first) and what each phase says
(`radioSteps`). `RadioPlayer` and `NoiseBed` (speech.js) play it; app.js only
draws the setup page and the `#radio-night` screen and holds the screen wake
lock. Deep-sleep cues are the sentence alone, never followed by its meaning
(`test/radio.test.js`). Phase copy lives in `RADIO_PHASE_COPY`.

## November primitives

Added for the November design pass (`docs/design/november/README.md`). Each
renders markup from escaped text; screens pass data and callbacks only.

### ToolShelf
`toolShelfHtml(tools)` / `toolShelf(host,tools,{onOpen})`: every tool beyond
the practice loop as a flat row of 52px glyph tiles (the tool row's glyph
tile, laid flat) with an 11px label under each. Tools are
`{id, glyph, label, name?}`; `name` is the accessible name when the label is a
short form. There is one shelf, in Library (`/library#tools`); Practice links
to it with one 話読本 row. Do not add a second list of tools elsewhere.

### HeaderSearch
`headerSearchHtml()` / `hydrateHeaderSearch(root,{onOpen})`: the magnifier
`.icon-button` in every tab header, named "Search everything". It opens
`/search`; the caller owns navigation.

### FilterButton
`renderFilterButton(button,summary)` / `wireFilterButton(button,dialog)`: one
quiet 34px control that names the current filter ("All · Newest") and opens a
`<dialog class="sheet-dialog">` holding the real controls. The button never
owns the filters; the sheet's selects do, and commit on `change`.

### AnchorStrip
`anchorStripHtml(items,{compact})`: the mora anchors of a reading, in order,
each a link to its Mora cell (`/mora?section=…#<kana>`). Items are
`{mora, image, mark, picture, href}` with `mark` `"giant"` (゛) or
`"balloon"` (゜). The full form shows kana, picture and image name with
arrows between; `compact` is the chip form for lists. The anchors come from
`moraMnemonicTokens` (core.js); the strip never chooses an anchor.

`cornerMarkHtml(mark)` is the one corner mark for giant (巨 on seal) and
balloon (a seal ring), shared by the strip and the Mora table.
`themedPictureHtml({light,dark})` holds both drawings; the active theme,
forced or system, shows one.

Mora cells and the AnchorStrip share `mora-pictures.js` (domain: which drawing,
which section, which cell) and `themedPictureHtml` / `cornerMarkHtml`
(presentation). A link to `a.anchor-cell` is handled once in app.js
(`openMoraCell`): it closes any sheet, opens the section and lands on the cell.
