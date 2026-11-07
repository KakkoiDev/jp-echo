# CLAUDE.md — Echo maintainer constitution

Read this file and `COMPONENTS.md` before changing Echo.

## Purpose

Echo is a language-production and automaticity tool. A learner expresses what
they mean, Echo helps produce correct target-language material, and repeated
listening, speaking, retrieval and review make that material automatic.

The user often does **not know the target language well enough to type or edit
it manually**. Therefore the UI should minimize required target-language typing.
Prefer intent, dictation, language switching and AI-assisted revision.

The core loop is:

**mean something → get/shape the target-language expression → hear it → say it
repeatedly → retrieve it later → use it naturally**

Features are useful only insofar as they strengthen that loop.

## Product principles

1. **One action, one implementation.** Repeated behavior belongs in
   `components.js`; screens configure components rather than cloning them.
2. **Voice first, typing available.** Learner-language inputs use the shared
   LearnerComposer: input + language switch + mic + submit.
3. **AI adjustment instead of forced manual editing.** Editable/generated
   learning content exposes the shared AIAdjuster. Feed the current content back
   to the model with the learner's instruction. Manual editing is an escape hatch.
4. **Local first.** Learning state and credentials stay on-device unless a
   feature explicitly requires a configured model/provider.
5. **URLs are navigation state.** Do not create another workspace/navigation
   state system. Preserve canonical routes, reload and back/forward behavior.
6. **Audio is practice, not decoration.** Preserve the shadowing/repetition
   model when changing presentation.
7. **Visual consistency is correctness.** A functionally correct feature that
   looks like a different application is unfinished.

## Visual language — Washi and seal

Echo already has a design system in `styles.css`. Reuse it.

- Background: warm washi texture, not generic white/gray application chrome.
- Typography: Shippori Mincho for expressive/display Japanese; Zen Kaku Gothic
  New for UI. Use the existing `--display` and `--ui` tokens.
- Accent: restrained vermilion seal (`--seal`), not arbitrary new colors.
- Surfaces/lines/text must use existing semantic tokens such as `--washi`,
  `--panel`, `--sumi`, `--ink-muted`, `--hairline`, `--rule`.
- Controls are quiet. Do not introduce generic Bootstrap/material/chat-app
  aesthetics, thick pill selectors, bright chat bubbles, gradients or arbitrary
  shadows unless the existing system already has the equivalent.
- Mobile is primary. Desktop should feel like the same object with more room.

### Before inventing a visual

Search `styles.css` and existing screens for the closest existing control or
surface. Reuse its component/class/tokens. If no equivalent exists, add the
smallest reusable primitive to the component/design system first.

Do not solve a local screen with one-off CSS if the concept exists elsewhere.

## Visual invariants

A change must not:
- introduce raw colors where a semantic token exists;
- introduce a new font family;
- create a second visual treatment for the same action;
- copy SVG/control markup already owned by a component;
- make a new screen look like a generic web app or messaging product;
- obscure the bottom learner composer;
- break dark/system themes;
- break narrow mobile layouts;
- depend on hover to expose a required action.

Practice has one start screen. Discussion, Reading and Extract live with the
other tools in Library's tools shelf; Practice keeps one 話読本 row that opens
it. Both are pushed screens with `.tool-head`. There is no mode bar. The
Practice tab, tapped again, returns to the start screen. (Owner approved the
one tools home on 7 Nov; see `docs/design/november/README.md`.) Discussion messages are learning material, not social-media chat:
alignment may distinguish speakers, but typography, paper surfaces, borders and
accent remain Echo's.

## Safe change workflow

Before editing:
1. Read this file and `COMPONENTS.md`.
2. Find the existing component that owns the action.
3. Find the existing visual primitive closest to the requested UI.
4. Identify route, offline, mobile, dark-mode and persistence consequences.

