# Japanese kanji meaning families — Core 76

[Import this deck into Echo](https://echo.kakkoi.dev/) under **Settings → Your sentences → Import**. Either download [kanji-families-core.json](kanji-families-core.json) or paste its direct GitHub raw URL:

```text
https://raw.githubusercontent.com/KakkoiDev/jp-echo/main/decks/kanji-families-core.json
```

The file follows [DECK-FORMAT.md](../DECK-FORMAT.md), schema version 2, and provides **228 distinct sentences** across **76 kanji meaning families**. Each sentence enters Echo's usual listening, reading and writing reviews **once**; there are no duplicated review-mode cards.

Each `kanjiFamilies` record gives:

- `kanji`: the semantic family **parent** (e.g. `発`), not necessarily a standalone word
- `meaning`: a compact organizing idea, not an exhaustive dictionary definition
- `dictionaryRadical`: the Japanese printed form of its indexing radical (e.g. `癶` for `発`, or `氵` for `法`)
- `dictionaryRadicalName`: an English mnemonic for the radical
- `exampleSentenceId`: the parent/anchor example sentence
- `words`: one anchor entry and two derived words, each including its correct word reading and linked `exampleSentenceId`

To see the target sentences, look up the word's `exampleSentenceId` in the top-level `sentences` list. Some words appear in an inflected form inside their examples; the canonical headword is preserved under `words[].term`. Furigana is inserted for unambiguous whole written kanji compounds; remaining readings are intentionally omitted rather than guessed. Echo can add contextual readings separately.

**Important:** The current Echo importer preserves the normal sentence cards and does not yet persist or display `kanjiFamilies` as a navigable family tree. The extra field is metadata for future dictionary/UI integration. It is intentionally outside the importer's sentence records: no fake review state, note fields, grammar records or scheduling properties are introduced.

Dictionary radicals and semantic roots are **different things**. For example, `未` has the indexing radical `木`; nevertheless, its vocabulary family centers on the meaning of `未` (not yet). Likewise, `発` is indexed under `癶`; it is not a claim that `癶` supplies the meaning of every derived word.

## Validation

```sh
npm test
node --input-type=module -e "import {validateDeckBackup} from './imports.js'; import fs from 'node:fs'; console.log(validateDeckBackup(JSON.parse(fs.readFileSync('decks/kanji-families-core.json','utf8'))).sentences.length)"
```

These sentences are original learning examples intended for general N5–N2 exposure, not a statistically ranked 76-item frequency index. The list is a starter set, not the proposed eventual 200–300-family corpus.
