# Seventeen N2 papers: deciding lines and a check of their keys

For a writer (a person or an AI model) who reads Japanese at N1 level or
better. Written 27 Nov 2026. This is content work: nothing has to be run.

## What this is for

Echo is a study app for a learner preparing JLPT N2 (exam on 6 Dec 2026). It
ships nineteen mock papers. After sitting one, the learner goes through every
question they missed in a fast review: about eight seconds a card, showing
the question, the right choice, the choice they picked, and **the one or two
lines of the passage that decide the answer**: "this is where it was".

Those lines exist for two papers. This handoff is for the other seventeen
(sets 4 to 20). A wrong line teaches the learner to look in the wrong place,
so accuracy matters more than coverage: where no one or two lines decide a
question, say so.

While you are in each paper you are also the best-placed reader to notice a
question whose answer key is wrong, or which has two defensible answers. That
is the second thing asked.

## What you are given

One input file per paper: `tools/boss-keys/handoff/n2-set-N.input.json`
(seventeen files, about 95 kB each). Each is:

```json
{
  "set": "n2-set-4",
  "questions": {
    "0":  {"skill": "Vocabulary", "mondai": 1, "needsLines": false, "question": "…", "choices": ["…"], "key": 1, "why": "…"},
    "52": {"skill": "Reading", "mondai": 10, "needsLines": true, "context": "…the passage…", "question": "…", "choices": ["…"], "key": 4, "why": "…"}
  }
}
```

- The number is the question's index in the paper (0 to 104).
- `key` is the 1-based index of the paper's right choice; `why` is the
  paper's own explanation (a hint, not the authority).
- `context` is the passage, or for Listening the script (speakers are
  labelled 男：, 女：, 男１：…). Listening 問題4 has one utterance and three
  choices.
- `needsLines` is true for the 53 Reading and Listening questions (indexes
  52 to 104). The first 52 are there so you can check their keys.

## What to hand back

One JSON file per paper, named `n2-set-N.json`:

```json
{
  "set": "n2-set-4",
  "lines": {
    "52": {
      "lines": ["写真そのものよりも、写真をきっかけに出てくる話のほうが、町の歴史を知るうえで貴重だったのだ。"],
      "en": "The stories the photos prompted were worth more than the photos"
    },
    "66": {"skip": "the answer needs both texts A and B compared as wholes"}
  },
  "findings": [
    {"index": 71, "field": "answer", "severity": "unfair",
     "problem": "The key assumes she does not work in the city; the notice admits anyone who lives, works or studies there.",
     "evidence": "市内に在住・在勤・在学の中学生以上",
     "suggestion": "Add 市内では働いていない to the question.", "confidence": "high"}
  ]
}
```

### `lines`: one entry for every question with `needsLines`

Either the lines:

- **`lines`**: one or two strings, each copied **character for character**
  from `context`: an exact substring, same punctuation, full-width digits
  and all, with no line break inside. Together at most **120 characters**.
  - A reader who sees only these lines and the question must be able to pick
    the key and reject the other choices. That is the test.
  - Prefer the shortest lines that still do that. A line may be part of a
    sentence if the sentence is long, as long as it reads as complete.
  - For Listening, leave the speaker's label out: write
    `個室は二十人までのところが多いんですよ。`, not `男２：個室は…`.
  - If the question asks what a word or それ refers to, give the line that
    holds the referent. If it asks for a reason, give the line that states
    the reason, not the line that states the fact.
  - If an ordinal or a name is needed to map the line onto a choice ("the
    fourth course"), include the line that names it.
  - Listening 問題4: the line is the utterance itself.
- **`en`**: what the lines say, in plain English, 8 to **80 characters**, no
  Japanese characters. Translate what is there: do not add what the lines do
  not say, and do not narrow or widen it (午後 is "afternoon", 家族の介護 is
  not "elder care").

Or, where no one or two lines can decide it:

- **`skip`**: the reason, in a sentence. Typical: two texts compared as
  wholes, a notice where three or more facts must be combined, a
  whole-passage gist. Try hard first; most questions have a deciding line.
  Do not force a line onto a question that needs more.

### `findings`: only where the paper itself is at fault

One object per problem, for any of the 105 questions. Nothing for a question
that is sound.

- `index`: the question's index.
- `field`: `answer` (the key is wrong, or a second choice is also right),
  `question`, `choices`, `context`, `why`.
- `severity`: `wrong` (the key marks a wrong choice right), `unfair` (a
  second choice is defensible, or the question cannot be decided from the
  paper), `weak` (unnatural Japanese, a misleading explanation), `note`.
- `problem`, `evidence`, `suggestion` (the exact replacement text where you
  have one), `confidence` (`high`, `medium`, `low`: say `low` rather than
  guess).

Judge each question from the paper, not from `why`.

## How it will be checked

1. A script checks each file: every one of the 53 questions has an entry,
   every line is an exact substring of its `context`, lengths are within the
   limits, `en` has no Japanese.
2. **A blind solve.** A second reader is given only your lines, the question
   and the choices, not the key and not the passage. A line is used only
   where that reader picks the key and says the lines settle it. Lines that
   merely mention the topic will fail here.
3. The maintainer reads your `findings` against the papers.

So a line that is truly decisive is worth more than a line for every
question. From the two papers already done: 100 of 106 questions had lines, 6
were skipped, and a later review replaced about one line in six for being
too thin (naming the fact but not the reason, or an ordinal without what it
refers to).

## Rules

- Do all seventeen papers. If you cannot, say exactly which you did, and
  hand back complete files only: a file with questions missing is rejected.
- One file per paper; do not merge them.
- Copy lines from `context` exactly. Do not retype them from memory: a
  changed character fails the check.
- Do not rewrite the papers. Problems go in `findings`.
- At the end, a short summary in prose: per paper, how many questions have
  lines and how many are skipped; every `wrong` or `unfair` finding; and
  anything about a paper as a whole that a learner sitting it should know.
