# Echo — brief for the design agent

Read this first, then `CLAUDE.md` (the maintainer constitution) and
`COMPONENTS.md`. Screenshots of the current app are in `docs/screenshots/`
(light, dark, mobile and desktop). Live app: https://echo.kakkoi.dev/

---

## 1. What Echo is, in one paragraph

Echo is an offline-first web app (installable PWA) for learning to **say** a
language — Japanese first, though 46 languages are supported. The learner says
what they mean in their own language, Echo turns it into a natural sentence in
the language they are learning (with furigana and a casual/polite pair for
Japanese), and then the learner **shadows** it: the device speaks it, pauses,
the learner says it back, and the loop repeats until it is automatic. Every
sentence then enters a spaced-repetition review queue. Echo is not a course and
not a flashcard deck someone else wrote: **the library is made of things the
learner actually wanted to say.**

## 2. Who it is for

- An adult learner who **cannot yet type or edit Japanese comfortably**. The
  interface must never assume they can. Prefer voice, intent ("make it
  shorter"), and AI-assisted change over manual editing.
- Mostly on a **phone**, often for a few minutes at a time, often speaking out
  loud. Desktop is the same object with more room (a side panel appears at
  ≥1024px).
- Brings their own AI key (Gemini, DeepSeek, OpenAI, Anthropic or a local
  model). Without a key, Echo still plays, reviews and browses — it just
  cannot create new sentences. Design for both states.

## 3. The core loop (everything serves this)

**mean something → get the target-language sentence → hear it → say it
repeatedly → retrieve it later → use it naturally**

A feature that does not strengthen this loop is a candidate for removal. The
recent changes (section 8) came from applying this rule.

## 4. Information architecture

Bottom tab bar on mobile (left rail on desktop): **Practice · Review · Library**,
plus Settings (gear).

| Area | What happens there | Key states |
|---|---|---|
| **Practice → Sentence** | The composer is docked at the bottom: a text field, a language switch, a mic and Translate. The result shows big Japanese with ruby, an echo counter, and a Play/Pause loop with animated "echo arcs". Toggles: Furigana, English, Polite. | welcome (no sentence yet) · no key · offline · voice missing · translating · translation failed |
| **Practice → Discussion** | Describe a scenario; Echo speaks first; the learner replies in either language. Each turn can be saved to the library. Turns are learning material, not chat bubbles. | setup · live conversation · playing |
| **Practice → Reading** | Generate a short text at a chosen level. Tap a sentence to select it and save it; tap a word to look it up. | empty · generated · echo loop playing |
| **Review home** | A big count of sentences due with a ripple-ring motif, and a New / Learning / Review breakdown. "Nothing due" is a restful state (glyph 休). | due · nothing due |
| **Review session** | One card at a time, rotating three skills per sentence: **Listening** (audio only), **Reading** (bare Japanese, no furigana), **Writing** (meaning shown; typed answer, diff-marked against the target). Reveal → the loop plays → grade **Again** / **OK**. A progress bar at the top. Keys on desktop: Space, 1, 2, Esc. | prompt · revealed · complete (stamp 了) |
| **Library** | Search, filter and sort; rows show Japanese, meaning, a status chip and the echo count. A row opens the sentence page. Entry points: "Kanji, words and grammar", "Mora memory table". | empty (new invitation) · results · no matches |
| **Sentence page** | The sentence, its meaning, grammar chips (see 8), a casual/polite choice, per-skill counts (👂📖✍️), Play the loop, Edit (manual or "Rewrite with AI"), stats, history, Delete. | normal · editing · grammar explained |
| **Kanji, words and grammar** | Three tabs. Each is a wall of everything there is (2,136 jōyō kanji, ~23k words, N5–N1 grammar points), lit up by what the learner's own sentences contain. Banded by JLPT level, with search. Each item opens a bottom **sheet**: facts, the learner's sentences using it, and a composer to "say a sentence using this". | unmet · met · learned |
| **Mora table** | Kana to fixed mnemonic images (飴, 犬, 牛…) for pronunciation anchoring. | emoji / furigana / English toggles |
| **Onboarding + setup** | A three-step promise (一 二 三), then a two-step setup: AI service + key, then the language pair. "Look around first" is allowed. | — |
| **Settings** | A long modal: appearance, audio/voices, grammar auto-read, reminders, languages, AI provider, speech recognition, **Your sentences** (Anki export, backup Export, Import by file or URL, automatic GitHub gist backup, Starter sentences), install. Save/Cancel. | — |

## 5. The visual language — "washi and seal"

Echo already has a distinctive system. **Extend it; do not replace it.** The
test in `CLAUDE.md`: *could this screenshot plausibly be from a different app?*
If so, it is not finished.

**Mood:** paper, ink and a single vermilion hanko seal. Quiet, literate,
unhurried. A brush-and-paper study desk, not a gamified app.

**Colour tokens** (all in `styles.css`; use the names, never raw values):

| Token | Light | Dark | Role |
|---|---|---|---|
| `--washi` | `#F3F0E7` | `#191712` | page background (with a faint paper texture) |
| `--panel` | `#FBF9F3` | `#221F19` | raised surfaces, cards, sheets |
| `--sumi` | `#1C1A17` | `#F2EEE3` | primary text (ink) |
| `--ink-soft` / `--ink-muted` | `#55504A` / `#6B645B` | `#C4BCAC` / `#A49B8C` | secondary text, hints |
| `--hairline` / `--rule` | `#D9D2C1` / `#E2DCCE` | `#363028` / `#2C2820` | borders, dividers |
| `--seal` | `#B8342A` | `#E0614B` | **the only accent**: primary buttons, chips, active tab, grammar marks |
| `--seal-deep` / `--seal-tint` | `#8F2820` / `#FAEDE9` | `#EE8672` / `#2A1E1A` | text-on-paper accent / washes |
| `--indigo` | `#2E4A6B` | — | "learning" state only |

Theme follows the device, or is forced light/dark; both must be checked for
every change.

**Type:** two families, both Japanese-capable.
- `--display`: **Shippori Mincho** (serif). Japanese sentences, titles, big
  numbers, the "voice" of the app.
- `--ui`: **Zen Kaku Gothic New** (sans). Controls, hints, labels.
- Small uppercase tracked overlines label sections (`.overline`).

**Recurring motifs:** the seal 響 (logo); single kanji as state glyphs (休 rest,
了 done, 学 study, 音 sound, 一二三 steps); concentric **ripple rings** and
**echo arcs** that move only while audio plays (motion is meaningful, and is
switchable: system / on / off); thin hairline rules; ruby furigana above kanji.

**Controls are quiet:** hairline-bordered buttons; one filled seal-red primary
per screen; "plain" text buttons for secondary paths; status chips with thin
borders. No gradients, no heavy shadows, no pill-shaped segmented controls, no
chat-app bubbles.

## 6. Hard constraints

- **Mobile first**, down to ~360px wide. The bottom composer and the tab bar
  must never be obscured. Safe areas are respected.
- **No hover-only actions.** Touch targets ≥ 44px for primary actions (32px is
  the floor for inline chips).
- **One action, one look.** The same action (mic, language swap, send, AI
  adjust, play loop, delete) has exactly one visual everywhere. Reusable
  pieces live in `components.js`. Before drawing a control, find the existing
  one.
- **Japanese text is the hero.** It is set large in Mincho, with furigana that
  can be hidden. Never truncate a sentence without a way to see all of it.
- Offline: everything except creating new content works without a network.
  Say so calmly when relevant; never block the screen for it.
- Accessibility: live regions for status lines, labelled icon buttons, and
  focus visible.

## 7. Content voice

Plain, warm and specific, in British spelling ("practise" as a verb). Copy says
what will happen and what it costs ("One request on your AI key."), never
cheerleads. Empty states invite the next action. Errors say what happened and
what is still safe ("Your sentence is still in the box.").

## 8. What just changed (so you do not design against stale screens)

- **Decks import by file or URL.** Settings → Your sentences → **Import**:
  *Choose file* (a deck or a backup) or a URL field with *Import URL*, and a
  link to `DECK-FORMAT.md`. Echo bundles no decks; the one built-in option is
  the **ミニ本語 Minihongo starter** (262 sentences, Japanese only), offered in
  Settings and on the empty Library and withdrawn once added. Imports merge.
- **Empty Library** is now a panel: "Your library is empty", a primary "Write a
  sentence", then plain "Add 262 ミニ本語 Minihongo starter sentences" and "Import a deck".
- **Grammar.** The old "Find grammar / Refresh grammar" button that appeared
  under every sentence everywhere is gone. Grammar now shows in **one place
  that may ask** — the sentence page ("Explain the grammar", a quiet link with
  a one-line cost note, replaced by **chips** and a dotted vermilion underline
  on the exact phrase once answered) — and **one place that only shows** — the
  revealed review answer. Lists, sheets, Discussion and Reading show no grammar
  UI.
- Library rows are one tap target (they open the sentence page).
- **Automatic gist backup** in Settings → Your sentences: a switch, a GitHub
  token, an optional gist URL, *Back up now*, *Restore from gist*, and a status
  line (last backup time, a link to the gist, or the last error). It runs
  silently; the only interruption is one toast if an automatic upload fails.
  Design question: should a quiet "backed up" signal live somewhere outside
  Settings, or is silence the right default?
- Review → Writing is a typed answer by design; the dead "start listening
  automatically" toggle was removed.

Fresh screenshots of the empty Library, Settings → Your sentences and the
explained-grammar sentence page are worth taking before you start: the ones in
`docs/screenshots/` predate these changes.

## 9. Where design help is most wanted

These are open problems, roughly by impact. Each should come back as a
proposal that reuses the existing tokens and primitives, with mobile and
desktop and light and dark variants.

1. **Settings is one very long modal** with Save/Cancel. It mixes daily
   preferences (theme, voice, speed) with one-time setup (keys, endpoints,
   proxy, speech provider). Propose a structure — grouping, progressive
   disclosure, or splitting "Account & AI" from "Preferences" — that keeps
   keys obviously local-only.
2. **Practice has three modes** (Sentence / Discussion / Reading) behind a
   small text switch, all sharing the docked composer. The mode switch must
   stay a quiet Echo-native control (see `CLAUDE.md`), but discoverability of
   Discussion and Reading is low.
3. **The sentence page is dense:** register toggle, per-skill counts, play,
   edit, stats, history, delete and now grammar. Propose a hierarchy in which
   the sentence and "Play the loop" dominate and the rest recedes.
4. **Review skill rotation is invisible** until a card appears. The learner
   cannot tell why a card is audio-only today. Consider how 👂 📖 ✍️ are
   introduced and labelled (the review chip, the sentence page counts).
5. **Grammar chips** are new and minimal: a seal-outlined pill per point. Check
   that they sit well under long sentences, with many points, and in dark
   mode, and that the "explained" state reads as an answer, not a control.
6. **Kanji / words / grammar sheets** carry many actions (learn navigation,
   story, adjust, your sentences, say-a-sentence composer, let Echo write
   one). Consider order and what is collapsed by default.
7. **Onboarding** never mentions the starter. Consider whether the end of
   setup ("Start practising") should offer it to a learner who has no idea
   what to say first, without making it the default path.

Out of scope: a new brand, new fonts, new accent colours, illustrations that
are not in the ink-and-seal idiom, and gamification (streak flames, XP, mascots).

## 10. Practical notes for implementation

- Vanilla HTML, CSS and ES modules; no framework and no build step. Static
  markup is in `index.html`; behaviour is in `app.js` (large and legacy) and
  `components.js` (the target for anything reusable).
- Every static control carries `data-ui=…` (a test enforces this).
- After changing precached files, bump `CACHE` in `sw.js` and the
  `styles.css?v=` query in `index.html`.
- Run `npm test` (Node's built-in runner; around 300 tests) before handing back.
