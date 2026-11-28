# Quick round's card picker: audit handoff

For an AI model (or a person) asked to audit how Quick round chooses the next
cards. Written 29 Nov 2026, after two audits that found and fixed many bugs.
The owner wants a third, independent look: is the algorithm correct, and does
it actually help a learner pass the JLPT, and keep it fun?

## What the game is

Quick round is a fast quiz game for one learner preparing JLPT N2 (exam on
6 Dec 2026). A round is up to 10 multiple-choice cards, 3–8 seconds each, then
a review of the misses. Cards come in kinds: a word's meaning in its sentence,
its reading, its sound (listen), "which word" for an English meaning, "which
kanji", grammar patterns, gaps, word parts, connectives, kanji by meaning, kana.
Long kinds (paraphrase, sentence order, clause pairs, mock-paper questions,
reading passages) are kept out of rounds and played in the mini-boss (the
Sprint) every 10 rounds and in Today's reading once a day.

## Where the code is

Repository: this one (`KakkoiDev/jp-echo`, branch `main`). All picking logic is
pure JavaScript in `n2-game.js`; the screen in `n2-mock.js` calls it.

| Function (n2-game.js) | Role |
|---|---|
| `nextRound` | builds a round: comebacks, kanji places, kana places, boss places, grammar pieces, review places |
| `pickRound` | the core picker: groups (weak, climb, fresh, known), rests, ladder gate, mix, kinds in turn |
| `ladderGate`, `stepAfter`, `nextRung`, `LADDERS` | each item's ladder of card kinds and its current step |
| `kanjiPick`, `kanjiCards`, `kanaPick`, `kanaCards` | kanji-first places, kanji and kana cards |
| `grammarPick` | grammar-piece cards (blocks, builds, inferences) |
| `restFor`, `levelAfter`, `STEP_REST`, `CALM_REST`, `JUST_PLAYED` | rests |
| `rememberAnswer`, `rememberRound`, `inSlump` | what an answer and a round change |
| `sprintRound`, `readingBlock`, `miniDue`/`miniPlayed`, `bossQueue` | the Sprint, Today's reading, the mini-boss, the boss's misses |
| `byKindInTurn`, `interleave`, `KIND_SHARE` | kinds taken in turn, small kinds on a half turn |

Intended rules are written in `CLAUDE.md` (the Quick round entries, from
"Quick round is the N2 game" to "The picker's second audit"). Read those
first; where code and `CLAUDE.md` disagree, that is a finding.

## The rules, in short

- A round is at most 10 cards; no item twice; last round's misses come back
  first (a Sprint card's miss waits for the next Sprint).
- Each card rests by its level (4 h at level 0, doubling, 3 days at level 5);
  an item rests 10 minutes after any of its cards (`STEP_REST`).
- Each item climbs a ladder of kinds (word: meaning → reading → listen → which
  word → which kanji; grammar: its sentence → its gap; word part: its sentence
  → its gap). Only the current rung is asked; right moves up, a miss back one,
  never the other way.
- Items already started come before brand-new ones in the new places.
- A recovery round (after a round under 50% right) is made of won cards at the
  rung last won, never the round just played.
- N2 rounds give 2 places to kanji (kanji cards for new kanji of the rank's
  level and above); other ranks pick by kanji, keeping 3 places for the ladder.
- Flags rest a card a week. The boss's misses take places after comebacks.

## How to check it

`node tools/picker-audit/replay.mjs` plays four fresh players (N2 at 70% and
40% right, N3 kanji first, N5 with kana) for 200 rounds each and prints every
rule broken. `--state file.json` adds a player from a saved state (the owner
can supply one; never commit it). `npm test` runs about 1,000 tests, many of
them in `test/n2-game.test.js` for the picker.

Flags the replay prints that are intended:
- "inside its rest … calm": a recovery round's familiar fallback reuses cards
  seen more than 3 minutes ago when the player has few won cards.
- "kana in recovery": a beginner's recovery round keeps kana already met.
- An occasional "miss not back": two cards of one item missed, one comes back.

## Open questions (please weigh in)

1. **Too many words in progress.** A learner who has played 1,700 answers has
   about 650 items started. Each started item waits about 60 rounds (a day or
   two) for its next card. Should new items be held back while the number in
   progress is high (a work-in-progress cap), and at what number?
2. **Sound off skips the listen rung for good.** With sound off, listen cards
   are removed before the ladder gate, so a word passes that rung and is never
   asked by ear later. Fix or accept?
3. **The mix.** Two kanji places a round, half turns for connectives and word
   parts, one grammar-piece slot, three ladder places at kanji-first ranks.
   Are these shares sensible for passing N2 (vocabulary and grammar 60 points,
   reading 60, listening 60, each section at least 19)?
4. **Recovery rounds.** Are they still a good idea, now that the ladder and
   rests exist? A struggling player at 40% right spends most rounds in them.
5. **Anything that makes the game less fun** or slower to learn from:
   repetition, monotony (a new player's first rounds are mostly meaning
   cards), waits.

## What to hand back

One Markdown file, `picker-audit-findings.md`:

- **Bugs**, ranked by severity: function and line, the concrete scenario, the
  consequence for the learner, and a proposed fix. Say whether you ran the
  replay or read the code.
- **Answers to the open questions**, with reasons (learning research where it
  applies).
- **Rules you checked and found sound.**

Keep it under 1,500 words.
