import {createSentence,exportBackup,mergeSentences,normalizeFurigana,rubyHtml,stripFurigana} from "./core.js";
import {isExactMatch,markAttempt,markTarget} from "./diff.js";
import {deleteSentence,getSentence,listSentences,replaceAll,saveSentence} from "./db.js";
import {PROVIDER_DEFAULTS,translate} from "./api.js";
import {japaneseVoices,recognitionFactory,ShadowLoop} from "./speech.js";
import {downloadAnkiDeck} from "./anki-export.js";
import {dueSentences,ensureSchedule,isDue,reviewSentence} from "./srs.js";
import {DEFAULT_TIME,REMINDER_TAG,reminderText,shouldRemind} from "./reminders.js";
const $=selector=>document.querySelector(selector);
const settings=JSON.parse(localStorage.getItem("jp-echo-settings")||"{}");
let current=null,detail=null,translationFailure=null,voiceFailed=false,echoesAtCardStart=0,voices=[],installPrompt=null,reviewQueue=[],reviewIndex=0,reviewRevealed=false,reviewRecognition=null,reviewListening=false;
const loop=new ShadowLoop({onEcho:async()=>{const reviewing=!$("#review-view").hidden,viewingDetail=!$("#sentence-view").hidden,target=reviewing?reviewQueue[reviewIndex]:viewingDetail?detail:current;if(!target)return;target.echoCount=(Number(target.echoCount)||0)+1;target.updatedAt=new Date().toISOString();await saveSentence(target);if(reviewing){reviewQueue[reviewIndex]=target;tickCount($("#review-echo-count"),target.echoCount)}if(viewingDetail)tickCount($("#stat-echoes"),target.echoCount);if(current?.id===target.id){current=target;renderCount()}},onState:state=>{const label=({speaking:"Playing — say it with the voice",imitate:"Your turn — echo it",paused:"Paused",stopped:"Ready",error:"That voice could not play"})[state]||state,playing=state!=="stopped"&&state!=="error",text=state==="paused"?"Play":playing?"Pause":"Play";$("#review-loop-state").textContent=label;$("#sentence-loop-state").textContent=label;const active=playing&&state!=="paused";for(const echo of document.querySelectorAll(".arcs:not(.small)>.echo"))echo.classList.toggle("is-playing",active);$("#practice").classList.toggle("playing",active);$("#review-panel").classList.toggle("playing",active);$("#loop-state").textContent=label;$("#play-pause").textContent=text;$("#play-pause").setAttribute("aria-pressed",String(playing));$("#review-audio").textContent=state==="paused"||!playing?"Play the loop":"Pause the loop";$("#review-audio").setAttribute("aria-pressed",String(playing));
  $("#sentence-play").setAttribute("aria-pressed",String(playing));$("#sentence-play").lastChild.textContent=state==="paused"||!playing?"Play the loop":"Pause the loop";$("#sentence-view").classList.toggle("playing",active);
  // The voice notice follows what playback actually did, so it appears for a
  // device that truly cannot speak and clears the moment one does.
  if(state==="error"||state==="speaking"){const failed=state==="error";if(failed!==voiceFailed){voiceFailed=failed;if(!$("#main-view").hidden)renderPracticeNotices()}}}});
// Appearance > Motion. "system" sets no class and lets the device decide;
// "on" and "off" say so outright, which is the only way to keep the motion
// on a phone whose battery saver has switched the whole OS to reduced.
function applyMotion(motion=settings.motion||"system"){const root=document.documentElement;
  root.classList.toggle("motion-on",motion==="on");root.classList.toggle("motion-off",motion==="off")}
function applyTheme(theme=settings.theme||"system"){document.documentElement.dataset.theme=theme;const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);const metas=document.querySelectorAll('meta[name="theme-color"]');
  // Two metas let the system default follow prefers-color-scheme; an explicit
  // choice overrides both so the status bar never disagrees with the app.
  if(theme==="system"){metas[0].content="#F3F0E7";if(metas[1])metas[1].content="#191712"}
  else for(const meta of metas)meta.content=dark?"#191712":"#F3F0E7"}
