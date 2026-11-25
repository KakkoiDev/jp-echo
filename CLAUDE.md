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
  the Groq speech key, or both) with `key-share.js`, Echo's thin layer over
  `link-core.js` (vendored from KakkoiDev/link-core, the header names the
  commit; never edit the copy, change link-core and bring it over: PBKDF2 600k
  + AES-GCM, associated data `echo-ai-key-v1` forever). The unlock code
  is shown to the sender only and never goes into the link or the Share sheet.
  On arrival the key is saved like a typed key (an explicit save), marked in
  `settings.sharedKey` (`provider`, `speech`), both removed after its expiry, and once unlocked the token
  leaves the address. It is a credential: never in an export, a backup or the gist.
  Settings → Backup → Link another device seals `{sync: {token, gist}}` (and,
  if chosen, the AI keys) the same way into `#link=…`, valid for one day; on
  arrival the gist sync is switched on and a first sync pulls everything.
  The sheet also shows that link as a QR (`link-core-qr.js`, ScanCode); the
  code is never in the QR.
  Linked keys are the learner's own, so they are not marked `sharedKey`.
- **The gist is a two-way sync of three files** (sync.js). `echo-backup.json`
  is the library and `buildBackup()` is its only producer (Export downloads
  the same document); `echo-n2.json` is N2 study (`n2Adapter`, n2-progress.js);
  `echo-reports.json` is reports. A sync checks the gist version (tiny), pulls
  only files whose raw-URL hash changed, merges each into the device, then
  pushes what is dirty or what the merge left ahead (compared by `signatures`,
  so devices never echo each other). Sentences merge in one IndexedDB
  transaction (`mergeIntoStore`). Deletions travel as dated tombstones
  (`recordDeletion`; `deleted` in the library file): every removal of a
  sentence or note must record one, or another device brings it back. Writes
  that change the library go through the `saveSentence` / `deleteSentence` /
  note / word wrappers in `app.js` (which call `markBackupDirty`); every N2
  write goes through `access` (which marks N2 dirty). Earlier saves preview a
  restore with the very merges Apply runs (`restorePreview`, restore.js),
  naming additions, recoveries of what was deleted here, and updates; only
  the latest choice may publish its preview (`latestRequest`). Never PATCH a file the
  page did not build; never write the library from the N2 page.
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
  Night plays today's N2 work by default (`nightPlan`, n2-night.js): the batch
  Today's checks opens tomorrow, each item as its deck sentence. Sleep only
  strengthens what was studied awake, so the night never brings in new items.
  "Cue half" holds a fixed half back and `nightComparison` counts the next
  day's checks by half. Each night (`nightRecord`, id `night-<day>`) lives in
  localStorage `echo-n2-night` and travels as `nights` in the N2 file and the
  N2 export (merged by day in `mergeN2`, the later save winning), so it can be
  shared and studied; it is a record of what played, never recall evidence.
  Evening recall (`?view=evening`, `eveningRecall`) is the checks session on
  tonight's items, both halves, in the sentence the night cues; its grades use
  `EVENING_SOURCE`, never `CHECK_SOURCE`, so tomorrow's checks still test all.
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
- **N2 is its own page on Echo's styles.** `n2-mock.html` links `styles.css`
  and reuses its primitives; the only N2-specific CSS is the block headed
  "JLPT N2" (choice rows, question grid, section meter). Logic without DOM
  lives in `n2-study.js`. Never give it a second palette or font again.
  Sets 02–20 are authored papers in `n2-sets/` that follow `BLUEPRINT`
  (n2-forms.js: the real 問題 layout) and pass `tools/n2-validate-set.mjs`;
  they load as edition `SETS_EDITION`, so older attempts keep their papers.
  Revise a set → bump `SETS_EDITION`. Rebuild with `tools/n2-build-content.mjs`.
- **The N2 decks are offered, never imported.** `decks/n2-grammar.json` and
  `decks/n2-words.json` (one sentence per inventory item, ids
  `n2-grammar-<i>` / `n2-word-<i>`) reach the library only when the learner
  taps Import: the N2 page links `/settings/import?deck=/decks/…`, which only
  pre-fills the box, and only for same-origin `/decks/*.json`.
- **Day Radio is awake listening, kept apart from other evidence.** It lives
  on the N2 page (`?view=radio`, logic in `day-radio.js`, tested in
  `test/day-radio.test.js`); Echo's Radio screen links to it. Exposure and
  listening recall go to the `events` store (IndexedDB v2), never to `recall`,
  so a written-reading record changes only after a written-reading check.
- **Today's checks is the one next-day check.** `n2-delayed.js` picks
  yesterday's misses, slow answers, guesses and Day Radio plays (`?view=check`);
  the hub counts the same `delayedChecks` batch it opens. A print check writes
  the recall record of its dimension; an audio check writes a listening event,
  so the two never move each other. Day Radio has no check mode of its own.
- **Every N2 recall card carries its example sentence.** The N2 decks give
  each word and grammar point one (`examplesFromDecks`); Recall shows it with
  furigana and the item underlined (`exampleSegments`, n2-delayed.js), grammar
  from the start, words with the answer. A pattern with two meanings is one
  prompt with `sense`/`senses`, never ①② on the card. Exam solutions get
  furigana from the dictionary resolver, loaded only when a review is opened
  (`solutionOf`, `whyReadings`, n2-forms.js).
