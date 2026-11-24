# Echo audit and cross-device recovery handoff

24 November 2026. Start here after reading the earlier N2 handoff. The audited upstream revision was `e2d63e4`. It already shipped two-way Gist sync, device pairing and report sharing. Keep that implementation. The immediate product need is knowing whether yesterday’s work can be recovered on a fresh phone.

## What the learner can do

| Situation | In Echo | Result |
|---|---|---|
| Set up the first device | Settings → Backup → Sync with a GitHub gist. Enter a token with Gists read and write, leave the Gist field blank on first setup and select **Sync now**. | Echo creates a secret Gist and remembers its address. Keep the URL somewhere you can access if you lose the device. Anyone with that URL can read the Gist. |
| Add a phone or computer | On the connected device, Settings → Backup → Link another device → **Make a link**. Open the link or scan the QR on the other device and enter the unlock code. | Both devices share the same Gist. Before switching immediately after a study session, use **Sync now** on the first device, then on the second. |
| Recover after losing a device | On a fresh installation, **I have a backup file, or a gist** opens Import. Paste the Gist URL and select **Bring it in**. Settings → Backup → **Restore from gist** also works. | Echo merges each supported file present and names the groups restored. A library-only legacy backup works. Configure sync credentials to enable future writes. |
| Recover an earlier save | Open the Gist’s revision history. Paste the dated revision page URL into Import. | Echo reads that revision and merges its contents. Newer local history can win conflicts. A clean browser profile is the clearest place to inspect an older snapshot. |
| Switch during a timed mock | Resume on the device where you started. Finish it and sync before switching devices. | Finished sittings join the shared history immediately. The running timer and unanswered items stay on the original device. |

## Findings and changes

- **Readiness.** Short samples and targeted drills could expose questions from a full mock and leave it eligible as a fresh checkpoint. Drill preparation now records the source exposure. The planner checks it before using a full sitting as readiness evidence. This is conservative when someone prepares and abandons a drill. It does not reconstruct every item a learner saw before tracking existed.
- **Recall and feedback.** Delayed listening checks require completed playback before grading. A learner can retry or skip a failed playback. Day Radio grades and cause edits on archived results now reach the save confirmation. Review mistakes made from the same source should keep the same context across copies.
- **Backup coverage.** Manual Gist restore used to import only the library and reported success from the number of new sentences. It now fetches and validates the file groups before applying them, and reports which groups succeeded. A failure during a store write can leave earlier writes applied. Retrying merges by identity. A failed notes or words read now stops export or sync instead of turning that store into an empty collection.
- **Sync correctness.** A pull that finds local-only work keeps it queued for upload. A page records only the file hashes it merged or wrote. A newer goal deletion survives a stale goal. When GitHub reports an intervening parent revision after a write, Echo records it and merges the affected files on a subsequent sync. The simulated conflict test restarts the sync between displacement and recovery.
- **What travels.** The Gist holds the library, saved words and notes, N2 papers and finished attempts, recall, Day Radio events, the training goal and reports. The ordinary library JSON download still has a different scope. The N2 analysis export includes attempt-level evidence for an AI. Credential transfer is a separate pairing action.

## Next work, in order

Status after the follow-up pass (24 November, after `23aec93`):

1. **Real devices against one disposable Gist — owner run still needed.** Automated and scripted coverage now includes a live run against a throwaway Gist (two simulated devices; adds, a delete, an error-cause tag; listing saves; reading an older revision; preview and restore). What remains needs the installed PWA and a desktop browser. Checklist for the owner, on a disposable Gist:
   - On each device, review a different card while offline; finish one N2 exam on one device.
   - Reconnect both; **Sync now** on each, twice. Compare: review count on the shared card, the exam's answers and timings, the goal, a report's status.
   - On a clean browser profile: Settings → Backup → **Choose a save**, pick the latest, check the preview counts, **Bring it in**.
   - Revoke the token on GitHub; confirm Backup shows "GitHub rejected the token" and nothing local is lost. Make a new token and sync again.
   - Start a restore and close the tab midway; reopen and restore again: counts must match a clean restore.
2. **Done.** Backup → **Earlier saves** lists the Gist's revisions (seconds shown), previews what a save holds and what is new to this device, and restores through the one restore path (`readGistDocuments` → `validateDocuments` → `applyDocuments`). The status line shows **last upload** and **last check** separately. **Download everything** saves the three sync documents in one file (`restore.js` `allDataBundle`); Import restores it offline (`importAnything`).
3. **Done.** Each exam question records its first display (`shownAt` on the attempt; `firstShownAt` on drill papers, which are made `shownTracked`). `drillExposure(papers, attempts)` counts only shown material from the moment it was shown: an unopened drill reserves nothing, a partial drill reserves what was seen. Drills made before tracking keep the conservative creation-time rule, so historical readiness does not change. Tests: unopened, partial, shown-after, legacy, retake, unseen sitting (`test/n2-study.test.js`).
4. **Done.** Error causes from two devices on one attempt are combined per question (`mergeCauses`; the later dated edit wins via `causesAt`, ties settle identically everywhere) and are part of the N2 signature, so devices converge instead of each keeping its own. Same-millisecond sentence edits settle on one copy everywhere (`breakTies`) with reviews combined. A merge interrupted by a failed write is retried on the next sync (`test/sync.test.js`).

Still open: a restore applies groups one after another, so a failure in a later group leaves earlier groups applied (retrying merges by identity, as before). Clearing a cause on one device does not clear it on another (a cleared tag has no tombstone).

## Engineering entry points

- Sync engine, Gist transport and mock backend tests are in [sync.js](sync.js), [gist-backup.js](gist-backup.js) and [test/sync.test.js](test/sync.test.js).
- The Backup screen and import actions are in [app.js](app.js). N2 persistence is in [n2-progress.js](n2-progress.js). Practice and playback entry points are in [n2-mock.js](n2-mock.js).
- For learning design, use the [two-week program](N2-TWO-WEEK-PROGRAM.md) and [SRS research](ECHO-SRS-RESEARCH.md). The [handoff index](ECHO-AI-HANDOFF-INDEX.md) links the designer and level-expansion briefs.
- Run `npm test`, `npm run check` and `git diff --check`. The browser smoke check uses the local app and its real settings controls. No learner Gist or credential was used. GitHub documents the [Gist API](https://docs.github.com/en/rest/gists/gists) and [secret Gist visibility](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists).