function showProviderConfig(){const provider=$("#provider").value;document.querySelectorAll(".provider-config").forEach(node=>node.hidden=node.dataset.provider!==provider)}
function saveSettings(){settings.provider=$("#provider").value;settings.providerKeys={deepseek:$("#deepseek-key").value.trim(),google:$("#google-key").value.trim(),openai:$("#openai-key").value.trim(),anthropic:$("#anthropic-key").value.trim()};settings.providerModels={deepseek:$("#deepseek-model").value.trim(),google:$("#google-model").value.trim(),openai:$("#openai-model").value.trim(),anthropic:$("#anthropic-model").value.trim(),local:$("#local-model").value.trim()};settings.localEndpoint=$("#local-endpoint").value.trim();settings.proxyUrl=$("#proxy-url").value.trim();settings.theme=$("#theme").value;settings.motion=$("#motion").value;settings.voice=$("#voice").value;settings.rate=Number($("#rate").value);settings.showEnglish=$("#show-english").checked;settings.showFurigana=$("#show-furigana").checked;settings.showPolite=$("#show-polite").checked;settings.autoListen=$("#autolisten").checked;settings.remindTime=$("#remind-time").value;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));applyTheme();applyMotion()}
function resetSettingsForm(){const keys=settings.providerKeys||{},models=settings.providerModels||{};$("#provider").value=settings.provider||"google";$("#deepseek-key").value=keys.deepseek||settings.apiKey||"";$("#google-key").value=keys.google||"";$("#openai-key").value=keys.openai||"";$("#anthropic-key").value=keys.anthropic||"";for(const provider of Object.keys(PROVIDER_DEFAULTS))$("#"+provider+"-model").value=models[provider]||PROVIDER_DEFAULTS[provider];$("#local-endpoint").value=settings.localEndpoint||"http://localhost:11434/v1/chat/completions";$("#proxy-url").value=settings.proxyUrl||"";$("#theme").value=settings.theme||"system";$("#motion").value=settings.motion||"system";$("#autolisten").checked=settings.autoListen!==false;$("#remind").checked=!!settings.remind;$("#remind-time").value=settings.remindTime||DEFAULT_TIME;$("#remind-reach").textContent=settings.remind?reminderReach():"";$("#voice").value=settings.voice||"0";$("#rate").value=settings.rate||1;$("#rate-value").textContent=Number($("#rate").value).toFixed(1)+"×";showProviderConfig()}
function openSettings(){resetSettingsForm();updateInstallUI();$("#settings-dialog").showModal()}
function cancelSettings(){settings.remind=!!JSON.parse(localStorage.getItem("jp-echo-settings")||"{}").remind;resetSettingsForm();applyTheme();applyMotion();$("#settings-dialog").close()}
function isInstalled(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true}
function updateInstallUI(){const installed=isInstalled();$("#install-app").disabled=installed;$("#install-app").textContent=installed?"Installed":"Install";$("#install-status").textContent=installed?"Opened as an installed app.":""}
async function installApp(){if(isInstalled())return updateInstallUI();if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;$("#install-status").textContent=choice.outcome==="accepted"?"Installation started.":"Installation was cancelled.";return updateInstallUI()}$("#install-status").textContent=/iphone|ipad|ipod/i.test(navigator.userAgent)?"In Safari, tap Share, then Add to Home Screen.":"Open the browser menu and choose Install app or Add to Home screen."}
// The class comes off on animationend, as the spec asks, so a count that
// ticks twice in a row restarts the animation instead of swallowing it.
function tickCount(node,value){const text=String(value);if(!node||node.textContent===text)return;node.textContent=text;node.classList.remove("just-ticked");void node.offsetWidth;node.classList.add("just-ticked");node.addEventListener("animationend",()=>node.classList.remove("just-ticked"),{once:true})}
function renderCount(){tickCount($("#echo-count"),current?.echoCount??0)}
function selectedJapanese(){const polite=$("#show-polite").checked;return polite?(current.politeJapanese||current.japanese):(current.casualJapanese||current.japanese)}
function selectedPlainJapanese(){const polite=$("#show-polite").checked;return polite?(current.plainPoliteJapanese||current.plainJapanese):(current.plainCasualJapanese||current.plainJapanese)}
function resetSession(){loop.stop()}
function renderSentence(){const panel=$("#practice");panel.hidden=!current;$("#welcome").hidden=!!current;document.body.classList.toggle("has-sentence",!!current);if(!current)return;$("#japanese").innerHTML=rubyHtml(selectedJapanese());$("#english-display").textContent=current.english;$("#english-display").hidden=!$("#show-english").checked;panel.classList.toggle("hide-furigana",!$("#show-furigana").checked);renderCount();populateVoices()}
function openSentence(sentence){resetSession();current=sentence;$("#english-input").value=sentence.english;showView("practice");renderSentence()}
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
  $("#welcome-lede").textContent=connected?"Enter one English sentence below to start a shadowing loop.":"Add a translator and this starts working.";
  $("#english-input").disabled=!connected;$("#translate").disabled=!connected;$("#microphone").disabled=!connected;
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
  // fingerprinting protection hand back an empty list on purpose. Echo asks the
  // platform for ja-JP and lets it choose, rather than refusing to try.
  else if(voiceFailed)host.append(notice({icon:"voice",title:"That voice could not play",
    copy:"Echo speaks with your device's own voices. If nothing is heard, add a Japanese voice in your system settings, then come back."}))}
