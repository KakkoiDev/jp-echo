import {bookIds,bookName,EDITION,SETS_EDITION,form,realisticRows,realisticPaperId,setFile} from "./n2-forms.js";
import {access,currentAttempts,download,prefix,report,scored} from "./n2-progress.js";
import {SKILLS,SKILL_JA,SECTIONS,PASS_TOTAL,SECTION_MIN,SECTION_MAX,estimate,nextExamDate,daysUntil,recallQueue,recallRecord,dailyGoal,coverage,localDay,todayPlan,EXAM_CHECKLIST} from "./n2-study.js";
import {flagSvg} from "./components.js";
import {speakOnce,speakAndWait,japaneseVoices} from "./speech.js";

// Official workbook answer numbering. Listening examples are excluded.
const keys = {
  2012: ["23143 32142 12142 4412112 34133 43324", "324413331221 21433 24131", "32212 344314321 13 244 41", "23321 234232 14312 31311332312 3413"],
  2018: ["24231 23214 13341 2132314 14342 34142", "112314223434 34123 22413", "23421 131412231 43 243 43", "12243 321241 21312 232131222113 3131"],
};
const pdfCodes = ["V", "G", "R", "L"];
const official = "https://www.jlpt.jp/samples/sample";
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const year = params.get("book");
const adaptive = /^adaptive-[a-f0-9-]{36}$/.test(year || "");
const native = bookIds.includes(year) || adaptive;
const settings = (() => { try { return JSON.parse(localStorage.getItem("jp-echo-settings") || "{}"); } catch { return {}; } })();
const chevron = `<svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
let inventory, original, themes = {};

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node[k] = v;
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  node.append(...children.filter(c => c !== null && c !== undefined));
  return node;
}
// The one row shape on this page: Library's two-line tool row.
function row({glyph, title, line, href, onclick, chip}) {
  const node = el(href ? "a" : "button", {class: "library-tool two-line", href, type: href ? undefined : "button", onclick});
  node.append(el("span", {class: "library-tool-glyph", lang: "ja", "aria-hidden": "true", text: glyph}),
    el("span", {class: "library-tool-label"}, el("strong", {text: title}), line ? el("span", {text: line}) : ""),
    ...(chip ? [el("span", {class: "status-chip " + (chip.kind || ""), text: chip.text})] : []));
  node.insertAdjacentHTML("beforeend", chevron);
  return node;
}
function warn(message) { $("warning").textContent = message; }
function show(id) { for (const s of ["hub", "recall", "intro", "exam", "rest", "results"]) $(s).hidden = s !== id; document.body.dataset.view = id; }
async function json(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Unable to load " + path + ". Reconnect and reload.");
  return response.json();
}
async function materials() {
  if (!inventory) [inventory, original, themes] = await Promise.all([json("./n2-inventory.json"), json("./n2-echo-bank.json"), json("./n2-sets/index.json").catch(() => ({}))]);
}
// Sets 02–20 have a realistic edition when its file is there; set 01 keeps its paper.
const realistic = id => bookIds.includes(id) && id !== bookIds[0] && !!themes[id];
const titleOf = id => realistic(id) ? String(bookIds.indexOf(id) + 1).padStart(2, "0") + " · " + themes[id] : bookName(id);
function voice() {
  const voices = japaneseVoices("ja"), pick = settings.voice;
  if (pick === "random") return voices[Math.floor(Math.random() * voices.length)] || null;
  return voices[Number(pick)] || null;
}
function say(text) {
  if (!window.speechSynthesis) { warn("Japanese speech is unavailable in this browser. Open Echo on a device with a Japanese voice."); return false; }
  return speakOnce(text, {voice: voice(), rate: Number(settings.rate) || 1});
}
// 【word】 in a question is the tested word: shown underlined, as on the paper.
function marked(text = "") {
  const out = document.createDocumentFragment();
  for (const [i, part] of String(text).split(/【|】/).entries()) out.append(i % 2 ? el("u", {class: "n2-mark", text: part}) : part);
  return out;
}
// A listening script, one line per turn ("女：…"). Each speaker gets their own
// voice where the device has more than one; the labels are not read aloud.
let scriptRun = 0;
async function playScript(lines) {
  if (!window.speechSynthesis) { warn("Japanese speech is unavailable in this browser. Open Echo on a device with a Japanese voice."); return; }
  const run = ++scriptRun, voices = japaneseVoices("ja"), speakers = [];
  const base = voice(), rate = Number(settings.rate) || 1;
  speechSynthesis.cancel();
  for (const raw of lines) {
    if (run !== scriptRun) return;
    const m = /^([^：:]{1,6})[：:](.*)$/.exec(raw.trim());
    const who = m ? m[1] : "", text = (m ? m[2] : raw).trim();
    if (!text) continue;
    if (who && !speakers.includes(who)) speakers.push(who);
    const pick = voices.length > 1 && who ? voices[(Math.max(0, voices.indexOf(base)) + speakers.indexOf(who)) % voices.length] : base;
    await speakAndWait(text, {voice: pick, rate});
    await new Promise(r => setTimeout(r, 350));
  }
}
function stopScript() { scriptRun++; window.speechSynthesis?.cancel(); }
function listeningLines(q) {
  const script = (q.context || "").split(/\n+/).filter(Boolean);
  const choices = q.options === 3 ? q.choices.map((c, i) => (i + 1) + "。" + c) : [];
  const ask = q.prompt ? [q.prompt] : [];
  // As on the paper: tasks and points ask first and again at the end; the
  // summary questions ask after the talk; replies are read out as 1, 2, 3.
  if (q.mondai === 1 || q.mondai === 2) return [...ask, ...script, ...ask];
  if (q.mondai === 4) return [...script, ...choices];
  return [...script, ...ask, ...choices];
}
const dateLabel = iso => iso ? new Date(iso).toLocaleDateString(undefined, {month: "short", day: "numeric"}) : "Earlier";

/* ───────── Papers ───────── */
function officialRows(id) {
  const rows = [];
  for (const [skill, groups] of keys[id].entries()) {
    for (const [group, answers] of groups.split(" ").entries()) {
      for (const [i, answer] of [...answers].entries()) {
        const index = rows.length;
        const number = group === 4 && i >= 2 ? "3 (" + (i - 1) + ")" : i + 1;
        rows.push({index, skill, group: group + 1, key: Number(answer),
          label: skill < 3 ? "Question " + (index + 1) : "問題 " + (group + 1) + " · " + number,
          options: skill === 3 && group === 3 ? 3 : 4});
      }
    }
  }
  return rows;
}
async function getPaper(id, version) {
  await materials();
  const key = version || (realistic(id) ? realisticPaperId(id) : id);
  const existing = await access("papers", "get", key);
  if (existing) return existing;
  let rows;
  if (realistic(id)) {
    const set = await json(setFile(id));
    const paper = {id: key, book: id, title: titleOf(id), edition: SETS_EDITION, questions: realisticRows(set)};
    await access("papers", "put", paper);
    return paper;
  }
  if (bookIds.includes(id)) {
    await materials();
    rows = form(id, inventory, original).map((q, index) => ({...q, index, skill: SKILLS.indexOf(q.skill), label: "Question " + (index + 1), options: q.choices.length}));
  } else if (Object.hasOwn(keys, id)) rows = officialRows(id);
  else throw new Error("This exam is unavailable on this device.");
  const paper = {id: key, book: id, title: bookName(id), edition: EDITION, questions: rows};
  if (Object.hasOwn(keys, id)) paper.source = official + id + "/pdf/N2";
  await access("papers", "put", paper);
  return paper;
}

/* ───────── Hub ───────── */
async function hub() {
  show("hub");
  await materials();
  for (const a of currentAttempts()) await getPaper(a.book, a.paper).catch(() => {});
  const data = await report(), evidence = scored(data);
  const papers = new Map(data.papers.map(p => [p.id, p]));
  const exam = nextExamDate(), days = daysUntil(exam);
  $("hub-exam-line").textContent = "Exam · " + exam.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"});
  $("hub-days").textContent = days;
  $("hub-days-label").textContent = days === 1 ? "day to go" : days === 0 ? "Exam day. 頑張って。" : "days to go";
  if (days === 0) $("hub-days").textContent = "今日";

  // Today: one ordered plan. The coach may replace it for the day.
  const goal = dailyGoal({inventory, recall: data.recall, examDate: exam});
  const weakAll = ["meaning", "reading", "grammar"].reduce((n, type) => n + recallQueue({type, filter: "weak", inventory, recall: data.recall, evidence, size: Infinity}).length, 0);
  const attempts = [...data.attempts].sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  const live = attempts.find(a => ["written", "listening", "rest"].includes(a.phase));
  const done = new Set(attempts.filter(a => a.phase === "results").map(a => a.book));
  const finished = attempts.filter(a => a.phase === "results" && !a.book.startsWith("adaptive-")).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const latestDone = attempts.filter(a => a.phase === "results").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
  const next = bookIds.find(id => !done.has(id));
  const {providerReady} = await import("./api.js");
  const aiReady = providerReady(settings);
  const base = todayPlan({days, goal, weak: weakAll, aiReady,
    running: live && {book: live.book, title: papers.get(live.paper || live.book)?.title || titleOf(live.book), progress: live.answers.filter(Boolean).length + " of " + live.answers.length + " answered" + (live.phase === "rest" ? " · listening next" : "")},
    nextMock: next && {id: next, title: titleOf(next)}, lastMockAt: finished[0]?.completedAt,
    latestResults: latestDone && localDay(new Date(latestDone.completedAt)) === localDay() ? "?book=" + latestDone.book + "&attempt=" + encodeURIComponent(latestDone.id) : null});
  const context = {data, evidence, goal, weakAll, days, base, aiReady, next, latestDone};
  drawPlan(readCoachPlan() || base, context);
  $("coach").onclick = () => coach(context);
  $("coach").disabled = !aiReady;
  $("coach").title = aiReady ? "" : "Add an AI provider in Echo Settings";
  $("coach-reset").onclick = () => { try { localStorage.removeItem(COACH_KEY); } catch {} $("coach-box").hidden = true; drawPlan(base, context); };
  $("generate-open").onclick = () => openGenerator({aiReady});
  $("generate-open").disabled = !aiReady;
  $("ai-hint").hidden = aiReady;
  $("checklist-zone").hidden = days > 3;
  drawChecklist();
  $("rest-summary").textContent = todaySummary(data);
  $("breathe-open").onclick = breathe;

  // Readiness: the latest scored attempt.
  const latest = attempts.find(a => a.phase === "results" && papers.get(a.paper || a.book));
  $("readiness").replaceChildren(latest ? scoreCard(papers.get(latest.paper || latest.book), latest, true)
    : el("div", {class: "empty-panel"}, el("strong", {text: "No score yet"}), el("span", {text: "Finish a whole mock to see an estimated score for each JLPT section."})));
  const cov = coverage(inventory, data.recall, evidence);
  $("coverage").replaceChildren(...[["meaning", "語彙", "Word meanings"], ["reading", "読み", "Kanji readings"], ["grammar", "文法", "Grammar"]].map(([type, ja, en]) => {
    const c = cov[type];
    return el("a", {class: "n2-meter", href: "?view=recall&type=" + type},
      el("span", {class: "n2-meter-head"}, el("span", {lang: "ja", class: "n2-meter-ja", text: ja}), el("span", {text: en}), el("span", {class: "n2-meter-n", text: c.checked + " / " + c.total})),
      el("span", {class: "progress-track"}, el("span", {style: "width:" + (c.checked / c.total * 100) + "%"}), el("span", {class: "n2-meter-auto", style: "width:" + (c.automatic / c.total * 100) + "%"})),
      el("span", {class: "hint", text: c.automatic + " instant on two days · " + c.weak + " weak"}));
  }));

  // Exams
  const status = id => {
    const mine = attempts.filter(a => a.book === id);
    const live = mine.find(a => a.phase !== "results");
    if (live) return {line: "In progress · " + live.answers.filter(Boolean).length + " / " + live.answers.length + " answered", chip: {text: "Resume", kind: "due"}};
    const scoredRuns = mine.filter(a => a.phase === "results" && papers.get(a.paper || a.book)).map(a => ({a, e: estimate(papers.get(a.paper || a.book), a)}));
    if (!scoredRuns.length) return {line: null};
    const best = scoredRuns.reduce((x, y) => y.e.total > x.e.total ? y : x);
    return {line: "Best " + best.e.total + " / 180 · " + dateLabel(best.a.completedAt), chip: best.e.pass ? {text: "Pass line", kind: ""} : {text: "Below", kind: "learning"}};
  };
  $("exam-list").replaceChildren(...bookIds.map((id, i) => {
    const s = status(id);
    const [, title] = titleOf(id).split(" · ");
    return row({glyph: String(i + 1).padStart(2, "0"), title, line: s.line || (i === 0 ? "Original November mock · 101 questions" : realistic(id) ? "Full JLPT layout · 問題1–14 and listening 1–5 · 105 questions" : "Practice form · 101 questions"), href: "?book=" + id, chip: s.chip});
  }));
  $("workbook-list").replaceChildren(...Object.keys(keys).map(id => {
    const s = status(id);
    return row({glyph: "公", title: "Official sample · " + id, line: s.line || "Publisher booklet and audio · needs internet", href: "?book=" + id, chip: s.chip});
  }));

  // Coach and history
  $("adaptive-list").replaceChildren(...data.papers.filter(p => p.id.startsWith("adaptive-")).map(p =>
    row({glyph: "狙", title: p.title, line: p.questions.length + " targeted questions", href: "?book=" + p.id, chip: status(p.id).chip})));
  $("history-list").replaceChildren(...attempts.filter(a => a.phase === "results").map(a => {
    const p = papers.get(a.paper || a.book), e = p && estimate(p, a);
    return row({glyph: "歴", title: p?.title || titleOf(a.book), line: dateLabel(a.completedAt || a.startedAt) + (e ? " · " + e.total + " / 180" : ""), href: "?book=" + a.book + "&attempt=" + encodeURIComponent(a.id)});
  }));
  $("export-report").onclick = async () => { try { download(await report()); } catch (e) { warn(e.message); } };
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

/* ───────── Coach ───────── */
const COACH_KEY = "echo-n2-coach";
const STEP_KINDS = ["recall", "mock", "generate", "review", "rest", "checklist"];
function readCoachPlan() {
  try { const saved = JSON.parse(localStorage.getItem(COACH_KEY) || "null"); return saved?.day === localDay() ? saved.plan : null; } catch { return null; }
}
// Every step does something here: a recall queue, a mock, the generator,
// the latest review, the wind-down or the checklist.
function stepHref(step, ctx) {
  if (step.href) return step.href;
  if (step.kind === "recall") return "?view=recall&type=" + (["meaning", "reading", "grammar"].includes(step.type) ? step.type : "meaning") + "&queue=" + (["daily", "weak", "new"].includes(step.queue) ? step.queue : "daily");
  if (step.kind === "mock") return ctx.next ? "?book=" + ctx.next : "#exams";
  if (step.kind === "review") return ctx.latestDone ? "?book=" + ctx.latestDone.book + "&attempt=" + encodeURIComponent(ctx.latestDone.id) : "#history";
  return null;
}
function drawPlan(plan, ctx) {
  $("plan-headline").textContent = plan.headline || "";
  $("plan-steps").replaceChildren(...plan.steps.map((step, i) => {
    const href = stepHref(step, ctx);
    const onclick = step.kind === "generate" ? () => openGenerator({aiReady: ctx.aiReady, focus: step.focus, count: step.count})
      : step.kind === "rest" ? () => { $("rest-zone").hidden = false; $("rest-zone").scrollIntoView({behavior: "smooth"}); }
      : step.kind === "checklist" ? () => { $("checklist-zone").hidden = false; $("checklist-zone").scrollIntoView({behavior: "smooth"}); } : undefined;
    const node = row({glyph: step.glyph || String(i + 1), title: step.title, line: [step.line, step.minutes ? step.minutes + " min" : ""].filter(Boolean).join(" · "), href: href || undefined, onclick});
    if (step.disabled) node.setAttribute("aria-disabled", "true");
    if (step.done) node.classList.add("n2-done");
    return node;
  }));
}
function todaySummary(data) {
  const today = localDay();
  const checks = data.recall.reduce((n, r) => n + (r.events || []).filter(e => localDay(new Date(e.at)) === today).length, 0);
  const answered = data.attempts.filter(a => localDay(new Date(a.completedAt || a.startedAt || 0)) === today).reduce((n, a) => n + a.answers.filter(Boolean).length, 0);
  if (!checks && !answered) return "Nothing logged yet today. Even one round of twenty counts.";
  return "Today: " + checks + " recall checks and " + answered + " exam answers. That is real work — rest is part of the plan.";
}
async function coach(ctx) {
  const button = $("coach"); button.disabled = true;
  $("coach-box").hidden = false; $("coach-title").textContent = "Your coach"; $("coach-copy").textContent = "Reading your checks and mocks…"; $("coach-reset").hidden = true;
  try {
    const {data, evidence} = ctx;
    const attempts = data.attempts.filter(a => a.phase !== "ready").map(a => {
      const p = data.papers.find(p => p.id === (a.paper || a.book));
      return {exam: p?.title || a.book, completed: a.completedAt || null, phase: a.phase, estimate: p ? estimate(p, a).sections.map(s => ({section: s.en, scaled: s.scaled, correct: s.correct, of: s.total})) : null};
    });
    const misses = evidence.filter(x => (!x.correct || x.guessed) && x.answered).slice(-40).map(x => {
      const q = data.papers.find(p => p.id === x.paper)?.questions[x.index];
      return {skill: SKILLS[x.skill], kind: q?.kind, prompt: q?.prompt, correct: q?.choices?.[q.key - 1], guessed: x.guessed, seconds: x.seconds, at: x.at};
    });
    const cov = coverage(inventory, data.recall, evidence);
    const weak = data.recall.filter(x => x.last !== "instant").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40).map(x => [x.dimension, x.prompt, x.last]);
    const {askModel} = await import("./api.js");
    const input = {today: localDay(), daysUntilExam: ctx.days, hoursAvailable: 6, coverage: cov, dailyGoal: ctx.goal, weakItemCount: ctx.weakAll, attempts, misses, weakChecks: weak, standardPlan: ctx.base.steps.map(s => ({kind: s.kind, title: s.title}))};
    const system = `You are a calm, precise JLPT N2 coach inside the Echo app. Use only the supplied observations; Echo's mock scores are uncalibrated estimates. Plan today's study (up to 6 hours) in the order the learner should do it, and say what to study next and why. Each step must be one of these app actions: recall (type: meaning|reading|grammar, queue: daily|weak|new), mock (the next full mock), generate (a practice exam: focus weak|Vocabulary|Grammar|Reading|Listening|mixed, count 10|20|35), review (the latest results), rest, checklist. Include a short wind-down. In the last three days avoid new material. Write English, kind and direct, no filler. Return JSON {"headline":string,"diagnosis":string (2-4 sentences: strongest, weakest, the one thing that will raise the score most),"steps":[{"kind":string,"title":string,"line":string (what and why, one sentence),"minutes":number,"type"?:string,"queue"?:string,"focus"?:string,"count"?:number}]} with 4-7 steps.`;
    const reply = await askModel(JSON.stringify(input), system, settings);
    const glyphs = {recall: "憶", mock: "試", generate: "狙", review: "直", rest: "休", checklist: "券"};
    const steps = (Array.isArray(reply?.steps) ? reply.steps : []).filter(s => STEP_KINDS.includes(s?.kind) && typeof s.title === "string").slice(0, 8).map(s => ({
      kind: s.kind, glyph: glyphs[s.kind], title: s.title.slice(0, 80), line: String(s.line || "").slice(0, 200), minutes: Math.min(240, Math.max(0, Number(s.minutes) || 0)),
      type: s.type, queue: s.queue, focus: s.focus, count: [10, 20, 35].includes(s.count) ? s.count : 20}));
    if (!steps.length) throw new Error("The coach's answer had no usable steps.");
    const plan = {headline: String(reply.headline || "Today's plan").slice(0, 120), steps};
    try { localStorage.setItem(COACH_KEY, JSON.stringify({day: localDay(), plan, diagnosis: reply.diagnosis || ""})); } catch {}
    $("coach-copy").textContent = reply.diagnosis || "Here is today's plan.";
    $("coach-reset").hidden = false;
    drawPlan(plan, ctx);
  } catch (e) { $("coach-copy").textContent = "The coach is unavailable. " + e.message + " The standard plan still works."; }
  finally { button.disabled = false; }
}
function openGenerator({aiReady, focus = "weak", count = 20} = {}) {
  if (!aiReady) { warn("Add an AI provider and key in Echo Settings to generate exams."); return; }
  import("./n2-adaptive.js").then(({FOCUS, generateAdaptive}) => {
    let pick = Object.hasOwn(FOCUS, focus) ? focus : "weak", size = [10, 20, 35].includes(count) ? count : 20;
    const chips = () => {
      $("generate-focus").replaceChildren(...Object.entries(FOCUS).map(([k, label]) => el("button", {type: "button", "data-ui": "button", "aria-pressed": String(k === pick), onclick: () => { pick = k; chips(); }, text: label})));
      $("generate-count").replaceChildren(...[10, 20, 35].map(n => el("button", {type: "button", "data-ui": "button", "aria-pressed": String(n === size), onclick: () => { size = n; chips(); }, text: n + " questions · ~" + Math.round(n * 1.6) + " min"})));
    };
    chips();
    $("generate-status").textContent = "";
    $("generate-go").disabled = false;
    $("generate-close").onclick = () => $("generate-dialog").close();
    $("generate-go").onclick = async () => {
      $("generate-go").disabled = true;
      try { const paper = await generateAdaptive(t => $("generate-status").textContent = t, {focus: pick, count: size}); location.assign("?book=" + paper.id); }
      catch (e) { $("generate-status").textContent = e.message; $("generate-go").disabled = false; }
    };
    $("generate-dialog").showModal();
  });
}
function drawChecklist() {
  let ticks = {};
  try { ticks = JSON.parse(localStorage.getItem("echo-n2-checklist") || "{}"); } catch {}
  $("checklist").replaceChildren(...EXAM_CHECKLIST.map(([id, text]) => {
    const box = el("input", {type: "checkbox", id: "check-" + id});
    box.checked = !!ticks[id];
    box.onchange = () => { ticks[id] = box.checked; try { localStorage.setItem("echo-n2-checklist", JSON.stringify(ticks)); } catch {} };
    return el("label", {class: "n2-check", for: "check-" + id}, box, el("span", {text}));
  }));
}
// One minute of slow breathing: in 4, hold 4, out 6. The cue is text first;
// the circle only moves when motion is allowed.
let breathTimer = 0;
function breathe() {
  const cues = [["吸って · breathe in", 4, "in"], ["止めて · hold", 4, "hold"], ["吐いて · breathe out", 6, "out"]];
  const dialog = $("breathe-dialog"), cue = $("breath-cue"), circle = $("breath");
  let t = 0, step = 0, left = 0;
  const run = () => {
    clearTimeout(breathTimer);
    if (t >= 60) { cue.textContent = "お疲れさま。 Well done."; circle.dataset.phase = "rest"; return; }
    const [text, secs, phase] = cues[step % 3];
    if (left === 0) { left = secs; cue.textContent = text; circle.dataset.phase = phase; circle.style.setProperty("--breath-secs", secs + "s"); }
    breathTimer = setTimeout(() => { left--; t++; if (left === 0) step++; run(); }, 1000);
  };
  $("breathe-close").onclick = () => { clearTimeout(breathTimer); dialog.close(); };
  $("breathe-again").onclick = () => { t = 0; step = 0; left = 0; run(); };
  dialog.addEventListener("close", () => clearTimeout(breathTimer), {once: true});
  dialog.showModal(); t = 0; step = 0; left = 0; run();
}

// Estimated section scores, the JLPT way: three sections of 60, each with a floor.
function scoreCard(paper, attempt, compact = false) {
  const e = estimate(paper, attempt);
  const card = el("div", {class: "n2-score"});
  if (e.complete) {
    card.append(el("div", {class: "stats-figure"}, el("strong", {text: e.total}), el("span", {}, "/ 180 estimated · pass line ", el("b", {text: PASS_TOTAL}))),
      el("span", {class: "status-chip " + (e.pass ? "" : "due"), text: e.pass ? "Above the pass line" : "Below the pass line"}));
  }
  for (const s of e.sections) {
    if (!s.total) continue;
    const pct = s.scaled === null ? 0 : s.scaled / SECTION_MAX * 100;
    card.append(el("div", {class: "n2-section" + (s.ok === false ? " low" : "")},
      el("span", {class: "n2-section-head"}, el("span", {lang: "ja", class: "n2-meter-ja", text: s.ja}), el("span", {text: s.en}),
        el("span", {class: "n2-meter-n", text: s.scaled === null ? "after listening" : s.scaled + " / 60"})),
      el("span", {class: "progress-track n2-section-track"}, el("span", {style: "width:" + pct + "%"}), el("i", {class: "n2-floor", style: "left:" + (SECTION_MIN / SECTION_MAX * 100) + "%", title: "Section minimum " + SECTION_MIN})),
      el("span", {class: "hint", text: s.correct + " of " + s.total + " correct" + (s.ok === false ? " · under the " + SECTION_MIN + "-point minimum" : "")})));
  }
  card.append(el("p", {class: "hint", text: (compact ? paper.title + " · " + dateLabel(attempt.completedAt) + ". " : "") + "Raw share × 60. The real test equates scores, so read this as direction, not a prediction."}));
  return card;
}

/* ───────── Recall ───────── */
const ASK = {meaning: "Say the meaning, then check", reading: "Read it aloud, then check", grammar: "Say what it means and use it in a sentence"};
async function recall() {
  show("recall");
  await materials();
  let data = await report(), evidence = scored(data);
  let type = ["meaning", "reading", "grammar"].includes(params.get("type")) ? params.get("type") : (localStorage.getItem("echo-n2-recall-type") || "meaning");
  let queue = ["daily", "weak", "new"].includes(params.get("queue")) ? params.get("queue") : "daily";
  let session = [], index = 0, revealed = false, tally = {instant: 0, slow: 0, missed: 0}, missed = [];
  const sync = () => {
    const url = new URL(location.href); url.searchParams.set("view", "recall"); url.searchParams.set("type", type); url.searchParams.set("queue", queue);
    history.replaceState(history.state, "", url);
    try { localStorage.setItem("echo-n2-recall-type", type); } catch {}
    document.querySelectorAll("#recall [role=tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.type === type));
    document.querySelectorAll("#recall [data-queue]").forEach(b => b.setAttribute("aria-pressed", b.dataset.queue === queue));
  };
  const begin = () => {
    session = recallQueue({type, filter: queue, inventory, recall: data.recall, evidence});
    index = 0; tally = {instant: 0, slow: 0, missed: 0}; missed = [];
    sync(); draw();
  };
  const grades = [...document.querySelectorAll("#recall-actions [data-grade]")];
  function draw() {
    const current = session[index];
    $("recall-done").hidden = !!current || !session.length;
    $("recall-card").hidden = !current && !!session.length;
    $("recall-actions").hidden = !current;
    $("recall-progress").textContent = session.length ? Math.min(index + 1, session.length) + " / " + session.length : "";
    $("recall-bar").style.width = (session.length ? index / session.length * 100 : 0) + "%";
    revealed = false;
    $("recall-answer").hidden = true; $("reveal").hidden = false; grades.forEach(b => b.hidden = true);
    if (!session.length) {
      $("recall-ask").textContent = "";
      $("recall-prompt").textContent = queue === "weak" ? "Nothing weak here." : "All caught up.";
      $("recall-state").textContent = queue === "weak" ? "Misses, guesses and slow answers from checks and mocks appear here." : "Every item in this deck was checked today. Try another deck.";
      $("recall-say").hidden = true; $("recall-actions").hidden = true;
      return;
    }
    if (!current) { finishRound(); return; }
    $("recall-ask").textContent = ASK[type];
    $("recall-prompt").textContent = current.item.prompt;
    $("recall-prompt").classList.toggle("long", current.item.prompt.length > 8);
    $("recall-say").hidden = type === "reading";
    $("recall-state").textContent = current.weak ? "Weak · missed or slow last time" : !current.r ? "First check" : current.r.checks + " checks · last " + current.r.last;
  }
  function reveal() {
    const current = session[index]; if (!current || revealed) return;
    revealed = true;
    $("recall-reading").textContent = current.item.reading && current.item.reading !== current.item.prompt ? current.item.reading : "";
    $("recall-meaning").textContent = current.item.answer;
    $("recall-answer").hidden = false; $("reveal").hidden = true; grades.forEach(b => b.hidden = false);
    if (type === "reading" && current.item.reading) say(current.item.reading);
  }
  async function grade(value) {
    const current = session[index]; if (!current || !revealed) return;
    revealed = false;
    const record = recallRecord(current.r, current, value);
    try {
      await access("recall", "put", record);
      data.recall = data.recall.filter(x => x.id !== record.id).concat(record);
      tally[value]++; if (value !== "instant") missed.push(current);
      index++; draw();
    } catch (error) { revealed = true; warn("Could not save this rating: " + error.message); }
  }
  function finishRound() {
    $("recall-done-title").textContent = session.length + " checked";
    $("recall-done-line").textContent = tally.instant + " instant · " + tally.slow + " slow · " + tally.missed + " missed";
    $("recall-missed").replaceChildren(...missed.map(m => el("li", {},
      el("span", {class: "drill-missed-text"}, el("span", {lang: "ja", text: m.item.prompt + (m.item.reading && m.item.reading !== m.item.prompt ? "（" + m.item.reading + "）" : "")}), el("span", {class: "hint", text: m.item.answer})))));
    $("recall-bar").style.width = "100%";
  }
  $("reveal").onclick = reveal;
  $("recall-card").onclick = e => { if (!e.target.closest("button")) reveal(); };
  grades.forEach(b => b.onclick = () => grade(b.dataset.grade));
  $("recall-say").onclick = () => { const c = session[index]; if (c) say(c.item.prompt); };
  $("recall-again").onclick = async () => { data = await report(); evidence = scored(data); begin(); };
  document.querySelectorAll("#recall [role=tab]").forEach(b => b.onclick = () => { type = b.dataset.type; begin(); });
  document.querySelectorAll("#recall [data-queue]").forEach(b => b.onclick = () => { queue = b.dataset.queue; begin(); });
  document.addEventListener("keydown", e => {
    if (e.target.closest("input,textarea,select") || e.metaKey || e.ctrlKey) return;
    if ((e.key === " " || e.key === "Enter") && !revealed) { e.preventDefault(); reveal(); }
    else if (revealed && ["1", "2", "3"].includes(e.key)) grade(["missed", "slow", "instant"][Number(e.key) - 1]);
  });
  begin();
}

/* ───────── Exam ───────── */
async function exam() {
  const questions = [];
  let written = 0, state, entered = Date.now(), shownGroup = "", archivedView = false;
  const storageKey = prefix + year;
  const bookUrl = official + year + "/pdf/N2";
  const attemptId = params.get("attempt");
  let saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (attemptId && attemptId !== (saved?.id || "legacy-" + year)) {
    const archived = await access("history", "get", attemptId);
    if (!archived || archived.book !== year) throw new Error("This attempt is unavailable on this device.");
    saved = archived; archivedView = true;
  }
  const paper = await getPaper(year, saved?.paper);
  questions.push(...paper.questions);
  document.title = paper.title + " · JLPT N2 · Echo";
  written = questions.findIndex(q => q.skill === 3);
  if (written < 0) written = questions.length;
  const firstPhase = written ? "written" : "listening";
  const fresh = () => ({id: crypto.randomUUID(), book: year, paper: paper.id, phase: "ready", index: 0, deadline: 0, answers: Array(questions.length).fill(0),
    guesses: Array(questions.length).fill(false), time: Array(questions.length).fill(0)});
  state = fresh();
  if (saved?.answers?.length === questions.length) state = {...state, ...saved, id: saved.id || "legacy-" + year};

  const minutes = phase => adaptive ? Math.ceil((phase === "written" ? written : questions.length - written) * 1.5) : (phase === "written" ? 105 : 50);
  function persist() {
    if (archivedView || state.phase === "ready") return;
    try {
      const other = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (other?.id && other.id !== state.id) return;
      if (other?.phase === "results" && state.phase !== "results") return;
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch { warn("Device storage is unavailable. Keep this page open to retain this attempt."); }
  }
  const active = () => state.phase === "written" || state.phase === "listening";
  const range = () => state.phase === "written" ? [0, written] : [written, questions.length];
  function recordTime() {
    const now = Date.now();
    if (active()) state.time[state.index] += Math.max(0, Math.min(now, state.deadline) - entered);
    entered = now;
  }
  const stopVoice = () => { if (native) stopScript(); };
  function finish() {
    stopVoice(); recordTime();
    if ($("grid-dialog").open) $("grid-dialog").close();
    state.phase = state.phase === "written" && written < questions.length ? "rest" : "results";
    if (state.phase === "results") state.completedAt = new Date().toISOString();
    $("audio").pause();
    persist(); render(); scrollTo(0, 0);
  }
  function tick() {
    if (!active()) { $("clock").textContent = ""; return false; }
    const remaining = Math.ceil((state.deadline - Date.now()) / 1000);
    if (remaining <= 0) { finish(); return true; }
    $("clock").textContent = Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
    $("clock").classList.toggle("low", remaining <= 300);
    return false;
  }
  function start(phase) {
    if (!state.startedAt) state.startedAt = new Date().toISOString();
    if (!state.id) state.id = crypto.randomUUID();
    state.phase = phase;
    state.index = phase === "written" ? 0 : written;
    entered = Date.now();
    state.deadline = entered + minutes(phase) * 60000;
    persist(); render(); scrollTo(0, 0);
  }
  function move(index) {
    if (tick()) return;
    const [first, end] = range();
    if (index < first || index >= end) return;
    recordTime(); stopVoice();
    state.index = index;
    persist(); renderExam(); scrollTo(0, 0);
  }
  function choose(n) {
    if (tick()) return;
    state.answers[state.index] = n;
    persist(); renderExam();
  }
  function renderExam() {
    const q = questions[state.index];
    const [first, end] = range();
    const answered = state.answers.slice(first, end).filter(Boolean).length;
    $("material").textContent = SKILL_JA[q.skill] + " · " + SKILLS[q.skill];
    $("count").textContent = (state.index - first + 1) + " of " + (end - first) + " · " + answered + " answered";
    $("progress").style.width = answered / (end - first) * 100 + "%";
    $("prompt").textContent = q.label;
    $("instruction").textContent = q.instruction || "";
    const listening = q.skill === 3;
    if (native) {
      $("booklet").hidden = true;
      $("passage").textContent = listening ? "" : (q.context || "");
      $("passage").hidden = listening || !q.context;
      $("stem").replaceChildren(listening && q.mondai === 4 ? "" : marked(q.prompt));
      $("listen-box").hidden = !listening;
      $("plays").textContent = listening ? "Tap to hear the audio. The real test plays it once." : "";
    } else {
      $("booklet").hidden = false; $("passage").hidden = true; $("listen-box").hidden = true;
      $("stem").textContent = "Answer in the booklet's numbering.";
      const file = bookUrl + pdfCodes[q.skill] + ".pdf";
      if ($("open").href !== file) { $("pdf").src = file; $("open").href = file; }
      $("audio").hidden = $("track").hidden = !listening;
      if (listening && shownGroup !== q.group) {
        const audioYear = year === "2012" && q.group === 2 ? 2017 : year;
        $("audio").src = $("track").href = official + audioYear + "/mp3/N2Q" + q.group + ".mp3";
        shownGroup = q.group;
      }
    }
    const textual = native && !(listening && q.options === 3);
    $("choices").classList.toggle("numbers", !textual);
    $("choices").replaceChildren(...Array.from({length: q.options}, (_, i) => {
      const n = i + 1, picked = state.answers[state.index] === n;
      return el("button", {class: "n2-choice", type: "button", role: "radio", "aria-checked": String(picked), "data-ui": "button", onclick: () => choose(n)},
        el("span", {class: "n2-choice-n", text: n}), textual ? el("span", {class: "n2-choice-text", lang: "ja", text: q.choices[i]}) : null);
    }));
    $("guess").setAttribute("aria-pressed", String(!!state.guesses[state.index]));
    $("prev").disabled = state.index === first;
    $("next").textContent = state.index === end - 1 ? "Finish" : "›";
    $("next").setAttribute("aria-label", state.index === end - 1 ? "Review and finish the section" : "Next question");
  }
  function openGrid() {
    const [first, end] = range();
    const answers = state.answers.slice(first, end), unsure = state.guesses.slice(first, end).filter(Boolean).length, blanks = answers.filter(a => !a).length;
    $("grid-title").textContent = SKILLS[questions[first].skill] + (state.phase === "written" ? " · grammar · reading" : "") + " — questions";
    $("grid-summary").textContent = (end - first - blanks) + " answered · " + unsure + " unsure · " + blanks + " blank";
    $("jump").replaceChildren(...questions.slice(first, end).map(q => el("button", {type: "button", class: "n2-cell", "data-ui": "button",
      "data-answered": String(!!state.answers[q.index]), "data-unsure": String(!!state.guesses[q.index]), "aria-current": q.index === state.index ? "true" : null,
      "aria-label": q.label + (state.answers[q.index] ? ", answered" : ", blank") + (state.guesses[q.index] ? ", unsure" : ""),
      onclick: () => { $("grid-dialog").close(); move(q.index); }}, String(q.index - first + 1))));
    $("submit").textContent = blanks ? "Finish with " + blanks + " blank" : "Finish section";
    $("grid-dialog").showModal();
  }
  function renderResults() {
    $("results-title").textContent = paper.title;
    $("results-date").textContent = "Finished " + dateLabel(state.completedAt) + (archivedView ? " · earlier attempt" : "");
    $("scores").replaceChildren(scoreCard(paper, state), slowest());
    $("retake").hidden = archivedView;
    $("script").hidden = native; $("script").href = bookUrl + "script.pdf";
    let filter = "wrong";
    const draw = () => {
      document.querySelectorAll("#results [data-show]").forEach(b => b.setAttribute("aria-pressed", b.dataset.show === filter));
      const items = questions.filter(q => filter === "all" || state.answers[q.index] !== q.key || state.guesses[q.index]);
      $("review-items").replaceChildren(...(items.length ? items.map(reviewItem) : [el("div", {class: "empty-panel"}, el("strong", {text: "Clean sheet"}), el("span", {text: "Every answer was correct and confident."}))]));
    };
    document.querySelectorAll("#results [data-show]").forEach(b => b.onclick = () => { filter = b.dataset.show; draw(); });
    draw();
  }
  function slowest() {
    const top = [...questions].sort((a, b) => state.time[b.index] - state.time[a.index]).slice(0, 5).filter(q => state.time[q.index] > 0);
    if (!top.length) return el("span");
    const total = Math.round(state.time.reduce((a, b) => a + b, 0) / 60000);
    return el("details", {class: "n2-more"}, el("summary", {text: "Time · " + total + " min in all · slowest questions"}),
      el("ol", {class: "n2-times"}, ...top.map(q => el("li", {}, SKILLS[q.skill] + " · " + q.label + " · " + Math.round(state.time[q.index] / 1000) + "s"))));
  }
  function reviewItem(q) {
    const answer = state.answers[q.index], right = answer === q.key, unsure = state.guesses[q.index];
    const chip = right ? (unsure ? {text: "Unsure", kind: "learning"} : {text: "Correct", kind: ""}) : {text: answer ? "Missed" : "Blank", kind: "due"};
    const item = el("details", {class: "n2-review"},
      el("summary", {}, el("span", {class: "n2-review-n", text: SKILL_JA[q.skill] + " · " + q.label}),
        el("span", {class: "n2-review-stem", lang: "ja"}, native ? marked(q.prompt) : "Your answer " + (answer || "—") + " · correct " + q.key),
        el("span", {class: "status-chip " + chip.kind, text: chip.text})));
    if (native) {
      if (q.context) item.append(el("p", {class: "n2-passage small", lang: "ja", text: (q.skill === 3 ? "Script · " : "") + q.context}));
      item.append(el("ol", {class: "n2-review-choices"}, ...q.choices.map((c, i) => el("li", {lang: "ja", class: i + 1 === q.key ? "right" : i + 1 === answer ? "picked" : ""}, c))));
      if (q.why) item.append(el("p", {class: "n2-why", text: q.why}));
      if (q.skill === 3) item.append(el("button", {class: "link-button", type: "button", text: "Play the script", onclick: () => playScript(listeningLines(q))}));
    }
    return item;
  }
  function render() {
    show(state.phase === "ready" ? "intro" : active() ? "exam" : state.phase);
    document.body.classList.toggle("n2-native", native);
    if (tick()) return;
    if (state.phase === "ready") renderIntro();
    if (active()) renderExam();
    if (state.phase === "rest") $("rest-score").replaceChildren(scoreCard(paper, state));
    if (state.phase === "results") renderResults();
  }
  function renderIntro() {
    $("set-title").textContent = paper.title;
    const parts = [[0, written, "言語知識・読解", "Vocabulary, grammar, reading"], [written, questions.length, "聴解", "Listening"]].filter(([a, b]) => b > a);
    $("intro-plan").replaceChildren(...parts.map(([a, b, ja, en], i) => el("li", {}, el("span", {lang: "ja", class: "n2-meter-ja", text: ja}), el("span", {text: en + " · " + (b - a) + " questions"}), el("span", {class: "n2-meter-n", text: minutes(i === 0 && written ? "written" : "listening") + " min"}))));
    $("intro-copy").textContent = adaptive ? "Questions written for your weak points. Topics come from your saved evidence." : native ? "One sitting, timed like the real paper, with a break before listening. Mark a question unsure with the flag." : "The publisher's booklet opens beside the answer sheet. Its audio needs internet.";
    $("start").textContent = "Start · " + minutes(firstPhase) + " min";
    $("intro-note").textContent = "Leaving keeps your answers. The timer keeps running, as it would in the hall.";
  }

  $("start").onclick = () => start(firstPhase);
  $("listen").onclick = () => start("listening");
  $("listen").textContent = "Start listening · " + minutes("listening") + " min";
  $("guess").innerHTML = flagSvg;
  $("guess").onclick = () => { if (tick()) return; state.guesses[state.index] = !state.guesses[state.index]; persist(); renderExam(); };
  $("prev").onclick = () => move(state.index - 1);
  $("next").onclick = () => { const [, end] = range(); state.index === end - 1 ? openGrid() : move(state.index + 1); };
  $("grid-open").onclick = openGrid;
  $("grid-close").onclick = () => $("grid-dialog").close();
  $("submit").onclick = () => { if (!tick()) finish(); };
  $("speak").onclick = () => {
    if (tick()) return;
    const q = questions[state.index];
    playScript(q.mondai ? listeningLines(q) : [q.context + "。" + q.prompt + (q.options === 3 ? "。" + q.choices.map((c, i) => (i + 1) + "番。" + c).join("。") : "")]);
  };
  $("retake").onclick = async () => {
    try {
      await access("history", "put", {...state, book: year, paper: paper.id});
      archivedView = true;
      localStorage.removeItem(storageKey);
      location.assign("?book=" + year);
    } catch (e) { warn("Could not archive this attempt. " + e.message); }
  };
  document.addEventListener("keydown", e => {
    if (!active() || $("grid-dialog").open || e.metaKey || e.ctrlKey || e.altKey) return;
    const q = questions[state.index];
    if (/^[1-4]$/.test(e.key) && Number(e.key) <= q.options) choose(Number(e.key));
    else if (e.key === "ArrowRight") move(state.index + 1);
    else if (e.key === "ArrowLeft") move(state.index - 1);
    else if (e.key.toLowerCase() === "f") $("guess").click();
  });
  window.addEventListener("pagehide", () => { stopVoice(); recordTime(); persist(); });
  render();
  setInterval(tick, 1000);
}

const route = year ? exam : params.get("view") === "recall" ? recall : hub;
route().catch(error => { show(""); warn(error.message); });
