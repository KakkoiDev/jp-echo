import {dictionaryReadings,backfillReadings} from "./readings.js";
import {validateDeckBackup,fetchDeckBackup} from './imports.js';
import {isSeeded,planMiniSentenceUpgrade,repairMiniImport} from './mini-imports.js';
import {applyI18n,setDictionary,t} from "./i18n.js";
import {earliestPair,flipSentence,isReversed,pairLooksSwapped,repairPair} from "./repair.js";
import {DEFAULT_PAIR,LANGUAGES,safeLanguage,MORA_MNEMONIC_META,createSentence,replaceSentenceContent,exportBackup,forAnki,hasFurigana,hasRegisters,languageName,mergeSentences,normalizeFurigana,rubySegments,rubyHtml,SCHEMA_VERSION,stripFurigana} from "./core.js";
import {isExactMatch,markAttempt,markTarget} from "./diff.js";
import {applyReadingCorrection,removeArchivedMiniCards,readImportRecovery,saveImportRecovery,deleteSentence as dbDeleteSentence,getSentence,listSentences,migrateStore,replaceAll,saveSentence as persistSentence} from "./db.js";
import {MIN_INTERVAL_MS,QUIET_MS,downloadBackup,parseGistId,shouldAutoBackup,uploadBackup} from "./gist-backup.js";
import {correctSentenceReadings,analyzeSentenceGrammar,askModel,rewriteSentence,adjustNote,carries,compose,composeFromIntent,PROVIDER_DEFAULTS,tagGrammar,translate,discuss,generateReading,writeNotes,writeWordNote,transcribeAudio} from "./api.js";
import {grammarListItems,setImportedGrammar,byLevel as grammarByLevel,cleanTags as grammarTags,coverage as grammarCoverage,hasGrammar,isTagged,learned as grammarLearned,LEVELS as GRAMMAR_LEVELS,point as grammarPoint,POINTS as GRAMMAR_POINTS,summarise as grammarSummarise,untagged as untaggedSentences} from "./grammar.js";
import {japaneseVoices,recognitionFactory,ShadowLoop,ConversationLoop} from "./speech.js";
import {STORIES} from "./stories.js";
import {coverage as kanjiCoverage,facts as kanjiFacts,jlptBands as kanjiBands,learned as kanjiLearned,LEVEL_LABELS,levelOf,nextUnmet,sentenceKanji,TOTAL as KANJI_TOTAL} from "./kanji.js";
import {searchGrammar,searchKanji,searchWords} from "./lookup.js";
import {setImportedWords,bands as wordBands,carries as carriesWord,coverage as wordCoverage,kindOf,learned as wordLearned,levelOf as wordLevel,marks as wordMarks,sentenceWords,wordSpans,TOTAL as WORD_TOTAL,word as wordById} from "./words.js";
import {deleteNote as dbDeleteNote,forBackup,getNote,listNotes,makeNote,mergeNotes,noteKey,putNote as dbPutNote,replaceNotes as dbReplaceNotes} from "./notes.js";
import {downloadAnkiDeck} from "./anki-export.js";
import {dueSentences,ensureSchedule,isDue,reviewSentence} from "./srs.js";
import {dueLine,ensureReviewTrack,nextSkill,recordReviewMode,reviewMode,reviewModeMeta,skillMix,skillReason} from "./review-modes.js";
import {DEFAULT_TIME,REMINDER_TAG,reminderText,shouldRemind} from "./reminders.js";
import {saveDiscussionTurn} from "./actions.js";
// New shared UI comes from the component library (COMPONENTS.md).
import {grammarList,skillGlyph,skillTrio,expandableList,fitTextArea} from "./components.js";
// Settings page state, declared before anything can read it (navigationState).
const SETTINGS_TITLES={main:"Settings",ai:"AI service",speech:"Speech recognition",backup:"Backup",import:"Import sentences",export:"Export",grammar:"Grammar"};
let settingsPage="main",settingsReturn="practice";
import {parseRoute,routeFor} from "./routes.js";
import {mergeCatalogues,readCatalogues,saveCatalogues} from "./catalogues.js";
let importedCatalogues=readCatalogues();
function applyCatalogues(){setImportedWords(importedCatalogues.words);setImportedGrammar(importedCatalogues.grammar)}
applyCatalogues();
let startupCleanup=Promise.resolve();
const grammarAnalysisCache=new Map();
async function saveSentence(sentence){
  const normalized=dictionaryReadings(sentence);if(!Object.hasOwn(normalized,"readingVersion"))delete sentence.readingVersion;Object.assign(sentence,normalized);
  const texts=[sentence.target,sentence.casualTarget,sentence.politeTarget].filter(Boolean).map(stripFurigana);
  const analyses=texts.map(text=>grammarAnalysisCache.get(text)||(sentence.grammarAnalysis||[]).find(a=>a.text===text)).filter(Boolean);
  if(analyses.length){sentence={...sentence,grammarAnalysis:[...new Map(analyses.map(a=>[a.text,a])).values()],grammar:grammarTags([...(sentence.grammar||[]),...analyses.flatMap(a=>a.grammar)])}}
  const saved=await persistSentence(sentence);markBackupDirty();if(!sentence.readingVersion)scheduleReadingBackfill();return saved;
}
// Every write that changes what a backup would contain goes through one of
// these, so the gist backup knows there is something new to upload.
async function deleteSentence(id){const done=await dbDeleteSentence(id);markBackupDirty();return done}
async function putNote(...args){const done=await dbPutNote(...args);markBackupDirty();return done}
async function deleteNote(...args){const done=await dbDeleteNote(...args);markBackupDirty();return done}
async function replaceNotes(...args){const done=await dbReplaceNotes(...args);markBackupDirty();return done}
const $=selector=>document.querySelector(selector);
try{const p=new URLSearchParams(location.search).get("echo-route")||sessionStorage.getItem("echo-route");if(p){sessionStorage.removeItem("echo-route");history.replaceState({echo:true},"",p)}}catch{}
// Preferences must not prevent the app from opening its IndexedDB library.
function storePreference(key,value){try{localStorage.setItem(key,value);return true}catch{return false}}
function readSettings(){try{const value=JSON.parse(localStorage.getItem("jp-echo-settings")||"{}");return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}catch{return {}}}
const settings=readSettings();
// Gemini 2.5 access is restricted for new projects. Migrate Echo's old default
// without overriding any other model the learner explicitly selected.
if(["gemini-2.5-flash","gemini-3.5-flash-lite"].includes(settings.providerModels?.google)){settings.providerModels.google=PROVIDER_DEFAULTS.google;storePreference("jp-echo-settings",JSON.stringify(settings))}
// Before anything reads the pair: a build shipped a swap button that reversed
// the stored pair rather than the input language, so a device left swapped
// reopens typing the language it is learning. Consumes its own evidence, so
// it runs once and then never again.
const pairWasRepaired=repairPair(settings);
if(pairWasRepaired||settings.basePair===undefined)storePreference("jp-echo-settings",JSON.stringify(settings));
const PLAY_ICON="M2 1.4 12 8 2 14.6V1.4Z",PAUSE_ICON="M2.5 1.5h3v13h-3zM7.5 1.5h3v13h-3z";
let current=null,detail=null,kanjiPlaying=null,translationFailure=null,voiceFailed=false,dictationReady=false,echoesAtCardStart=0,voices=[],installPrompt=null,reviewQueue=[],reviewIndex=0,reviewRevealed=false,reviewRecognition=null,reviewListening=false;
const loop=new ShadowLoop({onEcho:async()=>{const sheet=($("#kanji-dialog").open||$("#grammar-dialog").open||$("#word-dialog").open)&&kanjiPlaying,reviewing=!$("#review-view").hidden,viewingDetail=!$("#sentence-view").hidden,target=sheet?kanjiPlaying:reviewing?reviewQueue[reviewIndex]:viewingDetail?detail:current;if(!target||target.transient)return;target.echoCount=(Number(target.echoCount)||0)+1;target.updatedAt=new Date().toISOString();await saveSentence(target);if(reviewing){reviewQueue[reviewIndex]=target;tickCount($("#review-echo-count"),target.echoCount)}if(viewingDetail)tickCount($("#stat-echoes"),target.echoCount);if(current?.id===target.id){current=target;renderCount()}},onState:state=>{const label=({speaking:"Playing — say it with the voice",imitate:"Your turn — echo it",paused:"Paused",stopped:"Ready",error:"That voice could not play"})[state]||state,playing=state!=="stopped"&&state!=="error",text=state==="paused"?"Play":playing?"Pause":"Play";$("#review-loop-state").textContent=label;$("#sentence-loop-state").textContent=label;const active=playing&&state!=="paused";for(const echo of document.querySelectorAll(".arcs:not(.small)>.echo"))echo.classList.toggle("is-playing",active);$("#practice").classList.toggle("playing",active);$("#review-panel").classList.toggle("playing",active);$("#loop-state").textContent=label;$("#play-pause").textContent=text;$("#play-pause").setAttribute("aria-pressed",String(playing));$("#review-audio").textContent=state==="paused"||!playing?"Play the loop":"Pause the loop";$("#review-audio").setAttribute("aria-pressed",String(playing));
  const reviewFrontAudio=$("#review-front-audio");if(reviewFrontAudio){reviewFrontAudio.textContent=state==="paused"||!playing?"Play sentence":"Pause";reviewFrontAudio.setAttribute("aria-pressed",String(playing))}
  $("#sentence-play").setAttribute("aria-pressed",String(playing));const showPlay=state==="paused"||!playing;$("#sentence-play").lastChild.textContent=showPlay?"Play the loop":"Pause the loop";$("#sentence-play").querySelector("path").setAttribute("d",showPlay?PLAY_ICON:PAUSE_ICON);$("#sentence-view").classList.toggle("playing",active);
  for(const [dialog,state] of [["#kanji-dialog","#kanji-loop-state"],["#grammar-dialog","#grammar-loop-state"],["#word-dialog","#word-loop-state"]])if($(dialog).open){$(state).textContent=playing?label:"";
    // The row's button shows what a press will do: pause while it plays, play
    // while it is paused or another row has the loop.
    for(const row of document.querySelectorAll(dialog+" .kanji-sentences li")){const on=active&&row.dataset.id===kanjiPlaying?.id;row.classList.toggle("is-playing",on);
      const play=row.querySelector(".kanji-play");if(!play)continue;const showPlay=!on||state==="paused";play.querySelector("path").setAttribute("d",showPlay?PLAY_ICON:PAUSE_ICON);play.setAttribute("aria-label",showPlay?t("Play the loop"):t("Pause the loop"));play.setAttribute("aria-pressed",String(on&&state!=="paused"))}}
  // The voice notice follows what playback actually did, so it appears for a
  // device that truly cannot speak and clears the moment one does.
  if(state==="error"||state==="speaking"){const failed=state==="error";if(failed!==voiceFailed){voiceFailed=failed;if(!$("#main-view").hidden)renderPracticeNotices();renderVoiceNotices()}}}});
// Appearance > Motion. "system" sets no class and lets the device decide;
// "on" and "off" say so outright, which is the only way to keep the motion
// on a phone whose battery saver has switched the whole OS to reduced.
function applyMotion(motion=settings.motion||"system"){const root=document.documentElement;
  root.classList.toggle("motion-on",motion==="on");root.classList.toggle("motion-off",motion==="off")}
const sourceLang=()=>settings.sourceLang||DEFAULT_PAIR.sourceLang;
const targetLang=()=>settings.targetLang||DEFAULT_PAIR.targetLang;
// A sentence carries the pair it was made with, so an old card keeps rendering
// the way it was made even after the setting moves on.
// Guarded: the code is interpolated into lang="" markup, and a record imported
// before codes were validated may carry anything.
const itemTarget=item=>safeLanguage(item?.targetLang,DEFAULT_PAIR.targetLang);
const sentenceRegister=item=>item?.reviewRegister==="polite"?"polite":"casual";
const preferredTarget=item=>sentenceRegister(item)==="polite"?(item?.politeTarget||item?.target||""):(item?.casualTarget||item?.target||"");
const preferredPlainTarget=item=>sentenceRegister(item)==="polite"?(item?.plainPoliteTarget||item?.plainTarget||stripFurigana(preferredTarget(item))):(item?.plainCasualTarget||item?.plainTarget||stripFurigana(preferredTarget(item)));
function setPair(source,target){
  settings.sourceLang=source;settings.targetLang=target;
  storePreference("jp-echo-settings",JSON.stringify(settings));
  inputLang=source;
  syncLanguageSelects();applyLanguageUI();populateVoices();setupRecognition();applyLanguage();
  if(!hasFurigana(target)&&document.body.dataset.view==="map")showView("practice");
}
// Which language you are typing, which is not which language you are learning.
// The configured pair may also be same-language (for example Japanese to Japanese).
// This transient toggle only chooses which side the composer accepts.
//
// Deliberately not persisted. Every launch starts on the language you know,
// because that is what the app is for; the other direction is the errand.
let inputLang=settings.sourceLang||DEFAULT_PAIR.sourceLang;
const enteringTarget=()=>inputLang===targetLang();
function setInputLang(code){inputLang=code;applyLanguageUI();setupRecognition()}
// The interface follows the language you write in, because that is the one
// you know. English is the language the strings are written in, so it needs no
// catalogue and no fetch.
async function applyLanguage(){
  const code=sourceLang();
  if(code==="en"){setDictionary(null);applyI18n();return}
  try{const module=await import(`./i18n/${code}.js`);setDictionary(module.default)}
  catch{setDictionary(null)}  // no catalogue for that language yet: stay in English
  applyI18n();
}
function syncLanguageSelects(){
  for(const id of ["#source-lang","#setup-source"])fillLanguageSelect($(id),sourceLang());
  for(const id of ["#target-lang","#setup-target"])fillLanguageSelect($(id),targetLang());
}
function fillLanguageSelect(select,selected){
  select.replaceChildren(...LANGUAGES.map(([code,name])=>{const o=new Option(name,code);o.selected=code===selected;return o}));
}
// Furigana and the casual/polite pair only mean something in Japanese.
function applyLanguageUI(){
  const swap=$("#swap-langs");
  const label=t("Type in {language} instead",{language:t(languageName(enteringTarget()?sourceLang():targetLang()))});
  swap.title=label;swap.setAttribute("aria-label",label);
  swap.classList.toggle("is-swapped",enteringTarget());
  swap.setAttribute("aria-pressed",String(enteringTarget()));
  const target=targetLang(),registers=hasRegisters(target),furigana=hasFurigana(target);
  $("#show-furigana").closest("label").hidden=!furigana;
  $("#show-polite").closest("label").hidden=!registers;
  if(document.body.dataset.view==="map"&&!furigana)showView("library");
  $("#grammar-settings").hidden=!(furigana&&hasGrammar());
  $("#voice-label").textContent=languageName(target)+" voice";
  $("#english-input").placeholder=discussionMode?(discussionTurns.length?"Reply in either language":"Describe a conversation scenario"):readingMode?"Describe a text to generate":t("Enter a sentence in {language}",{language:t(languageName(inputLang))});
  $("#voice-warning").textContent="No "+languageName(target)+" voice is installed on this device.";
}
function applyTheme(theme=settings.theme||"system"){document.documentElement.dataset.theme=theme;const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);const metas=document.querySelectorAll('meta[name="theme-color"]');
  // Two metas let the system default follow prefers-color-scheme; an explicit
  // choice overrides both so the status bar never disagrees with the app.
  if(theme==="system"){metas[0].content="#F3F0E7";if(metas[1])metas[1].content="#191712"}
  else for(const meta of metas)meta.content=dark?"#191712":"#F3F0E7"}
function showProviderConfig(){const provider=$("#provider").value;document.querySelectorAll(".provider-config").forEach(node=>node.hidden=node.dataset.provider!==provider)}
// Preferences apply as they change: each control commits on "change", and the
// header says so once the write has landed. Credentials never pass through
// here — they have explicit saves (saveAIService, saveSpeech), so a toggle on
// the Practice screen can never commit a half-typed key.
function saveSettings(){settings.theme=$("#theme").value;settings.motion=$("#motion").value;settings.voice=$("#voice").value;settings.discussionVoiceAI=$("#discussion-voice-ai").value;settings.discussionVoiceUser=$("#discussion-voice-user").value;settings.rate=Number($("#rate").value);settings.showEnglish=$("#show-english").checked;settings.showFurigana=$("#show-furigana").checked;settings.showPolite=$("#show-polite").checked;settings.autoTag=$("#autotag").checked;settings.remindTime=$("#remind-time").value;
  const gistWasOn=!!settings.gistAuto;settings.gistAuto=$("#gist-auto").checked;settings.gistUrl=$("#gist-url").value.trim();
  // Turning automatic backup on is an explicit act, so it takes the token typed beside it.
  if(settings.gistAuto&&!gistWasOn)settings.gistToken=$("#gist-token").value.trim();
  const saved=persistSettings();applyTheme();applyMotion();
  if(settings.gistAuto&&!gistWasOn){patchGistState({dirty:true,lastChangeAt:0});maybeAutoBackup("open").catch(()=>{})}renderGistStatus();renderSettingsRows();if(saved)flashSaved();return saved}
// One write path; true only when the browser actually kept it.
function persistSettings(){try{storePreference("jp-echo-settings",JSON.stringify(settings));return JSON.parse(localStorage.getItem("jp-echo-settings")||"null")!==null}catch{return false}}
let savedTimer=null;
function flashSaved(text="Saved"){const note=$("#settings-saved");if(!note)return;note.textContent=text;clearTimeout(savedTimer);savedTimer=setTimeout(()=>note.textContent="Saved as you go",2200)}
function resetSettingsForm(){const keys=settings.providerKeys||{},models=settings.providerModels||{};$("#provider").value=defaultProvider();$("#speech-provider").value=settings.speechProvider||"auto";$("#groq-speech-key").value=settings.speechKeys?.groq||"";$("#deepseek-key").value=keys.deepseek||settings.apiKey||"";$("#google-key").value=keys.google||"";$("#openai-key").value=keys.openai||"";$("#anthropic-key").value=keys.anthropic||"";for(const provider of Object.keys(PROVIDER_DEFAULTS))$("#"+provider+"-model").value=models[provider]||PROVIDER_DEFAULTS[provider];$("#local-endpoint").value=settings.localEndpoint||"http://localhost:11434/v1/chat/completions";$("#proxy-url").value=settings.proxyUrl||"";$("#theme").value=settings.theme||"system";$("#motion").value=settings.motion||"system";$("#autotag").checked=!!settings.autoTag;$("#remind").checked=!!settings.remind;$("#remind-time").value=settings.remindTime||DEFAULT_TIME;$("#gist-auto").checked=!!settings.gistAuto;$("#gist-token").value=settings.gistToken||"";$("#gist-url").value=settings.gistUrl||"";renderGistStatus();$("#remind-reach").textContent=settings.remind?reminderReach():"";$("#voice").value=settings.voice||"default";$("#discussion-voice-ai").value=settings.discussionVoiceAI||"default";$("#discussion-voice-user").value=settings.discussionVoiceUser||"default";$("#rate").value=settings.rate||1;$("#rate-value").textContent=Number($("#rate").value).toFixed(1)+"×";showProviderConfig()}
// Settings is a page (/settings, /settings/<sub-page>), not a modal.
function openSettings(page="main",{route=true}={}){const view=document.body.dataset.view,entering=view!=="settings";if(entering){if(view)settingsReturn=view;settingsStack=route?["out"]:[]}
  // Browser Back from a sub-page lands here with route:false: drop that push.
  else if(!route&&page==="main"&&settingsStack[settingsStack.length-1]==="main")settingsStack.pop();
  resetSettingsForm();updateInstallUI();listSentences().then(renderStarterOffer).catch(()=>{});showView("settings",{route:false});showSettingsPage(page,{route,fresh:entering})}
function showSettingsPage(page,{route=true,fresh=false}={}){const previous=settingsPage;settingsPage=SETTINGS_TITLES[page]?page:"main";
  if(route&&!fresh&&previous==="main"&&settingsPage!=="main")settingsStack.push("main");
  for(const node of document.querySelectorAll("#settings-view .settings-page"))node.hidden=node.dataset.settingsPage!==settingsPage;
  $("#settings-heading").textContent=t(SETTINGS_TITLES[settingsPage]);$("#settings-saved").hidden=settingsPage!=="main";
  if(settingsPage==="ai"){$("#ai-status").textContent="";showProviderConfig()}if(settingsPage==="speech")$("#speech-status").textContent="";
  renderSettingsRows();if(route)syncRoute({view:"settings",settingsPage});document.querySelector("#settings-view")?.scrollTo?.(0,0);scrollTo(0,0)}
// Back steps back through history when the entry before is where Back leads
// (so the browser's Back stays in step). settingsStack records the pushes made
// in this session: "out" = entered Settings from another view, "main" = opened
// a sub-page from /settings. After a reload or deep link it is empty, and Back
// navigates instead.
let settingsStack=[];
function leaveSettings(){const target=settingsPage!=="main"?"main":"out";
  if(settingsStack[settingsStack.length-1]===target){settingsStack.pop();history.back();return}
  // Pushing /settings here means the entry behind is no longer "outside".
  if(target==="main"){settingsStack=[];return showSettingsPage("main")}settingsStack=[];showView(settingsReturn==="settings"?"practice":settingsReturn)}
// SettingsRow statuses: one line each, true to what is stored.
function renderSettingsRows(){if(!$("#settings-status-ai"))return;
  const provider=defaultProvider(),names={google:"Google Gemini",deepseek:"DeepSeek",openai:"OpenAI",anthropic:"Anthropic",local:"Local AI"};
  $("#settings-status-ai").textContent=names[provider]+(provider==="local"?(settings.localEndpoint?" · endpoint saved":" · no endpoint yet"):(settings.providerKeys?.[provider]?" · key saved ✓":" · no key yet"));
  $("#settings-status-speech").textContent={auto:"Auto — browser, then Groq",browser:"Browser only",groq:"Groq Whisper",google:"Gemini"}[settings.speechProvider||"auto"]||"Auto — browser, then Groq";
  $("#settings-status-grammar").textContent=settings.autoTag?"Read new sentences automatically":"Explained only when I ask";$("#settings-row-grammar").hidden=targetLang()!=="ja";
  $("#settings-status-import").textContent=targetLang()==="ja"?"A deck file, a URL, or the ミニ本語 Minihongo starter":"A deck file or a URL";
  $("#settings-status-export").textContent="An Anki deck, or a backup file";
  const gist=gistState(),status=$("#settings-status-backup");status.classList.toggle("ok",!!(settings.gistAuto&&gist.lastSuccessAt&&!gist.lastError));status.classList.toggle("error",!!gist.lastError);
  status.textContent=gist.lastError?"Last backup failed — open to see why":settings.gistAuto&&gist.lastSuccessAt?"Backed up to your gist · "+gistWhen(gist.lastSuccessAt):settings.gistAuto?"Gist backup is on — nothing backed up yet":"Off — back up to a GitHub gist"}
// Credentials: explicit saves. The AI key is checked only when asked (one request).
function aiFormSettings(){const provider=$("#provider").value,keys={...(settings.providerKeys||{})},models={...(settings.providerModels||{})};
  if(provider!=="local"){keys[provider]=$("#"+provider+"-key").value.trim()}models[provider]=$("#"+provider+"-model").value.trim();
  return {...settings,provider,providerKeys:keys,providerModels:models,localEndpoint:provider==="local"?$("#local-endpoint").value.trim():settings.localEndpoint,proxyUrl:$("#proxy-url").value.trim()}}
function saveAIService(){const next=aiFormSettings();Object.assign(settings,{provider:next.provider,providerKeys:next.providerKeys,providerModels:next.providerModels,localEndpoint:next.localEndpoint,proxyUrl:next.proxyUrl});
  $("#ai-status").textContent=persistSettings()?(next.provider==="local"?"Saved. Echo will use this endpoint.":"Key saved on this device."):"This browser would not store it. Check that site storage is allowed.";renderSettingsRows();renderPracticeNotices?.()}
async function checkAIService(){const button=$("#ai-check"),next=aiFormSettings();if(next.provider!=="local"&&!next.providerKeys[next.provider]){$("#ai-status").textContent="Paste a key first.";return}
  button.disabled=true;$("#ai-status").textContent="Checking…";
  try{await translate("Good morning.",{...next,sourceLang:"en",targetLang:targetLang()});$("#ai-status").textContent="The key works — checked just now. The check used one request."}
  catch(error){$("#ai-status").textContent="That did not work: "+(error.message||error)}finally{button.disabled=false}}
function removeAIKey(){const provider=$("#provider").value;
  if(provider==="local"){settings.localEndpoint="";$("#local-endpoint").value=""}else{settings.providerKeys={...(settings.providerKeys||{}),[provider]:""};if(provider==="deepseek")delete settings.apiKey;$("#"+provider+"-key").value=""}
  $("#ai-status").textContent=persistSettings()?"Removed from this device. Your sentences stay.":"This browser would not update its storage.";renderSettingsRows();renderPracticeNotices?.()}
function saveSpeech(){settings.speechProvider=$("#speech-provider").value;settings.speechKeys={...(settings.speechKeys||{}),groq:$("#groq-speech-key").value.trim()};
  $("#speech-status").textContent=persistSettings()?"Saved on this device.":"This browser would not store it.";renderSettingsRows();setupRecognition?.()}
function isInstalled(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true}
function updateInstallUI(){const installed=isInstalled();$("#install-app").disabled=installed;$("#install-app").textContent=installed?"Installed":"Install";$("#install-status").textContent=installed?"Opened as an installed app.":""}
async function installApp(){if(isInstalled())return updateInstallUI();if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;$("#install-status").textContent=choice.outcome==="accepted"?"Installation started.":"Installation was cancelled.";return updateInstallUI()}$("#install-status").textContent=/iphone|ipad|ipod/i.test(navigator.userAgent)?"In Safari, tap Share, then Add to Home Screen.":"Open the browser menu and choose Install app or Add to Home screen."}
// The class comes off on animationend, as the spec asks, so a count that
// ticks twice in a row restarts the animation instead of swallowing it.
function tickCount(node,value){const text=String(value);if(!node||node.textContent===text)return;node.textContent=text;node.classList.remove("just-ticked");void node.offsetWidth;node.classList.add("just-ticked");node.addEventListener("animationend",()=>node.classList.remove("just-ticked"),{once:true})}
function renderCount(){tickCount($("#echo-count"),current?.echoCount??0)}
function selectedJapanese(){return current&&hasRegisters(itemTarget(current))?preferredTarget(current):(current?.target||"")}
function selectedPlainJapanese(){return current&&hasRegisters(itemTarget(current))?preferredPlainTarget(current):(current?.plainTarget||stripFurigana(current?.target||""))}
function resetSession(){loop.stop()}
function renderSentence(){const panel=$("#practice");panel.hidden=!current;$("#welcome").hidden=!!current;document.body.classList.toggle("has-sentence",!!current);if(!current)return;$("#japanese").innerHTML=rubyHtml(selectedJapanese());enableVocabulary($("#japanese"),selectedJapanese(),itemTarget(current),current);$("#english-display").textContent=current.source;$("#english-display").hidden=!$("#show-english").checked;panel.classList.toggle("hide-furigana",!$("#show-furigana").checked);renderCount();populateVoices()}
function openSentence(sentence){resetSession();current=sentence;if(hasRegisters(itemTarget(sentence)))$("#show-polite").checked=sentenceRegister(sentence)==="polite";$("#english-input").value=sentence.source;if(enteringTarget())setInputLang(sourceLang());showView("practice");renderSentence()}

