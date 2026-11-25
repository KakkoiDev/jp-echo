# Echo: designer handoff for Quick round, the N2 game (26 Nov 2026)

Paste everything below the line into the designer AI, and attach the pictures
in `docs/design/game/shots/` (375 × 812 phone, dark theme, build v267). The
repository is the source of truth for behaviour: `n2-game.js` (logic),
`n2-mock.js` (the `game()` screen), `n2-mock.html` (`#game`), `styles.css`
(the "Quick round" block inside "JLPT N2"), `CLAUDE.md`.

---

## What this is

**The TikTok of cramming for the JLPT N2.** The owner sits the exam on
Sunday 6 December 2026. They work from 9 am to 8 or 10 pm on weekdays, they
are tired, and when they study the "proper" way they go slowly over a few
things. Quick round is the opposite: open it, tap, tap, tap, and get
experience by going fast and seeing the same things hundreds of times.

In the owner's words:

- "I don't think. You think. I just act and get experience from going fast
  and seeing the same things hundreds of times."
- "As simple and fast as it is to swipe on TikTok. Easy to boot and use
  anytime, even when I have only a few seconds to spare, all day long."
- "Mistakes are part of the game, just keep going."
- "Try to speak up when you read." (A reminder only; no microphone, which
  would add friction and lag.)
- "Reward speed and punish mistakes heavily."
- "This is not shogi, this is blitz chess."
- Target: **1,000 questions a day.**

**It is a new app.** Today it lives inside Echo as a view of the N2 page
(`/n2-mock.html?view=game`), because that gives it all of Echo's material,
the learner's recall history, offline use and gist sync for free. It is
reached three ways:

1. Settings → Every day → **Open Echo on Quick round**: opening Echo goes
   straight to the game, once per launch (Back still reaches Echo).
2. The home-screen shortcut (long-press the Echo icon → Quick round).
3. The 速 row on the N2 hub.

Design it as its own product. Whether it keeps Echo's washi-and-seal look or
gets an identity of its own is **your call to propose**, with reasons. Either
way it must work in light, dark and system themes, offline, one-handed on a
phone.

## Principles (non-negotiable)

1. **The player never thinks about the app.** Every action is one tap. No
   sheet, dialog, form, confirmation or choice of mode inside the loop.
2. **Boots into a question.** No start screen, no menu. The first question is
   on screen as soon as the page loads.
3. **Speed is the experience.** Each question has seconds, not minutes.
   Transitions are short. Nothing waits on a network.
4. **Volume and repetition.** The same items come back many times a day;
   seeing them again and again is the point, not a flaw.
5. **Mistakes are part of the game.** A miss is shown, briefly, and the game
   moves on. No shaming, no "are you sure".
6. **Say it out loud.** A light reminder on each card, never enforced.
7. **Honest scoring.** A blind guess must never pay better than "I don't
   know". Never show a pass probability or any "chance of passing".
8. **Nothing is lost.** Every answer is saved as it is given; closing the app
   mid-round is fine.
9. **The flag is one tap.** It saves the question exactly as shown and the
   game moves on. Working out what was wrong is the maintainer's audit job,
   later, not the player's.

## How it works today (v268)

**A round** is 10 questions, mixed. Blitz: each kind has its own clock, in seconds:

| Kind | What the player sees | Picks | Seconds |
| --- | --- | --- | --- |
| Reading | A word in its sentence (no furigana) | Its reading, among near misses: voicing (せんぞ/ぜんぞ), vowel length (しゅうにん/しゅにん), small っ (がっこう/がくこう) | 3 |
| Meaning | A word | Its meaning; wrong choices share a kanji | 3 |
| Which word | A short English definition | The word; wrong choices share a kanji | 4 |
| Listen | The word is spoken | Its meaning | 5 |
| Which kanji | A sentence with a reading in it | The right kanji among words that sound the same | 5 |
| Grammar | A pattern in its sentence | Its meaning | 6 |
| Exam | A short authored question (問題1–5, 7), only from sets already sat | The answer as authored | 4–8 |

About 6,500 questions exist today, and three more kinds are coming (below).

**Points.** Speed is rewarded and mistakes punished hard. Right: 50, plus up
to 250 for speed, times the combo (×1.1 per right answer in a row, up to ×2):
a fast answer on a full combo is 600. Wrong: −200. "I don't know" and a
timeout: 0. Misses and skips break the combo. A blind guess always loses.

**Feedback.** The picked row is struck through, the right row is tinted, and
a line says "Part of the game. Keep going." A right answer moves on after
0.25 s; a miss after 0.8 s. Sounds are generated on the device (offline): a
rising note per right answer that climbs with the combo, a low note for a
miss, a short run at the end of a round. There's a Sound on/off button.

**The review.** After the round, each miss gets about 5 seconds: the word,
its reading, meaning, the sentence with furigana and translation, what the
player picked, and the word spoken. Next skips; Hold stops the timer; Flag
saves it.

**The next round** opens with the last round's misses ("again"). A miss
missed again comes back again.

**Round end.** Points, right count, best; the two rules; Next round; Sound;
the day's meter ("41 of 1,000 questions today · 959 to the boss"); the boss
row; a ranking of the best rounds; a 14-day chart of questions per day with
the 1,000 line.

**The boss.** Once the day's 1,000 are done, the boss opens: a full-length
mock on a set the player hasn't sat (about 2 h 50 min with the break), with
the two held-back sets last. It is locked until then.

