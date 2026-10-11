<!-- Research report produced 2026-10-03 for SPEC.md. Snapshot of the code at commit 0e27c4c; line numbers drift. Scratch paths mentioned below were session-local and are gone. -->

# Echo Library and sentence persistence: where saved words could go

## 0. Summary

- **The library has one IndexedDB store, and everything in it is treated as a sentence.** Database `jp-echo`, store `sentences`, keyPath `id`, one `createdAt` index (db.js:3-4). `app.js` has 41 `listSentences()` call sites. The service worker also reads the store directly to count due items (sw.js:63-85). None of these readers checks what kind of record it got.
- **Writes go through app.js wrappers that call `markBackupDirty()`:** `saveSentence`, `deleteSentence`, `putNote`, `deleteNote`, `replaceNotes` (app.js:34-45). A test pins the shape of these wrappers by regex (test/gist-backup.test.js:92-97).
- **The backup is `buildBackup()`** (app.js:1541): `exportBackup(sentences, settings, notes)` plus `catalogues`, which app.js adds outside `core.js`. Echo has no word records today. The closest thing is the note `word:<id>:remember`.
- **Import is one merge path.** `validateDeckBackup` → `planMiniSentenceUpgrade` → `mergeSentences` → `replaceAll` → `markBackupDirty` → `mergeNotes` (app.js:1574-1585). Records match by id first, then by text identity. Text changes only when the incoming `updatedAt` is newer. Progress never goes backwards. **Import never deletes anything.**
- **Gist sync only uploads.** Echo replaces `echo-backup.json` with a PATCH (gist-backup.js:67-85). It never reads the gist before writing. Restore is a manual button (app.js:1662-1670).
- **Recommendation: Option A.** Put saved words in their own database, keyed by the dictionary word id, with no review schedule. Derive a word's state from the existing coverage functions. Carry the words in the backup as a top-level `words` key, added in `buildBackup` next to `catalogues`. No `SCHEMA_VERSION` bump and no change to `core.js`.

---

## 1. The sentence record

Created by `createSentence` (core.js:231-242). Old records are upgraded on read by `migrateSentence` (core.js:255-265, run in db.js:7 and db.js:9) and written back once at boot by `migrateStore` (db.js:14-23). `SCHEMA_VERSION = 2` (core.js:12).

| Field | Type | Set where |
|---|---|---|
| `id` | string (UUID from `newId`, core.js:221; or a deck id such as `cafe-ja-001`) | createSentence |
| `sourceLang`, `targetLang` | language code from `LANGUAGES` (core.js:32) | createSentence; imports check them with `isLanguage` (imports.js:12) |
| `source` | meaning, in the learner's language | createSentence |
| `target`, `casualTarget`, `politeTarget` | 漢字【かんじ】 notation | createSentence |
| `plainTarget`, `plainCasualTarget`, `plainPoliteTarget` | furigana stripped | createSentence |
| `echoCount` | number | starts at 0; +1 per shadow echo (app.js:63) |
| `createdAt`, `updatedAt` | ISO strings | createSentence; `updatedAt` is bumped on every edit |
| `reviewRegister` | `"casual"` or `"polite"` | createSentence; app.js:1157 |
| `translationProvider` | string (`"authored-import"` for Minihongo) | createSentence; app.js:596, 1061 |
| `schemaVersion` | 2 | createSentence / migrateSentence |
| `srs` | serialized ts-fsrs card (`due`, `state`, `reps`, …) | `ensureSchedule` / `reviewSentence` (srs-entry.js:7-24) |
| `lastRating` | `"again"` or `"ok"` | srs-entry.js:23 |
| `reviewTrack` | `{next, completed, attempts, last}` | review-modes.js:38-62 |
| `reviews` | `[{at, rating, mode, echoes}]` | app.js:1539 |
| `skipped`, `skippedAt` | boolean, ISO | app.js:1532 (set), app.js:1419 (cleared) |
| `grammar` | point ids | autoTag / tagUntagged (app.js:697, 711); grammar sheet (app.js:875) |
| `grammarAnalysis` | `[{text, grammar, spans}]` | app.js:37, 697 |
| `vocabulary` | word ids (negative = imported catalogue word) | imports only; `sentenceWords` reads it (words.js:64) |
| `provenance` | `{project, starterVersion, path}` | Minihongo imports (mini-imports.js:34, 75) |
| `transient` | flag on an in-memory card that is never saved | app.js:63 |