let discussionMode=false,readingMode=false,discussionTurns=[],discussionScenario="",readingPassage=null,readingSelected=-1;
const discussionLoop=new ConversationLoop({onEcho:()=>{},onState:(state,index)=>{const n=$("#discussion-loop-state");if(n)n.textContent=state==="speaking"?`Playing turn ${(index??0)+1} of ${discussionTurns.length}`:state==="imitate"?"Your turn - echo it":state==="paused"?"Paused":state==="error"?"That voice could not play":"Ready"}});
const readingLoop=new ConversationLoop({onEcho:()=>{},onState:(state,index)=>{const n=$("#reading-loop-state"),button=$("#reading-echo");if(n)n.textContent=state==="speaking"?`Playing sentence ${(index??0)+1} of ${readingPassage?.sentences.length||0}`:state==="imitate"?"Your turn — echo it":state==="paused"?"Paused":state==="error"?"That voice could not play":"Ready";if(button){const active=state==="speaking"||state==="imitate"||state==="paused";button.textContent=state==="paused"?"Resume":active?"Pause":"Start echo";button.setAttribute("aria-pressed",String(active))}}});
function setPracticeMode(mode,{route=true}={}){discussionMode=mode==="discussion";readingMode=mode==="reading";saveWorkspace({discussionMode,readingMode});if(route)syncRoute({view:"practice",discussionMode,readingMode});$("#discussion").hidden=!discussionMode;$("#reading").hidden=!readingMode;$("#welcome").hidden=discussionMode||readingMode||!!current;$("#practice").hidden=discussionMode||readingMode||!current;$(".dock").hidden=false;$(".dock").classList.toggle("discussion-dock",discussionMode||readingMode);$("#composer-label").textContent=composerLabel();renderWelcomeModes();$("#translate .label").textContent=discussionMode?"Send":readingMode?"Generate":"Translate";$("#translate").setAttribute("aria-label",discussionMode?"Send":readingMode?"Generate reading":"Translate");$("#english-input").placeholder=discussionMode?(discussionTurns.length?"Reply in either language":"Describe a conversation scenario"):readingMode?"Describe a text to generate":"Enter a sentence in "+languageName(inputLang);$("#mode-sentence").setAttribute("aria-selected",String(mode==="sentence"));$("#mode-discussion").setAttribute("aria-selected",String(discussionMode));$("#mode-reading").setAttribute("aria-selected",String(readingMode));loop.stop();discussionLoop.stop();readingLoop.stop()}
// One place for the composer label: Discussion asks for a scene until it starts.
function composerLabel(){return discussionMode?(discussionTurns.length?"Reply to the conversation":"Describe the conversation"):readingMode?"What do you want to read?":"What do you want to say?"}
function renderDiscussion(){if(discussionMode)$("#composer-label").textContent=composerLabel();const list=$("#discussion-turns");list.replaceChildren(...discussionTurns.map(turn=>{const li=document.createElement("li");li.className="discussion-turn "+turn.role;const bubble=document.createElement("div");bubble.className="discussion-bubble";const ja=document.createElement("p");ja.className="discussion-japanese";ja.lang=targetLang();ja.innerHTML=rubyHtml(turn.target);enableVocabulary(ja,turn.target,targetLang(),turn);const en=document.createElement("p");en.className="discussion-translation";en.textContent=turn.source;en.hidden=!$("#discussion-english").checked;const actions=document.createElement("div");actions.className="discussion-message-actions";const save=document.createElement("button");save.type="button";save.className="plain discussion-save";save.textContent=turn.saved?"Saved":"Save";save.disabled=!!turn.saved;save.onclick=async()=>{save.disabled=true;const previous=save.textContent;save.textContent="Saving…";try{await saveDiscussionTurn(turn,{sourceLang:sourceLang(),targetLang:targetLang(),save:saveSentence});turn.saved=true;save.textContent="Saved";refreshDueBadge();toast("Saved to your library.")}catch(error){save.disabled=false;save.textContent=previous;toast(sheetError(error),5000)}};actions.append(save);bubble.append(ja,en,actions);li.append(bubble);return li}));$("#discussion-live").hidden=!discussionTurns.length;$("#discussion-setup").hidden=!!discussionTurns.length;$("#discussion-title").textContent=discussionScenario;requestAnimationFrame(()=>{if(discussionTurns.length)list.lastElementChild?.scrollIntoView({block:"nearest",behavior:"smooth"})})}
function playDiscussion(){if(discussionLoop.running){discussionLoop.togglePause();return}const pick=policy=>{if(!voices.length)return null;if(policy==="random")return voices[Math.floor(Math.random()*voices.length)];if(policy==="default")return voices.find(v=>v.default)||voices[0];return voices[Number(policy)]||voices[0]};discussionLoop.playConversation(discussionTurns.map(t=>({text:t.target,role:t.role})),{voiceFor:turn=>pick(turn.role==="ai"?$("#discussion-voice-ai").value:$("#discussion-voice-user").value),rate:Number($("#rate").value),lang:targetLang()})}
async function beginDiscussion(){if($("#translate").disabled)return;const typed=$("#english-input").value;discussionScenario=$("#english-input").value.trim()||"An everyday conversation";$("#english-input").value="";$("#discussion-status").textContent="Starting…";$("#translate").disabled=true;try{const out=await discuss({scenario:discussionScenario,history:[]},{...settings,sourceLang:sourceLang(),targetLang:targetLang()});discussionTurns=[{role:"ai",...out.ai}];renderDiscussion();playDiscussion();markModeUsed("discussion");$("#discussion-status").textContent=""}catch(e){if(!$("#english-input").value.trim())$("#english-input").value=typed;$("#discussion-status").textContent=e.message}finally{$("#translate").disabled=false}}
async function replyDiscussion(){const message=$("#english-input").value.trim();if(!message)return;discussionLoop.stop();$("#discussion-status").textContent="Replying…";$("#translate").disabled=true;try{const out=await discuss({scenario:discussionScenario,message,history:discussionTurns},{...settings,sourceLang:sourceLang(),targetLang:targetLang()});discussionTurns.push({role:"user",...out.user},{role:"ai",...out.ai});$("#english-input").value="";renderDiscussion();playDiscussion();$("#discussion-status").textContent=""}catch(e){$("#discussion-status").textContent=e.message}finally{$("#translate").disabled=false}}
const PREFS_CACHE="jp-echo-prefs",PREFS_KEY="./reminder";
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const canSyncInBackground=()=>"serviceWorker" in navigator&&"PeriodicSyncManager" in window;
// Echo has no server, so nothing can be pushed. The service worker is woken by
// Periodic Background Sync where that exists; everywhere else the check runs
// when the app is opened. Say which, rather than promise either.
function reminderReach(){
  if(!("Notification" in window))return "This browser cannot show notifications, so this does nothing here.";
  if(canSyncInBackground())return isStandalone()?"Your device wakes Echo to check, so a reminder arrives near the time you picked.":"Install Echo and your device will wake it to check. Until then it can only check when you open it.";
  if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!isStandalone())return "On iPhone, add Echo to the Home Screen first. Even then this browser only checks when Echo is open, so a reminder waits for you there.";
  return "This browser only checks when Echo is open, so a reminder waits for you the next time you open it.";
}
async function readReminderPrefs(){try{const cache=await caches.open(PREFS_CACHE),response=await cache.match(PREFS_KEY);return response?await response.json():null}catch{return null}}
async function writeReminderPrefs(){try{const cache=await caches.open(PREFS_CACHE);
  await cache.put(PREFS_KEY,new Response(JSON.stringify({enabled:!!settings.remind,time:settings.remindTime||DEFAULT_TIME,lastShownAt:Number(settings.remindLastShownAt)||0}),{headers:{"Content-Type":"application/json"}}))}catch{}}
async function syncReminderSchedule(){
  if(!("serviceWorker" in navigator))return;
  try{const registration=await navigator.serviceWorker.ready;
    if(!registration.periodicSync)return;
    if(!settings.remind)return registration.periodicSync.unregister(REMINDER_TAG).catch(()=>{});
    const status=await navigator.permissions.query({name:"periodic-background-sync"}).catch(()=>null);
    if(!status||status.state==="granted")await registration.periodicSync.register(REMINDER_TAG,{minInterval:6*60*60*1000})}catch{}}
async function enableReminders(){
  if(!("Notification" in window))return false;
  if(Notification.permission==="granted")return true;
  if(Notification.permission==="denied")return false;
  return await Notification.requestPermission()==="granted"}
async function remindOnOpen(){
  if(!("Notification" in window)||Notification.permission!=="granted"||!settings.remind)return;
  const stored=await readReminderPrefs();
  if(stored&&Number(stored.lastShownAt)>(Number(settings.remindLastShownAt)||0))settings.remindLastShownAt=Number(stored.lastShownAt);
  const due=dueSentences((await listSentences()).map(item=>ensureSchedule(item))).length;
  if(!shouldRemind({enabled:true,time:settings.remindTime||DEFAULT_TIME,lastShownAt:settings.remindLastShownAt,due}))return;
  try{const registration=await navigator.serviceWorker.ready;
    await registration.showNotification("Echo",{body:reminderText(due),tag:REMINDER_TAG,icon:"./icon-192.png",badge:"./icon-192.png",data:{view:"review"}});
    settings.remindLastShownAt=Date.now();storePreference("jp-echo-settings",JSON.stringify(settings));writeReminderPrefs()}catch{}}
const PROVIDER_NAMES={deepseek:"DeepSeek",google:"Gemini",openai:"OpenAI",anthropic:"Anthropic",local:"your local model"};
// The page that actually mints the key, not the marketing front door.
// Gemini is the default for someone arriving with nothing, but a stored key
// outranks it: changing the default must not tell an existing DeepSeek user to
// go and get a Gemini key.
function defaultProvider(){
  if(settings.provider)return settings.provider;
  const keys=settings.providerKeys||{};
  for(const name of ["google","deepseek","openai","anthropic"])if(keys[name])return name;
  if(settings.apiKey)return "deepseek";
  if(settings.localEndpoint)return "local";
  return "google";
}
const PROVIDER_KEY_URLS={google:"https://aistudio.google.com/apikey",deepseek:"https://platform.deepseek.com/api_keys",
  openai:"https://platform.openai.com/api-keys",anthropic:"https://console.anthropic.com/settings/keys"};
const ICONS={
  alert:'<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="7.6" stroke="currentColor" stroke-width="1.4"/><path d="M9 5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="12.6" r="1" fill="currentColor"/></svg>',
  failed:'<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 1.6 16.8 15H1.2L9 1.6Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 6.6v3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="12.6" r="1" fill="currentColor"/></svg>',
  offline:'<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M1.4 6.4a11 11 0 0 1 15.2 0M4.2 9.6a7 7 0 0 1 9.6 0M7 12.8a3 3 0 0 1 4 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2.2 2.2 15.8 15.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  voice:'<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M2 6.6h3l4-3.2v11.2l-4-3.2H2V6.6Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12.4 6.2 16 9.8M16 6.2l-3.6 3.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'};
// One shape for every blocked state: a hairline box, a mark, what happened, and
// the one action that fixes it. See Messages.dc.html.
function notice({icon,title,copy,alert=false,link,actions=[]}){
  const node=document.createElement("div");
  node.className="notice"+(alert?" alert":"");
  node.innerHTML=ICONS[icon]+'<div class="notice-body"><span class="notice-title"></span><span class="notice-copy"></span></div>';
  node.querySelector(".notice-title").textContent=title;
  node.querySelector(".notice-copy").textContent=copy;
  const body=node.querySelector(".notice-body");
  if(link){const button=document.createElement("button");button.type="button";button.className="notice-link";button.textContent=link.label;button.onclick=link.onClick;body.append(button)}
  if(actions.length){const row=document.createElement("div");row.className="notice-actions";
    for(const action of actions){const button=document.createElement("button");button.type="button";button.className=action.outline?"outline":"";button.textContent=action.label;button.onclick=action.onClick;row.append(button)}
    body.append(row)}
  return node}
function providerKey(provider=settings.provider||"deepseek"){return settings.providerKeys?.[provider]||(provider==="deepseek"?settings.apiKey:"")||""}
function hasTranslator(){const provider=settings.provider||"deepseek";return provider==="local"?!!settings.localEndpoint:!!providerKey(provider)}
function renderPracticeNotices(){const host=$("#practice-notices"),connected=hasTranslator();
  document.body.classList.toggle("no-key",!connected);
  $("#welcome-lede").textContent=connected?t("Enter one {language} sentence below to start a shadowing loop.",{language:t(languageName(sourceLang()))}):t("Add a translator and this starts working.");
  $("#english-input").disabled=!connected;$("#translate").disabled=!connected;$("#microphone").disabled=!connected||!dictationReady;
  host.replaceChildren();
  if(!connected)host.append(notice({icon:"alert",alert:true,title:"No translator connected",
    copy:"Echo can play and review what you already have, but it cannot make new sentences yet.",
    link:{label:"Add a key — takes a minute",onClick:()=>showView("setup")}}));
  else if(translationFailure)host.append(notice({icon:"failed",alert:true,title:translationFailure.title,copy:translationFailure.copy,
    actions:[{label:"Try again",onClick:()=>{translationFailure=null;performTranslation()}},{label:"Check the key",outline:true,onClick:()=>openSettings("ai")}]}));
  else if(!navigator.onLine)host.append(notice({icon:"offline",title:"You're offline",
    copy:"Practising and reviewing carry on as normal. New translations will wait until you're back."}));
  // Only after a playback attempt actually failed. An empty getVoices() list is
  // not proof the device has none: Android fills it in late, and browsers with
  // fingerprinting protection hand back an empty list on purpose. Echo names the
  // language it wants and lets the platform choose, rather than refusing to try.
  else if(voiceFailed)host.append(voiceNotice())}
function voiceNotice(){return notice({icon:"voice",alert:true,title:t("That voice could not play"),
  copy:t("Echo speaks with your device's own voices, and this one has no {language} voice to speak with. Add one in your system settings, then come back.",{language:t(languageName(targetLang()))}),
  link:{label:t("How do I add a voice?"),onClick:()=>{openSettings();$("#voice-help").open=true;$("#voice-help").scrollIntoView({block:"center"})}}})}
// The detail and review screens report the loop through an sr-only line, so a
// failure there was silent: the icon flicked back to a triangle and nothing
// else happened, which reads as a dead button. They get the notice too.
function renderVoiceNotices(){for(const id of ["#sentence-notices","#review-notices"]){const host=$(id);if(!host)continue;
  host.replaceChildren();if(voiceFailed)host.append(voiceNotice())}}
const WORKSPACE_KEY="jp-echo-workspace";
const workspace=()=>{try{return JSON.parse(localStorage.getItem(WORKSPACE_KEY)||"{}")}catch{return {}}};
function renderReading(){const host=$("#reading-text");host.innerHTML="";$("#reading-empty").hidden=!!readingPassage;$("#reading-controls").hidden=!readingPassage;if(!readingPassage)return;$("#reading-title").textContent=readingPassage.title;readingPassage.sentences.forEach((sentence,index)=>{const row=document.createElement("div");row.className="reading-sentence"+(readingSelected===index?" selected":"");row.dataset.index=index;const text=document.createElement("button");text.type="button";text.className="reading-sentence-text";const target=$("#reading-furigana").checked?rubyHtml(sentence.target):escapeText(stripFurigana(sentence.target));text.innerHTML='<span class="reading-japanese">'+target+'</span>'+($("#reading-english").checked?'<span class="reading-english">'+escapeText(sentence.source)+'</span>':"");enableVocabulary(text.querySelector(".reading-japanese"),sentence.target,targetLang(),sentence);text.onclick=()=>{readingSelected=index;renderReading()};row.append(text);if(sentence.saved){const saved=document.createElement("span");saved.className="reading-save saved";saved.textContent="Saved";row.append(saved)}else if(readingSelected===index){const save=document.createElement("button");save.type="button";save.className="reading-save primary";save.textContent="Save to Library";save.onclick=async()=>{save.disabled=true;save.textContent="Saving…";try{await saveReadingSentence(index)}catch(e){save.disabled=false;save.textContent="Save to Library";$("#reading-status").textContent=e.message}};row.append(save)}host.append(row)})}
async function saveReadingSentence(index){const s=readingPassage?.sentences[index];if(!s||s.saved)return;const made=createSentence(s.source,{casual:s.target,polite:s.target},new Date(),undefined,{sourceLang:sourceLang(),targetLang:targetLang()});await saveSentence(made);s.saved=true;renderReading();toast("Saved to your library.")}
async function generateReadingMode(){const prompt=$("#english-input").value.trim();if(!prompt)return;$("#translate").disabled=true;$("#reading-status").textContent="Writing…";try{readingPassage=await generateReading({prompt},{...settings,sourceLang:sourceLang(),targetLang:targetLang()});readingSelected=-1;$("#english-input").value="";renderReading();$("#reading-status").textContent="";markModeUsed("reading")}catch(e){$("#reading-status").textContent=e.message}finally{$("#translate").disabled=false}}
function playReading(){if(!readingPassage?.sentences.length)return;if(readingLoop.running){readingLoop.togglePause();return}const policy=settings.voice||"default",pick=()=>{if(!voices.length)return null;if(policy==="random")return voices[Math.floor(Math.random()*voices.length)];if(policy==="default")return voices.find(v=>v.default)||voices[0];return voices[Number(policy)]||voices[0]};readingLoop.playConversation(readingPassage.sentences.map(s=>({role:"ai",text:s.target})),{lang:targetLang(),rate:Number($("#rate").value),voiceFor:pick})}

function saveWorkspace(patch={}){const next={...workspace(),view:document.body.dataset.view||"practice",discussionMode,mapQuery:$("#map-search")?.value||"",historyQuery:$("#history-search")?.value||"",mapView:settings.mapView||"kanji",...patch};try{storePreference(WORKSPACE_KEY,JSON.stringify(next))}catch{/* Navigation must work even when browser storage is full or unavailable. */}return next}
let applyingRoute=false;
function navigationState(patch={}){return {view:document.body.dataset.view||"practice",discussionMode,mapView:settings.mapView||"kanji",mapQuery:$("#map-search")?.value||"",historyQuery:$("#history-search")?.value||"",historyFilter:$("#history-filter")?.value||"all",historyOrder:$("#history-order")?.value||"created",historyDirection:$("#history-direction")?.value||"desc",sentenceId:detail?.id||null,settingsPage,...patch}}
function syncRoute(patch={},replace=false){if(applyingRoute)return;const url=routeFor(navigationState(patch));if(location.pathname+location.search===url)return;history[replace?"replaceState":"pushState"]({echo:true},"",url)}

const wide=matchMedia("(min-width:1024px)");
const isWide=()=>wide.matches;
const VIEW_TITLES={review:"Review",library:"Library"};
function showView(name,{route=true}={}){if(name==="map"&&targetLang()!=="ja")name="library";if(name!=="practice")resetSession();speechSynthesis.cancel();
  $("#main-view").hidden=name!=="practice";$("#review-home").hidden=name!=="review";$("#history-view").hidden=!(name==="library"||(name==="sentence"&&isWide()));$("#review-view").hidden=name!=="session";$("#sentence-view").hidden=name!=="sentence";$("#onboard-view").hidden=name!=="onboard";$("#setup-view").hidden=name!=="setup";$("#map-view").hidden=name!=="map";$("#mora-view").hidden=name!=="mora";$("#settings-view").hidden=name!=="settings";if(name!=="settings")settingsStack=[];$("#settings-nav")?.toggleAttribute("aria-current",name==="settings");if(name!=="settings"&&$("#ai-show-key")?.getAttribute("aria-pressed")==="true")$("#ai-show-key").click();
  const solo=name==="onboard"||name==="setup"||((name==="session"||name==="sentence"||name==="map"||name==="settings")&&!isWide());document.querySelector("header").hidden=solo;$("#tabs").hidden=solo;
  $("#view-title").textContent=VIEW_TITLES[name]||"";$("#view-title").hidden=!VIEW_TITLES[name];document.querySelector(".brand").hidden=!!VIEW_TITLES[name];
  $("#mode-sentence").onclick=()=>setPracticeMode("sentence");$("#mode-discussion").onclick=()=>setPracticeMode("discussion");$("#mode-reading").onclick=()=>setPracticeMode("reading");$("#discussion-play").onclick=playDiscussion;$("#discussion-english").onchange=renderDiscussion;$("#discussion-new").onclick=()=>{discussionLoop.stop();discussionTurns=[];discussionScenario="";renderDiscussion();$("#english-input").value="";$("#english-input").focus()};$("#reading-furigana").onchange=renderReading;$("#reading-english").onchange=renderReading;$("#reading-echo").onclick=playReading;$("#reading-new").onclick=()=>{readingLoop.stop();readingPassage=null;readingSelected=-1;renderReading();$("#english-input").focus()};
for(const tab of document.querySelectorAll(".tab[data-view]")){const on=tab.dataset.view===name||(name==="session"&&tab.dataset.view==="review")||((name==="sentence"||name==="map")&&tab.dataset.view==="library");tab.classList.toggle("current",on);tab.setAttribute("aria-current",on?"page":"false")}
  document.body.dataset.view=name;scrollTo(0,0);renderSidePanel();
  saveWorkspace({view:name});if(route)syncRoute({view:name});if(name==="library"||(name==="sentence"&&isWide()))renderHistory();else if(name==="map")renderMap();else if(name==="mora")renderMora();else if(name==="review")renderReviewHome();else if(name==="practice")renderPracticeNotices();else if(name==="setup")resetSetupForm()}
// The study tool: the wall of joyo kanji, the dictionary and the list of grammar points,
// read off your library every time the screen opens. Coverage is never
// stored, so a sentence added or deleted moves the wall at once, and nothing
// here is scheduled or graded.
const MORA_ROWS=[["あ","い","う","え","お"],["か","き","く","け","こ"],["さ","し","す","せ","そ"],["た","ち","つ","て","と"],["な","に","ぬ","ね","の"],["は","ひ","ふ","へ","ほ"],["ま","み","む","め","も"],["や",null,"ゆ",null,"よ"],["ら","り","る","れ","ろ"],["わ",null,null,null,"を"],["ん"]];
function renderMora(){const host=$("#mora-table"),emoji=$("#mora-show-emoji").checked,furigana=$("#mora-show-furigana").checked,english=$("#mora-show-english").checked;host.replaceChildren(...MORA_ROWS.map(row=>{const line=document.createElement("div");line.className="mora-row";for(const mora of row){const cell=document.createElement("div");cell.className="mora-cell";if(!mora){cell.classList.add("empty");line.append(cell);continue}const [kanji,reading,gloss,icon]=MORA_MNEMONIC_META[mora];cell.innerHTML=`<span class="mora-kana">${mora}</span><span class="mora-word">${kanji}</span>${icon&&emoji?`<span class="mora-emoji" aria-hidden="true">${icon}</span>`:""}${furigana?`<span class="mora-reading">${reading}</span>`:""}${english?`<span class="mora-english" lang="en">${gloss}</span>`:""}`;line.append(cell)}return line}))}
function saveMoraDisplay(){settings.moraEmoji=$("#mora-show-emoji").checked;settings.moraFurigana=$("#mora-show-furigana").checked;settings.moraEnglish=$("#mora-show-english").checked;storePreference("jp-echo-settings",JSON.stringify(settings));renderMora()}
const tool={open:null,chip:"all",more:new Set()};
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node};
const CHEVRON='<svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden="true"><path d="m1.5 1.5 5.5 5.5 5.5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TICK='<svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true"><path d="m1.5 5 3 3 6-6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RIGHT='<svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STATE_LABELS={learned:"learned",met:"in a sentence",unmet:"not met yet",used:"used",unused:"not used yet"};
const toolHalf=()=>settings.mapView==="words"?"words":hasGrammar()&&settings.mapView==="grammar"?"grammar":"kanji";
const sentencesPhrase=n=>n===1?t("1 sentence"):t("{n} sentences",{n:n.toLocaleString()});
const inYours=n=>n===1?t("in 1 of your sentences"):t("in {n} of your sentences",{n:n.toLocaleString()});
function bar(learnedN,metN,total){const wrap=el("span","bar");const a=el("span","bar-learned"),b=el("span","bar-met");
  a.style.width=(total?100*learnedN/total:0).toFixed(2)+"%";b.style.width=(total?100*(metN-learnedN)/total:0).toFixed(2)+"%";wrap.append(a,b);return wrap}