**What it saves.** A right answer saves nothing in the learning records
(picking from four is easier than recalling). A miss, a timeout or "I don't
know" saves a missed recall check, so it also comes back in Echo's Evening
recall, the Night Radio and the next day's checks. Game stats (day totals,
round history, best, last seen per question) stay on the device.

## Since the shots (v272)

The owner's shape for the app, in their words: "the app home screen has 3
features: Play, Radio, Settings. Play gives me the exam boss every 1,000
questions, gives me bonuses for speed, keeps me fighting to get to that boss,
and then lets me rest. Simple and fun."

- **Home**: Play (one big button), Radio, Settings, a meter to the next boss,
  and the ranking of runs. Back from a round returns here.
- **The boss**: every 1,000 questions, the real full mock at **half the time**.
- **Runs**: 1,000 questions plus their boss. Ranked by the two scores added
  together; each run keeps both for the in-depth view.
- **Rest**: after the boss, the home says rest for the day.
- **Zone and pacing**: a hidden level keeps the player about 80% right, and
  rounds come in waves (hook, breather, easy, steady, hard, peak; a final
  stretch before the boss). Bonus ×3 questions, doubled at peaks; jackpots at
  combos of 5 and 10.
- **Bedtime**: from the learner's bedtime, a round's end leads to Evening
  recall and the Night Radio.

Design the home, the boss's arrival and its half-time intro, the rest state,
the run ranking (merged and in depth), and how each pacing beat feels.

## What is wrong with it today (see the shots)

1. **It looks like a study page, not a game.** Same cards, same rows, same
   head as the exam screens. Nothing in it is exciting to come back to.
2. **The clock is a 2 px line** under the head. It's the main tension of the
   game and it barely shows.
3. **The head is overloaded and truncates**: "5 / 10 · AGAIN · 35 / 1,000
   T…". Round progress, "again", the day's count, the score and a report
   button compete in one line.
4. **No juice.** No motion for right, wrong, combo, a new best, a finished
   round or the daily goal. The combo is a small text line.
5. **The choices are tall, serif and wordy.** English meanings in the
   display serif read slowly; long ones wrap to two lines. Four rows plus the
   card push the buttons low.
6. **"I don't know" and "Flag" look like twins.** The flag should be
   available but quiet; "I don't know" is a real move in the game.
7. **The review card is dense** and its buttons (Flag, Hold/Continue, Next)
   stack into three full-width rows.
8. **Round end is a long scroll.** The thing to do, Next round, competes with
   rules, the meter, the boss, the ranking and the chart.
9. **No sense of progress per item.** Seeing the same word for the tenth time
   should feel like levelling it up, and today nothing shows that.
10. **Known bug, for the developer:** some grammar sentences lose the
    underline when the pattern's name differs from the text (得る（える・うる）
    in shot 1).

## What we need from you

Boards at 375 px, each with a light and a dark twin, plus one desktop view
(same object, more room):

1. **The loop**: question → answered right → answered wrong → timeout →
   flagged → next question. Show the clock as a real presence, the combo,
   and the score change.
2. **Every card kind**: reading, meaning, which word, listen, which kanji,
   grammar, exam, and the three coming kinds below. Long and short prompts;
   long English choices.
3. **Combo and milestones**: combo 3, 5, 10; a new best round; the 1,000 goal
   reached; the boss opening.
4. **The review**: one miss at a time, timed, one tap to go on. How does the
   player see what they need in 5 seconds?
5. **Round end**: one obvious next tap. Where do the ranking, chart, boss and
   day meter go so they motivate without slowing the loop?
6. **Item progress**: how the player feels an item getting stronger through
   repetition (for example a level per word), without it becoming a menu.
7. **Entry**: the Settings switch, the home-screen shortcut, and what a
   brand-new player sees on question one (no tutorial screen).
8. **Motion and sound spec**: durations and easing for each event; which
   sound plays when. Must respect "reduce motion" and a sound off switch.
   Haptics where the platform allows (Android vibration; iOS web has none).
9. **A ranked fix list**: for each change, what it touches and a rough size.
   We ship the top of it before 6 December and the rest after.

### Coming question kinds (design the cards now)

- **Connectives** (built in v274, as 問題9 文章の文法): a short passage from an authored N2 text with a connective
  blanked (しかし, ところが, つまり, したがって, 一方, むしろ, 確かに…); pick the one
  that fits. The answer explains its job (turn, restate, conclude, add,
  contrast, concede). Passages run 2 to 6 sentences.
- **Kanji from parts**: a compound the player hasn't studied; pick its reading
  or meaning from what its kanji usually do. The answer shows the word split
  kanji by kanji with each reading.
- **Grammar from parts**: a pattern shown as its blocks (ざる + を + 得ない);
  pick what it means. The answer shows how the blocks add up.

## Constraints

- **Phone first, one hand.** Taps in the thumb zone, 44 px minimum targets,
  16 px gutter at 375 px. Nothing required behind hover.
- **Offline.** No server, no account, no network sounds or images. Fonts may
  come from Google Fonts as today (Shippori Mincho, Zen Kaku Gothic New);
  anything else must ship with the app.
- **Themes.** Light, dark and system all work. Colours as named tokens.
- **Japanese stays readable.** Furigana where explanations show Japanese;
  never furigana on the word being tested.
- **No pass probability**, no "% chance", no streak guilt. Scores are points
  and counts.

## Out of scope

- Multiplayer, accounts, leaderboards with other people.
- Changing the question content or what gets saved to learning records.
- Echo's other screens.
