<!-- Research report produced 2026-10-03 for SPEC.md. Snapshot of the code at commit 0e27c4c; line numbers drift. Scratch paths mentioned below were session-local and are gone. -->

# Echo WORDS subsystem: research map for the Echo Reader spec

## 0. Key facts

- **Dictionary**: `words-data.js` holds 22,953 entries `{id,w,r,k?,en,pos,jlpt?}`. The file is **2,781,377 B raw, 868,868 B gzip (default), 858,822 B gzip -9, 601,727 B brotli q11**. After the 1,073-byte header, the body is valid JSON (`JSON.parse` takes 31 ms in Node). The data is CC BY-SA 4.0 (words-data.js:10-17).
- **Conjugating entries**: 2,125 entries carry a conjugation class that the current matcher's `NEXT` table knows. Another 3,958 are `vs` (suru-nouns), and none of them end in する. 5,744 entries are written in kana (`w===r`).
- **The word sheet is built from five sources**: the dictionary entry; `kindOf(pos)`; coverage/learned state computed over the user's sentences (`srs.state===2`); the notes store (`word:<id>:remember`); and the provider settings, which only enable or disable the buttons.
- **Remember note dependencies**: `writeWordNote` (api.js:214) reaches only api.js and core.js. core.js has no imports. Neither file touches the DOM or has top-level side effects, and both load as ES modules in Node (verified). Three blockers for running it from a userscript on arbitrary sites:
  1. It calls the global `fetch` (api.js:76) and has no `fetchImpl` parameter.
  2. Provider keys never leave Echo's origin, and `exportBackup` strips them (core.js:311-318).
  3. Tampermonkey `@require` cannot load ESM, and a cross-origin `import()` is subject to the host page's CSP.
  
  Live headers on echo.kakkoi.dev could **not** be checked: the sandbox's outbound proxy returned 403.
- **Remember notes are already in the gist backup**: `buildBackup()` includes `forBackup(listNotes())` (app.js:1541). The reader can show existing notes from `echo-backup.json` without any change to Echo.
- **Sync hazard**: Echo never pulls automatically. Restore is manual only (`gistRestore`, app.js:1662-1671). Auto-backup PATCHes the whole file from local state (app.js:1630-1645, gist-backup.js:67-85). Anything a third party writes into `echo-backup.json` is overwritten by Echo's next auto-push unless Echo pulls and merges first.
- **Matcher coverage**: the current matcher (stem plus one following kana) misses a lot. Measured misses include 分からない, きた/こない, 高すぎる, よかった, 食べさせられた, and the surfaces 泳いだ, 言われた and 飲んだ.

---

## 1. Files and roles

| File | Lines | Role | Imports |
|---|---|---|---|
| `words-data.js` | generated | `export const WORDS=[…]`, one JSON object per line | none |
| `tools/build-words-data.mjs` | 168 | Generator from JMdict_e.gz plus `tools/jlpt-vocab/*.csv` | node:fs, node:zlib |
| `japanese-words.js` | 170 | `createJapaneseWordMatcher(WORDS)`, a factory returning `{wordsIn, wordSpans, keysOf}`. It calls itself "Canonical browser Japanese lexical matching. Consumers provide dictionary data." (:1-3) | none |
| `words.js` | 111 | Index, bands, `kindOf`, coverage/learned, marks, imported words | core.js, japanese-words.js, words-data.js (:15-17) |
| `lookup.js` | 121 | `searchWords`, `romajiToKana`, `toHiragana`, `searchKanji`, `searchGrammar` | kanji-readings.js (276 KB), grammar-data.js (108 KB), words-data.js, kanji.js (:5-8) |
| `notes.js` | 57 | IndexedDB notes store and pure shapes | none |
| `api.js` | 327 | Provider calls, `writeWordNote`, `adjustNote`, `shapeWordNote` | core.js only (:1-2) |
| `core.js` | 355 | Furigana and schema helpers, `exportBackup`, Mora mnemonic tables (synced from JP Core, :1-11) | none |

