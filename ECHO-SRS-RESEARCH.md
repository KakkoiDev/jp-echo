# What should Echo schedule next?

24 November 2026. Decision for sentence Review: retain FSRS and its 90% target as a starting setting. Measure delayed recall on the learner’s own material before changing parameters. For the exam sprint, vary the work selected each day according to the deadline. Pulling every card forward would spend time rechecking words the learner already knows.

## What the research measured

| Evidence | Result | Consequence for Echo |
|---|---|---|
| Kim & Webb synthesized 48 second-language experiments, 3,411 participants and 98 effect sizes. | Distributed practice improved learning. Longer gaps helped more on delayed measures. Equal and increasing gaps had comparable aggregate results. | Offer another encounter tomorrow and after a longer interval. An exact sequence of gaps is a product choice. [Study](https://doi.org/10.1111/lang.12479) |
| Nakata compared 1, 3, 5 and 7 retrievals of 16 English–Japanese pairs in 98 Japanese learners, including delayed testing beyond two weeks. | More repetitions improved absolute scores. Accounting for study time changed the ranking and favored a single retrieval in that comparison. | After feedback, permit a retry with intervening items. Avoid requiring five successful repetitions of every easy item in a six-hour day. [Study](https://doi.org/10.1017/S0272263116000280) |
| Karpicke & Roediger studied foreign vocabulary after initial successful recall. | Continuing to retrieve items improved delayed performance. Learners’ own forecasts did not reliably predict delayed results. | Conceal the meaning, require an attempt, then reveal. Count a first check separately from a later unaided success. [Study](https://doi.org/10.1126/science.1152408) |
| Cepeda and colleagues varied the gap between learning and review and the delay to final test in a large fact-learning experiment. | The most productive gap depended on the final retention horizon. | Store the exam date separately from the first-pass deadline. Reserve a later unfamiliar prompt to check transfer. Exact N2 intervals cannot be inferred from facts learned in the lab. [Study](https://pubmed.ncbi.nlm.nih.gov/19076480/) |
| Anki’s FSRS documentation describes desired retention, learning steps, workload and optimization on a review log. | Raising target retention generally increases review workload. Desired retention is a scheduling input. | Start with a shared model. Check calibration against actual answers before treating its probabilities as personal forecasts. [Implementation reference](https://docs.ankiweb.net/manual/deck-options) |

## What Echo actually does

Sentence Review uses the ts-fsrs wrapper in [srs-entry.js](srs-entry.js) and the shipped bundle in [srs.js](srs.js). Current settings are 0.90 desired retention, fuzz enabled, 1- and 10-minute learning steps, a 10-minute lapse step, and Again/OK grades. A sentence has one memory state while listening, reading and writing rotate. There is no separate probability of knowing its meaning by ear. The N2 hub uses [its own recall records](n2-study.js) and Day Radio logs passive playback and active recall separately. Keep these distinctions visible in analytics.

Behavioral spot check of the shipped bundle, starting 2026-11-24 00:00 UTC and issuing every next grade at the resulting due time:

| Grades in order | Observed delays until next review |
|---|---|
| OK, OK, OK, OK, Again | 10 min, 2 days, 11 days, 44 days, 10 min |
| Again, OK, OK, OK, Again | 1 min, 10 min, 1 day, 2 days, 10 min |

The implementation increased gaps after sustained success and brought lapses back promptly in these cases. Exact intervals depend on history and fuzz. A due time describes eligibility. Echo’s session batch and the learner’s available time determine when the card is actually seen. The rolling 20-hour allowance defaults to 20 new and 20 existing review attempts separately. On a busy day that existing-review cap can defer due work. No personal export or longitudinal trial was available to estimate the learner’s retention or validate 90% empirically.

## Starting defaults and adjustment rules

| Setting | Starting choice | What to watch |
|---|---|---|
| Maintenance intake | Propose 10 genuinely unfamiliar words/day for a new learner. Keep existing users’ configured limits. Show an explicit way to do extra. | This is a testable workload assumption. Reduce new intake while due work rolls over repeatedly. Increase in small batches when delayed accuracy and study time stay stable. |
| Ordinary review | Keep the current 90% FSRS target and short learning steps initially. Use Again after a miss or answer reveal, OK after unaided recall. | Compare predicted and observed next-review recall by delay and modality. An assisted success should carry an assistance flag in future logs. |
| Exam sprint | Screen already-familiar N2 material quickly. Use slower active practice for misses and guesses. Start with a fresh next-day check and another about three days later if the deadline permits. | A first pass through 219 candidates and learning 219 new words are very different workloads. Compute each using its own observed minutes per item. |
| Audio and automaticity | Give full meaning feedback in study mode. In recall mode conceal text, leave a response pause, and collect an explicit grade. | Measure accuracy first, then latency on correct comparable tasks. Exclude interrupted audio and rereads. Keep passage comprehension separate. |

For evaluation, hold out later days and unfamiliar contexts, report next-day and seven-day unaided accuracy, overdue items, minutes studied and successful delayed recalls per hour. Report the sample count with each result. Where predictions are recorded, group by predicted retention and compute Brier score. Compare the existing rule and the candidate at equal time budgets. Personalize after the candidate beats the shared defaults on later observations. The trials above supply no universal daily word limit or uniquely optimal retention percentage.
