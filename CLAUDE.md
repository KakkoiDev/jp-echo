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
- **Mock exams for the other levels are fetched, never precached.**
  `jlpt-sets.js` holds each level's 問題 blueprint (`SET_LEVELS`; N3 so far),
  how each listening 問題 is presented (`LISTENING`) and the loader; sets live
  in `sets/<level>/<edition>/<id>.json` with `sets/<level>/index.json`, kept
  by the worker in `jp-echo-sets` once served. An edition never changes
  (`tools/build-level-sets.mjs`: whole batch or nothing, index last). A boss
  is gated on `ready(level)`, the edition the device holds whole after
  `keep(level)`, never on the index alone. `tools/validate-level-set.mjs`
  passing means well-formed, not correct: a set counts only after the blind
  solve, the review with keys, the comparison with the official workbook and
  with the level's other sets (docs/JLPT-LEVEL-SETS.md). Official papers are
  referenced, never copied. N2's `n2-sets/` stays as it is. Nothing sits
  these papers yet: the exam screen and the boss are N2's.
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
  (reading near-misses, meaning, definition, listen, homophone, grammar,
  問題9-style connectives from passages of sets already sat (`OVERLAP` keeps
  every wrong choice unable to stand in for the answer), and
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
  The run clock (`runClock`, `RUN_CLOCK`) multiplies a run ×1.5 if its boss
  falls within 24 h of its first answer, ×1.2 within 48 h. Settings →
  Quick round difficulty (`DIFFICULTY`): Easy 90% right ×0.75, Normal the
  adaptive 80%, Hard 65% ×1.25.
  After each answer the right word or pattern is spoken once (`answerSpeech`,
  default voice, with its reading; never a whole sentence).
  The scored pool must be trustworthy (audit, 26 Nov): exam items are written
  sections only (`WRITTEN`); no wrong choice shares the answer's meaning
  (`sameSense`), its spelling, or (listening) its sound; accepted readings and
  reviewed exclusions live in `n2-game-review.js`; every card has four
  distinct choices. One answer's positive payout is capped at
  `payoutCap(choices)` = 200 × (n − 1) − 50, a wrong answer costs −200 × the
  streak step it breaks (up to −400), so guessing never pays over one or two
  cards; jackpots pay nothing, a flag scores
  zero and ends the combo, connectives are practice. The boss halves only the
  written clock (`BOSS_MINUTES`).
  Its markup and styles follow the designer's boards to the letter (the `qr-`
  block in styles.css, boards 1–11; anything not on a board is asked of the
  designer first). Echo's base element styles are reset inside `.n2-game`
  (`:where()` reset), and the game has no paper texture.
  Its look is "Blitz on washi" (designer canvas, 26 Nov; fixes 1–12 built):
  Echo's paper, ink and seal, plain surfaces in the loop, a 14 px clock bar
  with tenths, a one-line head (back, ten pips, score and combo), choices in
  the UI sans in the thumb zone, "I don't know" (no "· 0": owner, 27 Nov) and a quiet flag icon,
  right in `--chip-learn-*` (indigo), bonus in the one new token `--gold`.
  v280 was measured against every board at 375 px (docs/QUICK-ROUND-BACKLOG.md
  lists what is built and what waits): the points float lives in the combo
  line's slot, never over the clock; numbers below zero use U+2212 (`num`);
  beat ribbons sit above the clock; Home's run clock ticks (`paintClock`) and
  `mergeGame` keeps a run's earliest start; in the game the voice notice is
  the one-line `#game-notice` on Home, never Echo's panel.
  The Sound switch also silences the voice and vibration and takes listen
  cards out. Board specs: docs/design/game/DESIGNER-HANDOFF.md (canvas link).
  Its progress (`echo-n2-game`) travels in the N2 gist file as `game`
  (`mergeGame`, sync.js) and the N2 export; every save is stamped and marks N2
  dirty. The game has its own Radio screen (Day Radio and Evening recall
  return with `?from=game`; the Night Radio runs in the game) and its own Settings screen writing the same
  `jp-echo-settings` keys. What is set aside: docs/QUICK-ROUND-BACKLOG.md.
  After a bad round (`inSlump`) the next is a warm-up of questions already won
  (`wins`, `WARM_UP`) with only two misses back, to keep the player going.
  Its flag is one tap with no sheet (owner, 26 Nov: "I don't think, you
  think"): it files a card report with the question exactly as shown and the
  game moves on; the audit (docs/REPORTS.md) works out why. The head report
  button still opens the full sheet, with the clock paused (`reportPause`).
- **The voice gets the reading.** Any word or sentence handed to a device
  voice carries its 【reading】 (`spokenWord` / `withReading`, day-radio.js;
  `speechText` speaks it) — a bare kanji word is guessed (重役 → おもやく).
  A reading only binds to the kanji right before its bracket, so `spokenWord`
  spreads a word's reading over its kanji (`spreadReading`, japanese-readings.js:
  生【い】け花【ばな】, 間【ま】もなく, 女【じょ】～); grammar patterns take theirs
  from the example sentence (`patternVoice`, n2-game.js).
  Reduced motion stills the game's juice, never `#game-bar`: the bar is the clock.