function legend(rows){const list=el("ul","legend");for(const [cls,label,n] of rows){const li=el("li");const sw=el("span","swatch "+cls);if(cls==="learned")sw.innerHTML=TICK;li.append(sw,document.createTextNode(label+" — "+n.toLocaleString()));list.append(li)}return list}
async function renderMap(){
  const sentences=await listSentences();
  $("#map-from").textContent=sentences.length===1?t("From your 1 sentence"):t("From your {n} sentences",{n:sentences.length.toLocaleString()});
  const half=toolHalf();$("#map-tab-grammar").hidden=!hasGrammar();
  for(const button of document.querySelectorAll("#map-toggle [role=tab]")){const on=button.dataset.map===half;button.setAttribute("aria-selected",String(on));button.tabIndex=on?0:-1}
  $("#map-search").placeholder=half==="kanji"?t("Kanji, reading, or meaning"):half==="words"?t("Word, reading, or meaning"):t("Point, particle, or meaning");
  $("#map-search-hint").textContent=half==="kanji"?t("Paste one you saw in the wild, handwrite it with your keyboard’s Japanese input, or type がく, gaku or study."):half==="words"?t("Type ねこ, neko or cat, or paste 猫. The dictionary is on the device, so this works with no connection."):t("Type てしまう, te shimau, or what it does — regret, completion.");
  $("#map-results-order").textContent=half==="words"?t("Best match first"):t("Band order");
  const query=$("#map-search").value.trim();$("#map-search-clear").hidden=!query;
  $("#map-results").hidden=!query;$("#map-kanji").hidden=!!query||half!=="kanji";$("#map-words").hidden=!!query||half!=="words";$("#map-grammar").hidden=!!query||half!=="grammar";
  if(query)return renderLookup(query,sentences);
  $("#map-results-list").replaceChildren();$("#map-not-joyo").hidden=true;
  if(half==="grammar")return renderGrammar(sentences);
  if(half==="words")return renderWords(sentences);
  renderKanjiWall(sentences);
}
function renderKanjiWall(sentences){
  const cover=kanjiCoverage(sentences),known=kanjiLearned(sentences),met=cover.size,learnedN=known.size;
  const card=$("#kanji-summary");card.replaceChildren();
  card.append(el("span","overline",t("The jōyō {n}, banded by JLPT",{n:KANJI_TOTAL.toLocaleString()})));
  const line=el("p","summary-line");line.append(el("strong",null,learnedN.toLocaleString()),el("span",null,t("learned, {met} met",{met:met.toLocaleString()})));
  card.append(line,bar(learnedN,met,KANJI_TOTAL),legend([["learned",t("Learned"),learnedN],["met",t("In a sentence"),met-learnedN],["",t("Not met yet"),KANJI_TOTAL-met]]));
  const copy=el("p","copy");
  if(sentences.length){copy.append(t("A kanji is ")+"",el("em",null,t("met")),t(" once one of your sentences uses it, and "),el("em",null,t("learned")),t(" once that sentence reaches review. Nothing here is scheduled or graded on its own — the wall is read off "));
    const link=el("button",null,sentences.length===1?t("your 1 sentence"):t("your {n} sentences",{n:sentences.length.toLocaleString()}));link.type="button";link.onclick=()=>showView("library");copy.append(link,t(", and nothing you do here changes them."))}
  else copy.textContent=t("Add a sentence and the kanji it uses will light up here. Practise a band and Echo opens each kanji in turn, from zero.");
  card.append(copy);
  const host=$("#map-bands");host.replaceChildren();
  for(const band of kanjiBands())host.append(renderKanjiBand(band,cover,known));
}
function bandHead(band,learnedN,metN,total,sub){
  const head=el("button","band-head");head.type="button";head.setAttribute("aria-expanded",String(tool.open===band.key));head.setAttribute("aria-controls","band-"+band.key);
  head.append(el("span","band-level",band.level));
  const text=el("span","band-text"),top=el("span","band-top");top.append(el("span","band-label",t(band.label)));
  const tally=el("span","band-tally");tally.append(el("strong",null,learnedN.toLocaleString()),document.createTextNode(" "+t("learned")+" · "+sub));top.append(tally);
  text.append(top,bar(learnedN,metN,total));head.append(text);head.insertAdjacentHTML("beforeend",CHEVRON);
  head.onclick=()=>{tool.open=tool.open===band.key?null:band.key;tool.chip="all";renderMap()};
  return head}
function chunkHead(from,to,first){return el("p","chunk-head",from.toLocaleString()+"–"+to.toLocaleString()+(first?" · "+t("taught first"):""))}
function cellState(character,cover,known){return known.has(character)?"learned":cover.has(character)?"met":"unmet"}
function kanjiCell(character,cover,known){
  const cell=el("button","kanji-cell",character);cell.type="button";cell.lang="ja";cell.dataset.kanji=character;
  const state=cellState(character,cover,known),n=(cover.get(character)||[]).length;
  if(state==="learned")cell.classList.add("known");else if(state==="met")cell.classList.add("met");
  cell.setAttribute("aria-label",character+" — "+t(STATE_LABELS[state])+(n?", "+inYours(n):""));
  cell.onclick=()=>openKanji(character,cover);return cell}
function renderKanjiBand(band,cover,known){
  const section=el("section","band");section.dataset.level=band.level;
  let total=0,metN=0,learnedN=0;for(const c of band.chars){total++;if(cover.has(c))metN++;if(known.has(c))learnedN++}
  const unmet=total-metN;
  section.append(bandHead(band,learnedN,metN,total,unmet===1?t("1 to meet"):t("{n} to meet",{n:unmet.toLocaleString()})));
  if(tool.open!==band.key)return section;
  section.classList.add("open");section.setAttribute("aria-busy","");
  const body=el("div","band-body");body.id="band-"+band.key;
  const chips=el("div","chips");
  const sets={all:band.chars,unmet:band.chars.filter(c=>!cover.has(c)),met:band.chars.filter(c=>cover.has(c)&&!known.has(c)),learned:band.chars.filter(c=>known.has(c))};
  for(const [key,label] of [["all",t("All")],["unmet",t("To meet")],["met",t("In a sentence")],["learned",t("Learned")]]){
    const chip=el("button","hit",label+" "+sets[key].length.toLocaleString());chip.type="button";chip.setAttribute("aria-pressed",String(tool.chip===key));
    chip.onclick=()=>{tool.chip=key;renderMap()};chips.append(chip)}
  body.append(chips);
  const shown=sets[tool.chip]||sets.all;
  if(!shown.length)body.append(el("p","hint",t("Nothing in this band matches that yet.")));
  for(let i=0;i<shown.length;i+=50){
    body.append(chunkHead(i+1,Math.min(i+50,shown.length),i===0&&tool.chip==="all"));
    const grid=el("div","kanji-grid");for(const c of shown.slice(i,i+50))grid.append(kanjiCell(c,cover,known));body.append(grid)}
  const foot=el("div","band-foot");
  if(unmet){const go=el("button","outlined",unmet===1?t("Practise the 1 you haven’t met"):t("Practise the {n} you haven’t met",{n:unmet.toLocaleString()}));go.type="button";go.onclick=()=>startLearn(band);foot.append(go,el("p","hint",t("Opens each one in turn. Say your own sentence with it, or let Echo write one — either way it lands in your library like any other.")))}
  else foot.append(el("p","hint",t("You have met every kanji in this band.")));
  body.append(foot);section.append(body);return section}
