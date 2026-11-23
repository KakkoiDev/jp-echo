# Echo N2 practice

Practice is the entry point for N2 exams and study. Open **Practice → N2 exams & study**. The exam picker, recall checks, passage results, attempt history and AI actions share this page. Existing exam bookmarks continue to work.

## A day with Echo, step by step

Echo is meant to be the only thing you open. The N2 page (Practice → 試 JLPT N2) answers one question every time: *what do I do now?*

1. **Open the N2 page.** The countdown says how many days are left. **Today** lists the day in order, with minutes, about six hours in a full day. Tap the first row that isn't crossed out.
2. **Warm up · weak items (15 min).** The things you missed, guessed or were slow on yesterday, in mocks or checks. Say each one aloud *before* you reveal it, then be honest: Missed / Slow / Instant. A clean answer clears the weakness; the newest evidence always wins.
3. **New words and grammar (rounds of 20).** First checks, paced so all 1,969 items are seen once two days before the exam. The bar under the row fills as you go.
4. **Exam practice.** Every third day or so, a **full mock** (105 min written, break, 50 min listening), exactly like the paper: 問題1–14, then listening 問題1–5, one question per screen, flag what you're unsure of. On other days, a **practice exam on your weak points**: 10, 20 or 35 new questions in the same 問題 formats, written by your AI from your misses.
5. **Go over the misses (20 min).** Results show estimated 言語知識 / 読解 / 聴解 scores out of 60, the 19-point floors and the 90 pass line. Open each miss: the right answer, your answer struck through, and why. Then **Drill my weak items**.
6. **Wind down.** One minute of slow breathing (in 4, hold 4, out 6), then Night Radio with your N2 sentences as you fall asleep. The page tells you what you did today, so you can stop without guilt.

**Plan my day with AI** asks your provider to read your checks and mocks and rewrite today's plan: a short diagnosis (strongest, weakest, the one thing that will raise the score most) and steps that each open the right screen. **Make a practice exam** lets you choose the focus (weak points, one skill, or a mini mock) and the length. Without an AI key the standard plan still works; generation and the coach need one (Settings → AI service).

**The Review tab.** Two Echo decks put the N2 material into ordinary Review and Radio: one sentence per grammar point (221) and per word (1,748), with readings. On the N2 page, Wind down → *Add N2 grammar / vocabulary to Review* opens Import with the link filled in; tap *Bring it in*. Review then schedules them with everything else (listening, reading, writing).

**The last days.** Three days out, new material stops: weak items, one last mock and the **exam checklist** (voucher with photo, HB pencils, a watch, ID, route, water, a warm layer). The eve is light and ends early. On the day, the page offers only a calm ten minutes of things you know and the breathing minute.

## Layout (November 24 redesign)

The N2 page is drawn with Echo's own `styles.css` (tool-head, Library two-line rows, the drill card and bar, review-actions, sheet-dialog), so it reads as the same app in light, dark and system themes. Practice's welcome screen opens it from the 試 row under 話読本.

- **Hub** (`n2-mock.html`): a countdown to the next JLPT date (first Sunday of July or December), **Today** (recall goal, the next or running mock, weak items), **Readiness** (the latest mock as estimated 言語知識 / 読解 / 聴解 scores out of 60 with the 19-point floor and the 90 pass line, plus coverage meters), the twenty mocks with status chips, workbooks under a disclosure, then the AI coach, export and history.
- **Recall** (`?view=recall&type=meaning|reading|grammar&queue=daily|weak|new`): a 20-card round. Big prompt, Hear it, Show answer, then Missed / Slow / Instant in the bottom bar (Space and 1–3 on a keyboard).
- **Exam** (`?book=…`): one question per screen, timer in the sticky head, full-width choice rows, a flag for unsure, and a Questions sheet with the answer grid that also finishes the section. Keys 1–4, ← →, F.
- **Results**: the estimated section scores, the slowest questions, and a review list filtered to missed and unsure.

The logic lives in `n2-study.js` (no DOM) and is held by `test/n2-study.test.js`: the exam date, the section estimate, the recall queue (the newest evidence decides weakness, so a later clean check clears an old mock miss) and the daily goal (first checks spread to finish two days before the exam).

## Daily use

1. **Check recall.** Choose vocabulary meaning, written-word reading, or grammar. Answer aloud before revealing the cue. Mark Instant, Slow or Missed. Daily review gives yesterday’s weak items priority and rotates in unchecked entries. The Weak items queue also includes mistakes on explicitly tagged exam questions.
2. **Take a baseline.** Set 01 contains 101 authored practice questions. Sets 02–20 each contain 30 vocabulary, 21 grammar, 20 reading and 30 listening questions. They are deterministic training forms with different vocabulary targets, contexts and schedules. They reuse comprehension patterns and a subset of Set 01 grammar. Twenty listening items in each themed form are audio-to-word recognition drills. Treat the scores as practice feedback. Two published workbooks sit alongside the twenty Echo forms.
3. **Read your evidence.** Coverage counts distinguish self-checked items from items tested in submitted exam sections. Two fast self-ratings on separate local dates earn the quick-recall count. A later Slow or Missed restarts that count. A correct multiple-choice answer does not certify mastery. Reading comprehension tracks distinct passages attempted and confident answers. Written-word readings and passage comprehension have separate records.
4. **Create a targeted exam.** After grading a recall item or submitting an exam section, choose Create targeted exam. Echo gives your configured provider the available weak targets. It requests new contexts for the same distinctions, validates the returned choices and key, then saves the complete exam. One affected skill produces a shorter exam. The available skills determine the mix. Each generated item retains the evidence it targets.
5. **Recheck.** Retake the same exam to see recall on familiar questions, or generate another targeted exam for transfer to new examples. The History view retains completed attempts when another attempt begins. Export the study JSON for longitudinal analysis.

## Product priorities

Use the exam results to choose tomorrow’s practice. Track vocabulary meaning, kanji reading, grammar and passage comprehension individually. Carry explicit targets and missed questions into adaptive exercises. Keep raw accuracy, guesses, latency and self-reported recall available separately.

The next step for Day Radio is to draw listening material from the same weak targets, record exposure and follow up with an unaided recall check. Day Radio is planned. This release implements the exam and study record it can use.

## Interpretation and limits

Echo exams and provider-generated exams are independent practice material. Their difficulty and timing have no official N2 calibration. Repeated exercise structures can raise scores through familiarity. Japanese device speech drives the original and adaptive listening exercises. The configured provider may produce an ambiguous question even after structural validation.

Data lives in this browser profile. Export before clearing site data or moving devices. The current JSON workflow supports external analysis. Reloading a running test retains its wall-clock deadline.
