# Echo HTMX + Path Navigation Migration

Status: **planned**. This document is the migration contract. Do not incrementally mix a second navigation model into `app.js` without following these phases.

## Why

Echo currently keeps too much durable UI state in one client script: selected view, searches, open sheets, note controls and restoration state. Bugs such as mnemonic saves racing other actions are a consequence of imperative DOM state having more than one owner.

The migration makes the **URL the durable navigation state** and gives HTMX ownership of page/sheet transitions. IndexedDB remains the local learning database. Existing domain modules remain plain JavaScript.

Goals:

1. Reload returns to the same useful place naturally because the path is the place.
2. Back/forward works without custom workspace reconstruction.
3. A word, kanji, grammar point, sentence, review queue or filtered library can have a shareable/bookmarkable URL.
4. Saving is explicit and testable. One action has one persistence owner.
5. PWA/offline remains first-class.
6. Do not rewrite proven Japanese, SRS, speech or provider logic merely to adopt HTMX.

## Route contract

Canonical routes:

| Path | Meaning |
|---|---|
| `/` | Practice, sentence mode |
| `/discussion` | Discussion mode |
| `/review` | Review |
| `/library` | Library |
| `/library?q=駅&filter=skipped&order=newest` | Library search/filter/order |
| `/sentences/:id` | One saved sentence |
| `/words` | Word search |
| `/words?q=ほうふ` | Word search result state |
| `/words/:id` | Word sheet/page |
| `/kanji` | Kanji map/search |
| `/kanji/:character` | Kanji sheet/page |
| `/grammar` | Grammar search |
| `/grammar/:id` | Grammar sheet/page |
| `/settings` | Settings |

Search/filter/order belong in query parameters because they describe the collection. Resource identity belongs in the path.

Opening a sheet pushes its resource URL. Closing it goes back to the collection URL. On a wide screen the resource may render as a modal/sheet; on a narrow/deep-link load it may render as a full page. The URL is identical.

Do **not** persist a second copy of route state in `jp-echo-workspace`. After migration, local storage may keep preferences, never navigation truth.

## HTMX boundary

HTMX owns:
- navigation links and tabs;
- collection search/filter requests;
- opening/closing resource sheets;
- form submission lifecycle and replacement of rendered fragments;
- history push/replace.

Plain JS modules own:
- IndexedDB transactions;
- AI provider calls;
- speech synthesis/recognition;
- shadow/discussion loops;
- FSRS/SRS;
- Mora tokenization/validation;
- import/export/Anki;
- install/reminder browser APIs.

HTMX is **not** a reason to put domain rules in HTML attributes.

Use a small local router/render adapter as the HTMX endpoint in the browser. It maps a request path + method to a rendered HTML fragment and calls the existing domain modules. HTMX requests go through that adapter rather than pretending GitHub Pages is a dynamic server.

Recommended shape:

```
routes.js          route matching + canonical URL helpers
actions.js         explicit application actions / persistence boundary
render/
  practice.js
  discussion.js
  library.js
  sentence.js
  words.js
  word.js
  kanji.js
  grammar.js
  settings.js
htmx-adapter.js    intercept/local request adapter and history integration
```

Keep `api.js`, `core.js`, `db.js`, `srs.js`, `speech.js`, dictionary/data modules.

## Saving contract

Every mutation becomes an explicit action returning the saved record:

- `saveSentenceAction(input)`
- `deleteSentenceAction(id)`
- `saveNoteAction(key,text)`
- `deleteNoteAction(key)`
- `regenerateWordNoteAction(wordId)`
- `markSkippedAction(sentenceId)`
- `clearSkippedAction(sentenceId)`

Rules:
- no save-on-blur;
- no mutation hidden inside render functions;
- disable the submitting control while its action is in flight;
- await IndexedDB transaction completion before rendering success;
- after success, render from the returned persisted object, not stale DOM state;
- failure leaves the old UI/data intact and shows an error;
- idempotent where practical.

Mnemonic Edit / Delete / Generate New therefore become normal form actions rather than event handlers installed while a modal is being rendered.

## Sharing

There are two meanings of share:

1. **Share the place in the app.** A URL such as `/words/<id>` is enough. Anyone with Echo can open the same dictionary resource because dictionary data ships with the app.
2. **Share personal content.** A `/sentences/:id` URL cannot expose another device's IndexedDB record. A URL is only an identifier, not cloud sync. Cross-device/public sharing of personal sentences requires an explicit portable payload or sync backend and is out of this migration unless separately designed.