Readers also use `preferredTarget`, `preferredPlainTarget`, `itemTarget` and `sentenceRegister` (app.js:85-88).

## 2. Storage and where writes go

| Store | Holds | Code |
|---|---|---|
| IDB `jp-echo` v1 / `sentences` (keyPath `id`) | the library | db.js:3-9. `onupgradeneeded` creates the store with no guard, so adding a store means bumping to v2 **and** guarding the create. |
| IDB `jp-echo-notes` v1 / `notes` (keyPath `key`) | notes `{key, kind, id, part, text, echo, made, by}`; key is `kind:id:part` | notes.js:7-31, 42-44 |
| IDB `jp-echo-import-recovery` / `backups` | Minihongo undo copies | db.js:26-32. Its comment: "Separate recovery database avoids changing the sentence store's schema." |
| IDB `jp-echo-wanikani` | none now: **deleted at every boot** | app.js:1799. Do not reuse the name. |
| localStorage `jp-echo-settings`, `jp-echo-catalogues`, `jp-echo-gist-state`, `jp-echo-workspace` | preferences and credentials, imported catalogues, gist bookkeeping, legacy workspace | app.js:47-49; catalogues.js; app.js:1615-1620; app.js:325 |

Echo already gives each new kind of data its own database (notes, import recovery, and WaniKani before it was removed: wanikani.js:50-51 "Its own database, so the sentence store and its migration are never touched").

**The write path**
- `db.js` exports raw `saveSentence`, `deleteSentence` and `replaceAll` (db.js:6, 8, 24). `app.js` imports them under other names (app.js:7) and wraps them:
  - `saveSentence` merges any cached `grammarAnalysis`, then `persistSentence`, then `markBackupDirty()` (app.js:34-39).
  - `deleteSentence`, `putNote`, `deleteNote` and `replaceNotes` each await the db call, then call `markBackupDirty()` (app.js:42-45).
- `actions.js` `saveDiscussionTurn` takes an injectable `save` (actions.js:6). app.js passes the wrapper: `save:saveSentence` (app.js:224). A `saveWord` action should follow this pattern.
- `markBackupDirty()` does nothing unless `settings.gistAuto` is on. Otherwise it marks the state dirty and schedules an upload `QUIET_MS + 500` later (app.js:1622).
- Writes that skip the wrappers: `migrateStore` (db.js:14-23) and `removeArchivedMiniCards` (db.js:36-39). Both are boot-time repairs.
- The word note is written through the wrapped `putNote` / `deleteNote`, under key `noteKey("word", w.id, "remember")` (app.js:1006, 1013, 1016, 1022, 1025, 1034).

## 3. How the library renders

**Markup** (index.html:6, `#history-view`): search `#history-search`; a filter row with three selects:
- `#history-filter` ("Cards": all, due, new, learning, review, skipped)
- `#history-order` (created, echoes, due, english, japanese)
- `#history-direction` (desc, asc)

Below that come two entry rows, `#library-tool` ("Kanji, words and grammar" plus a tally) and `#mora-open`, both `.library-tool`. Then the empty states `#empty-history` and `#empty-results`, the list head (`#library-count`, `#library-order-label`) and `ul#history-list`.

**`renderHistory`** (app.js:1141-1142):
- **Read:** `listSentences()`, which migrates and sorts by `createdAt` descending (db.js:9). A version counter discards stale renders.
- **Search:** case-folded `includes` over `source`, `target`, `plainTarget`, `casualTarget`, `politeTarget`.
- **Filters:**
  - `due`: no `srs.due`, or due now
  - `new`: `srs.state` is 0
  - `learning`: state 1 or 3
  - `review`: state 2
  - `skipped`: `skipped === true`
  - any other value shows everything