Module sizes (raw / gzip -9): api.js 35,206 / 10,537; core.js 24,358 / 9,651; words.js 5,801 / 2,607; japanese-words.js 9,483 / 3,887; lookup.js 7,538 / 2,995; notes.js 2,814 / 1,207.

---

## 2. Dictionary data (`words-data.js`, `tools/build-words-data.mjs`)

### 2.1 Shape and generation
- **Entry shape**: `{id, w, r, k?, en, pos, jlpt?}`. `id` is the JMdict `ent_seq`, unique, ranging 1000110 to 2848900.
  - `w` is the form you would see. It is the first non-irregular kanji form, or the reading when the word is usually written in kana (build-words-data.mjs:115-118).
  - `k` is the kanji form, present only when the word is usually written in kana (:119).
  - `r` is a single reading (:117).
  - `en` holds up to 3 senses, each up to 3 glosses joined with `"; "` (:121-122).
  - `pos` holds the codes of the **first sense only**, filtered to `KEEP_POS` and capped at 3 (:34, :123).
  - `jlpt` is `"N5".."N1"` or absent (:127).
- **What is included**: common entries (ichi1, news1, spec1, spec2, gai1; :31) plus every entry matched to a JLPT list (:112).
- **Order**: by level (N5 to N1, then entries on no list), then newspaper rank, then reading (:134-135). File order is therefore a usable frequency tie-break.
- **Imported words**: imported catalogue words have **negative ids** (catalogues.js:3, words.js:107-110). They travel in the backup under `catalogues` (app.js:1541). `setImportedWords` mutates the shared `WORDS` array in place, so lookup.js sees them too.

### 2.2 Size
| Measure | Bytes |
|---|---|
| Raw file | 2,781,377 |
| gzip (default) | 868,868 |
| gzip -9 | 858,822 |
| brotli q11 | 601,727 |
| Header comment | 1,073 |
| Minified JSON of the array | 2,757,318 (854,455 gz) |
| Share of the `en` field | ~1,006,422 |

- Load timings in Node: ESM import 182 ms; `JSON.parse` of the body 31 ms; heap about 35 MB after loading and indexing.
- Echo's service worker precaches `./words-data.js` (sw.js:3, `CACHE="jp-echo-v130"`). That cache is same-origin only: the fetch handler returns early for any other origin (sw.js:18-19). It does nothing for a userscript on another site.

### 2.3 Part-of-speech distribution
Counts are entries containing the code; an entry can carry up to 3 codes. "In matcher" means the code has a row in japanese-words.js `NEXT` (:6-11) or the suru branch (:33-36). The Yomitan condition column is the proposed mapping (see §6).

| Code | Entries | In matcher | Yomitan condition | Notes / members |
|---|---|---|---|---|
| v1 | 582 | yes | v1 | |
| v1-s | 1 | yes | v1 | くれる |
| vk | 5 | yes (kanji stem 来 only) | vk | 来る, ついてくる, 連れてくる, 持ってくる, やってくる |
| v5k | 137 | yes | v5 | |
| v5k-s | 5 | yes | v5 | 行く, うまくいく, ついていく, 連れて行く, 持っていく |
| v5g | 37 | yes | v5 | |
| v5s | 280 | yes | v5 | |
| v5t | 26 | yes | v5 | |
| v5n | 1 | yes | v5 | 死ぬ |
| v5b | 18 | yes | v5 | |
| v5m | 153 | yes | v5 | |
| v5r | 410 | yes | v5 | |
| v5r-i | 4 | yes | v5 | ある, ことがある, である, でもある |
| v5u | 134 | yes | v5 | |
| v5u-s | 2 | yes | v5 | 問う, 請う |
| v5aru | 4 | yes | v5 | くださる, いらっしゃる, おっしゃる, なさる |
| vs | 3,958 | no (matched as a plain noun; する found separately) | vs (synthetic: stem + する) | suru-nouns; **0** have `w` ending in する |
| vs-i | 9 | suru branch | vs | する, 全うする, 可能にする, ことにする, 質問をする, しようとする, とする, ような気がする, ようにする |
| vs-s | 37 | suru branch | vs | 愛する, 達する, 関する, 対する … |
| vz | 16 | **no** (whole form only) | vz | 応ずる, 感ずる, 論ずる, 信ずる … |
| adj-i | 322 | yes | adj-i | |
| adj-ix | 5 | yes | adj-i (よ-stem) | いい, かっこいい, 気持ちいい, どうでもいい, 方がいい |
| adj-na | 1,399 | n/a | (な/だ handled as particles) | |
| adj-no | 2,394 | n/a | n/a | |
| vt / vi | 1,049 / 691 | n/a | n/a | transitivity; used by `kindOf` |