Do not imply that path navigation turns local IndexedDB data into cloud data.

## Deployment: hard requirement for real paths

GitHub Pages does not provide configurable rewrite rules for arbitrary app routes. A cold request to `/words/<id>` therefore cannot reliably reach `index.html`. A service worker only helps after it controls that browser and cannot make a first-time shared link reliable.

Preferred production deployment: a static host/CDN that supports fallback rewrites:

```
/*  -> /index.html  200
```

Keep the same static assets and PWA. No application server is required.

If GitHub Pages must remain the host, choose one deliberately:
- generated physical route files/directories for every finite resource plus top-level routes; or
- a `404.html` redirect/bootstrap workaround.

The 404 workaround is not the canonical architecture: it produces a real 404 response first and is inferior for clean sharing/crawlers. Generated routes are feasible for finite dictionary/kanji/grammar resources but add build output and do not solve arbitrary personal sentence IDs cleanly.

**Migration gate:** do not switch canonical links from the current root until production hosting/rewrite behavior is chosen and tested with a fresh browser.

## Offline navigation

The service worker navigation handler must become app-shell aware:
- for same-origin navigation requests, return cached `index.html` when offline;
- preserve the requested URL in the address bar;
- router renders from that path;
- cache HTMX itself locally; no CDN dependency at runtime;
- increment cache version during migration.

Test direct offline opens after the route has been visited and after PWA installation.

## Migration phases

### Phase 0 — fix and pin current behavior
Before structural migration:
- fix current Save sentence failure;
- add behavioral persistence tests rather than source-regex-only tests;
- keep CI green.

### Phase 1 — route model, no visual rewrite
- add `routes.js` with parse/build/canonical tests;
- map every existing view/resource to the route contract;
- use History API paths internally while retaining current rendering;
- remove `jp-echo-workspace` restoration only after route restoration covers it;
- back/forward E2E tests.

### Phase 2 — explicit action layer
- extract all writes from `app.js`;
- sentence save/delete;
- note edit/delete/regenerate;
- skipped state;
- settings writes;
- tests with fake IndexedDB/action dependencies;
- no save-on-blur.

This phase should eliminate the class of bug reported today even before HTMX owns rendering.

### Phase 3 — HTMX shell
- vendor HTMX locally;
- stable shell: header/nav/main/sheet target/toast;
- HTMX adapter resolves local routes/actions;
- convert Practice and Library first;
- preserve speech state only where intentionally continuous.

### Phase 4 — resource routes
Convert in order:
1. sentence;
2. word;
3. kanji;
4. grammar;
5. settings;
6. discussion/review.

Each conversion deletes the corresponding imperative renderer/event wiring from `app.js`; do not leave two owners.

### Phase 5 — deployment + PWA
- choose rewrite-capable static hosting or generated Pages routes;
- direct-load test every route family in a fresh browser;
- offline route tests;
- manifest/start URL and notification click use canonical paths;
- remove old `?view=review` compatibility after one migration window.

### Phase 6 — cleanup
- delete `jp-echo-workspace`;
- split or remove remaining `app.js`;
- update README architecture;
- verify no inline handler dynamically rebinds mutations;
- full browser E2E suite.

## Test matrix / definition of done

Every route family must pass:
- click navigation;
- direct cold load;
- reload;
- back;
- forward;
- copied URL in a fresh browser;
- installed-PWA navigation;
- offline navigation where local data permits.

Every mutation must pass:
- successful save is visible after reload;
- double click does not duplicate/corrupt;
- failed transaction does not show success;
- edit persists;
- delete stays deleted after reload;
- regenerate cannot be overwritten by an old blur save.

Session features to retain:
- Discussion scenario dictation;
- accumulated conversation loop;
- per-speaker/default/random TTS;
- same source/target language;
- target voice installation help;
- save Discussion turn to Library;
- skipped Library filter and clearing after practice;
- Mora exact-reading anchors and hallucination rejection;
- manual mnemonic edit/delete/regenerate/voice-adjust.

## What not to migrate

Do not replace IndexedDB with a server merely for HTMX.
Do not move AI keys off-device.
Do not rewrite FSRS or JP Core.
Do not require network access for navigation after installation.
Do not encode volatile playback/microphone/in-flight-request state in URLs.

## First implementation slice

The first code PR/commit after this spec should contain only:
1. current Save sentence fix + behavioral test;
2. `routes.js` + route tests;
3. canonical URL updates through History API;
4. back/forward restoration tests.

Only after that is green should HTMX be vendored and the first screen converted.
