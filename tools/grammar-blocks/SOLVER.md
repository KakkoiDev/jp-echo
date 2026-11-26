# Solve N2 grammar from the blocks

You receive numbered items with parts, short glosses and four possible meanings. For each item, give the number, a choice from 1 through 4, and the evidence in the parts that led you there. Pick one even when unsure and say what is uncertain. Work only from the packet. Keep your first pass fixed.

For items you missed, a second packet also gives the Japanese deck sentence. Give a fresh choice and the Japanese cue that decides it. Flag cases where two choices fit or where the right choice depends on the ambiguity of the English gloss.

## Packet preparation for the author

Use a fresh Sonnet session for the solver. For an eligible pattern use the reviewed meaning as the key and three distinct reviewed meanings from patterns with a shared block. Shuffle the positions and keep the private ledger outside the solver's packet. When a pattern lacks three defensible distractors, flag it for further block work and record it as unsolved. Use the Japanese deck sentence alone in the second packet. Its English translation can reveal the answer.

Record a correct first pass as `clear` with `{"by":"blocks-only","right":true}`. Record a second-pass correction as `partial` with `{"by":"blocks+sentence","right":true}`. If the solver misses both, review the split and glosses. After at most one rewrite and re-solve, a persistent miss is `opaque`, with `{"by":"blocks+sentence","right":false}`. Keep item numbers, the options, both responses and adjudication together in the ignored working directory so the result can be reproduced. Hold ambiguous items out of the game until resolved.

From the checkout root, generate the packets with:

```sh
node tools/grammar-blocks/make-packets.mjs tools/grammar-blocks/draft.json .grammar-blocks/solve
node tools/grammar-blocks/make-packets.mjs tools/grammar-blocks/draft.json .grammar-blocks/solve first-round-answers.json
```

Send only `blocks-only.json` at first and only `blocks-and-sentence.json` for the second pass. The first-round answers file is an array of objects with numeric `number` and `choice` fields. Review generated distractors before sending. The script estimates distinctness via `sameSense` and defers items with too few options. It cannot establish linguistic uniqueness.
