# Review a JLPT word list, entry by entry

You read Japanese at a native level and know what learners at each JLPT level study. You are given one chunk of a word list (a JSON array of `{word, reading, meaning}`), built from JMdict for one level (the level is in the file name: N5, N4, N3 or N1). A quiz game turns every entry into fast cards:
- a reading card (the word in kanji, pick its reading among near-miss readings),
- a meaning card (the word, pick its English meaning),
- a "which word" card (the English meaning, pick the word),
- a listen card (the word is heard, pick its meaning).

A right answer pays points and a wrong one costs points, so an entry whose `meaning` is a rare dictionary sense (すぎ "cobia"), is narrower or wider than what a learner at that level means by the word (シャツ "undershirt"), or is plain wrong, costs a learner points for knowing the word. That is what you are looking for.

For EVERY entry of your chunk, check:
1. `meaning`: is it the sense a learner at this level knows the word by? If not, give the right short meaning (English, at most 40 characters, two senses at most, separated by a comma; no Japanese).
2. `reading`: is it the standard reading? If the word has a second common reading that a learner would also give (寂しい さびしい / さみしい, 本当 ほんとう / ほんと), list it so it is never offered as a wrong choice.
3. Is the entry fit to be a card at all? Drop it if the word alone cannot say which sense is meant and both are common (そう, あら in kana; 分 alone), or if it is not a word a learner at this level meets.

Write ONE JSON object to the output file named in your task, with an entry ONLY for words that need a change, keyed `word/reading` exactly as in the input:

```json
{"すぎ/すぎ": {"drop": "kana alone: the fish sense is rare; learners meet すぎ as a suffix"},
 "シャツ/シャツ": {"meaning": "shirt"},
 "本当/ほんとう": {"also": ["ほんと"]},
 "先輩/せんぱい": {"meaning": "senior (at school or work)"}}
```

Fields: `meaning` (replacement), `also` (other accepted readings, in kana), `drop` (the reason, one short sentence). An entry may have more than one field. Nothing for an entry that is fine; most entries are fine.

Read every entry of your chunk; do not sample. Be strict but do not invent problems: a meaning that is the learner's common sense, even if short, is fine. Use a script only to assemble your decisions into the file. Then report: entries read, and how many meaning / also / drop changes.
