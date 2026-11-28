# Echo JLPT N2 mock paper review handoff

Eight papers were reviewed in full, from N2 set 2 through set 9. The review covers 840 questions and records 46 unfair items and 46 weak findings. No key was judged plainly wrong. The proposals are ready for a maintainer to check against the Japanese and apply selectively. The audit did not change the papers.

## Files and scope

Open this folder for the eight JSON reviews.

```text
/Users/kakkoidev/Documents/ChatGPT/Echo/mock-paper-reviews
```

The original paper exports used for this review are in the JP Echo worktree.

```text
/Users/kakkoidev/Code/jp-echo/.claude/worktrees/qr-levels/tools/paper-review/input
```

| Review file | Reviewed edition | Wrong | Unfair | Weak | Note |
|---|---|---:|---:|---:|---:|
| [n2-set-2.review.json](n2-set-2.review.json) | 2026.11-r5 | 0 | 1 | 9 | 0 |
| [n2-set-3.review.json](n2-set-3.review.json) | 2026.11-r5 | 0 | 13 | 3 | 0 |
| [n2-set-4.review.json](n2-set-4.review.json) | 2026.11-r4 | 0 | 1 | 5 | 0 |
| [n2-set-5.review.json](n2-set-5.review.json) | 2026.11-r4 | 0 | 9 | 3 | 0 |
| [n2-set-6.review.json](n2-set-6.review.json) | 2026.11-r3 | 0 | 6 | 5 | 0 |
| [n2-set-7.review.json](n2-set-7.review.json) | 2026.11-r5 | 0 | 5 | 7 | 0 |
| [n2-set-8.review.json](n2-set-8.review.json) | 2026.11-r4 | 0 | 5 | 8 | 0 |
| [n2-set-9.review.json](n2-set-9.review.json) | 2026.11-r5 | 0 | 6 | 6 | 0 |

| **Total** | | **0** | **46** | **46** | **0** |

Each JSON file has `read: "all"`. Its finding `index` is the input question’s **zero-based** index. The paper’s `key` and references to numbered choices and tiles are **one-based**. For grammar tile questions, map the key to the ★ position shown in the frame. The position can vary by question. The 41 papers outside this batch are N2 sets 10–20 and every N3, N4, and N5 set. Difficulty observations were based on the reviewed papers. There was no official-workbook comparison.

## Where to start

- **Conditions omitted from the source text.** Set 3 #71 and #72 leave discount eligibility or proof open, set 5 #55 omits when the fee is paid, and set 8 #71 uses living alone as a proxy for attending alone. In set 6 #103 the participants agree to ask the venue about a room.
- **Alternate tile orders.** Start with set 3 #44, set 5 #46, set 6 #43–44, set 7 #42–43, and set 9 #42 and #46. The alternate orders in set 7 #43 and set 9 #46 survive earlier repairs and preserve the keyed ★ tile. Check the frame as well as the 24 orders.
- **Ordinary uses of distractors.** Set 7 #41 permits だけあって, set 8 #38 permits について, and set 9 #92 permits declining the copying offer by saying it is already done. Some other findings depend on register, scope, or an unstated situation. Use the confidence and evidence in each entry when deciding whether to change it.
- **Feedback that teaches the wrong distinction.** Set 7 #30 overstates the grammar of まさか, set 8 #91 identifies the wrong choice number in its explanation, and set 9 #101 omits information needed to decide the answer from the excerpt alone.

## Maintainer workflow

1. Read the current edition before editing. Match the review to the current question by paper, index, and quoted Japanese. If the edition changed or the text differs, rejudge the item before carrying forward the finding.
2. Work through the `unfair` entries first. Solve the item without its key or explanation, then try the competing interpretation in the evidence. Accept a proposed edit only if the revised item has one defensible answer. Record a short reason for any finding you reject or defer.
3. Apply changes to the source that ships. Use `tools/paper-review/input/` as the review export. When a change affects the answer or context, update the key, explanation, and deciding lines together as needed. Check that each quoted line still occurs verbatim and its English retains conditions and uncertainty.
4. For revised tile questions, check all 24 permutations. Reject a revision that permits two natural orders even if both give the same ★ tile. Have a second reader blind-solve every changed question before shipping.
5. Assign a new edition to each changed paper. Report findings applied, rejected, or deferred by paper and index, with any remaining ambiguous items called out.

## Prompt for Claude

> Read this handoff and the eight linked review JSON files. Start by verifying all 46 unfair findings against the current paper sources, using the original Japanese evidence and the edition table. Apply only fixes you independently confirm, starting with missing conditions and alternate tile orders. Keep an applied, rejected, or deferred record by paper and zero-based index. For changed items, keep the keys, explanations, and deciding lines consistent, verify the full order of every tile question, bump affected editions, and obtain a second blind solve before release. Keep the unrevised papers outside this batch out of scope unless asked to extend the review.