const wide=matchMedia("(min-width:1024px)");
const isWide=()=>wide.matches;
const VIEW_TITLES={review:"Review",library:"Library"};
function showView(name){if(name!=="practice")resetSession();speechSynthesis.cancel();
  $("#main-view").hidden=name!=="practice";$("#review-home").hidden=name!=="review";$("#history-view").hidden=!(name==="library"||(name==="sentence"&&isWide()));$("#review-view").hidden=name!=="session";$("#sentence-view").hidden=name!=="sentence";$("#onboard-view").hidden=name!=="onboard";$("#setup-view").hidden=name!=="setup";
  const solo=name==="onboard"||name==="setup"||((name==="session"||name==="sentence")&&!isWide());document.querySelector("header").hidden=solo;$("#tabs").hidden=solo;
  $("#view-title").textContent=VIEW_TITLES[name]||"";$("#view-title").hidden=!VIEW_TITLES[name];document.querySelector(".brand").hidden=!!VIEW_TITLES[name];
  for(const tab of document.querySelectorAll(".tab[data-view]")){const on=tab.dataset.view===name||(name==="session"&&tab.dataset.view==="review")||(name==="sentence"&&tab.dataset.view==="library");tab.classList.toggle("current",on);tab.setAttribute("aria-current",on?"page":"false")}
  document.body.dataset.view=name;scrollTo(0,0);renderSidePanel();
  if(name==="library"||(name==="sentence"&&isWide()))renderHistory();else if(name==="review")renderReviewHome();else if(name==="practice")renderPracticeNotices();else if(name==="setup")resetSetupForm()}
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
    li.innerHTML='<button type="button"><span lang="ja">'+escapeText(item.plainJapanese||stripFurigana(item.japanese))+'</span><span class="en">'+escapeText(item.english)+"</span></button>";
    li.querySelector("button").onclick=()=>openDetail(item.id);
    return li}));}
function renderQueuePanel(){
  $("#queue-list").replaceChildren(...reviewQueue.map((item,index)=>{const li=document.createElement("li");
    li.className=index===reviewIndex?"now":index<reviewIndex?"done":"";
    li.innerHTML='<span class="dot" aria-hidden="true"></span><span class="en">'+escapeText(item.english)+"</span>";
    return li}));
  const left=Math.max(0,reviewQueue.length-reviewIndex),done=reviewIndex;
  $("#queue-note").textContent=left?(done?spell(done)+" done. ":"")+"About "+spell(Math.max(1,Math.round(left*.55)))+" minutes left at your pace.":"All said.";}