- **Sort:** comparators `created`, `echoes`, `due`, `english` (`source`), `japanese` (`preferredPlainTarget`, with locale). `asc`/`desc` sets the sign.
- **Side effects:** updates the due badge, the "N sentence(s)" count, the order label (`ORDER_LABELS`, app.js:1134) and the starter offer. The empty state is driven by `all.length`.
- **Wide screens (≥1024px):** if nothing is selected, it calls `openDetail(items[0].id)`.
- **Row markup:** `li[data-id] > button.history-open > span.lines{ span[lang] rubyHtml(preferredTarget) , span.source-line , span.status-chip.<due|new|learning|review> } + span.tally{strong echoCount, "echoes"}`. Rendered in chunks of 10. A click calls `openDetail(id)`, which opens `/sentences/:id` (app.js:1147). The row is one tap target; words inside it are not separately clickable (test/ux-library.test.js:61-64).
- **Card state:** `cardState()` (app.js:1135); labels in `CARD_STATES` (app.js:1133).
- **Library tally:** `renderLibraryTool(all)` shows learned kanji, words and grammar, derived from sentences (app.js:1136-1139). Japanese targets only.

**URL and preference state**
- routes.js:23 writes `q`, plus `filter`, `order` and `direction` when they differ from their defaults.
- routes.js:39 parses them (defaults `all`, `created`, `desc`). Any filter string is accepted.
- `navigationState` (app.js:334) and `syncRoute` (app.js:335).
- Handlers (app.js:1771): search input → replaceState and render. Select change → stored in `settings.historyFilter`, `historyOrder` and `historyDirection`, then replaceState.
- Restore: app.js:1781-1782. Initial values: app.js:1772. "Clear filters": app.js:1717.
- Pinned by tests: test/routes.test.js:9 (library params round-trip, including `filter=skipped`) and test/session-regressions.test.js:23-28 (the `skipped` option and filter regex).

**Existing word-row visuals, for reuse:**
- `wordRow()`: `.point-row` with swatch, title, reading, gloss and "N sentences" (app.js:923-931).
- Word search results: `.lookup-row` (app.js:447-452).
- States `unmet`, `met`, `learned` with labels in `STATE_LABELS` (app.js:360).
- The word sheet is `openWord` (app.js:977-998); its route is `/words/:id` (routes.js:8, 43; sw.js:24 serves the app shell offline).

## 4. Backup, import and merge

- **`exportBackup`** (core.js:311-317) returns `{schemaVersion: 2, exportedAt, sentences, preferences (credentials stripped: apiKey, providerKeys, speechKeys, gistToken, gistUrl), notes}`.
- **`buildBackup`** (app.js:1541) returns `{...exportBackup(listSentences(), settings, forBackup(listNotes())), catalogues: importedCatalogues}`. `forBackup` drops `part === "examples"` (notes.js:46). Export downloads this document and the gist upload sends the same one (app.js:1542, 1636). Pinned by test/gist-backup.test.js:99-103 (regex `async function buildBackup\(\)\{return \{\.\.\.exportBackup\(`).
- **`validateDeckBackup`** (imports.js:4-18) checks the whole file first:
  - `schemaVersion` must be an integer from 1 to `SCHEMA_VERSION`, and `sentences` an array (it may be empty).
  - Each sentence needs non-empty string `id`, `source` and `target`. One bad record rejects the whole file.
  - `sourceLang` and `targetLang` must be on `LANGUAGES`. Arrays are type-checked.
  - `createdAt` defaults to the epoch; `updatedAt` defaults to `createdAt`.
  - **Unknown top-level keys pass through unchanged** (`{...value, sentences}`).
- **`importBackupData`** (app.js:1574-1585) runs in this order:
  1. Validate.
  2. Wait for startup cleanup.
  3. Reject the oversized old starter and unsupported versions.
  4. `planMiniSentenceUpgrade(before, backup)`, which is `mergeSentences(current, backup.sentences)` unless the file is Minihongo v3 (mini-imports.js:56-70).
  5. Merge catalogues by id (mini-imports.js:78-81).
  6. `replaceAll(merged)`. On failure, roll back the catalogues.
  7. `markBackupDirty()`.
  8. `replaceNotes(mergeNotes(local, backup.notes))`.
  9. Status message, re-render.
  - Callers: file import (app.js:1592), deck URL (app.js:1598), gist restore (app.js:1666), starter (app.js:1687), undo cleanup (app.js:1612).
