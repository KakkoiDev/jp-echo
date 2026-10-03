# Echo Reader — specification (draft)

> **Status: draft, paused 2026-10-03.** No code has been written yet. The
> research behind this draft is done for Echo's library, words, notes and
> backup, for the GitHub gist API, and for Yomitan's lookup engine. Not done
> yet: a read of webmods' conventions beyond `CLAUDE.md`, live checks of
> echo.kakkoi.dev's headers (the sandbox proxy blocked them), and an
> adversarial review of this draft. §14 says how to resume.
>
> Companion research, with file:line citations:
> [`research-library.md`](research-library.md) (library, persistence, backup,
> merge) and [`research-words.md`](research-words.md) (dictionary, matcher,
> word sheet, notes, the `writeWordNote` dependency graph).

---

## 0. Summary

**Echo Reader** is a Tampermonkey userscript in `webmods`
(`scripts/echo-reader.user.js`) that works on **every site**. Hold a key and
hover over Japanese text, or select it, and a pane opens. The pane shows the
word as Echo's word sheet shows it: level, state, kind, word, reading, other
spelling, meanings, and Echo's AI note *A way to remember it*. One button
saves the word to **Echo's Library**. Saved words travel to Echo through the
**GitHub gist Echo already uses for backup**.

Lookup works the way Yomitan's does: it scans the longest match first, takes
conjugations back to the dictionary form, and checks the part of speech. It
uses Echo's own dictionary (`words-data.js`) and a **new conjugation table
written for Echo**. Yomitan is GPL-3.0, so its tables are not copied.

### Decisions