const escapeText=value=>{const node=document.createElement("span");node.textContent=value;return node.innerHTML};
const CARD_STATES={due:"Due now",new:"New",learning:"Learning",review:"Review"};
const ORDER_LABELS={"created-desc":"Newest first","created-asc":"Oldest first","echoes-desc":"Most echoes","echoes-asc":"Fewest echoes","due-desc":"Furthest away","due-asc":"Due soonest","english-desc":"English Z–A","english-asc":"English A–Z","japanese-desc":"Japanese Z–A","japanese-asc":"Japanese A–Z"};
function cardState(item,now=Date.now()){const state=item.srs?.state??0;if(!item.srs?.due||Date.parse(item.srs.due)<=now)return "due";if(state===0)return "new";if(state===1||state===3)return "learning";return "review"}
async function renderHistory(){const all=await listSentences(),list=$("#history-list"),due=dueSentences(all),query=$("#history-search").value.trim().toLocaleLowerCase(),filter=$("#history-filter").value,order=$("#history-order").value,direction=$("#history-direction").value,now=Date.now();let items=all.filter(item=>{const haystack=[item.english,item.japanese,item.plainJapanese,item.casualJapanese,item.politeJapanese].filter(Boolean).join(" ").toLocaleLowerCase();if(query&&!haystack.includes(query))return false;const state=item.srs?.state??0;if(filter==="due")return !item.srs?.due||Date.parse(item.srs.due)<=now;if(filter==="new")return state===0;if(filter==="learning")return state===1||state===3;if(filter==="review")return state===2;return true});const comparators={created:(a,b)=>a.createdAt.localeCompare(b.createdAt),echoes:(a,b)=>(Number(a.echoCount)||0)-(Number(b.echoCount)||0),due:(a,b)=>Date.parse(a.srs?.due||a.createdAt)-Date.parse(b.srs?.due||b.createdAt),english:(a,b)=>a.english.localeCompare(b.english),japanese:(a,b)=>(a.plainJapanese||a.japanese).localeCompare(b.plainJapanese||b.japanese,"ja")},factor=direction==="asc"?1:-1;items.sort((a,b)=>factor*(comparators[order]||comparators.created)(a,b));list.replaceChildren();$("#empty-history").hidden=all.length>0;$("#empty-results").hidden=all.length===0||items.length>0;$("#empty-results-count").textContent=all.length===1?"One is in your library.":capitalise(spell(all.length))+" are in your library.";updateDueBadge(due.length);$("#library-count").textContent=items.length===1?"1 sentence":items.length+" sentences";$("#library-order-label").textContent=ORDER_LABELS[order+"-"+direction]||"";$(".list-head").hidden=items.length===0;if(isWide()&&!detail&&items.length)return openDetail(items[0].id);
  for(const item of items){const li=document.createElement("li");li.dataset.id=item.id;const state=cardState(item,now);li.innerHTML='<button class="history-open" type="button"><span class="lines"><span lang="ja">'+rubyHtml(item.japanese)+'</span><span class="en">'+escapeText(item.english)+'</span><span class="status-chip '+state+'">'+CARD_STATES[state]+'</span></span><span class="tally"><strong>'+(Number(item.echoCount)||0)+'</strong><span>echoes</span></span></button>';li.querySelector(".history-open").onclick=()=>openDetail(item.id);list.append(li)}markSelectedRow()}
const formatDate=value=>new Intl.DateTimeFormat(undefined,{day:"numeric",month:"long"}).format(new Date(value));
const RATING_LABELS={again:"Again",ok:"OK"};
function untilDue(sentence,now=Date.now()){const due=Date.parse(sentence.srs?.due||"");if(!Number.isFinite(due)||due<=now)return "Now";
  const minutes=Math.round((due-now)/60000);if(minutes<60)return minutes+"m";const hours=Math.round(minutes/60);if(hours<24)return hours+"h";return Math.round(hours/24)+"d"}
