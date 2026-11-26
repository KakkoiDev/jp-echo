# N2 grammar blocks implementation

The code and draft index are on `feat/n2-grammar-blocks`, based on `main` at `7f7f3ff`. The full draft is available in a local preview. Normal play awaits the release index, and the independent content review and 375 px browser check are open.

## Index

[Draft index](../tools/grammar-blocks/draft.json) contains all 221 inventory keys. The writer and solver briefs and packet generator are in [tools/grammar-blocks](../tools/grammar-blocks/). The index and deck used by the existing game are unchanged.

| Measure | Result |
| --- | ---: |
| Patterns in the draft | 221 |
| Blocks | 191 |
| Negative / noun / particle / verb / ending / word | 6 / 54 / 27 / 45 / 21 / 38 |
| Patterns using a shared block | 164 of 221 (74.2%) |
| Single-use blocks | 134 of 191 (70.2%) |
| Pending independent solve | 184 |
| Marked opaque as indivisible expressions | 37 |
| First-pass packet candidates / deferred for too few choices | 147 / 37 |

Draft validation passes. Release validation fails on pending transparency and the 40% single-use cap. The validator checks the JSON, coverage, known forms, reading annotations, lexical gloss overlap, solve metadata, sense-specific literals, and level labels. Literal accuracy, linguistic equivalence, and whether a block id has been reused historically still require human or independent model review. For bound forms with no inventory entry, the validator assigns N2 from this index. It uses the lowest listed level among exact matches across a block's forms.

The Sonnet CLI reported `Not logged in · Please run /login`. No independent solve was recorded and no pending classification was promoted. The 37 opaque entries are author judgments that these expressions should be learned whole. Review these during the audit.

> どうせ, せめて, どうやら, なにやら, 確かに, 一応1, 一応2, 万が一, なお1, なお2, はたして, やがて, したがって, とっくに, 未だに, 一旦, いよいよ, おそらく, おおよそ, 要するに, それとも, それにしても, そういえば, おまけに, さすが, それなのに, いわゆる, 何しろ, しかしながら, しかも, ものの, たった-の, さらに, 精々, および, たちまち, いきなり

Review semantic distinctions that a shared English word can hide. For example, the answer to `g:手前` includes the pressure to keep face after a statement or action. The draft block points to one's own side or position. The social implication needs explicit scrutiny in the independent solve. Shared glosses for `に応じて` and `に応えて` should be tested for the difference between adapting to a condition and answering a request or expectation.

## Game and screen

- The optional index adds `b:`, `gb:`, and `gi:` cards, with the grammar block record in `gb`. Transfer requires an unseen pattern and prior exposure to every block. Device sync takes the larger counts and the later weakness state. New cards use the existing record/practice behavior and have no recall target.
- The preview emits 191 block cards, 215 build cards and zero infer cards. Infer runs against a test fixture with explicit solve evidence. These six existing exclusions also suppress generated pattern cards: `g:かねない`, `g:-てこそ`, `g:それにしても`, `g:さすが`, `g:しかしながら`, and `g:のも当然だ`. Every remaining draft pattern matched its deck sentence using authored forms or an existing ordered underline. This check did not judge every sentence for naturalness.
- Ordinary grammar slots can be replaced by block practice. The recovery round still uses the existing picker. The Home line counts known blocks, and build cards render the parts and glosses with existing chip styling.
- Serve the repository on localhost and open `/n2-mock.html?view=game&grammar-preview=1`. The start of a normal round depends on saved progress and the picker. Test with fresh browser storage or a separate local origin. The shell sandbox denied the local server bind and the browser rejected local-file navigation. The light and dark 375 px screenshots and live round walkthrough remain open. Screenshot paths are recorded in [the backlog](QUICK-ROUND-BACKLOG.md).

## Verification

- `npm run check` passed.
- `npm test` passed all 904 tests, including six grammar-block tests.
- `node tools/validate-grammar-blocks.mjs tools/grammar-blocks/draft.json --draft` passed. Running without `--draft` rejected 184 pending classifications and the single-use share.
- Compared the full no-index pool with `main` at `7f7f3ff` using both decks, the kanji parts file and 19 authored N2 sets. All 6,323 generated cards matched field for field.
- Simulated 100 ten-card rounds and 1,000 answers in Node. All rounds had unique targets. The 107 new-card appearances were practice and bonus-free. The recovery round matched the baseline. Generated distractors passed the existing `sameSense` check and four-choice tests. Those checks cannot establish that options are linguistically mutually exclusive.

## Release handoff

1. Review shared meanings and the 37 deferred items, then run the independent solves using the [solver brief](../tools/grammar-blocks/SOLVER.md). Reconcile the 40% cap with genuine linguistic reuse before final validation.
2. Add a passing `n2-grammar-blocks.json` at the root and precache it in `sw.js` with a new cache version. The game already loads that path when present. Keep the grammar-specific score switch off until the cards themselves are reviewed.
3. Check the 375 px preview in both themes, capture the designer screenshots, and play ten live rounds for the audit.