- **`mergeSentences`** (core.js:277-303):
  - Records are keyed by `id`. A second index uses `sentenceIdentity`: the JSON of `[sourceLang, targetLang, NFKC plain target with spaces removed for ja]` (core.js:269-275). An incoming record matches by the same id, or failing that by the same identity.
  - Incoming records without `id`, `source` or `target` are silently skipped (core.js:283).
  - The incoming copy's content wins only if it has the **same id and a strictly newer `updatedAt`**; otherwise the local copy wins (core.js:288). A match by text identity never replaces content.
  - `echoCount` takes the max. `createdAt` takes the earliest. `grammar` and `vocabulary` are unioned. `reviews` are deduplicated by JSON and sorted. `grammarAnalysis` is unioned by `text`.
  - `srs`: the local copy is kept if the incoming one has fewer `reps`, or if the match was by identity. The local `reviewTrack` is always kept.
  - Pinned by test/import-merge.test.js:3-8 and test/deck-format.test.js:51-61. DECK-FORMAT.md:90-114 documents the update rule ("import never deletes").
- **`mergeNotes`** (notes.js:49-57): keyed by `key`; the newer `made` wins; a note present on only one side is kept; the incoming `examples` cache is ignored. **There are no tombstones.** A note deleted locally comes back on the next restore. The same holds for sentences.
- **Gist** (gist-backup.js; app.js:1615-1670):
  - `uploadBackup` PATCHes `files: {"echo-backup.json": …}`, or POSTs a new secret gist (gist-backup.js:67-85).
  - `runGistBackup` only uploads (app.js:1630-1645). Auto-upload triggers on change (quiet period), on hide (app.js:1819) and on open (app.js:1796).
  - `downloadBackup` is used only by the manual restore (app.js:1666). It GETs `/gists/:id`, which returns every file in the gist, and reads `echo-backup.json`, falling back to `raw_url` when the file is truncated (gist-backup.js:89-106).
  - **What this means for sync:** today, anything the reader script writes into `echo-backup.json` is overwritten by Echo's next upload, unless Echo first pulls and merges.

## 5. How word state works today (and what "saved" would change)

- `words.js:4-6`: coverage is "derived from the library every time it is asked for … there is no second copy of the truth."
- `coverage(sentences)` maps word id to sentence ids (words.js:70-81). `learned(sentences)` collects the words of sentences at `srs.state === 2` (words.js:85-92). `sentenceWords` reads the plain text of every register plus `vocabulary` ids (words.js:61-67).
- The word sheet's state is `learned` / `met` / `unmet` (app.js:979). Its copy says "learned, since one of them reached review" (app.js:988).
- The word sheet already moves a word towards learned. "Say a sentence using {word}" and "Or let Echo write one" call `saveWordSentence`, which uses the wrapped `saveSentence` (app.js:1040-1063).
- **Word ids** are JMdict entry numbers (positive, e.g. `1332650` 秋, words-data.js:19+). Imported catalogue words have negative ids (catalogues.js / mini-imports.js:80). `word(id)` uses `Number(id)` (words.js:23).

## 6. Three ways to represent a saved word

### Option A: a dedicated database, `jp-echo-words` / store `words`, keyPath `id` (word id) — recommended

Proposed record: `{id: 1332650, w: "秋", r: "あき", lang: "ja", savedAt, updatedAt, removedAt: null, from: "reader"|"echo", contexts: [{text, url, title, at}]}`.
- Keeping `w` and `r` lets a row render on a device that cannot resolve the id, such as a missing imported catalogue word.
- Store `url` as origin + path only, with no query or hash. Cap `contexts` at a few entries. The gist is secret but anyone with the URL can read it, which is why `exportBackup` already strips `gistUrl` (core.js:312-314).

