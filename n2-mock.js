// Official workbook answer numbering. Listening examples are excluded.
const keys = {
  2012: ["23143 32142 12142 4412112 34133 43324", "324413331221 21433 24131", "32212 344314321 13 244 41", "23321 234232 14312 31311332312 3413"],
  2018: ["24231 23214 13341 2132314 14342 34142", "112314223434 34123 22413", "23421 131412231 43 243 43", "12243 321241 21312 232131222113 3131"],
};
const skills = ["Vocabulary", "Grammar", "Reading", "Listening"];
const pdfCodes = ["V", "G", "R", "L"];
const $ = id => document.getElementById(id);
const year = new URLSearchParams(location.search).get("book");
const official = "https://www.jlpt.jp/samples/sample";
const bookUrl = official + year + "/pdf/N2";
const questions = [];
let written = 0;
let state;
let entered = Date.now();
let shownGroup = "";
const storageKey = "echo-n2-mock-v1-" + year;

function button(label, click) {
  const element = document.createElement("button");
  element.textContent = label;
  element.onclick = click;
  return element;
}
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { $("warning").textContent = "Device storage is unavailable. Keep this page open to retain this attempt."; }
}
function active() { return state.phase === "written" || state.phase === "listening"; }
function range() { return state.phase === "written" ? [0, written] : [written, questions.length]; }
function recordTime() {
  const now = Date.now();
  if (active()) state.time[state.index] += Math.max(0, Math.min(now, state.deadline) - entered);
  entered = now;
}
function finish() {
  recordTime();
  state.phase = state.phase === "written" ? "rest" : "results";
  $("audio").pause();
  persist();
  render();
}
function tick() {
  if (!active()) { $("clock").textContent = ""; return false; }
  const remaining = Math.ceil((state.deadline - Date.now()) / 1000);
  if (remaining <= 0) { finish(); return true; }
  $("clock").textContent = Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
  return false;
}
function start(phase) {
  state.phase = phase;
  state.index = phase === "written" ? 0 : written;
  entered = Date.now();
  state.deadline = entered + (phase === "written" ? 105 : 50) * 60000;
  persist();
  render();
}
function move(index) {
  if (tick()) return;
  recordTime();
  state.index = index;
  persist();
  render();
}
function renderExam() {
  const q = questions[state.index];
  const [first, end] = range();
  const file = bookUrl + pdfCodes[q.skill] + ".pdf";
  if ($("open").href !== file) { $("pdf").src = file; $("open").href = file; }
  $("material").textContent = skills[q.skill] + " booklet";
  const listening = q.skill === 3;
  $("audio").hidden = $("track").hidden = !listening;
  if (listening && shownGroup !== q.group) {
    const audioYear = year === "2012" && q.group === 2 ? 2017 : year;
    const src = official + audioYear + "/mp3/N2Q" + q.group + ".mp3";
    $("audio").src = $("track").href = src;
    shownGroup = q.group;
  }
  $("prompt").textContent = q.label;
  $("volume").textContent = "Workbook " + year + " · " + skills[q.skill];
  const answered = state.answers.slice(first,end).filter(Boolean).length;
  $("progress").max = end-first;
  $("progress").value = answered;
  $("count").textContent = answered + " of " + (end-first) + " answered";
  $("choices").replaceChildren();
  for (let n = 1; n <= q.options; n++) {
    const choice = button(n, () => {
      if (tick()) return;
      state.answers[state.index] = n;
      persist();
      renderExam();
    });
    choice.setAttribute("aria-pressed", state.answers[state.index] === n);
    $("choices").append(choice);
  }
  $("guess").checked = state.guesses[state.index];
  $("prev").disabled = state.index === first;
  $("next").disabled = state.index === end-1;
  $("jump").replaceChildren();
  for (let i = first; i < end; i++) {
    const tag = state.guesses[i] ? " ⚑" : state.answers[i] ? " ✓" : "";
    $("jump").add(new Option(questions[i].label + tag, i));
  }
  $("jump").value = state.index;
}
function renderResults() {
  $("scores").replaceChildren();
  $("mistakes").replaceChildren();
  for (const [skill, name] of skills.entries()) {
    const items = questions.filter(q => q.skill === skill);
    const correct = items.filter(q => q.key === state.answers[q.index]);
    const row = document.createElement("p");
    const booklet = document.createElement("a");
    booklet.href = bookUrl + pdfCodes[skill] + ".pdf";
    booklet.target = "_blank";
    booklet.rel = "noopener";
    booklet.textContent = name;
    row.append(booklet, " · " + correct.length + " / " + items.length);
    $("scores").append(row);
  }
  $("timings").replaceChildren();
  const slowest = [...questions].sort((a,b) => state.time[b.index] - state.time[a.index]);
  for (const q of slowest) {
    const row = document.createElement("li");
    row.textContent = skills[q.skill] + " · " + q.label + " · " + Math.round(state.time[q.index]/1000) + "s";
    $("timings").append(row);
  }
  for (const q of questions) {
    const answer = state.answers[q.index];
    if (answer === q.key && !state.guesses[q.index]) continue;
    const row = document.createElement("li");
    row.textContent = skills[q.skill] + " · " + q.label + " · Your answer " + (answer || "—") + " · Correct " + q.key + (state.guesses[q.index] ? " · Guessed" : "") + " · " + Math.round(state.time[q.index]/1000) + "s";
    $("mistakes").append(row);
  }
  $("feedback").textContent = $("mistakes").children.length ? "Compare these answers with the booklet and listening transcript." : "Every answer was correct and confident.";
  $("script").href = bookUrl + "script.pdf";
}
function render() {
  $("intro").hidden = state.phase !== "ready";
  $("exam").hidden = !active();
  $("rest").hidden = state.phase !== "rest";
  $("results").hidden = state.phase !== "results";
  if (tick()) return;
  if (active()) renderExam();
  if (state.phase === "results") renderResults();
}

