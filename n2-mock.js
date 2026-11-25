import {dateKey, parseGoalDate, firstPassEnd, goalKey, readGoal, writeGoal, shortDate, longDate} from "./jlpt-goal.js";
import {bookIds,bookName,EDITION,SETS_EDITION,form,realisticRows,realisticPaperId,setFile,instructionFor,solutionOf,whyReadings} from "./n2-forms.js";
import {access,currentAttempts,download,prefix,report,scored,n2Adapter} from "./n2-progress.js";
import {startAutoSync,markDirty,gistSettings} from "./sync.js";
import {SKILLS,SKILL_JA,SECTIONS,PASS_TOTAL,SECTION_MIN,SECTION_MAX,estimate,sprintCheckpoint,nextExamDate,daysUntil,recallQueue,recallRecord,recallId,dailyGoal,coverage,localDay,todayPlan,measuredPace,capMinutes,DAY_MINUTES,EXAM_CHECKLIST,goalDates,formatMinutes,shortenPlan,maintenancePlan,resultsMonth,doneToday,markDone,scoreSeries,scoreCaption,examHeadLine,nextKicker,checkpointLine,mockTileState,historyKind} from "./n2-study.js";
import {collapseRow,collapseChevronSvg,scoreChart,flagSvg,chevronLeftSvg,chevronRightSvg,replaySvg,planSteps,loadMeter,evidenceRow,pauseRing,openReportSheet,mountReportButtons} from "./components.js";
import {REPORT_REASONS,createReport,fileReport,reportSyncLine,reportsAdapter,reportHistory,screenOf,appVersion,deviceInfo} from "./reports.js";
import {recognitionFactory} from "./speech.js";
import {speakOnce,speakAndWait,japaneseVoices} from "./speech.js";
import {spokenWord,radioItems,examplesFromDecks,examplesFromSets,dayQueue,daySteps,chooseExample,radioEvent,DayPlayer,RECALL_PAUSES} from "./day-radio.js";
import {TAG,TAGS,HELD_OUT,CAUSES,comprehensionStats,weakestTag,tagDrill,drillExposure,attemptTags,tagsOf,sourceOf} from "./n2-comprehension.js";
import {exampleSegments,patternNeedles,delayedChecks,checkItems,checkAsk,contextNote,sentenceParts,checkDetail,audioGrade,delayedAccuracy,CHECK_SOURCE,WHY_LINE,evidenceFor,evidenceLine} from "./n2-delayed.js";

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
function row({glyph, title, line, href, onclick, chip, cls = ""}) {
  const node = el(href ? "a" : "button", {class: ("library-tool two-line " + cls).trim(), href, type: href ? undefined : "button", onclick});
  node.append(el("span", {class: "library-tool-glyph", lang: "ja", "aria-hidden": "true", text: glyph}),
    el("span", {class: "library-tool-label"}, el("strong", {text: title}), line ? el("span", {text: line}) : ""),
    ...(chip ? [el("span", {class: "status-chip " + (chip.kind || ""), text: chip.text})] : []));
  node.insertAdjacentHTML("beforeend", chevron);
  return node;
}
function warn(message) { $("warning").textContent = message; }
// N2 notices (StOffline, StNoVoice, StSaveFail): what still works first, then
// what needs something. A failed save is the one alert; a saved grade is
// announced once on #n2-saved.
const notices = new Map();
function setNotice(key, node) {
  if (node) notices.set(key, node); else notices.delete(key);
  $("n2-notices").replaceChildren(...notices.values());
}
// Offline is shown only when it lasts (a phone changing networks reports a
// moment offline), never over the page (it scrolls away), and can be closed
// (report 04301125: a false "offline" covered the reading passage).
let offlineTimer = 0, offlineDismissed = false;
async function reachable() {
  try { await fetch("./online-probe?" + Date.now(), {cache: "no-store", signal: AbortSignal.timeout?.(5000)}); return true; } catch { return false; }
}
function offlineNotice() {
  clearTimeout(offlineTimer);
  if (navigator.onLine !== false) { offlineDismissed = false; setNotice("offline", null); return; }
  offlineTimer = setTimeout(async () => {
    if (navigator.onLine !== false || offlineDismissed) return;
    // Phones report offline when they are not (report 8907ffd7): ask the
    // network itself. Any answer, even a 404, means there is a connection.
    if (await reachable()) return;
    if (navigator.onLine !== false || offlineDismissed) return;
    setNotice("offline", el("div", {class: "notice"},
      el("p", {text: "You’re offline. Everything on this page still works: the plan, papers, checks and Day Radio with this device’s voice."}),
      el("p", {class: "hint", text: "Needs a connection now: Plan my day with AI · Make a practice exam · new Echo’s notes. They come back when you’re online."}),
      el("div", {class: "notice-actions"}, el("button", {type: "button", class: "outline", "data-ui": "button", text: "Close", onclick: () => { offlineDismissed = true; setNotice("offline", null); }}))));
  }, 4000);
}
function voiceCheck() {
  if (!window.speechSynthesis) return;
  const draw = () => setNotice("voice", japaneseVoices("ja").length ? null : el("div", {class: "notice"},
    el("p", {text: "No Japanese voice on this device. Day Radio, listening checks and Echo’s own listening papers need one to speak."}),
    el("p", {class: "hint", text: "Add a Japanese voice in your phone’s settings, or choose another voice in Settings. The official sample papers still play: they are recordings."}),
    el("div", {class: "notice-actions"}, el("a", {class: "button outline", href: "./settings", text: "Open Settings → Voice"}))));
  // Voices arrive late on some engines; decide after they have had a chance.
  speechSynthesis.addEventListener?.("voiceschanged", draw);
  setTimeout(draw, 1200);
}
function announceSaved(message = "Saved") { $("n2-saved").textContent = ""; setTimeout(() => { $("n2-saved").textContent = message; }, 30); setNotice("save", null); }
function saveFailed(retry) {
  setNotice("save", el("div", {class: "notice alert", role: "alert"},
    el("p", {text: "Your last answer wasn’t saved. This browser’s storage is full or blocked. Nothing else was lost."}),
    el("div", {class: "notice-actions"},
      el("button", {type: "button", class: "primary", "data-ui": "button", text: "Try again", onclick: () => { setNotice("save", null); retry?.(); }}),
      el("a", {class: "button outline", href: "#history", onclick: async event => { event.preventDefault(); try { download(await report()); } catch (e) { warn(e.message); } }, text: "Back up now"}))));
  $("n2-notices").scrollIntoView({block: "nearest"});
}
addEventListener("online", offlineNotice); addEventListener("offline", offlineNotice);
// Bar icons come from components.js, so the page never owns a copy.
const BAR_ICONS = {prev: chevronLeftSvg, next: chevronRightSvg, replay: replaySvg, flag: flagSvg};
for (const button of document.querySelectorAll("[data-icon]")) button.insertAdjacentHTML("afterbegin", BAR_ICONS[button.dataset.icon] || "");
function show(id) { for (const s of ["hub", "recall", "check", "day", "intro", "exam", "rest", "results"]) $(s).hidden = s !== id; document.body.dataset.view = id; }

