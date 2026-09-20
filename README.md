# Echo

An offline-first PWA for turning an English sentence into Japanese and learning
it through a listen–imitate shadowing loop.

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

## Development

    npm test
    npm run check

Serve the directory over HTTP to exercise service workers, microphone
permissions, IndexedDB, and PWA installation.
