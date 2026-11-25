# Echo UX and bug handoff · 25 November 2026

**Fix the paused exam and restore preview first.** One can silently change a learner’s score. The other can show the wrong information immediately before a restore.

Audited main at [cdded7f](https://github.com/KakkoiDev/jp-echo/commit/cdded7f) against the [24 November handoff](ECHO-POST-UPDATE-HANDOFF.md). The revision picker, all-data download and first-display exposure tracking from that handoff have shipped. This pass covers the changed mock, results, readiness and recovery flows. The full suite passed (779 tests), as did the syntax check. Focused checks below used the current modules or extracted application handlers with synthetic state. The visual review used the repository’s post-change mobile captures. Physical-device playback, live Gist recovery and assistive-technology behavior still need device testing.

## 1. A paused exam still accepts keyboard answers and navigation · high

**Reproduce.** Start a written mock. Pause it, press 2, then Right Arrow, then resume. The answer and current question can change while the question is hidden. In a focused handler test, a paused two-question attempt moved from index 0 to 1 and its answers changed from [0, 0] to [2, 0]. Navigation also calls the code that marks a question as shown. This can contaminate both the score and the record of unseen material.

**Repair and acceptance.** In the exam controller, guard input and exposure recording with the same active-and-unpaused predicate. Keep Resume and Leave available. Exercise digits, arrows and F, plus pause → reload → resume. While paused, answers, guesses, question index, exposure timestamps and answering time must stay unchanged. After resuming, the first key press should work normally. See [exam controller](n2-mock.js).

## 2. Earlier saves can display a different revision’s preview · high

**Reproduce.** In Backup → Earlier saves, choose revision A and quickly choose B while the list is still visible. In a controlled interleaving, both Gist reads completed, B’s local comparison finished first, then A’s. The rendered date was B, the difference text described A, and Apply held B. A learner can make the restore decision using the wrong counts.

**Repair and acceptance.** Build one preview object containing revision, documents and difference. Publish it and enable Apply only if the request still matches the latest selection. Invalidate pending work on Back, close or reopen. Test A→B with delayed responses in both orders. The visible date, counts, difference, Apply payload and success message must all name B. See [previewSave and openSaves](app.js).

## 3. The preview understates what a restore can change · high

**Reproduce.** Compare an empty device with a backup containing one report. The current preview helper returns “Everything in this save is already on this device.” The apply path imports the report. Saved vocabulary, notes and the training goal can also change without contributing to the preview’s difference counts. There is a second mismatch: the preview suppresses a sentence covered by a newer local deletion, while explicit library import clears that deletion and can bring the sentence back.

**Repair and acceptance.** Share the restore decision logic between preview and apply. Distinguish additions, updates and recoveries of previously deleted records. Until coverage is complete, use narrower wording such as “No additional exams or sentence reviews found.” Test report-only, saved-word-only, goal-only and previously deleted sentence fixtures. Compare the displayed delta with storage after Apply. See [restore preview](restore.js) and [applyDocuments and importBackupData](app.js).

## 4. Checkpoint progress can say “2 of 2” while the checkpoint is unmet · medium

**Reproduce.** Supply three fresh, passing first sittings: one yesterday and two today. The checkpoint intentionally evaluates the latest two eligible forms. They share a local date, so the result is false. The label independently counts passing forms and says “2 of 2 so far.” This gives contradictory guidance exactly when the learner needs to decide tomorrow’s plan.

**Repair and acceptance.** Preserve the documented latest-two rule. Render the unmet condition, for example “Both scores cleared the floor. Take a fresh mock on another day.” Test same-day passes, separate-day passes, a failed section and an expired result. Show one reason and one next action. Also decide whether an emergency-paused mock qualifies as exam-condition evidence. The current calculation ignores pause duration. See [checkpoint code](n2-study.js) and [program rules](N2-TWO-WEEK-PROGRAM.md).

## 5. The weakest-reading action opens general recall · medium

**Trace.** On Results, a learner whose weakest section is reading can see “Drill my weak items · 読解 first.” The link opens the generic weak-item recall queue. That queue can choose vocabulary or grammar and cannot deliver a reading passage. The listening branch similarly opens Day Radio recall. This is a mismatch between the promised task and its destination. See [resultActions and recall entry](n2-mock.js) and the [current results design](docs/design/n2/pr/results/after-results-dark.jpg).

**Repair and acceptance.** Route a reading weakness to an existing reading passage or comprehension-tag drill, listening to an appropriate listening question, and language knowledge to a targeted recall queue. When evidence is insufficient, use a neutral label describing the actual fallback. Complete a fixture for each weakest section and verify the first exercise after tapping the action.

## UX changes to make next

| Screen and learner need | Suggested change | How to tell it works |
|---|---|---|
| Today, returning mid-mock | Keep the single Start button. Add a compact **Resume mock · 1 of 105 answered** action when a sitting is active, with its running or paused timer status. The current capture promotes a five-minute check above a live sitting. | A returning learner can find the running timer and resume from the first mobile viewport. [Hub capture](docs/design/n2/pr/hub/after-hub-dark.jpg) |
| Results, deciding what to do tomorrow | Keep **Back to the plan**. Give the adjacent practice action a concrete task, such as **Practise reading · 1 passage**. On returning to Today, identify the block that uses that result. | A learner can name their weakest section, enter the matching exercise and return to their plan without reselecting a skill. |
| Backup, choosing between everyday sync and recovery | Lead with **Last uploaded** and **Changes waiting on this device**. On an earlier save, show its date, the local changes it would make, and **Merge this save** next to those counts. Keep file export available for offline recovery. | A learner can answer “Has this phone’s last exam uploaded?” and “Which saved words or exams would this restore?” before acting. |
| Review, understanding “Previous” | Choose an explicit interaction: **View previous answer** for read-only inspection, or **Change last grade** for a durable correction. Today the control rolls back the session tally in memory before a replacement grade is written. | Grade, go back, leave and reopen. The displayed count, stored grade and synced recall history should agree with the action’s label. |

Ship the first three fixes with behavioral regression tests. Then verify one interrupted mock and one revision restore on a phone and desktop with a disposable Gist. Use snapshots to check layout and persisted records to check what actually happened.
