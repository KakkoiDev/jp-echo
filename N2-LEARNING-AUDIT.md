# Echo N2 learning audit · 24 November 2026

**Build a daily delayed recall check first.** Echo already offers enough questions to spend the entire sprint taking tests. The higher-value improvement is to find out which mistakes recur on a different question a day later, and use that result to choose tomorrow's work. For a longer horizon, reuse Echo's FSRS scheduler for individual targets and keep testing comprehension on unfamiliar passages.

## What this audit examined

Source baseline `c098b8b` on main. Traced the Practice hub, written recall, radio playback and next-day checks, paper loading, evidence export and adaptive selection. Counted the committed JSON and inspected examples, including set 02 questions 53 and 74. The former asks the reader to distinguish a free consultation from paid materials. The latter requires following a change of priority at the end of a conversation. A vocabulary error, a missed exception and losing track of the final instruction call for different remedies. This was a code and structural audit with sampled content. Japanese editorial quality across every answer and difficulty relative to a real sitting remain unmeasured.

| Material on main | Audit result | Product consequence |
|---|---|---|
| Form 01 | 101 items | Keep its paper identity stable for previous attempts. |
| Authored forms 02–20 | 19 × 105 items. Each has 30 vocabulary, 22 grammar, 21 reading and 32 listening questions. | The old handoff's description of template listening drills is obsolete for the current editions. |
| Vocabulary and grammar in forms 02–20 | All 570 vocabulary questions have target IDs, covering 570 distinct targets. Of 418 grammar questions, 228 carry a target, spanning 196 distinct targets. | Use the inventory for breadth. A mock alone leaves many words untested. |
| Reading and listening in forms 02–20 | 399 reading and 608 listening items. Zero explicit target IDs in either group. Question type, script/passage and answer evidence are available. | Start by grouping misses by question type. Add reviewed skill tags for inference, reference, constraint changes and next action. A missed dialogue alone gives insufficient evidence to mark a word unknown. |

## Fixes in this change

- Day Radio previously inferred that the last item finished when another item started. Skip could create a false exposure. The player now waits for completion of the same run and successful speech callbacks. Cancellation, errors and watchdog expiry earn no exposure. Playback completion is still only an opportunity to hear something.
- Previously a later listening success could remove a written weakness from the radio queue. The generator also cleared other dimensions of the same word and ignored radio ratings. It now takes the latest evidence per skill, target and dimension before ranking weaknesses. Active listening grades can seed a targeted exam. Passive exposure cannot.
- The fresh radio quota used to select the first inventory entries and then reorder them. New batches can now reach unheard targets and checked inventories can still play. Interrupted same-day sessions use their saved order. Audio recall hides the written word even when no example exists.
- The hub now counts the same eligible next-day batch the player opens. A later written mock miss also removes the target from its two-day instant count. A tagged listening question cannot change written grammar coverage.
- The quota assumed ten acquisition days from November 24 while the plan offered nine. Both now reserve December 3–5 for consolidation. Starting with zero checked entries means 219 first checks on November 24, with the last acquisition day December 2. This is an inventory target. The app cannot yet forecast when all items will be recalled reliably.

## What the research supports

