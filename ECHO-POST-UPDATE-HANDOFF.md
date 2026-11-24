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

1. Exercise an installed mobile PWA and desktop browser against one disposable Gist. Add a different review offline on each, finish one exam, reconnect, sync twice, and restore on an empty profile. Compare review IDs, attempt answers, timings, goal and report status. Repeat with a revoked token, an interrupted restore and a second sync after recovery. Automated coverage uses simulated devices and GitHub responses.
2. Put a dated restore picker in Backup with counts for library items, completed attempts and recall checks. Preview differences before applying. Show the last successful **upload** separately from the last check. Add a single portable all-data download using the existing three documents so disaster recovery also works offline.
3. Record actual first question display separately from paper generation. Test readiness across a partial drill, a retake, a skipped audio check and an uninterrupted unseen sitting. Preserve historical grades and their dates during any migration.
4. Evaluate merge ties for competing edits to the same attempt’s error causes. Add content-level conflict fixtures for same-timestamp edits and interrupted IndexedDB transactions before claiming general convergence.

## Engineering entry points

- Sync engine, Gist transport and mock backend tests are in [sync.js](sync.js), [gist-backup.js](gist-backup.js) and [test/sync.test.js](test/sync.test.js).
- The Backup screen and import actions are in [app.js](app.js). N2 persistence is in [n2-progress.js](n2-progress.js). Practice and playback entry points are in [n2-mock.js](n2-mock.js).
- For learning design, use the [two-week program](N2-TWO-WEEK-PROGRAM.md) and [SRS research](ECHO-SRS-RESEARCH.md). The [handoff index](ECHO-AI-HANDOFF-INDEX.md) links the designer and level-expansion briefs.
- Run `npm test`, `npm run check` and `git diff --check`. The browser smoke check uses the local app and its real settings controls. No learner Gist or credential was used. GitHub documents the [Gist API](https://docs.github.com/en/rest/gists/gists) and [secret Gist visibility](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists).
