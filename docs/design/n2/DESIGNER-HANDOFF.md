# Echo — Designer handoff: N2 exam prep polish (25 Nov 2026)

Paste everything below the line into the designer AI, and attach the pictures
in `docs/design/n2/shots/` (375 × 812 phone, dark theme, plus one desktop
view). The repository stays the source of truth: `CLAUDE.md`, `COMPONENTS.md`
and `styles.css`. Where a board and the repo disagree on a token or a
primitive, the repo wins.

---

## Who this is for and why now

Echo is a local-first PWA for learning Japanese. Its own look is called **washi
and seal**: warm paper texture, Shippori Mincho for display Japanese, Zen Kaku
Gothic New for the interface, and one restrained vermilion accent. The owner
sits **JLPT N2 on Sunday 6 December 2026**, 11 days from now, and uses the N2
page (`/n2-mock.html`) every day for several hours, mostly on a phone.

The N2 page was built quickly, one feature after another. It works, and every
piece is tested, but it reads as a stack of features rather than one designed
tool. **Your job is polish, not a redesign.** Make it calmer, easier to scan and
easier to act on, while keeping Echo's look and the existing primitives.

Because of the exam date, every proposal has to be:

- **Shippable alone.** About a day of work or less, independent of the others.
- **Ranked.** By how much it helps a learner who opens the page tired, on a
  phone, between study blocks.
- **Free of new behaviour.** Change presentation, hierarchy, copy and
  disclosure, not the study logic. The plan, scores and records stay as they are.

## The screens

All of them are views of one page, selected by URL. A view needs no other
navigation state.

| View | URL | Screenshot(s) | What it is for |
| --- | --- | --- | --- |
| Hub | `/n2-mock.html` | `hub-1-plan` … `hub-5-history`, `hub-desktop` | Countdown, today's plan, readiness, mock exams, history |
| Recall | `?view=recall&type=meaning\|reading\|grammar&queue=daily\|weak\|new` | `recall-grammar`, `recall-grammar-answer` | Flash recall of N2 words and grammar, graded Missed / Slow / Instant |
| Today's checks | `?view=check` | `check` | Yesterday's misses, checked a day later in print and by ear |
| Day Radio | `?view=radio&mode=listen\|recall` | `day-radio` | Hands-free listening to weak words and grammar |
| Exam intro | `?book=n2-set-5` | `exam-intro` | Conditions and timing before a mock |
| Exam question | (same URL, after Start) | `exam-question`, `exam-grid` | The timed paper: one question per screen, a question grid in a sheet |
| Break | (between written and listening) | `exam-break` | Section score so far; start listening |
| Results | `?book=…&attempt=…` | `results-1-score`, `results-2-review` | Score against the pass line, breakdowns, review of every missed or unsure question |

Dialogs: the question grid, "Make a practice exam", Breathe, the evidence sheet
for a word, and "No AI service". All of them are `sheet-dialog`.

## Rules you must keep

1. **Tokens only.** Use `--washi`, `--panel`, `--sumi`, `--ink-muted`,
   `--hairline`, `--rule` and `--seal`, plus the `--display` and `--ui` fonts.
   No new colours, fonts, gradients or shadows. Every board needs a light twin
   and a dark twin. The shots are dark; light and system themes must work too.
2. **Reuse the primitives already on the page.** These are:
   - `tool-head` and `drill-head`, each with exactly one report button;
   - `library-tool two-line` rows with a kanji glyph;
   - `planSteps` and `scoreChart` (both in COMPONENTS.md);
   - `segmented` and `chips`;
   - the drill card, `drill-bar` and `drill-done` with its seal;
   - `review-actions` (the bottom bar);
   - `notice` and `sheet-dialog`;
   - `rule-heading` and `overline`.

   N2-only CSS lives in the single block headed "JLPT N2" in `styles.css`. If a
   fix belongs to a shared primitive, such as the drill head or the bottom bar,
   propose the change to the primitive, not an N2 override.
3. **Mobile first, at 375 px.** Keep a 16 px gutter and 44 px tap targets. Never
   hide a required action behind hover. Never cover the bottom action bar.
   Desktop is the same object with more room. The hub already has a side column
   for Readiness.
