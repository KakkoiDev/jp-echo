# Echo

An offline-first PWA for turning an English sentence into Japanese and learning
it through a listen–imitate shadowing loop.

**[Open the app](https://kakkoidev.github.io/jp-echo/)** ·
[About Echo](https://kakkoidev.github.io/jp-echo/docs/)

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
- History can be exported on-device as a standard `JP Echo.apkg` Anki deck.
- Every translated sentence enters an offline FSRS review queue immediately.
- Reminders are optional, at most one a day, and only when something is due.
  Echo has no server, so nothing is pushed: where the browser supports Periodic
  Background Sync the worker is woken to check, and everywhere else the check
  runs when the app is opened. Settings says which applies on the device in
  front of you rather than promising either.
- A review shows the English, takes the Japanese you say back, marks the
  difference, and then grades on Again or OK (Anki Good).
- Anki exports include JP Echo's repetitions, lapses, interval, and due date.
- A configurable proxy is supported for browsers where DeepSeek blocks direct
  cross-origin requests. Proxy implementation and hosting remain external.

## JP Core

The browser primitives in core.js implement JP Core's canonical furigana
notation, safe ruby rendering, sentence schema, and merge rules. diff.js reads
that notation through core.js rather than reimplementing it. Change these
rules in JP Core first and synchronize this browser distribution in the same
change. The synchronized JP Core revision is
`c49ce2134ae8eb226819d63835e9394a6b6e11b0`.

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