- **An N2 exam may be paused, honestly.** The pause stops the clock, hides
  the question and keeps `pausedMs`/`pauses` on the attempt; the results line
  says how long it was paused. Paused time is never answer time, and a
  paused attempt takes no answers, moves, unsure marks or exposure
  (`answering`, n2-study.js) until Resume.
- **The N2 day fits six hours including breaks.** `BUDGET`, `capMinutes` and
  `firstCheckForecast` (n2-study.js) size every plan, the coach's included;
  first-check minutes follow `measuredPace`. Timed reading and listening sections
  are adaptive-style papers built from an unsat set (`paper.drill`).
- **Comprehension is tagged by what decides it.** Every authored reading and
  listening question has 1–2 reviewed tags from `TAGS` (n2-comprehension.js) in
  `n2-sets/tags.json`, keyed `n2-set-N#index` (copies keep `source`), built by
  `tools/n2-build-tags.mjs` and held by `test/n2-comprehension.test.js`. Misses
  group by tag; drills take unseen tagged questions from unsat sets and never
  from `HELD_OUT` (sets 19–20, kept for unseen-passage mocks). Scores are
  practice signals until `docs/N2-REVIEW-SAMPLE.md` has a native review.
- **The N2 coach and generator act only through app actions.** The coach's
  plan steps are limited to check / recall / section / drill / radio / mock / generate /
  review / rest / checklist (`STEP_KINDS`); generated questions must name a `BLUEPRINT` 問題
  and pass `validateGenerated`. Without a provider, `todayPlan` still plans.
- **Saved words are a mark, not a state** (specs/echo-reader SPEC §4, D6, R1).
  They live in their own IndexedDB database (`saved-words.js`, `jp-echo-words`,
  keyPath word id), never in `sentences`, so they never reach review, the due
  badge or the Cards filter. Writes go through the `saveWord` / `removeWord` /
  `replaceWords` wrappers in app.js (which call `markBackupDirty`). Remove is a
  `removedAt` tombstone, never a delete, and a tombstone wins by time in
  `mergeWords`. `buildBackup` carries them as a top-level `words` key next to
  `catalogues`; decks may not. The way in is the 栞 row under 記 Echo's notes,
  opening `/words?saved=1`; the mark is `SavedMark` (COMPONENTS.md).
- **Flags carry a reason and reach the maintainer through the gist.** Every
  screen head has the one report button (ReportSheet, COMPONENTS.md); a card
  flag asks why. Reports live in `jp-echo-reports` (reports.js), shared by
  Echo and the N2 page, and sync as `echo-reports.json` through the gist sync
  (sync.js; merged by `updatedAt`). They are not learning data: never in `buildBackup`,
  an export or a deck. The screen path drops the #fragment. A maintainer reads
  the open reports with `gh api gists/<id>` (docs/REPORTS.md) and marks a fix
  by setting `status: "fixed"`, `fix`, and a newer `updatedAt` in that file.
- **Quick round is the N2 game** (`?view=game`, logic in `n2-game.js`, tested
  in `test/n2-game.test.js`). Blitz, not shogi: `SECONDS` and `PAUSE` stay
  short (3–8 s a question). Rounds of 10 mixed multiple-choice questions
  (reading near-misses, meaning, definition, listen, homophone, grammar, and
  short exam questions only from sets already sat, never `HELD_OUT`), a timed
  review of the misses, and the next round opens with them. A right answer
  saves nothing (picking is not recalling); a miss, timeout or "I don't know"
  saves a missed recall check with source `game`. Scoring rewards speed and
  punishes mistakes hard (`POINTS`: right 50 + up to 250 for speed × combo,
  wrong −200), so a blind guess always loses to "I don't know". Day totals (goal 1,000), round history, ranking
  and the boss (a full mock on an unsat set once the 1,000 are done) live in
  localStorage `echo-n2-game`. Settings → "Open Echo on Quick round" sends a
  fresh launch there once per session (`echo-launched`), so Back reaches Echo.
  A hidden staircase level (`FLOW`, `flowStep`) keeps the player about 80%
  right; it sets the round mix, the clock and how close the wrong choices are.
  About one question in eight is a ×3 bonus; combos of 5 and 10 pay jackpots
  (`BONUS`). Fast, light, fun: it is a game.
  From the learner's bedtime (`settings.gameBedtime`, default `BEDTIME`
  23:30) until 5 am, the round's end leads to Evening recall and the Night
  Radio (`atBedtime`), with "One more round" a tap away: sleep keeps the day.
  Home is Play, Radio, Settings. The boss comes every 1,000 questions
  (`BOSS_EVERY`, `bossProgress`): the real mock at half the time
  (`?book=…&boss=1`, `state.boss`), never checkpoint or chart evidence. A run
  is the 1,000 questions' points plus the boss estimate × `EXAM_POINT`
  (`runTable`), both parts kept. Rounds pace in waves (`pace`: hook, breather
  … peak, final stretch) on top of the zone level.
  After a bad round (`inSlump`) the next is a warm-up of questions already won
  (`wins`, `WARM_UP`) with only two misses back, to keep the player going.
  Its flag is one tap with no sheet (owner, 26 Nov: "I don't think, you
  think"): it files a card report with the question exactly as shown and the
  game moves on; the audit (docs/REPORTS.md) works out why. The head report
  button still opens the full sheet, with the clock paused (`reportPause`).
- **The voice gets the reading.** Any word or sentence handed to a device
  voice carries its 【reading】 (`spokenWord` / `withReading`, day-radio.js;
  `speechText` speaks it) — a bare kanji word is guessed (重役 → おもやく).
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
