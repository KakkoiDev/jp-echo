# Import sentence decks

In Settings → Your sentences, choose **Import deck JSON** for a downloaded file, or paste a direct JSON download URL and choose **Import URL**. GitHub `blob` file links are converted to raw download links. A URL must allow browser downloads (CORS); otherwise download the JSON and import the file.

**Import AI team sentence deck** downloads the Agentic Lab export from Nihongo IT Anki: 554 full Japanese sentences, one copy per sentence rather than three Anki templates. **Import Mini Hongo starter library** downloads 262 full examples covering 231 words and 43 grammar points, replacing unchanged word-only cards from the previous starter.

Imports merge with your library. Identical Japanese sentences are deduplicated even when their IDs or furigana differ. Existing sentence IDs, progress and personal notes are kept. Invalid files are rejected before any data is changed. Anki `.apkg` files are not this JSON format.

A minimal supported deck is:

```json
{
  "schemaVersion": 2,
  "title": "My Japanese deck",
  "sentences": [
    {
      "id": "my-deck-001",
      "sourceLang": "en",
      "targetLang": "ja",
      "source": "Who is that person?",
      "target": "あの人【ひと】は誰【だれ】？"
    }
  ]
}
```

Each sentence needs a stable, unique string `id`, its `source` meaning, and its `target` text. Use IDs specific to your deck. Readings can use `漢字【かんじ】`; they are optional. Dates are optional for new deck cards. Echo backup exports also include registers, scheduling, review records, notes and dictionary catalogues. Older schema-version-1 Echo backups remain supported.

For a complete six-sentence model and a prompt you can give another LLM, see [examples/README.md](examples/README.md) and [examples/sentence-deck.json](examples/sentence-deck.json). The example deck has its own one-click import in Settings and is available offline after installation.
