import {dateKey, parseGoalDate, firstPassEnd, goalKey, readGoal, writeGoal, shortDate, longDate} from "./jlpt-goal.js";
import {bookIds,bookName,EDITION,SETS_EDITION,editionOf,form,realisticRows,realisticPaperId,setFile,instructionFor,solutionOf,whyReadings} from "./n2-forms.js";
import {access,currentAttempts,download,prefix,report,scored,n2Adapter} from "./n2-progress.js";
import {startAutoSync,markDirty,gistSettings} from "./sync.js";
import {LEVEL_EXAM,examOf as examRules,SKILLS,SKILL_JA,SECTIONS,PASS_TOTAL,SECTION_MIN,SECTION_MAX,estimate,sprintCheckpoint,nextExamDate,daysUntil,recallQueue,recallRecord,recallId,dailyGoal,coverage,localDay,todayPlan,measuredPace,capMinutes,DAY_MINUTES,EXAM_CHECKLIST,goalDates,formatMinutes,shortenPlan,maintenancePlan,resultsMonth,doneToday,markDone,scoreSeries,scoreCaption,examHeadLine,nextKicker,checkpointLine,mockTileState,historyKind,answering,resultPractice} from "./n2-study.js";
import {collapseRow,collapseChevronSvg,scoreChart,flagSvg,chevronLeftSvg,chevronRightSvg,replaySvg,planSteps,loadMeter,evidenceRow,pauseRing,openReportSheet,mountReportButtons} from "./components.js";
import {screenSnapshot,REPORT_REASONS,createReport,fileReport,reportSyncLine,reportsAdapter,reportHistory,screenOf,appVersion,deviceInfo} from "./reports.js";
import {recognitionFactory} from "./speech.js";
import {speakOnce,speakAndWait,japaneseVoices,RadioPlayer,NoiseBed} from "./speech.js";
import {RADIO_DEFAULTS,RADIO_PHASE_COPY,clockAt,radioPhase,radioPlan,radioSteps} from "./radio.js";
import {readNights, nightComparison, comparisonLine, eveningRecall, EVENING_SOURCE, nightPlan, nightRecord, keepNight, NIGHT_KEY} from "./n2-night.js";
import {kanjiOrderOf, skillWeights, kindWeights, flagCard, endRest, bossCards, bossQueue, bossReview, partRows, cutUnderline, provedBy, PROVED_MS, heardGap, grammarBlockCard, grammarCoverage, kanjiCoverage, levelCoverage, isCovered, aheadLevel, applyBoss, verdictLine, rankOf, setRank, rankLevels, hasBoss, RANKS, inSlump, itemLevel, levelAfter, ITEM_LEVEL, gamePool, choicesFor, pickRound, nextRound, levelOf, bonusPoints, atBedtime, bossProgress, takeBoss, resting, runTable, runClock, answerSpeech, patternVoice, BOSS_MINUTES, DIFFICULTY, difficultyOf, BOSS_EVERY, scoreAnswer, recallsMiss, rememberAnswer, rememberRound, today as gameToday, lastDays, ranking, bossSet, GAME_KEY, GAME_SOURCE, KIND_LABEL, REVIEW_SECONDS, DAILY_GOAL, PAUSE} from "./n2-game.js";
import {createLevels} from "./jlpt-levels.js";
import {createSets, levelRows, SET_LEVELS, setLevel, heldOut} from "./jlpt-sets.js";
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
// Only levels served by createSets use the downloaded paper path. N2 has
// similarly named papers bundled under n2-sets/.
const isLevelSet = id => Object.hasOwn(SET_LEVELS, setLevel(id));
const levelSet = isLevelSet(year);
const native = bookIds.includes(year) || adaptive || levelSet;
const gameSets = createSets();
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
  // In Quick round the game shows its own one-line notice on Home (board 12 · D), never Echo's panel.
  const draw = () => { const none = !japaneseVoices("ja").length, inGame = params.get("view") === "game"; $("game-notice").hidden = !(none && inGame); setNotice("voice", !none || inGame ? null : el("div", {class: "notice"},
    el("p", {text: "No Japanese voice on this device. Day Radio, listening checks and Echo’s own listening papers need one to speak."}),
    el("p", {class: "hint", text: "Add a Japanese voice in your phone’s settings, or choose another voice in Settings. The official sample papers still play: they are recordings."}),
    el("div", {class: "notice-actions"}, el("a", {class: "button outline", href: "./settings", text: "Open Settings → Voice"})))); };
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
function show(id) { for (const s of ["hub", "recall", "check", "game", "day", "intro", "exam", "rest", "results"]) $(s).hidden = s !== id; document.body.dataset.view = id; }
// Opened from Quick round, Day Radio and Evening recall wear the game's look
// (the skin after the Quick round block in styles.css) and its chevron; nothing else changes.
const FROM_GAME = params.get("from") === "game";
const GAME_CHEVRON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
if (FROM_GAME) { document.body.dataset.from = "game"; for (const id of ["day-back", "check-back"]) { $(id).innerHTML = GAME_CHEVRON; $(id).setAttribute("aria-label", "Back to Radio"); } }