// Looking one up: an in-memory filter over the readings or the points, in
// wall order. A character that is not joyo is a real answer, not an empty one.
function renderLookup(query,sentences){
  const list=$("#map-results-list");list.replaceChildren();$("#map-not-joyo").hidden=true;
  if(toolHalf()==="kanji"){
    const r=searchKanji(query),cover=kanjiCoverage(sentences),known=kanjiLearned(sentences),n=r.chars.length;
    $("#map-results-title").textContent=r.how==="read"?t("{n} jōyō read {key}",{n,key:r.key}):r.how==="mean"?t("{n} jōyō mean {key}",{n,key:r.key}):t("{n} jōyō in {key}",{n,key:r.key});
    for(const c of r.chars){const li=el("li"),row=el("button","lookup-row");row.type="button";
      const cell=kanjiCell(c,cover,known);cell.tabIndex=-1;cell.removeAttribute("aria-label");cell.onclick=null;
      const text=el("span","lookup-text"),state=cellState(c,cover,known),count=(cover.get(c)||[]).length;
      text.append(el("span",null,(kanjiFacts(c)?.en||[]).join(", ")),el("span",null,[levelOf(c),t(STATE_LABELS[state]),count?inYours(count):null].filter(Boolean).join(" · ")));
      row.append(cell,text);row.insertAdjacentHTML("beforeend",RIGHT);row.onclick=()=>openKanji(c,cover);li.append(row);list.append(li)}
    if(r.notJoyo.length){const c=r.notJoyo[0];$("#map-not-joyo").hidden=false;$("#map-not-joyo-char").textContent=c;
      $("#map-not-joyo-copy").textContent=t("{kanji} is not one of the jōyō {n}, so it has no cell and no band. Plenty of real Japanese is like that — names, 綺麗, a shop sign.",{kanji:c,n:KANJI_TOTAL.toLocaleString()});
      const go=$("#map-not-joyo-go");go.textContent=t("Say or write your own with {kanji}",{kanji:c});go.onclick=()=>{showView("practice");$("#english-input").value=c;$("#english-input").focus()}}
  }else if(toolHalf()==="words"){
    const r=searchWords(query),cover=wordCoverage(sentences),known=wordLearned(sentences),n=r.total.toLocaleString();
    $("#map-results-title").textContent=(r.how==="read"?t("{n} words read {key}",{n,key:r.key}):r.how==="mean"?t("{n} words meaning {key}",{n,key:r.key}):t("{n} words with {key}",{n,key:r.key}))+(r.total>r.words.length?" · "+t("first {n}",{n:r.words.length}):"");
    for(const w of r.words){const li=el("li"),row=el("button","lookup-row");row.type="button";
      const count=(cover.get(w.id)||[]).length,state=known.has(w.id)?"learned":count?"met":"unmet";
      const sw=el("span","swatch "+(state==="learned"?"learned":state==="met"?"met":""));if(state==="learned")sw.innerHTML=TICK;
      const text=el("span","lookup-text"),title=el("b",null,w.w+(w.r!==w.w?"　"+w.r:""));title.lang="ja";
      text.append(title,el("span",null,w.en[0]||""),el("span",null,[wordLevel(w)==="+"?null:wordLevel(w),kindOf(w),t(STATE_LABELS[state]),count?inYours(count):null].filter(Boolean).join(" · ")));
      row.append(sw,text);row.insertAdjacentHTML("beforeend",RIGHT);row.onclick=()=>openWord(w,cover);li.append(row);list.append(li)}
    if(!r.words.length)list.append(el("li","hint",t("Nothing in the dictionary matches that. It carries the common words and every JLPT list, not every word there is — say the sentence anyway and Echo translates it.")));
  }else{
    const r=searchGrammar(query),cover=grammarCoverage(sentences),known=grammarLearned(sentences),n=r.points.length;
    $("#map-results-title").textContent=r.how==="named"?t("{n} points named {key}",{n,key:r.key}):t("{n} points about {key}",{n,key:r.key});
    for(const point of r.points){const li=el("li"),row=el("button","lookup-row");row.type="button";
      const count=(cover.get(point.id)||[]).length,state=known.has(point.id)?"learned":count?"used":"unused";
      const sw=el("span","swatch "+(state==="learned"?"learned":state==="used"?"met":""));if(state==="learned")sw.innerHTML=TICK;
      const text=el("span","lookup-text"),title=el("b",null,point.title);title.lang="ja";
      text.append(title,el("span",null,[point.level,t(STATE_LABELS[state]),count?inYours(count):null].filter(Boolean).join(" · ")));
      row.append(sw,text);row.insertAdjacentHTML("beforeend",RIGHT);row.onclick=()=>openGrammar(point,cover);li.append(row);list.append(li)}
  }
}
// Which sentence the loop is currently speaking, so the row can say so. The
// loop is the one the rest of the app uses; nothing here owns a second one.
let kanjiOpen=null;
async function openKanji(character,cover,{learn=null,route=true}={}){
  kanjiOpen={character,learn};saveWorkspace({modal:{kind:"kanji",id:character}});if(route)syncRoute({view:"map",mapView:"kanji",modal:{kind:"kanji",id:character}});
  const all=await listSentences(),known=kanjiLearned(all);
  renderLearnNav(cover);
  const ids=cover.get(character)||[],state=cellState(character,cover,known),facts=kanjiFacts(character);
  const tile=$("#kanji-character");tile.textContent=character;tile.dataset.state=state;
  $("#kanji-level").textContent=levelOf(character)||"";
  const chip=$("#kanji-state");chip.textContent=t(STATE_LABELS[state]);chip.dataset.state=state;
  $("#kanji-meanings").textContent=facts?facts.en.join(", "):"";
  $("#kanji-on").textContent=facts?.on.join("、")||"—";$("#kanji-kun").textContent=facts?.kun.join("、")||"—";
  $("#kanji-meta").textContent=ids.length
    ?capitalise(inYours(ids.length))+" · "+(state==="learned"?t("learned, since one of them reached review"):t("not learned yet — none of them has reached review"))
    :t("Not in any of your sentences yet");
  $("#kanji-say-label").textContent=t("Say a sentence using {kanji}",{kanji:character});
  $("#kanji-say-hint").textContent=t("Give Echo an idea or directions in either language. It creates a natural sentence using {kanji} and saves it to your library.",{kanji:character});
  $("#kanji-say-go").disabled=!hasTranslator();$("#kanji-say").disabled=!hasTranslator();
  $("#kanji-mic").disabled=!hasTranslator()||!dictationReady;
  $("#kanji-say-status").textContent="";
  $("#kanji-compose").textContent=t("Or let Echo write one with {kanji}",{kanji:character});
  $("#kanji-compose").disabled=!hasTranslator();
  $("#kanji-status").textContent=hasTranslator()?"":t("Add a translator and this starts working.");
  $("#kanji-loop-state").textContent="";
  const byId=new Map(all.map(item=>[item.id,item])),mine=ids.map(id=>byId.get(id)).filter(Boolean);
  renderSheetSentences($("#kanji-sentences"),mine,{deletable:true,onDelete:deleteFromSheet,mark:character});
  $("#kanji-mine-head").hidden=!mine.length;sheetCount($("#kanji-mine-head"),mine.length);
  await renderKanjiInfo(character);
  if(!$("#kanji-dialog").open)$("#kanji-dialog").showModal();
}
async function renderKanjiInfo(character){
  // Echo's own story: the facts, the parts and the reading, in its own words.
  await renderStory(character);
}
// Mark a kanji or a grammar pattern inside rendered ruby HTML. A point's title
// may list forms (てしまう・ちゃう) or lead with 〜; each form that appears is
// marked, longest first so ちゃった is not cut by ちゃう's shorter twin.
function markPattern(html,title){
  if(!title)return html;
  const forms=String(title).split(/[・／\/]/).map(f=>f.replace(/^[〜~]+|[〜~]+$/g,"").trim()).filter(f=>f&&!/[A-Za-z()\[\]]/.test(f));
  // A conjugated form (てしまった) still shows its stem (てしま), so the stem is
  // tried after the whole form.
  const stems=forms.filter(f=>f.length>2&&/[うる]$/.test(f)).map(f=>f.slice(0,-1));
  // A て-form pattern voices after ん, む, ぶ, ぐ (読んでしまう), so で is tried too.
  const voiced=[...forms,...stems].filter(f=>/^て/.test(f)).map(f=>"で"+f.slice(1));
  for(const form of [...forms,...stems,...voiced].sort((a,b)=>b.length-a.length))if(html.includes(form))return html.split(form).join("<mark>"+escapeText(form)+"</mark>");
  return html;
}
function renderSheetSentences(list,sentences,{deletable,onDelete,mark=null}){
  list.replaceChildren();
  for(const sentence of sentences){
    const row=document.createElement("li");row.dataset.id=sentence.id;
    let text=document.createElement("div");text.className="kanji-sentence-text";
    const target=document.createElement("b");target.lang=targetLang();target.innerHTML=markPattern(rubyHtml(preferredTarget(sentence)),mark);enableVocabulary(target,preferredTarget(sentence),itemTarget(sentence),sentence);
    const source=document.createElement("span");source.textContent=sentence.source;
    if(sentence.word){const word=document.createElement("i");word.lang=targetLang();word.textContent=sentence.word+(sentence.reading?"（"+sentence.reading+"）":"");text.append(word)}
    text.append(target,source);
    if(!sentence.transient&&sentence.srs){const state=cardState(sentence);const chip=el("span","status-chip "+state,CARD_STATES[state]);row.append(text,chip);text=null}
    if(deletable){const del=document.createElement("button");del.type="button";del.className="icon-button kanji-delete";
      del.setAttribute("aria-label",t("Delete this sentence"));
      del.innerHTML='<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m1 1 12 12M13 1 1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      del.onclick=()=>onDelete(sentence);row.append(del)}
    const play=document.createElement("button");play.type="button";play.className="icon-button kanji-play";
    play.setAttribute("aria-label",t("Play the loop"));
    play.innerHTML='<svg width="12" height="15" viewBox="0 0 13 16" fill="none" aria-hidden="true"><path d="'+PLAY_ICON+'" fill="currentColor"/></svg>';
    play.onclick=()=>playKanjiSentence(sentence);
    if(text)row.prepend(text);row.append(play);list.append(row)}
}
function playKanjiSentence(sentence){
  if(loop.running&&kanjiPlaying?.id===sentence.id){loop.togglePause();return}
  kanjiPlaying=sentence;
  const voice=voices[Number($("#voice").value)]||voices[0]||null;
  loop.play(preferredTarget(sentence),{voice,rate:Number($("#rate").value),lang:targetLang()});
}
// Practise walks one band, in its taught order, and shows only what you have
// not met. `learnAt` is where you stopped; if it is in this band, you pick up
// there, and the character you stopped on is shown again if still unmet.
function renderLearnNav(cover){
  const nav=$("#kanji-learn-nav"),learn=kanjiOpen?.learn;nav.hidden=!learn;if(nav.hidden)return;
  const left=learn.order.filter(c=>!cover.has(c)).length;
  $("#kanji-learn-count").textContent=learn.level+" · "+(left===1?t("1 left to meet"):t("{n} left to meet",{n:left.toLocaleString()}));
  $("#kanji-prev").disabled=!nextUnmet(cover,kanjiOpen.character,-1,{order:learn.order});
  $("#kanji-next").disabled=!nextUnmet(cover,kanjiOpen.character,1,{order:learn.order});
}
async function startLearn(band){
  const cover=kanjiCoverage(await listSentences()),order=band.chars;
  const character=nextUnmet(cover,order.includes(settings.learnAt)?settings.learnAt:null,1,{inclusive:true,order})||nextUnmet(cover,null,1,{order});
  if(!character){toast(t("You have met every kanji in this band."),4000);return}
  settings.learnAt=character;storePreference("jp-echo-settings",JSON.stringify(settings));
  await openKanji(character,cover,{learn:{level:band.level,order}});
}
async function learnStep(direction){
  if(!kanjiOpen?.learn)return;
  const cover=kanjiCoverage(await listSentences());
  const character=nextUnmet(cover,kanjiOpen.character,direction,{order:kanjiOpen.learn.order});
  if(!character)return;
  settings.learnAt=character;storePreference("jp-echo-settings",JSON.stringify(settings));
  if(loop.running)loop.stop();
  $("#kanji-say").value="";
  await openKanji(character,cover,{learn:kanjiOpen.learn});
  $("#kanji-dialog").scrollTop=0;
}
const deleteFromSheet=sentence=>askDelete(sentence,removeFromSheet);
async function removeFromSheet(sentence){
  if(!kanjiOpen)return;
  if(loop.running&&kanjiPlaying?.id===sentence.id)loop.stop();
  await deleteSentence(sentence.id);await restoreExample(sentence);
  if(current?.id===sentence.id){current=null;renderSentence()}
  if(detail?.id===sentence.id)detail=null;
  refreshDueBadge();
  const fresh=await listSentences(),learn=kanjiOpen.learn;
  await openKanji(kanjiOpen.character,kanjiCoverage(fresh),{learn});
  $("#kanji-status").textContent=t("Deleted.");
  renderMap();
}
async function sayForKanji(){
  const target=kanjiOpen;if(!target)return;
  const field=$("#kanji-say"),text=field.value.trim(),status=$("#kanji-say-status"),button=$("#kanji-say-go");
  if(!text){status.textContent=t("Say or type a sentence first.");field.focus();return}
  button.disabled=true;status.textContent=t("Translating…");
  try{
    const card=await composeFromIntent({kanji:target.character,intent:text},{...settings,inputLang,sourceLang:sourceLang(),targetLang:targetLang()});
    const made=ensureSchedule(createSentence(card.source,card,new Date(),undefined,{sourceLang:sourceLang(),targetLang:targetLang()}));
    made.translationProvider=defaultProvider();await saveSentence(made);autoTag(made);refreshDueBadge();
    field.value="";
    const fresh=await listSentences();await openKanji(target.character,kanjiCoverage(fresh),{learn:target.learn});
    status.textContent=t("Saved to your library.");renderMap();
  }catch(error){
    const provider=defaultProvider(),name=PROVIDER_NAMES[provider]||provider;
    const refused=/\b(401|403|402|key|credit|quota)\b/i.test(error.message||""),offline=error instanceof TypeError;
    status.textContent=offline?t("No connection, so the request never reached {name}.",{name}):refused?t("{name} turned the request down.",{name}):(error.message||t("That did not work."));
  }finally{button.disabled=!hasTranslator()}
}
async function composeForKanji(){
  const target=kanjiOpen;if(!target)return;
  const button=$("#kanji-compose"),previous=button.textContent;
  button.disabled=true;button.textContent=t("Writing…");$("#kanji-status").textContent="";
  try{
    const all=await listSentences();
    // A soft preference, so filling one gap does not open three: the model is
    // pointed at what you have already met for everything it is free to choose.
    const known=[...kanjiCoverage(all).keys()].join("");
    const card=await compose({kanji:target.character,known},{...settings,sourceLang:sourceLang(),targetLang:targetLang()});
    const made=ensureSchedule(createSentence(card.source,card,new Date(),undefined,{sourceLang:sourceLang(),targetLang:targetLang()}));
    made.translationProvider=defaultProvider();
    await saveSentence(made);autoTag(made);
    refreshDueBadge();
    const fresh=await listSentences(),cover=kanjiCoverage(fresh);
    await openKanji(target.character,cover,{learn:target.learn});
    $("#kanji-status").textContent=t("Saved to your library.");
    renderMap();
  }catch(error){
    const provider=defaultProvider(),name=PROVIDER_NAMES[provider]||provider;
    const refused=/\b(401|403|402|key|credit|quota)\b/i.test(error.message||""),offline=error instanceof TypeError;
    $("#kanji-status").textContent=offline
      ?(settings.proxyUrl?t("{name} blocks direct requests from this browser, and the proxy only translates.",{name})
                         :t("No connection, so the request never reached {name}.",{name}))
      :refused?t("{name} turned the request down.",{name})
      :(error.message||t("That did not work."));
  }finally{button.disabled=!hasTranslator();button.textContent=previous}
}
function renderGrammar(sentences){
  const cover=grammarCoverage(sentences),known=grammarLearned(sentences),todo=untaggedSentences(sentences);
  const {met,total}=grammarSummarise(cover),learnedN=known.size;
  const card=$("#grammar-summary-card");card.replaceChildren();
  card.append(el("span","overline",t("{n} points, N5 through N1",{n:total.toLocaleString()})));
  const line=el("p","summary-line");line.append(el("strong",null,learnedN.toLocaleString()),el("span",null,t("learned, {met} used",{met:met.toLocaleString()})));
  card.append(line,bar(learnedN,met,total),legend([["learned",t("Learned"),learnedN],["met",t("Used"),met-learnedN],["",t("Not used yet"),total-met]]));
  // Tagging is explicit and priced, but it is a status line, not the main
  // action: a sentence made through Translate carries no tags until it is read.
  if(todo.length){const tag=el("div","tag-line"),text=el("span"),requests=Math.ceil(todo.length/30);
    text.textContent=(todo.length===1?t("1 of your {total} sentences hasn’t been read for grammar yet, so it counts for nothing here.",{total:sentences.length.toLocaleString()}):t("{n} of your {total} sentences haven’t been read for grammar yet, so they count for nothing here.",{n:todo.length.toLocaleString(),total:sentences.length.toLocaleString()}))+" "+(requests===1?t("Reading them is one request on your key."):t("Reading them is {n} requests on your key.",{n:requests}));
    const go=el("button","hit",t("Read them"));go.type="button";go.id="grammar-tag";go.disabled=!hasTranslator();go.onclick=tagUntagged;tag.append(text,go);card.append(tag)}
  const status=el("p","hint");status.id="grammar-tag-status";status.setAttribute("aria-live","polite");card.append(status);
  const host=$("#grammar-levels");host.replaceChildren();
  const levels=grammarByLevel();
  for(const level of GRAMMAR_LEVELS){const points=levels[level];if(points.length)host.append(renderGrammarBand({key:level,level,label:GRAMMAR_BAND_LABELS[level],points},cover,known))}
}
const GRAMMAR_BAND_LABELS={N5:"Sentence frame",N4:"Joining ideas up",N3:"Nuance and register",N2:"Written Japanese",N1:"Formal and literary"};
function pointRow(point,cover,known,onOpen){
  const count=(cover.get(point.id)||[]).length,state=known.has(point.id)?"learned":count?"used":"unused";
  const row=el("button","point-row"+(state==="unused"?" unused":""));row.type="button";row.dataset.id=point.id;
  const sw=el("span","swatch "+(state==="learned"?"learned":state==="used"?"met":""));if(state==="learned")sw.innerHTML=TICK;
  const title=el("b",null,point.title);title.lang="ja";
  row.append(sw,title,el("span","gloss",point.hint||""));if(count)row.append(el("i",null,sentencesPhrase(count)));
  row.setAttribute("aria-label",point.title+" — "+t(STATE_LABELS[state])+(count?", "+inYours(count):""));
  row.onclick=onOpen;return row}
function renderGrammarBand(band,cover,known){
  const section=el("section","band");section.dataset.level=band.level;
  const total=band.points.length,metN=band.points.filter(p=>cover.has(p.id)).length,learnedN=band.points.filter(p=>known.has(p.id)).length,unused=total-metN;
  section.append(bandHead(band,learnedN,metN,total,unused===1?t("1 to use"):t("{n} to use",{n:unused.toLocaleString()})));
  if(tool.open!==band.key)return section;
  section.classList.add("open");section.setAttribute("aria-busy","");
  const body=el("div","band-body");body.id="band-"+band.key;
  const chips=el("div","chips");
  const sets={all:band.points,unmet:band.points.filter(p=>!cover.has(p.id)),met:band.points.filter(p=>cover.has(p.id))};
  for(const [key,label] of [["all",t("In order")],["unmet",t("Not used")+" "+sets.unmet.length.toLocaleString()],["met",t("Used")+" "+sets.met.length.toLocaleString()]]){
    const chip=el("button","hit",label);chip.type="button";chip.setAttribute("aria-pressed",String(tool.chip===key));chip.onclick=()=>{tool.chip=key;renderMap()};chips.append(chip)}
  body.append(chips);
  const shown=sets[tool.chip]||sets.all,all=tool.more.has(band.key),limit=all?shown.length:Math.min(shown.length,20);
  if(!shown.length)body.append(el("p","hint",t("Nothing in this band matches that yet.")));
  for(let i=0;i<limit;i+=20){
    body.append(chunkHead(i+1,Math.min(i+20,limit),i===0&&tool.chip==="all"));
    const rows=el("div","point-rows");for(const point of shown.slice(i,Math.min(i+20,limit)))rows.append(pointRow(point,cover,known,()=>openGrammar(point,cover)));body.append(rows)}
  if(limit<shown.length){const more=el("button","show-more",t("Show the other {n} {level} points",{n:(shown.length-limit).toLocaleString(),level:band.level}));more.type="button";more.onclick=()=>{tool.more.add(band.key);renderMap()};body.append(more)}
  const foot=el("div","band-foot");
  if(unused){const go=el("button","outlined",unused===1?t("Practise the 1 you haven’t used"):t("Practise the {n} you haven’t used",{n:unused.toLocaleString()}));go.type="button";go.onclick=()=>startGrammarLearn(band);
    foot.append(go,el("p","hint",t("Opens each one in turn, in the order Bunpro teaches them. Say your own sentence with it, or let Echo write one.")))}
  else foot.append(el("p","hint",t("You have used every point in this band.")));
  body.append(foot);section.append(body);return section}
// With the setting on, a sentence is read for grammar the moment it is
// saved — one request, on your key — so the wall never undercounts. It runs
// behind the save and never blocks it; a failure just leaves the sentence
// for the manual read. Off by default, because the cost is real.
async function autoTag(sentence){
  if(!settings.autoTag||!hasGrammar()||targetLang()!=="ja"||!hasTranslator()||!sentence?.id||isTagged(sentence))return;
  try{
    // The same analysis the sentence page's "Explain the grammar" runs, so an
    // auto-read sentence gets highlighted evidence as well as its tags.
    const text=stripFurigana(preferredTarget(sentence)),found=await analyzeSentenceGrammar(text,GRAMMAR_POINTS,{...settings,targetLang:"ja"});
    grammarAnalysisCache.set(text,found);
    const fresh=await getSentence(sentence.id);if(!fresh||isTagged(fresh))return;
    const updated={...fresh,grammarAnalysis:[...(fresh.grammarAnalysis||[]).filter(a=>a.text!==text),found],grammar:found.grammar,updatedAt:new Date().toISOString()};
    await saveSentence(updated);if(detail?.id===updated.id){detail=updated;if(document.body.dataset.view==="sentence")renderDetail()}if(current?.id===updated.id)current=updated;
    if(document.body.dataset.view==="map")renderMap();
  }catch{}
}
// Tagging is explicit: each batch is a request, and the line beside the button
// says what it will cost before it is pressed.
async function tagUntagged(){
  const status=$("#grammar-tag-status"),button=$("#grammar-tag");
  const todo=untaggedSentences(await listSentences());if(!todo.length)return;
  if(button)button.disabled=true;status.textContent=t("Reading…");
  try{
    const tags=await tagGrammar(todo,GRAMMAR_POINTS,{...settings,targetLang:targetLang()});
    let done=0;
    // Re-read each one: the request can take a while, and a review graded or a
    // sentence edited meanwhile must not be overwritten by the copy read before it.
    for(const sentence of todo){const got=tags.get(sentence.id);if(!got)continue;const fresh=await getSentence(sentence.id);if(!fresh||isTagged(fresh))continue;await saveSentence({...fresh,grammar:got,updatedAt:new Date().toISOString()});done++}
    await renderMap();$("#grammar-tag-status").textContent=done===1?t("Read 1 sentence."):t("Read {n} sentences.",{n:done.toLocaleString()});
  }catch(error){status.textContent=sheetError(error);if(button)button.disabled=!hasTranslator()}
}
let grammarOpen=null;
function renderGrammarNav(cover){
  const nav=$("#grammar-learn-nav"),learn=grammarOpen?.learn;nav.hidden=!learn;if(nav.hidden)return;
  const left=learn.order.filter(id=>!cover.has(id)).length;
  $("#grammar-learn-count").textContent=learn.level+" · "+(left===1?t("1 left to use"):t("{n} left to use",{n:left.toLocaleString()}));
  $("#grammar-prev").disabled=!nextUnmet(cover,grammarOpen.point.id,-1,{order:learn.order});
  $("#grammar-next").disabled=!nextUnmet(cover,grammarOpen.point.id,1,{order:learn.order});
}
async function startGrammarLearn(band){
  const cover=grammarCoverage(await listSentences()),order=band.points.map(p=>p.id);
  const id=nextUnmet(cover,null,1,{order});if(!id)return;
  await openGrammar(grammarPoint(id),cover,{learn:{level:band.level,order}});
}
async function grammarStep(direction){
  if(!grammarOpen?.learn)return;
  const cover=grammarCoverage(await listSentences());
  const id=nextUnmet(cover,grammarOpen.point.id,direction,{order:grammarOpen.learn.order});if(!id)return;
  if(loop.running)loop.stop();$("#grammar-say").value="";
  await openGrammar(grammarPoint(id),cover,{learn:grammarOpen.learn});$("#grammar-dialog").scrollTop=0;
}
async function openGrammar(point,cover,{learn=null,route=true}={}){
  saveWorkspace({modal:{kind:"grammar",id:point.id}});if(route)syncRoute({view:"map",mapView:"grammar",modal:{kind:"grammar",id:point.id}});grammarOpen={point,learn};
  const all=await listSentences(),known=grammarLearned(all),ids=cover.get(point.id)||[],state=known.has(point.id)?"learned":ids.length?"used":"unused";
  renderGrammarNav(cover);
  $("#grammar-level").textContent=point.level;const chip=$("#grammar-state");chip.textContent=t(STATE_LABELS[state]);chip.dataset.state=state==="learned"?"learned":state==="used"?"met":"unmet";
  $("#grammar-title").textContent=point.title;$("#grammar-gloss").textContent=point.hint||"";
  const lesson=GRAMMAR_POINTS.filter(p=>p.level===point.level).findIndex(p=>p.id===point.id)+1;
  $("#grammar-meta").textContent=[t("{level}, lesson {n}",{level:point.level,n:lesson}),ids.length?inYours(ids.length)+(state==="learned"?", "+t("learned"):", "+t("not learned yet")):t("not in any of your sentences yet")].join(" · ");
  $("#grammar-say-label").textContent=t("Say a sentence using {point}",{point:point.title});
  $("#grammar-say-go").disabled=!hasTranslator();$("#grammar-say").disabled=!hasTranslator();$("#grammar-mic").disabled=!hasTranslator()||!dictationReady;
  $("#grammar-say-status").textContent="";$("#grammar-status").textContent=hasTranslator()?"":t("Add a translator and this starts working.");$("#grammar-loop-state").textContent="";
  $("#grammar-compose").textContent=t("Or let Echo write one with {point}",{point:point.title});$("#grammar-compose").disabled=!hasTranslator();
  const byId=new Map(all.map(s=>[s.id,s])),mine=ids.map(id=>byId.get(id)).filter(Boolean);
  renderSheetSentences($("#grammar-sentences"),mine,{deletable:true,onDelete:deleteFromGrammarSheet,mark:point.title});
  $("#grammar-mine-head").hidden=!mine.length;sheetCount($("#grammar-mine-head"),mine.length);
  if(!$("#grammar-dialog").open)$("#grammar-dialog").showModal();
  renderPointNotes(point);
}
// Echo's notes on a point — In one breath, A way to remember it, Two to try
// — are written on your own key the first time you open it, and kept. Every
// note can be adjusted, by an instruction to Echo or by hand, and reset.
// Written from the point's name and gloss alone, never from the index.
const NOTE_TITLES={breath:"In one breath",remember:"A way to remember it"};
async function renderPointNotes(point){
  if(point.origin==="minihongo"){
    $("#point-notes-status").textContent="From Minihongo · CC BY-SA 4.0";
    const block=$("#point-breath");block.hidden=false;block.querySelector(".note-text").textContent=point.explanation||point.hint;block.querySelector(".note-note").textContent="Minihongo, https://minihongo.com";block.querySelector(".adjust-link").disabled=true;
    $("#point-remember").hidden=true;$("#point-examples").hidden=true;return;
  }
  const status=$("#point-notes-status");status.textContent="";
  const blocks={breath:$("#point-breath"),remember:$("#point-remember")};
  for(const block of Object.values(blocks)){block.hidden=true;block.querySelector(".adjust-panel").hidden=true}
  $("#point-examples").hidden=true;$("#point-example-list").replaceChildren();
  let notes={};
  try{for(const part of ["breath","remember","examples"])notes[part]=await getNote(noteKey("point",point.id,part))}catch{notes={}}
  if(!notes.breath||!notes.remember){
    if(!hasTranslator()||!navigator.onLine){
      for(const [part,block] of Object.entries(blocks)){block.hidden=false;block.querySelector(".note-text").textContent=t("Connect to write this one.");block.querySelector(".note-note").textContent="";block.querySelector(".adjust-link").disabled=true}
      return}
    status.textContent=t("Writing Echo’s notes on {point}…",{point:point.title});
    try{
      const made=await writeNotes(point,{...settings,targetLang:targetLang()});
      if(grammarOpen?.point.id!==point.id)return;
      for(const part of ["breath","remember"])notes[part]=makeNote({kind:"point",id:point.id,part,text:made[part]});
      notes.examples=makeNote({kind:"point",id:point.id,part:"examples",text:made.examples});
      await Promise.all(Object.values(notes).map(n=>putNote(n)));
      status.textContent="";
    }catch(error){status.textContent=sheetError(error);return}
  }
  for(const [part,block] of Object.entries(blocks)){
    const note=notes[part];block.hidden=false;block.querySelector(".adjust-link").disabled=!hasTranslator();
    noteBlock(block,{about:point.title+(point.hint?" ("+point.hint+")":""),kind:t(NOTE_TITLES[part]),note,
      onSave:async(text,by)=>{const next=makeNote({kind:"point",id:point.id,part,text,echo:note.echo??note.text,by});await putNote(next);notes[part]=next;return next},
      onReset:async()=>{const next=makeNote({kind:"point",id:point.id,part,text:note.echo??note.text});await putNote(next);notes[part]=next;return next},
      echoLine:t("Written by Echo the first time you opened this point, on your own key, and kept. Adjust it if it explains the wrong thing."),
      yoursLine:t("Your version. Reset brings Echo’s back.")});
  }
  if(notes.examples?.text?.length){
    const list=$("#point-example-list");list.replaceChildren();$("#point-examples").hidden=false;
    for(const example of notes.examples.text){
      const row=el("li"),text=el("div","kanji-sentence-text"),target=el("b");target.lang=targetLang();
      target.innerHTML=markPattern(rubyHtml(example.ja),point.title);enableVocabulary(target,example.ja,"ja");
      text.append(target,el("span",null,example.en));
      const keep=el("button","keep hit",t("Keep"));keep.type="button";
      keep.onclick=async()=>{keep.disabled=true;keep.textContent=t("Keeping…");
        try{await saveGrammarSentence({source:example.en,casual:example.ja,polite:example.ja},point,{example:{point:point.id,ja:example.ja,en:example.en}});
          const rest=notes.examples.text.filter(e=>e!==example);notes.examples=makeNote({kind:"point",id:point.id,part:"examples",text:rest});await putNote(notes.examples)}
        catch(error){keep.disabled=false;keep.textContent=t("Keep");$("#grammar-status").textContent=sheetError(error)}};
      row.append(text,keep);list.append(row)}
  }
}
// One note block: the text, whose it is, and the Adjust panel — an
// instruction to Echo, editing by hand, or Reset to Echo's.
function noteBlock(block,{about,kind,note,onSave,onReset,echoLine,yoursLine,render=null}){
  const text=block.querySelector(".note-text"),line=block.querySelector(".note-note"),panel=block.querySelector(".adjust-panel"),input=panel.querySelector("input"),rewrite=panel.querySelector(".rewrite"),reset=panel.querySelector(".reset-link"),adjust=block.querySelector(".adjust-link"),pstatus=panel.querySelector(".adjust-status");const adjustMic=panel.querySelector(".note-adjust-mic");if(adjustMic)bindDictation(adjustMic,input,pstatus);
  const show=n=>{if(render)render(n);else text.textContent=n.text;line.textContent=n.by==="you"?yoursLine:echoLine;block.dataset.by=n.by;reset.hidden=n.by!=="you"&&!(render&&n.by==="you")};
  show(note);pstatus.textContent="";input.value="";
  adjust.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden){input.focus()}};
  const current=()=>render?null:text.textContent;
  rewrite.onclick=async()=>{const instruction=input.value.trim();if(!instruction){input.focus();return}
    rewrite.disabled=true;pstatus.textContent=t("Rewriting…");
    try{const made=await adjustNote({about,kind,current:block.currentText?block.currentText():current(),instruction},{...settings,targetLang:targetLang()});
      note=await onSave(made,"you");show(note);pstatus.textContent=t("Rewritten. Yours now.");input.value=""}
    catch(error){pstatus.textContent=sheetError(error)}
    finally{rewrite.disabled=false}};
  reset.onclick=async()=>{note=await onReset();show(note);pstatus.textContent=t("Echo’s version is back.")};
  // Editing by hand: the text becomes editable while the panel is open, and
  // what you leave in it is saved on the way out.
  for(const p of block.querySelectorAll(".note-text")){
    p.contentEditable="false";
    p.onfocus=null;
    p.onblur=async()=>{if(p.contentEditable!=="true")return;const edited=block.currentText?block.currentText():p.textContent.trim();if(edited===(block.currentText?block.savedText:note.text)||!edited)return;note=await onSave(edited,"you");show(note);pstatus.textContent=t("Saved. Yours now.")};
  }
  const editable=on=>{for(const p of block.querySelectorAll(".note-text"))p.contentEditable=on?"true":"false"};
  adjust.onclick=()=>{panel.hidden=!panel.hidden;editable(!panel.hidden);if(!panel.hidden)input.focus()};
}
// The bundled story, or your version of it: an override in the notes store,
// the bundle itself never edited. Reset deletes the override.
async function renderStory(character){
  const block=$("#kanji-story"),bundled=STORIES[character];
  let override=null;try{override=await getNote(noteKey("kanji",character,"story"))}catch{override=null}
  const story=override?.text||bundled;block.hidden=!story;if(!story)return;
  block.querySelector(".adjust-link").disabled=!hasTranslator();block.querySelector(".adjust-panel").hidden=true;
  const note=override||{text:bundled,echo:bundled,by:"echo"};
  const asText=s=>[s.meaning,s.reading].filter(Boolean).join("\n\n"),fromText=v=>{const [meaning,...rest]=String(v).split(/\n\s*\n/);return {meaning:meaning.trim(),reading:rest.join("\n\n").trim()}};
  block.currentText=()=>[$("#kanji-story-meaning").textContent.trim(),$("#kanji-story-reading").textContent.trim()].filter(Boolean).join("\n\n");
  block.savedText=asText(story);
  noteBlock(block,{about:character+" ("+(kanjiFacts(character)?.en||[]).join(", ")+")",kind:t("Echo’s story"),note,
    render:n=>{const s=typeof n.text==="string"?fromText(n.text):n.text;$("#kanji-story-meaning").textContent=s.meaning||"";$("#kanji-story-reading").textContent=s.reading||"";block.savedText=asText(s)},
    onSave:async(text,by)=>{const next=makeNote({kind:"kanji",id:character,part:"story",text:fromText(text),echo:bundled||null,by});await putNote(next);return next},
    onReset:async()=>{await deleteNote(noteKey("kanji",character,"story"));return {text:bundled,echo:bundled,by:"echo"}},
    echoLine:"",
    yoursLine:t("Your version, kept on this device and in every backup. Reset brings the bundled one back.")});
}
// Whether a sentence uses a point is the model's own report, asked the same
// way tagging asks. It catches a sentence that plainly does not; it cannot
// catch the model agreeing with itself. The sentence stays in the box either
// way, and you decide.
async function sayForGrammar(){
  const target=grammarOpen;if(!target)return;
  const field=$("#grammar-say"),text=field.value.trim(),status=$("#grammar-say-status"),button=$("#grammar-say-go");
  if(!text){status.textContent=t("Say or type a sentence first.");field.focus();return}
  button.disabled=true;status.textContent=t("Translating…");
  try{
    const card=await composeFromIntent({grammar:target.point,intent:text},{...settings,inputLang,sourceLang:sourceLang(),targetLang:targetLang()});
    await saveGrammarSentence(card,target.point);field.value="";status.textContent=t("Saved to your library.");
  }catch(error){status.textContent=sheetError(error)}
  finally{button.disabled=!hasTranslator()}
}
async function composeForGrammar(){
  const target=grammarOpen;if(!target)return;
  const button=$("#grammar-compose"),previous=button.textContent;button.disabled=true;button.textContent=t("Writing…");$("#grammar-status").textContent="";
  try{
    const card=await compose({grammar:target.point},{...settings,sourceLang:sourceLang(),targetLang:targetLang()});
    await saveGrammarSentence(card,target.point);$("#grammar-status").textContent=t("Saved to your library.");
  }catch(error){$("#grammar-status").textContent=sheetError(error)}
  finally{button.disabled=!hasTranslator();button.textContent=previous}
}
async function saveGrammarSentence(card,point,{example=null}={}){
  const made=ensureSchedule(createSentence(card.source,card,new Date(),undefined,{sourceLang:sourceLang(),targetLang:targetLang()}));
  made.translationProvider=defaultProvider();made.grammar=[...new Set([...(card.grammar||[]),point.id])];
  // A kept example remembers it was one, so deleting it later puts the
  // suggestion back rather than losing it.
  if(example)made.example=example;
  await saveSentence(made);refreshDueBadge();
  await openGrammar(point,grammarCoverage(await listSentences()),{learn:grammarOpen?.learn||null});renderMap();
}
const deleteFromGrammarSheet=sentence=>askDelete(sentence,removeFromGrammarSheet);
// A sentence that began as one of Echo's examples goes back to "Two to try"
// when it is deleted: the suggestion was never the thing being thrown away.
async function restoreExample(sentence){
  const ex=sentence?.example;if(!ex?.point||!ex.ja)return;
  try{
    const key=noteKey("point",ex.point,"examples"),note=await getNote(key),list=Array.isArray(note?.text)?note.text:[];
    if(list.some(e=>e.ja===ex.ja))return;
    await putNote(makeNote({kind:"point",id:ex.point,part:"examples",text:[...list,{ja:ex.ja,en:ex.en}]}));
  }catch{}
}
async function removeFromGrammarSheet(sentence){
  if(!grammarOpen)return;
  if(loop.running&&kanjiPlaying?.id===sentence.id)loop.stop();
  await deleteSentence(sentence.id);await restoreExample(sentence);
  if(current?.id===sentence.id){current=null;renderSentence()}
  if(detail?.id===sentence.id)detail=null;
  refreshDueBadge();
  await openGrammar(grammarOpen.point,grammarCoverage(await listSentences()),{learn:grammarOpen.learn});
  $("#grammar-status").textContent=t("Deleted.");renderMap();
}
// The Words half: the dictionary's common words and the JLPT lists, read
// off your library like the kanji wall, with one sheet per word. A word is
// met when a sentence of yours uses it — conjugated forms count, found by
// their stem — and learned when that sentence reaches review. Echo writes a
// sentence with it, or a way to remember it, only when asked.
let wordOpen=null,wordLearnAt=null;const wordMore=new Map();
function renderWords(sentences){
  const cover=wordCoverage(sentences),known=wordLearned(sentences),met=cover.size,learnedN=known.size;
  const card=$("#words-summary");card.replaceChildren();
  card.append(el("span","overline",t("{n} words, N5 through the long tail",{n:WORD_TOTAL.toLocaleString()})));
  const line=el("p","summary-line");line.append(el("strong",null,learnedN.toLocaleString()),el("span",null,t("learned, {met} met",{met:met.toLocaleString()})));
  card.append(line,bar(learnedN,met,WORD_TOTAL),legend([["learned",t("Learned"),learnedN],["met",t("In a sentence"),met-learnedN],["",t("Not met yet"),WORD_TOTAL-met]]));
  const copy=el("p","copy");
  if(sentences.length){copy.append(t("A word is ")+"",el("em",null,t("met")),t(" once one of your sentences uses it — 食べた counts for 食べる — and "),el("em",null,t("learned")),t(" once that sentence reaches review. Echo reads words off their written form, with no parser behind it, so a short word in kana can be miscounted now and then. The wall is read off "));
    const link=el("button",null,sentences.length===1?t("your 1 sentence"):t("your {n} sentences",{n:sentences.length.toLocaleString()}));link.type="button";link.onclick=()=>showView("library");copy.append(link,t(", and nothing you do here changes them."))}
  else copy.textContent=t("Add a sentence and the words it uses will light up here. Look one up above, or practise a band and Echo opens each word in turn.");
  card.append(copy);
  const host=$("#word-bands");host.replaceChildren();
  for(const band of wordBands())host.append(renderWordBand(band,cover,known));
}
function wordRow(w,cover,known,onOpen){
  const count=(cover.get(w.id)||[]).length,state=known.has(w.id)?"learned":count?"met":"unmet";
  const row=el("button","point-row"+(state==="unmet"?" unused":""));row.type="button";row.dataset.word=w.id;
  const sw=el("span","swatch "+(state==="learned"?"learned":state==="met"?"met":""));if(state==="learned")sw.innerHTML=TICK;
  const title=el("b",null,w.w);title.lang="ja";row.append(sw,title);
  if(w.r!==w.w){const reading=el("span","reading",w.r);reading.lang="ja";row.append(reading)}
  row.append(el("span","gloss",w.en[0]||""));if(count)row.append(el("i",null,sentencesPhrase(count)));
  row.setAttribute("aria-label",w.w+(w.r!==w.w?"（"+w.r+"）":"")+" — "+t(STATE_LABELS[state])+(count?", "+inYours(count):""));
  row.onclick=onOpen;return row}
function renderWordBand(band,cover,known){
  const section=el("section","band");section.dataset.level=band.level;
  const total=band.words.length,metN=band.words.filter(w=>cover.has(w.id)).length,learnedN=band.words.filter(w=>known.has(w.id)).length,unmet=total-metN;
  section.append(bandHead(band,learnedN,metN,total,unmet===1?t("1 to meet"):t("{n} to meet",{n:unmet.toLocaleString()})));
  if(tool.open!==band.key)return section;
  section.classList.add("open");section.setAttribute("aria-busy","");
  const body=el("div","band-body");body.id="band-"+band.key;
  const chips=el("div","chips");
  const sets={all:band.words,unmet:band.words.filter(w=>!cover.has(w.id)),met:band.words.filter(w=>cover.has(w.id)&&!known.has(w.id)),learned:band.words.filter(w=>known.has(w.id))};
  for(const [key,label] of [["all",t("All")],["unmet",t("To meet")],["met",t("In a sentence")],["learned",t("Learned")]]){
    const chip=el("button","hit",label+" "+sets[key].length.toLocaleString());chip.type="button";chip.setAttribute("aria-pressed",String(tool.chip===key));
    chip.onclick=()=>{tool.chip=key;renderMap()};chips.append(chip)}
  body.append(chips);
  const shown=sets[tool.chip]||sets.all,limit=Math.min(shown.length,wordMore.get(band.key+tool.chip)||20);
  if(!shown.length)body.append(el("p","hint",t("Nothing in this band matches that yet.")));
  for(let i=0;i<limit;i+=20){
    body.append(chunkHead(i+1,Math.min(i+20,limit),i===0&&tool.chip==="all"));
    const rows=el("div","point-rows");for(const w of shown.slice(i,Math.min(i+20,limit)))rows.append(wordRow(w,cover,known,()=>openWord(w,cover)));body.append(rows)}
  // A band can hold thousands, so the list grows a hundred at a time; the
  // search above is the way to one word in particular.
  if(limit<shown.length){const rest=shown.length-limit,step=Math.min(rest,100);const more=el("button","show-more",rest<=step?t("Show the other {n} words",{n:rest.toLocaleString()}):t("Show {n} more of the {rest} words",{n:step.toLocaleString(),rest:rest.toLocaleString()}));more.type="button";more.onclick=()=>{wordMore.set(band.key+tool.chip,limit+step);renderMap()};body.append(more)}
  const foot=el("div","band-foot");
  if(unmet){const go=el("button","outlined",unmet===1?t("Practise the 1 you haven’t met"):t("Practise the {n} you haven’t met",{n:unmet.toLocaleString()}));go.type="button";go.onclick=()=>startWordLearn(band);foot.append(go,el("p","hint",t("Opens each one in turn, the most common first. Say your own sentence with it, or let Echo write one — either way it lands in your library like any other.")))}
  else foot.append(el("p","hint",t("You have met every word in this band.")));
  body.append(foot);section.append(body);return section}
