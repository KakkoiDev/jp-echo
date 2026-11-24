# Echo N2 practice

Practice is the entry point for N2 exams and study. Open **Practice → N2 exams & study**. The exam picker, recall checks, passage results, attempt history and AI actions share this page. Existing exam bookmarks continue to work.

## A day with Echo, step by step

Echo is meant to be the only thing you open. The N2 page (Practice → 試 JLPT N2) answers one question every time: *what do I do now?*

1. **Open the N2 page.** The countdown says how many days are left. **Today** lists the day in order, with minutes, and fits **six hours including breaks** (`BUDGET` in `n2-study.js`). Tap the first row that isn't crossed out. Under the list, two lines: when first checks finish at your measured pace (or an assumed 36 s a check until about 15 checks are timed), and **next-day recall**, the share of delayed checks you got right this week.
2. **Today's checks (up to 35 min, `?view=check`).** Yesterday's misses, slow answers and guesses from recall, mocks and Day Radio, plus what you only heard on Day Radio, in one session. Each comes back in the modality it was missed in (print or by ear), with meanings, readings and grammar mixed, in a sentence you did not see yesterday when Echo has one (the screen says when it is the same sentence or the word alone). Attempt it, then reveal: Missed / Slow / Instant. A print check updates that word's meaning, reading or grammar record; an audio check is listening evidence only. Each save keeps the source, modality, context, replays and active time.
3. **New words and grammar (rounds of 20).** First checks, paced so all 1,969 items are seen once before exam week (3 December). If they do not fit your time, the row says how many fit and the forecast moves.
4. **Timed reading and listening, every day.** 問題10–14 (21 questions, 50 min) and listening 問題1–5 (32 questions) from a set you have not sat, as their own timed papers. On mock days (about every third day) a **full mock** (105 min written, break, 50 min listening) takes their place.
5. **Targeted work.** The comprehension distinction you have missed most in the last two weeks (an exception, a change of plan, what the speaker means…) as a 20-minute drill on unseen authored passages; results list "Where comprehension slipped", each missed reading or listening answer says what it hinged on, and one tap records why it went wrong (a word, the deciding line, the question, time). Then go over the latest misses, a **practice exam on your weak points** (AI), and your weak items. On a mock day: go over the mock (50 min).
6. **Day Radio and breaks.** Thirty minutes by ear, then breaks spread through the day and a stop. One minute of slow breathing (in 4, hold 4, out 6), then Night Radio as you fall asleep.

**Plan my day with AI** asks your provider to read your checks and mocks and rewrite today's plan: a short diagnosis (strongest, weakest, the one thing that will raise the score most) and steps that each open the right screen. **Make a practice exam** lets you choose the focus (weak points, one skill, or a mini mock) and the length. Without an AI key the standard plan still works; generation and the coach need one (Settings → AI service).

**Day Radio** (Today → 耳 Day Radio, or Echo's Radio screen → Day Radio · JLPT N2) plays your weak words and grammar while you are awake, with a quarter of each queue kept for items you have not checked yet and anything you marked *Later*. **Listen** says the word, its meaning, a natural sentence (from the N2 decks) and the word again. **Recall** says a sentence, pauses (3, 5 or 8 s), then reveals; tapping *Got it* or *Not yet* is a listening check, otherwise it only counts as heard. The next day, **Today's checks** tests what you heard, in a different sentence (from the mock papers) where one exists; the old `?view=radio&mode=check` address opens it. Keep Echo open while it plays: the screen stays on, and a locked phone stops speech on iOS and Android. Hearing and listening checks are their own evidence: they never change your meaning, written-reading or grammar records.

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
