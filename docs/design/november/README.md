# Echo — November design pass: easy access and mora helpers

The design for this pass is finished and measured. This page records where it
lives, what the owner decided, and what is still open, so the implementation
PRs can be checked against one place.

## Sources

| What | Where | Use |
| --- | --- | --- |
| Brief and owner answers | [Echo — Designer handoff: easy access and mora helpers](https://claude.ai/artifact/WaRBRceAcNzkpn37zymcqf) | The problems, the reach targets and the owner's answers (7 Nov) |
| Design canvas | [Echo — redesign canvas](https://claude.ai/artifact/GvfDGGMseigok2pDxrKCBZ) | Only the two bottom rows: "Easy access — Brief 1" and "Mora memory helpers — Brief 2" |
| Design system | [Echo Design System](https://claude.ai/artifact/5KU1QLyQHsanMMttrfndY6) | Tokens, components and rules (`project/README.md`, `tokens.json`, `components/*/README.md`) |

The artifacts are private to the owner until shared from each page's Share menu.

Boards used, each with a `*Dark` twin:

- **Brief 1:** AccessMap, PracticeFirst, PracticeReturning, ReviewHomeFirst, LibraryTools, Search, Notes, SentenceFocus, SentenceMenu, DesktopLibraryTools.
- **Brief 2:** AnchorAudit, WordNote, MoraCompact, MoraVoiced, Drill, DrillAnswer, DrillDone, DesktopMora.

The repo stays the source of truth for existing behaviour (`CLAUDE.md`,
`COMPONENTS.md`, `styles.css`). Where a board and the repo disagree on a token
or a primitive, the repo wins and the PR says so.

## Owner answers (7 Nov)

| Question | Answer |
| --- | --- |
| Top five features | Keep the order in "Echo in one page": practice loop, review, Echo's note, word/kanji/grammar sheets, Radio. Mora and import follow. |
| "Or practise another way" | Move. Discussion, Reading and Extract join Radio, Kanji/Words/Grammar and Mora in one tools home. Practice keeps one compact link to it. Update the rule in CLAUDE.md. |
| Mora drill | Free practice. It is not scheduled and never adds to the Review badge. |
| Emoji or drawn icons | Designed with emoji first and compared on a sample of six. Since decided: the owner's drawn anchor set replaces emoji (below). |
| ん | Try another anchor. The audit proposes 2–3 concrete, pleasant options; the owner picks. |

## Decided for implementation

- Three tabs stay: Practice, Review, Library. Settings stays a gear.
- **One tools home.** Library gets a ToolShelf of six glyph tiles: 話 Discussion · 読 Reading · 本 Extract · 夜 Radio · 学 Kanji/Words/Grammar · 音 Mora. Practice keeps one "話読本 Other ways to practise" row that links to it (`/library#tools`).
- **Review home is action first.** Start review sits directly under the due count. From 7 pm, 夜 Radio appears beside it as an outlined button. The skill mix, counts and Stats move below.
- **One search.** A magnifier in every tab header opens `/search` for sentences, words and kanji, with `?q=` kept in the URL.
- **Notes front door.** A 記 row in Library with your newest noted words, and `/words?notes=1`.
- **The sentence page** has two actions up front, Play the loop and "Tell Echo what to change". Everything else goes in the existing MenuSheet (⋯).
- **Library filters** fold into one FilterButton that opens a sheet with Cards, Sort and Direction. Progress is one meter line.
- **Mora** has four sections (Base · Voiced · Combined · Specials) behind a segmented control, with `?section=` in the URL and a `#<kana>` anchor per cell. Giant ゛ and balloon ゜ use one corner mark everywhere.
- **Echo's note** gets an AnchorStrip: the reading's anchors in order, each linking to its Mora cell.
- **The mora drill** at `/mora/drill` is free practice. It is never scheduled and never touches the Review badge or FSRS.
- **Pictures.** The owner's drawn anchor set replaces emoji in the Mora table, the strip and the drill, with a light set and a dark set switched by theme. The "Emoji" toggle becomes "Pictures".
- Every existing route stays and survives reload and back/forward. Only entry points move.

New reusable primitives, added to `components.js` and `COMPONENTS.md` before
any screen uses them: **ToolShelf, HeaderSearch, AnchorStrip, FilterButton.**

## Not yet decided — do not ship

- The anchor replacements on AnchorAudit: よ→鎧, れ→レモン, ち→地図, ん→判子, そ→蕎麦, こ→駒. `MORA_MNEMONICS` stays at version 4; `core.js`, JP Core and the AI validator are unchanged. The alternate pictures are kept for the owner's decision, not shipped.
- Redraws of や, め and つ (outlined in red on the audit sheet). The files ship as they are.

## PR sequence

1. docs — this page and the CLAUDE.md rule
2. primitives — ToolShelf, HeaderSearch, FilterButton, AnchorStrip
3. library — tools shelf, 記 notes row, FilterButton, progress line, `/words?notes=1`
4. practice + review — returning Practice, the 話読本 row, action-first Review home with evening Radio
5. search — `/search` and the header magnifier on every tab
6. sentence page — two actions up front, the rest in the MenuSheet
7. mora — anchor pictures (light and dark), sections, corner marks, Pictures toggle, AnchorStrip in Echo's note
8. drill — `/mora/drill`, one round, misses repeat at the end, no scheduling
9. desktop — sidebar Tools group and search
