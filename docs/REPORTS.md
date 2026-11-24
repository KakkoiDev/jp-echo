# Flags and bug reports

The learner flags cards and reports problems from any screen (the report
button in every head; ReportSheet in COMPONENTS.md). Each report is saved on
the device (`jp-echo-reports`, reports.js) and synced to the learner's backup
gist as `echo-reports.json`, beside `echo-backup.json`.

## Reading them (maintainers and agents)

```
node tools/reports.mjs            # open reports, newest first
node tools/reports.mjs --all      # include withdrawn and fixed
node tools/reports.mjs --json     # raw records
```

The tool finds the newest gist described "Echo backup …" with the signed-in
`gh` CLI. A report names its screen path, the app build (`jp-echo-vNNN`),
reasons, the learner's note and, for a card, what it was: a sentence id and
text, an N2 word target, a check with its example, or an exam question with
its `source` (`n2-set-N#index`).

## Marking a fix

Edit `echo-reports.json` in the gist: set `status` to `"fixed"`, add `fix`
(a commit or a line saying what changed) and set `updatedAt` to now. The next
sync on the device merges by `updatedAt`, so the fix comes back to the app.
Do not delete reports; a delete is undone by the next sync from the device.