// Reports (reports.js, ReportSheet): every head has the report button. Each
// view sets `reportCard` to describe the word, check or question on screen, so
// a flag names exactly what was wrong.
let reportCard = () => null, autoSync = null;
// A timed screen pauses while a report is written: reportPause() stops its
// clock and returns the function that starts it again.
let reportPause = null;
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
  const resume = reportPause?.() || null;
  try { await reportSheet(); } finally { resume?.(); }
}
async function reportSheet() {
  // The screen as it is now, before the sheet opens over it.
  const card = reportCard?.() || null, title = visibleTitle(), snapshot = screenSnapshot(document.querySelector("main > section:not([hidden])"));
  const screen = {kind: "bug", label: "This screen", title: "Report a problem", quote: title, subject: {type: "screen", id: location.pathname + location.search, text: title, extra: card ? {card: card.id} : {}}};
  const subjects = card ? [{kind: "card", label: card.label || "This card", title: card.title || "Flag this card", quote: card.quote || card.text, lang: "ja", subject: card}, screen] : [screen];
  const result = await openReportSheet({subjects, reasons: REPORT_REASONS, syncLine: reportSyncLine, syncNow: gistSettings().on && autoSync ? () => autoSync.syncNow() : null, history: reportHistory, bindDictation: bindReportDictation, onSubmit: async value => {
    await fileReport(createReport({...value, snapshot, screen: screenOf(location, title), version: await appVersion(), device: deviceInfo()}));
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
// Night Radio's cued-against-held tally (n2-night.js), after the checks it counts.
async function nightLine() {
  const nights = readNights();
  if (!nights.some(n => n?.compare)) return "";
  const data = await report();
  return comparisonLine(nightComparison({nights, recall: data.recall, events: data.events}));
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
  // Another level's paper: fetched once and kept (jlpt-sets.js), saved as
  // "<set>@<edition>" so an old attempt always reopens the paper it sat.
  if (isLevelSet(id)) {
    const level = setLevel(id), kept = version && await access("papers", "get", version);
    if (kept) return kept;
    const edition = version?.split("@")[1] || gameSets.ready(level)?.edition || (await gameSets.index(level))?.edition;
    const set = edition && await gameSets.set(level, id, edition);
    if (!set) throw new Error("This " + level + " paper is not on this device yet. Open Quick round once with a connection.");
    const key = id + "@" + edition, saved = await access("papers", "get", key);
    if (saved) return saved;
    const paper = {id: key, book: id, level, title: level + " · " + String(Number(id.split("-").pop())).padStart(2, "0") + (set.theme ? " · " + set.theme : ""), edition, minutes: LEVEL_EXAM[level].minutes, questions: levelRows(set)};
    await access("papers", "put", paper);
    return paper;
  }
  await materials();
  const key = version || (realistic(id) ? realisticPaperId(id) : id);
  const existing = await access("papers", "get", key);
  if (existing) return existing;
  let rows;
  if (realistic(id) && (!version || version === realisticPaperId(id))) {
    const set = await json(setFile(id));
    const paper = {id: key, book: id, title: titleOf(id), edition: editionOf(id), questions: realisticRows(set)};
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
    card.append(el("div", {class: "stats-figure"}, el("strong", {text: e.total}), el("span", {}, "/ 180 estimated · pass line ", el("b", {text: e.passTotal ?? PASS_TOTAL}))),
      el("span", {class: "status-chip " + (e.pass ? "" : "due"), text: e.pass ? "Above the pass line" : "Below the pass line"}));
  }
  for (const s of e.sections) {
    if (!s.total) continue;
    const max = s.max ?? SECTION_MAX, min = s.min ?? SECTION_MIN;
    const pct = s.scaled === null ? 0 : s.scaled / max * 100;
    card.append(el("div", {class: "n2-section" + (s.ok === false ? " low" : "")},
      el("span", {class: "n2-section-head"}, el("span", {lang: "ja", class: "n2-meter-ja", text: s.ja}), el("span", {text: s.en}),
        el("span", {class: "n2-meter-n", text: s.scaled === null ? "after listening" : s.scaled + " / " + max})),
      el("span", {class: "progress-track n2-section-track"}, el("span", {style: "width:" + pct + "%"}), el("i", {class: "n2-floor", style: "left:" + (min / max * 100) + "%", title: "Section minimum " + min})),
      el("span", {class: "hint", text: s.correct + " of " + s.total + " correct" + (s.ok === false ? " · under the " + min + "-point minimum" : "")})));
  }
  card.append(el("p", {class: "hint", text: (compact ? paper.title + " · " + dateLabel(attempt.completedAt) + ". " : "") + (e.level ? "Raw share of each section. " : "Raw share × 60. ") + "The real test equates scores, so read this as direction, not a prediction."}));
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
// Quick round (n2-game.js): ten fast mixed questions, a timed look at each
// miss, then the next round opens with those misses. It opens straight on a
// question, and every answer is saved as it is given.
const ALOUD = {reading: "Say the sentence out loud", meaning: "Say the word out loud", definition: "Say your pick out loud",
  listen: "Say it back as you hear it", homophone: "Say the sentence out loud", grammar: "Say the sentence out loud", exam: "Read it out loud", connective: "Read it out loud"};
// The beat ribbons (board 4): glyph, title, sub-line and colour per beat.
const BEATS = {hook: ["始", "Welcome back", "An easy start", "right"], first: ["始", "First round", "An easy start", "right"], breather: ["息", "Breather", "", "track"],
  peak: ["峰", "Peak round · bonuses ×2", "The hardest of the wave. Go fast.", "gold"], stretch: ["鬼", "Final stretch", "Bonuses ×2 until the boss opens", "seal"],
  warm: ["復", "Recovery round: things you know", "After a hard round", "right"], jackpot: ["五", "Jackpot", "Five in a row.", "gold"]};
// Game sounds and haptics (docs/design/game, Motion board), made on the
// device: WebAudio, no files, offline. One Sound switch silences them, the
// spoken answer and the vibration.
const sfx = (() => {
  let ctx = null;
  // Report 9221d018: on a phone the effects were all but silent. They were mixed
  // far under the voice, the wrong and timeout notes sat below what a phone
  // speaker can play (110–196 Hz), and Android suspends the context after the
  // voice speaks. So: louder, higher with harmonics, and resumed on every note.
  const LOUD = 3;
  const audio = () => { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state !== "running") ctx.resume?.().catch?.(() => {}); return ctx; };
  const tone = (freq, at, dur, type = "sine", vol = .07, slideTo = 0) => {
    try {
      const c = audio(), t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(Math.min(.3, vol * LOUD), t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
    } catch {}
  };
  const noise = (dur = .02, vol = .05) => {
    try { const c = audio(), b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = c.createBufferSource(), g = c.createGain(); g.gain.value = Math.min(.3, vol * LOUD); s.buffer = b; s.connect(g).connect(c.destination); s.start(); } catch {}
  };
  const C = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319, 1397, 1568, 1760];
  return {
    unlock: () => { try { audio().resume?.(); } catch {} },
    right: streak => tone(523 * 2 ** (Math.min(streak, 12) / 12), 0, .09),
    wrong: () => tone(330, 0, .2, "sawtooth", .05, 196),
    timeout: () => { tone(392, 0, .07, "square", .04); tone(392, .11, .07, "square", .04); },
    idk: () => tone(330, 0, .04, "sine", .05),
    flag: () => noise(.02),
    tick: () => tone(880, 0, .02, "sine", .035),
    // The proved stamp (board 13 · H): a short wood-block click.
    proved: () => { tone(990, 0, .03, "triangle"); tone(660, .035, .06, "triangle"); },
    bonus: () => { tone(1047, 0, .05); tone(1319, .06, .05); },
    jackpot5: () => [523, 659, 784].forEach((f, i) => tone(f, i * .06, .14, "square", .045)),
    jackpot10: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .06, .16, "square", .045)); noise(.3, .02); },
    round: () => C.slice(0, 5).forEach((f, i) => tone(f, i * .07, .14)),
    best: () => { C.slice(0, 5).forEach((f, i) => tone(f, i * .07, .14)); tone(1047, .35, .4); },
  };
})();
const buzz = pattern => { try { navigator.vibrate?.(pattern); } catch {} };
const PAUSE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
const PLAY_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>';
function readGame() { try { return JSON.parse(localStorage.getItem(GAME_KEY) || "{}"); } catch { return {}; } }
// Every save is stamped and marked for the gist sync (the N2 file carries it).
function writeGame(state) { try { localStorage.setItem(GAME_KEY, JSON.stringify({...state, updatedAt: new Date().toISOString()})); markDirty("n2"); } catch {} }
const gameLevels = createLevels();
// Board 13: the parts as a ruled list, the piece in the Mincho, its gloss beside it; repeats as ×2.
const partList = parts => partRows(parts).flatMap(r => [el("b", {lang: "ja"}, r.text, ...(r.times > 1 ? [el("small", {text: "×" + r.times})] : [])), el("span", {text: r.gloss})]);
const RUN_CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
async function game() {
  show("game");
  if (params.get("view") !== "game") history.replaceState(history.state, "", "?view=game");
  await materials();
  const data = await report();
  const sat = new Set(data.attempts.map(a => a.book).filter(id => /^n2-set-\d+$/.test(id || "")));
  const sets = (await Promise.all([...sat].filter(id => themes[id]).map(id => json(setFile(id)).catch(() => null)))).filter(Boolean);
  // The rank's own cards and, under it, the review of lower levels (rankLevels).
  // N2 is built from the app's own files; another level's inventory is fetched
  // once and kept (jlpt-levels.js). A level that cannot be had (offline and
  // never fetched) is left out, and if it is the rank's own, N2 is played.
  const previewGrammar = ["localhost", "127.0.0.1", ""].includes(location.hostname) && params.get("grammar-preview") === "1";
  const [examples, parts, grammarIndex] = await Promise.all([
    deckExamples(), json("./n2-kanji-parts.json").catch(() => null),
    json(previewGrammar ? "./tools/grammar-blocks/draft.json" : "./n2-grammar-blocks.json").catch(() => null),
  ]);
  const activeGrammar = grammarIndex?.version === 1 && (previewGrammar
    || inventory.grammar.every(([key]) => ["clear", "partial", "opaque"].includes(grammarIndex.patterns?.[key]?.transparency)));
  // Authored cards (paraphrase, clause pairs, sentence order) and the English of the papers' sentences: each a file
  // of its own, absent until its content has passed its checks.
  const [paraphrase, pairs, ordering, examEn, wordPieces, gapWrong] = await Promise.all(["./n2-paraphrase.json", "./n2-pairs.json", "./n2-ordering.json", "./n2-sets/en.json", "./n2-word-pieces.json", "./n2-gap-wrong.json"].map(f => json(f).catch(() => null)));
  const extras = {paraphrase: paraphrase?.items || [], pairs: pairs?.items || [], ordering: ordering?.items || [], pieces: wordPieces?.pieces || {}, gapWrong: gapWrong?.wrong || {}};
  const n2Cards = gamePool({inventory, examples, sets, sat, parts, grammarBlocks: activeGrammar ? grammarIndex : null, extras});
  const grammarCards = n2Cards.filter(grammarBlockCard), n2Pool = n2Cards.filter(q => !grammarBlockCard(q));
  const levelPools = new Map([["N2", n2Pool]]);
  // The last boss's misses (bossCards): wrong or unsure answers of the latest
  // N2 boss sat on the current edition of its paper, as cards for the rounds.
  const lastBoss = data.attempts.filter(a => a.boss && a.phase === "results" && sat.has(a.book) && a.paper === realisticPaperId(a.book)).sort((a, b) => (a.completedAt || "").localeCompare(b.completedAt || "")).at(-1);
  const bossPaper = lastBoss && sets.find(set => set.id === lastBoss.book);
  const bossKeys = (await json("./n2-sets/keys.json").catch(() => null))?.keys || {};
  // The mix follows the last boss: the section missed most takes more turns of a round, the strong one fewer.
  const n2KanjiOrder = kanjiOrderOf(n2Pool);
  const mixWeights = kindWeights(bossPaper ? skillWeights({paper: bossPaper, attempt: lastBoss}) : null);
  const bossAll = bossPaper ? bossCards({set: bossPaper, pool: n2Pool, keys: bossKeys,
    missed: bossPaper.questions.map((q, i) => lastBoss.answers?.[i] !== q.key || lastBoss.guesses?.[i] ? i : -1).filter(i => i >= 0)}) : [];
  // kanjiFirst: the rank's kanji in order and, as examples, the cards of the other levels at hand.
  let pool = n2Pool, lower = [], missing = [], kanjiFirst = null, rankKanji = "", bossIds = [], bossLevels = ["N2"];
  async function loadRank() {
    const {level, review} = rankLevels(rankOf(readGame())), wanted = [level, ...review];
    const pools = await Promise.all(wanted.map(async l => {
      if (!levelPools.has(l)) { const inv = await gameLevels.inventory(l); if (inv) levelPools.set(l, gamePool({inventory: inv, level: l})); }
      return levelPools.get(l) || null;
    }));
    missing = wanted.filter((_, i) => !pools[i]);
    // The rank's boss papers: N2's are part of the app; another level's are
    // listed now and fetched whole in the background, so the boss never needs
    // the network when it arrives. A level with no papers yet has no boss.
    // Which levels have papers to sit: the rank only moves to one of these.
    bossLevels = (await Promise.all(RANKS.map(async l => l === "N2" || Object.keys((await gameSets.index(l))?.sets || gameSets.ready(l)?.sets || {}).length ? l : null))).filter(Boolean);
    if (level === "N2") bossIds = bookIds.filter(id => realistic(id));
    else { bossIds = Object.keys((await gameSets.index(level))?.sets || gameSets.ready(level)?.sets || {}); gameSets.keep(level).catch(() => {}); }
    pool = pools[0] || n2Pool; lower = pools[0] ? pools.slice(1).filter(Boolean).flat() : [];
    // Levels of word cards are played kanji first; N2, with its grammar and exam cards, as it always was.
    rankKanji = (await gameLevels.ready())?.kanji?.[pools[0] ? level : "N2"] || "";
    kanjiFirst = pools[0] && level !== "N2" && rankKanji ? {order: rankKanji, examples: [...lower, ...n2Pool.filter(q => q.kanji)]} : null;
    // The rank's words nearly all met: the level above joins the review places as a preview.
    const ahead = aheadLevel(level);
    if (pools[0] && ahead && isCovered(levelCoverage(pool, readGame()))) {
      if (!levelPools.has(ahead)) { const inv = await gameLevels.inventory(ahead); if (inv) levelPools.set(ahead, gamePool({inventory: inv, level: ahead})); }
      lower = [...lower, ...(levelPools.get(ahead) || [])];
    }
  }
  await loadRank();
  let askToken = 0, practiced = 0, roundLevel = .5, rights = 0, flagged = 0, warmUp = false, beat = null, state = readGame(), round = [], index = 0, score = 0, streak = 0, bestCombo = 0, timer = null, ticker = null, shownAt = 0, current = null, locked = false, misses = [], marks = [];
  const bar = $("game-bar"), root = $("game");
  const sound = () => readGame().sound !== false;
  const difficulty = () => difficultyOf(settings.gameDifficulty);
  const mode = m => { root.dataset.mode = m; $("game-rank").hidden = m !== "home"; if (m !== "done") { root.dataset.best = "false"; root.dataset.late = "false"; } if (m !== "review") root.dataset.held = "false"; for (const [id, on] of [["game-home", "home"], ["game-settings", "settings"], ["game-radio", "radio"], ["game-play", "play"], ["game-review", "review"], ["game-done", "done"]]) $(id).hidden = m !== on; };
  // The game's own settings, inside the game (owner, 26 Nov): leaving for
  // Echo's Settings pulled the player out of the app. They write the same
  // keys Echo's Settings does (jp-echo-settings), each on change.
  // Board 11 · B: Settings, pushed from Home. Switches and segments save on change.
  const setSwitch = (id, on) => $(id).setAttribute("aria-pressed", String(!!on));
  const setSeg = (id, value) => { for (const b of $(id).querySelectorAll("button")) b.setAttribute("aria-checked", String(b.dataset.value === String(value))); };
  function gameSettings() {
    mode("settings"); $("game-title").textContent = "Settings";
    $("game-back").href = "?view=game"; $("game-back").setAttribute("aria-label", "Back to Quick round home"); $("game-back").onclick = e => { e.preventDefault(); home(); };
    setSeg("game-set-rank", rankOf(readGame())); setSeg("game-set-difficulty", difficulty()); $("game-set-bedtime").value = settings.gameBedtime || "23:30";
    setSwitch("game-set-sound", sound()); setSwitch("game-set-start", !!settings.startGame); $("game-set-status").textContent = "";
    checkUpdate();
  }
  const savePreference = (key, value) => {
    settings[key] = value;
    try { const stored = JSON.parse(localStorage.getItem("jp-echo-settings") || "{}"); stored[key] = value; localStorage.setItem("jp-echo-settings", JSON.stringify(stored)); $("game-set-status").textContent = ""; }
    catch { $("game-set-status").textContent = "Not saved: this browser blocked storage."; }
  };
  const setSound = on => { const st = readGame(); st.sound = !!on; writeGame(st); soundButton(); setSwitch("game-set-sound", on); };
  $("game-settings-open").onclick = gameSettings;
  // Board 11 · C: Radio, pushed from Home; D: the night screen, black in both themes.
  let nightCue = 0, nightEnd = 0;
  const nightPlayer = new RadioPlayer({onState: (at, item) => {
    const copy = RADIO_PHASE_COPY[at.phase] || {title: "", line: ""};
    $("game-night-phase").textContent = copy.title + (at.phase === "cues" ? " · cues" : "");
    $("game-night-text").textContent = item ? String(item.target).replace(/【[^】]*】/g, "") : copy.line;
    if (item && at.phase === "cues") nightCue++;
    $("game-night-cue").textContent = item && at.phase === "cues" ? "cue " + nightCue + " · " + (tonight?.cued.length || 0) + " sentences tonight" : "";
    $("game-night-clock").textContent = at.phase === "done" ? "" : "Until " + clockAt(nightEnd);
  }, onDone: () => stopNight()});
  const nightNoise = new NoiseBed();
  let nightWake = null, tonight = null;
  async function radioPanel() {
    mode("radio"); $("game-title").textContent = "Radio";
    $("game-back").href = "?view=game"; $("game-back").setAttribute("aria-label", "Back to Quick round home"); $("game-back").dataset.end = "false"; $("game-back").onclick = e => { e.preventDefault(); home(); };
    const hours = Number(settings.radioHours) || RADIO_DEFAULTS.hours, dayMode = readDay().mode === "recall" ? "recall" : "listen";
    setSeg("game-day-mode", dayMode); $("game-day-start").href = $("game-day-start").dataset[dayMode];
    setSeg("game-night-hours", hours); setSwitch("game-night-noise", settings.radioNoise !== false); setSwitch("game-night-compare", settings.radioCompare !== false);
    const examples = await deckExamples();
    tonight = nightPlan({inventory, recall: data.recall, evidence: scored(data), events: data.events, examples, compare: settings.radioCompare !== false});
    $("game-night-count").textContent = tonight.cued.length ? tonight.cued.length + " tonight" + (tonight.compare ? " · " + tonight.held.length + " held back for tomorrow’s comparison" : "") : "Nothing from today yet: play a few rounds first.";
    const left = eveningRecall({inventory, recall: data.recall, evidence: scored(data), events: data.events, examples}).length;
    $("game-night-evening").hidden = !left; $("game-night-evening-label").textContent = "Evening recall first · " + left + " item" + (left === 1 ? "" : "s");
    $("game-night-start").disabled = !tonight.cued.length;
    $("game-night-until").textContent = tonight.cued.length ? "Until " + clockAt(Date.now() + hours * 3600_000) + " · keep the phone on its charger, screen on" : "Play a few rounds first";
  }
  function startNight() {
    if (!tonight?.cued.length) return;
    const hours = Number(settings.radioHours) || RADIO_DEFAULTS.hours, plan = radioPlan({hours});
    if (settings.radioNoise !== false) nightNoise.start();
    nightCue = 0; nightEnd = Date.now() + hours * 3600_000; $("game-night").hidden = false;
    nightPlayer.start(tonight.cued, {steps: radioSteps, phaseAt: elapsed => radioPhase(elapsed, plan), voiceFor: lang => lang === "ja" ? voice() : null, rate: Math.min(1, Number(settings.rate) || 1)});
    try { localStorage.setItem(NIGHT_KEY, JSON.stringify(keepNight(readNights(), nightRecord(tonight)))); markDirty("n2"); } catch {}
    navigator.wakeLock?.request("screen").then(w => { nightWake = w; }).catch(() => {});
  }
  function stopNight() { nightPlayer.stop(); nightNoise.stop(); try { nightWake?.release(); } catch {} nightWake = null; $("game-night").hidden = true; }
  $("game-radio-open").onclick = radioPanel;
  // Starting the Night Radio ends the rest: Home is the game again when you come back.
  $("game-home-radio").onclick = () => { writeGame(endRest(readGame())); radioPanel(); };
  $("game-night-start").onclick = startNight;
  $("game-night-stop").onclick = stopNight;
  const segClick = (id, fn) => { for (const b of $(id).querySelectorAll("button")) b.onclick = () => { setSeg(id, b.dataset.value); fn(b.dataset.value); }; };
  const switchClick = (id, fn) => { $(id).onclick = () => { const on = $(id).getAttribute("aria-pressed") !== "true"; setSwitch(id, on); fn(on); }; };
  segClick("game-day-mode", v => { $("game-day-start").href = $("game-day-start").dataset[v]; });
  segClick("game-night-hours", v => { savePreference("radioHours", Number(v)); $("game-night-until").textContent = "Until " + clockAt(Date.now() + Number(v) * 3600_000) + " · keep the phone on its charger, screen on"; });
  switchClick("game-night-noise", on => savePreference("radioNoise", on));
  switchClick("game-night-compare", on => { savePreference("radioCompare", on); radioPanel(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && nightPlayer.running) navigator.wakeLock?.request("screen").then(w => { nightWake = w; }).catch(() => {}); });
  segClick("game-set-difficulty", v => savePreference("gameDifficulty", difficultyOf(v)));
  // The rank, set by hand until the owner fixes how it is won and lost.
  segClick("game-set-rank", async v => { writeGame(setRank(readGame(), v)); await loadRank(); $("game-set-status").textContent = missing.includes(v) ? v + " needs a connection once. Playing N2 until then." : ""; });
  $("game-set-bedtime").onchange = e => savePreference("gameBedtime", e.target.value || "23:30");
  switchClick("game-set-start", on => savePreference("startGame", on));
  switchClick("game-set-sound", on => setSound(on));
  // Board 11: Report a problem opens Echo's report sheet (bugs that aren't one card).
  $("game-set-report").onclick = () => openReport();
  const pips = (host, n = round.length) => host.replaceChildren(...Array.from({length: n || 10}, (_, i) => el("i", {class: marks[i] || (host.id === "game-pips" && i === index ? (round[i]?.practice ? "pr" : "now") : "")})));
  const head = () => {
    $("game-score").textContent = num(score); $("game-score").dataset.neg = String(score < 0);
    // Under the score: the round before the first answer, then the combo; a chip from three in a row.
    const chip = $("game-combo-chip"), answered = marks.some(Boolean);
    const text = streak >= 10 ? "×2 · max" : streak >= 3 ? "×" + (1 + streak / 10).toFixed(1) + " · " + streak + " in a row" : streak >= 1 ? "×" + (1 + streak / 10).toFixed(1) + " combo" : answered ? "combo 0" : "round " + ((state.rounds || 0) + 1);
    chip.className = streak >= 3 ? "qr-chip" : "qr-cb"; chip.dataset.tone = streak >= 10 ? "goldfill" : streak >= 3 ? "right" : "";
    if (text !== chip.textContent) { chip.textContent = text; chip.classList.remove("bump"); void chip.offsetWidth; if (streak >= 2) chip.classList.add("bump"); }
    pips($("game-pips"));
  };
  // The points float takes the combo line's slot for 400 ms, then the line comes back.
  const floatText = (text, kind) => { const f = $("game-float"), w = f.parentElement; f.textContent = text; f.className = "qr-float " + kind; void f.offsetWidth; f.classList.add("go"); w.dataset.float = "true"; clearTimeout(floatText.t); floatText.t = setTimeout(() => { w.dataset.float = "false"; f.classList.remove("go"); }, 400); };
  const floatPoints = (points, kind) => floatText(points > 0 ? "+" + points.toLocaleString() : points < 0 ? num(points) : "±0", kind);
  const ribbon = (key, title, sub) => { const r = $("game-ribbon"), b = BEATS[key]; r.hidden = !b; if (!b) return; r.dataset.key = key; r.dataset.tone = b[3]; $("game-ribbon-glyph").textContent = b[0]; $("game-ribbon-title").textContent = title || b[1]; $("game-ribbon-sub").textContent = sub ?? b[2]; };
  // The last 50 before the boss: a countdown joins the head (board 4).
  const stretchStrip = () => { const left = bossProgress(readGame()).left, on = left > 0 && left <= 50; $("game-stretch").hidden = !on; if (on) { $("game-stretch-fill").style.width = (50 - left) / 50 * 100 + "%"; $("game-stretch-left").textContent = "in " + left; } };
  const toast = (text, note = "") => { const t = $("game-toast"); $("game-toast-text").textContent = text; $("game-toast-note").textContent = note; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 1400); };
  // The boss: every 1,000 questions, a full mock on a set not sat yet.
  // The boss is a mock of the rank's level; only N2 has sets today (hasBoss).
  const bossRank = () => rankOf(readGame());
  const bossNow = () => hasBoss(bossRank()) && bossIds.length ? bossSet({sets: bossIds, attempts: data.attempts, ...(bossRank() === "N2" ? {} : {held: heldOut(bossRank()), prefix: bossRank().toLowerCase() + "-set-"})}) : null;
  // The boss's name and clocks: N2's as they were; another level's from its own paper.
  const mockName = boss => bossRank() === "N2" ? "Mock " + String(bookIds.indexOf(boss.id) + 1).padStart(2, "0") : bossRank() + " paper " + String(bossIds.indexOf(boss.id) + 1).padStart(2, "0");
  const bossClock = () => bossRank() === "N2" ? BOSS_MINUTES : {written: Math.ceil(LEVEL_EXAM[bossRank()].minutes.written / 2), listening: LEVEL_EXAM[bossRank()].minutes.listening};
  // The run closes when the boss sitting actually starts (exam(), with its attempt id), not on this tap.
  const fightBoss = (e, boss) => { e.preventDefault(); location.href = "?book=" + boss.id + "&boss=1"; };
  // Numbers below zero carry a true minus (U+2212), never a hyphen (board 12 · E–F).
  const num = n => (n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString();
  const clockText = st => { const c = runClock(st.runStart), h = Math.floor(c.leftMs / 3600_000), m = Math.floor(c.leftMs % 3600_000 / 60_000); return c.times > 1 ? "×" + c.times + " · " + h + " h " + String(m).padStart(2, "0") + " m left" : "×1 · run bonus over"; };
  // The run clock is live on Home: the chip's time left and the countdown tick
  // every second, and Home redraws when the clock changes tier or state.
  let homeTick = null, homeView = null;
  const countShown = (clock, v) => clock.started && clock.times > 1 && clock.leftMs < 6 * 3600_000 && !v.rest && !v.open;
  const paintClock = () => {
    const st = readGame(), clock = runClock(st.runStart), v = homeView;
    const waiting = v.rest || !clock.started;
    if (!v.cover) $("game-run-clock").textContent = waiting ? "clock starts on your " + (v.first ? "first" : "next") + " answer" : v.stretch ? v.left + " to the boss" : clockText(st);
    if (!v.cover) $("game-run-clock").dataset.tone = waiting ? "" : v.stretch ? "plain" : "seal";
    $("game-boss-clock2").textContent = clockText(st);
    const show = countShown(clock, v);
    if (show) {
      const t = Math.floor(clock.leftMs / 1000);
      $("game-count-label").textContent = "×" + clock.times + " ends in";
      $("game-count-time").textContent = Math.floor(t / 3600) + ":" + String(Math.floor(t % 3600 / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
      $("game-tier-a").className = clock.times === 1.5 ? "on" : ""; $("game-tier-b").className = clock.times === 1.2 ? "on" : ""; $("game-tier-c").className = "";
    }
    return [clock.started, clock.times, show].join();
  };
  const began = iso => { const d = new Date(iso), days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400_000);
    return (days === 0 ? "today" : days === 1 ? "yesterday" : "on " + d.toLocaleDateString("en-GB", {day: "numeric", month: "short"})) + " at " + clockAt(d.getTime()); };
  // Home (fix 12): the run card, best runs, 14 days, then Play in the thumb zone.
  function home() {
    clearTimeout(timer); clearInterval(ticker); window.speechSynthesis?.cancel(); askToken++;
    mode("home"); $("game-sub").textContent = ""; $("game-sub-right").textContent = ""; $("game-score").textContent = ""; $("game-combo-chip").textContent = "";
    // Board 11 · A: back to Echo's last screen, or Echo's start when Echo opened straight here.
    $("game-back").href = "./"; $("game-back").setAttribute("aria-label", "Back to Echo"); $("game-back").dataset.end = "false"; $("game-title").textContent = "Quick round";
    $("game-back").onclick = e => { e.preventDefault(); if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin && !/n2-mock\.html\?view=game/.test(document.referrer)) history.back(); else location.href = "./"; };
    const papersById = new Map(data.papers.map(p => [p.id, p]));
    const bossSitting = run => (run.attemptId && data.attempts.find(x => x.id === run.attemptId && x.phase === "results"))
        || data.attempts.filter(x => x.book === run.set && x.boss && x.phase === "results" && (x.startedAt || "") >= run.at).sort((x, y) => (x.startedAt || "").localeCompare(y.startedAt || ""))[0];
    const examOf = run => {
      const a = bossSitting(run);
      const paper = a && papersById.get(a.paper || a.book);
      return paper ? {...estimate(paper, a), completedAt: a.completedAt} : null;
    };
    // The gate: each finished boss gives its verdict once, and may move the rank
    // (applyBoss). Runs from before the rules (no rank on them) are left alone.
    let st = readGame(), moved = false;
    for (const run of st.runs || []) {
      const exam = run.rank && !(st.bossLog || []).some(e => e.key === run.at) ? examOf(run) : null;
      if (!exam?.complete) continue;
      const next = applyBoss(st, {key: run.at, rank: run.rank, total: exam.total, sectionsOk: exam.sections.every(x => x.ok), levels: bossLevels});
      if (next !== st) { moved = moved || rankOf(next) !== rankOf(st); st = next; writeGame(st); }
    }
    if (moved) { loadRank().then(home); return; }
    const b = bossProgress(st), boss = bossNow(), rest = resting(st, data.attempts), open = b.open && !!boss;
    const all = st.runs || [], runNo = all.length + 1, clock = runClock(st.runStart);
    const stretch = b.done >= 950 && !open && !rest, first = !all.length && !clock.started && !b.done;
    // A rank with no boss yet: the run card shows how much of the level is known.
    // The count is kanji, not words (owner, 26 Nov); words only if the kanji list could not be had.
    const byKanji = !boss && !missing.includes(rankOf(st)) && rankKanji ? kanjiCoverage(rankKanji, st) : null;
    const cover = byKanji ? {...byKanji, seen: byKanji.met, unit: "kanji"} : !boss && !missing.includes(rankOf(st)) ? {...levelCoverage(pool, st), unit: "words"} : null;
    homeView = {open, rest, stretch, first, left: BOSS_EVERY - b.done, cover: !!cover};
    const showCount = countShown(clock, homeView), mockNo = boss ? mockName(boss) : "", clocks = bossClock();
    // Run card (board 1 · Home A/D), the boss card (B) or the rest above a quiet card (C).
    $("game-runcard").hidden = open; $("game-bosscard").hidden = !open; $("game-rest").hidden = !rest; $("game-runcard").dataset.rest = String(rest); $("game-runcard").dataset.first = String(first);
    $("game-run-name").textContent = "Run " + runNo + (stretch ? " · final stretch" : "");
    $("game-run-big").textContent = b.done.toLocaleString();
    $("game-run-of").textContent = stretch ? "of " + BOSS_EVERY.toLocaleString() : "of " + BOSS_EVERY.toLocaleString() + " to the boss";
    $("game-run-fill").style.width = b.done / BOSS_EVERY * 100 + "%";
    $("game-run-fill").parentElement.classList.toggle("qr-meter-seal", stretch);
    const points = (st.total || 0) - (st.runFrom || 0);
    $("game-run-row").hidden = !rest && (stretch || showCount || first);
    $("game-run-points").textContent = rest ? b.done.toLocaleString() + " of " + BOSS_EVERY.toLocaleString() : num(points) + " points so far";
    $("game-run-points").dataset.neg = String(!rest && points < 0);
    $("game-run-waits").textContent = boss && !rest ? mockNo + " waits" : "";
    // The run clock, live, in the last hours of a bonus (board 1 · D).
    $("game-countdown").hidden = !showCount;
    $("game-run-line").textContent = stretch ? "About " + Math.ceil((BOSS_EVERY - b.done) / 10) + " rounds, then a " + (clocks.written + clocks.listening) + "-minute boss." + (st.runStart ? " Run " + runNo + " began " + began(st.runStart) + "." : "")
      : first && boss ? "At " + BOSS_EVERY.toLocaleString() + " the boss opens: " + mockNo + ", written at half time." : "";
    root.querySelector("#game-runcard .qr-oni").hidden = !!cover;
    if (cover) {
      $("game-run-name").textContent = rankOf(st) + " " + cover.unit; $("game-run-clock").textContent = "practice · not scored"; $("game-run-clock").dataset.tone = "";
      $("game-run-big").textContent = cover.known.toLocaleString(); $("game-run-of").textContent = "of " + cover.items.toLocaleString() + " known";
      $("game-run-fill").style.width = cover.known / cover.items * 100 + "%";
      $("game-run-row").hidden = false; $("game-run-points").textContent = cover.seen.toLocaleString() + " met"; $("game-run-points").dataset.neg = "false"; $("game-run-waits").textContent = "no " + rankOf(st) + " boss yet";
      $("game-countdown").hidden = true; $("game-run-line").textContent = "";
    }
    // Board 13 · I: one "Known" strip under the run card, from the first proved piece (never "0 of 162").
    const grammar = rankOf(st) === "N2" ? grammarCoverage(n2Cards, st) : {items: 0, known: 0};
    $("game-known").hidden = !grammar.known;
    $("game-known-fill").style.width = grammar.items ? grammar.known / grammar.items * 100 + "%" : "0";
    $("game-known-count").replaceChildren(String(grammar.known), el("span", {text: " / " + grammar.items}));
    if (open) {
      $("game-boss-name").textContent = "Run " + runNo + " · boss open";
      $("game-boss-title").textContent = mockNo + " at half time";
      $("game-boss-mins").textContent = clocks.written + " min written · " + clocks.listening + " min listening";
      $("game-boss-points").textContent = BOSS_EVERY.toLocaleString() + " / " + BOSS_EVERY.toLocaleString() + " · " + num(points) + " points";
      $("game-boss-note").textContent = clock.times > 1 ? "Beat it before the clock runs out and the whole run counts ×" + clock.times + "." : "";
    }
    // Best runs: the merged score ranks them; each keeps both parts.
    const runs = runTable(st, examOf), latest = all.at(-1);
    // Board 1 · C: the run that just closed, its time, score and place.
    const closed = rest && latest ? runs.findIndex(r => r.at === latest.at) : -1, closedRun = runs[closed];
    $("game-rest-line").textContent = closedRun?.exam ? "Run " + all.length + " closed at " + clockAt(Date.parse(closedRun.exam.completedAt || closedRun.at)) + ": " + num(closedRun.total) + (["", ", second best", ", third best"][closed] ?? "") + ". The night keeps today’s work."
      : "The boss is down. The night keeps today’s work.";
    // Boards 1 · D has the run card alone; B and C keep two runs and no chart.
    const focus = showCount || stretch;
    $("game-runs-wrap").hidden = focus; $("game-runs-note").hidden = open || rest || !runs.length; $("game-runs-wrap").dataset.empty = String(!runs.length);
    // A run whose boss is finished opens that sitting's results: every question, the answer and why (owner, 27 Nov).
    $("game-runs").replaceChildren(...(runs.length ? runs.slice(0, open || rest ? 2 : 3).map((r, i) => {
      const no = all.findIndex(x => x.at === r.at) + 1, sitting = r.exam && bossSitting(r);
      const row = el(sitting ? "a" : "div", {class: "qr-rk", href: sitting ? "?book=" + encodeURIComponent(sitting.book) + "&attempt=" + encodeURIComponent(sitting.id) : undefined, "aria-label": sitting ? "Run " + no + ": review the boss, " + num(r.total) + " points" : undefined},
        el("span", {class: "p", text: String(i + 1)}), el("span", {text: "Run " + no}),
        ...(r.exam ? [rest && r.at === latest?.at ? el("span", {class: "qr-chip", "data-tone": "gold", text: "new"}) : el("span", {class: "qr-chip", "data-tone": r.times > 1 ? "seal" : "", text: "×" + r.times})] : [el("span", {class: "qr-tiny", text: "boss not finished"})]),
        // The row says what a tap does (owner, 27 Nov): it opens the boss review.
        ...(sitting ? [el("span", {class: "qr-tiny qr-rkgo", text: "Boss review"})] : []),
        el("span", {class: "v", text: num(r.total)}));
      if (sitting) row.insertAdjacentHTML("beforeend", RUN_CHEVRON);
      // The run opens its boss review; with nothing missed, or no paper at hand, the link's own results page.
      if (sitting) row.onclick = e => { const paper = papersById.get(sitting.paper || sitting.book); if (paper && startPaperReview(sitting, paper)) e.preventDefault(); };
      return row; })
      : [el("div", {class: "qr-rkempty", text: "Your first run lands here once its boss falls."})]));
    // The last 14 days, as bars against the 1,000 line; dashed outlines before the first day (board 12 · D).
    const days = lastDays(st, 14), top = Math.max(DAILY_GOAL * 1.2, ...days.map(d => d.answered)), none = days.every(d => !d.answered);
    $("game-days-wrap").hidden = focus || open || rest; $("game-days-wrap").dataset.empty = String(none);
    $("game-days-label").textContent = none ? "Last 14 days · goal " + DAILY_GOAL.toLocaleString() + " a day" : "Last 14 days · questions";
    $("game-today").textContent = none ? "starts today" : "today " + (days.at(-1)?.answered || 0).toLocaleString();
    $("game-days").replaceChildren(...(none ? days.map((d, i) => el("i", {class: i === days.length - 1 ? "today" : ""}))
      : [el("u", {style: "bottom:" + Math.round(DAILY_GOAL / top * 36) + "px"}),
        ...days.map(d => el("i", {class: d.answered >= DAILY_GOAL ? "full" : "", style: "height:" + Math.max(2, Math.round(d.answered / top * 36)) + "px", title: d.day + ": " + d.answered}))]));
    // The rank, then what it means today, then the difficulty when it isn't Normal.
    const rank = rankOf(st), own = !missing.includes(rank);
    // The rank is a seal chip beside the title; the line under the chart keeps the notes.
    $("game-rank").textContent = rank; $("game-rank").setAttribute("aria-label", "Rank " + rank);
    // The last boss by section (owner's backlog): where the points are, at a glance. Below its minimum, a section says so.
    const lastRun = [...(st.runs || [])].reverse().map(run => examOf(run)).find(e => e?.complete);
    $("game-home-sections").hidden = !lastRun;
    if (lastRun) $("game-home-sections").textContent = "Last boss · " + lastRun.sections.map(s => (s.short || s.ja || s.label || s.name) + " " + s.scaled + "/" + (s.max ?? SECTION_MAX) + (s.ok === false ? " (under " + (s.min ?? SECTION_MIN) + ")" : "")).join(" · ");
    $("game-home-level").textContent = [!own ? rank + " needs a connection once: playing N2" : pool.every(q => q.practice) ? "practice, not scored yet" : "", verdictLine((st.bossLog || []).at(-1)),
      difficulty() === "normal" ? "" : DIFFICULTY[difficulty()].label].filter(Boolean).join(" · ") + (own && !pool.every(q => q.practice) && difficulty() === "normal" && !(st.bossLog || []).length ? "" : " · change in Settings");
    // The dock: one big button, then the pair (boards 1 · A–D).
    $("game-home-boss").hidden = !open; $("game-home-radio").hidden = !rest || open; $("game-home-play").hidden = open || rest;
    $("game-home-play2").hidden = !open; $("game-home-play3").hidden = !rest || open;
    const kept = readRound();
    $("game-home-play").querySelector("b").lastChild.textContent = kept ? "Resume round" : "Play";
    $("game-play-pips").hidden = !kept; if (kept) $("game-play-pips").replaceChildren(...kept.round.map((_, i) => el("i", {class: i < kept.index ? "on" : ""})));
    $("game-play-sub").textContent = kept ? kept.index + " of " + kept.round.length + " · " + num(kept.score) + " points" : stretch ? "Final stretch · bonuses doubled" : "10 questions · about a minute";
    if (open) $("game-home-boss").onclick = e => fightBoss(e, boss);
    $("game-radio-open").hidden = rest && !open;
    soundButton();
    let key = paintClock();
    clearInterval(homeTick);
    homeTick = setInterval(() => { if (root.dataset.mode !== "home") { clearInterval(homeTick); return; } if (paintClock() !== key) home(); }, 1000);
  }
  // Which version is running, and whether a newer one is waiting (owner, 26 Nov:
  // "very hard to know if I got an update"). The N2 page never offered updates:
  // Echo's "Update now" lives on its own screens, and "Open Echo on Quick round"
  // skips them. Home shows one line when an update is ready, Settings shows the
  // version; the update is applied only on a tap, never during a round.
  const short = v => String(v || "").replace("jp-echo-", "");
  let registration = null, updateState = "", checkedAt = 0, latest = "";
  const paintVersion = async () => {
    const running = await appVersion(), waiting = registration?.waiting, busy = registration?.installing;
    $("game-version").textContent = short(running) || "not installed";
    $("game-version-line").textContent = waiting ? (latest && latest !== running ? short(latest) + " is ready: tap to update" : "An update is ready: tap to update")
      : busy ? "Downloading " + (short(latest) || "the update") + "…" : updateState === "checking" ? "Checking…" : updateState === "offline" ? "Couldn’t check: no connection"
      : checkedAt ? "Up to date · checked at " + clockAt(checkedAt) : "Tap to check for an update";
    $("game-update").hidden = !waiting; $("game-update-text").textContent = latest && latest !== running ? "Version " + short(latest).slice(1) + " is ready. You have " + short(running).slice(1) + "." : "A new version is ready.";
  };
  const applyUpdate = () => { const waiting = registration?.waiting; if (!waiting) return false; navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), {once: true}); waiting.postMessage("echo:activate-update"); return true; };
  const checkUpdate = async (force = false) => {
    if (!("serviceWorker" in navigator)) return;
    try {
      registration ||= await navigator.serviceWorker.getRegistration();
      if (!registration) { paintVersion(); return; }
      if (!registration.echoWatched) { registration.echoWatched = true; registration.addEventListener("updatefound", () => { registration.installing?.addEventListener("statechange", paintVersion); paintVersion(); }); }
      if (force || Date.now() - checkedAt > 5 * 60_000) {
        updateState = "checking"; paintVersion();
        try { await registration.update(); latest = (await (await fetch("./sw.js", {cache: "no-store"})).text()).match(/CACHE="(jp-echo-v\d+)"/)?.[1] || ""; updateState = ""; checkedAt = Date.now(); }
        catch { updateState = "offline"; }
      }
    } catch {}
    paintVersion();
  };
  $("game-update-now").onclick = () => { $("game-update-now").disabled = true; applyUpdate(); };
  $("game-set-version").onclick = () => { if (!applyUpdate()) checkUpdate(true); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && root.dataset.mode === "home") checkUpdate(); });
  checkUpdate();
  // Board 11 · A: the one Sound switch, a quiet icon in Home's head; seal when off.
  const soundButton = () => { const on = sound(); $("game-sound").setAttribute("aria-pressed", String(on)); $("game-sound").setAttribute("aria-label", on ? "Sound on" : "Sound off"); };
  $("game-sound").onclick = () => setSound(!sound());
  // The clock (fix 2): a 14 px bar with tenths beside it; seal in the last
  // second, gold on a bonus.
  const runBar = (seconds, {gold = false, review = false} = {}) => {
    bar.style.transition = "none"; bar.style.width = "100%"; void bar.offsetWidth; bar.style.transition = "width " + seconds + "s linear"; bar.style.width = "0%";
    const clock = $("game-clock"), end = performance.now() + seconds * 1000; let ticked = new Set();
    clock.dataset.state = gold ? "gold" : "";
    clearInterval(ticker);
    ticker = setInterval(() => {
      const left = Math.max(0, end - performance.now()) / 1000;
      $("game-sec").textContent = left.toFixed(1);
      if (!review && left <= 1 && !gold) clock.dataset.state = "hot";
      for (const mark of [1, .5]) if (!review && left <= mark && !ticked.has(mark) && sound()) { ticked.add(mark); sfx.tick(); }
      if (left <= 0) clearInterval(ticker);
    }, 100);
  };
  const stopBar = state => { clearInterval(ticker); const w = getComputedStyle(bar).width; bar.style.transition = "none"; bar.style.width = w; if (state) $("game-clock").dataset.state = state; };
  const rememberOpenPattern = () => {
    if (!current?.blocks?.length || locked || $("game-play").hidden || current.kind === "block") return;
    const st = readGame();
    if (!Object.hasOwn(st.seen || {}, current.id)) writeGame({...st, seen: {...st.seen, [current.id]: Date.now()}});
  };
  window.addEventListener("pagehide", rememberOpenPattern);
  function start() {
    sfx.unlock();
    // During a round the top-left chevron goes back to Home (board 2 · "Back to home").
    $("game-back").href = "?view=game"; $("game-back").setAttribute("aria-label", "Back to home"); $("game-back").dataset.end = "false";
    $("game-back").onclick = e => { e.preventDefault(); rememberOpenPattern(); window.speechSynthesis?.cancel(); home(); };
    state = readGame();
    // An interrupted round goes on where it stopped (board 12 · B): no choice offered.
    const kept = readRound();
    if (kept) {
      ({round, index, score, streak, bestCombo, marks, rights, flagged, practiced, roundLevel, warmUp, beat, misses, ups} = kept);
      mode("play"); ask(); return;
    }
    // Listen cards leave the mix when nothing can be heard: the sound is off, the
    // phone has no Japanese voice, or the voice failed twice this session.
    const playable = hears() ? pool : pool.filter(q => q.kind !== "listen");
    const review = hears() ? lower : lower.filter(q => q.kind !== "listen");
    const next = nextRound({pool: playable, review, kanji: kanjiFirst && {...kanjiFirst, examples: hears() ? kanjiFirst.examples : kanjiFirst.examples.filter(q => q.kind !== "listen")}, recall: data.recall, state, difficulty: difficulty(), weights: pool === n2Pool ? mixWeights : null, kanjiOrder: pool === n2Pool ? n2KanjiOrder : "", grammarCards: pool === n2Pool && grammarCards.length ? grammarCards : null,
      boss: pool === n2Pool ? bossQueue({cards: bossAll, state, key: lastBoss?.id || ""}).filter(q => hears() || q.kind !== "listen") : []});
    round = next.round; roundLevel = next.level; warmUp = next.warmUp; beat = next.beat || null; rights = 0; flagged = 0; practiced = 0; bestCombo = 0;
    index = 0; score = 0; streak = 0; misses = []; marks = []; ups = []; roundFlags = [];
    mode("play");
    ask();
  }
  let listenFails = 0, voiceWait = false, ups = [];
  const hears = () => sound() && japaneseVoices("ja").length > 0 && listenFails < 2;
  // The round in progress, kept on this device so a closed app or a trip Home
  // doesn't lose it. Dropped after 30 minutes, at the round's end, or if a
  // question has left the pool.
  const ROUND_KEY = "echo-n2-round", ROUND_KEEP_MS = 30 * 60_000;
  const saveRound = () => { try { localStorage.setItem(ROUND_KEY, JSON.stringify({at: Date.now(), index, score, streak, bestCombo, marks, rights, flagged, practiced, roundLevel, warmUp, beat, ups,
    items: round.map(q => ({id: q.id, bonus: !!q.bonus, comeback: !!q.comeback, seconds: q.seconds, ...(q.boss ? {boss: q.boss} : {})})), misses: misses.map(m => ({id: m.q.id, picked: m.picked, from: m.from, to: m.to}))})); } catch {} };
  const clearRound = () => { try { localStorage.removeItem(ROUND_KEY); } catch {} };
  const readRound = () => {
    try {
      const s = JSON.parse(localStorage.getItem(ROUND_KEY) || "null");
      if (!s || Date.now() - s.at > ROUND_KEEP_MS || !(s.index >= 1 && s.index < s.items.length)) { if (s) clearRound(); return null; }
      const byId = new Map([...bossAll, ...n2Cards, ...lower, ...pool].map(q => [q.id, q])), items = s.items.map(it => byId.has(it.id) ? {...byId.get(it.id), ...it} : null);
      if (items.includes(null)) { clearRound(); return null; }
      return {...s, round: items, ups: s.ups || [], misses: (s.misses || []).map(m => ({q: items.find(q => q.id === m.id), picked: m.picked, from: m.from, to: m.to})).filter(m => m.q)};
    } catch { return null; }
  };
  // Item strength on the card (board 9): five squares and the level, or 極 at five.
  const paintLevel = (n, up = false) => {
    const master = n >= ITEM_LEVEL.max;
    $("game-lv").hidden = master; $("game-master").hidden = !master; $("game-card").dataset.master = String(master);
    [...$("game-lv").querySelectorAll("i")].forEach((sq, i) => { sq.className = i < n ? (up && i === n - 1 ? "f up" : "f") : ""; });
    $("game-lv-n").textContent = "Lv " + n;
  };
  const gapCard = q => q.kind === "gap" || q.kind === "partgap";
  function ask() {
    clearTimeout(timer); locked = false;
    current = round[index];
    if (!current) { review(0); return; }
    // The same level that set this round's mix and clock picks its choices.
    const q = current, {choices, key} = choicesFor(q, Math.random, roundLevel);
    q.choices = choices; q.key = key;
    const card = $("game-card");
    card.dataset.bonus = String(!!q.bonus); card.dataset.state = ""; card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
    $("game-kind").textContent = q.kind === "exam" ? "Exam · 問題" + q.mondai : q.kind === "connective" ? "Connective" : KIND_LABEL[q.kind];
    const most = q.bonus ? bonusPoints({points: scoreAnswer({outcome: "right", ms: 0, seconds: q.seconds, streak}).points, bonus: true, streak: streak + 1, factor: DIFFICULTY[difficulty()].points, choices: choices.length}).points : 0;
    const tag = q.bonus ? ["Bonus ×3 · up to " + most.toLocaleString(), "goldfill"] : q.practice ? [(q.review ? q.level + " review" : q.level ? q.level + " practice" : "Practice") + " · not scored", "practice"] : q.kind === "exam" ? ["Mock " + String(bookIds.indexOf(String(q.solution?.source || "").split("#")[0]) + 1).padStart(2, "0"), ""] : null;
    $("game-tag").hidden = !tag; if (tag) { $("game-tag").textContent = tag[0]; $("game-tag").dataset.tone = tag[1]; }
    // Where no chip claims the corner, the item's level sits there (board 9).
    $("game-lvup").hidden = true;
    if (tag) { $("game-lv").hidden = true; $("game-master").hidden = true; card.dataset.master = "false"; } else paintLevel(itemLevel(readGame(), q.id));
    // A beat ribbon on question 1 (pace), or the warm-up; it leaves on the first answer.
    const left = bossProgress(state).left;
    if (index !== 0) ribbon(null);
    else if (warmUp) ribbon("warm");
    else if (beat?.name === "hook") ribbon(state.rounds ? "hook" : "first");
    else if (beat?.name === "stretch") ribbon("stretch", "Final stretch · " + left + " to the boss");
    else ribbon(beat?.name);
    $("game-pips").dataset.peak = String(beat?.name === "peak" && !warmUp);
    $("game-jackpot").hidden = true; root.dataset.jackpot = "false"; $("game-play").dataset.locked = "false"; $("game-play").dataset.flagged = "false";
    stretchStrip();
    // Card layout per kind (board 3a): sentence kinds show the sentence alone;
    // word kinds the big word; listen a round play button; exam its question.
    const listen = q.kind === "listen", sentenceKind = !!q.sentence && (["reading", "homophone", "grammar", "connective", "meaning", "affix"].includes(q.kind) || grammarBlockCard(q) || gapCard(q) || ["para", "pair", "order"].includes(q.kind));
    const prompt = $("game-prompt");
    prompt.hidden = listen || sentenceKind;
    prompt.textContent = q.prompt;
    prompt.lang = q.kind === "definition" ? "en" : "ja";
    prompt.className = "qr-big" + (q.kind === "exam" ? " exam" : q.prompt.length > 6 && q.kind !== "definition" ? " mid" : "");
    // An exam blank is drawn as a ruled gap, as on the paper (board 3a).
    if (q.kind === "exam" && /（\s*）/.test(q.prompt)) prompt.replaceChildren(...q.prompt.split(/（\s*）/).flatMap((part, n) => n ? [el("span", {class: "qr-blank"}), part] : [part]));
    // A paper marks the word it asks about as 【word】. Shown raw, the brackets read as a furigana reading left in the
    // text (owner's report, 27 Nov): the word is underlined, as on the paper.
    else if (q.kind === "exam" && /【[^】]*】/.test(q.prompt)) prompt.replaceChildren(...q.prompt.split(/(【[^】]*】)/).filter(Boolean).map(part => /^【/.test(part) ? el("u", {class: "n2-mark", text: part.slice(1, -1)}) : part));
    // A listen card sits in its sentence, the heard word left as a gap: many
    // words sound alike, and the sentence says which one (report 7bd670be).
    // A word heard in its dictionary form may be written in another (涼む, 涼んでいた): the gap is the part that is there.
    const gap = listen && q.solution?.ja ? heardGap(q.solution.ja, q.prompt) : "";
    const heard = gap ? exampleSegments(q.solution.ja, [gap]) : [], inContext = heard.some(s => s.mark);
    q.gap = inContext ? heard.filter(s => s.mark).map(s => s.text).join("") : "";
    $("game-sentence").hidden = !sentenceKind && !inContext; $("game-sentence").classList.toggle("heard", inContext);
    $("game-sentence").classList.toggle("passage", q.kind === "connective");
    if (q.kind === "connective") { const [a, b] = q.sentence.split("（　）"); $("game-sentence").replaceChildren(a, el("span", {class: "qr-blank", id: "game-blank"}), b || ""); }
    // Board 13: on a build card the underline is cut into one segment per part.
    else if (sentenceKind && q.kind === "build" && cutUnderline(q.sentence, q.needle, q.parts)) $("game-sentence").replaceChildren(...cutUnderline(q.sentence, q.needle, q.parts).map(s => s.part ? el("u", {class: "n2-mark" + (s.cut ? " qr-cut" : ""), text: s.text}) : s.text));
    else if (sentenceKind) $("game-sentence").replaceChildren(...exampleNodes(q.sentence, [q.needle]));
    else if (inContext) $("game-sentence").replaceChildren(...heard.flatMap((s, n) => !s.mark ? [s.text] : heard[n - 1]?.mark ? [] : [el("span", {class: "qr-blank", id: "game-blank"})]));
    // A gap card (the exam's direction): the sentence with its gap, and what the sentence means under it.
    if (gapCard(q)) { const [a, b] = q.sentence.split("（　）"); $("game-sentence").replaceChildren(a, el("span", {class: "qr-blank", id: "game-blank"}), b || "", el("span", {class: "qr-en", lang: "en", text: q.en})); }
    // A clause pair: its gap, no English (it would name the relation). Sentence order: three slots and the ★.
    if (q.kind === "pair") { const [a, b] = q.sentence.split("（　）"); $("game-sentence").replaceChildren(a, el("span", {class: "qr-blank", id: "game-blank"}), b || ""); }
    if (q.kind === "order") $("game-sentence").replaceChildren(q.lead, ...[0, 1, 2, 3].flatMap(i => [el("span", {class: "qr-blank" + (i === 2 ? " star" : ""), ...(i === 2 ? {id: "game-blank"} : {}), text: i === 2 ? "★" : ""}), " "]), q.tail);
    if (q.kind === "para") $("game-sentence").replaceChildren(q.sentence);
    const parts = $("game-grammar-parts");
    parts.hidden = !(q.kind === "build" || (q.kind === "link" && q.parts?.length));
    parts.replaceChildren(...partList(q.parts)); parts.dataset.rows = String(partRows(q.parts).length);
    card.dataset.kind = q.kind; $("game-proved").hidden = true;
    // Board 11 · E: a practice card reads as practice: dashed card, dim clock, ring pip.
    card.dataset.practice = String(!!q.practice); root.dataset.practice = String(!!q.practice);
    $("game-say").hidden = !listen; $("game-say-hint").hidden = !listen;
    card.dataset.centered = String(!sentenceKind && q.kind !== "exam");
    $("game-aloud").lastChild.textContent = q.kind === "reading" && !sentenceKind ? ALOUD.meaning : ALOUD[grammarBlockCard(q) ? "grammar" : q.kind] || "";
    // A lone line is centred; a sentence that wraps reads from the left, and from three lines drops to 19 px (review C7).
    const sent = $("game-sentence"); sent.dataset.lines = "1";
    if ((sentenceKind || inContext) && q.kind !== "connective") { const lines = Math.round(sent.getBoundingClientRect().height / parseFloat(getComputedStyle(sent).lineHeight)); sent.dataset.lines = lines >= 3 ? "3" : String(lines); }
    $("game-combo").textContent = card.dataset.master === "true" ? "Mastered. A miss here drops it to Lv 4 and it comes back more often." : ""; $("game-combo").className = "qr-line";
    $("game-flag").dataset.on = "false";
    $("game-choices").replaceChildren(...choices.map((c, i) => el("button", {type: "button", class: "qr-ch" + (["definition", "homophone"].includes(q.kind) ? " m" : choices.some(t => /[ぁ-んァ-ン一-龯]/.test(t) && t.length > 14) ? " s" : ""), "data-ui": "button", onclick: () => answer(i)},
      el("span", {class: "k", text: String(i + 1)}), el("span", {class: "t", lang: /[ぁ-んァ-ン一-龯]/.test(c) ? "ja" : "en", text: c}))));
    head();
    if (q.bonus && sound()) sfx.bonus();
    const token = ++askToken;
    voiceWait = false;
    const startClock = () => { voiceWait = false; shownAt = performance.now(); runBar(q.seconds, {gold: !!q.bonus}); timer = setTimeout(() => answer(-1, "timeout"), q.seconds * 1000); };
    if (!listen) { startClock(); return; }
    // Listen (re-audit): the clock starts once the word has played; if it can't
    // play, the card doesn't count and the game moves on.
    // The bar waits full until the voice ends (board 3a · Listen).
    // Until it has, no answer is taken and Hear it again is inert (re-audit: a choice could score before the word was heard).
    voiceWait = true;
    shownAt = performance.now(); clearInterval(ticker); bar.style.transition = "none"; bar.style.width = "100%"; $("game-clock").dataset.state = ""; $("game-sec").textContent = q.seconds.toFixed(1);
    speakAndWait(spokenWord(q.prompt, q.say), {voice: voice(), rate: Number(settings.rate) || 1}).then(ok => {
      if (token !== askToken || current !== q || locked) return;
      // The voice ended while the tab was hidden: the clock starts when it is seen again, once.
      if (ok) { if (document.visibilityState === "hidden") hiddenResume = startClock; else startClock(); return; }
      voiceWait = false; listenFails++;
      locked = true; marks[index] = "pr"; practiced++; head();
      $("game-combo").textContent = "The audio didn’t play: this one doesn’t count.";
      timer = setTimeout(() => { index++; saveRound(); ask(); }, PAUSE.miss);
    });
  }
  async function answer(i, why) {
    if (locked || !current || voiceWait) return;
    locked = true; clearTimeout(timer);
    const q = current, ms = performance.now() - shownAt;
    const outcome = why === "timeout" ? "timeout" : i < 0 ? "dontknow" : i === q.key ? "right" : "wrong";
    stopBar(outcome === "right" ? "right" : outcome === "timeout" ? "dead" : "idle");
    if (outcome === "right") $("game-sec").replaceChildren((ms / 1000).toFixed(1), el("span", {text: "s"}));
    $("game-play").dataset.locked = "true";
    const result = scoreAnswer({outcome, ms, seconds: q.seconds, streak});
    // Easy pays less, Hard more, bonus ×3 — all inside the guessing cap.
    // Practice questions (connectives, until reviewed) score nothing and
    // leave the combo alone.
    const paid = q.practice ? {points: 0, jackpot: 0} : bonusPoints({points: result.points, bonus: q.bonus, streak: result.streak, factor: DIFFICULTY[difficulty()].points, choices: q.choices.length});
    if (q.practice) result.streak = streak;
    if (outcome === "right" && !q.practice) rights++;
    if (q.practice) practiced++;
    score += paid.points; streak = result.streak; bestCombo = Math.max(bestCombo, streak);
    marks[index] = q.practice ? "pr" : outcome === "right" ? "ok" : outcome === "timeout" ? "to" : "no";
    head();
    $("game-score").dataset.flash = outcome === "right" ? "right" : outcome === "wrong" ? "wrong" : ""; setTimeout(() => { $("game-score").dataset.flash = ""; }, 400);
    if (q.practice) floatText("practice", "practice");
    else floatPoints(paid.points, paid.points > 0 ? (q.bonus ? "gold" : "right") : paid.points < 0 ? "wrong" : "zero");
    if (q.practice && streak >= 2) $("game-combo-chip").textContent += " · kept";
    // Board 11 · F: the blank fills with the answer, and its job shows under the card.
    if ((q.kind === "connective" || q.kind === "listen") && $("game-blank")) { $("game-blank").textContent = q.kind === "listen" ? q.gap || q.prompt : q.answer; $("game-blank").classList.add("filled"); }
    if (gapCard(q) && $("game-blank")) { $("game-blank").textContent = q.answer; $("game-blank").classList.add("filled"); }
    if (q.kind === "pair" && $("game-blank")) { $("game-blank").textContent = q.answer; $("game-blank").classList.add("filled"); }
    // Sentence order: the whole sentence, the ★ tile underlined.
    if (q.kind === "order") $("game-sentence").replaceChildren(q.lead, ...q.tiles.map((t, i) => i === 2 ? el("u", {class: "n2-mark", text: t}) : t), q.tail);
    ribbon(null); stretchStrip();
    // Answer states (fix 7): right tinted with ✓, a wrong pick struck, the rest fade.
    const card = $("game-card"); card.dataset.state = outcome === "right" ? "right" : outcome === "wrong" ? "wrong" : outcome === "timeout" ? "timeout" : "";
    if (outcome === "timeout") $("game-kind").textContent = "⏱ Time";
    const rows = [...$("game-choices").children];
    rows.forEach((row, n) => { row.dataset.state = n === q.key ? "right" : n === i && outcome === "wrong" ? "wrong" : "dim"; });
    if (rows[q.key]) rows[q.key].querySelector(".k").textContent = "✓";
    if (outcome === "wrong" && rows[i]) rows[i].querySelector(".k").textContent = "✕";
    // Juice (fix 10) and sound (fix 11): never blocks the next question.
    if (sound()) {
      if (outcome === "right") paid.jackpot ? (streak >= 10 ? sfx.jackpot10() : sfx.jackpot5()) : sfx.right(streak);
      else if (outcome === "wrong") sfx.wrong(); else if (outcome === "timeout") sfx.timeout(); else sfx.idk();
      buzz(outcome === "right" ? (paid.jackpot ? (streak >= 10 ? [30, 40, 30, 40, 60] : [20, 30, 20]) : 12) : outcome === "wrong" ? [40, 40, 40] : outcome === "timeout" ? 60 : 10);
      // No spoken answer here (owner, 26 Nov): at blitz pace it was still
      // speaking over the next question. The review speaks each miss.
    }
    const line = $("game-combo");
    if (paid.jackpot && outcome === "right") {
      // Jackpots are a celebration, not points (rules): the ribbon at five, the 十 stamp at ten (board 4).
      if (streak >= 10) { $("game-jackpot").hidden = false; root.dataset.jackpot = "true"; } else ribbon("jackpot");
      $("game-score").dataset.flash = "gold";
    } else if (q.bonus && outcome === "right") { line.textContent = "Bonus +" + paid.points; line.className = "qr-line gold"; }
    // Rule two: a mistake is part of the game. Say so, then keep going.
    if (q.kind === "connective" || q.kind === "link") line.textContent = q.solution?.why || "";
    else if (outcome === "wrong") line.textContent = "Part of the game. Keep going.";
    else if (outcome === "timeout") line.textContent = "Too slow this time. It comes back next round.";
    else if (outcome === "dontknow") line.textContent = "Fine. Keep going.";
    // Board 13 · D–E: after any answer on a build card, the parts read together, in the line's slot.
    if (q.kind === "build" && q.literal) { line.replaceChildren(el("small", {text: "piece by piece"}), q.literal); line.className = "qr-line literal"; line.dataset.tone = outcome === "right" ? "right" : ""; }
    // So does a word or pattern asked whole that is made of pieces (やむ + を + えない: "cannot stop it").
    if (q.pieces) { line.replaceChildren(el("small", {text: "piece by piece"}), q.pieces.literal); line.className = "qr-line literal"; line.dataset.tone = outcome === "right" ? "right" : ""; }
    // A built connective says its pieces together the same way (それ + な + のに: "even though that is so").
    if (q.kind === "link" && q.literal) { line.replaceChildren(el("small", {text: "piece by piece"}), q.literal); line.className = "qr-line literal"; line.dataset.tone = outcome === "right" ? "right" : ""; }
    // Item strength: a fast right answer stamps a square in; a miss takes one away (boards 9, 2).
    const lvFrom = q.practice && !q.record ? 0 : itemLevel(readGame(), q.id), lvTo = q.practice && !q.record ? 0 : levelAfter(readGame(), {id: q.id, outcome, fast: result.fast});
    if (lvTo > lvFrom) { ups.push({word: String(q.solution?.word || q.prompt).replace(/[〜～]/g, ""), from: lvFrom, to: lvTo}); if (!$("game-lv").hidden || !$("game-master").hidden) { paintLevel(lvTo, true); $("game-lvup").hidden = false; } }
    else if (lvTo < lvFrom && $("game-tag").hidden) { $("game-lv").hidden = true; $("game-master").hidden = true; $("game-tag").hidden = false; $("game-tag").textContent = "Lv " + lvFrom + " → " + lvTo; $("game-tag").dataset.tone = "seal"; }
    if (outcome !== "right") misses.push({q, picked: i >= 0 ? q.choices[i] : outcome === "timeout" ? "Time ran out" : "I don’t know", from: lvFrom, to: lvTo});
    const beforeAnswer = readGame();
    state = rememberAnswer(readGame(), {q, outcome, points: paid.points, fast: result.fast, difficulty: difficulty()}); writeGame(state);
    // Board 13 · H: an infer card answered right on a pattern never shown proves its pieces. One beat: a 証 stamp, a click, and a little longer on the card.
    const proved = q.kind === "infer" && provedBy(beforeAnswer, state, q).length > 0;
    if (proved) {
      const known = grammarCoverage(n2Cards, state);
      $("game-proved-pieces").textContent = partRows(q.parts).map(r => r.text).join(" · "); $("game-proved-count").textContent = known.known + " of " + known.items;
      $("game-proved").hidden = false; line.textContent = "";
      if (sound()) { sfx.proved(); buzz(15); }
    }
    if (recallsMiss(q, outcome)) {
      try {
        const id = recallId(q.dimension, q.target), previous = data.recall.find(r => r.id === id);
        const record = recallRecord(previous, {id, type: q.dimension, item: {target: q.target, prompt: q.solution.word || q.prompt, reading: q.solution.reading || "", answer: q.solution.meaning || q.answer}},
          "missed", new Date(), {source: GAME_SOURCE, modality: q.kind === "listen" ? "audio" : "print", kind: q.kind});
        await access("recall", "put", record);
        data.recall = data.recall.filter(r => r.id !== id).concat(record);
      } catch {}
    }
    index++; saveRound(); index--; // the next question is where a resume picks up
    timer = setTimeout(() => { index++; ask(); }, proved ? PROVED_MS : outcome === "right" ? (paid.jackpot && streak >= 10 ? 700 : PAUSE.right) : outcome === "dontknow" ? 600 : PAUSE.miss);
  }
  // The review (fix 9): 5 seconds a miss, read top to bottom in one glance.
  let reviewAt = 0, held = false;
  // The boss review (owner, 27 Nov): a finished boss's wrong and unsure answers on this same screen, read at the
  // game's pace and never answered. It touches no state: no round, no count, no record.
  let paperReview = null;
  // A paper marks its word 【so】 and its blank （　）: here the word is underlined and the blank holds the answer.
  const paperText = (text, answer) => String(text).split(/(【[^】]*】|（\s*）|＿+\s*★\s*＿+|★)/).filter(Boolean).map(part => /^【/.test(part) ? el("u", {class: "n2-mark", text: part.slice(1, -1)}) : /^（\s*）$/.test(part) ? el("u", {class: "n2-mark", text: answer}) : part);
  // One question of a paper as a review card: used by the boss review, and by a round's review for an exam card
  // (owner's flag, 27 Nov: it showed the answer twice and no sentence).
  const known = t => t && n2Cards.find(c => c.kind !== "exam" && c.solution?.meaning && c.target?.[0] === t[0] && c.target[1] === t[1] && (t[2] === undefined || c.target[2] === t[2]));
  function paperCardOf(it, base, source, picked) {
      const card = known(it.target), sol = card?.solution;
      // A usage question (問題6) asks with the bare word and answers with a sentence: that sentence is the line.
      const usage = sol && !/【|（\s*）/.test(it.ask) && it.answer.length > it.ask.length;
      // Every card of the review is spoken once (owner, 27 Nov: some were, some were not): the word with its
      // reading, the pattern as its sentence reads it, a listening line, or else the right answer.
      const voiceOf = () => card.kind === "grammar" ? grammarVoice(card, sol).speak : spokenWord(sol.word.replace(/[〜～]/g, ""), String(sol.reading || "").replace(/[〜～]/g, ""));
      if (sol) return {picked, q: {...base, say: voiceOf(), paperLine: usage ? it.answer.replace(it.ask, "【" + it.ask + "】") : it.ask, target: it.target,
        // The paper's answer, where the sentence does not already hold it (a synonym question).
        solution: {word: sol.word, reading: sol.reading || "", meaning: sol.meaning, ja: "", en: [usage || /（\s*）/.test(it.ask) || [sol.word, sol.reading].includes(it.answer) ? "" : "Answer: " + it.answer, examEn?.en?.[source] || ""].filter(Boolean).join(" · "), why: it.why, source}}};
      return {picked, q: {...base, ask: it.ask, say: it.heard && it.lines.length ? it.lines.join("　") : it.answer,
        solution: {word: it.answer, meaning: "", ja: it.lines.join(""), en: it.en, why: it.why, source}}};
  }
  function startPaperReview(sitting, paper) {
    const set = sitting.paper === realisticPaperId(sitting.book) ? sitting.book : "";
    const items = bossReview({paper, attempt: sitting, keys: bossKeys, source: set});
    if (!items.length) return false;
    clearTimeout(timer); window.speechSynthesis?.cancel();
    paperReview = {href: "?book=" + encodeURIComponent(sitting.book) + "&attempt=" + encodeURIComponent(sitting.id)};
    // A vocabulary or grammar question reads like a round's review card (owner, 27 Nov): the word, its reading and
    // its meaning large, at a glance (険しい · けわしい · steep); the paper's sentence under them, then the why.
    misses = items.map(it => {
      const id = "paper:" + sitting.book + "#" + it.index, source = sitting.book + "#" + it.index;
      const picked = it.picked === null ? "No answer" : it.unsure ? "Right, but marked unsure" : it.picked;
      return paperCardOf(it, {kind: "paper", id, prompt: it.ask, mondai: it.mondai, answer: it.answer, seconds: it.seconds}, source, picked);
    });
    $("game-back").href = "?view=game"; $("game-back").setAttribute("aria-label", "Back to home"); $("game-back").dataset.end = "false";
    // The review hides the head, so it carries its own way out: back to Home at any card.
    $("game-review-back").onclick = () => { clearTimeout(timer); clearInterval(ticker); window.speechSynthesis?.cancel(); paperReview = null; root.dataset.paper = "false"; $("game-review-back").hidden = true; home(); };
    review(0);
    return true;
  }
  function review(n) {
    clearTimeout(timer);
    reviewAt = n;
    if (!misses[n]) { if (paperReview) { paperReview = null; root.dataset.paper = "false"; $("game-review-back").hidden = true; window.speechSynthesis?.cancel(); home(); } else done(); return; }
    const {q: asked, picked} = misses[n];
    // An exam card missed in a round is shown as the boss review shows a paper's question.
    const q = asked.kind === "exam" ? paperCardOf({target: asked.target, ask: asked.prompt, answer: asked.answer, why: asked.solution?.why || "", heard: false, lines: [], en: ""},
      {kind: "exam", id: asked.id, prompt: asked.prompt, mondai: asked.mondai, answer: asked.answer}, asked.solution?.source || "", picked).q : asked;
    const sol = q.solution || {};
    mode("review");
    if (!paperReview) clearRound();
    root.dataset.paper = String(!!paperReview);
    $("game-review-back").hidden = !paperReview;
    $("game-sub").textContent = (paperReview ? "Boss review · " : "Review · ") + (n + 1) + " of " + misses.length;
    $("game-sub-right").replaceChildren(...(misses[n].from > misses[n].to ? [el("span", {class: "qr-chip", "data-tone": "seal", text: "Lv " + misses[n].from + " → " + misses[n].to})] : []));
    $("game-review-kind").textContent = KIND_LABEL[q.kind];
    const word = sol.word || q.answer;
    $("game-review-word").textContent = word;
    $("game-review-word").classList.toggle("long", word.length > 6);
    const pattern = q.kind === "grammar" || q.kind === "gap" || grammarBlockCard(q) ? grammarVoice(q, sol) : null;
    $("game-review-reading").textContent = pattern ? pattern.reading : sol.reading && sol.reading !== sol.word ? sol.reading : "";
    $("game-review-meaning").textContent = sol.meaning || "";
    // A long pick stacks: the label on its own line, the struck text under it (review C13).
    const chose = picked && !/^(Time ran out|I don’t know|No answer|Right, but marked unsure)$/.test(picked), long = chose && picked.length > (paperReview ? 12 : 24);
    $("game-review-picked").dataset.long = String(!!long);
    $("game-review-picked").replaceChildren(...(long ? [el("small", {text: "You picked"}), el("s", {text: picked})] : chose ? ["You picked ", el("s", {text: picked})] : [picked || ""]));
    // Board 13 · G: a missed build or infer card shows its parts and their literal reading, between the pick and the sentence.
    const rows = (q.kind === "build" || q.kind === "infer") && q.parts ? partList(q.parts) : [];
    $("game-review-parts").hidden = !rows.length; $("game-review-partlist").replaceChildren(...rows);
    // A word or pattern made of pieces shows them here, with the pieces read together.
    if (q.pieces) { $("game-review-parts").hidden = false; $("game-review-partlist").replaceChildren(...partList(q.pieces.parts)); $("game-review-literal").hidden = false; $("game-review-literal").replaceChildren(el("small", {text: "piece by piece"}), q.pieces.literal); }
    // A built connective shows its pieces here too.
    if (q.kind === "link" && q.parts) { $("game-review-parts").hidden = false; $("game-review-partlist").replaceChildren(...partList(q.parts)); }
    $("game-review-literal").hidden = !q.literal; $("game-review-literal").replaceChildren(...(q.literal ? [el("small", {text: "piece by piece"}), q.literal] : []));
    $("game-next").textContent = n === misses.length - 1 ? (paperReview ? "Done" : "Round end") : "Next";
    // A boss review card (bossReview): the question, the right choice, the pick; then the deciding lines and the why.
    const ask = $("game-review-ask"); ask.hidden = !q.ask; ask.replaceChildren(...(q.ask ? paperText(q.ask, q.answer) : []));
    $("game-review-word").classList.toggle("line", !q.paperLine && word.length > 10 && (!!paperReview || q.kind === "para"));
    if (paperReview) $("game-sub-right").replaceChildren(el("a", {class: "qr-chip", href: paperReview.href, text: "Full paper"}));
    $("game-review-sentence").hidden = !sol.ja && !q.paperLine;
    if (q.paperLine) { $("game-review-ja").replaceChildren(...paperText(q.paperLine, q.answer)); $("game-review-en").textContent = sol.en || ""; }
    if (sol.ja) { $("game-review-ja").replaceChildren(...exampleNodes(sol.ja, [q.kind === "homophone" || q.kind === "connective" ? word : q.needle || "", word.replace(/[〜～]/g, "").replace(/（[^）]*）/g, "")].filter(Boolean))); $("game-review-en").textContent = sol.en || ""; }
    $("game-review-why").hidden = !sol.why; $("game-review-why").textContent = sol.why || "";
    // Same-sound words sit inside the example card, as its third line (review C15).
    const same = !sol.why && sol.others?.length ? sol.others : null;
    $("game-review-same").hidden = !same; $("game-review-same").replaceChildren(...(same ? ["Same sound: ", el("span", {lang: "ja", text: same.join(" · ")})] : []));
    if (same) $("game-review-sentence").hidden = false;
    const reviewToken = ++askToken;
    // Every review card is spoken (owner, 27 Nov: gap, connective and word-part cards were silent): the pattern as its
    // sentence reads it, the word with its reading (a part without its ～), or what answerSpeech gives the kind (`voiced`).
    const spoken = pattern ? pattern.speak : sol.word && sol.reading ? spokenWord(sol.word, sol.reading) : "";
    const voiced = q.say || (["affix", "partgap"].includes(q.kind) ? answerSpeech(q) : spoken || answerSpeech(q)) || "";
    if (sound() && voiced) setTimeout(() => { if (reviewToken === askToken && !$("game-review").hidden) say(voiced); }, 150);
    held = false; root.dataset.held = "false"; $("game-hold").setAttribute("aria-pressed", "false"); $("game-hold").setAttribute("aria-label", "Hold");
    $("game-hold").innerHTML = PAUSE_SVG;
    runBar(q.seconds && paperReview ? q.seconds : REVIEW_SECONDS, {review: true});
    timer = setTimeout(() => review(n + 1), (q.seconds && paperReview ? q.seconds : REVIEW_SECONDS) * 1000);
  }
  // A grammar point is spoken and shown with its reading too (report bc70f913).
  const grammarVoice = (q, sol) => { const text = answerSpeech(q) || ""; return patternVoice(text, sol.ja ? exampleSegments(sol.ja, [q.needle || "", text].filter(Boolean)) : []); };
  // Round end (fix 8): the number, the pips, one line, one big button.
  function done() {
    clearTimeout(timer); clearInterval(ticker);
    flagWhy();
    // Right counts only answers that were right: a flag or a skip is never a win.
    const before = readGame().best || 0;
    // Accuracy over scored answers only: flags and practice are not evidence.
    const scoredN = round.length - flagged - practiced;
    state = rememberRound(readGame(), {score, questions: round, misses: scoredN - rights, scored: scoredN}); writeGame(state);
    clearRound();
    const best = score > before && score > 0;
    if (sound()) { best ? sfx.best() : sfx.round(); buzz(best ? [30, 50, 30] : 20); }
    mode("done");
    $("game-sub").textContent = "";
    const late = atBedtime(new Date(), settings.gameBedtime), warm = inSlumpNext(), crown = best && !late;
    $("game-sub").textContent = "Round " + state.rounds + (late ? " · " + clockAt(Date.now()) : beat?.name && beat.name !== "hook" ? " · " + beat.name : "");
    // Board 4: a new best round is gold, once, with what it beat.
    $("game-sub-right").replaceChildren(crown ? el("span", {class: "qr-chip", "data-tone": "goldfill", text: "New best"}) : late ? "today " + (gameToday(state).answered || 0).toLocaleString() : "best " + num(state.best));
    $("game-done-title").textContent = num(score); $("game-done-title").dataset.best = String(crown); $("game-done-title").dataset.neg = String(score < 0 && !late);
    $("game-done-title").dataset.late = String(late); root.dataset.late = String(late); root.dataset.best = String(crown);
    $("game-done-best").hidden = !crown; $("game-done-was").hidden = !(crown && before > 0); $("game-done-was").textContent = "was " + num(before) + " · +" + (score - before).toLocaleString();
    pips($("game-done-pips"));
    const back = Math.max(0, round.length - rights - flagged - practiced);
    $("game-done-line").textContent = late ? rights + " of " + round.length + (back ? " · " + back + " saved for tonight" : "")
      : rights + " of " + round.length + (warm ? " · part of the game" : (bestCombo > 1 ? " · best combo " + bestCombo : "") + (back ? " · " + back + " come back next" : "")) + (flagged ? " · " + flagged + " flagged" : "");
    const b = bossProgress(state), boss = bossNow();
    $("game-boss-strip").hidden = !boss || b.open || late || warm; $("game-boss").hidden = !(boss && b.open);
    $("game-boss-fill").style.width = Math.round(b.done / BOSS_EVERY * 100) + "%";
    $("game-boss-progress").textContent = b.done.toLocaleString() + " / " + BOSS_EVERY.toLocaleString();
    const c = runClock(state.runStart); $("game-boss-clock").textContent = c.started && c.times > 1 ? "×" + c.times : ""; $("game-boss-clock").hidden = !(c.started && c.times > 1);
    if (boss && b.open) { $("game-boss").href = "?book=" + boss.id + "&boss=1"; $("game-boss-line").textContent = "The boss is open: " + mockName(boss) + ", " + bossClock().written + " + " + bossClock().listening + " min"; $("game-boss").onclick = e => fightBoss(e, boss); }
    // Bedtime (board 6 · B) and the warm-up after a bad round (C).
    $("game-bedtime").hidden = !late; $("game-sleep").hidden = !late; $("game-warm").hidden = late || !warm;
    // Board 6 · A: what levelled up this round, three at most.
    $("game-lvstrip").hidden = late || warm || !ups.length;
    $("game-lvups").replaceChildren(...ups.slice(0, 3).map(u => el("span", {lang: "ja", text: u.word + " " + u.from + "→" + u.to})));
    $("game-warm-line").textContent = "Next: a recovery round of things you know, with " + Math.min(2, back) + " of these " + back + " back.";
    $("game-again").className = late ? "qr-lnk" : "qr-btn";
    $("game-again-label").textContent = late ? "One more round" : warm ? "Recovery round" : "Next round";
    $("game-again").querySelector("svg").style.display = late ? "none" : "";
    $("game-home-btn").hidden = late;
    if (late) deckExamples().then(examples => {
      const left = eveningRecall({inventory, recall: data.recall, evidence: scored(data), events: data.events, examples}).length;
      $("game-sleep").href = left ? "?view=evening&from=game" : "?view=game&panel=radio";
      $("game-sleep").querySelector("span").textContent = left ? "Evening recall, then sleep" : "Start the Night Radio";
      // The line and the button agree (review C16): "saved for tonight" only with Evening recall.
      if (!left) $("game-done-line").textContent = rights + " of " + round.length;
      $("game-bedtime-line").textContent = left ? left + " items to recall, then the Night Radio plays them while you sleep." : "Nothing left to recall: the Night Radio plays today’s work while you sleep.";
    }).catch(() => {});
  }
  const inSlumpNext = () => inSlump(readGame());
  $("game-skip").onclick = () => answer(-1);
  // One tap, no questions (owner, 26 Nov): the flag saves the question exactly
  // as shown and the game moves on. Working out why is the audit's job.
  // The flags of the round in hand: the round's end offers one tap to say why (owner's backlog: the maintainer had to
  // guess at flags with no reason). Never asked during play, never required.
  let roundFlags = [];
  const FLAG_WHY = [["answer", "Wrong answer"], ["meaning", "Meaning"], ["reading", "Reading"], ["voice", "Voice"], ["unnatural", "Odd Japanese"], ["other", "Other"]];
  function flagWhy() {
    const next = roundFlags.find(f => f.report && !f.asked);
    $("game-flagwhy").hidden = !next;
    if (!next) return;
    $("game-flagwhy-word").textContent = next.word;
    $("game-flagwhy-chips").replaceChildren(...FLAG_WHY.map(([reason, label]) => el("button", {type: "button", class: "qr-chip", "data-ui": "button", text: label, onclick: async () => {
      next.asked = true; flagWhy();
      try { next.report = await reportHistory.edit(next.report, {reasons: [reason]}); } catch {}
    }})));
  }
  const quickFlag = async card => {
    const snapshot = screenSnapshot(root); // taken at the tap, before the game moves on
    const entry = {word: String(card.extra?.answer || card.text || "").slice(0, 24), report: null, asked: false}; roundFlags.push(entry);
    try { entry.report = await fileReport(createReport({kind: "card", reasons: [], note: "Flagged in Quick round with one tap; the reason is for the audit to find.", subject: card, snapshot, screen: screenOf(location, "Quick round"), version: await appVersion(), device: deviceInfo()})); } catch {}
  };
  $("game-flag").onclick = () => {
    if (locked || !current || $("game-play").hidden) return;
    locked = true; clearTimeout(timer); stopBar("idle");
    const q = current; writeGame(flagCard(readGame(), q.id));
    quickFlag(cardOf(q));
    // A flag earns nothing, saves no recall evidence and ends the combo: it is
    // not an answer, so it can't carry a streak across a card.
    flagged++; streak = 0; marks[index] = "fl"; head();
    $("game-flag").dataset.on = "true"; $("game-play").dataset.flagged = "true";
    $("game-tag").hidden = false; $("game-tag").textContent = "Flagged"; $("game-tag").dataset.tone = "";
    if (sound()) { sfx.flag(); buzz(10); }
    toast("Flagged, saved as shown", "no points");
    index++; saveRound(); index--;
    timer = setTimeout(() => { index++; ask(); }, PAUSE.right);
  };
  $("game-review-flag").onclick = () => {
    const m = misses[reviewAt]; if (!m) return;
    if (!paperReview) writeGame(flagCard(readGame(), m.q.id)); // flagged in the review: it does not come back next round either
    quickFlag(cardOf(m.q, m.picked)); toast("Flagged, saved as shown");
    review(reviewAt + 1);
  };
  reportPause = () => {
    if ($("game").hidden) return null;
    if (!$("game-play").hidden && current && !locked && voiceWait) return null;
    if (!$("game-play").hidden && current && !locked) {
      const left = Math.max(1000, current.seconds * 1000 - (performance.now() - shownAt));
      clearTimeout(timer); stopBar();
      return () => { if (locked || !current) return; shownAt = performance.now() - (current.seconds * 1000 - left);
        runBar(left / 1000, {gold: !!current.bonus}); timer = setTimeout(() => answer(-1, "timeout"), left); };
    }
    if (!$("game-review").hidden && !held) { clearTimeout(timer); stopBar(); return () => { if (!$("game-review").hidden && !held) review(reviewAt); }; }
    return null;
  };
  $("game-say").onclick = () => current && !locked && !voiceWait && say(spokenWord(current.prompt, current.say));
  // A hidden tab pauses the card or the review (re-audit P1); coming back resumes it.
  let hiddenResume = null;
  document.addEventListener("visibilitychange", () => {
    if ($("game").hidden) return;
    if (document.visibilityState === "hidden") hiddenResume = reportPause?.() || null;
    else { hiddenResume?.(); hiddenResume = null; }
  });
  $("game-next").onclick = () => review(reviewAt + 1);
  $("game-hold").onclick = () => {
    held = !held; root.dataset.held = String(held); $("game-hold").setAttribute("aria-pressed", String(held)); $("game-hold").setAttribute("aria-label", held ? "Resume" : "Hold");
    if (held) $("game-sub").textContent += " · held";
    $("game-hold").innerHTML = held ? PLAY_SVG : PAUSE_SVG; // board 5: held, Hold becomes Play
    if (held) { clearTimeout(timer); stopBar(); } else review(reviewAt);
  };
  $("game-again").onclick = start;
  $("game-home-play").onclick = start;
  $("game-home-play2").onclick = start;
  $("game-home-play3").onclick = start;
  $("game-home-btn").onclick = home;
  document.addEventListener("keydown", e => {
    if ($("game").hidden || e.target.closest("input,textarea,select") || e.metaKey || e.ctrlKey) return;
    if (!$("game-play").hidden && ["1", "2", "3", "4"].includes(e.key)) answer(Number(e.key) - 1);
    else if (!$("game-play").hidden && (e.key === "0" || e.key === "?")) answer(-1);
    else if (!$("game-review").hidden && (e.key === "Enter" || e.key === "ArrowRight")) review(reviewAt + 1);
    else if ((!$("game-done").hidden || !$("game-home").hidden) && e.key === "Enter") start();
  });
  // What a flag carries, so an audit can see the question exactly as shown:
  // the kind, prompt, sentence, the four choices, the answer and what was picked.
  const cardOf = (q, picked) => ({type: "n2-game", id: q.id, title: "Flag this question", text: q.prompt, quote: q.sentence || q.prompt,
    extra: {view: "game", kind: q.kind, mondai: q.mondai || null, target: q.target || null, sentence: q.sentence || "", choices: q.choices || [], answer: q.answer, picked: picked ?? null,
      source: q.solution?.source || null, why: q.solution?.why || "", meaning: q.solution?.meaning || "", reading: q.solution?.reading || ""}});
  reportCard = () => {
    if ($("game").hidden) return null;
    if (!$("game-review").hidden && misses[reviewAt]) return cardOf(misses[reviewAt].q, misses[reviewAt].picked);
    return current && !$("game-play").hidden ? cardOf(current) : null;
  };
  if (params.get("panel") === "radio") radioPanel(); else home();
}