Other codes: n 18,911; adv 996; exp 399; n-suf 260; adv-to 181; suf 83; int 77; conj 76; pref 73; adj-f 70; pn 67; prt 62; num 55; ctr 48; adj-pn 31; adj-t 23; n-pref 16; aux-v 11; aux 8; cop 2; aux-adj 2.

- Only **one** entry has two conjugation classes: 湿気る (v5r and v1). One entry has empty `pos`: よし.
- Length of `pos`: 1 code in 13,864 entries, 2 in 7,998, 3 in 1,090. The cap of 3 is hit.

### 2.4 Kana, readings and forms
| Measure | Count |
|---|---|
| `w` is all kana (`w===r`) | 5,744 |
| …of which usually-kana with a kanji form `k` | 1,208 |
| …of which kana with no kanji form | 4,536 |
| `w` hiragana only / katakana only / mixed | 1,488 / 4,238 / 18 |
| `r` contains katakana | 4,425 |
| Conjugating entries written in hiragana | 335 |
| Conjugating entries written with kanji (need the reading to match kana text) | 1,844 |
| Distinct hiragana-normalised readings | 20,159 |
| Largest homophone sets | かん 13, しょう 11, そう/か/とう 10 |
| Distinct written keys (`w` ∪ `k`) | 23,901; 236 shared by more than one entry (後 ×3, 私 ×3, 足 ×2, 時 ×2 …) |
| Longest `w` / longest `r` | 15 / 22 characters |
| `w` containing full-width digits or Latin letters | 81 (１００, ＦＡＸ, １月 …) |

### 2.5 Data-quality problems that affect the reader
1. **Literal HTML entities in glosses.** 898 entries contain 1,165 occurrences of `&#x27;` (for example すみません: "I&#x27;m sorry"). The generator's `unescapeXml` decodes named entities only (build-words-data.mjs:36). Echo renders glosses with `textContent` (`el`, app.js:356; senses at :986), so the sheet shows `&#x27;` literally. The same text goes into the `meaning` field of the `writeWordNote` prompt (app.js:1032).
2. **One form, one reading per entry.** Alternate spellings (解る, 判る) and alternate readings (今日 こんにち) are dropped (build-words-data.mjs:115-119).
3. **`pos` comes from the first sense only, capped at 3** (:123).
4. **Common subset only.** About a tenth of JMdict (:11-12). Rare words will not be found, unlike Yomitan with the full JMdict.

---

## 3. Matching today (`japanese-words.js`, `words.js`)

### 3.1 How it works
- **`keysOf(w, readings=false)`** (japanese-words.js:28-47):
  - Forms are `w`, plus `r` only when `readings` is true and the word conjugates (:31), plus `k` **only if `k` is entirely kanji** (:31).
  - A conjugating form becomes `{key: stem, next: NEXT[conj]}` (:37-38). A two-kana word also keeps its whole form (:41).
  - vs-i and vs-s forms ending in する become stem + `"すしせさ"` (:33-34). する itself becomes し + `"まてたなよ"` (:36).
  - Single-kanji nouns are marked `alone` (must not be inside a kanji run). A word whose only `pos` is `int` is marked `bound` (needs kana-free edges).
