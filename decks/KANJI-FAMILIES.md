# Japanese kanji meaning families — Core 76

[Import this deck into Echo](https://echo.kakkoi.dev/) under **Settings → Your sentences → Import**. Either download [kanji-families-core.json](kanji-families-core.json) or paste its direct GitHub raw URL:

```text
https://raw.githubusercontent.com/KakkoiDev/jp-echo/main/decks/kanji-families-core.json
```

The file follows [DECK-FORMAT.md](../DECK-FORMAT.md), schema version 2, and provides **235 distinct sentences** across **76 kanji meaning families**. Each sentence enters Echo's usual listening, reading and writing reviews **once**; there are no duplicated review-mode cards.

Each `kanjiFamilies` record gives:

- `kanji`: the semantic family **parent** (e.g. `発`), not necessarily a standalone word
- `meaning`: a compact organizing idea, not an exhaustive dictionary definition
- `dictionaryRadical`: the Japanese printed form of its indexing radical (e.g. `癶` for `発`, or `氵` for `法`)
- `dictionaryRadicalName`: an English mnemonic for the radical
- `exampleSentenceId`: the parent/anchor example sentence
- `words`: any number of words with prepared example sentences, each with the reading and linked `exampleSentenceId`. The older 76-family starter happened to provide at least three, but the live curriculum does not enforce a fixed minimum or maximum.

To see the target sentences, look up the word's `exampleSentenceId` in the top-level `sentences` list. Some words appear in an inflected form inside their examples; the canonical headword is preserved under `words[].term`. Furigana is inserted for unambiguous whole written kanji compounds; remaining readings are intentionally omitted rather than guessed. Echo can add contextual readings separately.

**Important:** Importing this standalone starter deck adds its ordinary sentence cards only. The live **Library → Kanji → Kanji families** screen now has a separate 206-family curriculum and displays **all matching words** from Echo’s already-bundled dictionary, with no artificial three-word or pagination cap. Authored example cards remain opt-in and are never generated automatically for every dictionary match. The `kanjiFamilies` metadata is not imported into personal SRS records.

Dictionary radicals and semantic roots are **different things**. For example, `未` has the indexing radical `木`; nevertheless, its vocabulary family centers on the meaning of `未` (not yet). Likewise, `発` is indexed under `癶`; it is not a claim that `癶` supplies the meaning of every derived word.

## Validation

```sh
npm test
node --input-type=module -e "import {validateDeckBackup} from './imports.js'; import fs from 'node:fs'; console.log(validateDeckBackup(JSON.parse(fs.readFileSync('decks/kanji-families-core.json','utf8'))).sentences.length)"
```

These sentences are original learning examples intended for general N5–N2 exposure, not a statistically ranked 76-item frequency index. The list is a starter set, not the proposed eventual 200–300-family corpus.
