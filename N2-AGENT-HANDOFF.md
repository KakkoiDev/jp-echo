# Echo N2 handoff · 24 November 2026 · learning audit

**Sprint outcome:** [Two-week program and readiness checkpoint](N2-TWO-WEEK-PROGRAM.md). The N2 hub now evaluates recent first sittings and points to the weakest section.


**Current packet:** [AI handoff index](ECHO-AI-HANDOFF-INDEX.md) · [Designer brief](ECHO-DESIGNER-HANDOFF.md) · [Spaced-repetition research](ECHO-SRS-RESEARCH.md). The N2 hub and Review share an editable exam goal. The optional duration sets the first-pass deadline from the day it is set. Changing only Review priority preserves that anchor. Due imported N2 word and grammar sentences can move ahead within the existing limits. The goal is included in the N2 analysis export. This integration is live code for N2; use it as the starting point for the other level profiles.


**Start with a budgeted delayed-check session in Practice → N2 exams & study.** The learner has six hours per day before December 6 in Japan. Their question is “Can I recall this tomorrow and use it under exam conditions?” Keep first exposure, first check, delayed recall and transfer visible as different milestones.

Read the [audit, research and scheduler designs](./N2-LEARNING-AUDIT.md), [N2 workflow](./N2-PRACTICE.md), [export notes](./N2-EXAM-DATA.md), [maintainer guide](./CLAUDE.md) and [components](./COMPONENTS.md). Baseline before this patch is `c098b8b`. This change bumps the offline cache to v235. The data stores and paper IDs retain their existing formats.

## Current implementation

| Path | Where to start |
|---|---|
| `n2-mock.html`, `n2-mock.js` | Hub, timed mocks, results, recall screen, Day Radio, next-day checks and daily AI coach. |
| `n2-study.js`, `day-radio.js`, `speech.js` | Exam calendar, quotas, mastery display, radio queue and player. Each completed radio sequence may log exposure. A rating produces a separate retrieval event. |
| `n2-progress.js`, `n2-adaptive.js` | Local attempts, snapshots, event export, weakness selection and generation via configured provider. Inspect `scored`, `priorities` and `validateGenerated`. |
| `n2-forms.js`, `n2-sets/`, `n2-inventory.json`, `decks/n2-*.json` | 20 Echo forms including 19 authored 105-item sets, the 1,748-word and 221-grammar inventory, examples and stable paper editions. |
| `srs.js`, `test/day-radio.test.js`, `test/n2-*.test.js` | Existing sentence scheduler and regression fixtures. Full checks are `npm test` and `npm run check`. |

## Next changes, in order

1. **One action for today's delayed checks.** Start with yesterday's misses and uncertain answers across print and audio, mix meanings and grammar, use an unfamiliar context when available, reveal the cue after an attempt, and save source, modality, context ID, assistance and elapsed active time. If there is only one context, label it. Acceptance case: someone knows the reading of 就任, misses its meaning in a dialogue, then understands it in a different dialogue tomorrow. Only the listening evidence improves.
2. **Fit the day to the learner.** Forecast new-item capacity from measured pace, reserve reading and listening minutes, and cap both standard and AI plans at six hours including breaks. Surface the finish date for first checks and a separate delayed accuracy measure. Test zero history, missed days, slow pace, a scheduled full mock, the last acquisition day and the eve.
3. **Make comprehension actionable.** Give each passage or dialogue a stable identity and reviewed skill tags. Start with changes of plan, speaker intent, implicit conclusions and exceptions. Allow AI to generate a new scenario from a tag, save the full paper snapshot, and hold some comparable passages out of training. Include a human Japanese review of a sample from each question type before treating scores as readiness evidence.
4. **Add maintenance scheduling.** Extend the existing FSRS wrapper to cover the documented rating mapping per target and dimension. Keep event IDs stable, replay older records conservatively, and compare held-out predictions against defaults before enabling personalized parameters.

## Reproduction and release checks

Run `npm test`, `npm run check` and `git diff --check`. The regressions exercise a skipped radio item, failed synthesis, a checked inventory, a fresh second batch, a later listening pass alongside a written miss, adaptive exam evidence, and consistency between the acquisition calendar and the daily plan.

On a phone, play two items, skip the first during speech, finish the second, reload and inspect the JSON export. Expect a completed exposure only for the second. On the following local day, rate that item, return to the hub and confirm the count decreases. Exercise backgrounding, headphone interruption, missing Japanese voice, installed-PWA offline start and a real provider-generated listening question. Physical audio, phone lifecycle, live-provider quality and the learner's actual retention still require verification. The persisted attempts belong to the browser profile. Use an exported copy for analysis and keep provider credentials out of fixtures.

Two limitations worth checking before extending the AI coach: its saved daily plan can become stale after new results, and an interrupted provider response can produce fewer questions than requested. Make the delivered count visible. Audit backup/restore separately before promising device migration.

Audit verification on the patched tree: all 646 repository tests passed, syntax checks and diff checks passed, and the local browser rendered the Recall tab with a 40-item queue and the Japanese prompt concealed before playback.