- **Quick round, from the owner's reports (v281).** The round after a hard one
  (`inSlump`, `WARM_UP`) is shown as a "Recovery round" (復): the name changed,
  the effect did not. A listen card sits in its example sentence with the heard
  word as a gap, no furigana, when the sentence holds the word as written.
  Effects are mixed for a phone speaker (`LOUD`, no note under 196 Hz, the
  context resumed on every note). Every report from the N2 page carries a
  `snapshot` (`screenSnapshot`, reports.js: visible markup, viewport, theme,
  motion; capped at `SNAPSHOT_MAX`), rebuilt with `tools/reports.mjs --html`.
- **Three files are shared with JP Core** (`japanese-readings.js`,
  `japanese-words.js`, `grammar-spans.js`; JP Core's copies live in its
  `browser/` and import `./jp-core.js`). Change one here, bring it to JP Core
  with its test, and run `node tools/check-jp-core.mjs <jp-core checkout>`:
  it fails on any other difference.
- **Quick round v286.** Item strength (board 9): `itemLevel` / `levelAfter`
  (n2-game.js), levels 0–5 in `state.lv`, five squares on the card, 極 at five
  resting three days. A round in progress is kept in `echo-n2-round` on the
  device for 30 minutes and resumed from Play (board 12 · B). A recovery
  round follows accuracy only (`inSlump`). Listen cards leave the mix when
  nothing can be heard (`hears`), and take no answer until the word has
  played (`voiceWait`). Under 760 px of height the loop tightens so the four
  choices stay on screen.
- **Radio from Quick round (v283).** The game's Radio screen starts Day and
  Night the same way (one 60 px button per card). Day Radio and Evening recall
  are still Echo's screens and logic; with `?from=game` they wear the game's
  look through one skin (`body[data-from=game]`, right after the Quick round block in styles.css)
  and lead back to the game's Radio. Never fork those players for the game.