While editing:
1. Change the shared primitive before individual call sites.
2. Keep domain logic out of presentation components.
3. Never add save-on-blur or render-time persistence.
4. Await persistence before showing success.
5. Never force page reload/navigation from service-worker activation.
6. Keep provider/model behavior behind existing API/domain modules.

Before considering the change complete:
1. Run tests.
2. Add a regression test for the behavior being changed.
3. Check narrow mobile and desktop structure.
4. Check light, dark and system-theme token use.
5. Compare the new UI with adjacent existing Echo UI.
6. Verify back/forward/reload for route changes.
7. Verify offline cache entries when adding runtime modules.
8. Ask: **Did I introduce a new way to perform an action that Echo already had?**
   If yes, refactor it to the existing component.
9. Ask: **Could this screenshot plausibly be from a different app?** If yes,
   the visual work is not finished.

## Architecture map

- `components.js`: reusable UI behavior/components. One action lives here once.
- `COMPONENTS.md`: component contracts and usage rules.
- `styles.css`: design tokens and shared visual language.
- `app.js`: screen orchestration and legacy code being migrated toward components.
- `api.js`: model/provider-facing behavior.
- `core.js`: shared Japanese/domain logic synchronized from JP Core where noted.
- `actions.js`: explicit persistence mutations.
- `routes.js`: canonical URL/navigation model.
- `speech.js`: speech and repetition engines.
- `db.js`: IndexedDB.
- `sw.js`: offline cache/service worker. Never navigate/reload clients on update.
- `test/`: behavior/regression contracts.

## Product constraints (added October 2026)

- **Sentence decks come in by file or URL; Echo never automatically imports a built-in deck.** The Kanji view precaches one read-only meaning-family teaching catalogue, with example sentences available individually via explicit Add. It never injects all catalogue cards into the user library. Settings → Import takes
  a deck or a backup file, or a deck URL, and merges. The format is
  `DECK-FORMAT.md` (with `decks/example-deck.json` and `decks/deck.schema.json`),
  held to the importer by `test/deck-format.test.js` — change the importer and
  the page together. The only built-in content is the optional ミニ本語 Minihongo
  starter seed (Japanese only). Do not add one-click buttons for third-party
  decks.
- **Grammar UI has two hosts and one ask.** The GrammarList and the "Explain the
  grammar" action render only into `#sentence-grammar` (which may ask) and
  `#review-grammar` (which never asks), via `enableVocabulary(...,{grammarHost})`.
  Never append controls inside a sentence element, a row button or a bubble.
- **Review skills are Listening, Reading and Writing.** Writing is a typed
  answer by design (`test/session-regressions.test.js`). Speaking is practised
  by the shadowing loop, not graded in review.
- **Untrusted text never reaches markup unescaped.** Language codes go through
  `safeLanguage`; imported codes must be on `LANGUAGES`. Credentials of every
  kind are stripped in `exportBackup` — provider keys, speech keys, the GitHub
  gist token and the gist URL. Add any new credential there, with a test.