| # | Decision | Source |
|---|---|---|
| D1 | The card is the word-sheet data (`openWord`, app.js:977-1000), including the AI remember note | user |
| D2 | Every word sent from the reader goes to Echo's **Library** | user |
| D3 | Sync goes through the existing gist. User's preference: pull, merge, push; or, if safer, separate files that are always all pulled, with duplicates removed on pull | user |
| D4 | Runs on all sites (`@match *://*/*`) | user |
| D5 | Lookup quality similar to Yomitan's, conjugations included | user |
| R1 | Saved words get **their own IndexedDB store** (`jp-echo-words`), keyed by dictionary word id; never a record type inside `sentences` | recommended, awaiting confirmation |
| R2 | Sync uses **one gist file per writer**: Echo writes `echo-backup.json`, and each reader install writes `echo-reader-<device>.json`. Every reader pulls all of them and merges deterministically. | recommended (the user's "safer" option, made strict) |
| R3 | The remember note is written **by Echo**, at the reader's explicit request, and syncs back. Writing it inside the pane is a later milestone (M8). | recommended, awaiting confirmation |
| R4 | The conjugation engine is a **shared Echo module** (`deinflect.js`). Echo's own word matching moves onto it too. | recommended, awaiting confirmation |
| R5 | The script reuses Echo code through a **generated classic-script bundle** (`reader-core.js`) built from Echo's modules, never a hand copy | recommended |

---

## 1. Why this belongs in Echo's loop

Echo's loop is **mean → shape → hear → say → retrieve → use**. Reading on the
open web is where a learner *meets* words. Today those words are lost unless
they are typed into Echo by hand. The reader turns "I just met this word" into
Echo material in one action. Words stay **material for production**: a saved
word is not reviewed as a flashcard. It invites the learner, on the word sheet
in Echo, to *say a sentence using it* (`sayForWord`, app.js:1039-1049) or to
let Echo write one (app.js:1050-1058). That sentence then enters review the
normal way. This keeps the CLAUDE.md rule that review grades only Listening,
Reading and Writing of sentences, and it matches DESIGN-BRIEF.md:22-23 ("the
library is made of things the learner actually wanted to say").

User stories:
1. Reading a news site, I hold **Shift** over 食べさせられなかった and see 食べる
   with "causative · passive · negative · past", its meanings, its N-level,
   and whether it is already in my sentences.
2. I tap **Save to Echo**. The pane says *Saved*, then *Synced* a few seconds
   later.
3. The next time Echo opens, the word is in **Library → Saved words**, with the
   sentence I found it in and a link to the page.
4. If I asked for it, Echo writes *A way to remember it*. The next time I hover
   that word anywhere, the pane shows the note.
5. On the word sheet in Echo, I say a sentence with the word, and it starts
   being practised.

---

## 2. Architecture

```
 any web page (all sites)                         echo.kakkoi.dev (PWA)
┌──────────────────────────────────┐            ┌─────────────────────────────────┐
│ echo-reader.user.js  (webmods)   │            │ app.js ── Library: Saved words  │
│  scanner → EchoReaderCore.lookup │            │   │        word sheet: Save ✓    │
│  pane (shadow DOM, Echo tokens)  │            │ saved-words.js (IDB jp-echo-words)│
│  sync: GM_xmlhttpRequest         │            │ deinflect.js / japanese-words.js │
│                                  │            │ reader-sync.js (pull+merge)      │
│ @require  reader-core.js  ◄──────┼── built ───┤ tools/build-reader-core.mjs      │
│ @resource words-data.js   ◄──────┼── served ──┤ words-data.js                    │
└──────────────┬───────────────────┘            └──────────────┬──────────────────┘
               │ PATCH own file only                           │ PATCH echo-backup.json only
               ▼                                               ▼
        ┌──────────────────── secret GitHub gist ─────────────────────┐
        │ echo-backup.json            (writer: Echo)                  │
        │ echo-reader-<deviceA>.json  (writer: reader install A)      │
        │ echo-reader-<deviceB>.json  (writer: reader install B)      │
        └─────────────────────────────────────────────────────────────┘
          every reader GETs the gist once: all files come back together
```

**One action, one implementation.** Lookup, deinflection, the saved-word
record shape, the merge rules and (in M8) note writing exist **once**, in
Echo's ES modules. `tools/build-reader-core.mjs` wraps them into
`reader-core.js`, a classic script exposing one global, `EchoReaderCore`.
Tampermonkey `@require`s it from `https://echo.kakkoi.dev/reader-core.js`. A
test rebuilds the bundle and fails when it differs from the committed file,
the same pattern `test/deck-format.test.js` uses to keep DECK-FORMAT.md honest.
The userscript owns only scanning, the pane, settings and the gist transport.

Why a bundle and not `import()` from echo.kakkoi.dev: Tampermonkey's
`@require` cannot load ES modules, because `export` is a syntax error in a
classic script. A runtime `import()` runs under the host page's CSP
`script-src`, which many sites restrict (research-words §6.1). `@require` and
`@resource` are fetched by Tampermonkey itself, cached at install and update
time, and are not subject to page CSP.

---

## 3. Lookup engine (Echo: `deinflect.js`; reader: scanner)

### 3.1 Dictionary index (`EchoReaderCore.buildIndex(WORDS)`)
- **Source:** `words-data.js`. It has 22,953 entries `{id,w,r,k?,en,pos,jlpt?}`,
  ordered by level, then frequency (build-words-data.mjs:134-135), and is
  2.78 MB raw. The reader gets it with `@resource WORDS
  https://echo.kakkoi.dev/words-data.js` and `GM_getResourceText`. It strips the
  header and `export const WORDS=` up to the first `[`, and the trailing `;`,
  then `JSON.parse`s the rest (31 ms in Node).
- **Keys:** one `Map<string, Entry[]>` over:
  - `w`;
  - `k`, **always**. Today's matcher ignores 754 `k` forms such as 分かる and
    出来る (research-words §3.3);
  - `toHiragana(r)`, after NFKC.
  
  That is about 23,901 written keys and 20,159 reading keys. Building it takes
  about 64 ms in Node.
- **Laziness:** the reader parses and indexes **only on the first lookup in a
  tab**, never at page load. All sites pay nothing until the reader is used.
- **Data fixes first:** 898 glosses contain a literal `&#x27;`
  (research-words §2.5). Fix `unescapeXml` in `tools/build-words-data.mjs` to
  decode numeric entities, regenerate the file, and add a test that no gloss
  matches `/&#?\w+;/`.

### 3.2 Scan (reader)
1. **Start point.**
   - Hover: `document.caretPositionFromPoint` (Firefox) or
     `caretRangeFromPoint` (Chrome) gives the text node and offset under the
     pointer.
   - Selection: the selection's start, with its text as the query.
2. **Collect text.** Gather up to **24 characters** forward: the longest
   reading is 22 characters, and Yomitan's default is 16. Walk across adjacent
   inline text nodes in document order.
   - Skip `<rt>` and `<rp>` (furigana) and read the ruby base.
   - Stop at block boundaries, at `\n`, and at characters that cannot be part
     of a word (`。、！？「」『』()（）` and spaces).
3. **Preprocess variants** (original code; the ideas are standard):
   - NFKC: full-width Latin and digits, half-width katakana to full-width.
   - Katakana to hiragana, only for reading-key lookups.
   - Collapse emphasis: repeated っ, and repeated ー after a vowel.
   - Romaji to kana, only for selection queries, reusing `romajiToKana` from
     `lookup.js`.
4. **Longest first.** For `len` from 24 down to 1, take `text.slice(0,len)`.
   Run deinflection (§3.3) on each variant, then look each candidate up in the
   index (§3.4).
5. **Stop** at the first `len` that gives any accepted entry, after also
   collecting entries for the same `len` from other variants. Report
   `matchedLength = len` for highlighting.

### 3.3 Deinflection: model
This follows Yomitan's *model*, not its code or tables. Yomitan reference
points: `language-transformer.js` `transform()`, `conditionsMatch()`;
`translator.js` `_getAlgorithmDeinflections()`.

- **Rule:** `{from, to, in, out, name}`. If the text ends with `from`, and the
  text's current conditions are 0 or intersect `in`, the result is
  `text.slice(0,-from.length)+to` with conditions `out`. The trace records
  `name`.
- **Breadth-first:** apply every rule to every result until nothing new
  appears, with cycle protection on `(text, ruleIndex)` and a depth limit of 8.
- **Condition flags (bitset):**

| Flag | Meaning | JMdict `pos` codes that carry it |
|---|---|---|
| `v1` | ichidan verb | v1, v1-s |
| `v5` | godan verb | v5k, v5k-s, v5g, v5s, v5t, v5n, v5b, v5m, v5r, v5r-i, v5u, v5u-s, v5aru |
| `vk` | くる | vk |
| `vs` | する verb (whole word ends in する) | vs-i, vs-s |
| `vz` | ずる verb | vz |
| `adj-i` | い-adjective | adj-i, adj-ix |
| `masu` | polite ます form (intermediate) | none |
| `te` | て/で form (intermediate) | none |

- **Accepting a match:** a candidate `{text, conditions}` matches entry `e`
  when `conditions===0` (the text was not transformed) or
  `conditions & flags(e.pos) !== 0`.
- **する nouns:** for the 3,958 plain `vs` nouns (none ends in する), a
  candidate `Xする` with `vs` in its conditions also looks up `X` among
  entries whose `pos` includes `vs`. 勉強しています → 勉強する → **勉強**.
- **Stems are generated, not listed.** The table is
  `godan ending × stem row × attachment`, so it is compact, original and
  checkable:

| Godan ending | i-row (連用) | a-row (未然) | e-row (仮定・命令) | o-row (意向) | past/te (音便) |
|---|---|---|---|---|---|
| う | い | わ | え | お | った / って |
| く | き | か | け | こ | いた / いて (**行く: った / って**) |
| ぐ | ぎ | が | げ | ご | いだ / いで |
| す | し | さ | せ | そ | した / して |
| つ | ち | た | て | と | った / って |
| ぬ | に | な | ね | の | んだ / んで |
| ぶ | び | ば | べ | ぼ | んだ / んで |
| む | み | ま | め | も | んだ / んで |
| る | り | ら | れ | ろ | った / って |

Special cases:
- v5u-s (問う, 請う) take the past/te form うた / うて.
- v5aru (くださる, いらっしゃる, おっしゃる, なさる) take い as their i-row
  (くださいます) and imperative (ください).
- v5r-i ある has the negative ない, which is its own dictionary entry; no rule
  is needed.

Stems of v1 and the irregular verbs, by attachment:

| Class | Stem (i / a) | Negative | Past / te | Potential | Passive | Causative | Volitional | Imperative | ば |
|---|---|---|---|---|---|---|---|---|---|
| v1 (食べる) | 食べ | 食べない | 食べた / 食べて | 食べられる, 食べれる | 食べられる | 食べさせる | 食べよう | 食べろ, 食べよ | 食べれば |
| vk (来る / くる) | 来, き / 来, こ | こない | きた / きて | こられる, これる | こられる | こさせる | こよう | こい | くれば |
| vs (する) | し / し, さ, せ | しない, せず | した / して | (できる is its own word) | される | させる | しよう | しろ, せよ | すれば |
| vz (ずる) | じ | じない | じた / じて | — | じられる | じさせる | じよう | じろ | ずれば |

### 3.4 Deinflection: attachment table

Each row is expanded mechanically over every stem in §3.3. A result with
condition `—` is terminal: the rule applies only to untransformed text.

| Name (trace label) | Surface (attaches to) | Base condition (`out`) | Surface condition (`in`) |
|---|---|---|---|
| polite | i-stem + ます | v1/v5/vk/vs/vz | `masu` |
| polite past / negative / negative past / volitional | ました, ません, ませんでした, ましょう → ます | `masu` | — |
| negative | a-stem + ない (v1: stem + ない; する: しない; くる: こない) | class | `adj-i` |
| negative (classical) | a-stem + ず, ずに, ぬ, ん (する: せず, せぬ) | class | — |
| must (colloquial) | a-stem + なきゃ, なくちゃ, なければ (the last via the adj-i ば rule) | class | — |
| past | 音便 + た/だ (v1: stem + た) | class | — |
| conditional | 音便 + たら/だら | class | — |
| -tari | 音便 + たり/だり | class | — |
| te | 音便 + て/で | class | `te` |
| progressive | て + いる/る (ている, てる, でいる, でる) | `te` | `v1` |
| -shimau | て + しまう; ちゃう/じゃう; ちまう/じまう (each → て/で) | `te` | `v5` |
| -oku | て + おく; とく/どく (→ て/で) | `te` | `v5` |
| want | i-stem + たい | class | `adj-i` |
| while | i-stem + ながら | class | — |
| looks like | i-stem + そう (adj-i: stem + そう; いい → よさそう) | class / `adj-i` | — |
| too much | i-stem + すぎる (adj-i: stem + すぎる) | class / `adj-i` | `v1` |
| polite command | i-stem + なさい | class | — |
| provisional | e-stem + ば (v1 + れば; する → すれば; くる → くれば) | class | — |
| potential | e-stem + る (v5); v1 + られる / れる; くる → こられる / これる | class | `v1` |
| passive | a-stem + れる (v5); v1 + られる; する → される; くる → こられる | class | `v1` |
| causative | a-stem + せる (v5); v1 + させる; する → させる; くる → こさせる | class | `v1` |
| short causative | a-stem + す (飲ます) | `v5` | `v5` |
| volitional | o-stem + う (v5); v1 + よう; しよう; こよう | class | — |
| imperative | e-stem (v5); v1 + ろ / よ; しろ / せよ; こい; くれる → くれ | class | — |
| adj past | かった → い | `adj-i` | — |
| adj te | くて → い | `adj-i` | `te`¹ |
| adj negative | くない → い | `adj-i` | `adj-i` |
| adj adverbial | く → い | `adj-i` | — |
| adj provisional | ければ → い | `adj-i` | — |
| adj noun | さ → い | `adj-i` | — |
| adj conditional | かったら → い | `adj-i` | — |
| いい / よい | よかった, よくない, よくて, よければ, よく, よさそう → いい | `adj-i` | as the rows above |

¹ `te` on an adjective chains only into rules whose `in` includes `te`. The
`te` auxiliaries (progressive, -shimau, -oku) do not make sense after
adjectives, so the reverse chain never fires: their `in` is `v1`/`v5` and
their `out` is `te`.

Chains come out of composition. Examples:
- 食べさせられなかった: adj past (なかった → ない) → negative (られない →
  られる) → passive (させられる → させる) → causative (させる → る) → 食べる.
- 飲まされた: past → passive (される → す, `v5`) → short causative (ます → む)
  → 飲む.

### 3.5 Ranking
Sort accepted entries by:
1. `matchedLength`, longest first;
2. untransformed matches before transformed ones;
3. fewer rules in the trace;
4. a match on written form (`w`/`k`) before a match on reading, when the query
   contains kanji;
5. file order (JLPT level, then frequency).

Merge duplicates by entry id. When the same entry arrives through several
traces, keep the shortest trace.

### 3.6 Required regression cases (`test/deinflect.test.js`)

| Surface | Expected entry | Trace |
|---|---|---|
| 食べさせられなかった | 食べる | causative · passive · negative · past |
| 書いて | 書く | te |
| 行った | 行く (v5k-s) | past |
| 来なかった / こなかった | 来る | negative · past |
| きた | 来る (also 着る, ranked after) | past |
| しませんでした | する | polite negative past |
| 読める | 読む | potential |
| 高くなかった | 高い | adj negative · past |
| 静かだった | 静か | none (the prefix scan finds 静か) |
| 見せてもらった | 見せる | te (もらった is the next word) |
| 勉強しています | 勉強 (vs) | polite · progressive · te |
| 飲みたくない | 飲む | want · negative |
| 言わなきゃ | 言う | must |
| 分からない | 分かる (via `k`) | negative |
| 高すぎる | 高い | too much |
| よかった | いい | adj past |
| 泳いだ / 飲んだ / 死んだ | 泳ぐ / 飲む / 死ぬ | past |
| 書けば | 書く | provisional |
| 応じた | 応じる; 応ずる also listed | past |
| 問うた | 問う | past |
| いらっしゃいます | いらっしゃる | polite |
| ください | くださる; 下さい | imperative |
| 食べちゃった | 食べる | -shimau · past |
| 読んでる | 読む | progressive · te |
| 見よう / 行こう | 見る / 行く | volitional |
| 飲ませる / 飲まされた | 飲む | causative / short causative · passive · past |
| 静かな | 静か (**not** かな) | none |

These cases also fix today's coverage gaps in `japanese-words.js`
(research-words §3.3): Echo's word counts on the Words page get better too.

### 3.7 Sentence context
From the hit, walk backwards and forwards through the same text-collection
walker until a terminator: `。！？!?`, a line break, or a block boundary.
Keep 「」 and 『』 balanced. Use at most 120 characters each way, and skip
furigana. The result is the saved word's context sentence.

### 3.8 Known gaps compared with Yomitan
- **Coverage:** 23k common words against Yomitan's ~200k JMdict.
- **One reading per entry:** alternate spellings and readings are dropped
  (build-words-data.mjs:115-119).
- **No names** (JMnedict) and no kanji-character lookups in v1. Echo's kanji
  sheet exists and could be linked later.
- **No pitch accent and no frequency lists.**

---

## 4. Data model: saved words (Echo)

### 4.1 Record
```json
{
  "id": 1358280,
  "w": "食べる",
  "r": "たべる",
  "lang": "ja",
  "savedAt": "2026-10-03T10:00:00.000Z",
  "updatedAt": "2026-10-03T10:00:00.000Z",
  "removedAt": null,
  "from": "reader",
  "noteRequested": true,
  "contexts": [
    {"text": "子どもに野菜を食べさせられなかった。", "url": "https://example.com/news/123", "title": "Example news", "at": "2026-10-03T10:00:00.000Z"}
  ]
}
```

- **`id`**: the dictionary word id: the JMdict `ent_seq` (positive), or a
  negative id for an imported catalogue word. `w` and `r` are a snapshot, so
  the row still renders if an id disappears in a future data build
  (words.js:23 returns null for an unknown id).
- **`from`**: `"reader"` or `"echo"` (saved from the word sheet).
- **`noteRequested`**: the learner asked for *A way to remember it*. Echo
  clears it once the note exists (§6).
- **`contexts`**: at most 5, newest first.
  - `text`: up to 240 characters, plain, furigana stripped.
  - `url`: `http(s)` only, at most 500 characters, **origin + path only**: the
    query and hash are dropped because they often carry personal tokens.
  - `title`: up to 120 characters.
  
  The reader has a setting to save the sentence only, with no URL or title.
- **`removedAt`**: a tombstone, so un-saving survives merges (§5.4).

### 4.2 Storage: `saved-words.js` (new module)
- Its own IndexedDB database, `jp-echo-words` v1, store `words`, keyPath `id`.
  This follows the existing pattern of one database per kind of data: notes,
  import recovery. It never touches the `sentences` store, its migration, or
  the service worker's due counter (research-library §6, Option A).
- **Pure functions**, tested in Node:
  - `makeSavedWord(entry, {context, from, noteRequested, now})`;
  - `mergeWords(a, b)` (§5.4);
  - `validateSavedWords(list)`: integer id, string caps, `isLanguage(lang)`,
    http(s) URLs. One bad record is dropped with a reason, never the whole
    file (unlike decks).
- **IDB functions:** `listWords`, `getWord`, `putWord`, `replaceWords`.
- **Write path:** add `saveWord` and `removeWord` wrappers to `app.js`, next to
  the existing ones (app.js:34-45). They await the database call, then
  `markBackupDirty()`. Add their names to the wrapper-shape regex in
  `test/gist-backup.test.js:92-97`. Add a `saveWord` action in `actions.js`
  with an injectable `save`, following `saveDiscussionTurn` (actions.js:6).

### 4.3 Backup
- `buildBackup()` stays the **only** producer (CLAUDE.md). It becomes
  `{...exportBackup(...), catalogues, words: await listWords()}`, and words
  are added the way `catalogues` already is. The regex in
  `test/gist-backup.test.js:99-103` still matches.
- **No `SCHEMA_VERSION` bump.** A bump would make every older build reject
  the file (imports.js:5). `validateDeckBackup` passes unknown top-level keys
  through (imports.js:17). `core.js` is synced from JP Core and stays
  untouched.
- `importBackupData` gets a `mergeWords` step after notes (app.js:1582), so
  file import, URL import and gist restore all carry words.
- DECK-FORMAT.md: add `words` to *What a deck must not contain*, and extend
  the forbidden-keys list in `test/deck-format.test.js:68-72`.
- Credentials: words carry none. Add a test that `buildBackup` output
  contains no key named like `token`, `key` or `gistUrl`.

### 4.4 Interaction with review and coverage
- **Review and SRS:** no change. A saved word is not a card.
- **Word state:** the sheet's states become **saved**, **met**, **learned**
  and **unmet**. Saved means saved, with no sentence yet. Met and learned still
  come only from sentences (words.js:70-92). `STATE_LABELS` (app.js:360) gains
  "Saved".

---

## 5. Sync protocol over the gist

### 5.1 Facts about the gist API (checked in GitHub's OpenAPI description)
- `PATCH /gists/{id}`: "Files from the previous version of the gist that
  aren't explicitly changed during an edit are unchanged." Writing only your
  own file is therefore safe.
- `PATCH` takes **no conditional-write parameter** (no If-Match). Two writers
  of the same file can silently lose each other's updates.
- `GET /gists/{id}` returns **every file** in one response. Content over about
  1 MB comes back `truncated`; read `raw_url` instead. Echo's
  `downloadBackup` already does this (gist-backup.js:89-106).
- History: `GET /gists/{id}/commits` and `GET /gists/{id}/{sha}` give every
  earlier version, so a bad write can be recovered.
- Rate limit: 5,000 authenticated requests an hour; the reader uses a handful.

### 5.2 Why one file per writer, not pull-merge-push on a single file
Echo's automatic backup **overwrites** `echo-backup.json` from local state and
never reads first (app.js:1630-1645). Restore is only a manual button
(app.js:1662-1671). Three things follow from that:
1. If the reader wrote into `echo-backup.json`, Echo's next automatic upload
   would erase the words. Echo would have to pull and merge before every
   push.
2. Even then, **every older cached Echo build** on any device would keep
   pushing blindly and erasing them (research-library §7.4).
3. With no If-Match, pull-merge-push by two writers still has a lost-update
   window.

With **one writer per file**, none of this can happen: no write can destroy
another writer's data. Pulling stays one `GET`, because the gist returns all
files together. That is the user's "two files, always pull both, remove
duplicates" option, extended to one file per reader install, so that two
browsers running the reader never share a file either.

### 5.3 Files
- `echo-backup.json`: unchanged owner (Echo). Gains `words` (§4.3).
- `echo-reader-<device>.json`, where `<device>` is a random 12-character id
  that each reader install generates once and keeps in GM storage:
```json
{
  "format": "echo-reader",
  "version": 1,
  "device": "k3v9q2m7x1ab",
  "label": "Firefox · laptop",
  "updatedAt": "2026-10-03T10:00:05.000Z",
  "words": [ /* SavedWord records, §4.1 */ ],
  "notes": [ /* M8 only: Note records {key,kind,id,part,text,echo,made,by} */ ]
}
```

### 5.4 Merge (`mergeWords`: pure, deterministic, in `saved-words.js`, shipped in `reader-core.js`)
Records are keyed by `id`. For two records of the same id:
- **The winner** is the one with the greater `updatedAt`. On a tie, the one
  with non-null `removedAt` wins. On a further tie, the lexicographically
  greater `JSON.stringify` wins, so every device reaches the same result.
- **Fields:**
  - `w`, `r`, `lang`, `from` and `removedAt` come from the winner;
  - `savedAt` is the earliest;
  - `noteRequested` is OR-ed, but only while the record is not removed;
  - `contexts` are unioned by `text + url`, sorted by `at` descending, and
    capped at 5.
- **Re-saving after a removal** writes a new `updatedAt`, which clears
  `removedAt`.
- **Tombstones are kept.** They are small. Garbage collection is an open
  question (§13).

Notes use the existing `mergeNotes` (notes.js:49-57): the newer `made` wins.

### 5.5 Who writes what, and when

**Reader install:**
1. **Pull:** on the first lookup in a tab, at most once every 60 s, and right
   before every push.
2. **Read:**
   - `echo-backup.json`, for words, notes and sentences, which give the pane
     its *saved / met / learned* state and the remember notes;
   - its own device file;
   - other `echo-reader-*.json` files, so that two browsers see each other's
     saves before Echo has absorbed them.
3. **Write:** only its own file.
   - Content = merge(own pending, own file).
   - Then **prune** every record that `echo-backup.json` already holds with
     `updatedAt` ≥ the record's own. Echo has absorbed it.
   - Push is debounced 3 s after a save.
   - Pending saves sit in GM storage and survive offline periods and closed
     tabs.
   - Cross-tab: tabs coordinate through `GM_addValueChangeListener`, with one
     push lock held in GM storage and a 30 s expiry.

**Echo** (`reader-sync.js`, new):
1. **Pull:**
   - at launch, when the app becomes visible, and before every automatic
     upload;
   - only when a gist is configured; it uses the existing token and needs no
     new credential;
   - one GET, which reuses `downloadBackup`'s transport, refactored to return
     every file.
2. **Merge:** fold every `echo-reader-*.json`'s `words` (and, from M8,
   `notes`) into local, through the `saveWord` / `putNote` wrappers. That
   marks the backup dirty, and the next upload carries the words. Readers then
   prune.
3. **Never** write to `echo-reader-*` files.
4. **Never** auto-merge `echo-backup.json` from other Echo devices. That would
   resurrect deleted sentences, because sentences have no tombstones. Two-way
   sync between Echo devices is out of scope here (§13).

### 5.6 Failures and their UI
| Failure | What the user sees |
|---|---|
| No gist configured | Pane footer: *Connect Echo* → reader settings |
| 401 or 403 | *GitHub refused the token*, with the reason, reusing the wording in gist-backup.js `failure()` |
| 404 | *Gist not found* |
| Offline | Saves queue; the footer shows *N waiting to sync* |
| Truncated file | Read through `raw_url` (handled) |

In Echo, Settings → Backup shows *Reader: last merged N words, time* next to
the existing gist status line.

---

## 6. The AI remember note

- **Today** the note is written only when asked (app.js:1001-1002), on the
  user's own key, which lives only in Echo's localStorage. `exportBackup`
  strips every credential (core.js:311-318).
- **R3 (default):**
  - The reader's Save has a checkbox, on by default: **Ask Echo for a way to
    remember it**. It sets `noteRequested: true`. Ticking it is the ask, so
    the "only when asked" rule holds.
  - After a merge, Echo writes notes for saved words that have
    `noteRequested`, have no note yet, and have a translator configured. It
    writes them **one at a time**, at most 10 per launch, through the existing
    `writeWordNote` and the wrapped `putNote`. It then clears `noteRequested`.
  - The notes reach the gist in the next backup. The pane reads them from
    `echo-backup.json` → `notes` → `word:<id>:remember`.
  - Until then, the pane says *Echo will write this the next time you open
    it.*
- **M8 (optional): the note written in the pane.**
  - `api.js` gains an optional `fetchImpl` setting, the way gist-backup.js
    already takes one (gist-backup.js:67, 89). The script passes a
    `GM_xmlhttpRequest` adapter, which avoids page CSP and CORS.
  - `writeWordNote`, `adjustNote` and their closure (about 14 KB of api.js and
    core.js, research-words §6) go into `reader-core.js`, so the prompt is
    still Echo's own.
  - The provider key has to be entered into the reader's settings: a second
    credential store, kept in GM storage only. It never goes into a gist file.
  - The note syncs back through the device file's `notes`.

---

## 7. Reader pane: UX and visuals

### 7.1 Triggers
| Platform | Trigger |
|---|---|
| Desktop | Hold **Shift** (configurable: Shift, Alt, or off) and move the pointer. Yomitan users expect this. |
| Touch, or as an alternative | Select text, and a small seal button **引** appears next to the selection; tap it. |
| Keyboard | `Alt+R` toggles the pane; `↑`/`↓` move between entries; `S` saves; `Esc` closes. |

Nothing runs until the first trigger in a tab.

### 7.2 Layout
| Viewport | Layout |
|---|---|
| ≥ 720 px wide | A pane fixed to the right, 360 px wide, full height, overlaid (no reflow) |
| Narrow | A bottom sheet up to 60 vh, which never covers the hovered line: it moves to the top when the hit is in the lower half |

- **Highlight:** absolutely positioned boxes from `range.getClientRects()`,
  inside the reader's own host. The page's DOM is never changed, per
  webmods' "overlay without reflow" rule.
- **Isolation:** one host element `<echo-reader>` holding a **closed shadow
  root**, so page CSS can't reach in and the reader's CSS can't leak out.

### 7.3 Content per entry (mirrors `openWord`; same order, same words)
1. A chip row:
   - JLPT level;
   - state: Saved, In a sentence, Learned, or Not met yet;
   - kind (from `kindOf`);
   - and in the reader only, the trace in small caps: *causative · passive ·
     past*.
2. The title (`w`) in `--display`, with its reading.
3. *Also written …*.
4. Senses as an `<ol>`.
5. *In N of your sentences*, when the pulled backup has sentences that contain
   the word (worked out with Echo's matcher from the bundle).
6. **A way to remember it**: the note text with *Echo's / Yours* attribution,
   or the pending line, or nothing.
7. The context sentence, with the word marked the way Echo marks
   `.review-vocab`.
8. Actions:
   - **Save to Echo**, which turns into *Saved ✓ · Remove*;
   - **Open in Echo**, which opens `https://echo.kakkoi.dev/words/<id>`;
   - **Hear**: `speechSynthesis` with a `ja-JP` voice and Echo's default rate.

### 7.4 Visual language (Echo's, not a generic popup)
- **Tokens:** `tools/build-reader-core.mjs` extracts the `:root` custom
  properties from `styles.css` (light, plus the dark `@media` and
  `[data-theme]` blocks). It ships them as a CSS string in `reader-core.js`,
  so the pane uses `--washi`, `--panel`, `--sumi`, `--ink-muted`,
  `--hairline`, `--rule`, `--seal`, `--display` and `--ui`. There is one source
  of colour truth, and no raw colours in the script.
- **Fonts:** Shippori Mincho and Zen Kaku Gothic New, through one Google Fonts
  `<link>` added to `document.head` on first open. `@font-face` does not work
  inside a shadow root. If page CSP blocks it, the font stacks fall back to the
  system serif and sans-serif.
- **Echo's own visuals, reused:**
  - chips → `.status-chip`;
  - word rows → `.point-row`;
  - the note → `.note-text` / `.note-note`;
  - buttons → Echo's quiet buttons;
  - Save → the seal accent.
  
  No gradients, no pills, no shadows beyond the ones Echo already has.
- **Dark mode:** follows `prefers-color-scheme`, with an override in the
  reader's settings.
- **Accessibility:** the pane is `role="dialog"` with `aria-label="Echo
  Reader"`. Focus moves into it only when it is opened by keyboard or tap,
  never on hover. Every action is a real `<button>`. No required action
  depends on hover.

### 7.5 States
- **First run:** dictionary loading (about 0.3 s, once per tab).
- **No match:** *Not in Echo's 23,000 common words.* plus an *Ask Echo* link
  to `/words?q=<text>`.
- **Not connected:** *Connect Echo to save words*.
- **Saving, saved, synced, waiting to sync, error.**

---

## 8. Userscript packaging (webmods)

```javascript
// ==UserScript==
// @name         Echo Reader
// @namespace    http://tampermonkey.net/
// @icon         https://echo.kakkoi.dev/favicon.ico
// @version      0.1.0
// @description  Hover Japanese on any site: Echo's dictionary, conjugations understood, one tap to save the word to your Echo library.
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getResourceText
// @connect      api.github.com
// @connect      gist.githubusercontent.com
// @resource     WORDS https://echo.kakkoi.dev/words-data.js
// @require      https://echo.kakkoi.dev/reader-core.js
// ==/UserScript==
```

Dev loader. Fill it in from the final header when the script is created; the
path follows docs/DEVELOPMENT.md:12.
```javascript
// ==UserScript==
// @name         DEV: Echo Reader (local)
// @namespace    http://tampermonkey.net/
// @icon         https://echo.kakkoi.dev/favicon.ico
// @version      0.0.1
// @description  dev loader
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getResourceText
// @connect      api.github.com
// @connect      gist.githubusercontent.com
// @resource     WORDS https://echo.kakkoi.dev/words-data.js
// @require      https://echo.kakkoi.dev/reader-core.js
// @require      file:///Users/cyril.antoni/Code/webmods/scripts/echo-reader.user.js
// ==/UserScript==
```
- While developing against an Echo branch, point `reader-core.js` and
  `words-data.js` at the local Echo checkout with `file:///` URLs.
- `@noframes` keeps v1 simple. Running inside frames, with the pane posted to
  the top frame, is M8.
- **Before committing the `@icon`**, check it per webmods' CLAUDE.md: `curl`
  must return `200` and an `image/*` type. The sandbox's proxy blocked
  echo.kakkoi.dev, so this has not been checked yet.
- **GM storage keys:**
  - `er.token`: a fine-grained GitHub PAT with only **Gists: read and write**;
  - `er.gist`: the gist URL or id, parsed with `parseGistId` from the bundle;
  - `er.device`, `er.deviceLabel`;
  - `er.pending`, `er.lock`;
  - `er.cache.backup`: words, notes and the sentence texts needed for state,
    plus `updated_at`;
  - `er.prefs`: trigger key, theme, save-URL toggle, note-request default.
- **Settings:** a menu command, *Echo Reader settings*, opens a settings view
  inside the pane: gist, token, device label, and *Test connection*.
  Credentials have their own explicit **Save**, and preferences commit on
  `change`. This mirrors Echo's rule that `saveSettings` never touches
  credentials. There is no save-on-blur.
- **Release:**
  - `node tools/gen-readme.mjs` runs through the pre-commit hook.
  - After the push, run `node skills/greasyfork/scripts/release.mjs` and
    `verify.mjs` (webmods CLAUDE.md). A push alone does not publish.
- **Chrome extension:** not in v1. If wanted later, it is generated from the
  `.user.js` per docs/EXTENSIONS.md. Inline `reader-core.js`, because MV3
  forbids remote code, and use `world: "ISOLATED"`.
- **Licence:** webmods is MIT. `words-data.js` is CC BY-SA 4.0, and the
  script's README must carry the EDRDG attribution. No Yomitan code or tables
  are used.

---

## 9. Echo-side changes, file by file

| File | Change | Tests |
|---|---|---|
| `tools/build-words-data.mjs`, `words-data.js` | Decode numeric entities (`&#x27;`) | No gloss matches `/&#?\w+;/` |
| `deinflect.js` (new) | Stem and attachment generator, conditions, `deinflect(text)` returning `[{text, conditions, trace}]`, `posFlags(pos)` | `test/deinflect.test.js`: §3.6 table, cycles, depth |
| `japanese-words.js` | Use `deinflect` plus an index over `w`, `k` and `r` for `wordsIn` and `wordSpans`, removing the `NEXT` / `INFLECTION_TAILS` heuristics | The existing `test/words.test.js` passes, plus the §3.3 gap cases in research-words |
| `lookup.js` | `lookupAt(text)`: longest-match scan with ranking (§3.2, §3.5), shared by the reader and, later, Echo's own search | `test/lookup.test.js` |
| `saved-words.js` (new) | §4.2 | `test/saved-words.test.js`: make, validate, merge (tie, tombstone, re-save, contexts cap, determinism) |
| `reader-sync.js` (new) | Pull all `echo-reader-*.json`, merge through wrappers, note requests (§5.5, §6) | `test/reader-sync.test.js` with a fake `fetchImpl` |
| `gist-backup.js` | `downloadBackup` also returns `files` (all reader files, reading `raw_url` when truncated) | `test/gist-backup.test.js` |
| `app.js` | `saveWord` and `removeWord` wrappers; `buildBackup` adds `words`; `importBackupData` merges words; library *Saved words* row and list; word sheet Save / Remove, saved state and contexts; `openWord` syncs the route (fixes research-library §7.1); empty states; Settings → Backup reader line | `test/ux-library.test.js`, `test/gist-backup.test.js` (wrapper regex, `buildBackup` regex), `test/routes.test.js` |
| `routes.js` | `/library?filter=words` (round-trips already: routes.js:23, 39). Add `<option value="words">` to `#history-filter`, or use a `.library-tool` row. Pick one (§13). | `test/routes.test.js` |
| `index.html`, `styles.css` | The saved-words list reuses `.point-row`. A saved state chip `data-state="saved"` reuses `.status-chip` with existing tokens only. | `test/design-handoff.test.js`: no raw colours |
| `actions.js` | `saveWord` action with an injectable `save` | `test/actions.test.js` |
| `tools/build-reader-core.mjs` (new), `reader-core.js` (generated) | IIFE bundle exposing `EchoReaderCore {buildIndex, lookupAt, deinflect, kindOf, levelOf, makeSavedWord, mergeWords, mergeNotes, noteKey, parseGistId, coverage, tokensCss}` (M8 adds `writeWordNote` and `adjustNote`) | `test/reader-core.test.js`: rebuild equals the committed file; the bundle loads under `vm` with no `export` |
| `sw.js` | Add new modules to `ASSETS`; bump `CACHE` (currently `jp-echo-v130`) and the `styles.css?v=` query | `test/pwa.test.js` |
| `package.json` | Add the new modules to `check` | none |
| `DECK-FORMAT.md` | Forbid `words` in decks | `test/deck-format.test.js` |
| `COMPONENTS.md`, `CLAUDE.md` | Document: the saved-word record and its single write path; one gist file per writer and that Echo never writes reader files; `reader-core.js` is generated, never edited | none |

---

## 10. Security and privacy

- **Token:**
  - a fine-grained PAT with **only** Gists read and write, kept in
    Tampermonkey storage, which page scripts cannot read;
  - sent only to `api.github.com`, which `@connect` enforces;
  - never logged, never written to any gist file.
- **What leaves the device:** only what the user saves: the word, its
  contexts, and requested notes, into their own **secret** gist. A secret gist
  is readable by anyone who has its URL, which is why Echo already strips
  `gistUrl` from exports. Contexts drop the query and hash, and there is a
  sentence-only mode.
- **Untrusted page text:** the context and the matched text are rendered with
  `textContent` only, never `innerHTML`. On Echo's side, imported contexts are
  validated (§4.2), rendered with `textContent` / `escapeText`, and their
  language goes through `safeLanguage`, per CLAUDE.md.
- **All sites:**
  - zero work before the first trigger;
  - no network calls except on save, sync, or the first pull after a lookup;
  - Tampermonkey's per-site toggle disables it;
  - the script never reads form fields or password inputs. The scanner skips
    `input[type=password]` and anything with `autocomplete` set to a
    credential type.
- **Supply chain:** `@require` and `@resource` come from Echo's own origin,
  which the same user controls. Tampermonkey re-fetches them on update.
  Optionally, pin them with `#sha256=` once they are stable.

---

## 11. Test plan

- **Echo unit tests (`node --test`):**
  - `deinflect` (§3.6);
  - `lookupAt` ranking;
  - `mergeWords`: tombstone, tie-break, contexts, determinism under argument
    order (`merge(a,b)` deep-equals `merge(b,a)`);
  - `validateSavedWords`;
  - `reader-sync` against a fake gist with two device files, one truncated;
  - `buildBackup` shape and no credentials;
  - deck format forbidding `words`;
  - `reader-core` bundle in sync with the modules;
  - `pwa` cache list.
- **Reader (webmods):** a headless Puppeteer page per docs/EXTENSION-TESTING.md
  and DEVELOPMENT.md. Inject `reader-core.js` and the script with
  `page.evaluate`, against a fixture page with:
  - ruby furigana;
  - each §3.6 surface;
  - a strict CSP meta tag;
  - an open shadow root;
  - a narrow viewport.
  
  Take screenshots of the pane in light, dark and mobile. Test gist sync
  against a stub server that serves `/gists/{id}`.
- **Manual checks:** NHK News Web Easy (ruby), syosetu (long vertical text),
  Wikipedia JA, a site with a strict CSP (github.com); first-run timing; save
  → open Echo → the word is in the Library → the note is written → hover again
  → the note appears.

---

## 12. Delivery plan (one PR each, each useful alone)

| M | Repo | Scope | Done when |
|---|---|---|---|
| M1 | jp-echo | `deinflect.js` + `lookup.lookupAt` + `japanese-words.js` moved onto it + gloss entity fix | §3.6 table green; the Words page counts the gap cases; all 335 existing tests pass |
| M2 | jp-echo | `saved-words.js`, wrappers, `buildBackup.words`, import merge, DECK-FORMAT | Merge and validation tests; a backup round-trip keeps words and tombstones |
| M3 | jp-echo | Library *Saved words* list; word sheet Save / Remove, contexts, saved state; `openWord` route sync | UX and route tests; light, dark and narrow screenshots |
| M4 | jp-echo | `reader-sync.js` + `downloadBackup` files + Settings line | Fake-gist tests; manual: a hand-written `echo-reader-x.json` in a test gist appears in the Library |
| M5 | jp-echo | Notes for `noteRequested` words | Test with a fake provider |
| M6 | jp-echo | `tools/build-reader-core.mjs` → `reader-core.js` (with tokens CSS) | Bundle sync test; loads in `vm` |
| M7 | webmods | `echo-reader.user.js`: scanner, pane, settings, device-file sync; dev loader; README; Greasy Fork release and verify | Puppeteer fixture passes; manual round-trip with Echo |
| M8 | both | Notes written in the pane (`fetchImpl` + bundle `writeWordNote`); frames; text inside inputs; optional Chrome extension | Per item |

---

## 13. Open questions and risks

1. **R1 to R4 need the user's confirmation** (see the decision table).
2. **The Library entry point:** a `Saved words · N` `.library-tool` row, which
   is quiet and fits "discoverability lives in empty states", or a `words`
   option in the *Cards* filter, which is cheaper but puts words among card
   states. The recommendation is the row, opening `/library?filter=words`.
3. **Should a saved word appear in Practise** (the Words band walk) before
   others? Not in v1.
4. **Tombstone garbage collection:** keep forever (small), or drop tombstones
   older than 180 days once every reader file has been pruned of the id.
5. **Two-way sync between Echo devices** (phone and desktop) has the same
   blind-overwrite problem today. It is out of scope; it needs sentence and
   note tombstones first.
6. **Not verified, because the sandbox proxy blocked it:**
   - echo.kakkoi.dev's headers (MIME type of `reader-core.js` / `words-data.js`,
     the favicon);
   - Tampermonkey's caching size limit for a 2.8 MB `@resource`. The fallback
     is a `GM_xmlhttpRequest` fetch, cached in GM storage, compressed.
7. **First-lookup cost per tab:** parse and index are about 100 ms in Node.
   This needs a check on a mid-range phone. The fallback is a prebuilt compact
   index shipped as a second `@resource`.
8. **Quality:** without a morphological parser, short kana words can still
   mis-segment (しない → 死ぬ as well as する). Ranking puts the more common
   word first; the pane lists all candidates.

---

## 14. How to resume

1. Read this file, then the two research reports beside it.
2. Get the user's answers to §13.1 and §13.2.
3. Finish the missing research:
   - webmods conventions: docs/DEVELOPMENT.md, PUBLISHING.md, EXTENSIONS.md,
     EXTENSION-TESTING.md, and `scripts/webmods-annotate.user.js` (its gist
     plugin is what `gist-backup.js` mirrors), plus how
     `scripts/slack-ai-translate.user.js` stores an AI key;
   - live headers of echo.kakkoi.dev, from a machine without the proxy block.
4. Run an adversarial review of this spec. Use three lenses: sync and
   security; the Echo constitution and UX; lookup correctness, by hand-running
   §3.6 against §3.3 and §3.4.
5. Start with M1. It is self-contained, fully testable in Node, and also
   improves Echo's Words page.