- **Quick round has a rank, a JLPT level (v288).** `rank` / `rankAt` in the
  game state (`rankOf`, `setRank`, n2-game.js); a state without one is N2, so
  earlier progress is untouched. `mergeGame` keeps the rank set last. The rank
  picks the pool (`rankLevels`): its own level, and `REVIEW_SHARE` places a
  round for the levels under it (`nextRound`'s `review`). N2 is
  `n2-inventory.json`; N5, N4, N3 and N1 are `levels/<version>/n*.json`, built
  by `tools/build-level-inventories.mjs` from `words-data.js` and
  `grammar-data.js` (never by hand), fetched by `jlpt-levels.js` and kept by
  the worker in `jp-echo-levels`, never precached. `gamePool({level})` gives
  another level's word cards only, ids carrying the level (`r:N3:就任`), no
  recall target, and `practice: true` until the level is in `REVIEWED_LEVELS`
  (n2-game-review.js): add a level there only after its pool is audited. N2
  ids never change. Only N2 has a boss (`hasBoss`).
- **Questions build the record; only the boss moves the rank (owner, 26 Nov,
  v289).** Every answer keeps the item record (`tried`, `missed`, with `lv`,
  `seen`, `wins`; `itemRecord`). An unreviewed level's card (`record: true`)
  moves the record and comes back after a miss, but pays no points and never
  counts toward the day, the boss or the hidden level; connectives stay
  exposure only. `applyBoss` gives each finished boss one verdict
  (`bossVerdict`, `RANK_RULES`): pass total + 10 with every section at its
  minimum moves the rank up; 150 or more also opens the next boss at once
  (`bossReady`); the second fail in a row moves it down. A ladder, not Elo. A
  rank moves only to a level that has a boss; otherwise the verdict is kept
  (`waits`) and the rank stays. Runs from before the rules (no `rank` on them)
  are never judged. Where a rank has no boss, Home's run card shows
  `levelCoverage` (words known, at item level 3 or more). When 95% of the
  rank's words have been met, the level above joins the review places
  (`aheadLevel`, `isCovered`). The Settings segment still sets the rank by hand.
- **Quick round learns kanji, not word lists (owner, 26 Nov, v290).** The
  unit is the kanji with its reading; a word is the example that carries it.
  `kanji-split.js` (build-time only) splits a word's reading over its kanji
  with KANJIDIC, through voicing, p-sounds and small っ; the base readings
  are an inventory row's fourth field, N2's are `n2-kanji-parts.json`
  (precached), and `levels/manifest.json` `kanji` names the kanji each level
  brings (436, 332, 638, 247, 263). All of it comes from
  `tools/build-level-inventories.mjs`. Word cards carry `kanji` (就しゅう);
  `kj` in the game state keeps met / right / missed / transfer per
  kanji-and-reading (`kanjiAfter`), synced by `mergeGame`. A kanji is known
  after one transfer (read right in a word never shown, the kanji met before)
  or three right readings (`KANJI_KNOWN`). Levels of word cards are picked
  kanji first (`kanjiPick`: a missed reading again, new kanji in the level's
  order, then proving them in unseen words, with words from other levels as
  examples); N2 rounds are picked by card as before. Home counts kanji
  (`kanjiCoverage`). Outside N2 every kanji word has a reading card: where a
  reading has no trap of its own, readings of words sharing a kanji are the
  wrong choices. N2's reading cards are not widened.
- **Every rank has a boss (owner, 27 Nov, v291).** The exam screen sits a
  paper of any level: `?book=n3-set-4` opens `sets/<level>/` through
  `createSets()` / `levelRows` (jlpt-sets.js), saved as `<set>@<edition>` with
  `level` on the paper. `LEVEL_EXAM` (n2-study.js) holds each level's
  sections, minimums, pass mark and clocks; `estimate` follows the paper's
  level (N4 and N5: two sections, 120 and 60). The written part is one clock
  on this screen; on the real N3, N4 and N5 papers vocabulary has its own.
  A level paper is never N2 evidence (`scored`, n2-progress.js). In the game
  `BOSS_LEVELS` is every rank, so `applyBoss` moves the rank freely; the boss
  of a rank is one of its own papers (`bossIds`, `bossSet` with the level's
  held-out sets), kept on the device by `keep(level)` when the rank is
  loaded. A rank whose papers are not there (N1 until they are written) shows
  kanji coverage and has no boss. Unreviewed level cards still pay no points,
  but their answers count toward the day and the 1,000 that open the boss.
- **A recovery round is made of what the player has won (v294).** In a
  recovery round `pickRound` runs `calm`: won cards are taken even if seen
  minutes ago (the four-hour rest used to leave the round to new cards:
  owner's report, 27 Nov), then the familiar, then the new; at most one new
  card and two misses. It comes first at a kanji-first rank too. `nextRound`
  only reports `warmUp` (the 復 ribbon) when half the round is familiar.
- **Grammar from its parts follows board 13 (v301).** N2 grammar is also
  learned from its blocks (`n2-grammar-blocks.json`, precached; design in
  `docs/GRAMMAR-BLOCKS.md`): cards `b:` Grammar piece, `gb:` Grammar parts,
  `gi:` New grammar, practice until `REVIEWED_GRAMMAR_BLOCKS`. On a build
  card the parts are a ruled list (`partRows`: piece in the Mincho, gloss in
  sans, repeats as ×2, no row without a gloss) and the underline is cut per
  part (`cutUnderline`); after the answer the `literal` reading takes the
  line's slot ("piece by piece"); the review of a miss shows the list; an
  infer card that proves a piece shows the 証 strip and holds `PROVED_MS`;
  Home has one "Known · Grammar pieces" strip under the run card, hidden
  until a piece is proved. N5 and N4 particles and endings are taken as
  known (`BASIC_BLOCK`). A hint says what the form shown does, negation
  included: a part carries its own `gloss` where the block's would mislead,
  and a hint may share words with the answer (content review, 27 Nov:
  `tools/grammar-blocks/reviews/`, with a ledger of every finding). Reviewed
  grammar answers are `GLOSS_FIX["g:…"]`; `GRAMMAR_CONFUSABLE` keeps
  look-alike patterns apart on scored and practice cards alike.
- **A boss's misses: what transfers goes into the rounds, the questions into
  a review (owner, 27 Nov, v303).** Asking a boss question again only teaches
  its answer, so no card does. `bossCards` (n2-game.js) takes, from the wrong
  and unsure answers of the latest N2 boss, the card of the word or pattern a
  vocabulary or grammar question tested, and the N2 words and whole patterns
  of a reading or listening passage (its deciding lines' first, `BOSS_WORDS`
  a passage, known ones left out). `bossQueue` gives them `BOSS_PLACES`
  places a round until each is answered right (`bossDone`, synced by
  `mergeGame`); a recovery round has none; nothing says where they come from,
  and the next boss is always a fresh paper. A finished run on Home opens the
  boss review (`bossReview`, `startPaperReview`): every wrong or unsure
  answer on the round's own review screen, read and never answered,
  `BOSS_REVIEW` seconds a card (5, or 8 for reading and listening) with the
  hold button, a "Full paper" link and its own back button to Home
  (`#game-review-back`: the review hides the head); the run row says
  "Boss review" (v304). A vocabulary or grammar card there reads like a
  round's review card: the word, its reading and its meaning large (from the
  pool card of the question's `target`), the paper's sentence in the example
  card, then the why; a question with no pool card keeps the question-and-
  answer layout. It is not an exercise: it writes no
  state and counts toward nothing. A reading or listening card shows the
  question's deciding lines (`n2-sets/keys.json`, precached), built by
  `tools/n2-build-keys.mjs` from `tools/boss-keys/<set>.json`: word for word
  from the paper, kept only where a blind solver picked the key from the
  lines alone (`solved`). Sets 2 and 3 so far; without lines the card shows
  the question, the answer and the why.
- **Rest is the night of the boss (owner, 27 Nov, v304).** `resting`
  (n2-game.js) holds from the boss's finish until `REST_ENDS` (5 am), and
  ends at once when the Night Radio is started from Home (`endRest`,
  `restOver` in the game state). Never the whole calendar day.
- **Prefixes and suffixes are word parts with a card (owner, 27 Nov, v305).**
  The N2 list's 167 entries written with ～ (前～, ～気味) were never asked:
  they are not words. `affixCards` (n2-game.js) gives each one written once
  in its deck sentence a card `a:<text>`, kind `affix`, label "Word part":
  the sentence with the part underlined, its meaning to pick among other
  parts' meanings, the same side (prefix or suffix) first. `REVIEWED_AFFIXES`
  (n2-game-review.js) is false: the glosses are the list's and the sentences
  the deck's, not reviewed as affix content. A missed 問題3 question brings its
  part into the rounds, and the boss review shows it large. Only N2's list
  holds parts; the fetched levels have none.
- **Every card in a round pays and costs (owner, 27 Nov, v305: `SCORE_ALL`,
  n2-game-review.js).** "Plus when success, minus when fail": no card of a
  round is practice any more: connectives, the other levels' words, grammar
  pieces and word parts are scored like the rest. This overrides every
  earlier line here that says a kind is "practice", "not scored" or "pays no
  points" until reviewed. The `REVIEWED_*` flags stay as the record of what a
  reviewer has read, and decide again only if `SCORE_ALL` is set to false; the
  unpaid path (`practice`, `record`) is kept for that. A practice card never
  writes recall evidence (`recallsMiss`).
- **A flagged card rests (v306).** `flagCard` (n2-game.js) takes the card out
  of the misses and keeps it out of every round for `FLAG_REST_MS` (a week;
  `flags` in the game state, synced by `mergeGame`): flagged while waiting as
  a miss, it used to come back every round. Flags do reach the gist
  (`node tools/reports.mjs`) once the device has synced.
- **Scored content no reviewer has read** is gathered for a reviewer by
  `tools/scored-review/make-review.mjs` (word parts, connectives, the open
  grammar findings, the deciding lines, a sample of each other level);
  `docs/SCORED-CONTENT-REVIEW-HANDOFF.md` is the brief.
- **A card's rest doubles with its level (v307).** `restFor` (n2-game.js):
  4 h at level 0, then 8, 16, 32, 64 h, three days at 極. A flat four hours
  made a small kind loop (eleven connective excerpts with one paper sat)
  until the answer was known by the look of the card. Every boss review card
  is spoken once (`say`): the word, the pattern, a listening line, or else
  the answer.
- **A connective is asked on its own (owner, 27 Nov, v307).** `linkCards`
  (n2-game.js): one word large, its meaning to pick in three seconds, kind
  `link`, id `k:<word>`, from the table in n2-connectives.js; no wrong choice
  is the meaning of a connective whose job overlaps (`OVERLAP`); the job
  shows in a line after the answer. The passage excerpts (`c:` cards,
  問題9-style) are **out of the rounds**: fair meant long, and long was not
  fun; one sentence was unfair. `gamePool({excerpts: true})` still builds
  them for the audit and the reviewer. This replaces every earlier line here
  about connective cards in a round. Next: short clause pairs
  (docs/QUICK-ROUND-BACKLOG.md).
- **The scored content had a second read on 27 Nov (v308), by Sonnet agents,
  not by an outside reviewer.** 210 findings in
  `tools/scored-review/reviews/2026-11-27-sonnet.json`, each with its line in
  `…-sonnet-applied.json`. Applied: word-part meanings (`AFFIX_GLOSS`), parts
  never offered against each other (`AFFIX_CONFUSABLE`), 18 deck sentences,
  the connective fixes (`LINK_NOT_WRONG`, `LINK_SHOWN`, もっとも is an
  exception), 従う's gloss and つつ(も)'s も, seven deciding lines. Not
  applied: the other levels' 41 findings and the missing word parts (backlog).
  The `REVIEWED_*` flags stay false: the same model family drafted part of
  this content.
- **An outside reviewer read the scored content on 27 Nov (v308).** 113
  findings in `tools/scored-review/reviews/2026-11-27-outside.json`, each
  with its line in `…-outside-applied.json`. All "wrong" and "unfair" ones in
  word parts, connectives and grammar are applied (`AFFIX_SHOWN`,
  `AFFIX_READING`, `LINK_WHY` added to n2-game-review.js; かねない is learned
  whole; 通して is not a form of 通じる). Left: two findings that change a
  paper's own question (set 2 #71, set 3 #72: a new `SETS_EDITION`), and the
  other levels (the reviewer's verdict: hold scoring for N5, N3 and N1).
  The `REVIEWED_*` flags are still false: the fixes themselves have not been
  read back by a reviewer.
- **28 word parts were added to the N2 list on 27 Nov (v309).** The last 28
  words of `n2-inventory.json` (不～ … 真～, indexes 1748–1775) are prefixes
  and suffixes the JLPT list lacked, named by two reviews, each with a deck
  sentence (`n2-word-<i>`) written for Echo. They are N2 recall items like
  any other and have word-part cards. New entries are appended, never
  inserted: the deck ids are indexes. Unreviewed.
- **A paper's 【word】 mark is an underline, never shown raw (v310).** An
  exam card in a round showed 人の自転車を【勝手に】使って… with its
  brackets, which reads as a furigana reading left in the text (owner's
  flags, 27 Nov). `ask()` underlines it, as the boss review (`paperText`)
  and the exam screen (`marked`) do. Exam cards stay in rounds;
  `nextRound({exams: false})` can leave them out. 当てはめる is read
  あてはめる (は, not the particle): the voice is right.
- **The mix follows the last boss (owner, 27 Nov, v311).** `skillWeights`
  (n2-game.js) sets each section's miss rate on the latest N2 boss against
  the mean of the four, clamped to `SKILL_WEIGHT` (0.5 to 2);
  `kindWeights` maps it onto card kinds (`KIND_SKILL`), and `byKindInTurn`
  gives a kind that many turns each time round. No boss yet, or a perfect
  one: every kind takes one turn, as before. It is for every learner: no
  number is the owner's.
- **Grammar and word parts are also asked the exam's way (v311).**
  `gapCards` (`f:<key>`, kind `gap`) and `partGapCards` (`p:<part>`, kind
  `partgap`): the deck sentence with the pattern or part replaced by a gap,
  the form to pick among forms other sentences write, the sentence's English
  under it (`.qr-en`): a rule cannot know that no other form fits, but only
  one gives that meaning. Never a near-twin (`GRAMMAR_CONFUSABLE`,
  `AFFIX_CONFUSABLE`, by written form). Same target as the meaning card, so
  one of the two in a round. Unreviewed, scored.
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