- **`NEXT`** (:6-11) is the set of kana allowed right after the stem. Coverage is limited: adj-i allows `いくかけさそ`, so there is no `す` for すぎる.
- **`index()`** (:48-59) builds a `Map<key, hit[]>`, ignoring keys longer than 16 characters.
- **`wordsIn(text)`** (:72-108) scans every start position and length, then applies heuristics:
  - a one-kana stem is accepted only after a kanji, a particle, or て/で (`AFTER_ONE`, :14);
  - a standalone kanji loses to a stem starting at the same position;
  - a kana word may not start on a conjugation ending;
  - overlapping kana hits resolve to the longest, else the earliest;
  - katakana runs stay whole (:16-18, :96).
  
  It returns a **set of ids** with no positions.
- **`wordSpans(text, ids)`** (:135-165) returns surface ranges with ids. It extends a match with `INFLECTION_TAILS` (:114-120) and `extendInflectedSurface` (:121-130). With `ids==null` it loops over **all 22,953 words**, calling `indexOf` for each (:137-141).
- **`words.js`**:
  - `word(id)` (:23); `levelOf` (:24); `bands()` (:32-35).
  - `kindOf` (:39-48) with the `KIND` table: v5* maps to "verb"; vt/vi give "transitive verb"/"intransitive verb"; `vs` gives "する verb"; `adj-no` gives "noun"; at most 2 labels.
  - `sentenceWords` (:61-67) reads `plainTarget`, `plainCasualTarget` and `plainPoliteTarget`, plus the explicit `sentence.vocabulary` ids.
  - `coverage` (:70-81) returns word id → sentence ids, oldest first.
  - `learned` (:85-92) counts words in sentences with `srs.state === 2`.
  - `marks` (:102-104); `setImportedWords` (:107-111).

### 3.2 Performance (Node, measured)
| Operation | Time |
|---|---|
| Create the matcher | 21 ms |
| First `wordsIn` (builds `FORMS`) | 126 ms |
| `wordsIn` on 168 characters | 1.1 ms |
| `wordSpans` over all words, 168 characters | 36 ms |
| `coverage` + `learned` over 1,000 sentences × 3 registers | 110 ms |
| Build the reading map and the written-form map | 64 ms |

### 3.3 Coverage gaps (measured with the live matcher)
| Input | `wordsIn` | `wordSpans` surface → word | Problem |
|---|---|---|---|
| 分からない | 分, から, ない | 分 → 分 | `k`=分かる ignored (not all kanji). 754 of 1,208 `k` forms are ignored this way (分かる, 出来る, 下さい, 可愛い …) |
| きた (来た) | none | きた → 着る | vk kana stems き/こ not modelled |
| こない | ない | ない | same |
| 高すぎる | 高, すぎ | 高 → 高 | adj-i `NEXT` lacks す |
| よかった | よ, か | よか → 良い | irregular いい/よい not handled by `wordsIn` |
| 食べさせられた | 食べる | 食べさ | tails stop at causative-passive |
| 言われた | 言う | 言わ | no passive tail after わ |
| 泳いだ / 飲んだ / 死んだ | correct verb + だ | 泳い / 飲ん / 死ん | `INFLECTION_TAILS` has no `だ` |
| 書けば | 書く, ば | 書け | |
| 静かな | 静か, **かな** | | false positive かな |
| しない | する | しな → 死ぬ / する | ambiguity, ranked arbitrarily |
| 勉強した | 勉強, する | 勉強 \| した | vs noun not joined with する |
| 応じた (vz 応ずる) | — | — | vz not in `NEXT` (応じる exists separately as v1) |

