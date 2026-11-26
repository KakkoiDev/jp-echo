# Write the N2 grammar block index

Use the inventory and deck at the same commit as the index. Read sections 2–5 of [the guide](../../docs/GRAMMAR-BLOCKS.md), then inspect [the draft](draft.json) and the reviewed answers in `n2-game-review.js`.

Write shared blocks first. Review each new meaning against its other uses. Keep stable ids when a block's meaning stays the same. Split distinct meanings of the same spelling. Work in batches of roughly 20 patterns and merge additions to the block list centrally. Keep working files under the checkout's ignored `.grammar-blocks/` directory.

Give each block a short English gloss and one translated example with readings. Write ordered parts and a literal for each pattern. Check the surface forms with `patternNeedles`. For an indivisible word, use `opaque`. Leave other transparency calls pending for the solver. An opaque word still needs a distinct literal when the inventory has two meanings for its spelling.

Run `node tools/validate-grammar-blocks.mjs tools/grammar-blocks/draft.json --draft` while drafting. For the final `n2-grammar-blocks.json`, run the validator with no flags. Read every example and compare each literal with the corrected answer. Record sense or sentence issues for review in the report, with exact inventory keys. Preserve the source inventory and deck.
