import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const app=await readFile(new URL("../app.js",import.meta.url),"utf8");
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
const css=await readFile(new URL("../styles.css",import.meta.url),"utf8");

test("word mnemonic has working explicit edit delete regenerate and voice controls",()=>{
  for(const cls of ["note-adjust-mic","note-edit","note-save","note-delete","note-regenerate"])assert.match(html,new RegExp('class="[^"]*'+cls));
  assert.match(app,/text\.onblur=null/,"word note disables the generic blur-save race");
  assert.match(app,/edit\.onclick=/);assert.match(app,/saveEdit\.onclick=/);assert.match(app,/del\.onclick=async/);assert.match(app,/regen\.onclick=async/);
  assert.match(app,/deleteNote\(noteKey\("word",w\.id,"remember"\)\)/);
  assert.match(app,/bindDictation\(mic,instruction,status\)/);
  assert.match(app,/writeWordNote\(\{word:w\.w,reading:w\.r,meaning:w\.en\.join/,"regenerate starts from word data, not old note");
});

test("rewrite passes the actual current note and persists the replacement",()=>{
  assert.match(app,/adjustNote\(\{about,kind,current:block\.currentText\?block\.currentText\(\):current\(\),instruction\}/);
  assert.match(app,/note=await onSave\(made,"you"\)/);
});

test("library exposes skipped filter and review persists then clears skipped state",()=>{
  assert.match(html,/<option value="skipped">Skipped<\/option>/);
  assert.match(app,/filter==="skipped"\)return item\.skipped===true/);
  assert.match(app,/skipped:true,skippedAt:new Date/);
  assert.match(app,/skipped:false,skippedAt:null/);
});

test("URL restoration keeps page searches practice mode and open tool modal",()=>{assert.match(app,/async function applyRoute/);assert.match(app,/historyQuery/);assert.match(app,/mapQuery/);assert.match(app,/discussionMode/);assert.match(app,/route\.modal\.kind==="word"/);assert.match(app,/route\.modal\.kind==="kanji"/);assert.match(app,/route\.modal\.kind==="grammar"/)});

test("discussion uses shared composer and explicit sentence saving",()=>{assert.doesNotMatch(html,/id="discussion-scenario-mic"/);assert.match(app,/discussionScenario=\$\("#english-input"\)\.value\.trim/);assert.match(app,/save\.textContent=turn\.saved\?"Saved":"Save"/);assert.match(app,/saveDiscussionTurn\(turn/)});

test("settings support same-language pairs swap and three voice policies",()=>{
  assert.match(html,/id="settings-swap-langs"/);
  assert.match(html,/id="discussion-voice-ai"/);assert.match(html,/id="discussion-voice-user"/);
  assert.match(app,/Random voice/);assert.match(app,/Default voice/);
  assert.match(app,/setPair\(targetLang\(\),sourceLang\(\)\)/);
  assert.doesNotMatch(app,/if\(source===target\)source=/,"same-language pairs must not be rewritten");
});

test("target voice management is reachable from settings and missing-voice notice",()=>{
  assert.match(html,/id="voice-manage"/);assert.match(html,/id="voice-install"/);
  assert.match(app,/voice-manage/);assert.match(app,/voice-install/);
  assert.match(app,/installTargetVoice/);
});


test("word practice is creation from intent rather than validation",()=>{assert.match(html,/id="word-say-go"[^>]*><span class="label">Create sentence<\/span>/);assert.match(app,/composeWordFromIntent\(/);assert.doesNotMatch(app,/That sentence does not use \{word\}/);assert.match(app,/Give Echo the meaning you want to express/)});


test("navigation is URL-driven with browser back-forward restoration",()=>{assert.match(app,/import \{parseRoute,routeFor\} from "\.\/routes\.js"/);assert.match(app,/history\[replace\?"replaceState":"pushState"\]/);assert.match(app,/window\.addEventListener\("popstate",\(\)=>applyRoute\(\)\)/);assert.match(app,/async function applyRoute/);assert.match(app,/showView\("sentence",\{route:false\}\)/);assert.match(app,/openWord\(w,wordCoverage\(sentences\),\{route:false\}\)/)});

test("legacy workspace is only an upgrade bridge, not normal route restoration",()=>{assert.match(app,/One upgrade bridge only/);assert.match(app,/localStorage\.removeItem\(WORKSPACE_KEY\)/);assert.doesNotMatch(app,/async function restoreWorkspace/)});

test("discussion save uses explicit awaited persistence action",()=>{assert.match(app,/saveDiscussionTurn\(turn/);assert.match(app,/save\.textContent="Saving…"/);assert.match(app,/await saveDiscussionTurn/);assert.match(app,/catch\(error\)\{save\.disabled=false/)});


test("Mora v1 is learning content outside settings with independent display toggles",()=>{assert.match(html,/id="mora-view"/);assert.doesNotMatch(html,/Mora v1/);assert.match(html,/id="mora-show-emoji"/);assert.match(html,/id="mora-show-furigana"/);assert.match(html,/id="mora-show-english"/);assert.doesNotMatch(html,/<section class="settings-section"><h3>Memory — Mora v1/);assert.match(app,/MORA_MNEMONIC_META/);assert.match(app,/function renderMora/)});


test("GitHub Pages deep-link recovery runs before route parsing",()=>{const routeImport=app.indexOf('from "./routes.js"'),recovery=app.indexOf('echo-route');assert.ok(routeImport>=0&&recovery>routeImport);assert.match(app,/history\.replaceState\(\{echo:true\},"",p\)/)});


test("Mora emoji is a separate row after the kanji, not an inline anchor",()=>{assert.match(app,/mora-word.*?\$\{kanji\}.*?mora-emoji/s);assert.doesNotMatch(app,/class="mora-anchor"/)});


test("service worker updates never navigate or reload an open Echo page",async()=>{const fs=await import("node:fs/promises");const sw=await fs.readFile(new URL("../sw.js",import.meta.url),"utf8");assert.doesNotMatch(sw,/reloadClients/);assert.doesNotMatch(sw,/client\.navigate\(/);assert.match(sw,/self\.clients\.claim\(\)/)});


test("Discussion renders visible message bubbles and reuses the shared learner composer",()=>{assert.match(html,/id="discussion-turns" class="discussion-turns"/);assert.match(app,/className="discussion-bubble"/);assert.match(app,/className="discussion-japanese"/);assert.match(app,/className="discussion-turn "\+turn\.role/);assert.doesNotMatch(html,/id="discussion-input"/)});


test("Discussion renderer hides only setup, never the whole discussion after a turn",()=>{assert.match(html,/id="discussion-setup"/);assert.match(app,/\$\("#discussion-setup"\)\.hidden=!!discussionTurns\.length/);assert.doesNotMatch(app,/\$\("#discussion-begin"\)\.parentElement\.hidden/)});




test("Discussion reuses the sentence composer instead of owning a second reply input",()=>{assert.doesNotMatch(html,/id="discussion-input"/);assert.doesNotMatch(html,/id="discussion-mic"/);assert.match(app,/const message=\$\("#english-input"\)\.value\.trim\(\)/);assert.match(app,/discussionMode\?\(discussionTurns\.length\?replyDiscussion\(\):beginDiscussion\(\)\)/);assert.match(app,/classList\.toggle\("discussion-dock",discussionMode\|\|readingMode\)/)});


test("learner composition inputs share switch mic and submit affordances",()=>{for(const id of ["english-input","kanji-say","grammar-say","word-say"])assert.match(html,new RegExp('(?:learner-composer[^>]*>[\\s\\S]{0,900}id="'+id+'"|id="'+id+'"[\\s\\S]{0,900}data-input-swap)'));for(const id of ["kanji-say","grammar-say","word-say"])assert.match(html,new RegExp('data-input-swap="'+id+'"'))});

test("AI adjustment prompts support voice instructions",()=>{const panels=[...html.matchAll(/class="adjust-panel"/g)];const mics=[...html.matchAll(/class="mic note-adjust-mic"/g)];assert.ok(panels.length>0);assert.ok(mics.length>=panels.length);assert.match(app,/bindDictation\(adjustMic,input,pstatus\)/)});


test("component library is the authority for reusable learner interactions",async()=>{const fs=await import("node:fs/promises");const components=await fs.readFile(new URL("../components.js",import.meta.url),"utf8");assert.match(components,/export function learnerComposer/);assert.match(components,/export function wireLearnerComposer/);assert.match(components,/export function wireAIAdjuster/);const contract=await fs.readFile(new URL("../COMPONENTS.md",import.meta.url),"utf8");assert.match(contract,/one action, one implementation/i);assert.match(contract,/Do not copy component markup/i)});


test("maintainer constitution protects Echo product and visual philosophy",async()=>{const fs=await import("node:fs/promises");const guide=await fs.readFile(new URL("../CLAUDE.md",import.meta.url),"utf8");assert.match(guide,/Visual consistency is correctness/);assert.match(guide,/One action, one implementation/);assert.match(guide,/Could this screenshot plausibly be from a different app/);assert.match(guide,/Sentence and Discussion are two modes/)});

test("Practice mode selector and Discussion use Echo design tokens",()=>{assert.match(css,/\.practice-mode button\[aria-selected="true"\]::after[^}]*var\(--seal\)/);assert.match(css,/\.discussion-bubble\{[^}]*var\(--hairline\)[^}]*var\(--panel\)/s);assert.doesNotMatch(css,/\.practice-mode\{[^}]*border-radius:999px/)});

test("Discussion setup has no legacy input and uses the shared composer",()=>{assert.doesNotMatch(html,/id="discussion-scenario"/);assert.doesNotMatch(html,/id="discussion-scenario-mic"/);assert.match(app,/discussionScenario=\$\("#english-input"\)\.value\.trim/);assert.match(app,/discussionTurns\.length\?replyDiscussion\(\):beginDiscussion\(\)/)});
test("Reading mode generates selectable savable sentences with shared controls",()=>{assert.match(html,/id="mode-reading"/);assert.match(html,/id="reading-text"/);assert.match(html,/id="reading-furigana"/);assert.match(html,/id="reading-english"/);assert.match(html,/id="reading-echo"/);assert.match(app,/generateReadingMode/);assert.match(app,/saveReadingSentence/);assert.match(app,/discussionLoop\.playConversation\(readingPassage\.sentences/);assert.doesNotMatch(html,/id="reading-input"/)});

test("word learning keeps AI adjustment compact and sentence composer complete",()=>{assert.match(html,/class="word-note-more"/);assert.match(html,/id="word-say-go" class="primary composer-send"/);assert.match(css,/#word-note \.adjust-row\{display:grid/);assert.match(css,/\.tool-sheet \.kanji-say \.input-row\{display:grid;grid-template-columns:minmax\(0,1fr\) 48px 48px 52px/);});

test("every static dictation control uses the canonical RecordButton",async()=>{const fs=await import("node:fs/promises");const components=await fs.readFile(new URL("../components.js",import.meta.url),"utf8");assert.match(components,/export function recordButton/);assert.match(components,/export function hydrateRecordButtons/);assert.match(app,/hydrateRecordButtons\(\)/);assert.doesNotMatch(html,/<button[^>]*\bmic\b[^>]*>\s*(?:Mic|<svg|<span)/);for(const button of html.matchAll(/<button[^>]*\b(?:mic|mic-round)\b[^>]*>/g))assert.match(button[0],/data-record-button/);});

test("all static buttons and text fields are declared reusable components",()=>{for(const tag of html.matchAll(/<(button|textarea|select|input)\b[^>]*>/g)){const markup=tag[0];if(/^<input\b/.test(markup)&&/type="(?:checkbox|radio|range|file|hidden)"/.test(markup))continue;assert.match(markup,/data-ui=/,markup)}});
test("component library owns primitive actions and icons",async()=>{const fs=await import("node:fs/promises");const components=await fs.readFile(new URL("../components.js",import.meta.url),"utf8");for(const name of ["button","iconButton","recordButton","languageSwitchButton","submitButton","textInput","textArea","status","hydrateUI"])assert.match(components,new RegExp("export function "+name));assert.match(app,/hydrateUI\(\)/)});

test("language switches can never hydrate as record buttons",async()=>{const fs=await import("node:fs/promises");const components=await fs.readFile(new URL("../components.js",import.meta.url),"utf8");assert.match(components,/export function languageSwitchButton/);assert.match(components,/hydrateLanguageSwitchButtons/);for(const button of html.matchAll(/<button[^>]*\bswap\b[^>]*>/g)){assert.match(button[0],/data-language-switch/);assert.doesNotMatch(button[0],/data-record-button/)}assert.match(app,/hydrateRecordButtons\(\);hydrateLanguageSwitchButtons\(\)/)});
test("each study composer exposes switch mic and submit as distinct actions",()=>{for(const id of ["kanji-say","grammar-say","word-say"]){const i=html.indexOf('id="'+id+'"'),chunk=html.slice(i,i+1800);assert.match(chunk,/data-language-switch/);assert.match(chunk,/data-record-button/);assert.match(chunk,/(?:say-go|composer-send)/)}});