Correct cases include 行った, 読まれる, 来ない (kanji), いらっしゃいます, くださった, 行きたくない, 待った, わかりません and ありません.

Existing regression tests: test/words.test.js:22-90 (kindOf, stems, false positives, marks, coverage, おります/おきます spans, the ランボー katakana run). All 26 tests in words, notes and api pass.

### 3.4 `lookup.js`
- `toHiragana` uses `[ァ-ヶ]` (lookup.js:15); core.js's `toHiragana` uses `[ァ-ヴ]` (core.js:102-104). The two are slightly inconsistent.
- `romajiToKana` (:39-54) covers Hepburn and kunrei basics, っ by doubling, ん by rule, and `-` → ー. It returns null for non-romaji input.
- `searchWords(q)` (:96-121) has three modes:
  - CJK in the query: exact / prefix / contains on `w` and `k`.
  - Kana or romaji: exact / prefix / contains on `toHiragana(w.r)`, **recomputed for every entry on every query** (:106), a linear scan with no index.
  - Otherwise English: gloss match tiers.
  
  It returns up to 60 results (`WORD_LIMIT`, :94). It does no deinflection and is not a text scanner.

---

## 4. The word sheet (`openWord`, app.js:977-1000)

The markup is the `#word-dialog` element on index.html:31; that file is mostly one long line. Entry points:
- the band list and search rows (app.js:459, :949);
- Practise next/previous (:964-976);
- the vocabulary tap in a sentence (`openVocabularyHit`, :1505-1521);
- the route `/words/<id>` (routes.js:8, :43; app.js:1787).

`/words/<id>` is a deep link the reader pane can use to open the sheet in Echo.

| Sheet element | DOM id | Value and source | Code |
|---|---|---|---|
| JLPT chip | `#word-level` | `w.jlpt`; blank for `"+"` | app.js:981; words.js:24 |
| State chip | `#word-state` (`data-state`) | `learned` if the word appears in a sentence with `srs.state===2`; else `met` (label "in a sentence") if coverage has sentence ids; else `unmet` ("not met yet") | app.js:979, :982; labels :360; words.js:70-92 |
| Kind chip | `#word-kind` | `kindOf(w)` | app.js:983; words.js:39-48 |
| Title | `#word-title` | `w.w` | app.js:984 |
| Reading | `#word-reading` | `w.r`; empty when `r===w` | app.js:984 |
| Also written | `#word-also` | "Also written {kanji}" from `w.k`; hidden otherwise | app.js:985 |
| Senses | `#word-senses` (`<ol>`) | one `<li>` per `w.en` item, via `textContent` | app.js:986 |
| Meta line | `#word-meta` | "In N of your sentences · learned, since one of them reached review" / "not learned yet…" / "Not in any of your sentences yet" | app.js:987-989; `inYours` :363 |
| Your sentences | `#word-mine-head`, `#word-sentences` | sentences from the coverage ids, highlighted with `marks(w)` | app.js:995-997 |
| Say a sentence | `#word-say`, `#word-mic`, `#word-say-go` | `composeFromIntent` → `saveWordSentence` → `saveSentence` (library) | app.js:990-994, :1039-1049, :1059-1063 |
| Let Echo write one | `#word-compose` | `compose()` | app.js:1050-1058 |
| Echo's note (collapsed `<details id="word-more">`, "Written by Echo · you can change it") | `#word-note` `.note-text`, `.note-note` | note `word:<id>:remember`. The `.note-note` line shows the echo line or the yours line depending on `note.by` | app.js:1003-1027; lines :1017-1018 |
| Ask button and hint | `#word-note-ask`, `#word-note-hint` | shown only when there is no note; disabled without a translator | app.js:1007-1008, :1028-1037 |
| Note management | `.adjust-panel`: Rewrite (instruction plus mic), Edit manually / Save edit, Generate fresh, Delete, Reset to Echo's | `noteBlock` (app.js:808-831); blur-save turned off for word notes (:1021); delete (:1024); regenerate (:1025) | |
| Learn nav | `#word-learn-nav` | only during band Practise | app.js:957-963 |

