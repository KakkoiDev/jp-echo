# What is in this folder (generated)

Built by `node tools/build-game-audit.mjs` from the code the game runs. Do not edit by hand: change the source and rebuild.

## Questions the game can ask today

| Kind | Label in the game | Seconds | Questions | File |
| --- | --- | --- | --- | --- |
| reading | Reading | 3 | 767 | questions/reading.jsonl |
| meaning | Meaning | 3 | 1,581 | questions/meaning.jsonl |
| definition | Which word | 4 | 1,319 | questions/definition.jsonl |
| listen | Listen | 5 | 1,581 | questions/listen.jsonl |
| homophone | Which kanji | 5 | 19 | questions/homophone.jsonl |
| grammar | Grammar | 6 | 215 | questions/grammar.jsonl |
| affix | Word part | 5 | 149 | questions/affix.jsonl |
| connective | Connective · 問題9 | 7 | 228 | questions/connective.jsonl |
| exam | Exam question | 4–8 | 613 | questions/exam.jsonl |
| **all** | | | **6,472** | |

Exam and connective questions count every set from 02 to 18 as sat. In the game, only sets the learner has sat are used; sets 19 and 20 are never used. Exam questions are written sections only (言語知識 問題1–5, 7); connective questions are practice and score nothing.

## Source lists

- data/vocabulary.tsv: 1748 N2 words with their deck sentence and the question kinds each feeds
- data/readings.tsv: 767 reading questions with every near miss
- data/grammar.tsv: 221 N2 grammar patterns with their deck sentence
- data/kanji.tsv: 1034 kanji used in the N2 words, with readings and the words using each
- data/connectives.tsv: 35 connectives with their job (planned connective cards)
- data/connective-passages.tsv: 228 connective questions exactly as the game asks them (practice, not scored)
- data/excluded.tsv: 40 items left out of the game until fixed, with reasons
- data/accepted-readings.tsv: readings never offered as wrong, and keys changed to match what Echo teaches
- data/exam-questions.tsv: 613 authored short exam questions