function renderWordNav(cover){
  const nav=$("#word-learn-nav"),learn=wordOpen?.learn;nav.hidden=!learn;if(nav.hidden)return;
  const left=learn.order.filter(id=>!cover.has(id)).length;
  $("#word-learn-count").textContent=learn.level+" · "+(left===1?t("1 left to meet"):t("{n} left to meet",{n:left.toLocaleString()}));
  $("#word-prev").disabled=!nextUnmet(cover,wordOpen.word.id,-1,{order:learn.order});
  $("#word-next").disabled=!nextUnmet(cover,wordOpen.word.id,1,{order:learn.order});
}
async function startWordLearn(band){
  const cover=wordCoverage(await listSentences()),order=band.words.map(w=>w.id);
  const id=nextUnmet(cover,order.includes(wordLearnAt)?wordLearnAt:null,1,{inclusive:true,order})||nextUnmet(cover,null,1,{order});
  if(!id){toast(t("You have met every word in this band."),4000);return}
  wordLearnAt=id;await openWord(wordById(id),cover,{learn:{level:band.level,order}});
}
async function wordStep(direction){
  if(!wordOpen?.learn)return;
  const cover=wordCoverage(await listSentences());
  const id=nextUnmet(cover,wordOpen.word.id,direction,{order:wordOpen.learn.order});if(!id)return;
  wordLearnAt=id;if(loop.running)loop.stop();$("#word-say").value="";
  await openWord(wordById(id),cover,{learn:wordOpen.learn});$("#word-dialog").scrollTop=0;
}
async function openWord(w,cover,{learn=null,route=true}={}){
  wordOpen={word:w,learn};
  const all=await listSentences(),known=wordLearned(all),ids=cover.get(w.id)||[],state=known.has(w.id)?"learned":ids.length?"met":"unmet";
  renderWordNav(cover);
  $("#word-level").textContent=wordLevel(w)==="+"?"":wordLevel(w);
  const chip=$("#word-state");chip.textContent=t(STATE_LABELS[state]);chip.dataset.state=state;
  $("#word-kind").textContent=kindOf(w);
  $("#word-title").textContent=w.w;$("#word-reading").textContent=w.r!==w.w?w.r:"";
  $("#word-also").textContent=w.k?t("Also written {kanji}",{kanji:w.k}):"";$("#word-also").hidden=!w.k;
  $("#word-senses").replaceChildren(...w.en.map(sense=>el("li",null,sense)));
  $("#word-meta").textContent=ids.length
    ?capitalise(inYours(ids.length))+" · "+(state==="learned"?t("learned, since one of them reached review"):t("not learned yet — none of them has reached review"))
    :t("Not in any of your sentences yet");
  $("#word-say-label").textContent=t("Say a sentence using {word}",{word:w.w});
  $("#word-say-hint").textContent=t("Give Echo the meaning you want to express, in English or Japanese. Echo writes a new natural sentence using {word} and keeps it.",{word:w.w});
  $("#word-say-go").disabled=!hasTranslator();$("#word-say").disabled=!hasTranslator();$("#word-mic").disabled=!hasTranslator()||!dictationReady;
  $("#word-say-status").textContent="";$("#word-status").textContent=hasTranslator()?"":t("Add a translator and this starts working.");$("#word-loop-state").textContent="";
  $("#word-compose").textContent=t("Or let Echo write one with {word}",{word:w.w});$("#word-compose").disabled=!hasTranslator();
  const byId=new Map(all.map(s=>[s.id,s])),mine=ids.map(id=>byId.get(id)).filter(Boolean);
  expandableList({host:$("#word-sentences"),items:mine,moreLabel:t("See more"),lessLabel:t("See less"),render:shown=>renderSheetSentences($("#word-sentences"),shown,{deletable:true,onDelete:deleteFromWordSheet,mark:wordMarks(w).join("・")})});
  $("#word-mine-head").hidden=!mine.length;sheetCount($("#word-mine-head"),mine.length);
  if(!$("#word-dialog").open)$("#word-dialog").showModal();
  await renderWordNote(w);
}
// Echo's way to remember a word is written when you ask, not when the sheet
// opens: one request, on your key, kept on the device and in every backup.
async function renderWordNote(w){
  const block=$("#word-note"),ask=$("#word-note-ask"),hint=$("#word-note-hint");$("#word-note-status").textContent="";
  block.hidden=true;block.querySelector(".adjust-panel").hidden=true;
  let note=null;try{note=await getNote(noteKey("word",w.id,"remember"))}catch{note=null}
  ask.hidden=!!note;hint.hidden=!!note;ask.disabled=!hasTranslator();
  hint.textContent=hasTranslator()?t("One request on your key. Kept on this device and in every backup, and yours to adjust."):t("Add a translator and Echo can write one.");
  if(note)showWordNote(w,note);
}
function showWordNote(w,note){
  const block=$("#word-note");block.hidden=false;block.querySelector(".adjust-link").disabled=!hasTranslator();
  const save=async(text,by="you")=>{const next=makeNote({kind:"word",id:w.id,part:"remember",text,echo:note.echo??note.text,by});await putNote(next);note=next;return next};
  noteBlock(block,{about:w.w+(w.r!==w.w?"（"+w.r+"）":"")+" ("+(w.en[0]||"")+")",kind:t("A way to remember it"),note,
    onSave:save,
    onReset:async()=>{const next=makeNote({kind:"word",id:w.id,part:"remember",text:note.echo??note.text});await putNote(next);note=next;return next},
    echoLine:t("Written by Echo when you asked, on your own key, and kept on this device and in every backup. Adjust it if it does not stick."),
    yoursLine:t("Your version. Reset brings Echo’s back.")});
  const panel=block.querySelector(".adjust-panel"),text=block.querySelector(".note-text"),edit=panel.querySelector(".note-edit"),saveEdit=panel.querySelector(".note-save"),del=panel.querySelector(".note-delete"),regen=panel.querySelector(".note-regenerate"),mic=panel.querySelector(".note-adjust-mic"),instruction=panel.querySelector("input"),status=panel.querySelector(".adjust-status");
  // Word mnemonics use explicit Save edit. The generic blur-save races Delete/Generate new.
  text.onblur=null;
  edit.onclick=()=>{text.contentEditable="true";text.focus();edit.hidden=true;saveEdit.hidden=false};
  saveEdit.onclick=async()=>{const value=text.textContent.trim();if(!value)return;text.contentEditable="false";note=await save(value);edit.hidden=false;saveEdit.hidden=true;status.textContent=t("Saved. Yours now.")};
  del.onclick=async()=>{await deleteNote(noteKey("word",w.id,"remember"));block.hidden=true;$("#word-note-ask").hidden=false;$("#word-note-hint").hidden=false;$("#word-note-ask").disabled=!hasTranslator();$("#word-note-status").textContent=t("Deleted. You can generate a new one from scratch.")};
  regen.onclick=async()=>{regen.disabled=true;status.textContent=t("Writing a new one from scratch…");try{const made=await writeWordNote({word:w.w,reading:w.r,meaning:w.en.join(" / "),kind:kindOf(w)},{...settings,targetLang:targetLang()});const next=makeNote({kind:"word",id:w.id,part:"remember",text:made.remember});await putNote(next);showWordNote(w,next)}catch(error){status.textContent=sheetError(error)}finally{regen.disabled=false}};
  bindDictation(mic,instruction,status);
}
async function askWordNote(){
  const target=wordOpen;if(!target)return;const w=target.word,ask=$("#word-note-ask"),status=$("#word-note-status");
  ask.disabled=true;status.textContent=t("Writing Echo’s note on {word}…",{word:w.w});
  try{
    const made=await writeWordNote({word:w.w,reading:w.r,meaning:w.en.join(" / "),kind:kindOf(w)},{...settings,targetLang:targetLang()});
    if(wordOpen?.word.id!==w.id)return;
    const note=makeNote({kind:"word",id:w.id,part:"remember",text:made.remember});await putNote(note);
    status.textContent="";ask.hidden=true;$("#word-note-hint").hidden=true;showWordNote(w,note);
  }catch(error){status.textContent=sheetError(error);ask.disabled=!hasTranslator()}
}
const plainOf=card=>stripFurigana(card.casual||"")+"\n"+stripFurigana(card.polite||"");
async function sayForWord(){
  const target=wordOpen;if(!target)return;const w=target.word;
  const field=$("#word-say"),text=field.value.trim(),status=$("#word-say-status"),button=$("#word-say-go");
  if(!text){status.textContent=t("Say or type a sentence first.");field.focus();return}
  button.disabled=true;status.textContent=t("Writing a sentence with {word}…",{word:w.w});
  try{
    const card=await composeFromIntent({word:{word:w.w,reading:w.r,meaning:w.en.join(" / ")},intent:text,check:plain=>carriesWord(plain,w)},{...settings,sourceLang:sourceLang(),targetLang:targetLang()});
    await saveWordSentence(card,w);field.value="";status.textContent=t("Saved to your library.");
  }catch(error){status.textContent=sheetError(error)}
  finally{button.disabled=!hasTranslator()}
}
async function composeForWord(){
  const target=wordOpen;if(!target)return;const w=target.word;
  const button=$("#word-compose"),previous=button.textContent;button.disabled=true;button.textContent=t("Writing…");$("#word-status").textContent="";
  try{
    const card=await compose({word:{word:w.w,reading:w.r,meaning:w.en[0]||""},check:plain=>carriesWord(plain,w)},{...settings,sourceLang:sourceLang(),targetLang:targetLang()});
    await saveWordSentence(card,w);$("#word-status").textContent=t("Saved to your library.");
  }catch(error){$("#word-status").textContent=sheetError(error)}
  finally{button.disabled=!hasTranslator();button.textContent=previous}
}
async function saveWordSentence(card,w){
  const made=ensureSchedule(createSentence(card.source,card,new Date(),undefined,{sourceLang:sourceLang(),targetLang:targetLang()}));
  made.translationProvider=defaultProvider();await saveSentence(made);autoTag(made);refreshDueBadge();
  await openWord(w,wordCoverage(await listSentences()),{learn:wordOpen?.learn||null});renderMap();
}
const deleteFromWordSheet=sentence=>askDelete(sentence,removeFromWordSheet);
async function removeFromWordSheet(sentence){
  if(!wordOpen)return;
  if(loop.running&&kanjiPlaying?.id===sentence.id)loop.stop();
  await deleteSentence(sentence.id);await restoreExample(sentence);
  if(current?.id===sentence.id){current=null;renderSentence()}
  if(detail?.id===sentence.id)detail=null;
  refreshDueBadge();
  await openWord(wordOpen.word,wordCoverage(await listSentences()),{learn:wordOpen.learn});
  $("#word-status").textContent=t("Deleted.");renderMap();
}
function sheetError(error){
  const provider=defaultProvider(),name=PROVIDER_NAMES[provider]||provider;
  const refused=/\b(401|403|402|key|credit|quota)\b/i.test(error.message||""),offline=error instanceof TypeError;
  return offline?(settings.proxyUrl?t("{name} blocks direct requests from this browser, and the proxy only translates.",{name}):t("No connection, so the request never reached {name}.",{name}))
    :refused?t("{name} turned the request down.",{name}):(error.message||t("That did not work."));
}
const NUMBER_WORDS=["no","one","two","three","four","five","six","seven","eight","nine","ten"];
const spell=count=>NUMBER_WORDS[count]||String(count);
function describeGap(ms){const minutes=Math.round(ms/60000);if(minutes<60)return spell(Math.max(1,minutes))+(minutes===1?" minute":" minutes");const hours=Math.round(minutes/60);if(hours<24)return spell(hours)+(hours===1?" hour":" hours");const days=Math.round(hours/24);return spell(days)+(days===1?" day":" days")}
function updateDueBadge(count){const badge=$("#due-badge");badge.textContent=String(count);badge.hidden=count===0}
async function refreshDueBadge(){updateDueBadge(dueSentences((await listSentences()).map(item=>ensureSchedule(item))).length)}
// "Today you will": each due sentence's next skill, from review-modes.js.
function renderSkillMix(due){const mix=skillMix(due),row=$("#review-skill-mix-row");$("#review-skill-mix").hidden=due.length===0;
  row.setAttribute("aria-label","Today you will "+["listening","reading","writing"].map(mode=>reviewModeMeta(mode).verb+" "+mix[mode]).join(", "));
  row.replaceChildren(...["listening","reading","writing"].map(mode=>{const item=document.createElement("span");item.className="skill-mix-item";item.setAttribute("aria-hidden","true");const count=document.createElement("strong");count.textContent=String(mix[mode]);item.append(skillGlyph(mode,{size:30})," "+reviewModeMeta(mode).verb+" ",count);return item}))}