| Concern | Consequence |
|---|---|
| Review / SRS | None. `dueSentences`, `startReview`, the due badge, `remindOnOpen` (app.js:259) and the service-worker reminder (sw.js:82) are unaffected. A saved word becomes "met" and "learned" through the existing sentence flow (app.js:1040-1063), which matches DESIGN-BRIEF.md:22-23 and the review-skills rule in CLAUDE.md. |
| Coverage | The functions don't change. Add a fourth state, "saved" (saved but not yet in a sentence), shown next to `unmet`/`met`/`learned`. Optionally add a saved count to `renderLibraryTool` (app.js:1136) and a mark in `wordRow`. |
| Backup schema | Add `words` in `buildBackup`, after `exportBackup`, the way `catalogues` is added (app.js:1541). No `SCHEMA_VERSION` bump: a bump makes every older build reject the file (imports.js:5, app.js:1577), and the deck schema has `const: 2`. `core.js` is untouched (core.js:1-11 and README.md:177 say JP Core owns the identity and merge helpers). `importBackupData` gets a `mergeWords` step after notes (app.js:1582), with its own validation: integer id, capped strings, `isLanguage`, http(s)-only URLs. Untrusted data rules apply, and rows render through `textContent` or `escapeText` (app.js:1132). |
| Merge | The natural key `id` means duplicates cannot happen: put is idempotent, which covers the user's "remove duplicates on pulls". Newest `updatedAt` wins scalar fields; `contexts` are unioned; the earliest `savedAt` is kept. A `removedAt` **tombstone** is needed so that un-saving survives a merge. Neither `mergeSentences` nor `mergeNotes` has tombstones today. |
| Deck format | `words` is backup-only, like `notes` and `preferences`. Add it to "What a deck must not contain" (DECK-FORMAT.md:80-88) and to the agent instructions, and extend the list in test/deck-format.test.js:68-72. The deck schema has no top-level `additionalProperties: false`, so backups carrying `words` still validate. |
| Write path | New wrappers `saveWord` and `removeWord`, written as `async function saveWord(...){const done=await dbSaveWord(...);markBackupDirty();return done}`, and added to the name list in test/gist-backup.test.js:94. An `actions.js` action with an injectable `save`, following `saveDiscussionTurn`. |
| Existing tests | None break, since the change is additive. Add the new module to `sw.js` `ASSETS` and bump `CACHE` (sw.js:1, 3; test/pwa.test.js requires every asset to exist). Also add it to `package.json` `check`, which lists modules explicitly. |
| Sync | The script can produce these records as plain JSON without any Echo code; it needs only the word id from Echo's dictionary. |

### Option B: a new record kind (`kind: "word"`) in the `sentences` store — not recommended

| Concern | Consequence |
|---|---|
| Review / SRS | A record with no `srs` counts as due (srs-entry.js:12-14; sw.js:39). Unless all 41 `listSentences` readers filter by kind, words immediately enter the review queue (app.js:1378) and the due badge (app.js:1085). The reminder would say "N sentences are due" (sw.js:85). They would also go into the Anki export (app.js:1543, `forAnki` core.js:306), `repairReversedCards` (app.js:1550-1572), Minihongo cleanup (db.js:36-39), and `tagUntagged` / `autoTag`, which would send words to the AI grammar tagger at the user's cost (app.js:702-716). |
| Coverage | `sentenceWords` would find the word inside its own record. Saving a word would make it "met", and reviewing it would make it "learned". That contradicts the current meaning of learned (words.js:83-84; app.js:988). |
| Backup schema | Words would sit in `backup.sentences`. A word record without `source` and `target` fails `validateDeckBackup` (imports.js:9) and **rejects the whole file**, so restore breaks on every device, including older builds. With a fake `source` (gloss) and `target` (word), `sentenceIdentity` would merge a saved 食べる with any one-word sentence 食べる (core.js:269-275, 284). Fixing that means changing helpers JP Core owns (README.md:177). |
| Deck format | Breaks the rule that `target` is "one complete, natural sentence … not a word" (DECK-FORMAT.md:62, 133-134). |
| Precedent | Echo already tried this. The Minihongo v2 starter stored "231 main vocabulary entries as words/glosses" as cards (README.md:181-183), and v3 replaced those word cards with sentences (mini-imports.js:55-70; test/mini-sentences.test.js). |
| Wide-screen hazard | `renderHistory` auto-opens `items[0]`. If that is a word, `openDetail` gets no sentence and calls `showView("library")`, which calls `renderHistory` again: an infinite loop on desktop (app.js:1141, 1147). |
| Tests | Nothing fails right away, but the semantics behind test/ux-library.test.js, the import-merge tests and the deck-format tests become wrong. The blast radius is very large. |