async function openDetail(id){const sentence=await getSentence(id);if(!sentence)return showView("library");resetSession();detail=ensureSchedule(sentence);showView("sentence");renderDetail()}
function markSelectedRow(){for(const li of document.querySelectorAll("#history-list li"))li.classList.toggle("selected",li.dataset.id===detail?.id);}
function renderDetail(){if(!detail)return;closeEditor();markSelectedRow();
  $("#sentence-added").textContent="Added "+formatDate(detail.createdAt);
  $("#sentence-japanese").innerHTML=rubyHtml(detail.japanese);
  $("#sentence-english").textContent=detail.english;
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
function openEditor(){if(!detail)return;resetSession();$("#sentence-draft").value=detail.japanese;$("#sentence-edit-error").hidden=true;$("#sentence-editor").hidden=false;$("#sentence-japanese").hidden=true;$("#sentence-english").hidden=true;$(".sentence-controls").hidden=true;$("#sentence-draft").focus()}
function closeEditor(){$("#sentence-editor").hidden=true;$("#sentence-japanese").hidden=false;$("#sentence-english").hidden=false;$(".sentence-controls").hidden=false}
async function saveEdit(event){event.preventDefault();if(!detail)return;
  const japanese=normalizeFurigana($("#sentence-draft").value.trim());
  if(!japanese||!/[\u3040-\u30ff\u3400-\u9fff]/.test(japanese)){$("#sentence-edit-error").textContent="That needs to be a Japanese sentence.";$("#sentence-edit-error").hidden=false;return}
  const plain=stripFurigana(japanese).trim();
  detail={...detail,japanese,plainJapanese:plain,casualJapanese:japanese,plainCasualJapanese:plain,politeJapanese:japanese,plainPoliteJapanese:plain,updatedAt:new Date().toISOString()};
  await saveSentence(detail);if(current?.id===detail.id){current=detail;renderSentence()}renderDetail()}
function playDetail(){if(!detail)return;if(loop.running){loop.togglePause();return}
  const voice=voices[Number($("#voice").value)]||voices[0]||null;loop.play(detail.plainJapanese||stripFurigana(detail.japanese),{voice,rate:Number($("#rate").value)})}
function askDelete(){if(!detail)return;
  $("#delete-quote").innerHTML=rubyHtml(detail.japanese);
  const echoes=Number(detail.echoCount)||0,reviews=Array.isArray(detail.reviews)?detail.reviews.length:0;
  const say=echoes<=10&&reviews<=10?spell:String;
  $("#delete-copy").textContent="It leaves your library, its place in the review queue, and every export from here on. "+
    (echoes||reviews?capitalise(say(echoes))+(echoes===1?" echo":" echoes")+" and "+say(reviews)+(reviews===1?" review":" reviews")+" go with it. ":"")+"There is no undo.";
  $("#delete-dialog").showModal()}
async function confirmDelete(){if(!detail)return;const id=detail.id;$("#delete-dialog").close();resetSession();
  await deleteSentence(id);if(current?.id===id){current=null;renderSentence()}
  reviewQueue=reviewQueue.filter(item=>item.id!==id);detail=null;refreshDueBadge();showView("library")}
const capitalise=value=>value.charAt(0).toUpperCase()+value.slice(1);
function resetSetupForm(){const provider=settings.provider||"google";$("#setup-provider").value=provider;showSetupFields()}
function showSetupFields(){const provider=$("#setup-provider").value,local=provider==="local";
  $("#setup-key-field").hidden=local;$("#setup-endpoint-field").hidden=!local;
  $("#setup-hint").textContent=local?"Echo talks to an OpenAI-compatible server — Ollama or LM Studio — running on your machine."
    :provider==="google"?"Google AI Studio gives you a key with your Google account, on a free tier. No card, no billing account."
    :"Your service gives you a key in its own dashboard, usually under API keys.";
  const link=$("#setup-key-link"),url=PROVIDER_KEY_URLS[provider];
  link.hidden=!url;if(url){link.href=url;link.textContent="Create a "+PROVIDER_NAMES[provider]+" key"}
  link.parentElement.hidden=!url}
function saveSetup(){const provider=$("#setup-provider").value;
  settings.provider=provider;
  if(provider==="local")settings.localEndpoint=$("#setup-endpoint").value.trim();
  else settings.providerKeys={...(settings.providerKeys||{}),[provider]:$("#setup-key").value.trim()};
  finishOnboarding()}
function finishOnboarding(){settings.onboarded=true;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));resetSettingsForm();showView("practice")}
async function performTranslation(){const english=$("#english-input").value.trim();if(!english)return setStatus("Enter an English sentence.",true);const provider=settings.provider||"google";if(!hasTranslator())return showView("setup");
  // Swap the label's text, not the button's: textContent would take the arrow
  // icon and the .label span with it, and they never came back — after one
  // translation the button was bare text that no longer answered the rule
  // hiding the word on a phone.
  const button=$("#translate"),label=button.querySelector(".label"),previous=label.textContent;button.disabled=true;label.textContent="Translating…";button.setAttribute("aria-busy","true");setStatus("Translating…");try{translationFailure=null;const japanese=await translate(english,settings);resetSession();current=ensureSchedule(createSentence(english,japanese));current.translationProvider=provider;await saveSentence(current);renderSentence();refreshDueBadge();setStatus("Ready to practice.")}catch(error){const name=PROVIDER_NAMES[provider]||provider;
    translationFailure={title:/\b(401|403|402|key|credit|quota)\b/i.test(error.message||"")?name+" turned the request down":"Translation failed",
      copy:(error.message||"The request did not get through.")+" Your sentence is still in the box."};
    setStatus("");renderPracticeNotices()}finally{button.disabled=false;label.textContent=previous;button.removeAttribute("aria-busy")}}
