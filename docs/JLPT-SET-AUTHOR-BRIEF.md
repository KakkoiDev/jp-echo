# Brief: author one original JLPT N3 mock exam for Echo

The author writes one file outside the repo and touches nothing else; `tools/build-level-sets.mjs` brings it in after the audit (docs/JLPT-LEVEL-SETS.md).

## What to produce
One JSON file `{ "id": "n3-set-<N>", "level": "N3", "theme": "<short Japanese theme>", "questions": [ ...102 questions... ] }`
in the exact 問題 order of the N3 blueprint. Read these first:
- `jlpt-sets.js` — the N3 blueprint (rows `N3 = [...]`): skill, 問題 number, kind, count, options, `group` (questions sharing one context), `chars` (allowed context length in characters).
- `tools/validate-level-set.mjs` — every rule your file must pass. Run it: `node tools/validate-level-set.mjs <your file> --profile` (from the repo root). Iterate until it prints OK.
- `n2-sets/n2-set-2.json` — a finished N2 set: same question shape (use it for format and for the tone of `why`), but yours is N3 and easier.
- `levels/6b5d0f94fe/n3.json`, `n4.json`, `n5.json` — the inventories: `words: [text, reading, meaning]`, `grammar: [id, title, meaning]`.

Layout (102 questions): Vocabulary 問題1 漢字読み 8 · 問題2 表記 6 · 問題3 文脈規定 11 · 問題4 言い換え類義 5 · 問題5 用法 5; Grammar 問題1 文法形式の判断 13 · 問題2 文の組み立て 5 · 問題3 文章の文法 5 (one passage, blanks （１）–（５）); Reading 問題4 短文 4 (four texts, one question each) · 問題5 中文 6 (two texts × 3) · 問題6 長文 4 (one text × 4) · 問題7 情報検索 2 (one notice/table × 2); Listening 問題1 課題理解 6 · 問題2 ポイント理解 6 · 問題3 概要理解 3 · 問題4 発話表現 4 (3 choices) · 問題5 即時応答 9 (3 choices).

## Question shape
`{"skill","mondai","context","prompt","choices","key","why", ...}`; `key` is 1-based; `why` is one or two English sentences saying why the key is right AND why the tempting wrong choices fail.
- Vocabulary 問題1–5 and Grammar 問題1 also carry `"target"` and `"dimension"`:
  - word target `["word", text, reading]` copied EXACTLY from an inventory row (text and reading); grammar target `["grammar", id]` with the exact id.
  - At least 70% of targets must be N3 rows; the rest N4/N5. No target twice in the set.
  - 漢字読み: `dimension:"reading"`, prompt is a sentence with the word marked `【漢字の言葉】`, choices are four kana readings, key = the inventory reading. Wrong readings must be plausible confusions (long/short vowel, voiced/unvoiced, 音/訓 mix), never real readings of the same word.
  - 表記: `dimension:"meaning"`, prompt marks the word in kana `【よみ】`, choices are four kanji spellings, key = the inventory text. Wrong spellings use real kanji with the same sound or similar shape.
  - 文脈規定: prompt has the blank `（　）`; four words of the same part of speech; exactly one fits.
  - 言い換え類義: prompt marks a word or phrase with `【】`; choices are paraphrases; the target is that word.
  - 用法: prompt is exactly the word (the target text); the four choices are full sentences using it, only one correctly. The three wrong ones must be clearly wrong uses a native would reject (a different word is needed), not merely odd.
  - 文法形式の判断: prompt has `（　）`; target is a grammar id from the inventories; choices are four forms; exactly one is grammatical AND fits the meaning.
- 文の組み立て: prompt has exactly three `＿＿` and one `★` (e.g. `この本は ＿＿ ＿＿ ★ ＿＿ おもしろい。`), four fragments as choices; exactly one order is grammatical; key = the fragment at ★; `why` gives the full sentence. No target.
- 文章の文法: all five share one passage (`context`) containing （１）…（５）; each prompt is `（１）に入るのは？` etc. Test connectives, こ/そ words, sentence endings, particles in context — things only answerable from the passage flow.
- Reading and Listening questions also carry `"tags"` (1–2 of: detail, exception, change, reason, intent, inference, reference, main, compare, next, response, numbers — meanings in `n2-comprehension.js` TAGS) and `"cue"`: the deciding line, 4–80 characters copied EXACTLY (character for character) from that question's context.
- Listening `context` is the script. EVERY line starts with a speaker label: `男：`, `女：`, or for three people `男１：` etc. Monologues (概要理解) are one speaker with a label. The `prompt` is the question (課題理解: 「男の人はこのあとまず何をしますか。」 style; ポイント理解: why/what/when; 概要理解: what is the talk about / what does the speaker think).
  - 発話表現: `context` is the spoken situation description on one labelled line, e.g. `女：友達の家でごはんを食べました。帰るとき、何と言いますか。`; `prompt` is `何と言いますか。`; three choices are utterances; tags `["response"]`; cue = a phrase from the situation.
  - 即時応答: `context` is one labelled utterance; `prompt` is `最もよい返事はどれですか。`; three choices are replies; tags `["response"]` (a second tag allowed); cue = the key phrase of the utterance (3+ characters).

## Level: this is N3, not N2
- Everyday topics: school, part-time work, shopping, travel, neighbours, health, hobbies, simple workplace talk, town notices. Passages are concrete, with one clear point; opinions are simple.
- Vocabulary and grammar in passages, scripts and choices stay within N3/N4/N5. The validator measures kanji: at most 1.0% of kanji occurrences may be outside the kanji used by N5–N3 inventory words. Write rarer words in kana or pick an easier word. Use common surnames (田中、山田、木村、中村、小林…).
- Sentences are shorter than N2. 短文 130–300 chars, 中文 300–520, 長文 480–820, 情報検索 350–900, 文章の文法 350–750, listening 問題1–3 scripts 150–480.

## Quality bar (this is what gets audited)
- Exactly ONE defensible answer per question. A second AI will solve every question without the key; any disagreement is treated as your defect. Reread each item as a solver.
- Distractors are plausible traps of the kind the real test uses: listening options that are mentioned and then rejected or changed (「あ、やっぱり…」), reading options that reuse words from the text but say something the text does not, readings that differ by one sound. Never joke options.
- Reading answers must require reading the passage: not answerable from common sense alone, and not a verbatim copy of a sentence (paraphrase the right answer).
- 情報検索: a realistic notice/price list/schedule with conditions; each question needs combining two or more conditions (age, day, price, deadline).
- Spread keys evenly and unpredictably (four-choice items: each of 1–4 used 19–26 times over the 89; three-choice: each of 1–3 at least 3 times over the 13). Do not put the longest choice as the key habitually.
- Natural Japanese a native editor would accept. です/ます and plain style used consistently within a text. No English in Japanese fields.
- ORIGINAL: write everything yourself. Never reproduce or adapt questions or passages from official JLPT papers, workbooks, textbooks or websites.
- No passage or script reused inside the set; the theme (given in your task) colours roughly a third of the texts, the rest vary.

## Working method
Write the JSON with a script or in pieces if that helps (e.g. several part files merged by a small node script in your scratch directory), but the final file must be one JSON as above. Check targets by looking them up in the inventory files (grep) BEFORE writing the question. Run the validator, fix, repeat until OK. Then do one full self-review pass as a solver, fix anything ambiguous, and re-run the validator.

Report back: the output path, the validator's final output including the --profile line, the key distribution, and an honest list of any questions you are less than sure about (by number) and why.