// Reports (reports.js, ReportSheet): every head has the report button. Each
// view sets `reportCard` to describe the word, check or question on screen, so
// a flag names exactly what was wrong.
let reportCard = () => null, autoSync = null;
const visibleTitle = () => [...document.querySelectorAll("main section:not([hidden]) :is(.tool-title,.drill-title)")].map(n => n.textContent.trim()).find(Boolean) || document.title;
// The mic shows it is listening (report b8daef9e) and a second tap stops it.
function bindReportDictation(mic, field, status) {
  const make = () => recognitionFactory("en-US");
  if (!make()) { mic.hidden = true; return; }
  mic.hidden = false;
  let active = null;
  const idle = () => { active = null; mic.classList.remove("is-listening"); mic.setAttribute("aria-pressed", "false"); };
  mic.onclick = () => {
    if (active) { try { active.stop(); } catch { idle(); } return; }
    const r = make(); if (!r) return;
    active = r; mic.classList.add("is-listening"); mic.setAttribute("aria-pressed", "true"); status.textContent = "Listening… tap the mic again to stop.";
    r.onresult = e => { const text = [...e.results].map(x => x[0].transcript).join(" ").trim(); if (text) { field.value = (field.value ? field.value.trimEnd() + " " : "") + text; field.dispatchEvent(new Event("input")); status.textContent = "Edit anything it mishears before you send."; } };
    r.onend = () => { idle(); if (/^Listening/.test(status.textContent)) status.textContent = ""; };
    r.onerror = () => { idle(); status.textContent = "Could not hear that. Type it instead."; };
    try { r.start(); } catch { r.onerror(); }
  };
}
async function openReport() {
  const card = reportCard?.() || null, title = visibleTitle();
  const screen = {kind: "bug", label: "This screen", title: "Report a problem", quote: title, subject: {type: "screen", id: location.pathname + location.search, text: title, extra: card ? {card: card.id} : {}}};
  const subjects = card ? [{kind: "card", label: card.label || "This card", title: card.title || "Flag this card", quote: card.quote || card.text, lang: "ja", subject: card}, screen] : [screen];
  const result = await openReportSheet({subjects, reasons: REPORT_REASONS, syncLine: reportSyncLine, syncNow: gistSettings().on && autoSync ? () => autoSync.syncNow() : null, history: reportHistory, bindDictation: bindReportDictation, onSubmit: async value => {
    await fileReport(createReport({...value, screen: screenOf(location, title), version: await appVersion(), device: deviceInfo()}));
  }});
}
async function json(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Unable to load " + path + ". Reconnect and reload.");
  return response.json();
}
async function materials() {
  if (!inventory) [inventory, original, themes] = await Promise.all([json("./n2-inventory.json"), json("./n2-echo-bank.json"), json("./n2-sets/index.json").catch(() => ({}))]);
}
// Example sentences: the N2 decks first (natural contexts), then the exam
// questions that test the same target (a second, different context).
let deckMap = null, setMap = null;
async function deckExamples() {
  await materials();
  if (!deckMap) {
    const decks = await Promise.all(["./decks/n2-words.json", "./decks/n2-grammar.json"].map(p => json(p).catch(() => null)));
    deckMap = examplesFromDecks(inventory, decks.filter(Boolean));
  }
  return deckMap;
}
async function everyExample() {
  const decks = await deckExamples();
  if (!setMap) setMap = examplesFromSets((await Promise.all(Object.keys(themes).map(id => json(setFile(id)).catch(() => null)))).filter(Boolean));
  const merged = new Map(decks);
  for (const [k, list] of setMap) merged.set(k, [...(merged.get(k) || []), ...list]);
  return merged;
}
// The line that decides each authored reading and listening answer.
let cueCache = null;
async function cueMap() {
  if (!cueCache) cueCache = await json("./n2-sets/cues.json").then(t => t.cues || {}).catch(() => ({}));
  return cueCache;
}
// Reviewed comprehension tags for authored reading and listening questions.
let tagCache = null;
async function tagMap() {
  if (!tagCache) tagCache = await json("./n2-sets/tags.json").then(t => t.tags || {}).catch(() => ({}));
  return tagCache;
}
// Active time on one item: it runs only while the page is visible.
function activeClock() {
  let total = 0, since = document.visibilityState === "visible" ? performance.now() : 0;
  const onVisibility = () => {
    if (document.visibilityState === "visible") { if (!since) since = performance.now(); }
    else if (since) { total += performance.now() - since; since = 0; }
  };
  document.addEventListener("visibilitychange", onVisibility);
  return {
    read: () => total + (since ? performance.now() - since : 0),
    stop() { const t = this.read(); document.removeEventListener("visibilitychange", onVisibility); since = 0; total = t; return t; },
  };
}
// Sets 02–20 have a realistic edition when its file is there; set 01 keeps its paper.
const realistic = id => bookIds.includes(id) && id !== bookIds[0] && !!themes[id];
const titleOf = id => realistic(id) ? String(bookIds.indexOf(id) + 1).padStart(2, "0") + " · " + themes[id] : bookName(id);
// A title for an attempt whose paper may be gone: never "undefined".
const knownTitle = id => bookIds.includes(id) ? "Mock " + titleOf(id) : String(id || "").startsWith("adaptive-") ? "Practice paper" : Object.hasOwn(keys, id || "") ? bookName(id) : "Earlier attempt";
function voice() {
  const voices = japaneseVoices("ja"), pick = settings.voice;
  if (pick === "random") return voices[Math.floor(Math.random() * voices.length)] || null;
  return voices[Number(pick)] || null;
}
function say(text) {
  if (!window.speechSynthesis) { warn("Japanese speech is unavailable in this browser. Open Echo on a device with a Japanese voice."); return false; }
  return speakOnce(text, {voice: voice(), rate: Number(settings.rate) || 1});
}
// An example sentence with furigana, the studied word or pattern underlined.
function exampleNodes(ja, needles) {
  return exampleSegments(ja, needles).map(seg => {
    const node = seg.reading ? el("ruby", {}, seg.text, el("rt", {text: seg.reading})) : document.createTextNode(seg.text);
    return seg.mark ? el("u", {class: "n2-mark"}, node) : node;
  });
}
// 【word】 in a question is the tested word: shown underlined, as on the paper.
function marked(text = "") {
  const out = document.createDocumentFragment();
  for (const [i, part] of String(text).split(/【|】/).entries()) out.append(i % 2 ? el("u", {class: "n2-mark", text: part}) : part);
  return out;
}
// The dictionary's readings, loaded only when a review needs them (the word
// list is large). Used for furigana on solutions (reports 6382b2ef, a9a209ae).
let readingResolver = null;
function furigana() {
  return readingResolver ||= Promise.all([import("./words-data.js"), import("./japanese-readings.js")])
    .then(([{WORDS}, {createReadingResolver}]) => createReadingResolver(WORDS)).catch(() => null);
}
async function solutionLine(q) {
  const sol = solutionOf(q), resolve = await furigana();
  const nodes = [];
  if (sol) {
    const ja = resolve ? resolve(sol.text, sol.overrides).text : sol.text;
    nodes.push(el("p", {class: "n2-solution", lang: "ja"}, ...exampleNodes(ja, [].concat(sol.mark))));
  }
  return nodes;
}
async function whyLine(why) {
  const resolve = await furigana();
  if (!resolve || !/[㐀-鿿々]/.test(why)) return el("p", {class: "n2-why"}, el("span", {class: "n2-why-label", text: "Why: "}), why);
  const {text, overrides} = whyReadings(why);
  return el("p", {class: "n2-why"}, el("span", {class: "n2-why-label", text: "Why: "}), ...exampleNodes(resolve(text, overrides).text, []));
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
  if (realistic(id) && (!version || version === realisticPaperId(id))) {
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
  const planGoal = readGoal(), exam = planGoal ? parseGoalDate(planGoal.exam) : nextExamDate(), days = daysUntil(exam);
  const today = dateKey(new Date());
  const dates = goalDates(planGoal);
  $("hub-exam-line").textContent = examHeadLine({saved: !!planGoal, exam, firstPass: dates.firstPass, format: shortDate});
  $("hub-days").textContent = days;
  $("hub-days-label").textContent = days === 1 ? "day to " + shortDate(exam) : days === 0 ? "Exam day. 頑張って。" : "days to " + shortDate(exam);
  $("goal-change").hidden = days < 0;
  $("goal-change").onclick = event => { event.preventDefault(); const goal = $("training-goal"); goal.open = true; goal.scrollIntoView({block: "start"}); goal.querySelector("input")?.focus({preventScroll: true}); };
  if (days === 0) $("hub-days").textContent = "今日";
  $("hub-countdown").hidden = days < 0;

  // Today: one ordered plan. The coach may replace it for the day.
  const goal = dailyGoal({inventory, recall: data.recall, examDate: exam, firstPassDate: planGoal && firstPassEnd(planGoal)});
  goal.custom = !!planGoal?.days;
  const weakAll = ["meaning", "reading", "grammar"].reduce((n, type) => n + recallQueue({type, filter: "weak", inventory, recall: data.recall, evidence, size: Infinity}).length, 0);
  const attempts = [...data.attempts].sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  const live = attempts.find(a => ["written", "listening", "rest"].includes(a.phase));
  const done = new Set(attempts.filter(a => a.phase === "results").map(a => a.book));
  const finished = attempts.filter(a => a.phase === "results" && !String(a.book || "").startsWith("adaptive-")).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const latestDone = attempts.filter(a => a.phase === "results").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
  const {firstUse} = drillExposure(data.papers, data.attempts);
  const next = bookIds.find(id => !done.has(id) && !firstUse.has(id));
  const {providerReady} = await import("./api.js");
  const aiReady = providerReady(settings);
  // The same batch Today's checks opens (examples only change the context).
  const checks = delayedChecks({inventory, recall: data.recall, evidence, events: data.events}).length;
  const pace = measuredPace(data.recall);
  const checkpoint = sprintCheckpoint(attempts, papers, bookIds);
  const comprehension = weakestTag(comprehensionStats({papers: data.papers, evidence, tagMap: await tagMap()}));
  const latestRun = checkpoint.recent[0];
  const weakest = latestRun && [...latestRun.sections].sort((a,b)=>a.rate-b.rate)[0];
  const base = days < 0 ? maintenancePlan({checks, pace}) : todayPlan({days, goal, checkpoint, comprehension, baseline: !attempts.some(a => a.phase === "results"), weak: weakAll, aiReady, checks, pace, examDate: exam, firstPassDate: planGoal?.days ? firstPassEnd(planGoal) : null,
    running: live && {book: live.book, title: papers.get(live.paper || live.book)?.title || titleOf(live.book), progress: live.answers.filter(Boolean).length + " of " + live.answers.length + " answered" + (live.phase === "rest" ? " · listening next" : "")},
    nextMock: next && {id: next, title: titleOf(next)}, lastMockAt: finished[0]?.completedAt,
    latestResults: latestDone && localDay(new Date(latestDone.completedAt)) === localDay() ? "?book=" + latestDone.book + "&attempt=" + encodeURIComponent(latestDone.id) : null});
  const context = {data, evidence, goal, weakAll, days, base, aiReady, next, latestDone, comprehension, done: doneToday({recall: data.recall, events: data.events, attempts: data.attempts, papers: data.papers})};
  goalEditor({...context, planGoal, exam, checks, pace, checkpoint});
  const coached = days < 0 ? null : readCoachPlan();
  drawToday({...context, planGoal, exam, dates, coached, attempts});
  drawForecast(base, data, goal);
  if (coached) {
    $("coach-box").hidden = false; $("coach-reset").hidden = false; $("ai-zone").open = true;
    const stale = coached.basis !== resultsBasis(data);
    $("coach-copy").textContent = (coached.diagnosis || "Today's plan from your coach.") + (stale ? " You have new results since this plan; ask the coach again for one that uses them." : "");
  }
  $("coach").onclick = () => aiReady ? coach(context) : needProvider("Plan my day with AI needs an AI service. The standard plan below is ready without one.");
  $("coach-reset").onclick = () => { try { localStorage.removeItem(COACH_KEY); } catch {} $("coach-box").hidden = true; drawToday({...context, planGoal, exam, dates, coached: null, attempts}); };
  $("generate-open").onclick = () => openGenerator({aiReady});

  $("ai-hint").hidden = aiReady;
  $("checklist-zone").hidden = days > 3;
  $("plan-checklist-link").onclick = () => { $("checklist-zone").hidden = false; };
  drawChecklist();
  $("rest-summary").textContent = todaySummary(data);
  $("breathe-open").onclick = breathe;

  // Readiness: the latest scored attempt.
  const latest = [...attempts].filter(a => a.phase === "results" && !String(a.book || "").startsWith("adaptive-") && papers.get(a.paper || a.book)).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
  $("readiness").replaceChildren(latest ? scoreCard(papers.get(latest.paper || latest.book), latest, true)
    : el("div", {class: "empty-panel"}, el("strong", {text: "No score yet"}), el("span", {text: "Finish one whole mock to see an estimated score per section — a direction, not a prediction."})));
  // Sprint checkpoint: the rule in one sentence, then how far along.
  $("checkpoint-title").textContent = checkpoint.met ? "Sprint benchmark met" : "Sprint checkpoint";
  const box = $("checkpoint");
  box.replaceChildren(el("p", {}, "Two fresh mocks on different days within seven days: 70% average, 60% in each section. ", el("strong", {text: checkpointLine(checkpoint)})));
  if (latestRun && !latestRun.meets) box.append(el("a", {href:"?book=" + latestRun.attempt.book + "&attempt=" + encodeURIComponent(latestRun.attempt.id),
    text:"Review " + weakest.name + " first · " + weakest.correct + "/" + weakest.count + " confident answers"}));
  else if (!checkpoint.met && days > 1 && next) box.append(el("a",{href:"?book="+next,text:latestRun ? "Next checkpoint · take a fresh mock on another day" : "Establish your baseline · take a fresh mock"}));
  if (comprehension) box.append(el("p", {class: "hint", text: "Comprehension to repair: " + comprehension.ja + " " + comprehension.en.toLowerCase() + " · " + comprehension.wrong + " of " + comprehension.n + " missed or guessed in the last two weeks."}));
  const cov = coverage(inventory, data.recall, evidence);
  const kinds = [["meaning", "語彙", "Word meanings"], ["reading", "読み", "Kanji readings"], ["grammar", "文法", "Grammar"]];
  const n = x => x.toLocaleString("en");
  $("coverage-title").textContent = "Coverage · " + n(kinds.reduce((t, [k]) => t + cov[k].checked, 0)) + " of " + n(kinds.reduce((t, [k]) => t + cov[k].total, 0)) + " checked once";
  $("coverage-meta").textContent = kinds.map(([k, ja]) => ja + " " + n(cov[k].checked) + " of " + n(cov[k].total)).join(" · ");
  $("coverage").replaceChildren(...kinds.map(([type, ja, en]) => {
    const c = cov[type];
    return el("a", {class: "n2-meter", href: "?view=recall&type=" + type},
      el("span", {class: "n2-meter-head"}, el("span", {lang: "ja", class: "n2-meter-ja", text: ja}), el("span", {text: en}), el("span", {class: "n2-meter-n", text: c.checked + " / " + c.total})),
      el("span", {class: "progress-track"}, el("span", {style: "width:" + (c.checked / c.total * 100) + "%"}), el("span", {class: "n2-meter-auto", style: "width:" + (c.automatic / c.total * 100) + "%"})),
      el("span", {class: "hint", text: c.automatic + " instant on two days · " + c.weak + " weak"}));
  }));

  // Exams: a Resume row for the paper in progress, then one tile per set.
  const runsOf = id => attempts.filter(a => a.book === id);
  const bestOf = id => {
    const scoredRuns = runsOf(id).filter(a => a.phase === "results" && papers.get(a.paper || a.book)).map(a => ({a, e: estimate(papers.get(a.paper || a.book), a)}));
    return scoredRuns.length ? scoredRuns.reduce((x, y) => y.e.total > x.e.total ? y : x) : null;
  };
  const answered = a => a.answers.filter(Boolean).length + " of " + a.answers.length + " answered";
  const status = id => {
    const live = runsOf(id).find(a => a.phase !== "results");
    if (live) return {line: "In progress · " + answered(live), chip: {text: "Resume", kind: "due"}};
    const best = bestOf(id);
    if (!best) return {line: null};
    return {line: "Best " + best.e.total + " / 180 estimated · " + dateLabel(best.a.completedAt), chip: best.e.pass ? {text: "Over", kind: "over"} : {text: "Below", kind: "below"}};
  };
  const liveMock = attempts.find(a => bookIds.includes(a.book) && a.phase !== "results");
  $("exam-resume").replaceChildren(...(liveMock ? [row({glyph: String(bookIds.indexOf(liveMock.book) + 1).padStart(2, "0"), title: titleOf(liveMock.book).split(" · ").slice(1).join(" · ") || titleOf(liveMock.book),
    line: "In progress · " + answered(liveMock) + (liveMock.phase === "rest" ? " · listening next" : ""), href: "?book=" + liveMock.book, chip: {text: "Resume", kind: "due"}, cls: "n2-resume"})] : []));
  $("exam-list").replaceChildren(...bookIds.map((id, i) => {
    const best = bestOf(id), state = mockTileState({live: runsOf(id).some(a => a.phase !== "results"), best: best && best.e, held: HELD_OUT.includes(id)});
    const label = titleOf(id) + " · " + ({live: "in progress", over: "best " + best?.e.total + " of 180, over the line", below: "best " + best?.e.total + " of 180, below the line", held: "held for unseen passages, not taken", new: "not taken"})[state];
    return el("a", {class: "n2-tile", href: "?book=" + id, "data-state": state, "aria-label": label, title: label, text: String(i + 1).padStart(2, "0")});
  }));
  $("workbook-list").replaceChildren(...Object.keys(keys).map(id => {
    const s = status(id);
    return row({glyph: "公", title: "Official sample · " + id, line: s.line || "Publisher booklet and audio · needs internet", href: "?book=" + id, chip: s.chip});
  }));

  // History: finished attempts and made drills, one kind glyph each, newest first.
  const series = scoreSeries(attempts, papers);
  $("score-chart").replaceChildren(...(series.length ? [el("p", {class: "overline", text: "Exam scores · estimated, against the pass line"}), scoreChart({points: series.map(p => ({...p, label: dateLabel(p.at)})), max: 180, line: PASS_TOTAL, label: "Exam scores", caption: scoreCaption(series)})] : []));
  $("score-chart").hidden = !series.length;
  const GLYPH = {exam: "試", section: "節", drill: "練"};
  const historyRows = [
    ...attempts.filter(a => a.phase === "results").map(a => {
      const p = papers.get(a.paper || a.book), kind = historyKind(a.book, p), when = dateLabel(a.completedAt || a.startedAt);
      if (!p) return {kind, at: a.completedAt || a.startedAt || "", node: row({glyph: GLYPH[kind], title: knownTitle(a.book) + " · can't be opened", line: when + " · its paper edition is missing on this device", chip: {text: "Can't open", kind: "muted"}, onclick: () => warn("This attempt's paper is missing on this device, so it can't be opened.")})};
      const e = kind === "exam" ? estimate(p, a) : null;
      const right = p.questions.filter(q => a.answers[q.index] === q.key).length;
      return {kind, at: a.completedAt || "", node: row({glyph: GLYPH[kind], title: kind === "exam" && p.title ? "Mock " + p.title : p.title || knownTitle(a.book), line: when + " · " + (e ? e.total + " of 180 estimated" : right + " of " + p.questions.length),
        href: "?book=" + a.book + "&attempt=" + encodeURIComponent(a.id), chip: e ? (e.pass ? {text: "Over", kind: "over"} : {text: "Below", kind: "below"}) : null})};
    }),
    ...data.papers.filter(p => p.id.startsWith("adaptive-") && !attempts.some(a => a.book === p.id && a.phase === "results")).map(p => {
      const kind = historyKind(p.id, p), live = attempts.some(a => a.book === p.id && a.phase !== "results");
      return {kind, at: p.createdAt || "", node: row({glyph: GLYPH[kind], title: p.title, line: p.questions.length + " questions · " + (live ? "in progress" : "not taken yet"), href: "?book=" + p.id, chip: live ? {text: "Resume", kind: "due"} : null})};
    })].sort((x, y) => String(y.at).localeCompare(String(x.at)));
  let historyKindShown = "all";
  const drawHistory = () => {
    const shown = historyRows.filter(r => historyKindShown === "all" || r.kind === historyKindShown);
    $("history-list").replaceChildren(...shown.map(r => r.node));
    $("history-empty").hidden = shown.length > 0;
    $("history-empty").textContent = historyRows.length ? "Nothing of this kind yet." : "Nothing finished yet. Mocks, timed sections and drills you finish appear here, newest first.";
    for (const tab of document.querySelectorAll(".n2-history-filter [data-kind]")) tab.setAttribute("aria-selected", String(tab.dataset.kind === historyKindShown));
  };
  for (const tab of document.querySelectorAll(".n2-history-filter [data-kind]")) tab.onclick = () => { historyKindShown = tab.dataset.kind; drawHistory(); };
  drawHistory();
  $("export-report").onclick = async () => { try { download(await report()); } catch (e) { warn(e.message); } };
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

/* ───────── Today and its states ───────── */
// Per-day choices about the plan: kept the overflow, or shortened the day.
const DAY_STATE_KEY = "echo-n2-today";
function readDayState() { try { const s = JSON.parse(localStorage.getItem(DAY_STATE_KEY) || "null"); return s?.day === localDay() ? s : {}; } catch { return {}; } }
function writeDayState(patch) { try { localStorage.setItem(DAY_STATE_KEY, JSON.stringify({...readDayState(), ...patch, day: localDay()})); } catch {} }
function statePanel(...children) { $("plan-state").replaceChildren(...children.filter(Boolean)); $("plan-state").hidden = !children.length; }
const para = (text, cls) => el("p", {class: cls, text});
function drawToday(ctx) {
  const {base, days, dates, exam, coached, planGoal} = ctx;
  if (new URLSearchParams(location.search).get("shorten")) {
    writeDayState({short: Number(new URLSearchParams(location.search).get("shorten")) || 90});
    history.replaceState(history.state, "", location.pathname);
  }
  const state = readDayState();
  statePanel();
  $("plan-moved").hidden = true;
  $("plan-links").hidden = days < 0 || days > 3;
  $("ai-zone").hidden = days < 0;
  // After the exam (J3After): the plan stops; maintenance only when chosen.
  if (days < 0) {
    const results = ctx.attempts.filter(a => a.phase === "results");
    const firstAt = [...ctx.data.recall.flatMap(r => (r.events || []).map(e => e.at)), ...ctx.attempts.map(a => a.startedAt)].filter(Boolean).sort()[0];
    $("hub-exam-line").textContent = "Exam passed · " + shortDate(exam);
    statePanel(el("strong", {class: "n2-state-title", text: "The " + exam.getDate() + " " + shortDate(exam).slice(-3) + " exam has passed"}),
      para("Your plan has stopped. Results day is in " + resultsMonth(exam) + "; nothing here changes until you choose."),
      el("h3", {class: "rule-heading", text: "Keep it going"}),
      el("div", {class: "n2-state-actions"},
        planGoal?.maintenance ? null : el("a", {class: "button primary", href: "#", text: "Start maintenance · 15 min a day", onclick: event => { event.preventDefault(); try { writeGoal({...planGoal, maintenance: true}); markDirty("n2"); } catch {} location.reload(); }}),
        el("a", {class: "button outline", href: "#training-goal", text: "Set the next exam date", onclick: () => { $("training-goal").open = true; }})),
      para("Maintenance: Today's checks and one Day Radio round, no new first checks. Sentence Review carries on as usual in the Review tab.", "hint"),
      el("h3", {class: "rule-heading", text: "Kept as it was"}),
      el("ul", {}, el("li", {text: results.length + " mock attempts, each with its paper edition"}),
        el("li", {text: "Every grade and check" + (firstAt ? " from " + shortDate(new Date(firstAt)).slice(4) + " to " + shortDate(exam).slice(4) : "")}),
        el("li", {}, "Export: ", el("a", {href: "#history", text: "History and data → N2 analysis"}))));
    if (planGoal?.maintenance) drawPlan(base, ctx, {title: "Maintenance · about 15 min a day"});
    else { $("plan-title").textContent = ""; $("plan-steps").replaceChildren(); $("plan-start-wrap").hidden = true; }
    return;
  }
  // A shortened day (J3Short).
  if (state.short && !coached) {
    const short = shortenPlan(base, state.short);
    statePanel(para("Today: " + formatMinutes(short.minutes) + ". Echo keeps what decides tomorrow and moves the rest."),
      loadMeter({fits: short.minutes, needs: Math.max(short.of, short.minutes), caption: formatMinutes(short.minutes) + " of the " + formatMinutes(short.of) + " plan"}));
    drawPlan({...base, steps: short.steps}, ctx, {title: "Kept"});
    const f = base.forecast;
    $("plan-moved").replaceChildren(el("h3", {class: "rule-heading", text: "Moved to tomorrow"}),
      para(short.moved.map(s => s.title).join(" · ") + (f?.finish ? ". First pass now about " + shortDate(f.finish) + (daysUntil(f.finish) >= days ? " — the exam day itself or later." : ".") : ".")),
      el("p", {class: "n2-plan-links"}, el("a", {href: "#training-goal", text: "Choose a later first-pass date instead", onclick: () => { $("training-goal").open = true; }}),
        el("a", {href: "#", text: "Back to the full day", onclick: event => { event.preventDefault(); writeDayState({short: 0}); drawToday(ctx); }})));
    $("plan-moved").hidden = false;
    return;
  }
  // Over budget (J1Overload): one quiet line under the Next card; "Choose"
  // opens what moves to tomorrow and the two ways out.
  const over = !coached && base.overflow && !state.kept ? base.overflow : null;
  if (over) {
    const later = base.forecast?.finish;
    const choices = el("div", {class: "n2-budget-choices", hidden: true},
      loadMeter({fits: over.fits, needs: over.needs, caption: formatMinutes(over.fits) + " of " + formatMinutes(over.needs) + " fits today"}),
      para("Your day holds 6 h, breaks included. To keep first pass by " + shortDate(dates.firstPass) + ", these move to tomorrow:"),
      el("ul", {}, el("li", {text: over.checks + " word and grammar first checks (" + formatMinutes(over.minutes) + ")"})),
      el("div", {class: "n2-state-actions"},
        el("a", {class: "button outline", href: "#", text: "Keep " + dates.firstPass.getDate() + " " + shortDate(dates.firstPass).slice(-3) + " — move " + formatMinutes(over.minutes) + " to tomorrow", onclick: event => { event.preventDefault(); writeDayState({kept: true}); drawToday(ctx); }}),
        el("a", {class: "button quiet", href: "#training-goal", text: "Choose a later first-pass date", onclick: event => { event.preventDefault(); $("training-goal").open = true; $("training-goal").scrollIntoView({block: "start"}); }})),
      para("Moving work never deletes it." + (later ? " If tomorrow also overflows, the first pass would finish on " + shortDate(later) + " instead." : ""), "hint"));
    const choose = el("button", {type: "button", class: "link-button", "aria-expanded": "false", text: "Choose", onclick: () => { choices.hidden = !choices.hidden; choose.setAttribute("aria-expanded", String(!choices.hidden)); }});
    statePanel(el("p", {class: "n2-budget"}, el("span", {class: "n2-budget-mark", "aria-hidden": "true"}),
      el("span", {}, "Today needs " + formatMinutes(over.needs) + " of your 6 h. " + formatMinutes(over.minutes) + " of first checks moves to tomorrow. ", choose)), choices);
    drawPlan(base, ctx, {title: "What stays today"});
    return;
  }
  drawPlan(coached?.plan ? {...coached.plan, coach: true} : base, ctx);
}

/* ───────── Goal editor (J1Goal, J3Adjust) ───────── */
// The one editor for the exam date and the first-pass days, reached from the
// hub, Review's "Change" and "Adjust the goal". Each field says its calendar
// date; a change shows the plan before and after. Saving keeps every attempt.
function goalEditor(ctx) {
  const {planGoal, exam, data, aiReady} = ctx;
  const today = dateKey(new Date());
  $("training-exam").value = dateKey(exam);
  $("training-exam").min = today;
  $("training-days").value = planGoal?.days ?? "";
  if (location.hash === "#training-goal") { $("training-goal").open = true; $("training-goal").scrollIntoView(); }
  $("training-priority").checked = planGoal?.priority ?? true;
  $("training-no-ai").hidden = aiReady;
  const read = () => {
    const end = parseGoalDate($("training-exam").value), duration = $("training-days").value ? $("training-days").valueAsNumber : null;
    const started = planGoal?.exam === $("training-exam").value && planGoal?.days === duration ? planGoal.started : today;
    return {end, duration, started};
  };
  const planFor = goal => {
    const {exam: e, firstPass, custom} = goalDates(goal);
    const g = dailyGoal({inventory, recall: data.recall, examDate: e, firstPassDate: custom ? firstPass : null});
    g.custom = custom;
    const plan = todayPlan({days: daysUntil(e), goal: g, checkpoint: ctx.checkpoint, weak: ctx.weakAll, aiReady, checks: ctx.checks, pace: ctx.pace, examDate: e, firstPassDate: custom ? firstPass : null});
    return {firstPass, perDay: g.goal, minutes: plan.minutes || 0, forecast: plan.forecast};
  };
  // The cap keeps every day at six hours, so the change shows in the daily
  // first checks and, when they no longer fit, in the forecast finish.
  const describe = p => "first pass " + shortDate(p.firstPass) + " · " + p.perDay + " first checks a day" + (p.forecast && !p.forecast.onTime && p.forecast.finish ? " · at your pace about " + shortDate(p.forecast.finish) : "");
  const before = planFor(planGoal);
  const refresh = () => {
    const {end, duration, started} = read();
    if (!end) { $("training-exam-date").textContent = "Choose a date"; return; }
    $("training-exam-date").textContent = longDate(end) + " · " + daysUntil(end) + (daysUntil(end) === 1 ? " day" : " days") + " from today";
    const draft = {level: "N2", exam: dateKey(end), days: duration, started, priority: $("training-priority").checked};
    const after = planFor(draft);
    $("training-window").textContent = duration ? "First pass done by " + longDate(after.firstPass) + ". Leave empty and Echo spreads it to the last week."
      : "Empty: Echo spreads the " + ctx.goal.unchecked.toLocaleString() + " unchecked items to " + shortDate(after.firstPass) + " at up to 6 h a day.";
    const changed = draft.exam !== (planGoal?.exam ?? dateKey(exam)) || (draft.days ?? null) !== (planGoal?.days ?? null);
    $("training-preview").hidden = !changed;
    $("training-before").textContent = describe(before);
    $("training-after").textContent = describe(after);
  };
  $("training-exam").oninput = $("training-days").oninput = refresh;
  refresh();
  function updateGoal(value) {
    try {
      writeGoal(value); markDirty("n2");
      localStorage.removeItem(COACH_KEY);
      location.reload();
    } catch { $("training-status").textContent = "Could not save this goal on this device."; }
  }
  $("training-form").onsubmit = event => {
    event.preventDefault();
    const {end, duration, started} = read();
    if (!end) { $("training-status").textContent = "Choose an exam date."; return; }
    const last = parseGoalDate(started);
    last.setDate(last.getDate() + (duration || 1) - 1);
    if (duration && last >= end) { $("training-status").textContent = "Choose a duration that finishes before exam day."; return; }
    updateGoal({level: "N2", exam: dateKey(end), days: duration, started, priority: $("training-priority").checked});
  };
  $("training-reset").onclick = () => updateGoal(null);
}

// StNoProvider: a provider action says what it needs at the moment of choice.
function needProvider(what) {
  $("provider-what").textContent = what;
  $("provider-close").onclick = () => $("provider-dialog").close();
  $("provider-dialog").showModal();
}

/* ───────── Coach ───────── */
const COACH_KEY = "echo-n2-coach";
const STEP_KINDS = ["check", "recall", "section", "drill", "radio", "mock", "generate", "review", "rest", "checklist"];
function readCoachPlan() {
  try { const saved = JSON.parse(localStorage.getItem(COACH_KEY) || "null"); return saved?.day === localDay() ? saved : null; } catch { return null; }
}
// Finished sittings when the coach planned: a new result makes the plan stale.
const resultsBasis = data => data.attempts.filter(a => a.phase === "results").length;
// What the plan cannot show as steps: when first checks finish at this pace,
// and how often yesterday's misses come back right the next day.
function drawForecast(plan, data, goal) {
  const f = plan.forecast, d = delayedAccuracy({recall: data.recall, events: data.events});
  const date = x => x.toLocaleDateString(undefined, {month: "short", day: "numeric"});
  const pace = (plan.measured ? "your pace, about " : "an assumed ") + plan.pace + " seconds a check";
  $("plan-forecast").textContent = !f ? "" : f.done ? "Every N2 word and grammar point has had its first check."
    : f.onTime ? "First checks: " + goal.unchecked.toLocaleString() + " left. At " + pace + ", they finish by " + date(f.finish) + ", before exam week (" + date(f.lastDay) + " is the last day for new items)."
    : "First checks: " + goal.unchecked.toLocaleString() + " left. At " + pace + ", about " + f.perDay + " fit a day, so they would finish " + date(f.finish) + " and " + f.spill + " would miss the " + date(f.lastDay) + " cut-off. Delayed checks and timed sections still come first.";
  $("plan-delayed").textContent = d.n ? "Next-day recall, last 7 days: " + Math.round(d.rate * 100) + "% of " + d.n + " delayed checks right." : "Next-day recall: nothing measured yet. Today's misses come back tomorrow in Today's checks.";
}
// Every step does something here: a recall queue, a mock, the generator,
// the latest review, the wind-down or the checklist.
function stepHref(step, ctx) {
  if (step.href) return step.href;
  if (step.kind === "recall") return "?view=recall&type=" + (["meaning", "reading", "grammar"].includes(step.type) ? step.type : "meaning") + "&queue=" + (["daily", "weak", "new"].includes(step.queue) ? step.queue : "daily");
  if (step.kind === "check" || (step.kind === "radio" && step.mode === "check")) return "?view=check";
  if (step.kind === "radio") return "?view=radio&mode=" + (step.mode === "recall" ? "recall" : "listen");
  if (step.kind === "mock") return ctx.next ? "?book=" + ctx.next : "#exams";
  if (step.kind === "review") return ctx.latestDone ? "?book=" + ctx.latestDone.book + "&attempt=" + encodeURIComponent(ctx.latestDone.id) : "#history";
  return null;
}
// What a step does when opened: a route, or an action on this page.
function stepAction(step, ctx) {
  const href = stepHref(step, ctx);
  const onOpen = step.kind === "generate" ? () => openGenerator({aiReady: ctx.aiReady, focus: step.focus, count: step.count})
    : step.kind === "section" ? () => startSection(step.section, ctx)
    : step.kind === "drill" ? () => startTagDrill(step.tag, ctx)
    : step.kind === "sample" ? () => startSample(ctx)
    : step.kind === "rest" ? () => { $("rest-zone").hidden = false; $("rest-zone").scrollIntoView({behavior: "smooth"}); }
    : step.kind === "checklist" ? () => { $("checklist-zone").hidden = false; $("checklist-zone").scrollIntoView({behavior: "smooth"}); } : undefined;
  return {href: href || undefined, onOpen: step.disabled ? undefined : onOpen};
}
// Today (J1Today): the steps as PlanSteps, the next one marked, and one Start
// button for it. `primary` is false while a state panel holds the filled button.
// First checks under way show a bar (the coach's step too, which has none).
function progressOf(step, ctx) {
  if (step.progress) return step.progress;
  const g = ctx.goal;
  return step.kind === "recall" && /queue=new/.test(step.href || "") && g?.firstToday && g.firstToday < g.goal ? {done: g.firstToday, of: g.goal} : null;
}
function drawPlan(plan, ctx, {title, primary = true} = {}) {
  plan = markDone(plan, ctx.done);
  const left = plan.steps.filter(s => !s.done).reduce((n, s) => n + (s.minutes || 0), 0);
  $("plan-title").textContent = (title || (plan.coach ? "Your coach's plan" : "Today's plan")) + " · " + plan.steps.length + (plan.steps.length === 1 ? " step" : " steps");
  $("plan-meta").textContent = (left ? formatMinutes(left) + " left" : "Done for today") + " · " + (plan.coach ? "from your coach" : "standard plan");
  const phaseNote = plan.phase && plan.phase !== "build" ? plan.headline || "" : "";
  $("plan-headline").textContent = phaseNote; $("plan-headline").hidden = !phaseNote;
  const actions = plan.steps.map(step => stepAction(step, ctx));
  const next = plan.steps.findIndex((step, i) => !step.done && !step.disabled && step.kind !== "rest" && step.kind !== "checklist" && (actions[i].href || actions[i].onOpen));
  $("plan-steps").replaceChildren(planSteps(plan.steps.map((step, i) => ({
    title: step.title, line: step.line, minutes: step.minutes, disabled: step.disabled, progress: progressOf(step, ctx),
    state: step.done ? "done" : i === next ? "next" : "", ...actions[i]}))));
  // The Next card: the one filled Start on the screen, above the open plan.
  const start = $("plan-start"), step = plan.steps[next];
  $("plan-start-wrap").hidden = !step;
  if (step) {
    $("plan-next-kicker").textContent = nextKicker(next, plan.steps.length, step.minutes);
    $("plan-next-title").textContent = step.title;
    $("plan-next-line").textContent = step.line || ""; $("plan-next-line").hidden = !step.line;
    start.textContent = "Start" + (step.minutes ? " · " + formatMinutes(step.minutes) : "");
    start.className = "button " + (primary ? "primary" : "outline");
    start.href = actions[next].href || "#";
    start.onclick = actions[next].href ? null : event => { event.preventDefault(); actions[next].onOpen?.(); };
  }
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
    const input = {today: localDay(), daysUntilExam: ctx.days, trainingGoal: readGoal(), minutesAvailableIncludingBreaks: DAY_MINUTES, coverage: cov, dailyGoal: ctx.goal, weakItemCount: ctx.weakAll, attempts, misses, weakChecks: weak,
      delayedChecksToday: ctx.base.steps.find(s => s.kind === "check") ? Number.parseInt(ctx.base.steps.find(s => s.kind === "check").line, 10) : 0,
      secondsPerCheck: ctx.base.pace, comprehensionByTag: comprehensionStats({papers: data.papers, evidence, tagMap: await tagMap()}).filter(t => t.n).map(t => ({tag: t.id, answered: t.n, missedOrGuessed: t.wrong})), nextDayRecall: delayedAccuracy({recall: data.recall, events: data.events}),
      standardPlan: ctx.base.steps.map(s => ({kind: s.kind, title: s.title, minutes: s.minutes || 0}))};
    const system = `You are a calm, precise JLPT N2 coach inside the Echo app. Use only the supplied observations; Echo's mock scores are uncalibrated estimates. Plan today's study in the order the learner should do it, and say what to study next and why. The whole plan, breaks included, must fit 360 minutes; give every step realistic minutes and include breaks as a rest step. Each step must be one of these app actions: check (today's delayed checks of yesterday's misses — put it first when delayedChecksToday > 0), recall (type: meaning|reading|grammar, queue: daily|weak|new), section (section: reading|listening — a timed section from a set not yet sat; keep some reading and listening every day), drill (tag: one of ${TAGS.map(t => t.id).join("|")} — unseen authored passages that hinge on that comprehension distinction; use comprehensionByTag), radio (Day Radio by ear, mode: listen|recall), mock (the next full mock, 155 minutes), generate (a practice exam: focus weak|Vocabulary|Grammar|Reading|Listening|mixed, count 10|20|35), review (the latest results), rest, checklist. Use secondsPerCheck to size recall steps. In the last three days avoid new material unless trainingGoal sets a first-pass end later than that. Write English, kind and direct, no filler. Return JSON {"headline":string,"diagnosis":string (2-4 sentences: strongest, weakest, the one thing that will raise the score most),"steps":[{"kind":string,"title":string,"line":string (what and why, one sentence),"minutes":number,"type"?:string,"queue"?:string,"focus"?:string,"count"?:number}]} with 4-7 steps.`;
    const reply = await askModel(JSON.stringify(input), system, settings);
    const glyphs = {check: "昨", recall: "憶", section: "読", drill: "解", radio: "耳", mock: "試", generate: "狙", review: "直", rest: "休", checklist: "券"};
    const steps = capMinutes((Array.isArray(reply?.steps) ? reply.steps : []).filter(s => STEP_KINDS.includes(s?.kind) && typeof s.title === "string").slice(0, 9).map(s => ({
      kind: s.kind, glyph: glyphs[s.kind], title: s.title.slice(0, 80), line: String(s.line || "").slice(0, 200), minutes: Math.min(240, Math.max(0, Number(s.minutes) || 0)),
      type: s.type, queue: s.queue, focus: s.focus, mode: s.mode, section: s.section === "listening" ? "listening" : "reading", tag: TAG[s.tag] ? s.tag : (ctx.comprehension?.id || "detail"), count: [10, 20, 35].includes(s.count) ? s.count : 20})).map(s => s.kind === "section" && s.section === "listening" ? {...s, glyph: "聴"} : s));
    if (!steps.length) throw new Error("The coach's answer had no usable steps.");
    const total = steps.reduce((n, s) => n + s.minutes, 0);
    const plan = {headline: String(reply.headline || "Today's plan").slice(0, 120) + " · about " + Math.round(total / 30) / 2 + " hours, breaks included", steps};
    try { localStorage.setItem(COACH_KEY, JSON.stringify({day: localDay(), plan, diagnosis: reply.diagnosis || "", basis: resultsBasis(data)})); } catch {}
    $("coach-copy").textContent = reply.diagnosis || "Here is today's plan.";
    $("coach-reset").hidden = false;
    drawPlan({...plan, coach: true}, ctx);
  } catch (e) { $("coach-copy").textContent = "The coach is unavailable. " + e.message + " The standard plan still works."; }
  finally { button.disabled = false; }
}
let generating = null;
function openGenerator({aiReady, focus = "weak", count = 20, tag = null} = {}) {
  if (!aiReady) { needProvider("Make a practice exam needs an AI service. The standard plan, the papers and the checks are ready without one."); return; }
  import("./n2-adaptive.js").then(({FOCUS, generateAdaptive}) => {
    let pick = Object.hasOwn(FOCUS, focus) ? focus : "weak", size = [10, 20, 35].includes(count) ? count : 20, hinge = TAG[tag] ? tag : "";
    const chips = () => {
      $("generate-focus").replaceChildren(...Object.entries(FOCUS).map(([k, label]) => el("button", {type: "button", "data-ui": "button", "aria-pressed": String(k === pick), onclick: () => { pick = k; chips(); }, text: label})));
      $("generate-tag").replaceChildren(...[["", "None"], ...TAGS.map(t => [t.id, t.ja + " " + t.en])].map(([k, label]) => el("button", {type: "button", "data-ui": "button", "aria-pressed": String(k === hinge), onclick: () => { hinge = k; chips(); }, text: label})));
      $("generate-count").replaceChildren(...[10, 20, 35].map(n => el("button", {type: "button", "data-ui": "button", "aria-pressed": String(n === size), onclick: () => { size = n; chips(); }, text: n + " questions · ~" + Math.round(n * 1.6) + " min"})));
    };
    chips();
    if (!generating) { $("generate-status").textContent = ""; $("generate-go").disabled = false; }
    $("generate-close").onclick = () => $("generate-dialog").close();
    $("generate-go").onclick = async () => {
      $("generate-go").disabled = true;
      const run = generating = Symbol("run");
      try {
        const paper = await generateAdaptive(t => { if (run === generating) $("generate-status").textContent = t; }, {focus: pick, count: size, tag: hinge || null});
        const short = paper.questions.length < size;
        if (run !== generating) return;
        // A provider that stops early still leaves a usable paper: say how many.
        if (short) $("generate-status").replaceChildren(paper.questions.length + " of " + size + " questions arrived; the provider stopped early. ", el("a", {href: "?book=" + paper.id, text: "Open the " + paper.questions.length}));
        else if ($("generate-dialog").open) location.assign("?book=" + paper.id);
        else $("generate-status").textContent = "Ready: " + paper.title + " is in Coach and history.";
      }
      catch (e) { if (run === generating) $("generate-status").textContent = e.message; }
      finally { if (run === generating) { generating = null; $("generate-go").disabled = false; } }
    };
    $("generate-dialog").onclose = () => { if (generating) { generating = null; $("generate-go").disabled = false; } };
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
// Day Radio's intro is open on the first visit only, then a closed row.
function howTo() {
  const box = $("day-howto");
  if (box.dataset.ready) return; box.dataset.ready = "1";
  let seen = false; try { seen = !!localStorage.getItem("echo-n2-day-howto"); localStorage.setItem("echo-n2-day-howto", "1"); } catch {}
  box.open = !seen;
}
const CONTEXT_SHORT = {fresh: "a sentence you haven't seen", same: "the sentence you saw yesterday", heard: "the word itself, by ear", word: "the word alone"};
$("check-help").onclick = () => { const open = $("check-note").hidden; $("check-note").hidden = !open; $("check-help").setAttribute("aria-expanded", String(open)); };
const ASK = {meaning: "Say the meaning, then check.", reading: "Read it aloud, then check.", grammar: "Say what it means and use it in a sentence."};
const TYPE_LABEL = {meaning: "意味 Meaning", reading: "読み Reading", grammar: "文法 Grammar"};
const QUEUE_LABEL = {daily: "Daily", weak: "Weak", new: "Unchecked"};
// The card's overline: why it is here, and which meaning when a pattern has two.
const recallStateLine = (current, type) => [current.weak ? "Weak" : !current.r ? "First check" : current.r.checks + " checks · last " + current.r.last,
  current.item.senses ? (type === "grammar" ? "meaning " : "sense ") + current.item.sense + " of " + current.item.senses : null].filter(Boolean).join(" · ");
async function recall() {
  show("recall");
  await materials();
  let data = await report(), evidence = scored(data);
  let queue = ["daily", "weak", "new"].includes(params.get("queue")) ? params.get("queue") : "daily";
  // From the plan (no type): new checks go to whichever of words and grammar
  // is further behind; weak items to the deck with the most of them.
  const autoType = () => {
    if (queue === "weak") {
      const [best, n] = ["meaning", "reading", "grammar"].map(t => [t, recallQueue({type: t, filter: "weak", inventory, recall: data.recall, evidence, size: Infinity}).length]).sort((a, b) => b[1] - a[1])[0];
      return n ? best : "meaning";
    }
    const left = t => 1 - data.recall.filter(r => r.dimension === t).length / (t === "grammar" ? inventory.grammar.length : inventory.words.length);
    return left("grammar") > left("meaning") ? "grammar" : "meaning";
  };
  let type = ["meaning", "reading", "grammar"].includes(params.get("type")) ? params.get("type") : params.get("queue") ? autoType() : (localStorage.getItem("echo-n2-recall-type") || "meaning");
  const examples = await deckExamples();
  const exampleOf = item => (examples.get(JSON.stringify(item.target)) || [])[0] || null;
  const needlesOf = item => item.target[0] === "word" ? [item.prompt, item.reading] : patternNeedles(item.prompt);
  let session = [], index = 0, revealed = false, tally = {instant: 0, slow: 0, missed: 0}, missed = [], clock = null, graded = [];
  const sync = () => {
    const url = new URL(location.href); url.searchParams.set("view", "recall"); url.searchParams.set("type", type); url.searchParams.set("queue", queue);
    history.replaceState(history.state, "", url);
    try { localStorage.setItem("echo-n2-recall-type", type); } catch {}
    document.querySelectorAll("#recall [role=tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.type === type));
    document.querySelectorAll("#recall [data-queue]").forEach(b => b.setAttribute("aria-pressed", b.dataset.queue === queue));
  };
  const begin = () => {
    session = recallQueue({type, filter: queue, inventory, recall: data.recall, evidence});
    index = 0; tally = {instant: 0, slow: 0, missed: 0}; missed = []; graded = [];
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
    revealed = false; playAnswer.token = null;
    try { window.speechSynthesis?.cancel(); } catch {}
    $("recall-prev").hidden = !graded.length || !session.length;
    $("recall-answer").hidden = true; $("reveal").hidden = false; grades.forEach(b => b.hidden = true);
    $("recall-example").hidden = true; $("recall-example-en").hidden = true;
    if (!session.length) {
      $("recall-ask").textContent = "";
      $("recall-prompt").textContent = queue === "weak" ? "Nothing weak here." : "All caught up.";
      $("recall-state").textContent = queue === "weak" ? "Misses, guesses and slow answers from checks and mocks appear here." : "Every item in this deck was checked today. Try another deck.";
      $("recall-say").hidden = true; $("recall-actions").hidden = true;
      return;
    }
    if (!current) { finishRound(); return; }
    clock?.stop(); clock = activeClock();
    $("recall-ask").textContent = recallStateLine(current, type);
    $("recall-sub").textContent = TYPE_LABEL[type] + " · " + QUEUE_LABEL[queue];
    $("recall-prompt").textContent = current.item.prompt;
    $("recall-prompt").classList.toggle("long", current.item.prompt.length > 8);
    $("recall-say").hidden = type === "reading";
    $("recall-state").textContent = ASK[type] + (current.item.senses ? " The sentence shows which meaning." : "");
    // The sentence: grammar shows it from the start (a pattern is recalled in
    // use); a word shows it with the answer. The English comes with the answer.
    const example = exampleOf(current.item);
    $("recall-example-ja").replaceChildren(...(example ? exampleNodes(example.ja, needlesOf(current.item)) : []));
    $("recall-example-en").textContent = example?.en || "";
    $("recall-example").hidden = !example || type !== "grammar";
  }
  // Revealing plays the answer: the word, then its sentence (a pattern: the
  // sentence). Tapping the card again plays it again.
  async function playAnswer() {
    const current = session[index]; if (!current) return;
    const example = exampleOf(current.item), opts = {voice: voice(), rate: Number(settings.rate) || 1};
    if (!window.speechSynthesis) { say(""); return; }
    const token = playAnswer.token = {};
    try { speechSynthesis.cancel(); } catch {}
    if (type !== "grammar") {
      await speakAndWait(type === "reading" ? current.item.reading : spokenWord(current.item.prompt, current.item.reading), opts);
      if (playAnswer.token !== token || !revealed || session[index] !== current) return;
    }
    if (example && type !== "reading" && playAnswer.token === token) await speakAndWait(example.ja, opts);
  }
  function reveal() {
    const current = session[index]; if (!current || revealed) return;
    revealed = true;
    $("recall-reading").textContent = current.item.reading && current.item.reading !== current.item.prompt ? current.item.reading : "";
    $("recall-meaning").textContent = current.item.answer;
    $("recall-answer").hidden = false; $("reveal").hidden = true; grades.forEach(b => b.hidden = false);
    $("recall-example").hidden = !$("recall-example-ja").textContent;
    $("recall-example-en").hidden = !$("recall-example-en").textContent;
    playAnswer();
  }
  // Previous card: back to the last graded card, unrevealed. Grading it again
  // rebuilds its record from what it was before, so the mistake is replaced.
  function previous() {
    const last = graded.pop(); if (!last) return;
    tally[last.grade]--; missed = missed.filter(m => m !== last.row);
    data.recall = data.recall.filter(x => x.id !== last.row.id).concat(last.row.r ? [last.row.r] : []);
    index = last.index; draw();
  }
  async function grade(value) {
    const current = session[index]; if (!current || !revealed) return;
    revealed = false;
    const record = recallRecord(current.r, current, value, new Date(), {activeMs: Math.round(clock?.read() || 0)});
    try {
      await access("recall", "put", record);
      data.recall = data.recall.filter(x => x.id !== record.id).concat(record);
      tally[value]++; if (value !== "instant") missed.push(current);
      graded.push({index, row: current, grade: value});
      announceSaved("Saved: " + value);
      index++; draw();
    } catch (error) { revealed = true; saveFailed(() => grade(value)); }
  }
  function finishRound() {
    $("recall-done-title").textContent = session.length + " checked";
    $("recall-done-line").textContent = tally.instant + " instant · " + tally.slow + " slow · " + tally.missed + " missed";
    $("recall-missed").replaceChildren(...missed.map(m => el("li", {},
      el("span", {class: "drill-missed-text"}, el("span", {lang: "ja", text: m.item.prompt + (m.item.reading && m.item.reading !== m.item.prompt ? "（" + m.item.reading + "）" : "")}), el("span", {class: "hint", text: m.item.answer})))));
    $("recall-bar").style.width = "100%";
  }
  $("reveal").onclick = reveal;
  $("recall-card").onclick = e => { if (e.target.closest("button")) return; if (revealed) playAnswer(); else reveal(); };
  $("recall-prev").onclick = previous;
  $("recall-example-say").onclick = () => { const c = session[index], ex = c && exampleOf(c.item); if (ex) say(ex.ja); };
  grades.forEach(b => b.onclick = () => grade(b.dataset.grade));
  reportCard = () => { const c = session[index]; return c && !$("recall").hidden ? {type: "n2-" + c.item.target[0], id: JSON.stringify(c.item.target), text: c.item.prompt, reading: c.item.reading, meaning: c.item.answer, quote: c.item.prompt, extra: {view: "recall", type}} : null; };
  $("recall-say").onclick = () => { const c = session[index]; if (c) say(spokenWord(c.item.prompt, c.item.reading)); };
  $("recall-again").onclick = async () => { data = await report(); evidence = scored(data); begin(); };
  document.querySelectorAll("#recall [role=tab]").forEach(b => b.onclick = () => { type = b.dataset.type; begin(); });
  document.querySelectorAll("#recall [data-queue]").forEach(b => b.onclick = () => { queue = b.dataset.queue; begin(); });
  document.addEventListener("keydown", e => {
    if (e.target.closest("input,textarea,select") || e.metaKey || e.ctrlKey) return;
    if ((e.key === " " || e.key === "Enter") && !revealed) { if (e.target.closest("button,a,summary") || !session[index]) return; e.preventDefault(); reveal(); }
    else if (revealed && ["1", "2", "3"].includes(e.key)) grade(["missed", "slow", "instant"][Number(e.key) - 1]);
  });
  begin();
}

/* ───────── Timed sections ───────── */
// A reading or listening section from a set the learner has not sat, as its
// own timed paper (so it scores, saves and reviews like any other). Sets are
// taken from the end, while full mocks go from the start.
const SECTION = {reading: {skill: 2, ja: "読解", en: "Reading", minutes: 50}, listening: {skill: 3, ja: "聴解", en: "Listening", minutes: 50}};
async function startSection(section, ctx) {
  const spec = SECTION[section]; if (!spec) return;
  await materials();
  const {data} = ctx;
  const sat = new Set(data.attempts.map(a => a.book));
  const used = new Set();
  for (const p of data.papers.filter(p => p.drill)) {
    if (p.drill.section === section) used.add(p.drill.set);
    for (const q of p.questions) if (q.skill === spec.skill && q.source) used.add(q.source.split("#")[0]);
  }
  const sets = bookIds.filter(realistic).filter(x => !HELD_OUT.includes(x)).reverse();
  const id = sets.find(x => !used.has(x) && !sat.has(x));
  if (!id) { warn("No set is available for a timed " + spec.en.toLowerCase() + " section on this device."); return; }
  try {
    const set = await json(setFile(id));
    const questions = realisticRows(set).filter(q => q.skill === spec.skill).map((q, index) => ({...q, source: id + "#" + q.index, index}));
    const paperId = "adaptive-" + crypto.randomUUID(), createdAt = new Date().toISOString();
    await access("papers", "put", {id: paperId, book: paperId, shownTracked: true, title: spec.ja + " · Set " + titleOf(id), edition: SETS_EDITION, createdAt,
      drill: {set: id, section}, minutes: spec.minutes, questions});
    location.assign("?book=" + paperId);
  } catch (e) { warn("Could not prepare the section: " + e.message); }
}

/* ───────── Short sample (J1Today, J1Done) ───────── */
// Six questions from each skill, spread across the 問題 types, from a set the
// learner has not sat (never a held-out one): a 20-minute baseline.
async function startSample(ctx) {
  await materials();
  const sat = new Set(ctx.data.attempts.map(a => a.book));
  const {firstUse} = drillExposure(ctx.data.papers, ctx.data.attempts);
  const id = bookIds.filter(realistic).filter(x => !HELD_OUT.includes(x) && !sat.has(x) && !firstUse.has(x)).at(-1);
  if (!id) { warn("No unsat set is left for a short sample."); return; }
  try {
    const rows = realisticRows(await json(setFile(id)));
    const spread = (skill, n = 6) => { const list = rows.filter(q => q.skill === skill); return Array.from({length: Math.min(n, list.length)}, (_, i) => list[Math.floor(i * list.length / n)]); };
    const questions = [0, 1, 2, 3].flatMap(skill => spread(skill)).map((q, index) => ({...q, source: id + "#" + q.index, index}));
    const paperId = "adaptive-" + crypto.randomUUID();
    await access("papers", "put", {id: paperId, book: paperId, shownTracked: true, title: "Short sample · four skills", edition: SETS_EDITION, createdAt: new Date().toISOString(),
      drill: {sample: id}, minutes: {written: 14, listening: 6}, questions});
    location.assign("?book=" + paperId);
  } catch (e) { warn("Could not prepare the sample: " + e.message); }
}

/* ───────── Comprehension drills ───────── */
// Unseen authored questions that hinge on one distinction (an exception, a
// change of plan…), each with its whole passage or script. Held-out forms and
// sets already sat are left alone; without a pool, the AI writes new ones.
async function startTagDrill(tag, ctx) {
  const info = TAG[tag]; if (!info) return;
  await materials();
  const {data} = ctx;
  try {
    const [map, sets] = await Promise.all([tagMap(), Promise.all(Object.keys(themes).map(id => json(setFile(id)).then(set => ({...set, id})).catch(() => null)))]);
    const seen = drillExposure(data.papers, data.attempts).sources;
    const picks = tagDrill({tag, sets: sets.filter(Boolean), tagMap: map, exclude: new Set(data.attempts.map(a => a.book)), seen});
    if (!picks.length) {
      if (ctx.aiReady) { openGenerator({aiReady: true, focus: "mixed", count: 10, tag}); return; }
      warn("No unseen passages left for " + info.en.toLowerCase() + ". Add an AI provider to write new ones.");
      return;
    }
    const rows = realisticRows({questions: picks.map(p => p.q)}).map((q, index) => ({...q, index, source: picks[index].source}));
    const written = rows.filter(q => q.skill !== 3).length, listening = rows.length - written;
    const paperId = "adaptive-" + crypto.randomUUID();
    await access("papers", "put", {id: paperId, book: paperId, shownTracked: true, title: info.ja + " · " + info.en, edition: SETS_EDITION, createdAt: new Date().toISOString(),
      drill: {tag}, minutes: {written: Math.max(5, Math.ceil(written * 2.5)), listening: Math.max(5, listening * 2)}, questions: rows});
    location.assign("?book=" + paperId);
  } catch (e) { warn("Could not prepare the drill: " + e.message); }
}

/* ───────── Evidence sheet (J2Evidence) ───────── */
async function openEvidence(item, why = "") {
  const data = await report(), evidence = scored(data);
  const titles = new Map(data.papers.map(p => [p.id, p.title]));
  const ev = evidenceFor(item.target, {recall: data.recall, events: data.events, evidence, paperTitle: id => titles.get(id) || ""});
  $("evidence-word").textContent = item.prompt || item.text || item.target[1];
  $("evidence-reading").textContent = item.reading && item.reading !== item.prompt ? item.reading : "";
  $("evidence-meaning").textContent = item.answer || item.meaning || "";
  const fill = (id, rows, empty) => $(id).replaceChildren(...(rows.length ? rows.map(evidenceRow) : [el("li", {class: "hint", text: empty})]));
  fill("evidence-written", ev.written, "Nothing written yet.");
  fill("evidence-listening", ev.listening, "Nothing heard or checked by ear yet.");
  $("evidence-why").textContent = why;
  $("evidence-close").onclick = () => $("evidence-dialog").close();
  $("evidence-dialog").showModal();
}

/* ───────── Today's checks ───────── */
// Yesterday's misses and uncertain answers, one session, print and audio. A
// print check writes its recall record; an audio check a listening event.
const DIMENSION = {meaning: "meaning", reading: "reading", grammar: "grammar"};
async function checks() {
  show("check");
  if (params.get("view") !== "check") history.replaceState(history.state, "", "?view=check");
  await materials();
  const data = await report(), evidence = scored(data);
  const items = checkItems(inventory);
  const session = delayedChecks({inventory, recall: data.recall, evidence, events: data.events, examples: await everyExample(), items});
  let index = 0, revealed = false, clock = null, responseMs = 0, plays = 0;
  const tally = {instant: 0, slow: 0, missed: 0}, missed = [];
  const grades = [...document.querySelectorAll("#check-actions [data-check-grade]")];
  const audio = c => c.modality === "audio";
  let heardPrompt = false, playback = 0, skipped = 0;
  const speakCurrent = async () => {
    const c = session[index]; if (!c) return;
    if (revealed) { say(c.example?.ja || spokenWord(c.text, c.reading)); return; }
    const run = ++playback;
    window.speechSynthesis?.cancel();
    const ended = await speakAndWait(c.example?.ja || spokenWord(c.text, c.reading), {voice:voice(), rate:Number(settings.rate) || 1});
    if (run !== playback || session[index] !== c || revealed) return;
    if (ended) {
      plays++; heardPrompt = true; $("check-reveal").disabled = false;
      $("check-say-label").textContent = "Hear it again";
    } else $("check-note").textContent = "Audio did not finish. Play again or skip this check.";
  };
  const sentence = (c, withEnglish) => {
    $("check-sentence-ja").replaceChildren(...sentenceParts(c).map(p => p.mark ? el("u", {class: "n2-mark", text: p.text}) : document.createTextNode(p.text)));
    $("check-sentence-en").textContent = c.example?.en || "";
    $("check-sentence-en").hidden = !withEnglish || !c.example?.en;
    $("check-sentence").hidden = !c.example;
  };
  const byEar = session.filter(audio).length;
  $("check-sub").textContent = session.length ? session.length + " from yesterday" + (byEar ? " · " + byEar + " by ear" : "") : "";
  function draw(gesture = false) {
    const c = session[index];
    revealed = false; plays = 0; responseMs = 0; heardPrompt = false; playback++;
    $("check-reveal").disabled = !!c && audio(c);
    $("check-skip-audio").hidden = !c || !audio(c);
    $("check-progress").textContent = session.length ? Math.min(index + 1, session.length) + " / " + session.length : "";
    $("check-bar").style.width = (session.length ? index / session.length * 100 : 0) + "%";
    $("check-answer").hidden = true; $("check-reveal").hidden = false; grades.forEach(b => b.hidden = true);
    $("check-evidence").hidden = true;
    if (!session.length) {
      $("check-ask").textContent = "";
      $("check-prompt").textContent = "Nothing from yesterday.";
      $("check-prompt").classList.add("long");
      $("check-why").textContent = "Misses, guesses and slow answers from recall, mocks and Day Radio come back here the next day, in a sentence you did not see.";
      $("check-note").textContent = ""; $("check-provenance").hidden = false; $("check-help").hidden = false; $("check-help").hidden = true; $("check-sentence").hidden = true; $("check-say").hidden = true; $("check-actions").hidden = true;
      return;
    }
    if (!c) { finish(); return; }
    clock?.stop(); clock = activeClock();
    $("check-ask").textContent = [audio(c) ? "By ear" : "In print", DIMENSION[c.dimension]].filter(Boolean).join(" · ");
    $("check-prompt").textContent = audio(c) ? "…" : c.prompt;
    $("check-prompt").classList.toggle("long", !audio(c) && c.prompt.length > 8);
    if (audio(c)) $("check-sentence").hidden = true; else sentence(c, false);
    $("check-say").hidden = !audio(c);
    $("check-say-label").textContent = "Play";
    // One quiet line says why it is here; ? opens what to do and the context.
    $("check-why").textContent = [WHY_LINE[c.why] + (c.recurring ? ", and before" : ""), CONTEXT_SHORT[c.context === "fresh" ? (c.seen.length ? "fresh" : "") : c.context === "same" ? "same" : audio(c) ? "heard" : "word"]].filter(Boolean).join(" · ");
    $("check-note").textContent = [checkAsk(c) + ".", contextNote(c)].filter(Boolean).join(" ").replace(/\.\./g, ".");
    $("check-note").hidden = true; $("check-help").setAttribute("aria-expanded", "false"); $("check-provenance").hidden = false; $("check-help").hidden = false;
    if (audio(c) && gesture) speakCurrent();
  }
  function reveal() {
    const c = session[index]; if (!c || revealed || (audio(c) && !heardPrompt)) return;
    $("check-skip-audio").hidden = true;
    responseMs = clock.read(); revealed = true;
    $("check-prompt").textContent = c.prompt;
    $("check-prompt").classList.toggle("long", c.prompt.length > 8);
    sentence(c, true);
    $("check-reading").textContent = c.reading && c.reading !== c.prompt ? c.reading : "";
    $("check-meaning").textContent = c.answer;
    $("check-answer").hidden = false; $("check-reveal").hidden = true; grades.forEach(b => b.hidden = false);
    $("check-say").hidden = false; $("check-say-label").textContent = "Hear it";
    // What this check is evidence of, in the copy contract, and what did not move.
    $("check-evidence-kind").replaceChildren(el("span", {lang: "ja", text: c.text}), (audio(c) ? "listening" : c.dimension === "grammar" ? "grammar" : "written " + c.dimension) + " · Instant records “recalled on another day”" + (c.context === "fresh" ? " and “understood in a new passage”" : ""));
    $("check-evidence-line").textContent = audio(c) ? evidenceLine(c.target, {recall: data.recall, events: data.events}) : "Your listening record is unchanged.";
    $("check-evidence-open").onclick = () => openEvidence(c, "Why it was picked: " + (WHY_LINE[c.why] || "").toLowerCase() + (c.recurring ? ", and missed before too" : "") + ". Today's checks pick yesterday's misses, slow answers, guesses and Day Radio plays.");
    $("check-evidence").hidden = false;
  }
  async function grade(value) {
    const c = session[index]; if (!c || !revealed) return;
    revealed = false;
    const detail = checkDetail(c, {activeMs: clock.read(), responseMs, replays: audio(c) ? Math.max(0, plays - 1) : 0});
    try {
      if (audio(c)) {
        const event = radioEvent({target: c.target, kind: "recall", grade: audioGrade(value), source: CHECK_SOURCE, mode: "check", exampleId: c.example?.id, detail});
        await access("events", "put", event); data.events.push(event);
      } else {
        const id = recallId(c.dimension, c.target), previous = data.recall.find(r => r.id === id);
        const record = recallRecord(previous, {id, type: c.dimension, item: {target: c.target, prompt: c.prompt, reading: c.reading, answer: c.answer}}, value, new Date(), detail);
        await access("recall", "put", record);
        data.recall = data.recall.filter(r => r.id !== id).concat(record);
      }
      tally[value]++; if (value !== "instant") missed.push(c);
      announceSaved("Saved: " + value);
      index++; draw(true);
    } catch (error) { revealed = true; saveFailed(() => grade(value)); }
  }
  function finish() {
    clock?.stop();
    $("check-card").hidden = true; $("check-actions").hidden = true; $("check-done").hidden = false; $("check-provenance").hidden = true; $("check-note").hidden = true;
    $("check-bar").style.width = "100%";
    $("check-done-title").textContent = (session.length - skipped) + " checked a day later";
    $("check-done-line").textContent = tally.instant + " instant · " + tally.slow + " slow · " + tally.missed + " missed · " + skipped + " skipped. Today's misses come back tomorrow.";
    $("check-missed").replaceChildren(...missed.map(m => el("li", {},
      el("span", {class: "drill-missed-text"}, el("span", {lang: "ja", text: m.prompt + (m.reading && m.reading !== m.prompt ? "（" + m.reading + "）" : "")}), el("span", {class: "hint", text: m.answer + " · " + (audio(m) ? "by ear" : "in print")})))));
  }
  $("check-reveal").onclick = reveal;
  $("check-say").onclick = speakCurrent;
  reportCard = () => { const c = session[index]; return c && !$("check").hidden ? {type: "n2-check", id: JSON.stringify(c.target), text: c.text, reading: c.reading, quote: c.example?.ja ? c.example.ja.replace(/【[^】]*】/g, "") : c.text, extra: {view: "check", example: c.example?.ja, exampleId: c.example?.id, modality: c.modality, dimension: c.dimension}} : null; };
  $("check-skip-audio").onclick = () => {
    if (!session[index] || !audio(session[index]) || revealed) return;
    window.speechSynthesis?.cancel(); skipped++; index++; draw(true);
  };
  $("check-card").onclick = e => { if (!e.target.closest("button")) reveal(); };
  grades.forEach(b => b.onclick = () => grade(b.dataset.checkGrade));
  document.addEventListener("keydown", e => {
    if (e.target.closest("input,textarea,select") || e.metaKey || e.ctrlKey) return;
    if ((e.key === " " || e.key === "Enter") && !revealed) { if (e.target.closest("button,a,summary") || !session[index]) return; e.preventDefault(); reveal(); }
    else if (revealed && ["1", "2", "3"].includes(e.key)) grade(["missed", "slow", "instant"][Number(e.key) - 1]);
  });
  window.addEventListener("pagehide", () => { clock?.stop(); window.speechSynthesis?.cancel(); });
  draw();
}

/* ───────── Day Radio ───────── */
const DAY_KEY = "echo-n2-day";
function readDay() { try { return JSON.parse(localStorage.getItem(DAY_KEY) || "{}"); } catch { return {}; } }
function writeDay(patch) { try { localStorage.setItem(DAY_KEY, JSON.stringify({...readDay(), ...patch})); } catch {} }
async function dayRadio() {
  show("day");
  await materials();
  const [data, examples] = await Promise.all([report(), deckExamples()]);
  const evidence = scored(data), items = radioItems(inventory);
  const saved = readDay();
  // The next-day check is Today's checks now; Day Radio is listening only.
  let mode = params.get("mode") === "recall" ? "recall" : params.get("mode") === "listen" ? "listen" : saved.mode === "recall" ? "recall" : "listen";
  let pause = RECALL_PAUSES.includes(saved.pause) ? saved.pause : 5;
  let later = Array.isArray(saved.later) ? saved.later : [];
  let queue = [], heard = new Set(), revealed = false, current = null, wake = null, ringTimer = 0;
  const heardIds = new Map();
  for (const e of data.events) if (e.kind === "exposure" && e.context?.exampleId) heardIds.set(JSON.stringify(e.target), new Set([...(heardIds.get(JSON.stringify(e.target)) || []), e.context.exampleId]));
  const record = async event => { try { await access("events", "put", event); data.events.push(event); if (event.kind === "recall") announceSaved("Saved: " + event.grade); } catch (e) { saveFailed(() => record(event)); } };
  const exampleFor = item => item.example !== undefined ? item.example
    : mode === "listen" ? (examples.get(JSON.stringify(item.target)) || [])[0] || null
    : chooseExample(examples.get(JSON.stringify(item.target)) || [], heardIds.get(JSON.stringify(item.target)) || new Set());
  const voices = () => japaneseVoices("ja");
  const player = new DayPlayer({
    speak: (text, opts) => speakAndWait(text, {...opts, voice: opts.lang === "ja" ? voice() : null}),
    cancel: () => window.speechSynthesis?.cancel(),
    onItem: (item, i) => {
      draw(item, i);
      writeDay({mode, index: i, day: localDay(), ids: queue.map(q => JSON.stringify(q.target))});
    },
    onReveal: reveal,
    // The pause before the meaning, drawn as the PauseRing (J2Recall).
    onRing: (item, ms) => {
      const total = Math.round(ms / 1000), started = Date.now(), ring = pauseRing({total});
      clearInterval(ringTimer);
      $("day-ring").replaceChildren(el("p", {class: "overline", text: "Sentence " + (index + 1) + " of " + queue.length}), el("p", {class: "n2-day-ask", text: "What does it mean?"}), ring.el);
      $("day-ring").hidden = false;
      ringTimer = setInterval(() => { const left = total - (Date.now() - started) / 1000; ring.set(left); if (left <= 0) clearInterval(ringTimer); }, 250);
    },
    onComplete: item => record(radioEvent({target: item.target, kind: "exposure", source: "day-radio", mode, exampleId: exampleFor(item)?.id})),
    onDone: () => { release(); finish(); },
  });
  reportCard = () => current && !$("day").hidden ? {type: "n2-" + current.target[0], id: JSON.stringify(current.target), text: current.text, reading: current.reading, meaning: current.meaning, quote: current.text + (current.reading && current.reading !== current.text ? "（" + current.reading + "）" : ""), extra: {view: "day-radio", mode, example: exampleFor(current)?.ja, exampleId: exampleFor(current)?.id}} : null;
  async function hold() { try { wake = await navigator.wakeLock?.request("screen") || null; } catch { wake = null; } }
  function release() { try { wake?.release(); } catch {} wake = null; }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && player.running) hold(); });

  function sync() {
    const url = new URL(location.href); url.searchParams.set("view", "radio"); url.searchParams.set("mode", mode);
    history.replaceState(history.state, "", url);
    document.querySelectorAll("#day [role=tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === mode));
    $("day-pace").hidden = mode !== "recall";
    $("day-pace").replaceChildren(...RECALL_PAUSES.map(n => el("button", {type: "button", "data-ui": "button", "aria-pressed": String(n === pause), text: n + " s pause", onclick: () => { pause = n; writeDay({pause}); sync(); }})));
    howTo();
    $("day-lede").textContent = {
      listen: "Each item: the word, its meaning, a natural sentence, the word again. Leave it playing while you walk, cook or tidy. Keep Echo open — a locked phone stops speech.",
      recall: "Echo says a sentence, pauses, then reveals. Say the meaning aloud in the pause. Tap Got it or Not yet if you can — that is a listening check; otherwise it counts as listening only. Tomorrow, Today's checks tests what you heard.",
    }[mode];
    $("day-play").textContent = player.running ? "Pause" : "Play";
  }
  async function build(resume = false) {
    player.stop(); release();
    queue = dayQueue({inventory, recall: data.recall, evidence, events: data.events, later: later.map(k => JSON.parse(k))});
    if (resume && saved.day === localDay() && saved.mode === mode && saved.ids?.length && saved.ids.every(k => items.has(k))) {
      const reasons = new Map(queue.map(q => [JSON.stringify(q.target), q.why]));
      queue = saved.ids.map(k => ({...items.get(k), why: reasons.get(k) || "resume"}));
    }
    const resumeAt = resume && saved.day === localDay() && saved.mode === mode && JSON.stringify(saved.ids) === JSON.stringify(queue.map(q => JSON.stringify(q.target))) ? saved.index || 0 : 0;
    index = Math.min(resumeAt, Math.max(0, queue.length - 1));
    sync();
    $("day-done").hidden = true; $("day-card").hidden = false; $("day-bar-actions").hidden = false;
    if (!queue.length) {
      $("day-why").textContent = ""; $("day-text").textContent = "Nothing to play yet.";
      $("day-answer").hidden = true; $("day-example-ja").textContent = $("day-example-en").textContent = "";
      $("day-note").textContent = "";
      $("day-progress").textContent = ""; $("day-bar-actions").hidden = true; return;
    }
    $("day-sub").textContent = queue.length + " items · " + queue.filter(q => q.why === "weak").length + " weak · " + queue.filter(q => q.why === "new").length + " new";
    draw(queue[index], index);
  }
  let index = 0;
  const WHY = {weak: "Weak · missed, guessed or slow", later: "Marked for later", new: "New · not checked yet", review: "Previously checked", resume: "Resumed session"};
  function draw(item, i) {
    current = item; index = i; revealed = false;
    clearInterval(ringTimer); $("day-ring").hidden = true;
    const example = exampleFor(item);
    $("day-progress").textContent = (i + 1) + " / " + queue.length;
    $("day-bar").style.width = (i / queue.length * 100) + "%";
    $("day-why").textContent = WHY[item.why] || "";
    const hide = mode !== "listen";
    $("day-text").textContent = hide ? "…" : item.text;
    $("day-text").classList.toggle("long", item.text.length > 8);
    $("day-reading").textContent = item.reading && item.reading !== item.text ? item.reading : "";
    $("day-meaning").textContent = item.meaning;
    $("day-answer").hidden = hide;
    $("day-example-ja").replaceChildren(...(example ? exampleNodes(example.ja, patternNeedles(item.text)) : []));
    $("day-example-en").textContent = example?.en || "";
    $("day-example").hidden = hide || !example;
    $("day-rate").hidden = true;
    $("day-note").textContent = !example ? (mode === "listen" ? "No example sentence for this one yet — the word and its meaning only." : "No sentence for this one yet — you will hear the word itself.") : "";
    $("day-later").setAttribute("aria-pressed", String(later.includes(JSON.stringify(item.target))));
    $("day-prev").disabled = i === 0; $("day-next").disabled = i >= queue.length - 1;
  }
  function reveal() {
    if (!current) return; revealed = true;
    clearInterval(ringTimer); $("day-ring").hidden = true;
    $("day-text").textContent = current.text;
    $("day-answer").hidden = false;
    $("day-example").hidden = !$("day-example-ja").textContent;
    if (mode !== "listen") $("day-rate").hidden = false;
  }
  async function rate(grade) {
    if (!current || !revealed) return;
    revealed = false;
    $("day-rate").hidden = true;
    await record(radioEvent({target: current.target, kind: "recall", grade, source: "day-radio", mode, exampleId: exampleFor(current)?.id}));
  }
  function finish() {
    $("day-card").hidden = true; $("day-bar-actions").hidden = true; $("day-done").hidden = false;
    $("day-bar").style.width = "100%";
    const today = localDay(), mine = data.events.filter(e => localDay(new Date(e.at)) === today);
    $("day-done-title").textContent = "Queue played through";
    $("day-done-line").textContent = mine.filter(e => e.kind === "exposure").length + " heard today · " + mine.filter(e => e.kind === "recall" && e.grade === "got").length + " caught by ear · " + mine.filter(e => e.kind === "recall" && e.grade !== "got").length + " not yet";
    writeDay({index: 0, ids: []});
    sync();
  }
  function play() {
    if (!queue.length) return;
    if (player.running) { const at = player.index; player.stop(); release(); index = at; sync(); return; }
    hold();
    player.start(queue, {index, steps: item => daySteps(mode, item, exampleFor(item), {pause}), rate: Number(settings.rate) || 1});
    sync();
  }
  $("day-play").onclick = play;
  $("day-next").onclick = () => { if (index >= queue.length - 1) return; if (player.running) player.jump(index + 1); else draw(queue[++index], index); };
  $("day-prev").onclick = () => { if (index <= 0) return; if (player.running) player.jump(index - 1); else draw(queue[--index], index); };
  $("day-repeat").onclick = () => { if (player.running) player.jump(index); else play(); };
  $("day-later").onclick = () => {
    if (!current) return;
    const k = JSON.stringify(current.target);
    later = later.includes(k) ? later.filter(x => x !== k) : [...later, k].slice(-60);
    writeDay({later});
    $("day-later").setAttribute("aria-pressed", String(later.includes(k)));
  };
  document.querySelectorAll("#day [data-rate]").forEach(b => b.onclick = () => rate(b.dataset.rate));
  document.querySelectorAll("#day [role=tab]").forEach(b => b.onclick = () => { mode = b.dataset.mode; writeDay({mode}); build(); });
  $("day-again").onclick = () => { writeDay({index: 0}); index = 0; saved.index = 0; build(); };
  window.addEventListener("pagehide", () => { player.stop(); release(); });
  await build(true);
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
  else if (saved && !archivedView && saved.phase !== "results") {
    // A sitting saved on a paper this device no longer has: keep it in
    // history rather than overwrite it, then start clean on the current paper.
    try { await access("history", "put", {...saved, id: saved.id || "legacy-" + year, book: year, unscorable: true}); localStorage.removeItem(storageKey); }
    catch { warn("An earlier unfinished attempt could not be moved aside; this sitting will not be saved."); }
  }

  const minutes = phase => paper.minutes ? (typeof paper.minutes === "object" ? paper.minutes[phase] || 5 : paper.minutes) : adaptive ? Math.ceil((phase === "written" ? written : questions.length - written) * 1.5) : (phase === "written" ? 105 : 50);
  function persist() {
    if (archivedView || state.phase === "ready") return;
    try {
      const previous = localStorage.getItem(storageKey);
      const other = JSON.parse(previous || "null");
      if (other?.id && other.id !== state.id) return;
      if (other?.phase === "results" && state.phase !== "results") return;
      const next = JSON.stringify(state);
      if (next === previous) return;
      localStorage.setItem(storageKey, next);
      if (state.phase === "results") markDirty("n2");
    } catch { warn("Device storage is unavailable. Keep this page open to retain this attempt."); }
  }
  const active = () => state.phase === "written" || state.phase === "listening";
  const range = () => state.phase === "written" ? [0, written] : [written, questions.length];
  function recordTime() {
    const now = Date.now();
    if (active() && !state.pausedAt) state.time[state.index] += Math.max(0, Math.min(now, state.deadline) - entered);
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
  // Pause (report 88181095: "a pause button for emergencies"). The deadline
  // moves by the time paused; the question is hidden meanwhile, and the
  // paused minutes are kept on the attempt (pausedMs) for the results.
  function drawPause() {
    const on = active() && !!state.pausedAt;
    document.body.classList.toggle("n2-is-paused", on);
    $("exam-paused").hidden = !on; $("exam-pause").hidden = !active() || archivedView;
    if (on) $("clock").textContent = "Paused";
  }
  function pause() {
    if (!active() || state.pausedAt || tick()) return;
    recordTime(); stopVoice(); $("audio").pause();
    state.pausedAt = Date.now(); persist(); drawPause(); $("exam-resume").focus();
  }
  function resume() {
    if (!state.pausedAt) return;
    const gap = Math.max(0, Date.now() - state.pausedAt);
    state.deadline += gap; state.pausedMs = (state.pausedMs || 0) + gap; state.pauses = (state.pauses || 0) + 1;
    delete state.pausedAt; entered = Date.now();
    persist(); drawPause(); tick(); renderExam();
  }
  function tick() {
    if (!active()) { $("clock").textContent = ""; return false; }
    if (state.pausedAt) { $("clock").textContent = "Paused"; return false; }
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
  // The first time each question is on screen, separate from when the paper
  // was made: readiness counts only material actually seen (drillExposure).
  function markShown() {
    if (archivedView || state.shownAt?.[state.index]) return;
    const at = new Date().toISOString();
    state.shownAt = {...(state.shownAt || {}), [state.index]: at};
    persist();
    if (paper.shownTracked && !paper.firstShownAt) { paper.firstShownAt = at; access("papers", "put", paper).catch(() => {}); }
  }
  function renderExam() {
    markShown();
    const q = questions[state.index];
    const [first, end] = range();
    const answered = state.answers.slice(first, end).filter(Boolean).length;
    $("material").textContent = SKILL_JA[q.skill];
    $("material").title = SKILLS[q.skill];
    $("count").textContent = (state.index - first + 1) + " of " + (end - first) + " · " + answered + " answered";
    $("progress").style.width = answered / (end - first) * 100 + "%";
    $("prompt").textContent = q.label;
    $("instruction").textContent = native ? instructionFor({...q, skill: SKILLS[q.skill]}) : (q.instruction || "");
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
    $("unsure-chip").hidden = !state.guesses[state.index];
    $("prev").disabled = state.index === first;
    const finishing = state.index === end - 1;
    if ($("next").dataset.finishing !== String(finishing)) { $("next").dataset.finishing = String(finishing); $("next").innerHTML = finishing ? "Finish" : chevronRightSvg; $("next").classList.toggle("bar-icon-button", !finishing); }
    $("next").setAttribute("aria-label", state.index === end - 1 ? "Review and finish the section" : "Next question");
  }
  reportCard = () => {
    const q = questions[state.index];
    if (!q || $("exam").hidden) return null;
    return {type: "n2-question", id: paper.id + "#" + state.index, label: "This question", title: "Flag this question", text: q.prompt || q.label, quote: (q.label || "") + (q.prompt ? " · " + String(q.prompt).replace(/[【】]/g, "") : ""),
      extra: {paper: paper.title, edition: paper.edition, source: sourceOf(paper, q), mondai: q.mondai, choices: (q.choices || []).join(" / "), context: q.context ? String(q.context).slice(0, 300) : ""}};
  };
  function openGrid() {
    const [first, end] = range();
    const answers = state.answers.slice(first, end), unsure = state.guesses.slice(first, end).filter(Boolean).length, blanks = answers.filter(a => !a).length;
    $("grid-title").textContent = (state.phase === "listening" ? "聴解" : questions[first].skill === 3 ? "聴解" : "言語知識・読解") + " · " + (end - first) + " questions";
    $("grid-summary").textContent = (end - first - blanks) + " answered · " + unsure + " unsure · " + blanks + " blank";
    // Grouped by 問題 with its range, so what is left has a name.
    const groups = [];
    for (const q of questions.slice(first, end)) {
      const key = q.mondai ? q.label : "", last = groups.at(-1);
      if (last && last.key === key) last.items.push(q); else groups.push({key, items: [q]});
    }
    const cell = q => el("button", {type: "button", class: "n2-cell", "data-ui": "button",
      "data-answered": String(!!state.answers[q.index]), "data-unsure": String(!!state.guesses[q.index]), "aria-current": q.index === state.index ? "true" : null,
      "aria-label": q.label + ", question " + (q.index - first + 1) + (state.answers[q.index] ? ", answered" : ", blank") + (state.guesses[q.index] ? ", unsure" : ""),
      onclick: () => { $("grid-dialog").close(); move(q.index); }}, String(q.index - first + 1));
    $("jump").replaceChildren(...groups.map(g => el("div", {class: "n2-grid-group"},
      g.key ? el("p", {class: "n2-grid-head"}, el("span", {lang: "ja", text: g.key.replace(" · ", " ")}), el("span", {text: (g.items[0].index - first + 1) + (g.items.length > 1 ? "–" + (g.items.at(-1).index - first + 1) : "")})) : null,
      el("div", {class: "n2-grid"}, ...g.items.map(cell)))));
    for (const c of $("jump").querySelectorAll('[data-unsure="true"]')) c.insertAdjacentHTML("beforeend", flagSvg);
    $("submit").textContent = blanks ? "Finish · " + blanks + " blank" : "Finish section";
    $("grid-dialog").showModal();
    $("jump").querySelector('[aria-current="true"]')?.focus({preventScroll: false});
  }
  function renderResults() {
    $("results-title").textContent = "Results";
    const paused = state.pausedMs ? Math.max(1, Math.round(state.pausedMs / 60000)) : 0;
    $("results-date").textContent = [bookIds.includes(paper.book) ? "Mock " + String(bookIds.indexOf(paper.book) + 1).padStart(2, "0") : paper.title, dateLabel(state.completedAt), archivedView ? "earlier attempt" : null].filter(Boolean).join(" · ");
    $("results-date").title = paper.title + (paused ? " · paused " + paused + " min" + (state.pauses > 1 ? " in " + state.pauses + " pauses" : "") : "");
    const short = adaptive;
    $("scores").replaceChildren(short ? doneCard() : scoreCard(paper, state));
    $("results-more").replaceChildren(short ? el("span") : byMondai(), slowest());
    resultActions(short);
    Promise.all([tagMap(), cueMap()]).then(([map, cues]) => {
      results.cues = cues;
      const slips = attemptTags({paper, attempt: state, tagMap: map});
      if (!slips.length) { draw(); return; }
      $("results-more").append(collapseRow({title: "Where comprehension slipped", meta: slips.slice(0, 2).map(t => t.ja).join(" · ") + (slips.length > 2 ? " · " + (slips.length - 2) + " more" : ""), open: true},
        el("ol", {class: "n2-times"}, ...slips.map(t => el("li", {}, el("span", {lang: "ja", text: t.ja}), " " + t.en + " · " + t.wrong + " of " + t.n + " missed or unsure")))));
      results.tags = map; draw();
    });
    $("retake").hidden = archivedView;
    $("script").hidden = native; $("script").href = bookUrl + "script.pdf";
    let filter = "wrong";
    var draw = () => {
      const flagged = q => state.answers[q.index] !== q.key || state.guesses[q.index];
      const counts = {wrong: questions.filter(flagged).length, all: questions.length};
      document.querySelectorAll("#results [data-show]").forEach(b => { b.setAttribute("aria-selected", String(b.dataset.show === filter)); b.textContent = (b.dataset.show === "wrong" ? "Missed and unsure" : "All") + " · " + counts[b.dataset.show]; });
      const items = questions.filter(q => filter === "all" || flagged(q));
      if (!items.length) { $("review-items").replaceChildren(el("div", {class: "empty-panel"}, el("strong", {text: "Clean sheet"}), el("span", {text: "Every answer was correct and confident."}))); return; }
      // Grouped by section, each with its missed and unsure counts.
      const groups = SECTIONS.map(sec => ({sec, rows: items.filter(q => sec.skills.includes(q.skill))})).filter(g => g.rows.length);
      $("review-items").replaceChildren(...groups.map(({sec, rows}) => {
        const missed = rows.filter(q => state.answers[q.index] !== q.key).length, unsure = rows.filter(q => state.guesses[q.index]).length;
        return el("section", {class: "n2-review-group"},
          el("h4", {class: "n2-review-group-head"}, el("span", {}, el("span", {lang: "ja", text: sec.ja}), " · " + sec.en.toLowerCase()), el("span", {class: "hint", text: missed + " missed · " + unsure + " unsure"})),
          ...rows.map(q => reviewItem(q, filter)));
      }), ...(filter === "wrong" ? [el("p", {class: "hint n2-review-note", text: "Every row is a missed or unsure question; a chip only marks the unsure ones."})] : []));
    };
    document.querySelectorAll("#results [data-show]").forEach(b => b.onclick = () => { filter = b.dataset.show; draw(); });
    draw();
  }
  function slowest() {
    const top = [...questions].sort((a, b) => state.time[b.index] - state.time[a.index]).slice(0, 5).filter(q => state.time[q.index] > 0);
    if (!top.length) return el("span");
    const total = Math.round(state.time.reduce((a, b) => a + b, 0) / 60000);
    const pausedMin = state.pausedMs ? Math.max(1, Math.round(state.pausedMs / 60000)) : 0;
    const secs = ms => { const t = Math.round(ms / 1000); return t >= 60 ? Math.floor(t / 60) + " min " + (t % 60) : t + "s"; };
    return collapseRow({title: "Time · " + total + " min answering" + (pausedMin ? " · " + pausedMin + " min paused" : ""), meta: "Slowest: " + top[0].label.split(" · ")[0] + " q" + (top[0].index + 1) + " (" + secs(state.time[top[0].index]) + ")"},
      el("ol", {class: "n2-times"}, ...top.map(q => el("li", {}, SKILLS[q.skill] + " · " + q.label + " · " + Math.round(state.time[q.index] / 1000) + "s"))));
  }
  const results = {tags: null, cues: null};
  const right = q => state.answers[q.index] === q.key && !state.guesses[q.index];
  // A short session (J1Done): one total, a denominator per section, the
  // weakest named, and what comes back tomorrow.
  function doneCard() {
    const got = questions.filter(right).length;
    const rows = SKILLS.map((name, skill) => ({skill, items: questions.filter(q => q.skill === skill)})).filter(r => r.items.length)
      .map(r => ({...r, got: r.items.filter(right).length}));
    const weakest = rows.length > 1 ? [...rows].sort((a, b) => a.got / a.items.length - b.got / b.items.length)[0] : null;
    const misses = questions.length - got, back = questions.filter(q => !right(q) && q.target && state.answers[q.index]).length;
    return el("div", {class: "n2-done"}, el("span", {class: "drill-done-seal", lang: "ja", "aria-hidden": "true", text: "了"}),
      el("strong", {text: got + " of " + questions.length + " right"}),
      el("p", {class: "hint", text: questions.length + " items checked once" + (rows.length > 1 ? ", across " + rows.length + " skills" : "") + ". Saved on this device."}),
      el("ul", {class: "n2-done-skills"}, ...rows.map(r => el("li", {}, el("span", {}, el("span", {lang: "ja", text: SKILL_JA[r.skill] + " "}), SKILLS[r.skill]),
        el("span", {text: r.got + " of " + r.items.length + (r === weakest && r.got < r.items.length ? " · weakest" : "")})))),
      misses ? el("p", {class: "hint", text: back ? (back === misses ? "Your " + misses + " misses come back tomorrow in Today's checks, on a different example." : back + " of your " + misses + " misses come back tomorrow in Today's checks, on a different example; the rest are in the review below.") : "Your misses are in the review below, each with what decided it."}) : null);
  }
  // A full paper: the count per 問題, so a section's weak spot has a name.
  function byMondai() {
    if (!native || !questions.some(q => q.mondai)) return el("span");
    const groups = new Map();
    for (const q of questions) { const k = (q.skill === 3 ? "聴解 " : "") + "問題" + q.mondai; const g = groups.get(k) || {n: 0, got: 0, missed: []}; g.n++; if (right(q)) g.got++; else g.missed.push(g.n); groups.set(k, g); }
    const weak = [...groups].filter(([, g]) => g.got < g.n).sort((a, b) => a[1].got / a[1].n - b[1].got / b[1].n);
    return collapseRow({title: "By 問題" + (weak.length ? " · weakest " + weak[0][0] : " · all correct"), meta: weak.length ? weak.slice(0, 2).map(([k, g]) => k + " " + g.got + " of " + g.n).join(" · ") : groups.size + " parts"},
      el("ul", {class: "n2-mondai"}, ...[...groups].map(([k, g]) => el("li", {}, el("span", {lang: "ja", text: k}),
        el("span", {text: g.got + " of " + g.n + " correct" + (g.missed.length && g.missed.length <= 2 ? " · question " + g.missed.join(", ") + " missed" : "")})))));
  }
  // One filled button, Back to the plan; one outlined, the weakest section's
  // practice ("Practise listening" opens Day Radio recall); retaking is a link.
  function resultActions(short) {
    const drill = $("result-drill");
    if (short || archivedView) { drill.hidden = true; return; }
    const e = estimate(paper, state);
    const weakest = [...e.sections].filter(s => s.total).sort((a, b) => a.correct / a.total - b.correct / b.total)[0];
    const plan = weakest?.key === "listening" ? ["Practise listening", "?view=radio&mode=recall"] : ["Drill my weak items", "?view=recall&queue=weak"];
    drill.textContent = plan[0] + (weakest ? " · " + weakest.ja + " first" : ""); drill.href = plan[1]; drill.hidden = false;
  }
  // The line that decided an answer, marked in its passage or script.
  function decisive(q) {
    const cue = results.cues?.[sourceOf(paper, q)];
    if (!cue || !q.context?.includes(cue)) return null;
    const lines = q.skill === 3 ? q.context.split("\n").filter(Boolean) : q.context.split(/(?<=[。！？])/).filter(x => x.trim());
    const at = lines.findIndex(l => l.includes(cue));
    const shown = q.skill === 3 ? lines : lines.slice(Math.max(0, at - 1), at + 2);
    return el("div", {}, el("p", {class: "overline", text: "The line that decided it"}),
      el("ol", {class: "n2-decisive", lang: "ja"}, ...shown.map(line => {
        if (!line.includes(cue)) return el("li", {text: line});
        const [before, ...after] = line.split(cue);
        return el("li", {class: "cue"}, before, el("mark", {text: cue}), after.join(cue));
      })));
  }
  // One tap says why a comprehension answer went wrong; it stays on the attempt.
  async function setCause(q, cause) {
    state.causes = {...(state.causes || {}), [q.index]: cause};
    // When each tag was set, so the later edit wins between devices (sync.js mergeCauses).
    state.causesAt = {...(state.causesAt || {}), [q.index]: new Date().toISOString()};
    if (archivedView) { try { await access("history", "put", state); announceSaved(); } catch (e) { saveFailed(() => setCause(q, cause)); return; } }
    else persist();
  }
  function causeRow(q) {
    const pick = state.causes?.[q.index];
    const group = el("div", {class: "chips", role: "group", "aria-label": "Why it went wrong"});
    const drawChips = () => group.replaceChildren(...CAUSES.map(([id, label]) => el("button", {type: "button", "data-ui": "button", "aria-pressed": String((state.causes?.[q.index]) === id), text: label,
      onclick: async () => { await setCause(q, id); drawChips(); }})));
    drawChips();
    return el("div", {class: "n2-cause"}, el("p", {class: "hint", text: pick ? "Why it went wrong" : "Why did this one go wrong?"}), group);
  }
  // A review row: the question number, its stem in full, a chip only where it
  // adds something (Unsure; Missed or Blank in All), and the chevron. Open, it
  // shows your answer struck through, the right one in the ON idiom, the
  // solution with furigana, then why.
  function reviewItem(q, filter = "wrong") {
    const answer = state.answers[q.index], right = answer === q.key, unsure = state.guesses[q.index];
    const chip = unsure ? {text: "Unsure", kind: "below"} : filter === "all" && !right ? {text: answer ? "Missed" : "Blank", kind: "muted"} : null;
    const summary = el("summary", {}, el("span", {class: "n2-review-n", text: String(q.index + 1)}),
      el("span", {class: "n2-review-stem", lang: "ja"}, native ? marked(q.prompt) : "Your answer " + (answer || "—") + " · correct " + q.key),
      chip ? el("span", {class: "status-chip " + chip.kind, text: chip.text}) : el("span"));
    summary.insertAdjacentHTML("beforeend", collapseChevronSvg);
    const item = el("details", {class: "n2-review"}, summary);
    if (native) {
      const choice = (i, kind, label) => el("div", {class: "n2-review-choice", "data-kind": kind},
        el("span", {class: "n2-choice-n", text: String(i)}), el("span", {class: "n2-review-choice-text", lang: "ja", text: q.choices[i - 1]}), el("span", {class: "status-chip " + (kind === "right" ? "below" : "muted"), text: label}));
      item.append(el("div", {class: "n2-review-choices"},
        answer && !right ? choice(answer, "picked", "Your answer") : null,
        choice(q.key, "right", right ? "Right · yours" : "Right"),
        !answer ? el("p", {class: "hint", text: "Left blank."}) : null));
      // Furigana on the solution and the explanation, filled in when opened.
      const solution = el("div", {class: "n2-solution-wrap"}), why = q.why ? el("p", {class: "n2-why"}, el("span", {class: "n2-why-label", text: "Why: "}), q.why) : null;
      item.append(solution); if (why) item.append(why);
      item.addEventListener("toggle", async () => {
        if (!item.open || item.dataset.readings) return;
        item.dataset.readings = "1";
        solution.replaceChildren(...await solutionLine(q));
        if (why) why.replaceWith(await whyLine(q.why));
      });
      const tags = results.tags ? tagsOf(results.tags, sourceOf(paper, q)) : [];
      if (tags.length) item.append(el("p", {class: "hint", text: "Hinges on: " + tags.map(t => TAG[t].ja + " " + TAG[t].en.toLowerCase()).join(" · ")}));
      if ((q.skill === 2 || q.skill === 3) && (!right || unsure)) { const line = decisive(q); if (line) item.append(line); item.append(causeRow(q)); }
      if (q.context) item.append(collapseRow({title: q.skill === 3 ? "Script" : "Passage", meta: q.context.replace(/\s+/g, " ").slice(0, 28) + "…", className: "n2-review-context"},
        el("p", {class: "n2-passage small", lang: "ja", text: q.context})));
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
    drawPause();
    if (state.phase === "rest") {
      // The break: estimated written scores only; listening scores come after.
      const e = estimate(paper, state);
      $("rest-sub").textContent = (bookIds.includes(paper.book) ? "Mock " + String(bookIds.indexOf(paper.book) + 1).padStart(2, "0") + " · " : "") + "written section done";
      $("rest-score").replaceChildren(el("ul", {class: "n2-break-list"}, ...e.sections.filter(s => s.key !== "listening" && s.total).map(s =>
        el("li", {}, el("span", {}, el("span", {lang: "ja", text: s.ja}), " estimated"), el("strong", {text: s.scaled + " of " + SECTION_MAX})))),
        el("p", {class: "hint", text: "A direction, not a prediction. Listening scores after the next section."}));
    }
    if (state.phase === "results") renderResults();
  }
  function renderIntro() {
    $("set-title").textContent = paper.title;
    const writtenPart = paper.drill?.section === "reading" || paper.drill?.tag ? ["読解", "Reading"] : ["言語知識・読解", "Vocabulary, grammar, reading"];
    const parts = [[0, written, ...writtenPart], [written, questions.length, "聴解", "Listening"]].filter(([a, b]) => b > a);
    $("intro-plan").replaceChildren(...parts.map(([a, b, ja, en], i) => el("li", {}, el("span", {lang: "ja", class: "n2-meter-ja", text: ja}), el("span", {text: en + " · " + (b - a) + (b - a === 1 ? " question" : " questions")}), el("span", {class: "n2-meter-n", text: minutes(i === 0 && written ? "written" : "listening") + " min"}))));
    $("intro-copy").textContent = paper.drill?.tag ? "Unseen passages that all hinge on one thing: " + TAG[paper.drill.tag].hint + ". Find the line that decides each answer; the reasons come at the end."
      : paper.drill ? (paper.drill.section === "listening" ? "One section, timed. Play each script once, as the hall does. Mark a question unsure with the flag; read why each answer is right at the end." : "One section, timed: about the pace the real paper leaves for reading. Mark a question unsure with the flag; read why each answer is right at the end.")
      : adaptive ? "Questions written for your weak points. Topics come from your saved evidence." : native ? "One sitting, timed like the real paper, with a break before listening. Mark a question unsure with the flag." : "The publisher's booklet opens beside the answer sheet. Its audio needs internet.";
    $("start").textContent = "Start · " + minutes(firstPhase) + " min";
    $("intro-note").textContent = "Leaving keeps your answers. The timer keeps running, as it would in the hall, unless you pause it.";
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
  $("exam-pause").onclick = pause; $("exam-resume").onclick = resume;
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
    if (!active() || $("grid-dialog").open || e.metaKey || e.ctrlKey || e.altKey || e.target.closest("audio,video,a,input,textarea,select,iframe")) return;
    const q = questions[state.index];
    if (/^[1-4]$/.test(e.key) && Number(e.key) <= q.options) choose(Number(e.key));
    else if (e.key === "ArrowRight") move(state.index + 1);
    else if (e.key === "ArrowLeft") move(state.index - 1);
    else if (e.key.toLowerCase() === "f") $("guess").click();
  });
  window.addEventListener("pagehide", () => { stopVoice(); recordTime(); persist(); });
  window.addEventListener("pageshow", e => { if (e.persisted) entered = Date.now(); });
  render();
  setInterval(tick, 1000);
}

// The former Day Radio "Yesterday" tab opens Today's checks.
const view = params.get("view") === "radio" && params.get("mode") === "check" ? "check" : params.get("view");
offlineNotice(); voiceCheck();
const route = year ? exam : view === "recall" ? recall : view === "check" ? checks : view === "radio" ? dayRadio : hub;
mountReportButtons(document, () => openReport());
route().catch(error => { show(""); warn(error.message); });
// Two-way gist sync (sync.js): N2 study and reports. The library file is
// Echo's; this page leaves it alone. Progress from another device is offered,
// never forced onto the screen mid-answer.
autoSync = startAutoSync({adapters: {n2: n2Adapter(), reports: reportsAdapter()}, page: "n2", onResult: result => {
  if (!result?.pulled?.includes("n2")) return;
  setNotice("synced", el("div", {class: "notice"},
    el("p", {text: "Progress from your other device arrived."}),
    el("div", {class: "notice-actions"}, el("button", {type: "button", class: "outline", "data-ui": "button", text: "Show it", onclick: () => location.reload()}))));
}});
