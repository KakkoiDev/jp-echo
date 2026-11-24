# Three learning journeys (designer handoff, 24 Nov 2026)

The boards in `boards/` are the designer's sources for this pass, exported
from the redesign canvas (row "Echo AI handoff (24 Nov) — three learning
journeys" and row "Saved words"). Each is plain HTML with every value inline;
`*Dark` is the same screen in the dark theme and `*360` the same screen at
360 px. All attempt data on them is fictitious. Where a board and the repo
disagree, the repo wins; the disagreements are listed below.

The owner confirmed all four proposals (the Practice goal row, Radio
entrances, EvidenceRow and PauseRing) on 24 Nov.

## Components and states

New reusable pieces live in `components.js` and are documented in
`COMPONENTS.md`: PlanSteps, LoadMeter, ExamLine, EvidenceRow, PauseRing, and
(saved words) SavedMark. Everything else reuses existing primitives
(library-tool rows, notice, sheet-dialog, drill card, rule-heading).

| State | Where | Built in |
|---|---|---|
| New user | J1Practice goal row; J1Today short sample | `app.js` `renderWelcomeN2`; `todayPlan({baseline})`, `startSample` |
| Due | J2Review card; J3Return | `app.js` `renderReviewN2` |
| Completed | J1Done | `n2-mock.js` `doneCard` |
| Offline | StOffline | `n2-mock.js` `offlineNotice` |
| No voice | StNoVoice | `n2-mock.js` `voiceCheck` |
| No provider | J1Goal note, StNoProvider sheet | `#training-no-ai`, `needProvider` |
| Save failure | StSaveFail | `n2-mock.js` `saveFailed` / `saved` |
| Expired goal | J3After | `drawToday` (days < 0), `maintenancePlan` |
| Over budget | J1Overload | `todayPlan().overflow`, `drawToday` |

## Board → code

| Board | Status | Code |
|---|---|---|
| J1Practice | Shipped | `index.html` `#welcome-n2`, `app.js` `renderWelcomeN2` |
| J1Goal, J3Adjust | Shipped | `n2-mock.html` `#training-goal`, `n2-mock.js` `goalEditor` |
| J1Overload | Shipped | `n2-study.js` `todayPlan` overflow; `n2-mock.js` `drawToday` |
| J1Today | Shipped | `drawPlan` (PlanSteps + one Start button) |
| J1Done | Shipped | `doneCard` |
| J2Result | Shipped | `n2-sets/cues.json`, `decisive`, `byMondai`, `resultActions` |
| J2Radio | Already in the app | Day Radio Listen (`dayRadio`) |
| J2Recall | Shipped | PauseRing via `DayPlayer.onRing` |
| J2Review | Shipped | `renderReviewN2`, ExamLine |
| J2Check, J2CheckAnswered | Shipped with a disagreement | `checks()` evidence line |
| J2Evidence | Shipped | `n2-delayed.js` `evidenceFor`, `openEvidence` |
| RadioEntrances | Shipped | `index.html` `#radio-view`, `renderRadioResume` |
| J3Return | Shipped | `renderReviewN2` (gap ≥ 3 days) |
| J3Short | Shipped | `shortenPlan`, `drawToday` |
| J3After | Shipped | `drawToday`, `maintenancePlan` |
| StOffline, StNoVoice, StSaveFail, StNoProvider | Shipped | see the state table |
| DesktopN2Today | Shipped with a disagreement | `.n2-hub-grid` |
| SavedStates, SavedWords(Empty), LibraryToolsSaved, WordSaved, WordUnsaved | Shipped | `saved-words.js`, `app.js`, SavedMark |

## Disagreements (Board / Code, and why)

- **J2Check / J2CheckAnswered.** Board: a new multiple-choice dialogue
  ("Why is the woman busy in April?"). Code: Today's checks plays a sentence
  the learner has not heard, hides the text until the answer, then asks for a
  self-grade. Echo has no authored dialogue per target word; inventing one
  per check would need a provider. The evidence line, the hidden transcript
  and "See the evidence" follow the board.
- **J2Result.** Board: a dedicated per-question result screen. Code: the same
  content (the line that decided it, the explanation, the count per 問題,
  "Practise listening" primary and "Back to the plan" outlined) inside the
  existing results review list, so every miss gets it.
- **J2Result "Play this line at 0.8×".** Not built: Echo's listening papers
  are synthesised, and replaying one line at a different rate needs a
  per-line player; the full script plays from each review item.
- **J1Overload.** Board: separate word and grammar lines. Code: one line for
  first checks (word and grammar share one queue), shown only when at least
  15 minutes do not fit.
- **J3Short.** Board has no way back; code adds a quiet "Back to the full
  day" link so a shortened day can be undone.
- **J3Return.** "Estimates use your pace from the last 7 sessions" → code says
  "last 7 days", which is what `measuredPace` measures.
- **StNoVoice.** Board: "Mock listening tracks still play — they are
  recordings." Code: only the official sample papers are recordings; Echo's
  own papers are spoken by the device voice, so the notice says so.
- **DesktopN2Today.** Board shows Echo's app sidebar. The N2 page is its own
  page (CLAUDE.md), so the desktop layout puts readiness beside the plan
  without the app sidebar.
- **Saved words.** See the merge commit: SPEC wording over pre-R1 board copy,
  no reader lines, the repo's chip text.

## Not done

- **Discoverability test** (JourneyTest board): it needs a newcomer and has
  not been run. Results go in a separate file from proposed changes.
- **Native review** of `docs/N2-REVIEW-SAMPLE.md` before scores count as
  readiness evidence.