4. **Honest numbers.**
   - Scores are "estimated" and "direction, not a prediction".
   - Never show a pass probability or a percentage chance.
   - Paused time is shown as paused, never as answer time.
5. **Readings.** Any Japanese explanation or example carries furigana
   (`rubyHtml`). An underline (`.n2-mark`, seal) marks the item being tested
   inside a sentence.
6. **Skills are glyphs, never emoji.** These are 聴 読 書 and the section
   glyphs such as 言語知識, 読解 and 聴解.
7. **Offline.** Everything except the AI coach and the exam generator works
   with no network. Don't design states that assume a server.

## What we see (by screen, most important first)

### Across the page

- **G1 — Heads overflow at 375 px.**
  - Today's checks and Day Radio: the counter wraps to "1 /" above "8", and
    the subtitle wraps onto a second line.
  - Exam: the section title truncates to "文字・語…".
  - Exam intro: a long set name wraps mid-word.

  The `drill-head` needs a rule for long titles, subtitles and counters.
- **G2 — Bottom bars are inconsistent.**
  - In the screenshot, Day Radio's five buttons (‹ ⟲ Play Later ›) run past
    the right gutter at 375 px. Fixed in v258: they now fit between the
    gutters with 44 px minimum targets. The icon and state issues below
    remain.
  - ‹ ⟲ › are text characters, while every other icon in Echo is an SVG.
  - A disabled ‹ looks pressed or filled, in Day Radio and in the exam.
  - "Later" is a toggle (`aria-pressed`) but looks like a plain button.
- **G3 — Collapsed sections look like loose text.** On Results, "By 問題" and
  "Time · 53 min in all · slowest questions" are closed `<details>`. They read
  as stray paragraphs with gaps below them and give no sign that they open.
- **G4 — Too much grey prose.** Long hint paragraphs appear on almost every
  view: the Day Radio lede, the AI hint, forecasts and the readiness caveat.
  Decide which of them a daily user needs every time, and which belong behind
  an "about" disclosure or should only be shown once.

### Hub (`hub-*`)

- **H1 — One very long scroll with no shape.** In order, it holds:
  1. countdown
  2. goal form
  3. seven plan steps and the Start button
  4. links, two forecast paragraphs, the coach buttons and the AI hint
  5. Readiness and Sprint checkpoint
  6. three coverage meters
  7. 20 mock rows and a workbook disclosure
  8. the score chart, export, drills and the history list

  Propose an order and a disclosure plan. Decide what is above the fold on a
  phone, what is collapsed, and what moves to Results or history. Keep a single
  page; no tabs or new navigation state.
- **H2 — Start is below the fold.** The primary "Start: today's checks" button
  sits under seven steps, so on a phone it is off screen. The current step is
  highlighted, but its action is far away.
- **H3 — The header contradicts the page.** The screenshot's header says "No
  date set yet" while the countdown says "11 days to Sun 6 Dec". Fixed in
  v258: the header now says "Exam Sun 6 Dec · standard date". The design
  should still say what the header subtitle is for on this page.
- **H4 — Sprint checkpoint doesn't match.** It uses a bold sans heading
  instead of `rule-heading`, and dates as "2026-11-24" while everything else
  says "Nov 24".
- **H5 — 20 mock rows that look the same.**
  - Most rows repeat "Full JLPT layout · 問題1–14 and listening 1–5 ·
    105 questions".
  - The status chips (RESUME, BELOW, PASS LINE) and the best scores appear
    only on some rows.

  The useful facts are: in progress, done (best score and whether it was over
  the line), and not yet taken. Sets 19–20 are held back for unseen-passage
  mocks. Consider a compact grid or grouping.
- **H6 — History mixes kinds.** Exams, timed sections and comprehension drills
  all use the same 歴 glyph in one list. The chart sits above an "Export study
  JSON" row. Also define the empty state and the "broken attempt" row (today it
  shows "Official workbook · undefined").