### Option C: a note, `word:<id>:saved`, in the notes store — viable, cheapest, but a semantic stretch

| Concern | Consequence |
|---|---|
| Review / coverage | None, same as Option A. |
| Backup schema | No change. Notes are already exported (core.js:316), merged on import with newer `made` winning (app.js:1582; notes.js:49-57), and written through wrappers (app.js:43-44). The AI note `word:<id>:remember` sits in the same array, so a saved word and its note travel together. Older builds already keep unknown note keys. |
| Downsides | A note means "text Echo wrote / your version", with a Reset action (notes.js:1-6, 42-44). Saved-word metadata would be squeezed into `text`. `made` doubles as the merge clock and must be bumped on every change. Listing saved words means scanning all notes, since there is no index. Deletes still need a tombstone (mergeNotes has none). A future agent could easily render it through `noteBlock`, giving the same concept two implementations. |
| Deck format | Already covered: decks may not contain `notes` (DECK-FORMAT.md:85). |
| Tests | None break; the shapes in notes.test.js still hold. |

**Variant D (an add-on, not a full option):** save the sentence the word was found in as a real sentence with `vocabulary: [id]` (words.js:64). It needs a `source` translation, which means AI at save time. It would enter review straight away, and it fills the library with web sentences, against "the library is made of things the learner actually wanted to say" (DESIGN-BRIEF.md:22-23). Better offered later from the word sheet, through the existing `composeFromIntent` flow.

## 7. Hazards and gotchas the spec must cover

1. **`openWord` never updates the URL.** It takes `route` but never calls `syncRoute` or `saveWorkspace` (app.js:977-998). `openKanji` (app.js:476) and `openGrammar` (app.js:736) do. Opening the word sheet from a library row therefore would not be URL state (CLAUDE.md principle 5). Also, `/words/:id` parses to `view: "map"` (routes.js:43), so a reload shows the sheet over the Words map, not the Library. Closing the sheet only saves the workspace (app.js:1734).
2. **Library behaviour that assumes only sentences:** the wide-screen auto-open (app.js:1141); `#empty-history` and `.history-tools` keyed to `all.length` (a library holding only words would say "Your library is empty"); and the copy "N sentences", "Search English or Japanese" and "No sentences match these filters" (app.js:1141; index.html:6).
3. **Filter options:** the "Cards" select holds review states only. `filter=words` would round-trip in the URL without touching routes.js (routes.js:23, 39). If the option is missing from the select, assigning its value leaves the select blank, which renders as "all". Two quieter alternatives that already fit Echo's look: a `.library-tool` entry row ("Saved words · N"), or a section of `.point-row` word rows.
4. **Older devices still upload blindly.** A device on an older cached build would PATCH `echo-backup.json` without `words` and wipe them from the gist. Either Echo pulls and merges before every upload, or the script writes its own gist file. Echo's PATCH names only `echo-backup.json`, and `downloadBackup` already receives every file in one GET (gist-backup.js:92-95).
5. **Copy that counts sentences:** the gist description "Echo backup — N sentences" (gist-backup.js:72), import and restore messages (app.js:1592, 1598, 1668), and `renderLibraryTool` (app.js:1136-1139).
6. **Release steps:** new runtime module → add to `sw.js` `ASSETS` and bump `CACHE` (sw.js:1, 3), and add to `package.json` `check`.
7. **Baseline:** `npm test` passes 335 of 335 as of now.

## 8. Not verified

- GitHub's behaviour that a gist PATCH leaves files it does not name untouched comes from GitHub's API documentation; nothing in this repository tests it.
- Whether the GitHub gist API supports conditional writes (ETag / If-Match) to detect conflicting writers is unknown. Assume it does not.
- The JP Core repository is not on this machine. I could not check whether `exportBackup`, `mergeSentences` and `sentenceIdentity` are verbatim copies; the claim comes from core.js:1-11 and README.md:177.
- The exact ts-fsrs card fields are not listed here because `srs.js` is a minified bundle; srs-entry.js:5-9 shows how a card is serialized.