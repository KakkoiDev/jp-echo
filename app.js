import {applyI18n,setDictionary,t} from "./i18n.js";
import {earliestPair,flipSentence,isReversed,pairLooksSwapped,repairPair} from "./repair.js";
import {DEFAULT_PAIR,LANGUAGES,createSentence,exportBackup,forAnki,hasFurigana,hasRegisters,languageName,mergeSentences,normalizeFurigana,rubyHtml,SCHEMA_VERSION,stripFurigana} from "./core.js";
import {isExactMatch,markAttempt,markTarget} from "./diff.js";
import {deleteSentence,getSentence,listSentences,migrateStore,replaceAll,saveSentence} from "./db.js";
import {adjustNote,carries,compose,PROVIDER_DEFAULTS,tagGrammar,translate,writeNotes} from "./api.js";
import {byLevel as grammarByLevel,cleanTags as grammarTags,coverage as grammarCoverage,hasGrammar,isTagged,learned as grammarLearned,LEVELS as GRAMMAR_LEVELS,point as grammarPoint,POINTS as GRAMMAR_POINTS,summarise as grammarSummarise,untagged as untaggedSentences} from "./grammar.js";
import {japaneseVoices,recognitionFactory,ShadowLoop} from "./speech.js";
import {STORIES} from "./stories.js";
import {coverage as kanjiCoverage,facts as kanjiFacts,jlptBands as kanjiBands,learned as kanjiLearned,LEVEL_LABELS,levelOf,nextUnmet,sentenceKanji,TOTAL as KANJI_TOTAL} from "./kanji.js";
import {searchGrammar,searchKanji} from "./lookup.js";
import {deleteNote,forBackup,getNote,listNotes,makeNote,mergeNotes,noteKey,putNote,replaceNotes} from "./notes.js";
import {downloadAnkiDeck} from "./anki-export.js";
import {dueSentences,ensureSchedule,isDue,reviewSentence} from "./srs.js";
import {DEFAULT_TIME,REMINDER_TAG,reminderText,shouldRemind} from "./reminders.js";
const $=selector=>document.querySelector(selector);
const settings=JSON.parse(localStorage.getItem("jp-echo-settings")||"{}");
// Before anything reads the pair: a build shipped a swap button that reversed
// the stored pair rather than the input language, so a device left swapped
// reopens typing the language it is learning. Consumes its own evidence, so
// it runs once and then never again.
const pairWasRepaired=repairPair(settings);
if(pairWasRepaired||settings.basePair===undefined)localStorage.setItem("jp-echo-settings",JSON.stringify(settings));
const PLAY_ICON="M2 1.4 12 8 2 14.6V1.4Z",PAUSE_ICON="M2.5 1.5h3v13h-3zM7.5 1.5h3v13h-3z";
let current=null,detail=null,kanjiPlaying=null,translationFailure=null,voiceFailed=false,dictationReady=false,echoesAtCardStart=0,voices=[],installPrompt=null,reviewQueue=[],reviewIndex=0,reviewRevealed=false,reviewRecognition=null,reviewListening=false;
const loop=new ShadowLoop({onEcho:async()=>{const sheet=($("#kanji-dialog").open||$("#grammar-dialog").open)&&kanjiPlaying,reviewing=!$("#review-view").hidden,viewingDetail=!$("#sentence-view").hidden,target=sheet?kanjiPlaying:reviewing?reviewQueue[reviewIndex]:viewingDetail?detail:current;if(!target||target.transient)return;target.echoCount=(Number(target.echoCount)||0)+1;target.updatedAt=new Date().toISOString();await saveSentence(target);if(reviewing){reviewQueue[reviewIndex]=target;tickCount($("#review-echo-count"),target.echoCount)}if(viewingDetail)tickCount($("#stat-echoes"),target.echoCount);if(current?.id===target.id){current=target;renderCount()}},onState:state=>{const label=({speaking:"Playing — say it with the voice",imitate:"Your turn — echo it",paused:"Paused",stopped:"Ready",error:"That voice could not play"})[state]||state,playing=state!=="stopped"&&state!=="error",text=state==="paused"?"Play":playing?"Pause":"Play";$("#review-loop-state").textContent=label;$("#sentence-loop-state").textContent=label;const active=playing&&state!=="paused";for(const echo of document.querySelectorAll(".arcs:not(.small)>.echo"))echo.classList.toggle("is-playing",active);$("#practice").classList.toggle("playing",active);$("#review-panel").classList.toggle("playing",active);$("#loop-state").textContent=label;$("#play-pause").textContent=text;$("#play-pause").setAttribute("aria-pressed",String(playing));$("#review-audio").textContent=state==="paused"||!playing?"Play the loop":"Pause the loop";$("#review-audio").setAttribute("aria-pressed",String(playing));
  $("#sentence-play").setAttribute("aria-pressed",String(playing));const showPlay=state==="paused"||!playing;$("#sentence-play").lastChild.textContent=showPlay?"Play the loop":"Pause the loop";$("#sentence-play").querySelector("path").setAttribute("d",showPlay?PLAY_ICON:PAUSE_ICON);$("#sentence-view").classList.toggle("playing",active);
  for(const [dialog,state] of [["#kanji-dialog","#kanji-loop-state"],["#grammar-dialog","#grammar-loop-state"]])if($(dialog).open){$(state).textContent=playing?label:"";
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
const itemTarget=item=>item.targetLang||DEFAULT_PAIR.targetLang;
function setPair(source,target){
  // A pair with the same language on both sides would ask the model to
  // translate a sentence into itself, so the other side steps aside.
  if(source===target)source=source===DEFAULT_PAIR.targetLang?DEFAULT_PAIR.sourceLang:DEFAULT_PAIR.targetLang;
  settings.sourceLang=source;settings.targetLang=target;
  localStorage.setItem("jp-echo-settings",JSON.stringify(settings));
  inputLang=source;
  syncLanguageSelects();applyLanguageUI();populateVoices();setupRecognition();applyLanguage();
  if(!hasFurigana(target)&&document.body.dataset.view==="map")showView("practice");
}
// Which language you are typing, which is not which language you are learning.
// The pair is fixed: you learn from the one you know towards the one you do
// not, and a card always comes out that way round. This only moves the input
// side, for repeating a word or letting a native speak into the box.
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
  $("#english-input").placeholder=t("Enter a sentence in {language}",{language:t(languageName(inputLang))});
  $("#voice-warning").textContent="No "+languageName(target)+" voice is installed on this device.";
}
function applyTheme(theme=settings.theme||"system"){document.documentElement.dataset.theme=theme;const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);const metas=document.querySelectorAll('meta[name="theme-color"]');
  // Two metas let the system default follow prefers-color-scheme; an explicit
  // choice overrides both so the status bar never disagrees with the app.
  if(theme==="system"){metas[0].content="#F3F0E7";if(metas[1])metas[1].content="#191712"}
  else for(const meta of metas)meta.content=dark?"#191712":"#F3F0E7"}
function showProviderConfig(){const provider=$("#provider").value;document.querySelectorAll(".provider-config").forEach(node=>node.hidden=node.dataset.provider!==provider)}
function saveSettings(){settings.provider=$("#provider").value;settings.providerKeys={deepseek:$("#deepseek-key").value.trim(),google:$("#google-key").value.trim(),openai:$("#openai-key").value.trim(),anthropic:$("#anthropic-key").value.trim()};settings.providerModels={deepseek:$("#deepseek-model").value.trim(),google:$("#google-model").value.trim(),openai:$("#openai-model").value.trim(),anthropic:$("#anthropic-model").value.trim(),local:$("#local-model").value.trim()};settings.localEndpoint=$("#local-endpoint").value.trim();settings.proxyUrl=$("#proxy-url").value.trim();settings.theme=$("#theme").value;settings.motion=$("#motion").value;settings.voice=$("#voice").value;settings.rate=Number($("#rate").value);settings.showEnglish=$("#show-english").checked;settings.showFurigana=$("#show-furigana").checked;settings.showPolite=$("#show-polite").checked;settings.autoListen=$("#autolisten").checked;settings.autoTag=$("#autotag").checked;settings.remindTime=$("#remind-time").value;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));applyTheme();applyMotion()}
function resetSettingsForm(){const keys=settings.providerKeys||{},models=settings.providerModels||{};$("#provider").value=defaultProvider();$("#deepseek-key").value=keys.deepseek||settings.apiKey||"";$("#google-key").value=keys.google||"";$("#openai-key").value=keys.openai||"";$("#anthropic-key").value=keys.anthropic||"";for(const provider of Object.keys(PROVIDER_DEFAULTS))$("#"+provider+"-model").value=models[provider]||PROVIDER_DEFAULTS[provider];$("#local-endpoint").value=settings.localEndpoint||"http://localhost:11434/v1/chat/completions";$("#proxy-url").value=settings.proxyUrl||"";$("#theme").value=settings.theme||"system";$("#motion").value=settings.motion||"system";$("#autolisten").checked=settings.autoListen!==false;$("#autotag").checked=!!settings.autoTag;$("#remind").checked=!!settings.remind;$("#remind-time").value=settings.remindTime||DEFAULT_TIME;$("#remind-reach").textContent=settings.remind?reminderReach():"";$("#voice").value=settings.voice||"0";$("#rate").value=settings.rate||1;$("#rate-value").textContent=Number($("#rate").value).toFixed(1)+"×";showProviderConfig()}
function openSettings(){resetSettingsForm();updateInstallUI();$("#settings-dialog").showModal()}
function cancelSettings(){settings.remind=!!JSON.parse(localStorage.getItem("jp-echo-settings")||"{}").remind;resetSettingsForm();applyTheme();applyMotion();$("#settings-dialog").close()}
function isInstalled(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true}
function updateInstallUI(){const installed=isInstalled();$("#install-app").disabled=installed;$("#install-app").textContent=installed?"Installed":"Install";$("#install-status").textContent=installed?"Opened as an installed app.":""}
async function installApp(){if(isInstalled())return updateInstallUI();if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;$("#install-status").textContent=choice.outcome==="accepted"?"Installation started.":"Installation was cancelled.";return updateInstallUI()}$("#install-status").textContent=/iphone|ipad|ipod/i.test(navigator.userAgent)?"In Safari, tap Share, then Add to Home Screen.":"Open the browser menu and choose Install app or Add to Home screen."}
// The class comes off on animationend, as the spec asks, so a count that
// ticks twice in a row restarts the animation instead of swallowing it.
function tickCount(node,value){const text=String(value);if(!node||node.textContent===text)return;node.textContent=text;node.classList.remove("just-ticked");void node.offsetWidth;node.classList.add("just-ticked");node.addEventListener("animationend",()=>node.classList.remove("just-ticked"),{once:true})}
function renderCount(){tickCount($("#echo-count"),current?.echoCount??0)}
function selectedJapanese(){const polite=$("#show-polite").checked&&hasRegisters(itemTarget(current));return polite?(current.politeTarget||current.target):(current.casualTarget||current.target)}
function selectedPlainJapanese(){const polite=$("#show-polite").checked&&hasRegisters(itemTarget(current));return polite?(current.plainPoliteTarget||current.plainTarget):(current.plainCasualTarget||current.plainTarget)}
function resetSession(){loop.stop()}
function renderSentence(){const panel=$("#practice");panel.hidden=!current;$("#welcome").hidden=!!current;document.body.classList.toggle("has-sentence",!!current);if(!current)return;$("#japanese").innerHTML=rubyHtml(selectedJapanese());$("#english-display").textContent=current.source;$("#english-display").hidden=!$("#show-english").checked;panel.classList.toggle("hide-furigana",!$("#show-furigana").checked);renderCount();populateVoices()}
function openSentence(sentence){resetSession();current=sentence;$("#english-input").value=sentence.source;if(enteringTarget())setInputLang(sourceLang());showView("practice");renderSentence()}
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
    settings.remindLastShownAt=Date.now();localStorage.setItem("jp-echo-settings",JSON.stringify(settings));writeReminderPrefs()}catch{}}
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
    actions:[{label:"Try again",onClick:()=>{translationFailure=null;performTranslation()}},{label:"Check the key",outline:true,onClick:openSettings}]}));
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
const wide=matchMedia("(min-width:1024px)");
const isWide=()=>wide.matches;
const VIEW_TITLES={review:"Review",library:"Library"};
function showView(name){if(name==="map"&&targetLang()!=="ja")name="library";if(name!=="practice")resetSession();speechSynthesis.cancel();
  $("#main-view").hidden=name!=="practice";$("#review-home").hidden=name!=="review";$("#history-view").hidden=!(name==="library"||(name==="sentence"&&isWide()));$("#review-view").hidden=name!=="session";$("#sentence-view").hidden=name!=="sentence";$("#onboard-view").hidden=name!=="onboard";$("#setup-view").hidden=name!=="setup";$("#map-view").hidden=name!=="map";
  const solo=name==="onboard"||name==="setup"||((name==="session"||name==="sentence"||name==="map")&&!isWide());document.querySelector("header").hidden=solo;$("#tabs").hidden=solo;
  $("#view-title").textContent=VIEW_TITLES[name]||"";$("#view-title").hidden=!VIEW_TITLES[name];document.querySelector(".brand").hidden=!!VIEW_TITLES[name];
  for(const tab of document.querySelectorAll(".tab[data-view]")){const on=tab.dataset.view===name||(name==="session"&&tab.dataset.view==="review")||((name==="sentence"||name==="map")&&tab.dataset.view==="library");tab.classList.toggle("current",on);tab.setAttribute("aria-current",on?"page":"false")}
  document.body.dataset.view=name;scrollTo(0,0);renderSidePanel();
  if(name==="library"||(name==="sentence"&&isWide()))renderHistory();else if(name==="map")renderMap();else if(name==="review")renderReviewHome();else if(name==="practice")renderPracticeNotices();else if(name==="setup")resetSetupForm()}
