# Echo deck format

An Echo **deck** is one JSON file of sentences to practise. Import one in
**Settings → Your sentences → Import**, either by choosing the file or by
pasting a URL to it. Importing merges: nothing already in the library is lost,
and progress on sentences you already have is kept.

This page is the contract. It is written for people and for AI agents asked to
make a deck. Three things in this repository hold it in place, and the tests in
`test/deck-format.test.js` keep them in step with the importer:

- this page, including the example below, which the tests import;
- [`decks/example-deck.json`](decks/example-deck.json), a complete deck;
- [`decks/deck.schema.json`](decks/deck.schema.json), a JSON Schema
  (draft 2020-12) for validators and for agents that can use one.

---

## The shape

```json
{
  "schemaVersion": 2,
  "title": "Ordering at a café",
  "description": "Ten short things to say in a Japanese café. Beginner.",
  "sentences": [
    {
      "id": "cafe-ja-001",
      "sourceLang": "en",
      "targetLang": "ja",
      "source": "One iced coffee, please.",
      "target": "アイスコーヒーを一【ひと】つください。"
    },
    {
      "id": "cafe-ja-002",
      "sourceLang": "en",
      "targetLang": "ja",
      "source": "Can I pay by card?",
      "target": "カードで払【はら】える？",
      "casualTarget": "カードで払【はら】える？",
      "politeTarget": "カードで払【はら】えますか。"
    }
  ]
}
```

### Deck fields

| Field | Required | Meaning |
|---|---|---|
| `schemaVersion` | yes | Always `2`. |
| `sentences` | yes | A non-empty array of sentences. |
| `title` | no | Deck name. |
| `description` | no | What it covers, and for whom. |

### Sentence fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Stable and unique, with no spaces, and prefixed for this deck: `cafe-ja-001`. |
| `source` | yes | What the sentence means, in the learner's own language. |
| `target` | yes | **One complete, natural sentence** in the language being learned. |
| `sourceLang` | recommended | A language code. Omitted means `en`. |
| `targetLang` | recommended | A language code. Omitted means `ja`, so always set it for any other language. |
| `casualTarget` | no | Japanese only: the casual form. Defaults to `target`. |
| `politeTarget` | no | Japanese only: the polite form. Defaults to `target`. The learner chooses per sentence which one to review. |
| `updatedAt` | no | ISO 8601 time. Set a newer one to replace a sentence already imported under the same `id` (see *Updating a deck*). |

Language codes are the ones in `LANGUAGES` in `core.js` (also the `enum` in the
schema): `ja`, `en`, `es`, `fr`, `de`, `it`, `pt`, `ko`, `zh`, `yue` and the
others there. An unknown code rejects the file.

### Japanese readings

Readings go in lenticular brackets straight after the kanji they belong to:
`日本語【にほんご】`, `食【た】べる`. Kana, particles and okurigana stay
outside the brackets. Readings are optional; **leave one out rather than
guess it**. Echo shows them as furigana and can hide them.

### What a deck must not contain

Leave these out. Echo creates them, and invented values would corrupt
scheduling or links: `srs`, `reviews`, `reviewTrack`, `echoCount`,
`createdAt`, `grammar`, `grammarAnalysis`, `vocabulary`, `notes`,
`preferences`, and any API key or token. (Echo's own backup files do carry
these, and they import through the same door; a deck is the minimal subset.)

---

## How import behaves

- **The whole file is checked first.** A malformed file, a sentence missing
  `id`, `source` or `target`, or an unknown language code rejects the whole
  file before anything is saved. The error message names the sentence number.
- **Duplicates are skipped.** A sentence is the same as one already in the
  library when its `id` matches, *or* when its target text matches once
  readings and spacing are ignored. Progress on the existing sentence is kept.
- **Imported sentences are ordinary sentences.** They enter the review queue
  as new cards, and can be edited, rewritten with AI or deleted like any other.
- **By URL:** the address must return the JSON itself, and the server must
  allow browser downloads (CORS). `github.com/…/blob/…` links are turned into
  raw links automatically; for anything else use the *raw* URL. If a site
  blocks it, download the file and choose it instead.

### Updating a deck

Keep every `id` the same from one version of the deck to the next. To correct
a sentence the learner already imported, change its text and set `updatedAt`
to the current time: the new text replaces the old, and the learner's echo
count, schedule and history are kept. Without a newer `updatedAt`, the
learner's copy wins. New IDs are added; IDs missing from the new version are
left alone (import never deletes).

---

## Instructions for an AI agent

Give an agent this page (or this section and `decks/example-deck.json`), then
the request:

> Create an Echo sentence deck about **[TOPIC]** for a **[LEVEL]** learner
> whose language is **[SOURCE LANGUAGE]**, learning **[TARGET LANGUAGE]**.
> Produce **[NUMBER]** sentences.
>
> - Return one JSON object only: no Markdown fences, no comments, no
>   trailing commas, no prose before or after.
> - `schemaVersion` is `2`. Give the deck a `title` and a one-line
>   `description`.
> - Every sentence has `id`, `sourceLang`, `targetLang`, `source` and
>   `target`. Use the language codes from DECK-FORMAT.md.
> - IDs: one prefix specific to this deck plus a zero-padded number
>   (`cafe-ja-001`). Never reuse the example's IDs.
> - `target` is one complete, natural sentence a person would actually say,
>   not a word, a phrase list or a gloss. Keep it short enough to repeat aloud
>   in one breath. `source` is its natural meaning, not a word-for-word gloss.
> - Teach vocabulary and grammar in context. Do not pack rare words into a
>   sentence to cover more.
> - Each target sentence appears once. Do not write variants for listening,
>   reading or writing: Echo reviews every sentence in all three ways.
> - Japanese: add readings as `漢字【かんじ】` after each kanji run, with kana
>   and particles outside the brackets. Omit a reading you are unsure of. Where
>   politeness matters, give `casualTarget` and `politeTarget` (with `target`
>   equal to the casual form).
> - Do not include `srs`, `reviews`, `echoCount`, `createdAt`, `grammar`,
>   `vocabulary`, `notes` or any key.
> - Before answering, check that the JSON parses, every `id` is unique, every
>   target sentence is unique, and every `source` matches its `target`.

To check a deck before importing it, validate it against
`decks/deck.schema.json`, or run, from this repository:

```sh
node --input-type=module -e "import {validateDeckBackup} from './imports.js';import fs from 'node:fs';console.log(validateDeckBackup(JSON.parse(fs.readFileSync(process.argv[1],'utf8'))).sentences.length,'sentences OK')" my-deck.json
```