async function renderReviewHome(){const all=(await listSentences()).map(item=>ensureSchedule(item)),now=Date.now(),due=dueSentences(all),counts={new:0,learning:0,review:0};
  for(const item of due){const state=item.srs?.state??0;if(state===1||state===3)counts.learning++;else if(state===2)counts.review++;else counts.new++}
  $("#due-count").textContent=String(due.length);$("#due-new").textContent=String(counts.new);$("#due-learning").textContent=String(counts.learning);$("#due-review").textContent=String(counts.review);
  updateDueBadge(due.length);
  const waiting=all.filter(item=>!due.includes(item)),next=waiting.map(item=>Date.parse(item.srs.due)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  $("#review-due-block").hidden=due.length===0;$("#review-rest-block").hidden=due.length>0;
  document.querySelector(".ring-stage").classList.toggle("resting",due.length===0);
  $("#start-review").hidden=due.length===0;$("#review-practice").hidden=due.length>0;
  renderSkillMix(due);
  if(due.length){$("#review-estimate").textContent="About "+spell(Math.max(1,Math.round(due.length*.55)))+" minute"+(Math.round(due.length*.55)>1?"s":"")+", out loud.";
    $("#review-footnote").textContent=next?"Next batch unlocks in "+describeGap(next-now)+".":""}
  else{const at=next?new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(new Date(next)):null;
    $("#review-rest-copy").textContent=all.length===0?"Translate a sentence and it joins the queue straight away.":(at?"Your next batch comes back at "+at+". ":"")+spell(all.length)+(all.length===1?" sentence is":" sentences are")+" resting until then.";
    $("#review-footnote").textContent=all.length?"Reviewing early doesn't help — the gap is the point.":""}}
async function renderSidePanel(){
  const view=document.body.dataset.view;
  $("#side-panel").hidden=!isWide()||(view!=="practice"&&view!=="session");
  $("#due-panel").hidden=view!=="practice";
  $("#queue-panel").hidden=view!=="session";
  if($("#side-panel").hidden)return;
  if(view==="session")return renderQueuePanel();
  const due=dueSentences((await listSentences()).map(item=>ensureSchedule(item)));
  $("#side-due-count").textContent=String(due.length);
  // 聴4 · 読3 · 書2 — the same mix as review home, in one line.
  const mix=skillMix(due),minutes=Math.max(1,Math.round(due.length*.55));$("#side-skill-mix").hidden=due.length===0;
  $("#side-skill-mix-skills").textContent=["listening","reading","writing"].map(mode=>reviewModeMeta(mode).icon+" "+mix[mode]).join(" · ");
  $("#side-skill-mix-skills").setAttribute("aria-label",["listening","reading","writing"].map(mode=>mix[mode]+" "+reviewModeMeta(mode).label.toLowerCase()).join(", "));
  $("#side-skill-mix-time").textContent="about "+spell(minutes)+" minute"+(minutes===1?"":"s");
  $("#side-start-review").disabled=due.length===0;
  $("#due-empty").hidden=due.length>0;
  $("#due-list").replaceChildren(...due.slice(0,8).map(item=>{const li=document.createElement("li");
    li.innerHTML='<button type="button"><span lang="'+itemTarget(item)+'">'+escapeText(preferredPlainTarget(item))+'</span><span class="source-line">'+escapeText(item.source)+"</span></button>";
    li.querySelector("button").onclick=()=>openDetail(item.id);
    return li}));}
function renderQueuePanel(){
  $("#queue-list").replaceChildren(...reviewQueue.map((item,index)=>{const li=document.createElement("li");
    li.className=index===reviewIndex?"now":index<reviewIndex?"done":"";
    li.innerHTML='<span class="dot" aria-hidden="true"></span><span class="source-line">'+escapeText(item.source)+"</span>";
    const mode=reviewMode(item),glyph=skillGlyph(mode,{state:index===reviewIndex?"current":"default",size:24});li.append(glyph);li.setAttribute("aria-label",item.source+" — "+reviewModeMeta(mode).label.toLowerCase()+" card");
    return li}));
  const left=Math.max(0,reviewQueue.length-reviewIndex),done=reviewIndex;
  $("#queue-note").textContent=left?(done?spell(done)+" done. ":"")+"About "+spell(Math.max(1,Math.round(left*.55)))+" minutes left at your pace.":"All said.";}
const escapeText=value=>{const node=document.createElement("span");node.textContent=value;return node.innerHTML};
const CARD_STATES={due:"Due now",new:"New",learning:"Learning",review:"Review"};
const ORDER_LABELS={"created-desc":"Newest first","created-asc":"Oldest first","echoes-desc":"Most echoes","echoes-asc":"Fewest echoes","due-desc":"Furthest away","due-asc":"Due soonest","english-desc":"English Z–A","english-asc":"English A–Z","japanese-desc":"Japanese Z–A","japanese-asc":"Japanese A–Z"};
function cardState(item,now=Date.now()){const state=item.srs?.state??0;if(!item.srs?.due||Date.parse(item.srs.due)<=now)return "due";if(state===0)return "new";if(state===1||state===3)return "learning";return "review"}
function renderLibraryTool(all){const row=$("#library-tool");row.hidden=targetLang()!=="ja";if(row.hidden)return;
  const k=kanjiLearned(all).size,w=wordLearned(all).size,g=hasGrammar()?grammarLearned(all).size:null;
  $("#library-tool-tally").textContent=[k,w,g].filter(n=>n!==null).map(n=>n.toLocaleString()).join(" · ")+" "+t("learned");
  row.setAttribute("aria-label",t("Kanji, words and grammar")+": "+(g===null?t("{k} kanji and {w} words learned",{k:k.toLocaleString(),w:w.toLocaleString()}):t("{k} kanji, {w} words and {g} points learned",{k:k.toLocaleString(),w:w.toLocaleString(),g:g.toLocaleString()})))}
let historyRenderVersion=0;
async function renderHistory(){const version=++historyRenderVersion,all=await listSentences();if(version!==historyRenderVersion)return;renderLibraryTool(all);const list=$("#history-list"),due=dueSentences(all),query=$("#history-search").value.trim().toLocaleLowerCase(),filter=$("#history-filter").value,order=$("#history-order").value,direction=$("#history-direction").value,now=Date.now();let items=all.filter(item=>{const haystack=[item.source,item.target,item.plainTarget,item.casualTarget,item.politeTarget].filter(Boolean).join(" ").toLocaleLowerCase();if(query&&!haystack.includes(query))return false;const state=item.srs?.state??0;if(filter==="due")return !item.srs?.due||Date.parse(item.srs.due)<=now;if(filter==="new")return state===0;if(filter==="learning")return state===1||state===3;if(filter==="review")return state===2;if(filter==="skipped")return item.skipped===true;return true});const comparators={created:(a,b)=>a.createdAt.localeCompare(b.createdAt),echoes:(a,b)=>(Number(a.echoCount)||0)-(Number(b.echoCount)||0),due:(a,b)=>Date.parse(a.srs?.due||a.createdAt)-Date.parse(b.srs?.due||b.createdAt),english:(a,b)=>a.source.localeCompare(b.source),japanese:(a,b)=>preferredPlainTarget(a).localeCompare(preferredPlainTarget(b),itemTarget(a))},factor=direction==="asc"?1:-1;items.sort((a,b)=>factor*(comparators[order]||comparators.created)(a,b));list.replaceChildren();$("#empty-history").hidden=all.length>0;renderStarterOffer(all);document.querySelector(".history-tools").hidden=all.length===0;$("#empty-results").hidden=all.length===0||items.length>0;$("#empty-results-count").textContent=all.length===1?"One is in your library.":capitalise(spell(all.length))+" are in your library.";updateDueBadge(due.length);$("#library-count").textContent=items.length===1?"1 sentence":items.length+" sentences";$("#library-order-label").textContent=ORDER_LABELS[order+"-"+direction]||"";$(".list-head").hidden=items.length===0;if(isWide()&&!detail&&items.length)return openDetail(items[0].id);
  for(const [index,item] of items.entries()){if(index%10===0){await new Promise(resolve=>setTimeout(resolve,0));if(version!==historyRenderVersion)return}const li=document.createElement("li");li.dataset.id=item.id;const state=cardState(item,now);li.innerHTML='<button class="history-open" type="button"><span class="lines"><span lang="'+itemTarget(item)+'">'+rubyHtml(preferredTarget(item))+'</span><span class="source-line">'+escapeText(item.source)+'</span><span class="status-chip '+state+'">'+CARD_STATES[state]+'</span></span><span class="tally"><strong>'+(Number(item.echoCount)||0)+'</strong><span>echoes</span></span></button>';li.querySelector(".history-open").onclick=()=>openDetail(item.id);list.append(li)}markSelectedRow()}
const formatDate=value=>new Intl.DateTimeFormat(undefined,{day:"numeric",month:"long"}).format(new Date(value));
const RATING_LABELS={again:"Again",ok:"OK"};
function untilDue(sentence,now=Date.now()){const due=Date.parse(sentence.srs?.due||"");if(!Number.isFinite(due)||due<=now)return "Now";
  const minutes=Math.round((due-now)/60000);if(minutes<60)return minutes+"m";const hours=Math.round(minutes/60);if(hours<24)return hours+"h";return Math.round(hours/24)+"d"}
async function openDetail(id){const sentence=await getSentence(id);if(!sentence)return showView("library");resetSession();detail=ensureSchedule(sentence);showView("sentence");renderDetail()}
function markSelectedRow(){for(const li of document.querySelectorAll("#history-list li"))li.classList.toggle("selected",li.dataset.id===detail?.id);}
function renderDetailLearningText(){$("#sentence-grammar").replaceChildren();$("#sentence-grammar").hidden=true;$("#sentence-japanese").innerHTML=rubyHtml(preferredTarget(detail));$("#sentence-japanese").lang=itemTarget(detail);enableVocabulary($("#sentence-japanese"),preferredTarget(detail),itemTarget(detail),detail,{grammarHost:$("#sentence-grammar"),explain:true});}
function renderDetail(){if(!detail)return;closeEditor();markSelectedRow();
  $("#sentence-added").textContent="Added "+formatDate(detail.createdAt);
  renderDetailLearningText();
  $("#sentence-english").textContent=detail.source;
  const registerRow=$("#sentence-register-row"),canChooseRegister=hasRegisters(itemTarget(detail))&&(detail.casualTarget||detail.target)!==(detail.politeTarget||detail.target);
  registerRow.hidden=!canChooseRegister;
  if(canChooseRegister)for(const button of $("#sentence-register").querySelectorAll("[data-register]")){
    const on=button.dataset.register===sentenceRegister(detail);button.classList.toggle("selected",on);button.setAttribute("aria-pressed",String(on));
    button.onclick=async()=>{if(button.dataset.register===sentenceRegister(detail))return;resetSession();detail={...detail,reviewRegister:button.dataset.register,updatedAt:new Date().toISOString()};await saveSentence(detail);if(current?.id===detail.id){current=detail;$("#show-polite").checked=sentenceRegister(detail)==="polite";renderSentence()}renderDetail();renderHistory()}
  }
  $("#sentence-view").classList.toggle("hide-furigana",settings.showFurigana===false);
  $("#stat-echoes").textContent=String(Number(detail.echoCount)||0);
  const trackedDetail=ensureReviewTrack(detail),state=cardState(detail),next=reviewMode(trackedDetail);$("#stat-stage").textContent=CARD_STATES[state];$("#stat-stage").className="status-chip "+state;
  // How it has gone: a tile per skill with its passes; the next skill is lit.
  $("#sentence-review-track").replaceChildren(...["listening","reading","writing"].map(mode=>{const meta=reviewModeMeta(mode),tile=el("span","skill-tile"),count=el("strong","skill-count",String(trackedDetail.reviewTrack.completed[mode]||0)),label=el("span","skill-label",meta.label);if(mode===next)label.append(el("span","skill-next"," · next"));
    tile.dataset.reviewTrack=mode;tile.append(skillGlyph(mode,{state:mode===next?"current":"default",size:34}),count,label);return tile}));
  const due=Date.parse(detail.srs?.due||"");$("#stat-due").textContent=dueLine(trackedDetail,!Number.isFinite(due)||due<=Date.now()?"now":"in "+describeGap(due-Date.now()));
  const reviews=Array.isArray(detail.reviews)?[...detail.reviews]:[];
  const rows=reviews.slice().reverse().map(entry=>{const mode=entry.mode?reviewModeMeta(entry.mode):null;return {when:formatDate(entry.at),echoes:Number(entry.echoes)||0,rating:(mode?mode.label+" · ":"")+(RATING_LABELS[entry.rating]||entry.rating),className:entry.rating==="again"?"again":""}});
  rows.push({when:formatDate(detail.createdAt),echoes:null,rating:"First",className:"first"});
  $("#sentence-history").replaceChildren(...rows.map(row=>{const li=document.createElement("li");
    li.innerHTML='<span class="when">'+escapeText(row.when)+'</span><span class="detail">'+(row.echoes===null?"":'<span class="echoes">'+row.echoes+" echoes</span>")+'<span class="rating-chip '+row.className+'">'+escapeText(row.rating)+"</span></span>";return li}));
  const lapses=reviews.filter(entry=>entry.rating==="again").length;
  $("#sentence-history-note").textContent=lapses?"A review was marked Again "+(lapses===1?"once":spell(lapses)+" times")+".":reviews.length?"Reviewed correctly every time so far.":"Not reviewed yet — it is waiting in the queue.";
  $("#sentence-history-count").textContent=reviews.length===1?"1 session":reviews.length+" sessions";
  $("#sentence-play").disabled=false}
let editorGeneration=0,rewrittenDraft=null,editorOpenId=null;
function openEditor(){editorOpenId=detail?.id||null;editorGeneration++;
  const meaningLanguage=detail?.sourceLang&&detail.sourceLang!==itemTarget(detail)?detail.sourceLang:(sourceLang()!==itemTarget(detail)?sourceLang():"en");
  $("#sentence-meaning-language").replaceChildren(...LANGUAGES.map(([code,name])=>new Option(name,code)));$("#sentence-meaning-language").value=meaningLanguage;rewrittenDraft=null;$("#sentence-source-draft").value=detail?.source||"";$("#sentence-instruction").value="";$("#sentence-ai").open=false;$("#sentence-rewrite-status").textContent="";$("#sentence-rewrite").disabled=!hasTranslator();$("#sentence-save").disabled=false;if(!detail)return;resetSession();$("#sentence-draft").value=preferredTarget(detail);$("#sentence-edit-error").hidden=true;if(!$("#sentence-change").open)$("#sentence-change").open=true;for(const id of ["#sentence-draft","#sentence-source-draft"])fitTextArea($(id));$("#sentence-instruction").focus()}
function closeEditor(){editorOpenId=null;editorGeneration++;rewrittenDraft=null;$("#sentence-change").open=false}
async function saveEdit(event){event.preventDefault();if(!detail)return;
  const japanese=normalizeFurigana($("#sentence-draft").value.trim());
  if(!japanese||(hasFurigana(itemTarget(detail))&&!/[\u3040-\u30ff\u3400-\u9fff]/.test(japanese))){$("#sentence-edit-error").textContent="That needs to be a Japanese sentence.";$("#sentence-edit-error").hidden=false;return}
  const source=$("#sentence-source-draft").value.trim();
  if(!source){$("#sentence-edit-error").textContent="Enter the sentence meaning.";$("#sentence-edit-error").hidden=false;return}
  const plain=stripFurigana(japanese).trim();
  if(!rewrittenDraft&&plain===stripFurigana(preferredTarget(detail)).trim()&&japanese!==preferredTarget(detail))detail={...detail,readingOverrides:{...(detail.readingOverrides||{}),...Object.fromEntries(rubySegments(japanese).filter(p=>p.reading).map(p=>[p.text,p.reading]))}};
  if(sentenceRegister(detail)==="polite")detail={...detail,politeTarget:japanese,plainPoliteTarget:plain,updatedAt:new Date().toISOString()};
  else detail={...detail,target:japanese,plainTarget:plain,casualTarget:japanese,plainCasualTarget:plain,updatedAt:new Date().toISOString()};
  if(rewrittenDraft){const forms={...rewrittenDraft,source};forms[sentenceRegister(detail)==="polite"?"polite":"casual"]=japanese;detail=replaceSentenceContent(detail,forms);delete detail.grammar}else detail={...detail,source};
  delete detail.grammarAnalysis;delete detail.grammar;
  detail={...detail,sourceLang:$("#sentence-meaning-language").value||"en"};await saveSentence(detail);if(current?.id===detail.id){current=detail;renderSentence()}renderDetail()}
async function rewriteDetailSentence(){
  if(!detail||$("#sentence-rewrite").disabled)return;
  const instruction=$("#sentence-instruction").value.trim(),status=$("#sentence-rewrite-status"),button=$("#sentence-rewrite");
  if(!instruction){status.textContent="Tell AI what to change.";$("#sentence-instruction").focus();return}
  const generation=editorGeneration,id=detail.id;button.disabled=true;$("#sentence-save").disabled=true;status.textContent="Rewriting…";
  try{const card=await rewriteSentence({current:$("#sentence-draft").value,source:$("#sentence-source-draft").value,instruction,register:sentenceRegister(detail)},{...settings,sourceLang:$("#sentence-meaning-language").value||"en",targetLang:itemTarget(detail)});
    if(generation!==editorGeneration||detail?.id!==id)return;
    rewrittenDraft=card;$("#sentence-draft").value=sentenceRegister(detail)==="polite"?card.polite:card.casual;$("#sentence-source-draft").value=card.source;for(const id of ["#sentence-draft","#sentence-source-draft"])fitTextArea($(id));status.textContent="New sentence and meaning are ready below. Save to replace this sentence.";
  }catch(error){if(generation===editorGeneration)status.textContent=error.message||"Could not rewrite. Try again."}
  finally{if(generation===editorGeneration&&detail?.id===id){button.disabled=!hasTranslator();$("#sentence-save").disabled=false}}
}
function playDetail(){if(!detail)return;if(loop.running){loop.togglePause();return}
  const voice=voices[Number($("#voice").value)]||voices[0]||null;loop.play(preferredTarget(detail),{voice,rate:Number($("#rate").value),lang:targetLang()})}
// One confirm sheet for every delete — the detail page and the rows on the
// kanji and grammar sheets — so a slip of the thumb costs a second tap, and
// the consequence line is read the same way everywhere.
let pendingDelete=null;
async function askDelete(sentence=detail,onConfirm=confirmDetailDelete){if(!sentence)return;
  pendingDelete={sentence,onConfirm};
  $("#delete-quote").innerHTML=rubyHtml(preferredTarget(sentence));
  await renderDeleteConsequence(sentence);
  const echoes=Number(sentence.echoCount)||0,reviews=Array.isArray(sentence.reviews)?sentence.reviews.length:0;
  const say=echoes<=10&&reviews<=10?spell:String;
  $("#delete-copy").textContent="It leaves your library, its place in the review queue, and every export from here on. "+
    (echoes||reviews?capitalise(say(echoes))+(echoes===1?" echo":" echoes")+" and "+say(reviews)+(reviews===1?" review":" reviews")+" go with it. ":"")+"There is no undo.";
  $("#delete-dialog").showModal()}
async function confirmDelete(){const pending=pendingDelete;pendingDelete=null;$("#delete-dialog").close();if(pending)await pending.onConfirm(pending.sentence)}
async function confirmDetailDelete(){if(!detail)return;const id=detail.id,gone=detail;resetSession();
  await deleteSentence(id);await restoreExample(gone);if(current?.id===id){current=null;renderSentence()}
  reviewQueue=reviewQueue.filter(item=>item.id!==id);detail=null;refreshDueBadge();showView("library")}
const capitalise=value=>value.charAt(0).toUpperCase()+value.slice(1);
// The wall is a mirror, not a trophy case: delete the only sentence carrying
// a kanji or a point and it goes back to not met. Said before, not after.
async function renderDeleteConsequence(sentence){
  const line=$("#delete-consequence");line.hidden=true;line.replaceChildren();
  if(targetLang()!=="ja")return;
  const others=(await listSentences()).filter(s=>s.id!==sentence.id),cover=kanjiCoverage(others),gcover=grammarCoverage(others),wcover=wordCoverage(others);
  const kanji=[...sentenceKanji(sentence)].filter(c=>!cover.has(c)),points=grammarTags(sentence.grammar).filter(id=>!gcover.has(id)).map(id=>grammarPoint(id)?.title).filter(Boolean);
  // Words of their own: "the only one with the words 電車 and 食べる". Past
  // five, a count; a one-character word is the kanji already named.
  const words=[...new Set([...sentenceWords(sentence)].filter(id=>!wcover.has(id)).map(id=>wordById(id)?.w).filter(w=>w&&w.length>1))];
  const extra=Math.max(0,words.length-5),shownWords=words.slice(0,5);if(extra)shownWords.push(t("{n} more",{n:extra}));
  if(!kanji.length&&!points.length&&!words.length)return;
  const ja=text=>{const b=el("b",null,text);b.lang="ja";return b};
  const join=items=>{const out=[];items.forEach((item,i)=>{if(i)out.push(document.createTextNode(i===items.length-1?" "+t("and")+" ":", "));out.push(ja(item))});return out};
  if(kanji.length)line.append(document.createTextNode(t("It is the only sentence you have with ")),...join(kanji));
  if(words.length)line.append(document.createTextNode(kanji.length?", "+t("the only one with the words")+" ":t("It is the only sentence you have with the words")+" "),...join(shownWords));
  if(points.length)line.append(document.createTextNode((kanji.length||words.length)?", "+t("and the only one using")+" ":t("It is the only sentence you have using")+" "),...join(points));
  line.append(document.createTextNode(" — "+(kanji.length+points.length+words.length===1?t("that goes back to “not met” on the wall."):t("those go back to “not met” on the wall."))+" "+t("The wall only ever counts what is in your library.")));
  line.hidden=false;
}
function resetSetupForm(){const provider=defaultProvider();$("#setup-provider").value=provider;showSetupFields();syncLanguageSelects();showSetupStep(1)}
function showSetupFields(){const provider=$("#setup-provider").value,local=provider==="local";
  $("#setup-key-field").hidden=local;$("#setup-endpoint-field").hidden=!local;
  $("#setup-hint").textContent=local?"Echo talks to an OpenAI-compatible server — Ollama or LM Studio — running on your machine."
    :provider==="google"?"Google AI Studio gives you a key with your Google account, on a free tier. No card, no billing account."
    :"Your service gives you a key in its own dashboard, usually under API keys.";
  const link=$("#setup-key-link"),url=PROVIDER_KEY_URLS[provider];
  link.hidden=!url;if(url){link.href=url;link.textContent="Create a "+PROVIDER_NAMES[provider]+" key"}
  link.parentElement.hidden=!url}
// Two steps: the translator, then the pair. The pair is the second because it
// means nothing until there is something to translate with.
let setupStep=1;
function showSetupStep(step){setupStep=step;
  $("#setup-step-1").hidden=step!==1;$("#setup-step-2").hidden=step!==2;if(step===2)listSentences().then(renderSetupStarter).catch(()=>renderSetupStarter([]));
  $("#setup-step-label").textContent="Step "+step+" of 2";
  $("#setup-title").textContent=step===1?"One thing first":"Your languages";document.querySelector("#setup-view .note-box").hidden=step!==1;
  $("#setup-copy").textContent=step===1
    ?"Echo needs a translator. Pick a service you have an account with and paste its key — it is saved on this device and goes nowhere else."
    :"Write in the language you think in. Echo answers in the one you are learning.";
  $("#setup-next").hidden=step!==1;$("#setup-save").hidden=step!==2;
  $("#setup-skip").hidden=step!==1;}
function storeTranslator(){const provider=$("#setup-provider").value;
  settings.provider=provider;
  if(provider==="local")settings.localEndpoint=$("#setup-endpoint").value.trim();
  else settings.providerKeys={...(settings.providerKeys||{}),[provider]:$("#setup-key").value.trim()};}
// The import runs after Start practising and is awaited before routing. If it
// fails, onboarding still finishes: the learner is told, and Settings offers it.
async function saveSetup(){storeTranslator();
  if(!$("#setup-starter").hidden&&$("#setup-starter-add").checked){const button=$("#setup-save");button.disabled=true;$("#setup-starter-status").textContent="Adding the starter sentences…";
    try{await addStarter();$("#setup-starter-status").textContent=""}
    catch{toast("The ミニ本語 Minihongo starter could not be downloaded. You can add it later in Settings → Your sentences.",7000);$("#setup-starter-status").textContent=""}
    finally{button.disabled=false}}
  finishOnboarding()}
function finishOnboarding(){settings.onboarded=true;storePreference("jp-echo-settings",JSON.stringify(settings));resetSettingsForm();showView("practice")}
async function performTranslation(){const english=$("#english-input").value.trim();if(!english)return setStatus(t("Enter a sentence in {language}.",{language:t(languageName(inputLang))}),true);const provider=defaultProvider();if(!hasTranslator())return showView("setup");
  // Swap the label's text, not the button's: textContent would take the arrow
  // icon and the .label span with it, and they never came back — after one
  // translation the button was bare text that no longer answered the rule
  // hiding the word on a phone.
  const button=$("#translate"),label=button.querySelector(".label"),previous=label.textContent;button.disabled=true;label.textContent="Translating…";button.setAttribute("aria-busy","true");setStatus("Translating…");try{translationFailure=null;const card=await translate(english,{...settings,inputLang});resetSession();current=ensureSchedule(createSentence(card.source,card,new Date(),undefined,{sourceLang:sourceLang(),targetLang:targetLang()}));current.reviewRegister=$("#show-polite").checked?"polite":"casual";current.translationProvider=provider;await saveSentence(current);autoTag(current);renderSentence();refreshDueBadge();clearComposer();setStatus("Ready to practice.")}catch(error){const name=PROVIDER_NAMES[provider]||provider;
    const refused=/\b(401|403|402|key|credit|quota)\b/i.test(error.message||"");
    // A failed fetch is a TypeError and its message is "Failed to fetch",
    // which tells you nothing you did not already suspect.
    const offline=error instanceof TypeError;
    translationFailure={title:refused?name+" turned the request down":"Translation failed",
      copy:(offline?"No connection, so the request never reached "+name+".":(error.message||"The request did not get through."))+" Your sentence is still in the box."};
    // Put the sentence back if anything took it, and say so beside the button
    // rather than only in the notice above: the notice can be off-screen on a
    // phone, where the composer is docked to the bottom and is what you are
    // looking at. Never overwrite something typed while the request was in
    // flight.
    if(!$("#english-input").value.trim())$("#english-input").value=english;
    setStatus(offline?"No connection — your sentence is still here.":refused?name+" turned the request down.":"Translation failed — your sentence is still here.",true);
    renderPracticeNotices()}finally{button.disabled=false;label.textContent=previous;button.removeAttribute("aria-busy")}}
function clearComposer(){$("#english-input").value="";$("#voice-input-status").textContent=""}
function setStatus(message,error=false){$("#status").textContent=message;$("#status").classList.toggle("error",error)}
// A confirmation that does not belong in #status, which reports on the
// translation and gets overwritten by it. Re-announcing means clearing the
// live region first: setting textContent to the same string it already holds
// is not a change, and a screen reader says nothing.
let toastTimer=null;
function toast(message,ms=2600){const node=$("#toast");if(toastTimer)clearTimeout(toastTimer);node.hidden=true;node.textContent="";requestAnimationFrame(()=>{node.textContent=message;node.hidden=false});toastTimer=setTimeout(()=>{node.hidden=true;node.textContent="";toastTimer=null},ms)}
// Voices come from the operating system, not the browser — there is no
// download link inside Chromium to point at. So the help is per platform,
// picked from the user agent, with the generic list as the fallback.
const VOICE_HELP=[
  [/android/i,["Open Settings, then Accessibility.","Choose Text-to-speech output, then the gear beside your engine (usually Speech Recognition &amp; Synthesis).","Tap Install voice data and pick the language you want."]],
  [/iphone|ipad|ipod/i,["Open Settings, then Accessibility.","Choose Spoken Content, then Voices.","Pick the language and tap a voice to download it."]],
  [/mac os x|macintosh/i,["Open System Settings, then Accessibility.","Choose Spoken Content, then the ⓘ beside System Speech Language.","Click Manage Voices and download the one you want."]],
  [/cros/i,["Open Settings, then Accessibility.","Choose Text-to-Speech.","Under Speech engines, open the engine's settings and add the language."]],
  [/windows/i,["Open Settings, then Time &amp; language.","Choose Speech, then Manage voices.","Click Add voices, pick the language, and add it."]]];
const VOICE_HELP_FALLBACK=["Voices are installed by your operating system, not by Echo.","Look for Text-to-speech or Spoken Content in your system settings and add the language you want.","Restart the browser afterwards so it picks the new voice up."];
function renderVoiceHelp(){const ua=navigator.userAgent;
  const steps=(VOICE_HELP.find(([test])=>test.test(ua))||[null,VOICE_HELP_FALLBACK])[1];
  const list=document.createElement("ol");
  for(const step of steps){const item=document.createElement("li");item.innerHTML=step;list.append(item)}
  const note=document.createElement("p");note.className="hint";
  note.textContent="Echo speaks with whatever voices your device has. Reload this page once a voice is installed.";
  $("#voice-help-body").replaceChildren(list,note)}
function populateVoices(){voices=japaneseVoices(targetLang());const fill=(select,previous)=>{select.replaceChildren(new Option("Default voice","default"),new Option("Random voice","random"),...voices.map((voice,index)=>new Option(voice.name+" ("+voice.lang+")",String(index))));select.value=[...select.options].some(o=>o.value===previous)?previous:"default"};fill($("#voice"),settings.voice||"default");fill($("#discussion-voice-ai"),settings.discussionVoiceAI||"default");fill($("#discussion-voice-user"),settings.discussionVoiceUser||"default");const missing=voices.length===0;$("#voice-missing").hidden=!missing;$("#voice-warning").textContent="No "+languageName(targetLang())+" voice is installed on this device.";$("#voice-install").textContent="Add "+languageName(targetLang())+" voice";$("#play-pause").disabled=!current;if(!missing)$("#voice-install-status").textContent="";if(!$("#main-view").hidden)renderPracticeNotices()}
function installTargetVoice(){openSettings();$("#voice-help").open=true;const status=$("#voice-install-status");if(/android/i.test(navigator.userAgent)){status.textContent="Opening Android text-to-speech settings. Install "+languageName(targetLang())+", then return to Echo.";window.location.href="intent:#Intent;action=com.android.settings.TTS_SETTINGS;end";setTimeout(()=>{$("#voice-help").scrollIntoView({block:"center"})},500);return}status.textContent="Your browser cannot install system voices itself. Follow the steps below, then return to Echo.";$("#voice-help").scrollIntoView({block:"center"})}
const DICTATION={
  listening:"Listening — keep going",
  unavailable:"Dictation isn't available in this browser — type it instead.",
  "not-allowed":"Microphone blocked — type it instead.",
  "no-speech":"Nothing heard — tap the mic or type it.",
  "audio-capture":"No microphone available — type it instead.",
  // Firefox has no recogniser at all; Brave ships the API without the service
  // behind it, so start() resolves straight into one of these two.
  network:"Dictation needs a connection your browser will not make — type it instead.",
  "service-not-allowed":"Your browser blocks its speech service — type it instead.",
  "service-timeout":"Speech recognition did not respond — try Chrome/Google speech services, or type it instead.",
  failed:"Dictation failed — type it instead."};
const dictationError=error=>DICTATION[error]||DICTATION.failed;
// Append rather than replace, so a second burst adds to what you already said
// instead of throwing it away.
const appendHeard=(field,heard)=>{field.value=(field.value?field.value.trimEnd()+" "+heard:heard).trim()};
function bindDictation(mic,field,status){
  const canRecord=!!(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder);
  const hasNative=!!recognitionFactory(inputLang),nativeBroken=()=>localStorage.getItem("jp-echo-native-dictation-broken")==="1",markNativeBroken=()=>storePreference("jp-echo-native-dictation-broken","1");
  if(!hasNative&&!canRecord){mic.disabled=true;mic.onclick=null;status.textContent=DICTATION.unavailable;return false}
  mic.disabled=false;if(status.textContent===DICTATION.unavailable)status.textContent="";
  let active=null,watchdog=null,fallbackStarted=false;
  const idle=()=>{if(watchdog)clearTimeout(watchdog);watchdog=null;active=null;mic.classList.remove("is-listening");mic.setAttribute("aria-pressed","false")};
  async function recordedFallback(){
    if(fallbackStarted||!canRecord)return false;fallbackStarted=true;idle();
    let stream,recorder,chunks=[],ctx,source,analyser,raf,heardSound=false,lastSound=performance.now(),started=performance.now();
    try{
      status.textContent="Starting microphone…";stream=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(stream);
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();mic.classList.add("is-listening");mic.setAttribute("aria-pressed","true");status.textContent=DICTATION.listening;
      ctx=new (window.AudioContext||window.webkitAudioContext)();source=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();analyser.fftSize=512;source.connect(analyser);const data=new Uint8Array(analyser.fftSize);
      await new Promise(resolve=>{const tick=()=>{analyser.getByteTimeDomainData(data);let sum=0;for(const v of data){const x=(v-128)/128;sum+=x*x}const rms=Math.sqrt(sum/data.length),now=performance.now();if(rms>.025){heardSound=true;lastSound=now}if((heardSound&&now-lastSound>900)||now-started>12000){resolve();return}raf=requestAnimationFrame(tick)};tick()});
      if(recorder.state==="recording")recorder.stop();await stopped;const type=recorder.mimeType||chunks[0]?.type||"audio/webm",blob=new Blob(chunks,{type});status.textContent="Transcribing…";if(!heardSound||!blob.size)throw new Error("Nothing heard.");const heard=await transcribeAudio(blob,inputLang,settings);appendHeard(field,heard);status.textContent="Edit anything it mishears before you send.";return true
    }catch(error){status.textContent=error?.name==="NotAllowedError"?DICTATION["not-allowed"]:(error?.message||DICTATION.failed);return false}
    finally{if(raf)cancelAnimationFrame(raf);try{source?.disconnect()}catch{}try{await ctx?.close()}catch{}stream?.getTracks().forEach(track=>track.stop());idle();fallbackStarted=false}
  }
  mic.setAttribute("aria-pressed","false");
  mic.onclick=()=>{
    if(active){try{active.abort()}catch{}idle();return}
    if(!hasNative||nativeBroken()){recordedFallback();return}
    const recognition=recognitionFactory(inputLang);if(!recognition){recordedFallback();return}active=recognition;let gotEvent=false;
    recognition.onstart=()=>{gotEvent=true;status.textContent=DICTATION.listening};
    recognition.onresult=e=>{gotEvent=true;appendHeard(field,e.results[0][0].transcript);status.textContent="Edit anything it mishears before you send."};
    recognition.onerror=e=>{gotEvent=true;const error=e.error;idle();if(error==="not-allowed"||error==="audio-capture")status.textContent=dictationError(error);else{markNativeBroken();recordedFallback()}};
    recognition.onend=()=>{const hadEvent=gotEvent;idle();if(!hadEvent){markNativeBroken();recordedFallback()}};
    mic.classList.add("is-listening");mic.setAttribute("aria-pressed","true");status.textContent="Starting microphone…";
    watchdog=setTimeout(()=>{if(active===recognition&&!gotEvent){markNativeBroken();try{recognition.abort()}catch{}idle();recordedFallback()}},5000);
    try{recognition.start()}catch{markNativeBroken();idle();recordedFallback()}
  };
  return true}
function setupRecognition(){
  dictationReady=bindDictation($("#microphone"),$("#english-input"),$("#voice-input-status"));
  bindDictation($("#kanji-mic"),$("#kanji-say"),$("#kanji-say-status"));
  bindDictation($("#grammar-mic"),$("#grammar-say"),$("#grammar-say-status"));
  bindDictation($("#sentence-rewrite-mic"),$("#sentence-instruction"),$("#sentence-rewrite-voice"));
  bindDictation($("#word-mic"),$("#word-say"),$("#word-say-status"));
  }
async function startReview(){if(reviewBusy)return;const items=await listSentences(),prepared=items.map(item=>ensureReviewTrack(ensureSchedule(item)));await Promise.all(prepared.filter((item,index)=>item!==items[index]).map(saveSentence));reviewQueue=dueSentences(prepared);reviewIndex=0;reviewUndo=[];if(!reviewQueue.length)return showView("review");showView("session");renderReview()}
function reviewJapanese(sentence){return hasRegisters(itemTarget(sentence))?preferredTarget(sentence):(sentence.target||"")}
function reviewPlainJapanese(sentence){return hasRegisters(itemTarget(sentence))?preferredPlainTarget(sentence):(sentence.plainTarget||stripFurigana(sentence.target||""))}
const STAGE_LABELS={0:"New",1:"Learning",2:"Review",3:"Relearning"};
function stageLabel(sentence){const state=sentence.srs?.state??0,reps=Number(sentence.srs?.reps)||0;return STAGE_LABELS[state]+(reps?" · seen "+reps+(reps===1?" time":" times"):"")}
function stageClass(sentence){const state=sentence.srs?.state??0;return state===0?"new":state===2?"review":"learning"}
function renderReview(){updateReviewPrevious();resetSession();stopReviewListening();const sentence=reviewQueue[reviewIndex],complete=!sentence;
  $("#review-panel").hidden=complete;$("#review-prompt-actions").hidden=complete;$("#review-actions").hidden=true;$("#review-complete").hidden=!complete;
  $("#review-progress").textContent=complete?`${reviewQueue.length} / ${reviewQueue.length}`:`${reviewIndex+1} / ${reviewQueue.length}`;
  renderSidePanel();$("#review-progress-bar").style.width=(reviewQueue.length?Math.round((complete?reviewQueue.length:reviewIndex)/reviewQueue.length*100):0)+"%";
  if(complete)return renderReviewComplete();
  reviewRevealed=false;
  const mode=reviewMode(sentence),meta=reviewModeMeta(mode),writing=mode==="writing",listening=mode==="listening";
  $("#review-panel").dataset.reviewMode=mode;
  $("#review-stage").textContent=stageLabel(sentence);$("#review-stage").className="status-chip "+stageClass(sentence);
  $("#review-skills").replaceChildren(skillTrio(mode,{label:meta.label+" card. This sentence turns through listening, reading and writing."}));
  $("#review-mode-title").textContent=meta.title;
  // The reason comes from the sentence's real track (review-modes.js), so it
  // stays true when Again keeps a skill for another visit.
  $("#review-mode-instruction").textContent=skillReason(sentence);
  $("#review-passive-hint").textContent=listening?"Say what it means, out loud or to yourself, then reveal it.":"Say it out loud, then check the meaning.";
  $("#review-prompt").hidden=listening;
  $("#review-prompt").lang=mode==="reading"?targetLang():sourceLang();
  $("#review-prompt").textContent=mode==="reading"?reviewPlainJapanese(sentence):sentence.source;
  $("#review-prompt-echo").textContent=sentence.source;
  $("#review-passive").hidden=writing;$("#review-front-audio").hidden=!listening;$("#review-capture").hidden=!writing;$("#review-answer-tools").hidden=true;
  $("#review-capture-label").textContent="Write it in Japanese";$("#review-answer").lang=itemTarget(sentence);$("#review-answer").placeholder="Write the Japanese sentence";$("#review-answer").value="";$("#review-listen-state").textContent="";
  $("#review-grammar").replaceChildren();$("#review-grammar").hidden=true;$("#review-result").hidden=true;$("#review-attempt-label").hidden=true;$("#review-attempt").hidden=true;
  $("#review-check .label").textContent=listening?"Reveal the sentence":mode==="reading"?"Show the meaning":"Check and listen";
  echoesAtCardStart=Number(sentence.echoCount)||0;$("#review-echo-count").textContent=String(echoesAtCardStart);
  updateCheckButton();
  if(listening)requestAnimationFrame(()=>{if(reviewQueue[reviewIndex]?.id===sentence.id&&!reviewRevealed)playReviewAudio()});
  else if(writing)$("#review-answer").focus()}
async function renderReviewComplete(){const done=reviewQueue.length;let copy=done?spell(done)+(done===1?" review":" reviews")+" completed.":"Nothing was due.";
  const all=(await listSentences()).map(item=>ensureSchedule(item)),next=all.filter(item=>!isDue(item)).map(item=>Date.parse(item.srs.due)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  if(next)copy+=" The next batch comes back in "+describeGap(next-Date.now())+".";
  $("#review-complete-copy").textContent=copy;refreshDueBadge()}
function updateCheckButton(){const sentence=reviewQueue[reviewIndex];if(!sentence)return $("#review-check").disabled=true;$("#review-check").disabled=reviewMode(sentence)==="writing"&&!$("#review-answer").value.trim()}
async function revealReview(){let sentence=reviewQueue[reviewIndex];if(!sentence||reviewRevealed)return;
  const mode=reviewMode(sentence),attempt=$("#review-answer").value.trim();if(mode==="writing"&&!attempt)return;
  reviewRevealed=true;stopReviewListening();resetSession();
  if(sentence.skipped){sentence={...sentence,skipped:false,skippedAt:null,updatedAt:new Date().toISOString()};reviewQueue[reviewIndex]=sentence;await saveSentence(sentence)}
  const target=reviewJapanese(sentence);
  $("#review-prompt-echo").textContent=sentence.source;
  if(mode==="writing"){
    $("#review-attempt-label").hidden=false;$("#review-attempt").hidden=false;
    $("#review-attempt").innerHTML=markAttempt(attempt,target).map(part=>part.changed?"<mark>"+escapeText(part.text)+"</mark>":escapeText(part.text)).join("");
    $("#review-japanese").innerHTML=markTarget(attempt,target).map(part=>part.changed?"<mark>"+part.html+"</mark>":part.html).join("");
  }else{
    $("#review-attempt-label").hidden=true;$("#review-attempt").hidden=true;$("#review-attempt").textContent="";
    $("#review-japanese").innerHTML=rubyHtml(target);
  }
  enableReviewVocabulary(sentence,target);
  $("#review-panel").classList.toggle("hide-furigana",mode==="writing"&&settings.showFurigana===false);
  $("#review-capture").hidden=true;$("#review-passive").hidden=true;$("#review-result").hidden=false;
  $("#review-prompt").hidden=true;$("#review-prompt-actions").hidden=true;$("#review-actions").hidden=false;
  playReviewAudio()}
function reviewVocabularyHits(sentence,target){
  return wordSpans(stripFurigana(target));
}
function enableReviewVocabulary(sentence,target){enableVocabulary($("#review-japanese"),target,itemTarget(sentence),sentence,{grammarHost:$("#review-grammar")})}
// Preserve ruby and review correction marks while attaching the same dictionary
// action to every fragment of a surface word. Reading annotations aren't offsets.
// Grammar is shown only where a host is given: the sentence page and the
// revealed review answer. Lists, sheets, Discussion and Reading keep word
// lookup but no grammar UI, so nothing is injected into a row or bubble.
function enableVocabulary(root,target,lang=targetLang(),sentence=null,{grammarHost=null,explain=false}={}){
  if(!root||lang!=="ja")return;
  const plain=stripFurigana(target),analysis=grammarAnalysisCache.get(plain)||(sentence?.grammarAnalysis||[]).find(a=>a.text===plain);
  const vocabulary=wordSpans(plain),grammar=(analysis?.spans||[]).filter(s=>grammarPoint(s.id)&&plain.slice(s.start,s.end)===s.quote);
  const edges=[...new Set([...vocabulary,...grammar].flatMap(h=>[h.start,h.end]))].sort((a,b)=>a-b),hits=[];
  for(let i=0;i<edges.length-1;i++){const start=edges[i],end=edges[i+1],word=vocabulary.find(h=>h.start<=start&&end<=h.end),points=grammar.filter(h=>h.start<=start&&end<=h.end);if(word||points.length)hits.push({...(word||{}),start,end,wordStart:word?.start,wordEnd:word?.end,grammarIds:[...new Set(points.map(h=>h.id))]})}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())if(!walker.currentNode.parentElement?.closest("rt"))nodes.push(walker.currentNode);
  let offset=0;
  for(const node of nodes){const frag=document.createDocumentFragment(),data=node.data;let local=0;
    while(local<data.length){const at=offset+local,index=hits.findIndex(h=>h.start<=at&&at<h.end),hit=hits[index];
      if(!hit){frag.append(document.createTextNode(data[local]));local++;continue}
      const take=Math.min(data.length-local,hit.end-at),span=document.createElement("span");
      // Two marks that can share a segment: a word to look up (grey dotted
      // border, interactive) and grammar (vermilion dotted underline, explained
      // in the list below, not interactive here).
      const isWord=hit.wordStart!==undefined,isGrammar=hit.grammarIds.length>0;span.className=[isWord?"review-vocab":"",isGrammar?"grammar-mark":""].filter(Boolean).join(" ");span.dataset.vocabularyIndex=index;
      if(isWord){span.tabIndex=0;span.setAttribute("role","button");span.setAttribute("aria-label","Look up "+stripFurigana(target).slice(hit.wordStart,hit.wordEnd))}
      span.textContent=data.slice(local,local+take);frag.append(span);local+=take}
    offset+=data.length;node.replaceWith(frag)}
  const tokenFor=event=>event.target.closest?.(".review-vocab")||event.target.closest?.("ruby")?.querySelector(".review-vocab");
  const open=token=>{const hit=hits[Number(token.dataset.vocabularyIndex)];resetSession();openVocabularyHit(hit,stripFurigana(target))};
  root.onclick=event=>{const token=tokenFor(event);if(token){event.preventDefault();event.stopPropagation();open(token)}};
  root.onkeydown=event=>{if(event.key!=="Enter"&&event.key!==" ")return;const token=tokenFor(event);if(!token)return;event.preventDefault();event.stopPropagation();open(token)};
  if(grammarHost)renderSentenceGrammar(grammarHost,plain,sentence,analysis,{root,target,lang,explain});
}
function renderSentenceGrammar(host,text,sentence,analysis,{root,target,lang,explain}){
  host.replaceChildren();
  const ids=grammarTags([...(analysis?.grammar||[]),...(sentence?.grammar||[])]),items=grammarListItems(ids,analysis?.spans||[]);
  const heading=document.createElement("h3");heading.className="rule-heading grammar-heading";heading.append(t("Grammar in it"));
  if(items.length){const count=el("span","count",items.length===1?t("1 point"):t("{n} points",{n:items.length}));heading.append(count)}
  // The answered state: an ordered list that reads as an answer (GrammarList).
  if(items.length){host.append(heading,grammarList(items,{onOpen:async item=>{resetSession();await openGrammar(grammarPoint(item.id),grammarCoverage(await listSentences()),{route:false})}}))}
  else if(analysis){host.append(heading,el("p","hint",t("None of the listed grammar points appear in this sentence.")))}
  // The one priced ask, on the sentence page only. When it cannot run it stays
  // visible but disabled, with the reason in place of the price.
  else if(explain&&lang==="ja"&&hasGrammar()){
    const ask=el("button","link-button",t("Explain the grammar"));ask.type="button";ask.dataset.ui="button";
    const reason=!hasTranslator()?t("Add an AI key in Settings and Echo can explain the grammar."):!navigator.onLine?t("You are offline. Echo can explain the grammar once you are back online."):"";
    const status=el("p","hint",reason||t("One request on your AI key. The answer is kept here and shown again on the review answer."));status.setAttribute("aria-live","polite");ask.disabled=!!reason;
    ask.onclick=async()=>{ask.disabled=true;status.textContent=t("Reading the grammar…");
      try{const found=await analyzeSentenceGrammar(text,GRAMMAR_POINTS,{...settings,targetLang:"ja"});grammarAnalysisCache.set(text,found);
        let saved=sentence;
        if(sentence?.id){const fresh=await getSentence(sentence.id);
          if(fresh&&[fresh.target,fresh.casualTarget,fresh.politeTarget].filter(Boolean).map(stripFurigana).includes(text)){
            const previous=(fresh.grammarAnalysis||[]).filter(a=>a.text!==text);
            saved={...fresh,grammarAnalysis:[...previous,found],grammar:grammarTags([...previous.flatMap(a=>a.grammar),...found.grammar]),updatedAt:new Date().toISOString()};
            await saveSentence(saved);if(detail?.id===saved.id)detail=saved;if(current?.id===saved.id)current=saved}}
        if(!root.isConnected)return;
        for(const span of root.querySelectorAll(".review-vocab,.grammar-mark"))span.replaceWith(...span.childNodes);root.normalize();
        enableVocabulary(root,target,lang,saved,{grammarHost:host,explain});
      }catch(error){ask.disabled=false;status.textContent=sheetError(error)}};
    host.append(heading,ask,status)}
  host.hidden=!host.childElementCount;
  updateUnderlineKey(root);
}
// The one-line key under the meaning on the sentence page: grey dotted for a
// word to look up, vermilion dotted for grammar (explained below).
function updateUnderlineKey(root){const key=$("#sentence-key");if(!key||root?.id!=="sentence-japanese")return;
  key.hidden=!root.querySelector(".review-vocab,.grammar-mark");$("#sentence-key-grammar").hidden=!root.querySelector(".grammar-mark")}
let dictionaryLookupGeneration=0;
async function openVocabularyHit(hit,context){
  const choices=(hit.ids||[hit.id]).map(wordById).filter(Boolean),points=(hit.grammarIds||[]).map(grammarPoint).filter(Boolean);
  if(points.length===1&&!choices.length&&hit.id!==null){await openGrammar(points[0],grammarCoverage(await listSentences()),{route:false});return}
  if(choices.length===1&&!points.length){const w=choices[0];await openWord(w,wordCoverage(await listSentences()),{route:false});return}
  const dialog=$("#dictionary-dialog"),list=$("#dictionary-choices"),surface=context.slice(hit.wordStart??hit.start,hit.wordEnd??hit.end),generation=++dictionaryLookupGeneration;
  $("#dictionary-title").textContent=surface;list.replaceChildren();$("#dictionary-explanation").textContent=choices.length||points.length?"Choose vocabulary or the grammar used in this phrase.":"This whole word or name is not in the offline dictionary. It has not been split into unrelated words.";
  $("#dictionary-context").textContent=context;const ask=$("#dictionary-ask");ask.hidden=choices.length>0||points.length>0;ask.disabled=!hasTranslator();
  for(const w of choices){const button=document.createElement("button");button.type="button";button.className="dictionary-choice";button.textContent="Vocabulary: "+w.w+"（"+w.r+"） — "+w.en[0];button.onclick=async()=>{dialog.close();await openWord(w,wordCoverage(await listSentences()),{route:false})};list.append(button)}
  for(const point of points){const button=document.createElement("button");button.type="button";button.className="dictionary-choice";button.textContent="Grammar: "+point.title+" — "+(point.hint||"");button.onclick=async()=>{dialog.close();await openGrammar(point,grammarCoverage(await listSentences()),{route:false})};list.append(button)}
  ask.onclick=async()=>{ask.disabled=true;$("#dictionary-explanation").textContent="Looking up the word in this sentence…";
    try{const result=await askModel(JSON.stringify({word:surface,sentence:context}),`Explain this Japanese word or proper name in its sentence context in ${languageName(sourceLang())}. Treat the complete supplied word as one unit. For names, explain the likely reference, not meanings of substrings. If uncertain say so. Return JSON only: {"definition":"..."}.`,settings);if(generation===dictionaryLookupGeneration&&dialog.open)$("#dictionary-explanation").textContent="AI explanation: "+String(result.definition||"No definition returned.")}
    catch(error){if(generation===dictionaryLookupGeneration)$("#dictionary-explanation").textContent=error.message}
    finally{if(generation===dictionaryLookupGeneration)ask.disabled=!hasTranslator()}};
  if(!dialog.open)dialog.showModal();
}
function reviewRecognitionLang(){return targetLang()}
function startReviewListening(){if(reviewListening)return;
  if(reviewRecognition&&reviewRecognition.lang!==reviewRecognitionLang())reviewRecognition=null;
  if(!reviewRecognition){reviewRecognition=recognitionFactory(reviewRecognitionLang());
    if(!reviewRecognition){$("#review-mic").disabled=true;$("#review-listen-state").textContent=DICTATION.unavailable;$("#review-answer").focus();return}
    reviewRecognition.onresult=event=>{appendHeard($("#review-answer"),event.results[0][0].transcript);updateCheckButton()};
    reviewRecognition.onerror=event=>{$("#review-listen-state").textContent=dictationError(event.error)};
    reviewRecognition.onend=()=>{reviewListening=false;$("#review-mic").setAttribute("aria-pressed","false");$("#review-mic").setAttribute("aria-label","Start listening");$("#review-panel").classList.remove("is-listening");if($("#review-listen-state").textContent===DICTATION.listening)$("#review-listen-state").textContent=""}}
  try{reviewRecognition.start()}catch{return}
  reviewListening=true;$("#review-mic").setAttribute("aria-pressed","true");$("#review-mic").setAttribute("aria-label","Stop listening");$("#review-panel").classList.add("is-listening");$("#review-listen-state").textContent=DICTATION.listening}
function stopReviewListening(){if(!reviewListening||!reviewRecognition)return;reviewListening=false;try{reviewRecognition.stop()}catch{}$("#review-mic").setAttribute("aria-pressed","false");$("#review-panel").classList.remove("is-listening")}
function toggleReviewListening(){reviewListening?stopReviewListening():startReviewListening()}
async function skipReview(){const sentence=reviewQueue[reviewIndex];if(!sentence||reviewBusy)return;reviewBusy=true;updateReviewPrevious();const snapshot=reviewSnapshot(sentence);try{if(sentence){const updated={...sentence,skipped:true,skippedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await saveSentence(updated);reviewUndo.push(snapshot);reviewQueue[reviewIndex]=updated}reviewIndex++;renderReview()}finally{reviewBusy=false;updateReviewPrevious()}}
function playReviewAudio(){const sentence=reviewQueue[reviewIndex];if(!sentence)return;if(loop.running){loop.togglePause();return}const policy=$("#voice").value,voice=policy==="random"?voices[Math.floor(Math.random()*voices.length)]:(policy==="default"?voices.find(v=>v.default)||voices[0]:voices[Number(policy)])||null;loop.play(reviewJapanese(sentence),{voice,rate:Number($("#rate").value),lang:targetLang()})}
// One grade per card. The save is awaited before the queue moves on, so a
// second tap (or a held 2 key) during it would otherwise grade the same card
// twice: two review entries and an interval pushed out twice.
let reviewBusy=false,reviewUndo=[];
function updateReviewPrevious(){$("#review-previous").disabled=reviewBusy||!reviewUndo.length}
function reviewSnapshot(sentence){return {index:reviewIndex,sentence:structuredClone(sentence),answer:$("#review-answer").value,revealed:reviewRevealed,echoes:echoesAtCardStart}}
async function previousReview(){
  if(reviewBusy||!reviewUndo.length)return;
  reviewBusy=true;updateReviewPrevious();resetSession();stopReviewListening();
  const entry=reviewUndo.at(-1);
  try{
    const latest=await getSentence(entry.sentence.id);
    if(!latest)throw new Error("This sentence is no longer in your library.");
    const restored={...latest,updatedAt:new Date().toISOString()};
    for(const key of ["srs","reviews","reviewTrack","lastRating","skipped","skippedAt"]){if(Object.hasOwn(entry.sentence,key))restored[key]=structuredClone(entry.sentence[key]);else delete restored[key]}
    await saveSentence(restored);
    reviewUndo.pop();reviewIndex=entry.index;reviewQueue[reviewIndex]=restored;
    if(current?.id===restored.id)current=restored;
    if(detail?.id===restored.id)detail=restored;
    renderReview();$("#review-answer").value=entry.answer;echoesAtCardStart=entry.echoes;updateCheckButton();
    if(entry.revealed)await revealReview();
    refreshDueBadge();toast("Previous review restored. Choose Again or OK.");
  }catch(error){toast(error.message||"Could not undo the review. Try again.")}
  finally{reviewBusy=false;updateReviewPrevious()}
}
async function rateReview(rating){const sentence=reviewQueue[reviewIndex];if(!sentence||!reviewRevealed||reviewBusy)return;reviewBusy=true;updateReviewPrevious();const snapshot=reviewSnapshot(sentence);try{resetSession();const now=new Date(),mode=reviewMode(sentence),graded=reviewSentence(sentence,rating,now),progressed=recordReviewMode(graded,rating,now);
  const updated={...progressed,reviews:[...(Array.isArray(sentence.reviews)?sentence.reviews:[]),{at:now.toISOString(),rating,mode,echoes:Math.max(0,(Number(sentence.echoCount)||0)-echoesAtCardStart)}]};await saveSentence(updated);reviewUndo.push(snapshot);if(current?.id===updated.id)current=updated;reviewQueue[reviewIndex]=updated;reviewIndex++;renderReview()}finally{reviewBusy=false;updateReviewPrevious()}}
// The one backup document: the file Export downloads is byte-for-byte what the gist holds.
async function buildBackup(){return {...exportBackup(await listSentences(),settings,forBackup(await listNotes().catch(()=>[]))),catalogues:importedCatalogues}}
async function exportHistory(){const data=await buildBackup(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),link=Object.assign(document.createElement("a"),{href:url,download:"jp-echo-backup.json"});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$("#import-status").textContent="Backup saved as jp-echo-backup.json."}
async function exportAnki(button=$("#export-anki")){const items=await listSentences();const label=button.textContent;button.disabled=true;button.textContent="Building deck…";$("#anki-status").textContent="Creating Echo.apkg on this device…";try{await downloadAnkiDeck(items.map(forAnki));$("#open-anki").hidden=false;const launched=openAnki(true);$("#anki-status").textContent=launched?"Echo.apkg downloaded. Opening Anki… If it stays here, tap Open Anki.":"Echo.apkg downloaded. Open it from Downloads to import it into Anki."}catch(error){$("#anki-status").textContent=error.message||"Anki export failed."}finally{button.disabled=false;button.textContent=label}}
function openAnki(automatic=false){const android=/android/i.test(navigator.userAgent),ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if(android){window.location.href="intent:#Intent;package=com.ichi2.anki;end";return true}if(ios){window.location.href="anki://";return true}if(!automatic)$("#anki-status").textContent="Open Echo.apkg from your Downloads folder to import it into Anki.";return false}
// Cards filed while the pair was reversed. Only run when the pair itself was
// found reversed at startup: that is the evidence the device was sitting in
// the broken state, and without it a card whose pair is the exact reverse of
// today's is indistinguishable from someone who simply changed what they are
// learning — flipping that would be the same bug pointed the other way.
async function repairReversedCards(){
  const items=await listSentences();
  // basePair was seeded on first load of the build that added it, which is
  // after the swap button had already shipped — so a device swapped before
  // that recorded its reversed pair as the baseline and the check above sees
  // nothing wrong. The oldest card predates all of it.
  let repaired=pairWasRepaired;
  if(!repaired&&!settings.directionChecked){
    const chosen=earliestPair(items);
    if(pairLooksSwapped(settings,chosen)){
      setPair(chosen.sourceLang,chosen.targetLang);
      repaired=true;
      toast("Put you back to learning "+languageName(chosen.targetLang)+" from "+languageName(chosen.sourceLang),6000);
    }
  }
  if(!settings.directionChecked){settings.directionChecked=true;storePreference("jp-echo-settings",JSON.stringify(settings))}
  if(!repaired)return;
  const pair={sourceLang:sourceLang(),targetLang:targetLang()};
  const broken=items.filter(item=>isReversed(item,pair));
  if(!broken.length)return;
  await Promise.all(broken.map(item=>saveSentence(flipSentence(item))));
  renderHistory();refreshDueBadge();
  toast(broken.length===1?"Put 1 sentence the right way round":"Put "+broken.length+" sentences the right way round",6000);
}
async function importBackupData(backup){
 backup=validateDeckBackup(backup);
 await startupCleanup;
 if(backup.title==="Mini Hongo starter library"&&![2,3].includes(backup.starterVersion))throw new Error("This is the old oversized Minihongo starter. Use the compact starter from Settings instead.");
 if(!(Number(backup.schemaVersion)>=1&&Number(backup.schemaVersion)<=SCHEMA_VERSION)||!Array.isArray(backup.sentences))throw new Error("Unsupported backup.");
 const before=await listSentences(),upgrade=planMiniSentenceUpgrade(before,backup),merged=upgrade.sentences,catalogues=mergeCatalogues(importedCatalogues,backup.catalogues);
 if(upgrade.removed.length)await saveImportRecovery({schemaVersion:2,sentences:upgrade.removed,catalogues:importedCatalogues,kind:'Minihongo word cards replaced with sentences'},'minihongo-v2-word-cards');
 saveCatalogues(catalogues);try{await replaceAll(merged)}catch(error){saveCatalogues(importedCatalogues);throw error}markBackupDirty();importedCatalogues=catalogues;applyCatalogues();scheduleReadingBackfill();
 if(Array.isArray(backup.notes))await replaceNotes(mergeNotes(await listNotes().catch(()=>[]),backup.notes));
 const added=merged.length-before.length+upgrade.removed.length,message=`Added ${added} sentence(s). ${backup.sentences.length-added} already present; existing progress kept.${upgrade.removed.length?` Replaced ${upgrade.removed.length} Minihongo word cards with sentences.`:""}`;
 setStatus(message);refreshDueBadge();await renderHistory();return {added,total:merged.length};
}
// Import — a deck or a backup, from a file or a URL — is one merge. Messages go
// to whichever screen started it: Settings, or the empty Library.
let importStatus=null;
const importStatusNode=()=>importStatus||$("#import-status");
async function importHistory(file){if(!file)return;const status=importStatusNode();status.classList?.remove("error");
  let data;try{data=JSON.parse(await file.text())}catch{status.textContent="That file is not valid JSON. See DECK-FORMAT.md for the deck format.";return}
  try{const {added,total}=await importBackupData(data);status.textContent=added?`Imported ${added} sentence${added===1?"":"s"}. ${total.toLocaleString()} in your library.`:"Everything in that file is already in your library."}
  catch(error){status.textContent=error.message||"Import failed.";setStatus(error.message||"Import failed.",true)}
  finally{importStatus=null}}
async function importDeckURL(url,button,status=$("#import-status")){
  if(!String(url||"").trim()){status.textContent="Paste the deck's URL first.";$("#deck-json-url").focus();return}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);button.disabled=true;status.textContent="Downloading the deck…";
  try{const {added,total}=await importBackupData(await fetchDeckBackup(url,{signal:controller.signal}));status.textContent=added?`Imported ${added} sentence${added===1?"":"s"}. ${total.toLocaleString()} in your library.`:"Everything in that deck is already in your library.";$("#deck-json-url").value=""}
  catch(error){status.textContent=error.message}
  finally{clearTimeout(timer);button.disabled=false}}
async function cleanupLegacyMiniHongo(){
 const marker='jp-echo-minihongo-cleanup-v2';
 if(localStorage.getItem(marker)!=='done'){
  const plan=await repairMiniImport(await listSentences(),importedCatalogues,{archive:saveImportRecovery,replace:(kept,removed)=>removeArchivedMiniCards(kept,removed,importedCatalogues),saveCatalogues});
  if(plan.changed){importedCatalogues=plan.catalogues;applyCatalogues();storePreference('jp-echo-minihongo-cleanup-message',`Removed ${plan.removed.length} old Minihongo cards. Kept ${plan.kept.length} existing sentences.`)}
  storePreference(marker,'done');
 }
 $('#mini-cleanup-status').textContent=localStorage.getItem('jp-echo-minihongo-cleanup-message')||'';
 $('#undo-mini-cleanup').hidden=!(await readImportRecovery());
 await refreshDueBadge();
}
async function undoMiniCleanup(){const button=$('#undo-mini-cleanup');button.disabled=true;try{const backup=await readImportRecovery();if(!backup)throw new Error('No cleanup backup is available.');await importBackupData(backup);$('#mini-cleanup-status').textContent='Restored the removed Minihongo cards from the recovery copy.'}catch(error){$('#mini-cleanup-status').textContent=error.message}finally{button.disabled=false}}
// Automatic backup to a secret GitHub gist (see gist-backup.js). The token,
// gist URL and the on/off switch are settings (stripped from every backup);
// the bookkeeping — dirty, last attempt, last success, last error — is its
// own key, so Settings' Save/Cancel never rolls it back.
const GIST_STATE_KEY="jp-echo-gist-state";
function gistState(){try{const value=JSON.parse(localStorage.getItem(GIST_STATE_KEY)||"{}");return value&&typeof value==="object"?value:{}}catch{return {}}}
function patchGistState(patch){const next={...gistState(),...patch};storePreference(GIST_STATE_KEY,JSON.stringify(next));return next}
let gistTimer=null,gistRunning=null,gistWarned=false;
function scheduleGistBackup(delay){clearTimeout(gistTimer);gistTimer=setTimeout(()=>maybeAutoBackup("change").catch(()=>{}),Math.max(1000,delay))}
function markBackupDirty(){if(!settings.gistAuto)return;patchGistState({dirty:true,lastChangeAt:Date.now()});scheduleGistBackup(QUIET_MS+500)}
async function maybeAutoBackup(reason){
  const state=gistState(),now=Date.now(),ready=!!settings.gistAuto&&!!settings.gistToken&&!!state.dirty;
  if(!shouldAutoBackup({enabled:!!settings.gistAuto,hasToken:!!settings.gistToken,dirty:!!state.dirty,lastAttemptAt:state.lastAttemptAt,lastChangeAt:state.lastChangeAt,now,reason})){
    // Too soon after the last upload: come back when the interval allows.
    if(ready&&reason!=="hidden")scheduleGistBackup(Math.max((Number(state.lastAttemptAt)||0)+MIN_INTERVAL_MS,(Number(state.lastChangeAt)||0)+QUIET_MS)-now+500);
    return null}
  return runGistBackup({auto:true})}
async function runGistBackup({auto=false,token=settings.gistToken,gist=settings.gistUrl}={}){
  if(gistRunning)return gistRunning;
  // A URL that does not parse must not silently become "create a new gist".
  if(String(gist||"").trim()&&!parseGistId(gist))throw new Error("That gist URL is not one Echo recognises. Paste the gist's page URL, or leave it blank.");
  const startedAt=Date.now();patchGistState({lastAttemptAt:startedAt});
  gistRunning=(async()=>{
    try{const result=await uploadBackup({token,gist,backup:await buildBackup()});
      const state=patchGistState({dirty:(Number(gistState().lastChangeAt)||0)>startedAt,lastSuccessAt:Date.now(),lastError:"",url:result.url});
      if(settings.gistUrl!==result.url||settings.gistToken!==token){settings.gistUrl=result.url;settings.gistToken=token;storePreference("jp-echo-settings",JSON.stringify(settings));if(document.body.dataset.view==="settings")$("#gist-url").value=result.url;renderSettingsRows()}
      if(state.dirty)scheduleGistBackup(MIN_INTERVAL_MS+500);
      return result}
    catch(error){patchGistState({lastError:error.message||String(error)});
      if(auto&&!gistWarned){gistWarned=true;toast("Gist backup failed: "+(error.message||error),6000)}
      throw error}
    finally{gistRunning=null;renderGistStatus()}})();
  return gistRunning}
const gistWhen=value=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
function renderGistStatus(){
  const node=$("#gist-status");if(!node)return;const state=gistState();node.replaceChildren();node.classList.remove("error");
  if(state.lastError){node.classList.add("error");node.textContent="Last backup failed: "+state.lastError;return}
  if(state.lastSuccessAt){node.append("Backed up "+gistWhen(state.lastSuccessAt)+". ");
    if(state.url&&parseGistId(state.url)){const link=document.createElement("a");link.href=state.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open the gist";node.append(link)}
    if(settings.gistAuto&&state.dirty)node.append(" Newer changes are waiting.");return}
  node.textContent=settings.gistAuto?(settings.gistToken?"Nothing backed up yet — the first backup runs shortly.":"Add a token to start backing up."):"";
}
async function gistBackupNow(){
  const button=$("#gist-now"),token=$("#gist-token").value.trim(),gist=$("#gist-url").value.trim();
  if(!token){$("#gist-status").textContent="Add a GitHub token first.";$("#gist-token").focus();return}
  button.disabled=true;$("#gist-status").textContent="Uploading…";
  try{const result=await runGistBackup({token,gist});$("#gist-status").textContent=(result.created?"Created a secret gist with ":"Updated the gist with ")+result.sentences+(result.sentences===1?" sentence.":" sentences.");setTimeout(renderGistStatus,4000)}
  catch(error){$("#gist-status").classList.add("error");$("#gist-status").textContent=error.message}
  finally{button.disabled=false}}
async function gistRestore(){
  const button=$("#gist-restore"),gist=$("#gist-url").value.trim(),token=$("#gist-token").value.trim();
  if(!parseGistId(gist)){$("#gist-status").textContent="Paste the gist's URL to restore from it.";$("#gist-url").focus();return}
  button.disabled=true;$("#gist-status").classList.remove("error");$("#gist-status").textContent="Downloading the backup…";
  try{const {backup,url}=await downloadBackup({gist,token});const {added}=await importBackupData(backup);
    // Continue backing up to the gist this device was restored from.
    if(url&&!settings.gistUrl){settings.gistUrl=url;storePreference("jp-echo-settings",JSON.stringify(settings));$("#gist-url").value=url}
    $("#gist-status").textContent=added?`Restored ${added} sentence${added===1?"":"s"} from the gist. Everything already here was kept.`:"Everything in that gist is already on this device."}
  catch(error){$("#gist-status").classList.add("error");$("#gist-status").textContent=error.message}
  finally{button.disabled=false}}
// "Or practise another way": each row goes once the learner has actually used
// that mode (started a discussion, generated a reading). Discoverability lives
// in the empty states; the mode switch itself stays quiet.
const MODES_USED_KEY="jp-echo-modes-used";
function modesUsed(){try{return JSON.parse(localStorage.getItem(MODES_USED_KEY)||"{}")||{}}catch{return {}}}
function markModeUsed(mode){if(modesUsed()[mode])return;storePreference(MODES_USED_KEY,JSON.stringify({...modesUsed(),[mode]:true}));renderWelcomeModes()}
function renderWelcomeModes(){const used=modesUsed();$("#welcome-discussion").hidden=!!used.discussion;$("#welcome-reading").hidden=!!used.reading;$("#welcome-modes").hidden=!!(used.discussion&&used.reading)}
// "Your sentences with it  2": the count sits at the end of the rule heading.
function sheetCount(head,n){let count=head.querySelector(".count");if(!count){count=el("span","count","");head.append(count)}count.textContent=String(n);head.classList.add("counted")}
// Echo has one built-in deck, the ミニ本語 Minihongo starter, offered only to seed an
// empty or young library. Everything else in a library is the learner's own.
const MINI_DECK_URL="https://raw.githubusercontent.com/KakkoiDev/minihongo/master/imports/jp-echo.json";
// The starter import, shared by Settings, the empty Library and onboarding:
// download, then the usual merge (duplicates skipped). Resolves {added,total}.
async function addStarter(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{return await importBackupData(await fetchDeckBackup(MINI_DECK_URL,{signal:controller.signal}))}finally{clearTimeout(timer)}}
async function seedStarter(button,status=$("#import-status")){
 const label=button.textContent;button.disabled=true;button.textContent="Adding…";status.textContent="Downloading the ミニ本語 Minihongo starter…";
 try{const {added}=await addStarter();status.textContent=added?`Added ${added} starter sentences. They are yours now — practise, edit or delete any of them.`:"The starter sentences are already in your library."}
 catch(error){status.textContent=error.message;button.disabled=false;button.textContent=label}
 finally{renderStarterOffer(await listSentences())}
}
// Onboarding step 2: the starter, unticked, for a Japanese target only and
// only when it is not already in the library.
let starterSeeded=false;
function renderSetupStarter(all){if(all)starterSeeded=isSeeded(all);const show=$("#setup-target")?.value==="ja"&&!starterSeeded;$("#setup-starter").hidden=!show;if(!show)$("#setup-starter-add").checked=false}
function renderStarterOffer(all){
 const ja=targetLang()==="ja",seeded=isSeeded(all);renderSetupStarter(all);
 $("#starter-row").hidden=!ja;$("#starter-link").hidden=!ja;
 const add=$("#import-minihongo");add.disabled=seeded;add.textContent=seeded?"Added":"Add";
 for(const id of ["#empty-starter","#empty-starter-copy"])$(id).hidden=!ja||seeded;
}


$("#tabs").addEventListener("click",event=>{const tab=event.target.closest(".tab[data-view]");if(tab)showView(tab.dataset.view)});$("#translate").onclick=()=>discussionMode?(discussionTurns.length?replyDiscussion():beginDiscussion()):readingMode?generateReadingMode():performTranslation();$("#english-input").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")(discussionMode?(discussionTurns.length?replyDiscussion():beginDiscussion()):readingMode?generateReadingMode():performTranslation)()};$("#play-pause").onclick=()=>{if(!current)return;if(loop.running){loop.togglePause();return}const policy=$("#voice").value,voice=policy==="random"?voices[Math.floor(Math.random()*voices.length)]:(policy==="default"?voices.find(v=>v.default)||voices[0]:voices[Number(policy)])||null;loop.play(selectedJapanese(),{voice,rate:Number($("#rate").value),lang:targetLang()})};$("#show-english").onchange=()=>{saveSettings();renderSentence()};$("#show-furigana").onchange=()=>{saveSettings();renderSentence()};$("#show-polite").onchange=async()=>{resetSession();saveSettings();if(current&&hasRegisters(itemTarget(current))){current={...current,reviewRegister:$("#show-polite").checked?"polite":"casual",updatedAt:new Date().toISOString()};await saveSentence(current);if(detail?.id===current.id)detail=current}renderSentence()};$("#rate").oninput=()=>{const rate=Number($("#rate").value);$("#rate-value").textContent=rate.toFixed(1)+"×";resetSession();loop.setRate(rate)};// Each preference commits on "change" (never on blur), and everything the
// old Save also did — notices, reminder schedule — follows the write.
function commitPreferences(){if(saveSettings()){renderPracticeNotices();writeReminderPrefs();syncReminderSchedule()}else flashSaved("Not saved — this browser blocked storage")}
for(const id of ["theme","motion","voice","discussion-voice-ai","discussion-voice-user","rate","autotag","remind-time","gist-auto","gist-url"])$("#"+id).addEventListener("change",commitPreferences);
$("#remind").onchange=async()=>{const wanted=$("#remind").checked;
  if(wanted&&!await enableReminders()){$("#remind").checked=false;$("#remind-hint").textContent="Notifications are blocked for Echo. Allow them in your browser settings, then turn this on again.";$("#remind-hint").classList.add("error");$("#remind-reach").textContent="";return}
  $("#remind-hint").textContent="Your device asks permission the first time you turn this on.";$("#remind-hint").classList.remove("error");
  settings.remind=wanted;$("#remind-reach").textContent=wanted?reminderReach():""};$("#export-anki").onclick=()=>exportAnki($("#export-anki"));$("#open-anki").onclick=()=>openAnki();$("#export").onclick=exportHistory;$("#import").onclick=()=>$("#import-file").click();$("#import-file").onchange=async event=>{await importHistory(event.target.files[0]);event.target.value=""};
$("#voice-install").onclick=installTargetVoice;$("#voice-manage").onclick=installTargetVoice;$("#settings-swap-langs").onclick=()=>setPair(targetLang(),sourceLang());window.addEventListener("focus",()=>setTimeout(populateVoices,250));document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(populateVoices,250)});$("#onboard-start").onclick=()=>showView("setup");$("#onboard-restore").onclick=()=>{finishOnboarding();showView("library");importStatus=$("#empty-starter-status");$("#import-file").click()};
$("#setup-next").onclick=()=>{storeTranslator();showSetupStep(2)};
$("#setup-back").onclick=()=>{if(setupStep===2)return showSetupStep(1);showView(settings.onboarded?"practice":"onboard")};$("#setup-provider").onchange=showSetupFields;$("#setup-save").onclick=saveSetup;$("#setup-skip").onclick=finishOnboarding;
$("#clear-filters").onclick=()=>{$("#history-search").value="";$("#clear-history-search").hidden=true;$("#history-filter").value="all";settings.historyFilter="all";try{storePreference("jp-echo-settings",JSON.stringify(settings))}catch{}renderHistory()};
addEventListener("online",renderPracticeNotices);addEventListener("offline",renderPracticeNotices);
// A sheet closes the way it looks like it should: drag the handle down far
// enough and let go, or tap the dimmed page behind it. A short drag springs
// back. Pointer events, so a mouse can do it too.
function sheetDrag(dialog,close){
  const handle=dialog.querySelector(".sheet-handle");if(!handle)return;
  let startY=null,dy=0;
  handle.addEventListener("pointerdown",event=>{startY=event.clientY;dy=0;handle.setPointerCapture(event.pointerId);dialog.classList.add("is-dragging")});
  handle.addEventListener("pointermove",event=>{if(startY===null)return;dy=Math.max(0,event.clientY-startY);dialog.style.transform=dy?`translateY(${dy}px)`:""});
  const end=event=>{if(startY===null)return;const far=dy>90||(dy>40&&event.type==="pointerup"&&(event.timeStamp-downAt)<250);startY=null;dialog.classList.remove("is-dragging");
    if(far){dialog.style.transform="";close()}else dialog.style.transform=""};
  let downAt=0;handle.addEventListener("pointerdown",event=>{downAt=event.timeStamp});
  handle.addEventListener("pointerup",end);handle.addEventListener("pointercancel",end);
  dialog.addEventListener("click",event=>{if(event.target===dialog)close()});
}
sheetDrag($("#kanji-dialog"),()=>{loop.stop();$("#kanji-dialog").close()});sheetDrag($("#grammar-dialog"),()=>{loop.stop();$("#grammar-dialog").close()});sheetDrag($("#word-dialog"),()=>{loop.stop();$("#word-dialog").close()});
$("#word-close").onclick=()=>{loop.stop();$("#word-dialog").close()};$("#word-dialog").addEventListener("close",()=>{loop.stop();kanjiPlaying=null;wordOpen=null;saveWorkspace({modal:null})});$("#word-compose").onclick=composeForWord;$("#word-say-go").onclick=sayForWord;$("#word-say").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")sayForWord()};$("#word-note-ask").onclick=askWordNote;$("#word-prev").onclick=()=>wordStep(-1);$("#word-next").onclick=()=>wordStep(1);$("#word-dialog").addEventListener("keydown",event=>{if(!wordOpen?.learn||event.target.tagName==="TEXTAREA"||event.target.isContentEditable)return;if(event.key==="ArrowRight")wordStep(1);else if(event.key==="ArrowLeft")wordStep(-1)});
$("#mora-open").onclick=()=>showView("mora");$("#mora-back").onclick=()=>showView("library");for(const id of ["#mora-show-emoji","#mora-show-furigana","#mora-show-english"])$(id).onchange=saveMoraDisplay;
$("#kanji-close").onclick=()=>{loop.stop();$("#kanji-dialog").close()};$("#kanji-dialog").addEventListener("close",()=>{loop.stop();kanjiPlaying=null;kanjiOpen=null;saveWorkspace({modal:null})});$("#kanji-compose").onclick=composeForKanji;$("#kanji-say-go").onclick=sayForKanji;$("#library-tool").onclick=()=>showView("map");$("#map-back").onclick=()=>showView("library");for(const button of document.querySelectorAll("#map-toggle [role=tab]"))button.onclick=()=>{settings.mapView=button.dataset.map;storePreference("jp-echo-settings",JSON.stringify(settings));saveWorkspace({mapView:settings.mapView});tool.open=null;tool.chip="all";renderMap()};$("#map-toggle").addEventListener("keydown",event=>{if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;const tabs=[...document.querySelectorAll("#map-toggle [role=tab]")].filter(b=>!b.hidden),at=tabs.findIndex(b=>b.getAttribute("aria-selected")==="true"),next=tabs[(at+(event.key==="ArrowRight"?1:tabs.length-1))%tabs.length];if(next){next.click();next.focus()}});let lookupTimer=0;$("#map-search").oninput=()=>{saveWorkspace();syncRoute({},true);clearTimeout(lookupTimer);lookupTimer=setTimeout(renderMap,150)};$("#map-search").onkeydown=event=>{if(event.key==="Escape"&&$("#map-search").value){$("#map-search").value="";renderMap()}};$("#map-search-clear").onclick=()=>{$("#map-search").value="";$("#map-search").focus();renderMap()};$("#grammar-prev").onclick=()=>grammarStep(-1);$("#grammar-next").onclick=()=>grammarStep(1);$("#grammar-close").onclick=()=>{loop.stop();$("#grammar-dialog").close()};$("#grammar-dialog").addEventListener("close",()=>{loop.stop();kanjiPlaying=null;grammarOpen=null;saveWorkspace({modal:null})});$("#grammar-say-go").onclick=sayForGrammar;$("#grammar-say").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")sayForGrammar()};$("#grammar-compose").onclick=composeForGrammar;$("#kanji-prev").onclick=()=>learnStep(-1);$("#kanji-next").onclick=()=>learnStep(1);$("#kanji-dialog").addEventListener("keydown",event=>{if(!kanjiOpen?.learn||event.target.tagName==="TEXTAREA")return;if(event.key==="ArrowRight")learnStep(1);else if(event.key==="ArrowLeft")learnStep(-1)});$("#kanji-say").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")sayForKanji()};$("#sentence-back").onclick=()=>{detail=null;showView("library")};$("#sentence-play").onclick=playDetail;// Editing lives in the collapsed "Change this sentence" row (no pencil button).
// Opening fills the editor; closing it cancels an in-flight rewrite.
$("#sentence-change").ontoggle=()=>{if($("#sentence-change").open){if(editorOpenId!==detail?.id)openEditor()}else{editorOpenId=null;editorGeneration++}};$("#sentence-cancel").onclick=closeEditor;$("#sentence-editor").onsubmit=saveEdit;
$("#sentence-delete").onclick=()=>askDelete();$("#delete-cancel").onclick=()=>$("#delete-dialog").close();$("#delete-confirm").onclick=confirmDelete;$("#delete-dialog").onclick=event=>{if(event.target===$("#delete-dialog"))$("#delete-dialog").close()};
$("#side-start-review").onclick=startReview;$("#side-export-anki").onclick=()=>exportAnki($("#side-export-anki"));
wide.addEventListener("change",()=>showView(document.body.dataset.view||"practice"));
// Learn mode in a sheet: ← and → step through the band, like the footer's
// Previous / Next. Typing stays typing.
addEventListener("keydown",event=>{
  if((event.key!=="ArrowLeft"&&event.key!=="ArrowRight")||event.metaKey||event.ctrlKey||event.altKey)return;
  if(event.target.closest?.("input,textarea,select,[contenteditable]"))return;
  const sheet=document.querySelector("dialog.tool-sheet[open]"),nav=sheet?.querySelector(".sheet-footer");if(!nav||nav.hidden)return;
  const step=nav.querySelector(event.key==="ArrowLeft"?".nav-prev":".nav-next");if(step&&!step.disabled){event.preventDefault();step.click()}});
