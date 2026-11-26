# Brief: make the papers of one level stop repeating each other

Several writers wrote the papers of one JLPT level apart, and they reached for the same scenes. A player who meets one question in two bosses is tested on memory. You remove the repeats. Your task gives the base directory B and the level.

Papers: B/done/<id>.json (edit in place; only the ids your task names). Plans: B/plans/<id>.plan.json and .brief.md (read one brief for the rules of the level). Papers already shipped are in B/final/ and are not changed: when a pair has one shipped paper, rewrite the other.

1. Copy the level's shipped and unshipped papers into one folder under your scratch directory and run, from the repo root (the directory that contains `tools/`), `node tools/compare-level-sets.mjs <folder> --level <level>`. It lists pairs of questions in different papers that are too alike. Read the tool to see how likeness is measured.
2. For every pair, keep one question and rewrite the other into a different question: another speech act, setting or thing asked, not the same sentence with a noun swapped. Clusters: keep one, rewrite all others, each differently. Use the scene the plan gives that question (`scenes` in the plan) when there is one.
   - A rewritten question keeps its position, its `key` number, its number of choices, its target if it has one (still testing that target, in a new sentence), its speaker labels and context length limits, and gets a correct new `why`, `tags` and `cue`.
   - One right answer only; wrong choices close, never absurd. If two passages are alike, rewrite one passage and all its questions.
3. After each batch run `node tools/validate-level-set.mjs B/done/<id>.json --plan B/plans/<id>.plan.json` for each changed paper (must print OK), refresh your comparison folder and run the compare tool again, until it prints `0 pairs`.
4. Write B/reports/dedupe-<level>.json: {"changed": [{"set", "n", "was", "now"}], "pairsBefore", "pairsAfter": 0}.

Use a node script in your scratch directory (B/work/dedupe-<level>/). Report back in under 100 words: how many questions you rewrote per paper and the compare tool's last line.