- "Has translator" means the chosen provider has a key, or a `localEndpoint` for local (app.js:298-299).
- Provider keys live in localStorage `jp-echo-settings` on Echo's origin (app.js:49-50).
- The existing dictionary-choice dialog (app.js:1505-1521, "Vocabulary: w（r） — en[0]" plus "Ask AI for the meaning in this sentence") is the closest existing Echo UI to the reader pane.

---

## 5. Notes store and the remember note

- **Storage**: IndexedDB database `jp-echo-notes`, store `notes`, `keyPath: "key"` (notes.js:7, :13-14).
- **Record** (`makeNote`, notes.js:42-44):
  ```
  {key:"word:<id>:remember", kind:"word", id:<number w.id>, part:"remember",
   text:string, echo:string|null /* Echo's original, for Reset */, made:ISO, by:"echo"|"you"}
  ```
- **Writes** go through the app wrappers `putNote` and `deleteNote` (app.js:43-44), which call `markBackupDirty` (:1622). That follows CLAUDE.md's wrapper rule.
- **Backup**: `forBackup` drops `part==="examples"` (notes.js:46). Remember notes are therefore included in `buildBackup` (app.js:1541) and are in `echo-backup.json` today.
- **Merge**: `mergeNotes` (notes.js:49-57) keeps the newer record by `made`, and keeps records that exist on only one side. **Deletions do not propagate**: a deleted note returns after a restore from a backup that still has it. Merge runs only in `importBackupData` (app.js:1582), which is reached from manual restore or import.
- **Product rule**: a note is written **only when asked**, "not when the sheet opens" (app.js:1001-1002, :1007; hint "One request on your key"). Generating notes automatically for words sent from the reader would change this rule.

---

## 6. Dependency graph of `writeWordNote`

```
app.js:1032 / :1025  writeWordNote({word:w.w, reading:w.r, meaning:w.en.join(" / "), kind:kindOf(w)},
                                   {...settings, targetLang})
  └─ api.js:214-223 writeWordNote(word, settings)
       ├─ api.js:87-95  chosenProvider(settings)          reads settings.provider, providerKeys, apiKey (legacy DeepSeek),
       │    └─ api.js:73 PROVIDER_DEFAULTS                providerModels, localEndpoint; throws if no key/endpoint
       ├─ core.js:340-354 moraMnemonicTokens(reading)
       │    ├─ core.js:102-104 toHiragana  (NFKC first, :341)
       │    ├─ core.js:339 moraAnchor → MORA_MNEMONICS (:321), MORA_VOICED (:336)
       │    └─ MORA_SMALL_Y (:337), MORA_YOON_BASES (:338)  (ー and unknown kana dropped; っ doubles next)
       ├─ core.js:355 moraMnemonicPrompt() → MORA_MNEMONICS
       ├─ api.js:184 NOTE_RULES
       ├─ api.js:96-100 ask(text, system, chosen, settings)
       │    ├─ provider "google"    → api.js:78 gemini()            (x-goog-api-key)
       │    ├─ provider "anthropic" → api.js:82 anthropicRequest()  (anthropic-dangerous-direct-browser-access; ANTHROPIC_MAX_TOKENS :81)
       │    └─ otherwise            → api.js:77 openAICompatible()  (deepseek/openai; local uses settings.localEndpoint)
       │         all → api.js:76 fetchJson() → global fetch;  api.js:75 jsonText()
       └─ api.js:207-213 shapeWordNote(raw, expectedAnchors) → api.js:185 NOTE_FORBIDDEN
            (requires raw.anchors to equal the token images exactly; up to 2 attempts; "rules"/"anchors" errors retry)
  then app.js:1034 makeNote(...) → app.js:43 putNote → notes.js:29 + markBackupDirty
Caller-side inputs: words.js:43 kindOf (KIND :39-42)
Adjust: app.js:808-831 noteBlock → api.js:226-238 adjustNote({about:"w（r） (en[0])", kind:"A way to remember it", current, instruction})
        → chosenProvider, ask, NOTE_RULES, NOTE_FORBIDDEN
```