function setStatus(message,error=false){$("#status").textContent=message;$("#status").classList.toggle("error",error)}
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
function populateVoices(){voices=japaneseVoices();const select=$("#voice"),previous=settings.voice;select.replaceChildren(...voices.map((voice,index)=>{const option=new Option(voice.name+" ("+voice.lang+")",String(index));option.selected=previous===String(index);return option}));$("#voice-warning").hidden=voices.length>0;$("#play-pause").disabled=!current;if(!$("#main-view").hidden)renderPracticeNotices()}
const DICTATION={
  listening:"Listening — keep going",
  unavailable:"Dictation isn't available in this browser — type it instead.",
  "not-allowed":"Microphone blocked — type it instead.",
  "no-speech":"Nothing heard — tap the mic or type it.",
  "audio-capture":"No microphone available — type it instead.",
  failed:"Dictation failed — type it instead."};
const dictationError=error=>DICTATION[error]||DICTATION.failed;
// Append rather than replace, so a second burst adds to what you already said
// instead of throwing it away.
const appendHeard=(field,heard)=>{field.value=(field.value?field.value.trimEnd()+" "+heard:heard).trim()};
function setupRecognition(){const recognition=recognitionFactory(),mic=$("#microphone"),status=$("#voice-input-status");
  if(!recognition){mic.disabled=true;status.textContent=DICTATION.unavailable;return}
  mic.onclick=()=>{status.textContent=DICTATION.listening;mic.classList.add("is-listening");try{recognition.start()}catch{}};
  recognition.onresult=event=>{appendHeard($("#english-input"),event.results[0][0].transcript);status.textContent="Edit anything it mishears before you translate."};
  recognition.onerror=event=>{status.textContent=dictationError(event.error)};
  recognition.onend=()=>{mic.classList.remove("is-listening");if(status.textContent===DICTATION.listening)status.textContent=""}}
