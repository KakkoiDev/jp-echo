# Echo — design handoff (October refresh)

The complete design of Echo (repo `KakkoiDev/jp-echo`), packaged for implementation. Second edition: the app adopted the September design and grew — discussion, reading and text extraction, review skills, a bundled dictionary, settings as a page, gist backup. This package draws every one of those in the same system, corrects the few places the build drifted, fixes the invisible animation, and adds a six-board proposal for Echo on every screen. 56 boards.

## Read in this order

1. **`REDESIGN-HANDOFF.md`** — the spec. Start with *October refresh* (what changed and what the boards do about it), then *The animation shipped and nobody saw it*, then *Echo anywhere*, then the screen→artboard table (★ = new or rebuilt in this edition), tokens, decisions, PR sequence.
2. **`design/index.html`** — open in a browser. Every artboard at real size, in canvas rows; the boards link to each other, so you can walk the app end to end.
3. **`design/*.dc.html`** — the artboards. Plain HTML with inline styles; every value is measured. `canvas.json` has each board's size, title and position. `<x-dc>` and `<helmet>` are inert custom tags from the canvas runtime; `support.js` is a stub.
4. **`motion.css`** — the echo animation as shippable code, now with the compact-form weights (section 4) and where the moving echo lives (section 8). Replace the copy in `styles.css` with this one. `screenshots/motion-before.png` and `motion-after.png` are the frames that show why.
5. **`tokens.css`**, **`theme-map.json`** — the palette and type; the exact light→dark substitution.
6. **`screenshots/`** — reference renders, made without the web fonts, so line breaks differ slightly from the HTML. When they disagree, the HTML is right.

## What this edition changes in the build

- **One navigation for Practice modes, not two.** Drop the `.practice-mode` bar; keep the "Or practise another way" rows and make Discussion, Reading and Extract pushed screens with a back arrow.
- **Review cards say which skill and why.** The 聴 読 書 trio beside the stage chip, a card title, one line of reason. The listening card has no answer box.
- **Words is the third segment of the study tool**, banded and stated like kanji and grammar; the word sheet carries a note with Adjust.
- **The sentence page's underlines mean something**: dotted grey = tap to look up, vermilion = grammar explained below, and a key line says so.
- **Settings is a page** with four sections and three drawn sub-pages; reminders ship with the honest line under the toggle.
- **A chosen segment or chip is seal-tinted, never a sumi block** — one rule in `styles.css`.
- **The echo animation becomes visible**: compact weights, live rings behind the sentence on playing screens, and one selector in `onState`.
- **The composer is one component everywhere** — field, swap, mic, send — and only its label and verb change.

## The blockers that still come first

- **JLPT kanji list** in the data build (`kanji-readings.js` has `grade`, not JLPT).
- **Per-point grammar content**, written by Echo on first open, cached, adjustable, backed up — the `notes` PR.

## Principles the boards encode

- The Library is your sentences. Kanji, words and grammar are a study tool you go into from one row and back out of.
- Your own sentence first. On every sheet the leading action is *say a sentence using it*; *let Echo write one* is a text link. Nothing Echo writes enters your library until you Save or Keep it.
- Echo is a prefill, not a mode. The field is the base state; the seal is a button beside it; both versions survive and the chip says whose words you are reading.
- The wall is a mirror of the library, recomputed on every read; the delete sheet says what goes back to not-met.
- Movement means audio is playing. Nothing else moves — and it must be visible from the corner of your eye.
- No bookkeeping in the primary slot. Honest privacy copy. Japanese-only parts gated on the target language.

## Provenance

Redesigned from the app's own source at `main` on 10 October 2026: `index.html`, `app.js`, `styles.css`, `review-modes.js`, `grammar.js`, `words.js`, `notes.js`, `reminders.js`, `gist-backup.js`, the README. The motion diagnosis was made by rendering the shipped `styles.css` frame by frame, not by reading it. Illustrative numbers (24 sentences, 214 learned) are marked as such in the handoff; constraints (2,136 jōyō, 979 points, ~23,000 words, 44px targets, 7 columns) are not.