The pure code needed is about 7.7 KB of api.js (lines 73-100, 184-185, 207-238) and 6.5 KB of core.js (lines 102-104, 320-355). `settings.targetLang` is passed in but `writeWordNote` does not use it.

Tests pinning this behaviour:
- test/api.test.js:45 (frozen anchors), :47 (prompt content), :49 (exact reading, long vowels), :51 (anchor substitution retried);
- test/core.test.js:96-105 (yōon fusion and っ);
- test/notes.test.js:40-45 (`shapeWordNote`);
- test/session-regressions.test.js:10-16 (regeneration starts from word data; blur-save disabled; delete key).

### 6.1 Can api.js and core.js be loaded as ES modules from https://echo.kakkoi.dev?

| Question | Finding |
|---|---|
| Import graph closed? | **Yes.** api.js imports only `./core.js` (api.js:1-2); core.js imports nothing. Relative resolution gives `https://echo.kakkoi.dev/core.js`. |
| Side-effect free at import? | **Yes.** No `window`, `document`, `localStorage`, `indexedDB` or `navigator` in either file (grep). `FileReader` appears only inside `blobBase64` (api.js:275). Node imports both directly; verified, and the tests do the same. |
| Hosting | GitHub Pages deploys the repo root (.github/workflows/pages.yml, `path: .`; CNAME `echo.kakkoi.dev`). Pages normally sends `Access-Control-Allow-Origin: *` and a JavaScript MIME type, which a cross-origin module import needs. **Unverified**: the sandbox proxy returned 403. |
| Tampermonkey `@require` | **Cannot load these files**: `export` is a syntax error in a classic script. The same applies to `words-data.js`, though its body can be fetched and parsed as JSON after stripping the header (§2.2). |
| `import()` from a userscript | In the page context, the host's CSP `script-src` applies, and many sites will block it. The isolated or USER_SCRIPT world behaviour is **unverified**. Echo's service worker does not serve cross-origin requests, so this would not work offline. |
| Provider calls | Hard-wired to the global `fetch` (api.js:76), with no injection point. gist-backup.js, by contrast, takes `fetchImpl` (gist-backup.js:67, :89). On arbitrary pages the host's `connect-src` can block the call. Provider CORS is already permissive for Echo's own origin; Anthropic needs the header api.js:82 sends. |
| Credentials | Keys exist only in Echo-origin localStorage (app.js:49-50, :298). `exportBackup` strips `apiKey`, `providerKeys`, `speechKeys`, `gistToken` and `gistUrl` (core.js:311-318). The backup does carry `provider`, `providerModels` and `localEndpoint`. Option (b) therefore needs the user to enter a provider key into the userscript, creating a second credential store. |

---

## 7. How a reading index could be built

1. **Keys**, built at load time; it costs about 64 ms in Node, so nothing needs to ship. Use one `Map<string, Entry[]>` (or two maps) over:
   - `w`;
   - `k` **always**, not only when entirely kanji, which fixes 分かる and 出来る;
   - `toHiragana(r)`.
   
   Normalise keys with NFKC (for the 81 full-width entries) and fold katakana to hiragana. The map has about 20,159 reading keys and 23,901 written keys. Keep the file index to rank by Echo's frequency order.
