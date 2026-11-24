# Echo UX/UI handoff for the designer

**Sprint outcome:** [Two-week program and readiness checkpoint](N2-TWO-WEEK-PROGRAM.md). The N2 hub now evaluates recent first sittings and points to the weakest section.


**Design the journey from “I missed that” to “I can use it tomorrow.”** The learner has six hours on sprint days, also wants a sustainable ordinary routine, and moves between a phone with headphones and a desktop. Build on Echo’s existing Japanese washi-and-seal design, its light/dark themes and its mobile-first layouts. [Maintainer principles](CLAUDE.md) · [Shared components](COMPONENTS.md) · [Existing design work](docs/design/november/README.md)

## Where the learner goes

| Home | Question the screen answers | Visible entry and next action |
|---|---|---|
| Practice | What can I practise right now? | Surface the current goal, Resume and JLPT exams. Offer sentence creation, conversation and reading through the existing practice/tools navigation. Results offer a relevant drill and a return to the plan. |
| Review | What can I recall today? | Preserve Start review as the primary action. Show the active exam date and how it changes order. Offer N2 recall even when no deck sentences are due. Put progress and session history in the existing stats tab. |
| Library | Where did that word or passage go? | Save with its source sentence, audio context and skill. A saved item links back to its passage and forward to practice. Keep import/export discoverable under their existing names. |
| Radio | Can I keep learning while my hands are busy? | Give Day and Night clear entrances and retain voice, pace, pause and resume. Day Listen feeds tomorrow’s listening checks. Day Recall pauses before revealing. Night playback stays passive. |
| Settings | What can I change or take with me? | Expose voice, AI provider, review limits and backup. Link to the same goal editor from Review and Practice. Explain what works offline and which actions use a configured provider at the moment of choice. |

## Prototype these three journeys

1. **A first-time learner with no API key.** Practice → JLPT → set an exam date and an optional first-pass duration → see the first action → complete a short local session. Show the finish date as a calendar date. Explain that the goal is still usable before importing a sentence deck. When a daily load exceeds available time, show what moves and let the learner choose a later goal.
2. **One mistake across several activities.** The learner reads 就任 correctly and misses its meaning in a dialogue. Results show the decisive line and offer “Practise listening.” Day Radio plays it in a sentence while they walk. Tomorrow Review asks for its meaning in a new dialogue, hides the transcript and records the answer. Show the listening improvement and preserve their separate written evidence. Let the learner inspect the evidence behind the recommendation.
3. **Returning after a missed week.** Show the existing deadline, due work and an honest revised estimate. Offer Resume, shorten today’s session or adjust the goal. After the exam, keep sentence Review available and offer a maintenance path. Changes to the calendar preserve previous attempts, paper editions and historical grades.

## Interaction and accessibility contract

Use one primary action per state. Use consistent words for *heard*, *checked once*, *recalled on another day* and *understood in a new passage*. A percentage always names its denominator. Give every feature a reachable labelled entry even when the recommendation points elsewhere. Keep one implementation of each action and offer links to it from relevant places. Show tappable text alongside unfamiliar kanji glyphs. Prefer the existing typography, icon controls and spacing tokens.

Design the new-user, due, completed, offline, missing-voice, missing-provider, save-failure and expired-goal states. In exam mode hide answer cues until submission. In study mode make explanations, slower playback and transcripts reachable after the attempt. Check keyboard order, screen-reader names, dynamic text size, visible focus, sufficient contrast and reduced motion. Keep playback controls reachable one-handed. Announce a saved grade once and preserve the existing undo behavior.

## Open-source designer deliverables

Place editable design sources, a component/state inventory and annotated mobile/desktop screens in the repo. Include the tokens and example data a contributor needs to reproduce each screen locally. Use fictitious attempt data in screenshots. Document asset authorship and license alongside donated graphics or audio. Make a short issue template for reporting a confusing learning flow with route, expected action and observed behavior. Favor improvements contributors can ship individually.

Deliver a clickable prototype of the three journeys, a map of how each existing feature is reached, and a table mapping proposed components to existing primitives. Test discoverability by asking a newcomer to set a date, find the full mock, recover a listening mistake, resume interrupted radio, and export results without coaching. Report where they hesitated, wrong turns and completion. Keep measured observations separate from proposed design changes. The multi-level datasets support design fixtures. Only N2 currently has the live exam planner.
