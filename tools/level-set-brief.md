# Brief: write one original JLPT {LEVEL} mock paper for Echo

You write one JSON file outside the repo and touch nothing else: no git, no repo edits. Your task message gives the output path, the plan file and a scratch directory. The second half of this brief ("This paper") is your paper's plan: its layout, where every right answer goes, and the words and grammar points you may test.

## The file
`{ "id", "level": "{LEVEL}", "theme", "questions": [...] }`, questions in the exact order of the layout below.
Each question: `{"skill","mondai","context","prompt","choices","key","why", ...}`. `key` is 1-based and MUST be the position the plan gives for that question: write the right answer there and arrange the wrong ones around it. `why` is one or two English sentences: why the key is right and why each tempting wrong choice fails. Every `why` must be true as a statement about Japanese in general, never "X is only for…" unless that is so; name choices by what they say, never by number.

From the repo root (`/Users/kakkoidev/Code/jp-echo/.claude/worktrees/jlpt-sets`), check with
`node tools/validate-level-set.mjs <your file> --plan <your plan> --profile` and repeat until it prints OK. Read `tools/validate-level-set.mjs` for every rule, and `sets/n3/2026-11-r2/n3-set-1.json` for the shape of a finished paper (that one is N3; write at YOUR level).

## Each kind of question
- **Targets.** 漢字読み, 表記, 文脈規定, 言い換え類義, 用法 and 文法形式の判断 carry `"target"` (copied exactly from your plan's candidates for that 問題) and `"dimension"`: `"reading"` for 漢字読み, `"meaning"` for the others. No target twice.
- **漢字読み**: a sentence with the word marked `【漢字の言葉】`; four kana readings; the key is the target's reading. Wrong readings are real confusions (long/short vowel, voiced/unvoiced, small っ, 音/訓 mix, the reading of a look-alike kanji), never another correct reading.
- **表記**: the word marked in kana `【よみ】`; four spellings; the key is the target's text. Wrong spellings are mostly REAL kanji and real words that compete (same sound, similar shape, a homophone with another meaning), few invented compounds. For a katakana target, the choices are katakana look-alikes (シ/ツ, ソ/ン, long vowel).
- **文脈規定**: prompt with the blank `（　）`; four words of one part of speech from the same field; exactly one fits.
- **言い換え類義**: a word or phrase marked `【】`; four paraphrases; one means the same.
- **用法**: the prompt is exactly the target word; four full sentences, one using it correctly. Each wrong sentence must be impossible, not merely worse: check it against every sense of the word.
- **文法形式の判断**: prompt with `（　）`; four forms; one is grammatical AND fits. Use close variants of one form and near neighbours, and make some items two-line dialogues (`Ａ「…」\nＢ「…（　）…」` inside the prompt) where the role or register decides. If a wrong form is excluded only by an assumption, state it in the sentence.
- **文の組み立て**: exactly three `＿＿` and one `★`; four fragments; one order only; the key is the fragment at ★; `why` gives the full sentence. Fragments should attach in two places locally, so only the whole sentence settles the order. Try every order yourself.
- **文章の文法**: one passage with blanks （１）（２）… as many as the layout says, each asked once (`（１）に入るのは？`). Test what only the flow decides: connectives, こ・そ・あ, sentence endings, particles in context.
- **Reading** (`"tags"`, `"cue"` required): the answer must need the text, and must paraphrase it, not copy it. Wrong choices borrow true facts from the text and attach them to the wrong cause, person, time or conclusion. A text with three or more questions has at least one that needs two paragraphs. 情報検索 is a realistic notice, timetable or price list; each question combines two or more conditions. 統合理解 (N1): the context is `Ａ\n…\n\nＢ\n…`, two short texts on one topic, questions on what both say or where they differ.
- **Listening** (`"tags"`, `"cue"` required): the context is the script. EVERY line begins `男：` or `女：` (`男１：` `男２：` `女１：` `女２：` when two of one). The prompt is the question that is heard. Wrong choices are things said and then rejected, changed or belonging to someone else. Scripts sound spoken: fillers, short turns, a change of mind.
  - 発話表現: the context is one labelled line describing the scene and ending `何と言いますか。`; the prompt is `何と言いますか。`; three utterances; tags `["response"]`.
  - 即時応答: the context is one labelled utterance (make it a full sentence, 15–35 characters at N3 and above); the prompt is `最もよい返事はどれですか。`; three replies; tags `["response"]`. Wrong replies reuse the right words in the wrong direction (who does it, tense, giving and receiving, accepting what was not offered), never replies that fall on sight.
  - 統合理解 (N1 listening): long talks with three or four voices; where the layout groups two questions, both share one script.
- **`tags`**: one or two of detail, exception, change, reason, intent, inference, reference, main, compare, next, response, numbers (`n2-comprehension.js`).
- **`cue`**: the deciding line, copied character for character from the context. When the answer needs more than one place (a condition and its result, two facts, a back-reference and what it points to, every number of a sum), `cue` is an array of up to three spans that together justify the whole answer.

## Writing at {LEVEL}
Only words and grammar a {LEVEL} candidate has met ({DRAWS} inventories in `levels/`; N2 is `n2-inventory.json`). The validator limits kanji outside those inventories to 1% of all kanji: write rarer words in kana or choose another word.
- **N5**: very short, concrete sentences in です・ます. Everyday life only: family, school, shops, time, weather, directions. Kana for anything not on the N5 list; use katakana names (リンさん、マリアさん) or kana names (たなかさん). Listening is slow and plain; answers turn on a time, a place, a thing, an order of two steps.
- **N4**: everyday situations with one complication (a change of time, a condition, a reason). Plain and polite styles both appear. Passages have one point. Common surnames in kanji are fine if their kanji are in the inventories; otherwise kana.
- **N3**: everyday and simple workplace or town topics; texts with a reason, a contrast or a small opinion.
- **N1**: abstract and argumentative writing (essays, criticism, commentary on society, science, language, work), where the answer turns on the writer's stance, a qualified claim or an implied contrast; newspaper-style and literary vocabulary; listening with indirect refusals, hedged opinions, and several speakers weighing options. Wrong choices are close: each is partly true.

## Quality bar (every paper is audited)
- Exactly ONE defensible answer per question. Another model solves the paper without the key, and an editor then tries to defend every wrong choice. Do the same yourself before you finish.
- Natural Japanese a native editor would accept; one register within a text; no English in Japanese fields.
- ORIGINAL. Never reproduce or adapt a question, passage or scene from official JLPT papers, workbooks, textbooks or websites. Avoid the worn scenes and other papers' themes listed under "Do not use".
- No passage, script or sentence used twice in the paper.

## Method
Look up each candidate you choose before writing its question. Build the JSON with a small script in your scratch directory if that helps. Run the validator until OK. Then one full pass as a solver and one as an editor defending the wrong choices; fix; validate again.

Report: the output path, the validator's last output with the --profile line, and an honest list of questions you are less than sure about (by number) and why.
