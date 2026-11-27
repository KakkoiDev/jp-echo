// Connectives (接続詞) for the Quick round connective cards and their audit
// (audit/quick-round). Each has one job: what it tells the reader about the
// sentence that follows. N2 reading questions often hinge on a turn (しかし,
// ところが…) or a restatement (つまり…), so the job is what the card teaches.
// Written by Echo; awaiting review like the comprehension tags.
export const JOBS = Object.freeze({
  turn: "Turn: what follows goes against what came before; the writer's point is usually after it",
  concede: "Concede: grants a point the writer will then turn against (確かに… しかし…)",
  restate: "Restate: says the same thing again, more plainly or more generally",
  conclude: "Conclude: what follows is the result or conclusion of what came before",
  add: "Add: adds another point in the same direction",
  contrast: "Contrast: sets another side or option beside the first",
  rather: "Rather: corrects or replaces the first view with a better one",
  example: "Example: what follows illustrates the point before",
  reason: "Reason: what follows explains why",
  exception: "Exception: a condition or exception to what came before",
  aside: "Aside: a supplementary note",
  shift: "Shift: moves to a new topic",
  infer: "Infer: what follows is what must be true if the point before holds",
});

// [connective, job, short English gloss]
export const CONNECTIVES = Object.freeze([
  ["しかし", "turn", "however"],
  ["だが", "turn", "but (written)"],
  ["ところが", "turn", "however, contrary to expectation"],
  ["けれども", "turn", "but, although"],
  ["それでも", "turn", "even so, still"],
  ["にもかかわらず", "turn", "in spite of that"],
  ["それなのに", "turn", "and yet, despite that"],
  ["とはいえ", "turn", "that said, even so"],
  ["もっとも", "exception", "though, admittedly (a qualification after the point)"], // a limit on the point just made, not a turn (review, 27 Nov)
  ["確かに", "concede", "certainly, it is true that"],
  ["もちろん", "concede", "of course"],
  ["つまり", "restate", "in other words, that is"],
  ["すなわち", "restate", "namely, that is (formal)"],
  ["要するに", "restate", "in short"],
  ["言い換えれば", "restate", "to put it another way"],
  ["したがって", "conclude", "therefore, accordingly"],
  ["だから", "conclude", "so, that is why"],
  ["そのため", "conclude", "for that reason, as a result"],
  ["その結果", "conclude", "as a result"],
  ["このように", "conclude", "in this way (summing up)"],
  ["さらに", "add", "moreover, further"],
  ["しかも", "add", "what is more, and on top of that"],
  ["そのうえ", "add", "besides, in addition"],
  ["また", "add", "also, in addition"],
  ["一方", "contrast", "on the other hand, meanwhile"],
  ["それに対して", "contrast", "in contrast"],
  ["むしろ", "rather", "rather, if anything"],
  ["例えば", "example", "for example"],
  ["なぜなら", "reason", "because (the reason follows)"],
  ["ただし", "exception", "however, provided that, except"],
  ["なお", "aside", "in addition, note that"],
  ["ところで", "shift", "by the way"],
  ["さて", "shift", "now, well then"],
  ["とすれば", "infer", "if so, then"],
  ["それなら", "infer", "in that case"],
]);

// Where each connective starts a sentence in a passage: after 。, 」, a line
// break or the start of the text, followed by 、.
export function connectiveSites(text = "") {
  const words = CONNECTIVES.map(c => c[0]).sort((a, b) => b.length - a.length);
  const re = new RegExp("(^|[。」\\n])(" + words.join("|") + ")、", "g"), out = [];
  let m;
  while ((m = re.exec(text))) out.push({word: m[2], at: m.index + m[1].length});
  return out;
}

// For 問題9-style questions: jobs that can stand in for each other in some
// passages are never offered as wrong choices for one another, so a wrong
// choice is wrong wherever the passage goes (しかし and 一方 can both fit a
// contrast; つまり and したがって can both close an argument).
export const OVERLAP = Object.freeze({
  turn: ["turn", "concede", "exception", "contrast", "rather"],
  concede: ["concede", "turn"],
  restate: ["restate", "conclude", "infer"],
  conclude: ["conclude", "restate", "infer"],
  add: ["add", "aside", "example"],
  contrast: ["contrast", "turn", "rather"],
  rather: ["rather", "turn", "contrast"],
  example: ["example", "add"],
  reason: ["reason"],
  exception: ["exception", "turn", "aside"],
  aside: ["aside", "add", "exception", "contrast"],
  shift: ["shift"],
  infer: ["infer", "conclude", "restate"],
});
// The connectives the exam leans on, used for wrong choices: one per job,
// the most common form.
export const CHOICE_FOR_JOB = Object.freeze({turn: "しかし", concede: "確かに", restate: "つまり", conclude: "そのため", add: "さらに", contrast: "一方",
  rather: "むしろ", example: "例えば", reason: "なぜなら", exception: "ただし", aside: "なお", shift: "ところで", infer: "とすれば"});
export const jobOf = word => CONNECTIVES.find(c => c[0] === word)?.[1] || null;
export const glossOf = word => CONNECTIVES.find(c => c[0] === word)?.[2] || "";
