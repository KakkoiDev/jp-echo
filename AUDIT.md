# Audit — October 2026

Scope: whole app (`app.js` and every module it imports), Settings, Review,
Discussion, Reading, imports and backups, the service worker, the test suite.
Every finding below was reproduced before it was fixed, and each fix has a
regression test in `test/audit-regressions.test.js` or `test/ux-library.test.js`.

## Fixed

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | High | **Script injection via a sentence's `targetLang`.** It was written unescaped into `lang="…"` in the Library and due lists. Any deck — including one fetched from an arbitrary URL — could run script and read the provider keys in `localStorage`. | Imports reject codes not on `LANGUAGES`; `itemTarget` passes every stored code through `safeLanguage`, which also neutralises records saved before the fix. The URL import is gone. |
| 2 | High | **Groq speech key written into every backup.** `exportBackup` stripped `apiKey` and `providerKeys` but not `speechKeys`. | All three are stripped. |
| 3 | Medium | **Discussion "Save" always threw.** It called `renderLibrary?.()` and `showToast()`, neither of which exists (optional chaining does not guard an undeclared name). The turn did save; the button reset and the startup-error banner appeared. | Uses `toast` and `refreshDueBadge`. |
| 4 | Medium | **A double tap on OK / Again graded a card twice** (two review entries, interval pushed out twice). Skip could skip two cards. | One-grade-per-card guard around the awaited save. |
| 5 | Medium | **Grammar tagging hid sentences permanently.** If the model's batch answer left a number out, that sentence was stored as `grammar: []` — "read, uses nothing" — and never read again. | Only sentences the model answered for get a result. |
| 6 | Medium | **Batch grammar read overwrote concurrent edits.** It saved the copy read before a request that can take a while, losing reviews or edits made meanwhile. | Re-reads each record before writing. |
| 7 | Medium | **Anthropic answers truncated.** `max_tokens: 700` is too small for reading passages and 30-sentence grammar batches; the JSON was cut off and failed to parse. | 4096. |
| 8 | Low | **"Start listening automatically" did nothing.** Review answers became typed-only when skills started rotating (deliberate, and pinned by a test), but the toggle stayed. | Toggle removed. |
| 9 | Low | Discussion could be started twice while the first request ran. | Disabled while in flight; the scenario is restored on failure. |
| 10 | Low | Duplicate keys in `i18n/ja.js`. | Removed (no visible change: the effective values are kept). |
| 11 | Low | Backup download revoked its blob URL synchronously, which can cancel the download in Safari; no confirmation was shown. | Revoked after a delay; status line confirms. |

## UX changes

- **Imports simplified.** One **Import** takes a deck or backup file, or a
  deck URL (GitHub `blob` links become raw links). Removed: the one-click
  AI-team and example-deck buttons. Kept: one optional **Mini Hongo starter**
  seed (Settings, and on an empty Library; Japanese only; withdrawn once
  seeded). The format is now a tested contract: `DECK-FORMAT.md`,
  `decks/example-deck.json`, `decks/deck.schema.json` (replacing `IMPORTS.md`
  and `examples/`), with instructions an AI agent can follow.
- **Empty Library** is an invitation (write a first sentence; starter as the
  secondary option) instead of "No sentences yet.", and hides search and
  filters that cannot do anything yet.
- **Grammar.** The "Find grammar / Refresh grammar" button was injected into
  every Library row, Discussion bubble, Reading line and sheet sentence —
  inside the sentence element, and inside other buttons. It now exists once,
  as "Explain the grammar" on the sentence page: hidden when it cannot run,
  priced in one line, and replaced by its answer. Review answers show saved
  chips only. The automatic setting runs the same analysis, so auto-read
  sentences get highlights too.
- **Library rows** are a single tap target again (words inside the row used
  to open the dictionary instead of the sentence).

## Not changed — worth a decision

- `index.html` reloads the page on service-worker `controllerchange`, which
  `CLAUDE.md` forbids ("never force page reload"). It looks deliberate (it
  prevents mixing module versions), but it can reload mid-review and lose a
  typed answer. Option: defer the reload until the next navigation.
- Reading-mode sentences are `<button>`s containing tappable word spans
  (nested interactive content; screen readers announce it poorly).
- `markPattern` splits rendered ruby HTML on the pattern text, so a short
  kana pattern can also be marked inside a `<rt>` reading.
- `app.js` is 180 KB of dense one-line functions; most bugs above hid there.
  `CLAUDE.md`'s migration rule applies: move logic out as it is touched.