// The study tool: the wall of joyo kanji and the list of grammar points,
// read off your library every time the screen opens. Coverage is never
// stored, so a sentence added or deleted moves the wall at once, and nothing
// here is scheduled or graded.
const tool={open:null,chip:"all",more:new Set()};
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node};
const CHEVRON='<svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden="true"><path d="m1.5 1.5 5.5 5.5 5.5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TICK='<svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true"><path d="m1.5 5 3 3 6-6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RIGHT='<svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STATE_LABELS={learned:"learned",met:"in a sentence",unmet:"not met yet",used:"used",unused:"not used yet"};
const toolHalf=()=>hasGrammar()&&settings.mapView==="grammar"?"grammar":"kanji";
const sentencesPhrase=n=>n===1?t("1 sentence"):t("{n} sentences",{n:n.toLocaleString()});
const inYours=n=>n===1?t("in 1 of your sentences"):t("in {n} of your sentences",{n:n.toLocaleString()});
function bar(learnedN,metN,total){const wrap=el("span","bar");const a=el("span","bar-learned"),b=el("span","bar-met");
  a.style.width=(total?100*learnedN/total:0).toFixed(2)+"%";b.style.width=(total?100*(metN-learnedN)/total:0).toFixed(2)+"%";wrap.append(a,b);return wrap}