if (!Object.hasOwn(keys, year)) {
  for (const [i, value] of Object.keys(keys).entries()) {
    $("books").append(button("Workbook " + (i+1) + " · " + value, () => location.assign("?book=" + value)));
  }
} else {
  for (const [skill, groups] of keys[year].entries()) {
    for (const [group, answers] of groups.split(" ").entries()) {
      for (const [i, answer] of [...answers].entries()) {
        const index = questions.length;
        const number = group === 4 && i >= 2 ? "3 (" + (i-1) + ")" : i+1;
        questions.push({index, skill, group:group+1, key:Number(answer),
          label:skill < 3 ? "Question " + (index+1) : "問題 " + (group+1) + " · " + number,
          options:skill === 3 && group === 3 ? 3 : 4});
      }
    }
  }
  written = questions.findIndex(q => q.skill === 3);
  state = {phase:"ready", index:0, deadline:0, answers:Array(questions.length).fill(0),
    guesses:Array(questions.length).fill(false), time:Array(questions.length).fill(0)};
  try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved?.answers?.length === questions.length) state = saved; } catch {}
  $("library").hidden = false;
  $("books").append(button("Start " + year + " mock", () => start("written")));
  $("listen").onclick = () => start("listening");
  $("guess").onchange = () => { if (tick()) return; state.guesses[state.index] = $("guess").checked; persist(); renderExam(); };
  $("prev").onclick = () => move(state.index-1);
  $("next").onclick = () => move(state.index+1);
  $("jump").onchange = () => move(Number($("jump").value));
  $("submit").onclick = () => {
    if (tick()) return;
    const [first,end] = range();
    const blanks = state.answers.slice(first,end).filter(a => !a).length;
    if (confirm("Finish this section with " + blanks + " unanswered? This locks your answers.")) finish();
  };
  window.addEventListener("pagehide", () => { recordTime(); persist(); });
  render();
  setInterval(tick, 1000);
}