2. **Scan**: from the cursor, try prefixes from longest to shortest, capped at about 24 characters (longest `r` is 22). For each prefix, generate deinflection candidates `{text, conditions}`, look each candidate up in the map, and accept an entry when the candidate has no conditions or the conditions intersect the entry's mapped `pos`. This is Yomitan's `conditionsMatch`: `current===0 || (current & next)!==0` (yomitan `ext/js/language/language-transformer.js:179-181`).
3. **Map JMdict codes to Yomitan condition names**. Yomitan's part-of-speech flags are keyed by condition name (language-transformer.js:85, :94-96; ja/japanese-transforms.js:66-199), so the codes must be normalised first:
   - v1, v1-s → v1
   - all v5* (including v5k-s, v5r-i, v5u-s, v5aru) → v5
   - vk → vk
   - vs-i, vs-s → vs
   - vz → vz
   - adj-i, adj-ix → adj-i
   
   Plain `vs` nouns need a synthetic rule: a candidate ending in する with condition vs also looks up the stem among entries tagged `vs` (勉強した → 勉強).
4. **Ranking**: longer source match first, then fewer transforms, then file index (JLPT level, then frequency).
5. **Regression cases**: the table in §3.3 is a ready-made test list.
6. **Licence**: Yomitan is GPL-3.0. webmods is MIT (/home/user/webmods/LICENSE). jp-echo has no LICENSE file at its root; README discusses data licences. Porting Yomitan's transform tables verbatim would bring GPL obligations, so a clean reimplementation from conjugation rules avoids that. `words-data.js` carries CC BY-SA 4.0 attribution and share-alike wherever it is redistributed.

---

## 8. Facts relevant to the open questions and sync

- **Where the remember note is generated**:
  - **(a) Echo writes it and it syncs back** works with today's code: the notes are in the backup, and `mergeNotes` takes the newer record. Three conditions apply:
    - Echo must pull and merge before pushing; today it never does (§0).
    - Something in Echo must trigger generation for words saved from the reader, which changes the "only when asked" rule (app.js:1001-1002).
    - The pane shows no note for a new word until Echo has run.
  - **(b) The script generates it** needs a classic-script or bundled copy of the §6 subset (or a `fetchImpl` hook added to api.js, as gist-backup.js already has), plus a user-supplied key.
  - **Suggested default (my recommendation, not decided)**: make (a) the baseline and offer (b) as opt-in. For (b), Echo would publish a generated, tested non-ESM bundle of `writeWordNote` and the lookup functions, `@require`d by the script, so there stays one implementation. Echo would also gain an optional `fetchImpl` so the script can route calls through `GM_xmlhttpRequest`.
- **Shared or script-only deinflection**: japanese-words.js already describes itself as the canonical, data-agnostic matcher (:1-3), and words.js coverage has the measured gaps in §3.3. A shared Echo module with tests in `test/words.test.js` would fix both. It should not go into core.js, which is synced from JP Core (core.js:1-11).
- **Word identity for "saved words"**:
  - Ids are JMdict `ent_seq` (positive) or catalogue ids (negative).
  - `word(id)` returns null for an id the current data lacks (words.js:23), for example after a JMdict regeneration drops an entry. A saved word should therefore keep a snapshot such as `{id, w, r}`.
  - Today the only user data that stores word ids is `sentence.vocabulary`, which is merged by union (core.js:294) and validated in imports.js:13, plus the note keys.
- **Sentence merge**: `mergeSentences` dedupes by `sentenceIdentity`, which ignores furigana, uses NFKC, and drops whitespace for Japanese (core.js:269-300). It never deletes.

## 9. Not verified
- Live HTTP headers on echo.kakkoi.dev (CORS, MIME type, compression); the sandbox's proxy refused the connection (403).
- How dynamic `import()` and `fetch` behave inside Tampermonkey's isolated or USER_SCRIPT world under a strict host CSP.
- Browser-side parse and index timings. All timings above are from Node 22 on this machine.

Scratch scripts used for the measurements: /tmp/claude-0/-home-user/e904e747-ac00-5e4e-b979-80da5b6df905/scratchpad/posstats.mjs and /tmp/claude-0/-home-user/e904e747-ac00-5e4e-b979-80da5b6df905/scratchpad/bench.mjs