function legend(rows){const list=el("ul","legend");for(const [cls,label,n] of rows){const li=el("li");const sw=el("span","swatch "+cls);if(cls==="learned")sw.innerHTML=TICK;li.append(sw,document.createTextNode(label+" — "+n.toLocaleString()));list.append(li)}return list}
async function renderMap(){
  const sentences=await listSentences();
  $("#map-from").textContent=sentences.length===1?t("From your 1 sentence"):t("From your {n} sentences",{n:sentences.length.toLocaleString()});
  const half=toolHalf();$("#map-toggle").hidden=!hasGrammar();
  for(const button of document.querySelectorAll("#map-toggle [role=tab]")){const on=button.dataset.map===half;button.setAttribute("aria-selected",String(on));button.tabIndex=on?0:-1}
  $("#map-search").placeholder=half==="kanji"?t("Kanji, reading, or meaning"):t("Point, particle, or meaning");
  $("#map-search-hint").textContent=half==="kanji"?t("Paste one you saw in the wild, handwrite it with your keyboard’s Japanese input, or type がく, gaku or study."):t("Type てしまう, te shimau, or what it does — regret, completion.");
  const query=$("#map-search").value.trim();$("#map-search-clear").hidden=!query;
  $("#map-results").hidden=!query;$("#map-kanji").hidden=!!query||half!=="kanji";$("#map-grammar").hidden=!!query||half!=="grammar";
  if(query)return renderLookup(query,sentences);
  $("#map-results-list").replaceChildren();$("#map-not-joyo").hidden=true;
  if(half==="grammar")return renderGrammar(sentences);
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
async function openKanji(character,cover,{learn=null}={}){
  kanjiOpen={character,learn};
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
  $("#kanji-say-hint").textContent=t("Echo translates it, checks the Japanese really carries {kanji}, and keeps it. If it doesn’t, you get it back to try again.",{kanji:character});
  $("#kanji-say-go").disabled=!hasTranslator();$("#kanji-say").disabled=!hasTranslator();
  $("#kanji-mic").disabled=!hasTranslator()||!dictationReady;
  $("#kanji-say-status").textContent="";
  $("#kanji-compose").textContent=t("Or let Echo write one with {kanji}",{kanji:character});
  $("#kanji-compose").disabled=!hasTranslator();
  $("#kanji-status").textContent=hasTranslator()?"":t("Add a translator and this starts working.");
  $("#kanji-loop-state").textContent="";
  const byId=new Map(all.map(item=>[item.id,item])),mine=ids.map(id=>byId.get(id)).filter(Boolean);
  renderSheetSentences($("#kanji-sentences"),mine,{deletable:true,onDelete:deleteFromSheet,mark:character});
  $("#kanji-mine-head").hidden=!mine.length;
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
    const target=document.createElement("b");target.lang=targetLang();target.innerHTML=markPattern(rubyHtml(sentence.target),mark);
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
  loop.play(sentence.plainTarget||stripFurigana(sentence.target),{voice,rate:Number($("#rate").value),lang:targetLang()});
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
  settings.learnAt=character;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));
  await openKanji(character,cover,{learn:{level:band.level,order}});
}
async function learnStep(direction){
  if(!kanjiOpen?.learn)return;
  const cover=kanjiCoverage(await listSentences());
  const character=nextUnmet(cover,kanjiOpen.character,direction,{order:kanjiOpen.learn.order});
  if(!character)return;
  settings.learnAt=character;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));
  if(loop.running)loop.stop();
  $("#kanji-say").value="";
  await openKanji(character,cover,{learn:kanjiOpen.learn});
  $("#kanji-dialog").scrollTop=0;
}
const deleteFromSheet=sentence=>askDelete(sentence,removeFromSheet);
async function removeFromSheet(sentence){
  if(!kanjiOpen)return;
  if(loop.running&&kanjiPlaying?.id===sentence.id)loop.stop();
  await deleteSentence(sentence.id);
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
    const card=await translate(text,{...settings,inputLang,sourceLang:sourceLang(),targetLang:targetLang()});
    if(!carries(card,target.character)){
      status.textContent=t("That sentence does not use {kanji} — try one that does.",{kanji:target.character});
      field.focus();return}
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
    const tags=await tagGrammar([sentence],GRAMMAR_POINTS,{...settings,targetLang:targetLang()}),got=tags.get(sentence.id);
    if(!got)return;
    const fresh=await getSentence(sentence.id);if(!fresh)return;
    await saveSentence({...fresh,grammar:got,updatedAt:new Date().toISOString()});
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
    for(const sentence of todo){const got=tags.get(sentence.id);if(!got)continue;await saveSentence({...sentence,grammar:got,updatedAt:new Date().toISOString()});done++}
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
async function openGrammar(point,cover,{learn=null}={}){
  grammarOpen={point,learn};
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
  $("#grammar-mine-head").hidden=!mine.length;
  if(!$("#grammar-dialog").open)$("#grammar-dialog").showModal();
  renderPointNotes(point);
}
// Echo's notes on a point — In one breath, A way to remember it, Two to try
// — are written on your own key the first time you open it, and kept. Every
// note can be adjusted, by an instruction to Echo or by hand, and reset.
// Written from the point's name and gloss alone, never from the index.
const NOTE_TITLES={breath:"In one breath",remember:"A way to remember it"};
async function renderPointNotes(point){
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
      target.innerHTML=markPattern(rubyHtml(example.ja),point.title);
      text.append(target,el("span",null,example.en));
      const keep=el("button","keep hit",t("Keep"));keep.type="button";
      keep.onclick=async()=>{keep.disabled=true;keep.textContent=t("Keeping…");
        try{await saveGrammarSentence({source:example.en,casual:example.ja,polite:example.ja},point);
          const rest=notes.examples.text.filter(e=>e!==example);notes.examples=makeNote({kind:"point",id:point.id,part:"examples",text:rest});await putNote(notes.examples)}
        catch(error){keep.disabled=false;keep.textContent=t("Keep");$("#grammar-status").textContent=sheetError(error)}};
      row.append(text,keep);list.append(row)}
  }
}
// One note block: the text, whose it is, and the Adjust panel — an
// instruction to Echo, editing by hand, or Reset to Echo's.
function noteBlock(block,{about,kind,note,onSave,onReset,echoLine,yoursLine,render=null}){
  const text=block.querySelector(".note-text"),line=block.querySelector(".note-note"),panel=block.querySelector(".adjust-panel"),input=panel.querySelector("input"),rewrite=panel.querySelector(".rewrite"),reset=panel.querySelector(".reset-link"),adjust=block.querySelector(".adjust-link"),pstatus=panel.querySelector(".adjust-status");
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
    const card=await translate(text,{...settings,inputLang,sourceLang:sourceLang(),targetLang:targetLang()});
    const tags=await tagGrammar([{id:"new",plainTarget:stripFurigana(card.casual||card.polite||"")}],[target.point],{...settings,targetLang:targetLang()});
    if(!(tags.get("new")||[]).includes(target.point.id)){
      status.textContent=t("That sentence does not use {point} — try one that does.",{point:target.point.title});field.focus();return}
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
async function saveGrammarSentence(card,point){
  const made=ensureSchedule(createSentence(card.source,card,new Date(),undefined,{sourceLang:sourceLang(),targetLang:targetLang()}));
  made.translationProvider=defaultProvider();made.grammar=[...new Set([...(card.grammar||[]),point.id])];
  await saveSentence(made);refreshDueBadge();
  await openGrammar(point,grammarCoverage(await listSentences()),{learn:grammarOpen?.learn||null});renderMap();
}
const deleteFromGrammarSheet=sentence=>askDelete(sentence,removeFromGrammarSheet);
async function removeFromGrammarSheet(sentence){
  if(!grammarOpen)return;
  if(loop.running&&kanjiPlaying?.id===sentence.id)loop.stop();
  await deleteSentence(sentence.id);
  if(current?.id===sentence.id){current=null;renderSentence()}
  if(detail?.id===sentence.id)detail=null;
  refreshDueBadge();
  await openGrammar(grammarOpen.point,grammarCoverage(await listSentences()),{learn:grammarOpen.learn});
  $("#grammar-status").textContent=t("Deleted.");renderMap();
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
async function renderReviewHome(){const all=(await listSentences()).map(item=>ensureSchedule(item)),now=Date.now(),due=dueSentences(all),counts={new:0,learning:0,review:0};
  for(const item of due){const state=item.srs?.state??0;if(state===1||state===3)counts.learning++;else if(state===2)counts.review++;else counts.new++}
  $("#due-count").textContent=String(due.length);$("#due-new").textContent=String(counts.new);$("#due-learning").textContent=String(counts.learning);$("#due-review").textContent=String(counts.review);
  updateDueBadge(due.length);
  const waiting=all.filter(item=>!due.includes(item)),next=waiting.map(item=>Date.parse(item.srs.due)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  $("#review-due-block").hidden=due.length===0;$("#review-rest-block").hidden=due.length>0;
  document.querySelector(".ring-stage").classList.toggle("resting",due.length===0);
  $("#start-review").hidden=due.length===0;$("#review-practice").hidden=due.length>0;
  if(due.length){$("#review-estimate").textContent="Say each one out loud before you check. Roughly "+spell(Math.max(1,Math.round(due.length*.55)))+" minutes.";
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
  $("#side-start-review").disabled=due.length===0;
  $("#due-empty").hidden=due.length>0;
  $("#due-list").replaceChildren(...due.slice(0,8).map(item=>{const li=document.createElement("li");
    li.innerHTML='<button type="button"><span lang="'+itemTarget(item)+'">'+escapeText(item.plainTarget||stripFurigana(item.target))+'</span><span class="source-line">'+escapeText(item.source)+"</span></button>";
    li.querySelector("button").onclick=()=>openDetail(item.id);
    return li}));}
function renderQueuePanel(){
  $("#queue-list").replaceChildren(...reviewQueue.map((item,index)=>{const li=document.createElement("li");
    li.className=index===reviewIndex?"now":index<reviewIndex?"done":"";
    li.innerHTML='<span class="dot" aria-hidden="true"></span><span class="source-line">'+escapeText(item.source)+"</span>";
    return li}));
  const left=Math.max(0,reviewQueue.length-reviewIndex),done=reviewIndex;
  $("#queue-note").textContent=left?(done?spell(done)+" done. ":"")+"About "+spell(Math.max(1,Math.round(left*.55)))+" minutes left at your pace.":"All said.";}
const escapeText=value=>{const node=document.createElement("span");node.textContent=value;return node.innerHTML};
const CARD_STATES={due:"Due now",new:"New",learning:"Learning",review:"Review"};
const ORDER_LABELS={"created-desc":"Newest first","created-asc":"Oldest first","echoes-desc":"Most echoes","echoes-asc":"Fewest echoes","due-desc":"Furthest away","due-asc":"Due soonest","english-desc":"English Z–A","english-asc":"English A–Z","japanese-desc":"Japanese Z–A","japanese-asc":"Japanese A–Z"};
function cardState(item,now=Date.now()){const state=item.srs?.state??0;if(!item.srs?.due||Date.parse(item.srs.due)<=now)return "due";if(state===0)return "new";if(state===1||state===3)return "learning";return "review"}
function renderLibraryTool(all){const row=$("#library-tool");row.hidden=targetLang()!=="ja";if(row.hidden)return;
  const k=kanjiLearned(all).size,g=hasGrammar()?grammarLearned(all).size:null;
  $("#library-tool-tally").textContent=g===null?t("{n} learned",{n:k.toLocaleString()}):k.toLocaleString()+" · "+t("{n} learned",{n:g.toLocaleString()});
  row.setAttribute("aria-label",t("Kanji and grammar")+": "+(g===null?t("{n} kanji learned",{n:k.toLocaleString()}):t("{k} kanji and {g} points learned",{k:k.toLocaleString(),g:g.toLocaleString()})))}
async function renderHistory(){const all=await listSentences();renderLibraryTool(all);const list=$("#history-list"),due=dueSentences(all),query=$("#history-search").value.trim().toLocaleLowerCase(),filter=$("#history-filter").value,order=$("#history-order").value,direction=$("#history-direction").value,now=Date.now();let items=all.filter(item=>{const haystack=[item.source,item.target,item.plainTarget,item.casualTarget,item.politeTarget].filter(Boolean).join(" ").toLocaleLowerCase();if(query&&!haystack.includes(query))return false;const state=item.srs?.state??0;if(filter==="due")return !item.srs?.due||Date.parse(item.srs.due)<=now;if(filter==="new")return state===0;if(filter==="learning")return state===1||state===3;if(filter==="review")return state===2;return true});const comparators={created:(a,b)=>a.createdAt.localeCompare(b.createdAt),echoes:(a,b)=>(Number(a.echoCount)||0)-(Number(b.echoCount)||0),due:(a,b)=>Date.parse(a.srs?.due||a.createdAt)-Date.parse(b.srs?.due||b.createdAt),english:(a,b)=>a.source.localeCompare(b.source),japanese:(a,b)=>(a.plainTarget||a.target).localeCompare(b.plainTarget||b.target,itemTarget(a))},factor=direction==="asc"?1:-1;items.sort((a,b)=>factor*(comparators[order]||comparators.created)(a,b));list.replaceChildren();$("#empty-history").hidden=all.length>0;$("#empty-results").hidden=all.length===0||items.length>0;$("#empty-results-count").textContent=all.length===1?"One is in your library.":capitalise(spell(all.length))+" are in your library.";updateDueBadge(due.length);$("#library-count").textContent=items.length===1?"1 sentence":items.length+" sentences";$("#library-order-label").textContent=ORDER_LABELS[order+"-"+direction]||"";$(".list-head").hidden=items.length===0;if(isWide()&&!detail&&items.length)return openDetail(items[0].id);
  for(const item of items){const li=document.createElement("li");li.dataset.id=item.id;const state=cardState(item,now);li.innerHTML='<button class="history-open" type="button"><span class="lines"><span lang="'+itemTarget(item)+'">'+rubyHtml(item.target)+'</span><span class="source-line">'+escapeText(item.source)+'</span><span class="status-chip '+state+'">'+CARD_STATES[state]+'</span></span><span class="tally"><strong>'+(Number(item.echoCount)||0)+'</strong><span>echoes</span></span></button>';li.querySelector(".history-open").onclick=()=>openDetail(item.id);list.append(li)}markSelectedRow()}
const formatDate=value=>new Intl.DateTimeFormat(undefined,{day:"numeric",month:"long"}).format(new Date(value));
const RATING_LABELS={again:"Again",ok:"OK"};
function untilDue(sentence,now=Date.now()){const due=Date.parse(sentence.srs?.due||"");if(!Number.isFinite(due)||due<=now)return "Now";
  const minutes=Math.round((due-now)/60000);if(minutes<60)return minutes+"m";const hours=Math.round(minutes/60);if(hours<24)return hours+"h";return Math.round(hours/24)+"d"}
async function openDetail(id){const sentence=await getSentence(id);if(!sentence)return showView("library");resetSession();detail=ensureSchedule(sentence);showView("sentence");renderDetail()}
function markSelectedRow(){for(const li of document.querySelectorAll("#history-list li"))li.classList.toggle("selected",li.dataset.id===detail?.id);}
function renderDetail(){if(!detail)return;closeEditor();markSelectedRow();
  $("#sentence-added").textContent="Added "+formatDate(detail.createdAt);
  $("#sentence-japanese").innerHTML=rubyHtml(detail.target);$("#sentence-japanese").lang=itemTarget(detail);
  $("#sentence-english").textContent=detail.source;
  $("#sentence-view").classList.toggle("hide-furigana",settings.showFurigana===false);
  $("#stat-echoes").textContent=String(Number(detail.echoCount)||0);
  const state=cardState(detail);$("#stat-stage").textContent=CARD_STATES[state];$("#stat-stage").className="status-chip "+state;
  $("#stat-due").textContent=untilDue(detail);
  const reviews=Array.isArray(detail.reviews)?[...detail.reviews]:[];
  const rows=reviews.slice().reverse().map(entry=>({when:formatDate(entry.at),echoes:Number(entry.echoes)||0,rating:RATING_LABELS[entry.rating]||entry.rating,className:entry.rating==="again"?"again":""}));
  rows.push({when:formatDate(detail.createdAt),echoes:null,rating:"First",className:"first"});
  $("#sentence-history").replaceChildren(...rows.map(row=>{const li=document.createElement("li");
    li.innerHTML='<span class="when">'+escapeText(row.when)+'</span><span class="detail">'+(row.echoes===null?"":'<span class="echoes">'+row.echoes+" echoes</span>")+'<span class="rating-chip '+row.className+'">'+escapeText(row.rating)+"</span></span>";return li}));
  const lapses=reviews.filter(entry=>entry.rating==="again").length;
  $("#sentence-history-note").textContent=lapses?"It came out wrong "+(lapses===1?"once":spell(lapses)+" times")+". The difference shows up marked when you check.":reviews.length?"Said correctly every time so far.":"Not reviewed yet — it is waiting in the queue.";
  $("#sentence-play").disabled=false}
function openEditor(){if(!detail)return;resetSession();$("#sentence-draft").value=detail.target;$("#sentence-edit-error").hidden=true;$("#sentence-editor").hidden=false;$("#sentence-japanese").hidden=true;$("#sentence-english").hidden=true;$(".sentence-controls").hidden=true;$("#sentence-draft").focus()}
function closeEditor(){$("#sentence-editor").hidden=true;$("#sentence-japanese").hidden=false;$("#sentence-english").hidden=false;$(".sentence-controls").hidden=false}
async function saveEdit(event){event.preventDefault();if(!detail)return;
  const japanese=normalizeFurigana($("#sentence-draft").value.trim());
  if(!japanese||!/[\u3040-\u30ff\u3400-\u9fff]/.test(japanese)){$("#sentence-edit-error").textContent="That needs to be a Japanese sentence.";$("#sentence-edit-error").hidden=false;return}
  const plain=stripFurigana(japanese).trim();
  detail={...detail,target:japanese,plainTarget:plain,casualTarget:japanese,plainCasualTarget:plain,politeTarget:japanese,plainPoliteTarget:plain,updatedAt:new Date().toISOString()};
  await saveSentence(detail);if(current?.id===detail.id){current=detail;renderSentence()}renderDetail()}
function playDetail(){if(!detail)return;if(loop.running){loop.togglePause();return}
  const voice=voices[Number($("#voice").value)]||voices[0]||null;loop.play(detail.plainTarget||stripFurigana(detail.target),{voice,rate:Number($("#rate").value),lang:targetLang()})}
// One confirm sheet for every delete — the detail page and the rows on the
// kanji and grammar sheets — so a slip of the thumb costs a second tap, and
// the consequence line is read the same way everywhere.
let pendingDelete=null;
async function askDelete(sentence=detail,onConfirm=confirmDetailDelete){if(!sentence)return;
  pendingDelete={sentence,onConfirm};
  $("#delete-quote").innerHTML=rubyHtml(sentence.target);
  await renderDeleteConsequence(sentence);
  const echoes=Number(sentence.echoCount)||0,reviews=Array.isArray(sentence.reviews)?sentence.reviews.length:0;
  const say=echoes<=10&&reviews<=10?spell:String;
  $("#delete-copy").textContent="It leaves your library, its place in the review queue, and every export from here on. "+
    (echoes||reviews?capitalise(say(echoes))+(echoes===1?" echo":" echoes")+" and "+say(reviews)+(reviews===1?" review":" reviews")+" go with it. ":"")+"There is no undo.";
  $("#delete-dialog").showModal()}
async function confirmDelete(){const pending=pendingDelete;pendingDelete=null;$("#delete-dialog").close();if(pending)await pending.onConfirm(pending.sentence)}
async function confirmDetailDelete(){if(!detail)return;const id=detail.id;resetSession();
  await deleteSentence(id);if(current?.id===id){current=null;renderSentence()}
  reviewQueue=reviewQueue.filter(item=>item.id!==id);detail=null;refreshDueBadge();showView("library")}
const capitalise=value=>value.charAt(0).toUpperCase()+value.slice(1);
// The wall is a mirror, not a trophy case: delete the only sentence carrying
// a kanji or a point and it goes back to not met. Said before, not after.
async function renderDeleteConsequence(sentence){
  const line=$("#delete-consequence");line.hidden=true;line.replaceChildren();
  if(targetLang()!=="ja")return;
  const others=(await listSentences()).filter(s=>s.id!==sentence.id),cover=kanjiCoverage(others),gcover=grammarCoverage(others);
  const kanji=[...sentenceKanji(sentence)].filter(c=>!cover.has(c)),points=grammarTags(sentence.grammar).filter(id=>!gcover.has(id)).map(id=>grammarPoint(id)?.title).filter(Boolean);
  if(!kanji.length&&!points.length)return;
  const ja=text=>{const b=el("b",null,text);b.lang="ja";return b};
  const join=items=>{const out=[];items.forEach((item,i)=>{if(i)out.push(document.createTextNode(i===items.length-1?" "+t("and")+" ":", "));out.push(ja(item))});return out};
  if(kanji.length)line.append(document.createTextNode(kanji.length===1?t("It is the only sentence you have with ")+"":t("It is the only sentence you have with ")),...join(kanji));
  if(points.length)line.append(document.createTextNode((kanji.length?", "+t("and the only one using")+" ":t("It is the only sentence you have using")+" ")),...join(points));
  line.append(document.createTextNode(" — "+(kanji.length+points.length===1?t("that goes back to “not met” on the wall."):t("those go back to “not met” on the wall."))+" "+t("The wall only ever counts what is in your library.")));
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
  $("#setup-step-1").hidden=step!==1;$("#setup-step-2").hidden=step!==2;
  $("#setup-step-label").textContent="Step "+step+" of 2";
  $("#setup-title").textContent=step===1?"One thing first":"Which languages?";
  $("#setup-copy").textContent=step===1
    ?"Echo needs a translator. Pick a service you have an account with and paste its key — it is saved on this device and goes nowhere else."
    :"What you write in, and what Echo translates into. Both can change later.";
  $("#setup-next").hidden=step!==1;$("#setup-save").hidden=step!==2;
  $("#setup-skip").hidden=step!==1;}
function storeTranslator(){const provider=$("#setup-provider").value;
  settings.provider=provider;
  if(provider==="local")settings.localEndpoint=$("#setup-endpoint").value.trim();
  else settings.providerKeys={...(settings.providerKeys||{}),[provider]:$("#setup-key").value.trim()};}
function saveSetup(){storeTranslator();finishOnboarding()}
function finishOnboarding(){settings.onboarded=true;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));resetSettingsForm();showView("practice")}
async function performTranslation(){const english=$("#english-input").value.trim();if(!english)return setStatus(t("Enter a sentence in {language}.",{language:t(languageName(inputLang))}),true);const provider=defaultProvider();if(!hasTranslator())return showView("setup");
  // Swap the label's text, not the button's: textContent would take the arrow
  // icon and the .label span with it, and they never came back — after one
  // translation the button was bare text that no longer answered the rule
  // hiding the word on a phone.
  const button=$("#translate"),label=button.querySelector(".label"),previous=label.textContent;button.disabled=true;label.textContent="Translating…";button.setAttribute("aria-busy","true");setStatus("Translating…");try{translationFailure=null;const card=await translate(english,{...settings,inputLang});resetSession();current=ensureSchedule(createSentence(card.source,card,new Date(),undefined,{sourceLang:sourceLang(),targetLang:targetLang()}));current.translationProvider=provider;await saveSentence(current);autoTag(current);renderSentence();refreshDueBadge();clearComposer();setStatus("Ready to practice.")}catch(error){const name=PROVIDER_NAMES[provider]||provider;
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
function populateVoices(){voices=japaneseVoices(targetLang());const select=$("#voice"),previous=settings.voice;select.replaceChildren(...voices.map((voice,index)=>{const option=new Option(voice.name+" ("+voice.lang+")",String(index));option.selected=previous===String(index);return option}));$("#voice-warning").hidden=voices.length>0;$("#play-pause").disabled=!current;if(!$("#main-view").hidden)renderPracticeNotices()}
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
  failed:"Dictation failed — type it instead."};
const dictationError=error=>DICTATION[error]||DICTATION.failed;
// Append rather than replace, so a second burst adds to what you already said
// instead of throwing it away.
const appendHeard=(field,heard)=>{field.value=(field.value?field.value.trimEnd()+" "+heard:heard).trim()};
function bindDictation(mic,field,status){const recognition=recognitionFactory(inputLang);
  if(!recognition){mic.disabled=true;mic.onclick=null;status.textContent=DICTATION.unavailable;return false}
  mic.disabled=!hasTranslator();if(status.textContent===DICTATION.unavailable)status.textContent="";
  mic.onclick=()=>{status.textContent=DICTATION.listening;mic.classList.add("is-listening");try{recognition.start()}catch{}};
  recognition.onresult=event=>{appendHeard(field,event.results[0][0].transcript);status.textContent="Edit anything it mishears before you translate."};
  recognition.onerror=event=>{status.textContent=dictationError(event.error)};
  recognition.onend=()=>{mic.classList.remove("is-listening");if(status.textContent===DICTATION.listening)status.textContent=""};
  return true}
function setupRecognition(){
  dictationReady=bindDictation($("#microphone"),$("#english-input"),$("#voice-input-status"));
  bindDictation($("#kanji-mic"),$("#kanji-say"),$("#kanji-say-status"));
  bindDictation($("#grammar-mic"),$("#grammar-say"),$("#grammar-say-status"))}
async function startReview(){const items=await listSentences(),scheduled=items.map(item=>ensureSchedule(item));await Promise.all(scheduled.filter((item,index)=>item!==items[index]).map(saveSentence));reviewQueue=dueSentences(scheduled);reviewIndex=0;if(!reviewQueue.length)return showView("review");showView("session");renderReview()}
function reviewJapanese(sentence){return settings.showPolite&&hasRegisters(itemTarget(sentence))?(sentence.politeTarget||sentence.target):(sentence.casualTarget||sentence.target)}
function reviewPlainJapanese(sentence){return settings.showPolite&&hasRegisters(itemTarget(sentence))?(sentence.plainPoliteTarget||sentence.plainTarget):(sentence.plainCasualTarget||sentence.plainTarget)}
const STAGE_LABELS={0:"New",1:"Learning",2:"Review",3:"Relearning"};
function stageLabel(sentence){const state=sentence.srs?.state??0,reps=Number(sentence.srs?.reps)||0;return STAGE_LABELS[state]+(reps?" · seen "+reps+(reps===1?" time":" times"):"")}
function stageClass(sentence){const state=sentence.srs?.state??0;return state===0?"new":state===2?"review":"learning"}
function renderReview(){resetSession();stopReviewListening();$("#review-mic").disabled=!dictationReady;const sentence=reviewQueue[reviewIndex],complete=!sentence;
  $("#review-panel").hidden=complete;$("#review-prompt-actions").hidden=complete;$("#review-actions").hidden=true;$("#review-complete").hidden=!complete;
  $("#review-progress").textContent=complete?`${reviewQueue.length} / ${reviewQueue.length}`:`${reviewIndex+1} / ${reviewQueue.length}`;
  renderSidePanel();$("#review-progress-bar").style.width=(reviewQueue.length?Math.round((complete?reviewQueue.length:reviewIndex)/reviewQueue.length*100):0)+"%";
  if(complete)return renderReviewComplete();
  reviewRevealed=false;
  $("#review-stage").textContent=stageLabel(sentence);$("#review-stage").className="status-chip "+stageClass(sentence);
  $("#review-prompt").textContent=sentence.source;$("#review-prompt").hidden=false;$("#review-prompt-echo").textContent=sentence.source;
  $("#review-capture").hidden=false;$("#review-result").hidden=true;
  $("#review-answer").value="";$("#review-listen-state").textContent="";
  echoesAtCardStart=Number(sentence.echoCount)||0;$("#review-echo-count").textContent=String(echoesAtCardStart);
  updateCheckButton();
  if(settings.autoListen!==false)startReviewListening();else $("#review-answer").focus()}
async function renderReviewComplete(){const said=reviewQueue.length;let copy=said?spell(said)+(said===1?" sentence":" sentences")+" out loud.":"Nothing was due.";
  const all=(await listSentences()).map(item=>ensureSchedule(item)),next=all.filter(item=>!isDue(item)).map(item=>Date.parse(item.srs.due)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  if(next)copy+=" The next batch comes back in "+describeGap(next-Date.now())+".";
  $("#review-complete-copy").textContent=copy;refreshDueBadge()}
function updateCheckButton(){$("#review-check").disabled=!$("#review-answer").value.trim()}
function revealReview(){const sentence=reviewQueue[reviewIndex];if(!sentence||reviewRevealed)return;
  const attempt=$("#review-answer").value.trim();if(!attempt)return;
  reviewRevealed=true;stopReviewListening();
  const target=reviewJapanese(sentence);
  $("#review-attempt").innerHTML=markAttempt(attempt,target).map(part=>part.changed?"<mark>"+escapeText(part.text)+"</mark>":escapeText(part.text)).join("");
  $("#review-japanese").innerHTML=markTarget(attempt,target).map(part=>part.changed?"<mark>"+part.html+"</mark>":part.html).join("");
  $("#review-panel").classList.toggle("hide-furigana",settings.showFurigana===false);
  $("#review-capture").hidden=true;$("#review-result").hidden=false;
  $("#review-prompt").hidden=true;$("#review-prompt-actions").hidden=true;$("#review-actions").hidden=false;
  playReviewAudio()}
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
function skipReview(){reviewIndex++;renderReview()}
function playReviewAudio(){const sentence=reviewQueue[reviewIndex];if(!sentence)return;if(loop.running){loop.togglePause();return}const voice=voices[Number($("#voice").value)]||voices[0]||null;loop.play(reviewPlainJapanese(sentence)||reviewJapanese(sentence).replace(/【[^】]+】/g,""),{voice,rate:Number($("#rate").value),lang:targetLang()})}
async function rateReview(rating){const sentence=reviewQueue[reviewIndex];if(!sentence||!reviewRevealed)return;resetSession();const graded=reviewSentence(sentence,rating);
  const updated={...graded,reviews:[...(Array.isArray(sentence.reviews)?sentence.reviews:[]),{at:new Date().toISOString(),rating,echoes:Math.max(0,(Number(sentence.echoCount)||0)-echoesAtCardStart)}]};await saveSentence(updated);if(current?.id===updated.id)current=updated;reviewQueue[reviewIndex]=updated;reviewIndex++;renderReview()}
async function exportHistory(){const data=exportBackup(await listSentences(),settings,forBackup(await listNotes().catch(()=>[]))),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),link=Object.assign(document.createElement("a"),{href:url,download:"jp-echo-backup.json"});link.click();URL.revokeObjectURL(url)}
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
  if(!settings.directionChecked){settings.directionChecked=true;localStorage.setItem("jp-echo-settings",JSON.stringify(settings))}
  if(!repaired)return;
  const pair={sourceLang:sourceLang(),targetLang:targetLang()};
  const broken=items.filter(item=>isReversed(item,pair));
  if(!broken.length)return;
  await Promise.all(broken.map(item=>saveSentence(flipSentence(item))));
  renderHistory();refreshDueBadge();
  toast(broken.length===1?"Put 1 sentence the right way round":"Put "+broken.length+" sentences the right way round",6000);
}
async function importHistory(file){if(!file)return;try{const backup=JSON.parse(await file.text());if(!(Number(backup.schemaVersion)>=1&&Number(backup.schemaVersion)<=SCHEMA_VERSION)||!Array.isArray(backup.sentences))throw new Error("Unsupported backup.");const merged=mergeSentences(await listSentences(),backup.sentences);await replaceAll(merged);if(Array.isArray(backup.notes))await replaceNotes(mergeNotes(await listNotes().catch(()=>[]),backup.notes)).catch(()=>{});setStatus("Imported "+backup.sentences.length+" sentence(s).");renderHistory()}catch(error){setStatus(error.message||"Import failed.",true)}}
for(const tab of document.querySelectorAll(".tab[data-view]"))tab.onclick=()=>showView(tab.dataset.view);$("#translate").onclick=performTranslation;$("#english-input").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")performTranslation()};$("#play-pause").onclick=()=>{if(!current)return;if(loop.running){loop.togglePause();return}const voice=voices[Number($("#voice").value)]||voices[0]||null;loop.play(selectedPlainJapanese(),{voice,rate:Number($("#rate").value),lang:targetLang()})};$("#show-english").onchange=()=>{saveSettings();renderSentence()};$("#show-furigana").onchange=()=>{saveSettings();renderSentence()};$("#show-polite").onchange=()=>{resetSession();saveSettings();renderSentence()};$("#rate").oninput=()=>{const rate=Number($("#rate").value);$("#rate-value").textContent=rate.toFixed(1)+"×";resetSession();loop.setRate(rate)};$("#settings-button").onclick=()=>$("#settings-dialog").showModal();$("#close-settings").onclick=()=>{saveSettings();$("#settings-dialog").close();renderPracticeNotices();writeReminderPrefs();syncReminderSchedule()};
$("#remind").onchange=async()=>{const wanted=$("#remind").checked;
  if(wanted&&!await enableReminders()){$("#remind").checked=false;$("#remind-hint").textContent="Notifications are blocked for Echo. Allow them in your browser settings, then turn this on again.";$("#remind-hint").classList.add("error");$("#remind-reach").textContent="";return}
  $("#remind-hint").textContent="Your device asks permission the first time you turn this on.";$("#remind-hint").classList.remove("error");
  settings.remind=wanted;$("#remind-reach").textContent=wanted?reminderReach():""};$("#export-anki").onclick=()=>exportAnki($("#export-anki"));$("#open-anki").onclick=()=>openAnki();$("#export").onclick=exportHistory;$("#import").onclick=()=>$("#import-file").click();$("#import-file").onchange=event=>importHistory(event.target.files[0]);
$("#onboard-start").onclick=()=>showView("setup");$("#onboard-restore").onclick=()=>{finishOnboarding();showView("library");$("#import-file").click()};
$("#setup-next").onclick=()=>{storeTranslator();showSetupStep(2)};
$("#setup-back").onclick=()=>{if(setupStep===2)return showSetupStep(1);showView(settings.onboarded?"practice":"onboard")};$("#setup-provider").onchange=showSetupFields;$("#setup-save").onclick=saveSetup;$("#setup-skip").onclick=finishOnboarding;
$("#clear-filters").onclick=()=>{$("#history-search").value="";$("#clear-history-search").hidden=true;$("#history-filter").value="all";settings.historyFilter="all";localStorage.setItem("jp-echo-settings",JSON.stringify(settings));renderHistory()};
addEventListener("online",renderPracticeNotices);addEventListener("offline",renderPracticeNotices);
$("#kanji-close").onclick=()=>{loop.stop();$("#kanji-dialog").close()};$("#kanji-dialog").addEventListener("close",()=>{loop.stop();kanjiPlaying=null;kanjiOpen=null});$("#kanji-compose").onclick=composeForKanji;$("#kanji-say-go").onclick=sayForKanji;$("#library-tool").onclick=()=>showView("map");$("#map-back").onclick=()=>showView("library");for(const button of document.querySelectorAll("#map-toggle [role=tab]"))button.onclick=()=>{settings.mapView=button.dataset.map;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));tool.open=null;tool.chip="all";renderMap()};$("#map-toggle").addEventListener("keydown",event=>{if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;const other=document.querySelector("#map-toggle [role=tab][aria-selected=false]");if(other){other.click();other.focus()}});let lookupTimer=0;$("#map-search").oninput=()=>{clearTimeout(lookupTimer);lookupTimer=setTimeout(renderMap,150)};$("#map-search").onkeydown=event=>{if(event.key==="Escape"&&$("#map-search").value){$("#map-search").value="";renderMap()}};$("#map-search-clear").onclick=()=>{$("#map-search").value="";$("#map-search").focus();renderMap()};$("#grammar-prev").onclick=()=>grammarStep(-1);$("#grammar-next").onclick=()=>grammarStep(1);$("#grammar-close").onclick=()=>{loop.stop();$("#grammar-dialog").close()};$("#grammar-dialog").addEventListener("close",()=>{loop.stop();kanjiPlaying=null;grammarOpen=null});$("#grammar-say-go").onclick=sayForGrammar;$("#grammar-say").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")sayForGrammar()};$("#grammar-compose").onclick=composeForGrammar;$("#kanji-prev").onclick=()=>learnStep(-1);$("#kanji-next").onclick=()=>learnStep(1);$("#kanji-dialog").addEventListener("keydown",event=>{if(!kanjiOpen?.learn||event.target.tagName==="TEXTAREA")return;if(event.key==="ArrowRight")learnStep(1);else if(event.key==="ArrowLeft")learnStep(-1)});$("#kanji-say").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")sayForKanji()};$("#sentence-back").onclick=()=>{detail=null;showView("library")};$("#sentence-play").onclick=playDetail;$("#sentence-edit").onclick=openEditor;$("#sentence-cancel").onclick=closeEditor;$("#sentence-editor").onsubmit=saveEdit;
$("#sentence-delete").onclick=()=>askDelete();$("#delete-cancel").onclick=()=>$("#delete-dialog").close();$("#delete-confirm").onclick=confirmDelete;$("#delete-dialog").onclick=event=>{if(event.target===$("#delete-dialog"))$("#delete-dialog").close()};
$("#side-start-review").onclick=startReview;$("#side-export-anki").onclick=()=>exportAnki($("#side-export-anki"));
wide.addEventListener("change",()=>showView(document.body.dataset.view||"practice"));
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
$("#start-review").onclick=startReview;$("#review-practice").onclick=()=>showView("practice");$("#review-back").onclick=()=>{stopReviewListening();showView("review")};$("#review-done").onclick=()=>showView("practice");$("#review-home-link").onclick=()=>showView("review");$("#review-check").onclick=revealReview;$("#review-skip").onclick=skipReview;$("#review-mic").onclick=toggleReviewListening;$("#review-answer").oninput=updateCheckButton;$("#review-audio").onclick=playReviewAudio;$("#review-again").onclick=()=>rateReview("again");$("#review-ok").onclick=()=>rateReview("ok");
$("#settings-button").onclick=openSettings;$("#settings-nav").onclick=openSettings;$("#dismiss-settings").onclick=cancelSettings;$("#cancel-settings").onclick=cancelSettings;$("#install-app").onclick=installApp;$("#settings-dialog").addEventListener("cancel",event=>{event.preventDefault();cancelSettings()});$("#settings-dialog").onclick=event=>{if(event.target===$("#settings-dialog"))cancelSettings()};$("#voice").onchange=resetSession;$("#provider").onchange=showProviderConfig;$("#source-lang").onchange=()=>setPair($("#source-lang").value,targetLang());
$("#target-lang").onchange=()=>setPair(sourceLang(),$("#target-lang").value);
$("#setup-source").onchange=()=>setPair($("#setup-source").value,targetLang());
$("#setup-target").onchange=()=>setPair(sourceLang(),$("#setup-target").value);
$("#swap-langs").onclick=()=>{setInputLang(enteringTarget()?sourceLang():targetLang());toast("Typing in "+languageName(inputLang))};
$("#theme").onchange=()=>applyTheme($("#theme").value);$("#motion").onchange=()=>applyMotion($("#motion").value);window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;updateInstallUI()});window.addEventListener("appinstalled",()=>{installPrompt=null;updateInstallUI()});
$("#history-search").oninput=()=>{$("#clear-history-search").hidden=!$("#history-search").value;renderHistory()};$("#clear-history-search").onclick=()=>{$("#history-search").value="";$("#clear-history-search").hidden=true;$("#history-search").focus();renderHistory()};for(const id of ["#history-filter","#history-order","#history-direction"]){$(id).onchange=()=>{settings.historyFilter=$("#history-filter").value;settings.historyOrder=$("#history-order").value;settings.historyDirection=$("#history-direction").value;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));renderHistory()}}
const legacyOrders={newest:["created","desc"],oldest:["created","asc"],echoes:["echoes","desc"],due:["due","asc"]},legacy=legacyOrders[settings.historyOrder];if(legacy){settings.historyOrder=legacy[0];settings.historyDirection=settings.historyDirection||legacy[1]}resetSettingsForm();applyTheme();applyMotion();syncLanguageSelects();applyLanguageUI();$("#show-english").checked=settings.showEnglish??false;$("#show-furigana").checked=settings.showFurigana??true;$("#show-polite").checked=settings.showPolite??false;$("#history-filter").value=settings.historyFilter||"all";$("#history-order").value=settings.historyOrder||"created";$("#history-direction").value=settings.historyDirection||"desc";speechSynthesis.onvoiceschanged=populateVoices;populateVoices();renderVoiceHelp();
// Android fills the voice list after the page has settled and does not always
// fire voiceschanged, so the select is rebuilt a few times before giving up.
for(const delay of [400,1200,3000])setTimeout(populateVoices,delay);
applyLanguage();showView(settings.onboarded||hasTranslator()?"practice":"onboard");migrateStore().then(repairReversedCards).catch(()=>{});refreshDueBadge();setupRecognition();updateInstallUI();if(new URLSearchParams(location.search).get("view")==="review")showView("review");
// The in-app WaniKani sync is gone (the pull tool feeds the stories instead);
// what it left in a browser is cleared once, quietly.
try{localStorage.removeItem("jp-echo-wanikani-token");indexedDB.deleteDatabase("jp-echo-wanikani")}catch{}
if("serviceWorker"in navigator){navigator.serviceWorker.register("./sw.js");writeReminderPrefs();syncReminderSchedule();remindOnOpen()}