async function startReview(){const items=await listSentences(),scheduled=items.map(item=>ensureSchedule(item));await Promise.all(scheduled.filter((item,index)=>item!==items[index]).map(saveSentence));reviewQueue=dueSentences(scheduled);reviewIndex=0;if(!reviewQueue.length)return showView("review");showView("session");renderReview()}
function reviewJapanese(sentence){return settings.showPolite?(sentence.politeJapanese||sentence.japanese):(sentence.casualJapanese||sentence.japanese)}
function reviewPlainJapanese(sentence){return settings.showPolite?(sentence.plainPoliteJapanese||sentence.plainJapanese):(sentence.plainCasualJapanese||sentence.plainJapanese)}
const STAGE_LABELS={0:"New",1:"Learning",2:"Review",3:"Relearning"};
function stageLabel(sentence){const state=sentence.srs?.state??0,reps=Number(sentence.srs?.reps)||0;return STAGE_LABELS[state]+(reps?" · seen "+reps+(reps===1?" time":" times"):"")}
function stageClass(sentence){const state=sentence.srs?.state??0;return state===0?"new":state===2?"review":"learning"}
function renderReview(){resetSession();stopReviewListening();const sentence=reviewQueue[reviewIndex],complete=!sentence;
  $("#review-panel").hidden=complete;$("#review-prompt-actions").hidden=complete;$("#review-actions").hidden=true;$("#review-complete").hidden=!complete;
  $("#review-progress").textContent=complete?`${reviewQueue.length} / ${reviewQueue.length}`:`${reviewIndex+1} / ${reviewQueue.length}`;
  renderSidePanel();$("#review-progress-bar").style.width=(reviewQueue.length?Math.round((complete?reviewQueue.length:reviewIndex)/reviewQueue.length*100):0)+"%";
  if(complete)return renderReviewComplete();
  reviewRevealed=false;
  $("#review-stage").textContent=stageLabel(sentence);$("#review-stage").className="status-chip "+stageClass(sentence);
  $("#review-prompt").textContent=sentence.english;$("#review-prompt").hidden=false;$("#review-prompt-echo").textContent=sentence.english;
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
function reviewRecognitionLang(){return "ja-JP"}
function startReviewListening(){if(reviewListening)return;
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
function playReviewAudio(){const sentence=reviewQueue[reviewIndex];if(!sentence)return;if(loop.running){loop.togglePause();return}const voice=voices[Number($("#voice").value)]||voices[0]||null;loop.play(reviewPlainJapanese(sentence)||reviewJapanese(sentence).replace(/【[^】]+】/g,""),{voice,rate:Number($("#rate").value)})}
async function rateReview(rating){const sentence=reviewQueue[reviewIndex];if(!sentence||!reviewRevealed)return;resetSession();const graded=reviewSentence(sentence,rating);
  const updated={...graded,reviews:[...(Array.isArray(sentence.reviews)?sentence.reviews:[]),{at:new Date().toISOString(),rating,echoes:Math.max(0,(Number(sentence.echoCount)||0)-echoesAtCardStart)}]};await saveSentence(updated);if(current?.id===updated.id)current=updated;reviewQueue[reviewIndex]=updated;reviewIndex++;renderReview()}
async function exportHistory(){const data=exportBackup(await listSentences(),settings),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),link=Object.assign(document.createElement("a"),{href:url,download:"jp-echo-backup.json"});link.click();URL.revokeObjectURL(url)}
async function exportAnki(button=$("#export-anki")){const items=await listSentences();const label=button.textContent;button.disabled=true;button.textContent="Building deck…";$("#anki-status").textContent="Creating JP Echo.apkg on this device…";try{await downloadAnkiDeck(items);$("#open-anki").hidden=false;const launched=openAnki(true);$("#anki-status").textContent=launched?"JP Echo.apkg downloaded. Opening Anki… If it stays here, tap Open Anki.":"JP Echo.apkg downloaded. Open it from Downloads to import it into Anki."}catch(error){$("#anki-status").textContent=error.message||"Anki export failed."}finally{button.disabled=false;button.textContent=label}}
function openAnki(automatic=false){const android=/android/i.test(navigator.userAgent),ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if(android){window.location.href="intent:#Intent;package=com.ichi2.anki;end";return true}if(ios){window.location.href="anki://";return true}if(!automatic)$("#anki-status").textContent="Open JP Echo.apkg from your Downloads folder to import it into Anki.";return false}
async function importHistory(file){if(!file)return;try{const backup=JSON.parse(await file.text());if(backup.schemaVersion!==1||!Array.isArray(backup.sentences))throw new Error("Unsupported backup.");const merged=mergeSentences(await listSentences(),backup.sentences);await replaceAll(merged);setStatus("Imported "+backup.sentences.length+" sentence(s).");renderHistory()}catch(error){setStatus(error.message||"Import failed.",true)}}
for(const tab of document.querySelectorAll(".tab[data-view]"))tab.onclick=()=>showView(tab.dataset.view);$("#translate").onclick=performTranslation;$("#english-input").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")performTranslation()};$("#play-pause").onclick=()=>{if(!current)return;if(loop.running){loop.togglePause();return}const voice=voices[Number($("#voice").value)]||voices[0]||null;loop.play(selectedPlainJapanese(),{voice,rate:Number($("#rate").value)})};$("#show-english").onchange=()=>{saveSettings();renderSentence()};$("#show-furigana").onchange=()=>{saveSettings();renderSentence()};$("#show-polite").onchange=()=>{resetSession();saveSettings();renderSentence()};$("#rate").oninput=()=>{const rate=Number($("#rate").value);$("#rate-value").textContent=rate.toFixed(1)+"×";resetSession();loop.setRate(rate)};$("#settings-button").onclick=()=>$("#settings-dialog").showModal();$("#close-settings").onclick=()=>{saveSettings();$("#settings-dialog").close();renderPracticeNotices();writeReminderPrefs();syncReminderSchedule()};
$("#remind").onchange=async()=>{const wanted=$("#remind").checked;
  if(wanted&&!await enableReminders()){$("#remind").checked=false;$("#remind-hint").textContent="Notifications are blocked for Echo. Allow them in your browser settings, then turn this on again.";$("#remind-hint").classList.add("error");$("#remind-reach").textContent="";return}
  $("#remind-hint").textContent="Your device asks permission the first time you turn this on.";$("#remind-hint").classList.remove("error");
  settings.remind=wanted;$("#remind-reach").textContent=wanted?reminderReach():""};$("#export-anki").onclick=()=>exportAnki($("#export-anki"));$("#open-anki").onclick=()=>openAnki();$("#export").onclick=exportHistory;$("#import").onclick=()=>$("#import-file").click();$("#import-file").onchange=event=>importHistory(event.target.files[0]);
$("#onboard-start").onclick=()=>showView("setup");$("#onboard-restore").onclick=()=>{finishOnboarding();showView("library");$("#import-file").click()};
$("#setup-back").onclick=()=>showView(settings.onboarded?"practice":"onboard");$("#setup-provider").onchange=showSetupFields;$("#setup-save").onclick=saveSetup;$("#setup-skip").onclick=finishOnboarding;
$("#clear-filters").onclick=()=>{$("#history-search").value="";$("#clear-history-search").hidden=true;$("#history-filter").value="all";settings.historyFilter="all";localStorage.setItem("jp-echo-settings",JSON.stringify(settings));renderHistory()};
addEventListener("online",renderPracticeNotices);addEventListener("offline",renderPracticeNotices);
$("#sentence-back").onclick=()=>{detail=null;showView("library")};$("#sentence-play").onclick=playDetail;$("#sentence-edit").onclick=openEditor;$("#sentence-cancel").onclick=closeEditor;$("#sentence-editor").onsubmit=saveEdit;
$("#sentence-delete").onclick=askDelete;$("#delete-cancel").onclick=()=>$("#delete-dialog").close();$("#delete-confirm").onclick=confirmDelete;$("#delete-dialog").onclick=event=>{if(event.target===$("#delete-dialog"))$("#delete-dialog").close()};
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
$("#settings-button").onclick=openSettings;$("#settings-nav").onclick=openSettings;$("#dismiss-settings").onclick=cancelSettings;$("#cancel-settings").onclick=cancelSettings;$("#install-app").onclick=installApp;$("#settings-dialog").addEventListener("cancel",event=>{event.preventDefault();cancelSettings()});$("#settings-dialog").onclick=event=>{if(event.target===$("#settings-dialog"))cancelSettings()};$("#voice").onchange=resetSession;$("#provider").onchange=showProviderConfig;$("#theme").onchange=()=>applyTheme($("#theme").value);$("#motion").onchange=()=>applyMotion($("#motion").value);window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;updateInstallUI()});window.addEventListener("appinstalled",()=>{installPrompt=null;updateInstallUI()});
$("#history-search").oninput=()=>{$("#clear-history-search").hidden=!$("#history-search").value;renderHistory()};$("#clear-history-search").onclick=()=>{$("#history-search").value="";$("#clear-history-search").hidden=true;$("#history-search").focus();renderHistory()};for(const id of ["#history-filter","#history-order","#history-direction"]){$(id).onchange=()=>{settings.historyFilter=$("#history-filter").value;settings.historyOrder=$("#history-order").value;settings.historyDirection=$("#history-direction").value;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));renderHistory()}}
const legacyOrders={newest:["created","desc"],oldest:["created","asc"],echoes:["echoes","desc"],due:["due","asc"]},legacy=legacyOrders[settings.historyOrder];if(legacy){settings.historyOrder=legacy[0];settings.historyDirection=settings.historyDirection||legacy[1]}resetSettingsForm();applyTheme();applyMotion();$("#show-english").checked=settings.showEnglish??false;$("#show-furigana").checked=settings.showFurigana??true;$("#show-polite").checked=settings.showPolite??false;$("#history-filter").value=settings.historyFilter||"all";$("#history-order").value=settings.historyOrder||"created";$("#history-direction").value=settings.historyDirection||"desc";speechSynthesis.onvoiceschanged=populateVoices;populateVoices();renderVoiceHelp();
// Android fills the voice list after the page has settled and does not always
// fire voiceschanged, so the select is rebuilt a few times before giving up.
for(const delay of [400,1200,3000])setTimeout(populateVoices,delay);
showView(settings.onboarded||hasTranslator()?"practice":"onboard");refreshDueBadge();setupRecognition();updateInstallUI();if(new URLSearchParams(location.search).get("view")==="review")showView("review");
if("serviceWorker"in navigator){navigator.serviceWorker.register("./sw.js");writeReminderPrefs();syncReminderSchedule();remindOnOpen()}