- **A shared AI key travels encrypted, in the #fragment only.** Settings → Invite
  someone seals `{provider, key, model?}` and/or `speech: {groq}` (the AI key,
  the Groq speech key, or both) with `key-share.js` (Minihongo's
  scheme: PBKDF2 600k + AES-GCM, Echo's own associated data). The unlock code
  is shown to the sender only and never goes into the link or the Share sheet.
  On arrival the key is saved like a typed key (an explicit save), marked in
  `settings.sharedKey` (`provider`, `speech`), both removed after its expiry, and once unlocked the token
  leaves the address. It is a credential: never in an export, a backup or the gist.
- **Gist backup is one document.** `buildBackup()` is the only producer; Export
  downloads it and the gist holds it. Writes that change a backup go through
  the `saveSentence` / `deleteSentence` / note wrappers in `app.js` (which call
  `markBackupDirty`), never straight to `db.js` or `notes.js`.
- **Updates are offered, never forced.** A new worker waits while Echo is open
  (no `skipWaiting` on install). `app.js` shows "A new version of Echo is ready"
  and, on the person's tap, posts `echo:activate-update`; the page reloads only
  after that request. Never reload or navigate from the worker.
  The install stores rebuilt responses (no URL): Safari refuses a module the
  worker answers under another address (`test/pwa.test.js`).
- **AI prose carries readings.** Any prompt whose answer is shown as an
  explanation includes `READINGS_RULE` (api.js), and the answer is rendered with
  `rubyHtml`, so every kanji the model writes has furigana.
- **Radio follows the sleep-cueing research where it has one.** The deep-sleep
  cues (`radio.js`) are the sentence alone: a translation right after a cue
  cancels its benefit (Schreiner, Lehmann & Rasch 2015). The meaning plays in
  the wind-down and, by the learner's choice, the rest of the night. The night
  needs the screen on (wake lock): a locked phone stops speech on iOS and Android.
- **Mora pictures are the owner's drawn set.** `anchors/` and `anchors-dark/`
  hold one picture per current anchor (MORA_MNEMONICS v5), switched by theme
  through `themedPictureHtml`; `mora-pictures.js` maps kana to file, section and
  cell (`/mora?section=…#<kana>`). Voiced/p-sounds reuse the base drawing with the
  one corner mark. The light set is the owner's 512px masters at 128px; the dark
  set is the same drawing with ink → `#F2EEE3` and seal → `#E0614B`.
  v5 (owner, 7 Nov): よ 鎧, れ レモン, ち 地図, ん 判子, こ 駒; そ keeps ソファ.
  Changing an anchor bumps the version in core.js and JP Core
  (browser/jp-core.js) together; the AI validator follows `moraMnemonicTokens`,
  and `MORA_V4_RETIRED` (app.js) points out notes written with an old anchor.
- **The dictionary is two parts.** `words-data.js` (shipped, precached) holds
  JMdict's common words and every JLPT word; it alone feeds the Words wall, its
  bands and totals. The rest of JMdict is `dict/<version>/NNN.json`, fetched by
  `dictionary.js` only for the characters a sentence contains, added to a
  separate matcher (`addLookupWords`, words.js) and kept by the worker in
  `jp-echo-dict`, which app updates never clear. Both come from one JMdict file
  through `tools/build-words-data.mjs`; never hand-edit either.
- Bump `CACHE` in `sw.js` (and the `styles.css?v=` query) with any shipped
  change to precached files; `test/pwa.test.js` follows the current name.

## Design handoff decisions (October 2026)

- **Skills are glyphs.** 聴 読 書 via `SkillGlyph` (components.js); never emoji.
  Skill copy derives from `review-modes.js` (`skillReason`, `skillMix`,
  `dueLine`) — change the copy to fit the logic, never the logic to fit copy.
- **Answered grammar is a list, not chips** (`GrammarList`). Word marks
  (`.review-vocab`, interactive) and grammar marks (`.grammar-mark`, not
  interactive) differ in weight and colour and may share a segment.
- **Settings is a route.** Preferences commit on `change` through
  `saveSettings()`, which must never touch credentials; credentials have their
  own explicit saves. In-page Back pops history only via `settingsStack`.
- **Discoverability lives in empty states**, not louder switches. Library's
  tools shelf (`/library#tools`) is the one home for the other modes and the
  study tools; Extract from text keeps its own route, `/extract`.

## Migration rule

Legacy duplication exists. Do not use it as precedent. When touching a duplicated
area, move it toward the component library rather than adding another variant.
Migration should be incremental and behavior-preserving.

Do not perform a giant visual rewrite. Echo's established design is the source of
truth; consolidate around it.

## Agent handoff

Leave the repository easier for the next agent to understand than you found it.
For a new reusable interaction, update `COMPONENTS.md`. For a new architectural
constraint, update this file. Tests should encode important invariants rather than
leaving them only in prose.
