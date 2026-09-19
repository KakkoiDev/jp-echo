# JP Echo

An offline-first PWA for turning an English sentence into Japanese and learning
it through a listen–imitate shadowing loop.

## Privacy and boundaries

- The DeepSeek key is stored only in the user's browser.
- History lives in IndexedDB and can be exported/imported as JSON.
- The learner's voice is never recorded.
- Device speech synthesis produces audio on demand; no audio file is stored.
- A configurable proxy is supported for browsers where DeepSeek blocks direct
  cross-origin requests. Proxy implementation and hosting remain external.

## JP Core

The browser primitives in core.js implement JP Core's canonical furigana
notation, safe ruby rendering, sentence schema, and merge rules. Change these
rules in JP Core first and synchronize this browser distribution in the same
change. The synchronized JP Core revision is
`c49ce2134ae8eb226819d63835e9394a6b6e11b0`.

## Development

    npm test
    npm run check

Serve the directory over HTTP to exercise service workers, microphone
permissions, IndexedDB, and PWA installation.