// Desktop keys, as the sidebar legend promises. Typing must stay typing, so
// only Escape is honoured while the answer box has focus.
addEventListener("keydown",event=>{
  if(document.body.dataset.view!=="session"||event.metaKey||event.ctrlKey||event.altKey)return;
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
  if(event.key==="Escape"){event.preventDefault();stopReviewListening();return showView("review")}
  if(typing||document.querySelector("dialog[open]"))return;
  if(event.key===" "){event.preventDefault();return reviewRevealed?playReviewAudio():revealReview()}
  if(!reviewRevealed)return;
  if(event.key==="1"){event.preventDefault();rateReview("again")}
  else if(event.key==="2"){event.preventDefault();rateReview("ok")}
});
$("#start-review").onclick=startReview;$("#review-practice").onclick=()=>showView("practice");$("#review-back").onclick=()=>{stopReviewListening();showView("review")};$("#review-done").onclick=()=>showView("practice");$("#review-home-link").onclick=()=>showView("review");$("#review-previous").onclick=previousReview;$("#review-check").onclick=revealReview;$("#review-skip").onclick=skipReview;$("#review-mic").onclick=toggleReviewListening;$("#review-answer").oninput=updateCheckButton;$("#review-front-audio").onclick=playReviewAudio;$("#review-audio").onclick=playReviewAudio;$("#review-again").onclick=()=>rateReview("again");$("#review-ok").onclick=()=>rateReview("ok");
$("#settings-button").onclick=()=>openSettings();$("#settings-nav").onclick=()=>openSettings();$("#settings-back").onclick=leaveSettings;$("#install-app").onclick=installApp;
for(const row of document.querySelectorAll(".settings-row[data-settings-page]"))row.onclick=()=>showSettingsPage(row.dataset.settingsPage);
$("#ai-save").onclick=saveAIService;$("#ai-check").onclick=checkAIService;$("#ai-remove").onclick=removeAIKey;$("#speech-save").onclick=saveSpeech;
$("#ai-show-key").onclick=()=>{const button=$("#ai-show-key"),show=button.getAttribute("aria-pressed")!=="true";button.setAttribute("aria-pressed",String(show));button.textContent=show?"Hide the key":"Show the key";for(const input of document.querySelectorAll("#settings-ai input[id$='-key']"))input.type=show?"text":"password"};$("#voice").onchange=resetSession;$("#discussion-voice-ai").onchange=()=>discussionLoop.stop();$("#discussion-voice-user").onchange=()=>discussionLoop.stop();$("#provider").onchange=showProviderConfig;$("#source-lang").onchange=()=>setPair($("#source-lang").value,targetLang());
$("#target-lang").onchange=()=>setPair(sourceLang(),$("#target-lang").value);
$("#setup-source").onchange=()=>setPair($("#setup-source").value,targetLang());
$("#setup-target").onchange=()=>{setPair(sourceLang(),$("#setup-target").value);renderSetupStarter()};
$("#swap-langs").onclick=()=>{setInputLang(enteringTarget()?sourceLang():targetLang());toast("Typing in "+languageName(inputLang))};for(const swap of document.querySelectorAll("[data-input-swap]"))swap.onclick=()=>{setInputLang(enteringTarget()?sourceLang():targetLang());toast("Typing in "+languageName(inputLang));const field=$("#"+swap.dataset.inputSwap);if(field)field.focus()};
$("#theme").onchange=()=>applyTheme($("#theme").value);$("#motion").onchange=()=>applyMotion($("#motion").value);window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;updateInstallUI()});window.addEventListener("appinstalled",()=>{installPrompt=null;updateInstallUI()});
$("#history-search").oninput=()=>{$("#clear-history-search").hidden=!$("#history-search").value;saveWorkspace();syncRoute({},true);renderHistory()};$("#clear-history-search").onclick=()=>{$("#history-search").value="";$("#clear-history-search").hidden=true;$("#history-search").focus();renderHistory()};for(const id of ["#history-filter","#history-order","#history-direction"]){$(id).onchange=()=>{settings.historyFilter=$("#history-filter").value;settings.historyOrder=$("#history-order").value;settings.historyDirection=$("#history-direction").value;try{storePreference("jp-echo-settings",JSON.stringify(settings))}catch{}syncRoute({},true);renderHistory()}}
const legacyOrders={newest:["created","desc"],oldest:["created","asc"],echoes:["echoes","desc"],due:["due","asc"]},legacy=legacyOrders[settings.historyOrder];if(legacy){settings.historyOrder=legacy[0];settings.historyDirection=settings.historyDirection||legacy[1]}resetSettingsForm();applyTheme();applyMotion();$("#mora-show-emoji").checked=settings.moraEmoji??true;$("#mora-show-furigana").checked=settings.moraFurigana??true;$("#mora-show-english").checked=settings.moraEnglish??false;syncLanguageSelects();applyLanguageUI();$("#show-english").checked=settings.showEnglish??false;$("#show-furigana").checked=settings.showFurigana??true;$("#show-polite").checked=settings.showPolite??false;$("#history-filter").value=settings.historyFilter||"all";$("#history-order").value=settings.historyOrder||"created";$("#history-direction").value=settings.historyDirection||"desc";speechSynthesis.onvoiceschanged=populateVoices;populateVoices();renderVoiceHelp();
// Android fills the voice list after the page has settled and does not always
// fire voiceschanged, so the select is rebuilt a few times before giving up.
for(const delay of [400,1200,3000])setTimeout(populateVoices,delay);
async function applyRoute(route=parseRoute(location.href)){
  applyingRoute=true;
  try{
    if(route.notFound){history.replaceState({echo:true},"","/");route=parseRoute("/")}
    if(!settings.onboarded&&!hasTranslator()&&route.view!=="setup"&&route.view!=="onboard")route={view:"onboard"};
    if(route.historyQuery!=null){$("#history-search").value=route.historyQuery;$("#clear-history-search").hidden=!route.historyQuery}
    if(route.historyFilter)$("#history-filter").value=route.historyFilter;if(route.historyOrder)$("#history-order").value=route.historyOrder;if(route.historyDirection)$("#history-direction").value=route.historyDirection;
    if(route.mapQuery!=null)$("#map-search").value=route.mapQuery;if(route.mapView)settings.mapView=route.mapView;
    if(route.sentenceId){const sentence=await getSentence(route.sentenceId);if(sentence){detail=ensureSchedule(sentence);showView("sentence",{route:false});renderDetail()}else showView("library",{route:false})}
    else if(route.view==="settings")openSettings(route.settingsPage,{route:false});
    else {showView(route.view||"practice",{route:false});if((route.view||"practice")==="practice")setPracticeMode(route.readingMode?"reading":route.discussionMode?"discussion":"sentence",{route:false})}
    if(route.modal){const sentences=await listSentences();if(route.modal.kind==="word"){const w=wordById(route.modal.id);if(w)await openWord(w,wordCoverage(sentences),{route:false})}else if(route.modal.kind==="kanji")await openKanji(route.modal.id,kanjiCoverage(sentences),{route:false});else if(route.modal.kind==="grammar"){const p=grammarPoint(route.modal.id);if(p)await openGrammar(p,grammarCoverage(sentences),{route:false})}}
  }finally{applyingRoute=false}
}
async function restoreRoute(){
  // One upgrade bridge only: old root URLs had no navigation information.
  if(location.pathname==="/"&&!location.search){const legacy=workspace();if(legacy.view&&legacy.view!=="practice"||legacy.discussionMode||legacy.modal||legacy.historyQuery||legacy.mapQuery){history.replaceState({echo:true},"",routeFor({...legacy,historyFilter:settings.historyFilter,historyOrder:settings.historyOrder,historyDirection:settings.historyDirection}));try{localStorage.removeItem(WORKSPACE_KEY)}catch{}}}
  await applyRoute();window.echoRouteReady=true;
}
window.addEventListener("popstate",()=>applyRoute());
applyLanguage();startupCleanup=migrateStore().then(()=>cleanupLegacyMiniHongo());startupCleanup.then(async()=>{await repairReversedCards();await restoreRoute();maybeAutoBackup("open").catch(()=>{});scheduleReadingBackfill()}).catch(error=>{window.echoReportError?.(error);setStatus('Minihongo cleanup could not finish: '+error.message,true);restoreRoute().catch(error=>window.echoReportError?.(error))});refreshDueBadge();setupRecognition();updateInstallUI();
// The in-app WaniKani sync is gone (the pull tool feeds the stories instead);
// what it left in a browser is cleared once, quietly.
try{localStorage.removeItem("jp-echo-wanikani-token");indexedDB.deleteDatabase("jp-echo-wanikani")}catch{}
if("serviceWorker"in navigator){writeReminderPrefs();syncReminderSchedule();remindOnOpen()}

