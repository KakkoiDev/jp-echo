# N2 study data and AI

The exam screen uses n2-mock.js. Versioned form construction lives in n2-forms.js, the N2 study inventory in n2-inventory.json, progress and export in n2-progress.js, and targeted generation in n2-adaptive.js.

## Export contract

The JSON export identifies its schema as echo.n2.study.v1. Its top-level fields are exportedAt, papers, attempts, recall and (since 24 Nov 2026) events. Older readers can ignore events; exports made before it simply lack the field. Papers keep question order and choices frozen when a form is first opened. Attempts refer to paper IDs. Multiple attempts on the same paper can therefore be compared directly. IndexedDB stores paper snapshots, past attempts and recall records. The current attempt per paper uses the existing localStorage key so older sessions remain resumable.

| Collection | Fields and interpretation |
| --- | --- |
| papers | id, book, title, questions. A question contains its zero-based index, numeric skill (0 vocabulary, 1 grammar, 2 reading, 3 listening), one-based answer key, label and option count. Native items include prompt, context or listening script, choices and explanation. Tagged items include a stable target and dimension. Official workbooks reference the external source and question number. |
| attempts | id, book, paper, phase, index, deadline, answers, guesses and time. Answers are one-based, with zero for unanswered. Guesses are explicit flags. Time is elapsed milliseconds per displayed question and can include interruptions. New sessions have startedAt and completed sessions have completedAt. Legacy sessions can lack dates. |
| recall | One record per target and tested dimension. Includes prompt, answer cue, latest grade, check count, consecutive successful local dates and dated grade events. Word targets use spelling and reading; grammar uses the inventory identifier. |
| events | Day Radio evidence, one row per event, kept apart from recall. id, target (same identity as recall and exam targets), kind ("exposure": an item played through on Day Radio, passive; "recall": a deliberate rating), skill ("listening"), grade on recall rows ("got" or "missed"), at (ISO time) and context {source: "day-radio" or "check-yesterday", mode: "listen", "recall" or "check", exampleId: the deck sentence (n2-word-<i>, n2-grammar-<i>) or exam question (n2-set-N#index) heard}. A listening event never changes a meaning, written-reading or grammar record. |
| adaptive papers | Also include generation time, provider name, selected evidence and per-question focus. An exam is persisted only after all requested skills have returned valid questions. Provider failures are shown to the learner. |

## Analysis

Use the Settings provider through Echo's askModel function. The learner selects Analyze with my AI or Create targeted exam to send data. Analysis includes score summaries, a bounded sample of mistakes and flags, and weak recall items. Generation uses missed or guessed answered questions, unusually slow correct responses measured against the learner’s same-skill median, and self-rated weak targets. Unanswered items are retained in the export and excluded from adaptive mistake attribution.

An external agent can join each attempt to its paper, inspect the selected distractor, isolate guesses and compare first and later attempts. Keep archive-workbook results and generated practice results identifiable. Never treat raw accuracy as an official scaled score. Settings, credentials and provider keys are outside the export.