- **H7 — Coach controls are loose.** "Plan my day with AI" and "Make a practice
  exam" are two stacked outline buttons followed by a paragraph. They are
  secondary and optional (they need the learner's own AI key).

### Recall (`recall-grammar*`)

This is the healthiest view. Keep it.

- **R1 — Ruby gaps.** When a reading is wider than its kanji, the kanji spread
  apart, as in 努 力 in the example sentence. Look at ruby overhang and
  spacing for `.n2-recall-example`.
- **R2 — Dead space.** There is a large empty gap between the card and the
  bottom bar. The state line ("Weak · missed or slow last time") floats, and the
  "Meaning 1 of 2 · the sentence shows which" prefix will add more text there.
- **R3 — Grades look alike.** Missed, Slow and Instant have nearly the same
  weight. They should match Echo's Review grading primitives, where "again" is
  distinct.
- The card head now has a Previous card button. Make sure it reads as
  "previous card", not "back".

### Today's checks (`check`)

- G1 head overflow, and two provenance hint lines under the card ("Missed
  yesterday · missed before too · in print · meaning" and "Only one sentence for
  this…"). Make them one quiet line.

### Day Radio (`day-radio`)

- G2 bar overflow and the text icons.
- Unlike Recall, the example sentence has **no furigana** here.
- A long headword such as 得る（える・うる） sits at display size and nearly
  fills the width.
- The lede paragraph shows on every visit.

### Exam (`exam-intro`, `exam-question`, `exam-grid`, `exam-break`)

- **E1 — Crowded head.** It holds ✕, a truncated section title, two lines of
  small caps ("1 OF 73 · 0 ANSWERED"), the clock, pause and report. The clock
  and the progress are what matter during a timed paper.
- **E2 — The instruction is hard to read.** The 問題 instruction is tiny grey
  Japanese, but it is part of the question. It needs to be legible without
  shouting.
- **E3 — Show every choice state.** Design unselected, selected, marked unsure
  (the flag), the listening box with a play button, and long passages
  (読解 中文/長文 and 情報検索) on a phone.
- **E4 — The question grid is flat.**
  - 73 cells sit in one grid with no grouping by 問題.
  - Answered and current differ only by outline, and the unsure state is weak.
  - The title wraps over two lines, and so does "Finish with 72 blank".

  Grouping by 問題, with a small legend, would make "what's left" visible at a
  glance.
- **E5 — The break screen has no head.** The 休 view has no back or report
  button, unlike the intro. Decide whether that is intentional (exam mode) or
  should match.

### Results (`results-*`)

- **S1 — Three treatments for "what next".**
  - A full-width "Back to the plan" button.
  - A left-aligned underlined "Drill my weak items".
  - A centred underlined "Take this exam again".

  Pick one hierarchy.
- **S2 — Disclosures.** See G3.
- **S3 — The review list is hard to scan.**
  - Every row repeats a MISSED chip.
  - Stems truncate.
  - Rows aren't grouped by section.

  A row opens to show the choices, the solution sentence (with furigana) and
  the why. Design the open state too.
- The score card is the same component as Readiness on the hub. Keep them one
  component.

## What to deliver

Boards at 375 px, each with a **Dark** twin. Name them like the existing
canvas (`docs/design/design/*.dc.html`):

1. **N2Hub**: the first phone screen and the full scroll with your disclosure
   plan. Also **N2HubDesktop** at 1280 px.
2. **N2Recall**: question, answer and done. **N2Check** if it differs.
3. **N2DayRadio**: listen and recall modes, with the fixed bottom bar.
4. **N2ExamQuestion**: choice states, listening and a long passage. Also
   **N2ExamGrid** and **N2Break**.
5. **N2Results**: score, the next-action hierarchy, and the review list with
   one row open.
6. **Primitive changes**: a short list with before and after. Cover the
   drill-head long-title and counter rule, the bottom-bar icon buttons and
   their disabled and toggle states, the disclosure affordance, and status
   chips in rows.

With them, give a **ranked fix list**. For each fix: the change, the files or
classes it touches (`n2-mock.html`, `styles.css` "JLPT N2" block or a shared
primitive, `components.js`), and a rough size. We will ship the top of the list
before 6 December and the rest after.

## Out of scope

- New features, new study logic, or changes to how the plan, scores or records
  work.
- The other JLPT levels (planned after the exam).
- Echo's main app screens, except where a shared primitive changes.
- Any new palette, font, illustration style or icon set.
