# Echo

An offline-first PWA for turning an English sentence into Japanese and learning
it through a listen–imitate shadowing loop.

**[Open the app](https://echo.kakkoi.dev/)** ·
[About Echo](https://echo.kakkoi.dev/docs/)

| Practice | Review | The difference |
|---|---|---|
| ![Practice](docs/screenshots/practice.png) | ![Review](docs/screenshots/review-prompt.png) | ![Checked](docs/screenshots/review-answer.png) |

More screens, including dark and desktop, are in [`docs/screenshots`](docs/screenshots).

## Privacy and boundaries

- Provider keys are stored only in the user's browser and are never included
  in an export.
- The library lives in IndexedDB and can be exported/imported as JSON.
- The shadowing loop never opens the microphone.
- Dictation — in the composer, or when answering a review — uses the browser's
  own speech recognition, so that audio is handled by the browser's maker.
  Echo neither records nor stores it.
- Device speech synthesis produces audio on demand; no audio file is stored.
- History can be exported on-device as a standard `Echo.apkg` Anki deck.
- Every translated sentence enters an offline FSRS review queue immediately.
- Map counts the 2,136 joyo kanji against your own library. It is derived on
  the device from the sentences you already have, each time the view opens, so
  nothing about it is stored, scheduled or sent. Only sentences are reviewed.
  The character list and grade bands come from `joyo-kanji` and `kyoiku-kanji`,
  both MIT; `tools/build-kanji-data.mjs` regenerates `kanji-data.js` from them.
  Readings, meanings and the current school grade for each come from
  `kanji-readings.js`, derived from KANJIDIC2 (© EDRDG, CC BY-SA 4.0); that
  licence is that file's, and `tools/build-kanji-readings.mjs` regenerates it.
- Words are a dictionary on the device: the common words of JMdict — the
  ones it marks as frequent in print — and every word on a JLPT list, about
  23,000 in all, with readings, senses and the part of speech. Search by
  kana, romaji, a kanji, or English; every word opens a sheet with your
  sentences that use it, a place to say one, Echo writing one on request, and
  a way to remember it, also on request, kept in your notes and every backup.
  `words-data.js` is derived from JMdict (© EDRDG, CC BY-SA 4.0); that licence
  is that file's, and `tools/build-words-data.mjs` regenerates it from
  `data/jmdict/JMdict_e.gz` (download it from EDRDG; the directory is
  gitignored) and the JLPT lists under `tools/jlpt-vocab` (Jonathan Waller's,
  via elzup/jlpt-word-list, MIT). Whether a sentence uses a word is read off
  its written form and, for a verb or adjective, its stem — there is no
  parser — so the count is honest but not exact.
- Nothing of WaniKani's is bundled, redistributed, or shown in the app. It is
  a reference you rework from, once, on your own machine:
  `tools/wanikani-pull.mjs` writes your subjects to `data/wanikani/subjects.json`
  with `WANIKANI_TOKEN` from the environment — official API, one page at a
  time, passed through a small word list (`SCRUB` in `wanikani.js`). That
  directory is gitignored: it is the reference you rewrite from, not something
  this public repository carries. What you write from it is yours.
- `tools/rewrite-stories.mjs` is the writing. Given the facts — meanings and
  readings from KANJIDIC2, the parts from the pull — it has the model write an
  original story per kanji, with WaniKani's shown for structure only (or not
  at all, with `--fresh`), and no religious reference or swearing by rule.
  The result is `stories.js`, shipped and shown on the sheet above the
  reference. Those stories are Echo's.
- Grammar points come as a table of contents, not content. `tools/bunpro-
  structure.js` runs in your own browser on your own Bunpro index page and
  reads names and levels only — it never opens a grammar point, so it cannot
  reach an explanation, an example or audio. `tools/build-grammar-data.mjs`
  turns that into `grammar-data.js` and refuses any input carrying more than a
  name, a level and a short gloss. Echo writes its own sentences on top.
- Reminders are optional, at most one a day, and only when something is due.
  Echo has no server, so nothing is pushed: where the browser supports Periodic
  Background Sync the worker is woken to check, and everywhere else the check
  runs when the app is opened. Settings says which applies on the device in
  front of you rather than promising either.
- A review shows the English, takes the Japanese you say back, marks the
  difference, and then grades on Again or OK (Anki Good).
- Anki exports include Echo's repetitions, lapses, interval, and due date.
- A configurable proxy is supported for browsers where DeepSeek blocks direct
  cross-origin requests. Proxy implementation and hosting remain external.

## JP Core

core.js is JP Core's `browser/jp-core.js`, copied: the furigana notation, safe
ruby rendering, reading alignment, the sentence schema, and the merge rules.
Everything below the language list is verbatim, and the list itself is the one
local addition — which languages the dropdown offers is an application choice,
not a Japanese one. diff.js and the rest read the notation through core.js
rather than reimplementing it.

Change these rules in JP Core first and bring the copy over in the same change.
The synchronized JP Core revision is
`c84048782e545420dd7b7b62d2556789cd8d6f98`.

## Layout

    index.html app.js styles.css   the app itself
    core.js diff.js srs.js db.js   sentence rules, the answer diff, scheduling, storage
    api.js speech.js reminders.js  translation, the loop and dictation, due reminders
    sw.js manifest.webmanifest     offline shell and install
    docs/                          the landing page, published beside the app
    tools/                         one-off scripts that draw the identity assets

## Development

    npm test
    npm run check

Serve the directory over HTTP to exercise service workers, microphone
permissions, IndexedDB, and PWA installation.
