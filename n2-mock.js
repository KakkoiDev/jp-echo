import {bookIds,bookName,EDITION,form} from "./n2-forms.js";
import {access,activateProgress,currentAttempts,prefix} from "./n2-progress.js";
// Official workbook answer numbering. Listening examples are excluded.
const keys = {
  2012: ["23143 32142 12142 4412112 34133 43324", "324413331221 21433 24131", "32212 344314321 13 244 41", "23321 234232 14312 31311332312 3413"],
  2018: ["24231 23214 13341 2132314 14342 34142", "112314223434 34123 22413", "23421 131412231 43 243 43", "12243 321241 21312 232131222113 3131"],
};
const skills = ["Vocabulary", "Grammar", "Reading", "Listening"];
const pdfCodes = ["V", "G", "R", "L"];
const $ = id => document.getElementById(id);
const year = new URLSearchParams(location.search).get("book");
const adaptive=/^adaptive-[a-f0-9-]{36}$/.test(year||"");
const native=bookIds.includes(year)||adaptive;
let title=bookName(year), archivedView=false;
let inventory, original;
async function json(path){
  const response=await fetch(path);
  if(!response.ok) throw new Error("Unable to load "+path+". Reconnect and reload.");
  return response.json();
}
async function materials(){
  [inventory,original]=await Promise.all([json("./n2-inventory.json"),json("./n2-echo-bank.json")]);
}

const official = "https://www.jlpt.jp/samples/sample";
const bookUrl = official + year + "/pdf/N2";
const questions = [];
let written = 0;
let state;
let entered = Date.now();
let shownGroup = "";
const storageKey = prefix + year;

