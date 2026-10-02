# Example sentence deck for Echo

[sentence-deck.json](sentence-deck.json) is a complete importable deck with six short Japanese sentences. Use **Settings → Your sentences → Import example sentence deck** to try it, just like the AI team import. You can also download the file and use **Import deck JSON**.

This is a format model, not a large starter course. It deliberately uses only the fields a new deck needs. Echo adds dates and schedules reviews after import. Full sentence records and optional backup fields are documented in [IMPORTS.md](../IMPORTS.md).

## Instructions to give an LLM

Copy the following instructions and attach `sentence-deck.json` as the format example:

> Create an importable Echo sentence deck about [TOPIC] for a [LEVEL] learner.
> Return one valid JSON object, without Markdown fences or explanatory prose.
> Use `schemaVersion: 2`, a descriptive `title`, and a `sentences` array.
> Each entry must contain a unique non-empty string `id`, `sourceLang`,
> `targetLang`, `source`, and `target`, matching the attached example.
> Use `sourceLang: "en"` and `targetLang: "ja"` unless I request another pair.
> `source` is the natural English meaning; `target` is one complete, natural
> Japanese sentence, not an isolated word or a list of vocabulary.
> Keep sentences short and suited to spoken repetition. Teach vocabulary and
> grammar in context; avoid adding difficult words just to pack more into a card.
> Include each Japanese sentence only once. Do not repeat sentences for listening,
> reading, or writing: Echo handles those review modes on the same sentence.
> Use a deck-specific ID prefix, such as `my-robotics-deck-001`. Keep the ID for
> unchanged sentences on later exports. Never reuse this example deck's IDs or
> an existing ID for an unrelated sentence.
> For Japanese kanji readings use `漢字【かんじ】`. Attach readings to the kanji
> they belong to; leave particles and kana outside the brackets. If you cannot
> confidently supply a reading, omit it rather than guess.
> Do not invent review history, scheduling, echo counts, grammar IDs, dictionary
> IDs, or API settings. Leave those fields out of a new deck.
> Add no comments or trailing commas. Check that all IDs and Japanese sentences
> are unique and every translation matches its sentence.
> Produce [NUMBER] sentences.

An ID identifies a card; Japanese wording also identifies duplicate content. Reimporting identical sentences keeps existing progress even if readings or IDs differ. Choose a specific ID prefix for each real deck. Importing malformed JSON or a row without its required text is rejected before changes are saved.

## Minimal shape

```json
{
  "schemaVersion": 2,
  "title": "My sentence deck",
  "sentences": [
    {
      "id": "my-deck-001",
      "sourceLang": "en",
      "targetLang": "ja",
      "source": "Please check this code.",
      "target": "このコードを確認【かくにん】してください。"
    }
  ]
}
```

The example deck is also cached with the installed PWA, so its import works offline after an update has installed. Custom remote deck URLs need a network connection and a server that allows browser downloads.
