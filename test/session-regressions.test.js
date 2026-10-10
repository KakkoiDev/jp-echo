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

test("discussion uses shared composer and explicit sentence saving",()=>{assert.doesNotMatch(html,/id="discussion-scenario-mic"/);assert.match(app,/discussionScenario=\$\("#english-input"\)\.value\.trim/);assert.match(app,/save\.textContent=turn\.saved\?"Saved ✓":"Save to Library"/);assert.match(app,/saveDiscussionTurn\(turn/)});

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


test("word practice is creation from intent rather than validation",()=>{assert.match(html,/id="word-say-go"[^>]*><span class="label">→<\/span>/);assert.match(app,/composeFromIntent\(/);assert.doesNotMatch(app,/That sentence does not use \{word\}/);assert.match(app,/Give Echo the meaning you want to express/)});


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


test("maintainer constitution protects Echo product and visual philosophy",async()=>{const fs=await import("node:fs/promises");const guide=await fs.readFile(new URL("../CLAUDE.md",import.meta.url),"utf8");assert.match(guide,/Visual consistency is correctness/);assert.match(guide,/One action, one implementation/);assert.match(guide,/Could this screenshot plausibly be from a different app/);assert.match(guide,/There is no\s+mode bar, and the rows never hide/)});

test("Discussion uses Echo design tokens and there is no mode bar",()=>{assert.doesNotMatch(css,/\.practice-mode/);assert.match(css,/\.discussion-bubble\{[^}]*var\(--hairline\)[^}]*var\(--panel\)/s)});

test("Discussion setup has no legacy input and uses the shared composer",()=>{assert.doesNotMatch(html,/id="discussion-scenario"/);assert.doesNotMatch(html,/id="discussion-scenario-mic"/);assert.match(app,/discussionScenario=\$\("#english-input"\)\.value\.trim/);assert.match(app,/discussionTurns\.length\?replyDiscussion\(\):beginDiscussion\(\)/)});
test("Reading mode generates selectable savable sentences with shared controls",()=>{assert.match(html,/id="welcome-reading"/);assert.match(html,/id="reading-text"/);assert.match(html,/id="reading-furigana"/);assert.match(html,/id="reading-english"/);assert.match(html,/id="reading-echo"/);assert.match(app,/generateReadingMode/);assert.match(app,/saveReadingSentence/);assert.match(app,/readingLoop\.playConversation\(readingPassage\.sentences/);assert.doesNotMatch(html,/id="reading-input"/)});

test("word learning keeps AI adjustment compact and sentence composer complete",()=>{assert.match(html,/class="word-note-more"/);assert.match(html,/id="word-say-go" class="primary composer-send"/);assert.match(css,/#word-note \.adjust-row\{display:grid/);assert.match(css,/\.tool-sheet \.kanji-say \.input-row\{display:grid;grid-template-columns:minmax\(0,1fr\) 48px 48px 52px/);});


test("all static buttons and text fields are declared reusable components",()=>{for(const tag of html.matchAll(/<(button|textarea|select|input)\b[^>]*>/g)){const markup=tag[0];if(/^<input\b/.test(markup)&&/type="(?:checkbox|radio|range|file|hidden)"/.test(markup))continue;assert.match(markup,/data-ui=/,markup)}});
test("component library owns primitive actions and icons",async()=>{const fs=await import("node:fs/promises");const components=await fs.readFile(new URL("../components.js",import.meta.url),"utf8");for(const name of ["button","iconButton","recordButton","languageSwitchButton","submitButton","textInput","textArea","status","hydrateUI"])assert.match(components,new RegExp("export function "+name));assert.doesNotMatch(app,/hydrateUI\(\)/);});

test("each study composer exposes switch mic and submit as distinct actions",()=>{for(const id of ["kanji-say","grammar-say","word-say"]){const i=html.indexOf('id="'+id+'"'),chunk=html.slice(i,i+1800);assert.match(chunk,/data-language-switch/);assert.match(chunk,/data-record-button/);assert.match(chunk,/(?:say-go|composer-send)/)}});
test("language switch controls are complete before JavaScript hydration",()=>{for(const button of html.matchAll(/<button[^>]*data-language-switch[^>]*>[\s\S]*?<\/button>/g)){assert.match(button[0],/<svg/);assert.match(button[0],/<path/)}});


test("front page controls and bottom navigation are self-contained and wired",()=>{const i=html.indexOf('id="english-input"'),chunk=html.slice(i,i+3000);assert.match(chunk,/id="swap-langs"[\s\S]*?<svg/);assert.match(chunk,/id="microphone"[\s\S]*?<svg[^>]*class="mic-glyph"/);assert.match(chunk,/id="translate"[\s\S]*?<svg/);assert.match(app,/\$\("#tabs"\)\.addEventListener\("click"/);assert.match(app,/event\.target\.closest\("\.tab\[data-view\]"/)});

test("static microphone controls keep the canonical compact glyph",()=>{for(const button of html.matchAll(/<button[^>]*data-record-button[^>]*>[\s\S]*?<\/button>/g)){assert.match(button[0],/<svg class="mic-glyph" width="16" height="20"/);assert.doesNotMatch(button[0],/width="24" height="30"/)}});

test("dictation works independently of AI provider and keeps old Chrome fallback",async()=>{const fs=await import("node:fs/promises");const speech=await fs.readFile(new URL("../speech.js",import.meta.url),"utf8");assert.match(speech,/window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/);const start=app.indexOf("function bindDictation"),end=app.indexOf("function setupRecognition",start),block=app.slice(start,end);assert.doesNotMatch(block,/hasTranslator/);assert.match(block,/mic\.disabled=false/);assert.match(block,/recognitionFactory\(inputLang\)/);assert.match(block,/recognition\.start\(\)/);assert.match(block,/catch\(error\)/)});

test("Mora reference keeps its responsive five-column table styling",()=>{assert.match(css,/\.mora-row\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);assert.match(css,/\.mora-cell\{[^}]*display:flex[^}]*flex-direction:column/);assert.match(css,/\.mora-emoji\{display:block/);assert.match(css,/\.mora-controls label\{display:inline-flex/);assert.match(css,/@media\(max-width:520px\)/)});

test("dictation cannot remain stuck when Android native recognition hangs",()=>{const start=app.indexOf("function bindDictation"),end=app.indexOf("function setupRecognition",start),block=app.slice(start,end);assert.match(block,/watchdog=setTimeout/);assert.match(block,/recognition\.abort\(\)/);assert.match(block,/recordedFallback\(\)/);assert.match(block,/markNativeBroken\(\)/);assert.match(block,/aria-pressed/)});

test("dictation watchdog falls back instead of leaving native recognition active",()=>{const start=app.indexOf("function bindDictation"),end=app.indexOf("function setupRecognition",start),block=app.slice(start,end);assert.match(block,/watchdog=setTimeout/);assert.match(block,/active===recognition/);assert.match(block,/idle\(\);recordedFallback\(\)/);assert.ok(block.indexOf("watchdog=setTimeout")<block.indexOf("recognition.start()"))});


test("reading renders every generated sentence with the shared ruby renderer",()=>{const start=app.indexOf("function renderReading"),end=app.indexOf("async function saveReadingSentence",start),block=app.slice(start,end);assert.match(block,/readingPassage\.sentences\.forEach/);assert.match(block,/rubyHtml\(sentence\.target\)/);assert.doesNotMatch(block,/furiganaHTML/)});


test("reading renderer uses only defined shared escaping and ruby helpers",()=>{const start=app.indexOf("function renderReading"),end=app.indexOf("async function saveReadingSentence",start),block=app.slice(start,end);assert.match(block,/rubyHtml\(sentence\.target\)/);assert.match(block,/escapeText\(stripFurigana\(sentence\.target\)\)/);assert.match(block,/escapeText\(sentence\.source\)/);assert.doesNotMatch(block,/escapeHTML|furiganaHTML/)});

test("reading composer survives language UI refreshes",()=>{const start=app.indexOf("function applyLanguageUI"),end=app.indexOf("function applyTheme",start),block=app.slice(start,end);assert.match(block,/\$\("#english-input"\)\.placeholder=composerPlaceholder\(\)/,"one source for the placeholder");const modeStart=app.indexOf("function setPracticeMode"),modeEnd=app.indexOf("function renderDiscussion",modeStart),mode=app.slice(modeStart,modeEnd);assert.match(mode,/readingMode\?\(readingPassage\?"Another text":"What do you want to read\?"\)/);assert.match(mode,/readingMode\?"A topic, a level, a style…"/)});


test("reading tap reveals an explicit Save to Library action",()=>{const start=app.indexOf("function renderReading"),end=app.indexOf("async function generateReadingMode",start),block=app.slice(start,end);assert.match(block,/readingSelected=index;renderReading\(\)/);assert.match(block,/save\.textContent="Save to Library"/);assert.match(block,/await saveReadingSentence\(index\)/);assert.match(block,/save\.disabled=true/);assert.match(block,/s\.saved=true;renderReading\(\)/)});


test("reading has its own loop and controls before the passage",()=>{assert.match(app,/const readingLoop=new ConversationLoop/);const play=app.slice(app.indexOf("function playReading"),app.indexOf("function saveWorkspace"));assert.match(play,/readingLoop\.running/);assert.match(play,/readingLoop\.playConversation/);assert.doesNotMatch(play,/discussionLoop/)});


test("reading echo uses only the existing voice list and no undefined voice helper",()=>{const start=app.indexOf("function playReading"),end=app.indexOf("function saveWorkspace",start),block=app.slice(start,end);assert.match(block,/voices\.find\(v=>v\.default\)/);assert.match(block,/readingLoop\.playConversation/);assert.doesNotMatch(block,/voiceForPolicy/)});


test("Mora page teaches fused small kana and sokuon",()=>{
  assert.match(html,/Small kana — fuse/);
  for(const sample of ["きゃ = 木＋山","しゅ = 鹿＋雪","ちょ = 蝶々＋洋服","きって = 木 → 手×2"])assert.match(html,new RegExp(sample.replace(/[＋→×]/g,"\\$&")));
});


test("review sessions rotate one stored skill per sentence",()=>{
  assert.match(app,/ensureReviewTrack\(ensureSchedule\(item\)\)/);
  assert.match(app,/const mode=reviewMode\(sentence\)/);
  assert.match(app,/mode==="listening"/);
  assert.match(app,/mode==="reading"/);
  assert.match(app,/mode==="writing"/);
  assert.match(app,/recordReviewMode\(graded,rating,now\)/);
  assert.match(app,/rating,mode,echoes/);
  assert.match(html,/id="review-skills"/);assert.match(html,/id="review-mode-title"/);
  assert.match(html,/id="review-front-audio"/);
  assert.match(html,/id="review-capture-label"/);
});

test("Listening is audio-only, Reading is bare Japanese, and Writing requires typed Japanese",()=>{
  const start=app.indexOf("function renderReview"),end=app.indexOf("async function renderReviewComplete",start),block=app.slice(start,end);
  assert.match(block,/review-prompt"\)\.hidden=listening/);
  assert.match(block,/mode==="reading"\?reviewPlainJapanese\(sentence\):sentence\.source/);
  assert.match(block,/review-capture"\)\.hidden=!writing/);
  assert.match(block,/review-answer-tools"\)\.hidden=true/);
  assert.match(block,/if\(listening\)requestAnimationFrame/);
});


test("revealed review vocabulary opens the existing word dictionary sheet",()=>{const revealStart=app.indexOf("async function revealReview"),revealEnd=app.indexOf("function reviewRecognitionLang",revealStart),block=app.slice(revealStart,revealEnd);assert.match(block,/enableReviewVocabulary\(sentence,target\)/);assert.match(app,/function enableReviewVocabulary/);assert.match(app,/sentenceWords\(sentence\)/);assert.match(app,/wordMarks\(w\)/);assert.match(app,/openWord\(w,wordCoverage\(await listSentences\(\)\),\{route:false\}\)/)});


test("sentence register choice is stored per card and drives every review form",()=>{
  assert.match(html,/id="sentence-register"/);
  assert.match(html,/data-register="casual"/);
  assert.match(html,/data-register="polite"/);
  assert.match(app,/const sentenceRegister=item=>item\?\.reviewRegister==="polite"\?"polite":"casual"/);
  assert.match(app,/function reviewJapanese\(sentence\).*preferredTarget\(sentence\)/);
  assert.match(app,/function reviewPlainJapanese\(sentence\).*preferredPlainTarget\(sentence\)/);
  assert.match(app,/reviewRegister:button\.dataset\.register/);
  assert.match(app,/rubyHtml\(preferredTarget\(detail\)\)/);
  assert.match(app,/rubyHtml\(preferredTarget\(item\)\)/);
});


test("sentence detail exposes cumulative listening reading writing progress",()=>{
  assert.match(html,/id="sentence-review-track"/);
  // Tiles are built per sentence so the next skill can be lit (design handoff §4).
  assert.match(app,/\["listening","reading","writing"\]\.map\(mode=>\{const meta=reviewModeMeta\(mode\),tile=el\("span","skill-tile"\)/);
  assert.match(app,/tile\.dataset\.reviewTrack=mode/);
  assert.match(app,/trackedDetail\.reviewTrack\.completed\[mode\]/);
});

test("dictionary sentences keep vocabulary spans inline",()=>{assert.doesNotMatch(css,/\.kanji-sentence-text span\s*\{/);assert.match(css,/\.kanji-sentence-text>span\s*\{/)});