| Finding | Implication for Echo | Limit |
|---|---|---|
| Repeated retrieval after a correct response improved later recall in a foreign-language vocabulary experiment. Repeated study after that point gave little additional benefit in that design. [Karpicke & Roediger, 2008](https://doi.org/10.1126/science.1152408) | Hide the answer, ask for the meaning aloud, then reveal and correct. A second successful attempt on a different day is evidence worth keeping. | A self-reported instant response can be inaccurate. Sample objectively scored questions too. |
| A second-language meta-analysis found benefits from spacing. Longer gaps helped more on delayed tests, and equal and expanding intervals performed similarly overall. [Kim & Webb, 2022](https://doi.org/10.1111/lang.12479) | Split the six hours into separated visits to the same difficult material. Keep a next-day check even when the same-session retry succeeds. | This evidence supplies no universal schedule for N2 Japanese or this learner. |
| The gap associated with best retention varied with the delay to the final test in an experiment with over 1,350 learners. [Cepeda et al., 2008](https://pubmed.ncbi.nlm.nih.gov/19076480/) | Give the scheduler a target date during the sprint. After the exam, let intervals grow as stability improves. | The study used facts. Exact intervals for listening or reading comprehension require local evaluation. |
| Repeated testing improved transfer to new inferential questions in experiments using prose passages. [Butler, 2010](https://pubmed.ncbi.nlm.nih.gov/20804289/) | After an error, explain the decisive sentence or audio cue. Test the distinction again on an unseen passage or dialogue. | Transfer across experiments does not establish that AI-generated contexts are equivalent in difficulty. |

## Proposed sprint algorithm

**Objective:** maximize independent, timed performance on unseen material on December 6, under 360 minutes per day. These are initial engineering choices to evaluate. Echo currently ships a rule-based plan.

1. Start with one mixed diagnostic in exam conditions. Record correctness, guess, question type and section time. For a reading miss, offer a one-tap cause such as “missed the exception” or “ran out of time.” Treat a timeout as a pacing observation. Treat a guessed correct answer as uncertain.
2. Split evidence by target and task. Meaning from print, kana reading, meaning from audio and grammar choice are separate. Give a self-rating less evidential weight than an unaided correct answer on an unseen item. Exclude passive plays, reveals and repeated questions from the independent success rate. Track response time relative to the learner's own correct answers for comparable tasks. Exclude interrupted attempts.
3. On a miss, show the corrective cue immediately during drills, then retry after several intervening items. Give an unaided fresh-context check the next day. After success, try again roughly three days later if the deadline permits. Following a second delayed success, sample again before the exam. These are seed intervals; shorten after a lapse and adjust using observed delayed accuracy. Save exam-mode feedback for the end of the section.
4. Reserve time for timed reading and listening every study day. Put remaining active minutes toward weak skills and first checks. With sparse data, rank recurring delayed misses first, then guesses and slow corrects. Reserve an initial 20% of drill time for unseen or under-sampled material and adjust from the coverage forecast. Show both remaining first checks and expected minutes, estimated from the learner's observed pace.
5. With enough evidence, rank candidate activities by section need × expected increase in exam-day success probability ÷ expected active minutes. Estimate the increase by comparing predictions with and without today's review, averaging over possible outcomes. Use broad priors until observations accumulate. Give extra weight to sections near the section floor. Raw share × 60 is a practice signal and cannot supply a calibrated pass probability.
6. Cap the complete plan at 360 minutes including breaks. If review debt exceeds the budget, show how many first checks will spill over and move the forecast. Preserve the delayed checks and the weakest comprehension section. On December 3–5 use existing weak material, unfamiliar examples and a lighter eve.

**A six-hour example.** On a regular day use 35 minutes for delayed checks, 95 for first checks, 55 for timed reading, 50 for listening, 55 for feedback and targeted practice, 30 for awake radio and 40 for breaks. On a mock day substitute 155 minutes of timed testing, 50 of error analysis, 35 of delayed checks, 65 of inventory screening, 15 of radio and 40 of breaks. If 219 first checks exceed the allotted time, display the revised finish date. Finishing the inventory by December 2 is conditional on actual pace. A light exam eve need not fill six hours.

## Proposed long-horizon algorithm

Use one FSRS card per target and retrieval dimension. Echo already bundles FSRS-6 in `srs.js` for sentence review. Build on its source/wrapper. Keep raw events so states can be replayed when mappings change. Start with shared defaults and 90% desired retention as a trial workload setting. A missed retrieval maps to Again, effortful correct to Hard and independent correct to Good. Extend the existing two-rating interface deliberately. A repeated prompt, a passive play and an unattempted question should never silently become Good. [FSRS implementation and evaluation guide](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md)

Choose due items first, admit new items only within forecast review capacity, and offer extra study explicitly. Once enough history exists, fit parameters on early reviews and evaluate on later reviews against the default. A weekly fresh passage and a single-play dialogue test transfer and pacing. Keep those results at the passage or skill level. Reuse the underlying history when switching from sprint to maintenance so established targets keep their intervals.

## How to decide whether the algorithms help

Compare the existing rule with the candidate under the same daily time budget. Pair similar targets by prior difficulty and randomly assign each member to a scheduler. Hold back contexts, keep related items in the same group where leakage is likely, and offer the same delayed checks to both groups. Record next-day and seven-day unaided accuracy, median time on correct answers, completed first checks, and active minutes. Track comprehension by section on unseen forms. For probabilistic predictions, report Brier score and observed accuracy in predicted retention bands on chronologically held-out trials. Examine missing checks separately. This sprint can reveal regressions and useful individual signals. A small sample cannot establish a universal optimum.
