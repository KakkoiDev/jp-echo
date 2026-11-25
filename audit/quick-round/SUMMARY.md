# What is in this folder (generated)

Built by `node tools/build-game-audit.mjs` from the code the game runs. Do not edit by hand: change the source and rebuild.

## Questions the game can ask today

| Kind | Label in the game | Seconds | Questions | File |
| --- | --- | --- | --- | --- |
| reading | Reading | 3 | 767 | questions/reading.jsonl |
| meaning | Meaning | 3 | 1,581 | questions/meaning.jsonl |
| definition | Which word | 4 | 1,319 | questions/definition.jsonl |
| listen | Listen | 5 | 1,581 | questions/listen.jsonl |
| homophone | Which kanji | 5 | 47 | questions/homophone.jsonl |
| grammar | Grammar | 6 | 221 | questions/grammar.jsonl |
| connective | Connective · 問題9 | 7 | 228 | questions/connective.jsonl |
| exam | Exam question | 4–8 | 969 | questions/exam.jsonl |
| **all** | | | **6,713** | |

Exam questions count every set from 02 to 18 as sat. In the game, only sets the learner has sat are used; sets 19 and 20 are never used.

## Source lists

- data/vocabulary.tsv: 1748 N2 words with their deck sentence and the question kinds each feeds
- data/readings.tsv: 767 reading questions with every near miss
- data/grammar.tsv: 221 N2 grammar patterns with their deck sentence
- data/kanji.tsv: 1034 kanji used in the N2 words, with readings and the words using each
- data/connectives.tsv: 35 connectives with their job (planned connective cards)
- data/connective-passages.tsv: 245 places in the sets 02–18 passages where a connective starts a sentence
- data/exam-questions.tsv: 969 authored short exam questions
