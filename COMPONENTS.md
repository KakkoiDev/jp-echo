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
`current`, `inactive`. Tiles are `aria-hidden`; the caller labels the group.

### GrammarList
`grammarList(items,{onOpen})`, items from `grammarListItems()` in grammar.js:
the answered grammar of a sentence as a numbered list (`kanjiNumeral`). Used on
the sentence page and the revealed review answer only.

### SettingsRow
`.settings-row` (static markup in Settings): title, one-line status, chevron,
64 px floor, `--rule` divider. Opens a settings sub-page.

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