$("#sentence-rewrite").onclick=rewriteDetailSentence;
for(const id of ["#sentence-draft","#sentence-source-draft"])$(id).oninput=()=>fitTextArea($(id));
$("#sentence-instruction").onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();rewriteDetailSentence()}};

$("#dictionary-close").onclick=()=>$("#dictionary-dialog").close();
$("#dictionary-dialog").addEventListener("close",()=>dictionaryLookupGeneration++);




$('#undo-mini-cleanup').onclick=undoMiniCleanup;
$("#welcome-discussion").onclick=()=>setPracticeMode("discussion");$("#welcome-reading").onclick=()=>setPracticeMode("reading");
// A starter scene fills the box and never sends: the learner can change it first.
for(const scene of document.querySelectorAll("#discussion-scenes [data-scene]"))scene.onclick=()=>{const input=$("#english-input");input.value=scene.dataset.scene;input.dispatchEvent(new Event("input",{bubbles:true}));input.focus()};
$("#import-deck-url").onclick=()=>importDeckURL($("#deck-json-url").value,$("#import-deck-url"));$("#deck-json-url").onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();$("#import-deck-url").click()}};
$("#empty-import").onclick=()=>{importStatus=$("#empty-starter-status");$("#import-file").click()};
$("#gist-now").onclick=gistBackupNow;$("#gist-restore").onclick=gistRestore;
// Leaving the app is the last chance to save pending changes; opening it catches up.
document.addEventListener("visibilitychange",()=>{if(document.hidden)maybeAutoBackup("hidden").catch(()=>{})});
$("#import-minihongo").onclick=()=>seedStarter($("#import-minihongo"));
$("#empty-starter").onclick=()=>seedStarter($("#empty-starter"),$("#empty-starter-status"));
$("#empty-practice").onclick=()=>{showView("practice");setPracticeMode("sentence");$("#english-input").focus()};

window.echoAppReady=true;

let readingBackfillRunning=false,readingBackfillTimer=null,readingBackfillRequested=false;
function scheduleReadingBackfill(){if(readingBackfillRunning){readingBackfillRequested=true;return}if(readingBackfillTimer)return;readingBackfillTimer=setTimeout(()=>{readingBackfillTimer=null;runReadingBackfill()},500)}
async function runReadingBackfill(){
 if(readingBackfillRunning)return;
 const status=$("#reading-backfill-status");
 if(!hasTranslator()){status.textContent="Connect a translator to correct all existing furigana. Original sentences are kept.";return}
 readingBackfillRunning=true;$("#reading-backfill").disabled=true;
 try{await backfillReadings({list:listSentences,read:getSentence,correct:s=>correctSentenceReadings(s,settings),
  write:async(id,expected,next)=>{const saved=await applyReadingCorrection(id,expected,next);if(!saved){readingBackfillRequested=true;return}markBackupDirty();
   if(current?.id===id){Object.assign(current,saved);if(!$("#main-view").hidden)renderSentence()}if(detail?.id===id){Object.assign(detail,saved);if(!$("#sentence-change").open){renderDetailLearningText()}}
   reviewQueue=reviewQueue.map(s=>s.id===id?saved:s);
   if(!$("#review-view").hidden&&reviewQueue[reviewIndex]?.id===id&&reviewRevealed){const target=reviewJapanese(saved);$("#review-japanese").innerHTML=reviewMode(saved)==="writing"?markTarget($("#review-answer").value,target).map(p=>p.changed?"<mark>"+p.html+"</mark>":p.html).join(""):rubyHtml(target);enableReviewVocabulary(saved,target)}
  },onProgress:(done,total)=>status.textContent=`Furigana checked: ${done} / ${total} sentences. Original readings are kept in your backup.`});
 }catch(error){status.textContent="Furigana correction paused: "+error.message+". Reopen Echo or tap Resume to continue."}
 finally{readingBackfillRunning=false;$("#reading-backfill").disabled=false;if(readingBackfillRequested){readingBackfillRequested=false;scheduleReadingBackfill()}}
}
$("#reading-backfill").onclick=runReadingBackfill;
