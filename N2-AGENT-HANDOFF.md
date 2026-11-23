# Echo N2 handoff · 24 November 2026

**Start with Day Radio.** The learner is preparing for the JLPT N2 in Japan on Sunday, December 6, with up to six hours a day. They want to identify words and grammar they hesitate over, hear those items while awake, then prove they can recall them in a fresh context the next day. The exam and study hub is deployed. Day Radio and the dedicated next-day check are the missing parts of that daily routine.

**Verified baseline:** `KakkoiDev/jp-echo`, branch `main`, commit `0d375cfe9658c325b8f9409d54bb9fcb6bf0a899`, service worker cache `jp-echo-v231`. Repository tests and Pages deployment succeeded for this commit. Check the current head before editing. [Production hub](https://echo.kakkoi.dev/n2-mock.html) · [Deployment](https://github.com/KakkoiDev/jp-echo/actions/runs/45221830847)

## What the learner can do today

| Area | Shipped behavior | Important boundary |
| --- | --- | --- |
| Practice | Open **Practice → N2 exams & study**. Choose from 20 Echo forms, plus two official workbook companions. | Set 01 has 101 authored questions. Forms 02–20 each have 101 questions built from themed templates. Across those 19 forms the vocabulary section has 570 distinct targets. Grammar exercises and comprehension structures recur. Raw scores are uncalibrated. |
| Recall | Check 1,748 vocabulary entries and 221 grammar points. Word meaning, written-word reading and grammar have separate queues. Learners can reveal and rate Instant, Slow or Missed. | The reading queue skips spellings that already give away their reading. A fast self-rating on two separate days contributes to the quick-recall count. Tagged exam answers are a separate kind of evidence. |
| Reading and listening | Inspect passage-level comprehension and confident answers. Listen to Japanese device speech in Echo forms or publisher recordings in official workbooks. | Word pronunciation and passage comprehension measure different skills. In forms 02–20, 20 of the 30 listening items are spoken-word recognition drills. |
| History and export | Resume an attempt, submit sections, revisit results, archive a completed attempt when starting another, and export study JSON for an external agent. | Current state lives on this browser profile. The dedicated JSON export supports analysis. Treat import/restore and integration with the general Echo backup as separate work. |
| AI | **Analyze with my AI** summarizes performance. **Create targeted exam** sends selected weak evidence through the configured provider, including DeepSeek when selected. A validated generated paper keeps its questions and evidence links. | Generating a paper requires usable provider settings and some weak evidence. Earlier checks used a simulated provider. A real user-key request and Japanese playback on the learner’s phone still need end-to-end verification. |

The learner specifically rejected treating the 2012 and 2018 workbooks as the main offering. Keep recent material and in-app Japanese questions prominent. The date on an Echo form is its edition date. Some publishers advertise mocks patterned on a recent sitting, and some schools publish teacher recollections. Describe provenance precisely when adding material.

## Where to work

| Files | Responsibility |
| --- | --- |
| `index.html`, `n2-mock.html`, `n2-mock.js` | Practice entry, N2 hub, exam navigation, timers, resume, results and retakes. |
| `n2-echo-bank.json`, `n2-forms.js`, `n2-inventory.json` | Original paper, deterministic forms and N2 study targets. Freeze question order, answer choices and keys for saved attempts. Use a new paper ID when revising a published form. |
| `n2-progress.js`, `n2-adaptive.js`, `api.js` | Recall evidence, scoring, export, targeted generation and the shared provider interface. Send learner data when they select the AI action. Keep credentials out of exports and fixtures. |
| `radio.js`, `speech.js`, `app.js`, `test/radio.test.js` | Existing Night Radio queue, player and UI. The queue selects previously reviewed sentences by recency. The player already accepts playback steps and pauses. |
| `sw.js`, `test/n2-practice.test.js` | PWA precaching and committed N2 regression checks. Update the cache version and asset list for shipped module or data changes. |

Read the [maintainer guide](./CLAUDE.md), [component guide](./COMPONENTS.md), [N2 workflow](./N2-PRACTICE.md) and [export contract](./N2-EXAM-DATA.md). The N2 recall queue currently runs inside the N2 hub. Prioritizing N2 items inside Echo’s ordinary sentence review is still outstanding.

## First implementation milestone

1. **Day Radio under Radio → Day.** Reuse the existing player. Build a daytime queue from explicit weak word and grammar targets, including mock guesses and misses. Keep room for unchecked N2 items. In **Listen**, play the target, meaning and a natural example. In **Recall**, play a fresh prompt, leave a configurable pause, then reveal. Support repeat, practice later and resume. Show a clear fallback when a target lacks a usable example.
2. **Record exposure and recall separately.** A passive play records exposure. A deliberate learner rating records self-reported recall. Give each event a stable target, skill, timestamp and context identifier. Keep reading, listening and meaning distinguishable. Extend the export compatibly so another agent can tell which evidence it received.
3. **Check yesterday.** Offer a short next-day session seeded by prior weak items and Day Radio exposure. Use a different example when available. A sample acceptance case is a learner who understands 見通し in writing, misses it by ear, hears it on Day Radio, and gets a fresh listening check the following day. Their written-reading score should change only after a written-reading check.
4. **Verify on a phone before promising continuous playback.** Test screen lock, headphone interruption, foreground return, offline behavior and the selected Japanese voice. Night Radio has screen wake-lock coverage. That test does not establish background playback on a locked phone.

After that milestone, improve the independence and exam fidelity of forms 02–20. Prioritize longer reading passages, plausible distractors, dialogues and native-speed listening. Preserve existing paper snapshots and comparison history when publishing revised editions.

## Verification and known gaps

From a checkout, run `npm test`, `npm run check`, and `node --test test/n2-practice.test.js`. Serve the checkout with `python3 -m http.server 8000` and open `http://localhost:8000/n2-mock.html` in a disposable browser profile.

The committed N2 tests cover form counts, answer-key integrity, distinct themed vocabulary targets, inventory cues and when a section becomes scoreable. Earlier temporary harnesses also exercised reload, retake/archive isolation and adaptive generation with a stub provider. Promote those flows to committed browser tests when changing persistence or AI behavior.

For an end-to-end smoke test, mark a grammar item Missed, answer and flag a mock question, reload, submit the section, and inspect the study export. Generate a targeted exam from the saved evidence. Confirm its focus points back to the triggering mistake and that a later retake preserves the original answers. Check an old workbook bookmark as well. Use a dedicated test profile and never clear the learner’s real history.

Two follow-up cases deserve attention. Adaptive selection can keep surfacing an older mistake after a more recent success on the same target. Compare timestamps and evidence before calling a weakness current. Also check concurrent tabs answering the same attempt before strengthening any guarantees about saved history.

## Suggested study cadence

The original target was a baseline on November 24, first-pass checks of 195 words and 25 grammar points on seven days through December 1, a second mock on December 2, then the remaining checks by December 4 and weak-item retests on December 5. This is a planning assumption. The next agent should use the learner’s exported counts and accuracy to adjust it. No personal scores or progress export were supplied with this handoff.