function button(label, click) {
  const element = document.createElement("button");
  element.textContent = label;
  element.onclick = click;
  return element;
}
function persist() {
  if(archivedView||state.phase==="ready")return;
  try {
    const other=JSON.parse(localStorage.getItem(storageKey)||"null");
    if(other?.id && other.id!==state.id)return;
    if(other?.phase==="results" && state.phase!=="results")return;
    localStorage.setItem(storageKey,JSON.stringify(state));
  }
  catch { $("warning").textContent = "Device storage is unavailable. Keep this page open to retain this attempt."; }
}
function active() { return state.phase === "written" || state.phase === "listening"; }
function range() { return state.phase === "written" ? [0, written] : [written, questions.length]; }
function recordTime() {
  const now = Date.now();
  if (active()) state.time[state.index] += Math.max(0, Math.min(now, state.deadline) - entered);
  entered = now;
}
function stopVoice() {
  if (native) window.speechSynthesis?.cancel();
}
function finish() {
  stopVoice();
  recordTime();
  state.phase = state.phase === "written" && written<questions.length ? "rest" : "results";
  if(state.phase==="results")state.completedAt=new Date().toISOString();
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
  if(!state.startedAt)state.startedAt=new Date().toISOString();
  if(!state.id)state.id=crypto.randomUUID();
  state.phase = phase;
  state.index = phase === "written" ? 0 : written;
  entered = Date.now();
  const minutes=adaptive ? (phase==="written"?written*1.5:(questions.length-written)*1.5) : (phase==="written"?105:50);
  state.deadline = entered + Math.ceil(minutes)*60000;
  persist();
  render();
}
function move(index) {
  if (tick()) return;
  recordTime();
  stopVoice();
  state.index = index;
  persist();
  render();
}
function renderExam() {
  const q = questions[state.index];
  const [first, end] = range();
  if (native) {
    $("open").hidden = $("pdf").hidden = true;
    $("material").textContent = skills[q.skill];
    $("passage").textContent = q.skill === 3 ? "" : q.context;
    $("stem").textContent = q.prompt;
    $("speak").hidden = q.skill !== 3;
    $("speak").onclick = () => {
      if (tick()) return;
      if (!window.speechSynthesis) {
        $("warning").textContent = "Japanese speech is unavailable in this browser. Open the mock on a device with a Japanese voice.";
        return;
      }
      stopVoice();
      const spokenChoices = q.options === 3 ? q.choices.map((c,i) => (i+1) + "番。" + c).join("。") : "";
      const speech = new SpeechSynthesisUtterance(q.context + "。" + q.prompt + spokenChoices);
      speech.lang = "ja-JP";
      const voice = speechSynthesis.getVoices().find(v => /^ja/i.test(v.lang));
      if (voice) speech.voice = voice;
      speech.onerror = e => {
        if (!["interrupted","canceled"].includes(e.error)) $("warning").textContent = "Audio could not play. Check your Japanese voice settings and try again.";
      };
      speechSynthesis.speak(speech);
    };
  } else {
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
  }
  $("prompt").textContent = q.label;
  $("volume").textContent = title + " · " + skills[q.skill];
  const answered = state.answers.slice(first,end).filter(Boolean).length;
  $("progress").max = end-first;
  $("progress").value = answered;
  $("count").textContent = answered + " of " + (end-first) + " answered";
  $("choices").replaceChildren();
  for (let n = 1; n <= q.options; n++) {
    const choice = button(native && !(q.skill === 3 && q.options === 3) ? n + ". " + q.choices[n-1] : n, () => {
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
    const booklet = document.createElement(native ? "span" : "a");
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
  $("review-items").replaceChildren();
  for (const q of questions) {
    const answer = state.answers[q.index];
    if (native) {
      const entry = document.createElement("details");
      const title = document.createElement("summary");
      title.textContent = skills[q.skill] + " · " + q.label + (answer === q.key ? " · Correct" : " · Missed") + (state.guesses[q.index] ? " · Guessed" : "");
      entry.append(title);
      for (const line of [q.context, q.prompt, "Your answer · " + (q.choices[answer-1] || "Unanswered"), "Correct · " + q.choices[q.key-1], q.why]) {
        if (!line) continue;
        const p = document.createElement("p");
        p.textContent = line;
        entry.append(p);
      }
      $("review-items").append(entry);
    }
    if (answer === q.key && !state.guesses[q.index]) continue;
    const row = document.createElement("li");
    row.textContent = skills[q.skill] + " · " + q.label + " · Your answer " + (answer || "—") + " · Correct " + q.key + (state.guesses[q.index] ? " · Guessed" : "") + " · " + Math.round(state.time[q.index]/1000) + "s";
    $("mistakes").append(row);
  }
  $("feedback").textContent = $("mistakes").children.length ? "Compare these answers with the booklet and listening transcript." : "Every answer was correct and confident.";
  $("retake").hidden=archivedView;
  $("script").hidden = native;
  if (native) $("feedback").textContent = "Open any question below for its explanation and listening script.";
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

function officialRows(id) {
  const rows=[];
  for (const [skill, groups] of keys[id].entries()) {
    for (const [group, answers] of groups.split(" ").entries()) {
      for (const [i, answer] of [...answers].entries()) {
        const index = rows.length;
        const number = group === 4 && i >= 2 ? "3 (" + (i-1) + ")" : i+1;
        rows.push({index, skill, group:group+1, key:Number(answer),
          label:skill < 3 ? "Question " + (index+1) : "問題 " + (group+1) + " · " + number,
          options:skill === 3 && group === 3 ? 3 : 4});
      }
    }
  }
  return rows;
}
async function getPaper(id,version) {
  const existing=await access("papers","get",version||id);
  if(existing)return existing;
  let rows;
  if (bookIds.includes(id)){
    if(!inventory)await materials();
    rows=form(id,inventory,original).map((q,index)=>({...q,index,skill:skills.indexOf(q.skill),label:"Question "+(index+1),options:q.choices.length}));
  } else if(Object.hasOwn(keys,id)) rows=officialRows(id);
  else throw new Error("This exam is unavailable on this device.");
  const paper={id:version||id,book:id,title:bookName(id),edition:EDITION,questions:rows};
  if(Object.hasOwn(keys,id))paper.source="https://www.jlpt.jp/samples/sample"+id+"/pdf/N2";
  await access("papers","put",paper);
  return paper;
}
async function setup(){
if (!native && !Object.hasOwn(keys, year)) {
  for(const id of bookIds){
    $("books").append(button(bookName(id),()=>location.assign("?book="+id)));
  }
  for (const value of Object.keys(keys)) $("books").append(button(bookName(value),()=>location.assign("?book="+value)));
  await materials();
  for(const a of currentAttempts())await getPaper(a.book,a.paper);
  $("dashboard").hidden=$("hubnav").hidden=false;
  await activateProgress(inventory);
  if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView();
} else {
  const attemptId=new URLSearchParams(location.search).get("attempt");
  let saved=JSON.parse(localStorage.getItem(storageKey)||"null");
  if(attemptId && attemptId!==(saved?.id||"legacy-"+year)){
    const archived=await access("history","get",attemptId);
    if(!archived||archived.book!==year)throw new Error("This attempt is unavailable on this device.");
    saved=archived;archivedView=true;
  }
  const paper=await getPaper(year,saved?.paper);
  questions.push(...paper.questions);title=paper.title;
  $("sources").hidden = true;
  $("set-title").textContent = title;
  if(native) document.body.classList.add("native");
  written = questions.findIndex(q => q.skill === 3);
  if(written<0)written=questions.length;
  const firstPhase=written?"written":"listening";
  const fresh=()=>({id:crypto.randomUUID(),book:year,paper:paper.id,phase:"ready", index:0, deadline:0, answers:Array(questions.length).fill(0),
    guesses:Array(questions.length).fill(false), time:Array(questions.length).fill(0)});
  state=fresh();
  if(saved?.answers?.length===questions.length)state={...state,...saved,id:saved.id||"legacy-"+year};
  $("retake").onclick=async()=>{
    try{
      await access("history","put",{...state,book:year,paper:paper.id});
      archivedView=true;
      localStorage.removeItem(storageKey);
      location.assign("?book="+year);
    }catch(e){$("warning").textContent="Could not archive this attempt. "+e.message;}
  };
  $("library").hidden = false;
  $("books").append(button("Start exam", () => start(firstPhase)));
  if(adaptive){
    $("intro").querySelector("p").textContent=questions.length+" targeted questions. Allow about "+Math.ceil(questions.length*1.5)+" minutes. Topics were selected from your saved evidence.";
    $("listen").textContent="Start targeted listening";
  }
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
  window.addEventListener("pagehide", () => { stopVoice(); recordTime(); persist(); });
  render();
  setInterval(tick, 1000);
}

}
setup().catch(error=>{$("warning").textContent=error.message;});