// Yesterday's misses and uncertain answers, one session, print and audio. A
// print check writes its recall record; an audio check a listening event.
const DIMENSION = {meaning: "meaning", reading: "reading", grammar: "grammar"};
// Evening recall (n2-night.js) is the same session on tonight's items, before
// the Night Radio: same-day grades under EVENING_SOURCE, never a delayed check.
async function checks(mode = "check") {
  const evening = mode === "evening";
  show("check");
  if (params.get("view") !== mode) history.replaceState(history.state, "", "?view=" + mode);
  await materials();
  const data = await report(), evidence = scored(data);
  const items = checkItems(inventory);
  const session = evening
    ? eveningRecall({inventory, recall: data.recall, evidence, events: data.events, examples: await deckExamples(), items})
    : delayedChecks({inventory, recall: data.recall, evidence, events: data.events, examples: await everyExample(), items});
  const sourceOf = evening ? EVENING_SOURCE : CHECK_SOURCE;
  $("check-title").textContent = evening ? "Evening recall" : "Today's checks";
  $("check-seal").textContent = evening ? "夕" : "確";
  $("check-done-go").textContent = evening ? "Start the Night Radio" : "Back to today's plan";
  const fromGame = params.get("from") === "game";
  $("check-done-go").href = evening ? (fromGame ? "?view=game&panel=radio" : "./radio") : "./n2-mock.html";
  if (fromGame) $("check-back").href = evening ? "?view=game&panel=radio" : "?view=game";
  $("check").dataset.evening = String(evening);
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
  $("check-sub").textContent = session.length ? session.length + (evening ? " from today" : " from yesterday") + (byEar ? " · " + byEar + " by ear" : "") : "";
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
      $("check-prompt").textContent = evening ? "Nothing left from today." : "Nothing from yesterday.";
      $("check-prompt").classList.add("long");
      $("check-why").textContent = evening ? "Today's misses, guesses, slow answers and Day Radio plays come here once in the evening, in the sentence the Night Radio plays." : "Misses, guesses and slow answers from recall, mocks and Day Radio come back here the next day, in a sentence you did not see.";
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
    $("check-why").textContent = evening ? [WHY_LINE[c.why].replace("yesterday", "today"), c.example ? "the sentence tonight's radio plays" : "the word alone"].join(" · ") : [WHY_LINE[c.why] + (c.recurring ? ", and before" : ""), CONTEXT_SHORT[c.context === "fresh" ? (c.seen.length ? "fresh" : "") : c.context === "same" ? "same" : audio(c) ? "heard" : "word"]].filter(Boolean).join(" · ");
    $("check-note").textContent = [checkAsk(c) + ".", evening ? "Recalling it now, just before sleep, gives the night's cue something to strengthen." : contextNote(c)].filter(Boolean).join(" ").replace(/\.\./g, ".");
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
    $("check-evidence-kind").replaceChildren(el("span", {lang: "ja", text: c.text}), (audio(c) ? "listening" : c.dimension === "grammar" ? "grammar" : "written " + c.dimension) + (evening ? " · a same-day recall; tomorrow's check is the one that counts as another day" : " · Instant records “recalled on another day”" + (c.context === "fresh" ? " and “understood in a new passage”" : "")));
    $("check-evidence-line").textContent = audio(c) ? evidenceLine(c.target, {recall: data.recall, events: data.events}) : "Your listening record is unchanged.";
    $("check-evidence-open").onclick = () => openEvidence(c, evening ? "Why it is here: " + (WHY_LINE[c.why] || "").replace("yesterday", "today").toLowerCase() + ". Evening recall takes tonight's Night Radio items, both the cued and the held-back half." : "Why it was picked: " + (WHY_LINE[c.why] || "").toLowerCase() + (c.recurring ? ", and missed before too" : "") + ". Today's checks pick yesterday's misses, slow answers, guesses and Day Radio plays.");
    $("check-evidence").hidden = false;
  }
  async function grade(value) {
    const c = session[index]; if (!c || !revealed) return;
    revealed = false;
    const detail = {...checkDetail(c, {activeMs: clock.read(), responseMs, replays: audio(c) ? Math.max(0, plays - 1) : 0}), source: sourceOf};
    try {
      if (audio(c)) {
        const event = radioEvent({target: c.target, kind: "recall", grade: audioGrade(value), source: sourceOf, mode, exampleId: c.example?.id, detail});
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
    $("check-done-title").textContent = (session.length - skipped) + (evening ? " recalled before sleep" : " checked a day later");
    $("check-done-line").textContent = tally.instant + " instant · " + tally.slow + " slow · " + tally.missed + " missed · " + skipped + " skipped. " + (evening ? "Now the Night Radio: it cues today's items as you sleep, and tomorrow's checks test them all." : "Today's misses come back tomorrow.");
    if (!evening) nightLine().then(line => { $("check-night").textContent = line; $("check-night").hidden = !line; });
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
  if (FROM_GAME) { $("day-back").href = "?view=game&panel=radio"; $("day-done-back").href = "?view=game&panel=radio"; $("day-done-back").textContent = "Back to Radio"; }
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
  document.title = paper.title + " · JLPT " + (paper.level || "N2") + " · Echo";
  if (paper.level) $("exam-level").textContent = "JLPT " + paper.level + " · mock exam";
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
  // The boss (Quick round): the real paper at half the time. It stays a boss
  // once started, and never counts as a standard sitting (checkpoint, chart).
  if (state.phase === "ready" && params.get("boss") === "1" && (realistic(year) || levelSet)) state.boss = true;
  // Only the written clock halves: listening audio can't play faster.
  const half = (m, phase) => state.boss && phase === "written" ? Math.ceil(m / 2) : m;

  const minutes = phase => half(paper.minutes ? (typeof paper.minutes === "object" ? paper.minutes[phase] || 5 : paper.minutes) : adaptive ? Math.ceil((phase === "written" ? written : questions.length - written) * 1.5) : (phase === "written" ? 105 : 50), phase);
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
    // Quick round: the boss sitting starting is what closes the run (re-audit P2).
    if (state.boss && !state.bossTaken) { try { writeGame(takeBoss(readGame(), {set: year, attemptId: state.id})); } catch {} state.bossTaken = true; }
    state.phase = phase;
    state.index = phase === "written" ? 0 : written;
    entered = Date.now();
    state.deadline = entered + minutes(phase) * 60000;
    persist(); render(); scrollTo(0, 0);
  }
  function move(index) {
    if (!answering(state) || tick()) return;
    const [first, end] = range();
    if (index < first || index >= end) return;
    recordTime(); stopVoice();
    state.index = index;
    persist(); renderExam(); scrollTo(0, 0);
  }
  function choose(n) {
    if (!answering(state) || tick()) return;
    state.answers[state.index] = n;
    persist(); renderExam();
  }
  // The first time each question is on screen, separate from when the paper
  // was made: readiness counts only material actually seen (drillExposure).
  function markShown() {
    if (archivedView || !answering(state) || state.shownAt?.[state.index]) return;
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
    if (!answering(state)) return;
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
    // A level paper carries its tags and deciding lines on its own rows.
    const own = (field) => Object.fromEntries(paper.questions.filter(q => q[field]).map(q => [sourceOf(paper, q), q[field]]));
    Promise.all([tagMap(), cueMap()]).then(([map, cues]) => {
      if (paper.level) { map = {...map, ...own("tags")}; cues = {...cues, ...own("cues")}; }
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
  // practice, which opens what it names (resultPractice); retaking is a link.
  function resultActions(short) {
    const drill = $("result-drill");
    if (short || archivedView) { drill.hidden = true; return; }
    const rates = [0, 1, 2, 3].map(skill => { const rows = questions.filter(q => q.skill === skill); return {n: rows.length, got: rows.filter(q => state.answers[q.index] === q.key).length}; }); // as the score card counts
    const plan = resultPractice(rates);
    drill.textContent = plan.label; drill.hidden = false;
    drill.href = plan.href || "./n2-mock.html";
    drill.onclick = plan.section ? async event => { event.preventDefault(); startSection(plan.section, {data: await report()}); } : null;
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
    if (state.boss) { $("intro-title").textContent = "The boss · half-time written"; }
    $("intro-note").textContent = (state.boss ? "The real paper with the written section at half time: " + minutes("written") + " min written, then listening at its own length (" + minutes("listening") + " min). It counts for your run, not for the checkpoint. " : "") + "Leaving keeps your answers. The timer keeps running, as it would in the hall, unless you pause it.";
  }

  $("start").onclick = () => start(firstPhase);
  $("listen").onclick = () => start("listening");
  $("listen").textContent = "Start listening · " + minutes("listening") + " min";
  $("guess").innerHTML = flagSvg;
  $("guess").onclick = () => { if (!answering(state) || tick()) return; state.guesses[state.index] = !state.guesses[state.index]; persist(); renderExam(); };
  $("prev").onclick = () => move(state.index - 1);
  $("next").onclick = () => { const [, end] = range(); state.index === end - 1 ? openGrid() : move(state.index + 1); };
  $("grid-open").onclick = openGrid;
  $("grid-close").onclick = () => $("grid-dialog").close();
  $("submit").onclick = () => { if (answering(state) && !tick()) finish(); };
  $("exam-pause").onclick = pause; $("exam-resume").onclick = resume;
  $("speak").onclick = () => {
    if (!answering(state) || tick()) return;
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
    if (!answering(state) || $("grid-dialog").open || e.metaKey || e.ctrlKey || e.altKey || e.target.closest("audio,video,a,input,textarea,select,iframe")) return;
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
const route = year ? exam : view === "recall" ? recall : view === "check" ? checks : view === "evening" ? () => checks("evening") : view === "game" ? game : view === "radio" ? dayRadio : hub;
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
