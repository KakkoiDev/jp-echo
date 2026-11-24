# JLPT expansion research and agent handoff

**Current packet:** [AI handoff index](ECHO-AI-HANDOFF-INDEX.md) · [Designer brief](ECHO-DESIGNER-HANDOFF.md) · [Spaced-repetition research](ECHO-SRS-RESEARCH.md). The N2 hub and Review share an editable exam goal. The optional duration sets the first-pass deadline from the day it is set. Changing only Review priority preserves that anchor. Due imported N2 word and grammar sentences can move ahead within the existing limits. The goal is included in the N2 analysis export. This integration is live code for N2; use it as the starting point for the other level profiles.


24 November 2026 · Echo baseline `61ee780`

**Build one level-aware Practice flow.** Echo already has 6,074 vocabulary entries and 758 grammar targets assigned to the four additional levels. The expensive work is building independent reading passages, listening situations and defensible answer choices. Start with the datasets below. The new levels are at the research-data stage.

| Level inventory | Vocabulary | Grammar | Timed blocks, in order (minutes) | Total pass / 180 | Pilot emphasis |
|---|---:|---:|---|---:|---|
| [N5](datasets/jlpt/n5.json) | 708 | 132 | Vocabulary 20, grammar/reading 40, listening 30 | 80 | Read a meeting time and respond to a simple request |
| [N4](datasets/jlpt/n4.json) | 651 | 185 | Vocabulary 25, grammar/reading 55, listening 35 | 90 | Apply an exception to opening hours and follow a short request |
| [N3](datasets/jlpt/n3.json) | 2,057 | 220 | Vocabulary 30, grammar/reading 70, listening 40 | 95 | Track a condition across sentences and identify why a plan changes |
| [N1](datasets/jlpt/n1.json) | 2,658 | 221 | Knowledge/reading 110, listening 55 | 100 | Reconcile authors’ positions and identify a speaker’s qualified endorsement |

Counts are incremental Echo curriculum bands. A learner choosing N1 may still need N3 foundations. Show lower-level gaps separately and let an independent successful check carry across levels when the target and tested skill match. JLPT publishes abilities and item types and withholds exhaustive lists of tested words and grammar. [Official FAQ](https://jlpt.jp/sp/e/faq/index.html)

## Data contract

- [Exam profiles](datasets/jlpt/exam-profiles.json) encode timed blocks, scoring sections, their floors, overall thresholds and item-type membership. Array order within each skill is for lookup. For N5/N4, language knowledge and reading share one 120-point reporting section with a 38-point floor. For N3/N1 there are three 60-point sections, each with a 19-point floor. Distinguish clocks from score groups. Official scores are scaled. Report raw practice accuracy and timing separately. [Composition](https://www.jlpt.jp/e/guideline/testsections.html) · [Scoring](https://www.jlpt.jp/e/guideline/results.html)
- Level files retain Echo's numeric JMdict word IDs, written forms, readings, English glosses, POS codes and available alternate kanji forms. Grammar rows carry the existing catalogue ID and title. Run `node tools/build-jlpt-inventories.mjs` at the repo root to regenerate. These JSONs are research/authoring inputs. Packaging both these files and the entire runtime catalogue would duplicate data.
- [Pilot items](datasets/jlpt/pilot-items.json) contain 16 original drafts, four per level, with prompts, choices, explanations, reading passages and listening scripts. Vocabulary and grammar targets resolve against the same level inventory. Reading/listening target strings identify the comprehension skill. Use `skill` to interpret the target. Hide scripts until review, synthesize or record audio, and use choices spoken aloud where the official format requires it. The pilot stores a zero-based answer index. Convert once to the existing exam engine’s one-based key. The authoring samples still need Japanese editorial review, audio QA and learner trials.

## Source decisions

| Source | What it contributes | Decision |
|---|---|---|
| Official JLPT guides and public examples | Current section structure, item families and reference tasks | Use as the blueprint and link learners to samples. Keep year and origin explicit when describing a form. [Public examples](https://www.jlpt.jp/e/samples/forlearners.html) · [JLPT notice on exam questions](https://jlpt.jp/sp/e/topics/202401191708325175.html) |
| Echo vocabulary catalogue | Existing JMdict entries and approximate level assignments | Vocabulary subsets are derived from JMdict, © Electronic Dictionary Research and Development Group, CC BY-SA 4.0. Level credits in Echo name Jonathan Waller (Tanos, CC BY), via jamsinclair/open-anki-jlpt-decks and elzup/jlpt-word-list. This extraction filters by level and preserves the upstream fields. Retain attribution with redistributed vocabulary data. [Source header](words-data.js) · [EDRDG](https://www.edrdg.org/edrdg/licence.html) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Echo grammar catalogue | An existing index based on the learner’s Bunpro catalogue | Export the existing identifiers and pattern titles. Author Echo examples, explanations and contrasting patterns separately. [Source header](grammar-data.js) |
| OpenJLPT | Alternative open inventory, example-sentence links and field attribution | Candidate for missing contexts. Match by dictionary identity and sense, retain per-field notices, then sample Japanese and translation quality before importing. Level assignments may differ. [Dataset and provenance](https://github.com/evanclan/OpenJLPT) |
| Todaii and Migii | Public multi-level mock catalogues and prediction-test offerings | Borrow the level picker, separate full forms from short drills and label Echo editions clearly. Public product pages establish the offering. They do not establish access to a shared exam database. [Todaii](https://japanese.todaiinews.com/en/exam) · [Migii](https://jlpt.migii.net/en/prediction-test/detail/index.php) |

## Implementation order and acceptance checks

1. **N5 first.** In Practice, select a level and start a short diagnostic covering all four skills. Replace the hard-coded N2 phase sequence and score grouping with the selected profile. N5 exercises three timed blocks and two reported scores, exposing both assumptions in one small release. Verify that leaving the vocabulary block locks its answers and reload resumes the correct timer.
2. **N1 next.** It follows the learner’s N2 sprint and exercises advanced material. Include a pair of texts with genuinely different arguments and a multi-speaker decision with competing constraints. Review the distractors for plausible alternative readings. N1 omits the standalone orthography item type and includes integrated listening. A shorter N2 form would miss both differences.
3. **N4 and N3.** N4 can reuse the N5 phase model and adds vocabulary usage questions. N3 uses three timed blocks and three reported scores. Its long reading and listening gist tasks need distinct content. Lower levels also require situational spoken-expression tasks. Prepare original illustrations for visual tasks and test the audio-only experience.
4. **Connect the learning loop.** Keep the selected level in URLs, paper edition IDs, attempts, exports, adaptive generation prompts and radio queues. Preserve old N2 snapshots and default older exports to N2 at the boundary. In sprint mode prioritize weak dimensions and a fresh next-day check on unseen material. For maintenance use the existing FSRS design per target and dimension. A passive replay records exposure. [Learning design](N2-LEARNING-AUDIT.md)
5. **Scale after the first independent form per level.** Map each official item family to a reviewed example, establish counts and option/audio display conventions against the level-specific reference materials, then commission original questions until each form is complete. Track passage overlap and reserve unseen material for evaluation. The prior N2 product goal was 20 forms. Decide the production budget per added level after timing the first reviewed form.

**First merge criterion.** A learner can take the N5 pilot, miss a listening question, resume after reload, export the correct level and target, and receive a fresh listening check the next day. Their N2 history still opens with its original keys. Keep form completion, inventory coverage and delayed unaided accuracy visible separately.
