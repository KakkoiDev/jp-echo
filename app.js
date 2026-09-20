import {createSentence,exportBackup,mergeSentences,normalizeFurigana,rubyHtml,stripFurigana} from "./core.js";
import {isExactMatch,markAttempt,markTarget} from "./diff.js";
import {deleteSentence,getSentence,listSentences,replaceAll,saveSentence} from "./db.js";
import {PROVIDER_DEFAULTS,translate} from "./api.js";
import {japaneseVoices,recognitionFactory,ShadowLoop} from "./speech.js";
import {downloadAnkiDeck} from "./anki-export.js";
import {dueSentences,ensureSchedule,isDue,reviewSentence} from "./srs.js";
const $=selector=>document.querySelector(selector);
const settings=JSON.parse(localStorage.getItem("jp-echo-settings")||"{}");
let current=null,detail=null,translationFailure=null,echoesAtCardStart=0,voices=[],installPrompt=null,reviewQueue=[],reviewIndex=0,reviewRevealed=false,reviewRecognition=null,reviewListening=false;
const loop=new ShadowLoop({onEcho:async()=>{const reviewing=!$("#review-view").hidden,viewingDetail=!$("#sentence-view").hidden,target=reviewing?reviewQueue[reviewIndex]:viewingDetail?detail:current;if(!target)return;target.echoCount=(Number(target.echoCount)||0)+1;target.updatedAt=new Date().toISOString();await saveSentence(target);if(reviewing){reviewQueue[reviewIndex]=target;$("#review-echo-count").textContent=String(target.echoCount)}if(viewingDetail)$("#stat-echoes").textContent=String(target.echoCount);if(current?.id===target.id){current=target;renderCount()}},onState:state=>{const label=({speaking:"Listen…",imitate:"Your turn—echo it.",paused:"Paused",stopped:"Ready",error:"Speech could not be played."})[state]||state,playing=state!=="stopped"&&state!=="error",text=state==="paused"?"Play":playing?"Pause":"Play";$("#review-loop-state").textContent=label;$("#sentence-loop-state").textContent=label;const active=playing&&state!=="paused";$("#practice").classList.toggle("playing",active);$("#review-panel").classList.toggle("playing",active);$("#loop-state").textContent=label;$("#play-pause").textContent=text;$("#play-pause").setAttribute("aria-pressed",String(playing));$("#review-audio").textContent=state==="paused"||!playing?"Play the loop":"Pause the loop";$("#review-audio").setAttribute("aria-pressed",String(playing));$("#sentence-play").setAttribute("aria-pressed",String(playing))}});
function applyTheme(theme=settings.theme||"system"){document.documentElement.dataset.theme=theme;const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.querySelector('meta[name="theme-color"]').content=dark?"#191712":"#F3F0E7"}
function showProviderConfig(){const provider=$("#provider").value;document.querySelectorAll(".provider-config").forEach(node=>node.hidden=node.dataset.provider!==provider)}
function saveSettings(){settings.provider=$("#provider").value;settings.providerKeys={deepseek:$("#deepseek-key").value.trim(),google:$("#google-key").value.trim(),openai:$("#openai-key").value.trim(),anthropic:$("#anthropic-key").value.trim()};settings.providerModels={deepseek:$("#deepseek-model").value.trim(),google:$("#google-model").value.trim(),openai:$("#openai-model").value.trim(),anthropic:$("#anthropic-model").value.trim(),local:$("#local-model").value.trim()};settings.localEndpoint=$("#local-endpoint").value.trim();settings.proxyUrl=$("#proxy-url").value.trim();settings.theme=$("#theme").value;settings.voice=$("#voice").value;settings.rate=Number($("#rate").value);settings.showEnglish=$("#show-english").checked;settings.showFurigana=$("#show-furigana").checked;settings.showPolite=$("#show-polite").checked;settings.autoListen=$("#autolisten").checked;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));applyTheme()}
function resetSettingsForm(){const keys=settings.providerKeys||{},models=settings.providerModels||{};$("#provider").value=settings.provider||"deepseek";$("#deepseek-key").value=keys.deepseek||settings.apiKey||"";$("#google-key").value=keys.google||"";$("#openai-key").value=keys.openai||"";$("#anthropic-key").value=keys.anthropic||"";for(const provider of Object.keys(PROVIDER_DEFAULTS))$("#"+provider+"-model").value=models[provider]||PROVIDER_DEFAULTS[provider];$("#local-endpoint").value=settings.localEndpoint||"http://localhost:11434/v1/chat/completions";$("#proxy-url").value=settings.proxyUrl||"";$("#theme").value=settings.theme||"system";$("#autolisten").checked=settings.autoListen!==false;$("#voice").value=settings.voice||"0";$("#rate").value=settings.rate||1;$("#rate-value").textContent=Number($("#rate").value).toFixed(1)+"×";showProviderConfig()}
function openSettings(){resetSettingsForm();updateInstallUI();$("#settings-dialog").showModal()}
function cancelSettings(){resetSettingsForm();applyTheme();$("#settings-dialog").close()}
function isInstalled(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true}
function updateInstallUI(){const installed=isInstalled();$("#install-app").disabled=installed;$("#install-app").textContent=installed?"Installed":"Install";$("#install-status").textContent=installed?"Opened as an installed app.":""}
async function installApp(){if(isInstalled())return updateInstallUI();if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;$("#install-status").textContent=choice.outcome==="accepted"?"Installation started.":"Installation was cancelled.";return updateInstallUI()}$("#install-status").textContent=/iphone|ipad|ipod/i.test(navigator.userAgent)?"In Safari, tap Share, then Add to Home Screen.":"Open the browser menu and choose Install app or Add to Home screen."}
function renderCount(){$("#echo-count").textContent=current?.echoCount??0}
function selectedJapanese(){const polite=$("#show-polite").checked;return polite?(current.politeJapanese||current.japanese):(current.casualJapanese||current.japanese)}
function selectedPlainJapanese(){const polite=$("#show-polite").checked;return polite?(current.plainPoliteJapanese||current.plainJapanese):(current.plainCasualJapanese||current.plainJapanese)}
function resetSession(){loop.stop()}
function renderSentence(){const panel=$("#practice");panel.hidden=!current;$("#welcome").hidden=!!current;if(!current)return;$("#japanese").innerHTML=rubyHtml(selectedJapanese());$("#english-display").textContent=current.english;$("#english-display").hidden=!$("#show-english").checked;panel.classList.toggle("hide-furigana",!$("#show-furigana").checked);renderCount();populateVoices()}
function openSentence(sentence){resetSession();current=sentence;$("#english-input").value=sentence.english;showView("practice");renderSentence()}
const PROVIDER_NAMES={deepseek:"DeepSeek",google:"Gemini",openai:"OpenAI",anthropic:"Anthropic",local:"your local model"};
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
  else if(!voices.length)host.append(notice({icon:"voice",title:"No Japanese voice is installed",
    copy:"Echo speaks with your device's own voices. Add a Japanese one in your system settings, then come back."}))}
const VIEW_TITLES={review:"Review",library:"Library"};
function showView(name){if(name!=="practice")resetSession();speechSynthesis.cancel();
  $("#main-view").hidden=name!=="practice";$("#review-home").hidden=name!=="review";$("#history-view").hidden=name!=="library";$("#review-view").hidden=name!=="session";$("#sentence-view").hidden=name!=="sentence";$("#onboard-view").hidden=name!=="onboard";$("#setup-view").hidden=name!=="setup";
  const solo=name==="session"||name==="sentence"||name==="onboard"||name==="setup";document.querySelector("header").hidden=solo;$("#tabs").hidden=solo;
  $("#view-title").textContent=VIEW_TITLES[name]||"";$("#view-title").hidden=!VIEW_TITLES[name];document.querySelector(".brand").hidden=!!VIEW_TITLES[name];
  for(const tab of document.querySelectorAll(".tab[data-view]")){const on=tab.dataset.view===name||(name==="session"&&tab.dataset.view==="review")||(name==="sentence"&&tab.dataset.view==="library");tab.classList.toggle("current",on);tab.setAttribute("aria-current",on?"page":"false")}
  document.body.dataset.view=name;scrollTo(0,0);
  if(name==="library")renderHistory();else if(name==="review")renderReviewHome();else if(name==="practice")renderPracticeNotices();else if(name==="setup")resetSetupForm()}
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
const escapeText=value=>{const node=document.createElement("span");node.textContent=value;return node.innerHTML};
const CARD_STATES={due:"Due now",new:"New",learning:"Learning",review:"Review"};
const ORDER_LABELS={"created-desc":"Newest first","created-asc":"Oldest first","echoes-desc":"Most echoes","echoes-asc":"Fewest echoes","due-desc":"Furthest away","due-asc":"Due soonest","english-desc":"English Z–A","english-asc":"English A–Z","japanese-desc":"Japanese Z–A","japanese-asc":"Japanese A–Z"};
function cardState(item,now=Date.now()){const state=item.srs?.state??0;if(!item.srs?.due||Date.parse(item.srs.due)<=now)return "due";if(state===0)return "new";if(state===1||state===3)return "learning";return "review"}
async function renderHistory(){const all=await listSentences(),list=$("#history-list"),due=dueSentences(all),query=$("#history-search").value.trim().toLocaleLowerCase(),filter=$("#history-filter").value,order=$("#history-order").value,direction=$("#history-direction").value,now=Date.now();let items=all.filter(item=>{const haystack=[item.english,item.japanese,item.plainJapanese,item.casualJapanese,item.politeJapanese].filter(Boolean).join(" ").toLocaleLowerCase();if(query&&!haystack.includes(query))return false;const state=item.srs?.state??0;if(filter==="due")return !item.srs?.due||Date.parse(item.srs.due)<=now;if(filter==="new")return state===0;if(filter==="learning")return state===1||state===3;if(filter==="review")return state===2;return true});const comparators={created:(a,b)=>a.createdAt.localeCompare(b.createdAt),echoes:(a,b)=>(Number(a.echoCount)||0)-(Number(b.echoCount)||0),due:(a,b)=>Date.parse(a.srs?.due||a.createdAt)-Date.parse(b.srs?.due||b.createdAt),english:(a,b)=>a.english.localeCompare(b.english),japanese:(a,b)=>(a.plainJapanese||a.japanese).localeCompare(b.plainJapanese||b.japanese,"ja")},factor=direction==="asc"?1:-1;items.sort((a,b)=>factor*(comparators[order]||comparators.created)(a,b));list.replaceChildren();$("#empty-history").hidden=all.length>0;$("#empty-results").hidden=all.length===0||items.length>0;$("#empty-results-count").textContent=all.length===1?"One is in your library.":capitalise(spell(all.length))+" are in your library.";updateDueBadge(due.length);$("#library-count").textContent=items.length===1?"1 sentence":items.length+" sentences";$("#library-order-label").textContent=ORDER_LABELS[order+"-"+direction]||"";$(".list-head").hidden=items.length===0;for(const item of items){const li=document.createElement("li");const state=cardState(item,now);li.innerHTML='<button class="history-open" type="button"><span class="lines"><span lang="ja">'+rubyHtml(item.japanese)+'</span><span class="en">'+escapeText(item.english)+'</span><span class="status-chip '+state+'">'+CARD_STATES[state]+'</span></span><span class="tally"><strong>'+(Number(item.echoCount)||0)+'</strong><span>echoes</span></span></button>';li.querySelector(".history-open").onclick=()=>openDetail(item.id);list.append(li)}}
const formatDate=value=>new Intl.DateTimeFormat(undefined,{day:"numeric",month:"long"}).format(new Date(value));
const RATING_LABELS={again:"Again",ok:"OK"};
function untilDue(sentence,now=Date.now()){const due=Date.parse(sentence.srs?.due||"");if(!Number.isFinite(due)||due<=now)return "Now";
  const minutes=Math.round((due-now)/60000);if(minutes<60)return minutes+"m";const hours=Math.round(minutes/60);if(hours<24)return hours+"h";return Math.round(hours/24)+"d"}
async function openDetail(id){const sentence=await getSentence(id);if(!sentence)return showView("library");resetSession();detail=ensureSchedule(sentence);showView("sentence");renderDetail()}
function renderDetail(){if(!detail)return;closeEditor();
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
  $("#sentence-play").disabled=!voices.length}
function openEditor(){if(!detail)return;resetSession();$("#sentence-draft").value=detail.japanese;$("#sentence-edit-error").hidden=true;$("#sentence-editor").hidden=false;$("#sentence-japanese").hidden=true;$("#sentence-english").hidden=true;$(".sentence-controls").hidden=true;$("#sentence-draft").focus()}
function closeEditor(){$("#sentence-editor").hidden=true;$("#sentence-japanese").hidden=false;$("#sentence-english").hidden=false;$(".sentence-controls").hidden=false}
async function saveEdit(event){event.preventDefault();if(!detail)return;
  const japanese=normalizeFurigana($("#sentence-draft").value.trim());
  if(!japanese||!/[\u3040-\u30ff\u3400-\u9fff]/.test(japanese)){$("#sentence-edit-error").textContent="That needs to be a Japanese sentence.";$("#sentence-edit-error").hidden=false;return}
  const plain=stripFurigana(japanese).trim();
  detail={...detail,japanese,plainJapanese:plain,casualJapanese:japanese,plainCasualJapanese:plain,politeJapanese:japanese,plainPoliteJapanese:plain,updatedAt:new Date().toISOString()};
  await saveSentence(detail);if(current?.id===detail.id){current=detail;renderSentence()}renderDetail()}
function playDetail(){if(!detail||!voices.length)return;if(loop.running){loop.togglePause();return}
  const voice=voices[Number($("#voice").value)]||voices[0];loop.play(detail.plainJapanese||stripFurigana(detail.japanese),{voice,rate:Number($("#rate").value)})}
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
function resetSetupForm(){const provider=settings.provider||"deepseek";$("#setup-provider").value=provider;showSetupFields()}
function showSetupFields(){const local=$("#setup-provider").value==="local";$("#setup-key-field").hidden=local;$("#setup-endpoint-field").hidden=!local;
  $("#setup-hint").textContent=local?"Echo talks to an OpenAI-compatible server — Ollama or LM Studio — running on your machine.":"Your service gives you a key in its own dashboard, usually under API keys."}
function saveSetup(){const provider=$("#setup-provider").value;
  settings.provider=provider;
  if(provider==="local")settings.localEndpoint=$("#setup-endpoint").value.trim();
  else settings.providerKeys={...(settings.providerKeys||{}),[provider]:$("#setup-key").value.trim()};
  finishOnboarding()}
function finishOnboarding(){settings.onboarded=true;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));resetSettingsForm();showView("practice")}
async function performTranslation(){const english=$("#english-input").value.trim();if(!english)return setStatus("Enter an English sentence.",true);const provider=settings.provider||"deepseek";if(!hasTranslator())return showView("setup");const button=$("#translate"),label=button.textContent;button.disabled=true;button.textContent="Translating…";button.setAttribute("aria-busy","true");setStatus("Translating…");try{translationFailure=null;const japanese=await translate(english,settings);resetSession();current=ensureSchedule(createSentence(english,japanese));current.translationProvider=provider;await saveSentence(current);renderSentence();refreshDueBadge();setStatus("Ready to practice.")}catch(error){const name=PROVIDER_NAMES[provider]||provider;
    translationFailure={title:/\b(401|403|402|key|credit|quota)\b/i.test(error.message||"")?name+" turned the request down":"Translation failed",
      copy:(error.message||"The request did not get through.")+" Your sentence is still in the box."};
    setStatus("");renderPracticeNotices()}finally{button.disabled=false;button.textContent=label;button.removeAttribute("aria-busy")}}
function setStatus(message,error=false){$("#status").textContent=message;$("#status").classList.toggle("error",error)}
function populateVoices(){voices=japaneseVoices();const select=$("#voice"),previous=settings.voice;select.replaceChildren(...voices.map((voice,index)=>{const option=new Option(voice.name+" ("+voice.lang+")",String(index));option.selected=previous===String(index);return option}));$("#voice-warning").hidden=voices.length>0;$("#play-pause").disabled=voices.length===0||!current;if(!$("#main-view").hidden)renderPracticeNotices()}
function setupRecognition(){const recognition=recognitionFactory(),mic=$("#microphone");if(!recognition){mic.disabled=true;$("#voice-input-status").textContent="Voice input is unavailable in this browser. You can still type.";return}mic.onclick=()=>{$("#voice-input-status").textContent="Listening…";mic.classList.add("listening");try{recognition.start()}catch{}};recognition.onresult=event=>{$("#english-input").value=event.results[0][0].transcript;$("#voice-input-status").textContent="Transcript ready—check it, then translate."};recognition.onerror=event=>{const messages={"not-allowed":"Microphone permission is blocked. Enable it in your browser settings.","no-speech":"No speech was detected. Try again or type your sentence.","audio-capture":"No microphone is available."};$("#voice-input-status").textContent=messages[event.error]||"Voice input failed: "+event.error+"."};recognition.onend=()=>mic.classList.remove("listening")}
async function startReview(){const items=await listSentences(),scheduled=items.map(item=>ensureSchedule(item));await Promise.all(scheduled.filter((item,index)=>item!==items[index]).map(saveSentence));reviewQueue=dueSentences(scheduled);reviewIndex=0;if(!reviewQueue.length)return showView("review");showView("session");renderReview()}
function reviewJapanese(sentence){return settings.showPolite?(sentence.politeJapanese||sentence.japanese):(sentence.casualJapanese||sentence.japanese)}
function reviewPlainJapanese(sentence){return settings.showPolite?(sentence.plainPoliteJapanese||sentence.plainJapanese):(sentence.plainCasualJapanese||sentence.plainJapanese)}
const STAGE_LABELS={0:"New",1:"Learning",2:"Review",3:"Relearning"};
function stageLabel(sentence){const state=sentence.srs?.state??0,reps=Number(sentence.srs?.reps)||0;return STAGE_LABELS[state]+(reps?" · seen "+reps+(reps===1?" time":" times"):"")}
function stageClass(sentence){const state=sentence.srs?.state??0;return state===0?"new":state===2?"review":"learning"}
function renderReview(){resetSession();stopReviewListening();const sentence=reviewQueue[reviewIndex],complete=!sentence;
  $("#review-panel").hidden=complete;$("#review-prompt-actions").hidden=complete;$("#review-actions").hidden=true;$("#review-complete").hidden=!complete;
  $("#review-progress").textContent=complete?`${reviewQueue.length} / ${reviewQueue.length}`:`${reviewIndex+1} / ${reviewQueue.length}`;
  $("#review-progress-bar").style.width=(reviewQueue.length?Math.round((complete?reviewQueue.length:reviewIndex)/reviewQueue.length*100):0)+"%";
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
    if(!reviewRecognition){$("#review-mic").disabled=true;$("#review-listen-state").textContent="";$("#review-answer").focus();return}
    reviewRecognition.onresult=event=>{const heard=event.results[0][0].transcript;$("#review-answer").value=($("#review-answer").value+heard).trim();updateCheckButton()};
    reviewRecognition.onerror=event=>{const messages={"not-allowed":"Microphone blocked — type it instead.","no-speech":"Nothing heard — tap the mic or type it.","audio-capture":"No microphone available — type it instead."};$("#review-listen-state").textContent=messages[event.error]||"Dictation failed — type it instead."};
    reviewRecognition.onend=()=>{reviewListening=false;$("#review-mic").setAttribute("aria-pressed","false");$("#review-mic").setAttribute("aria-label","Start listening");$("#review-panel").classList.remove("listening");if($("#review-listen-state").textContent==="Listening — keep going")$("#review-listen-state").textContent=""}}
  try{reviewRecognition.start()}catch{return}
  reviewListening=true;$("#review-mic").setAttribute("aria-pressed","true");$("#review-mic").setAttribute("aria-label","Stop listening");$("#review-panel").classList.add("listening");$("#review-listen-state").textContent="Listening — keep going"}
function stopReviewListening(){if(!reviewListening||!reviewRecognition)return;reviewListening=false;try{reviewRecognition.stop()}catch{}$("#review-mic").setAttribute("aria-pressed","false");$("#review-panel").classList.remove("listening")}
function toggleReviewListening(){reviewListening?stopReviewListening():startReviewListening()}
function skipReview(){reviewIndex++;renderReview()}
function playReviewAudio(){const sentence=reviewQueue[reviewIndex];if(!sentence||!voices.length)return;if(loop.running){loop.togglePause();return}const voice=voices[Number($("#voice").value)]||voices[0];loop.play(reviewPlainJapanese(sentence)||reviewJapanese(sentence).replace(/【[^】]+】/g,""),{voice,rate:Number($("#rate").value)})}
async function rateReview(rating){const sentence=reviewQueue[reviewIndex];if(!sentence||!reviewRevealed)return;resetSession();const graded=reviewSentence(sentence,rating);
  const updated={...graded,reviews:[...(Array.isArray(sentence.reviews)?sentence.reviews:[]),{at:new Date().toISOString(),rating,echoes:Math.max(0,(Number(sentence.echoCount)||0)-echoesAtCardStart)}]};await saveSentence(updated);if(current?.id===updated.id)current=updated;reviewQueue[reviewIndex]=updated;reviewIndex++;renderReview()}
async function exportHistory(){const data=exportBackup(await listSentences(),settings),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),link=Object.assign(document.createElement("a"),{href:url,download:"jp-echo-backup.json"});link.click();URL.revokeObjectURL(url)}
async function exportAnki(){const button=$("#export-anki"),items=await listSentences();button.disabled=true;button.textContent="Building deck…";$("#anki-status").textContent="Creating JP Echo.apkg on this device…";try{await downloadAnkiDeck(items);$("#open-anki").hidden=false;const launched=openAnki(true);$("#anki-status").textContent=launched?"JP Echo.apkg downloaded. Opening Anki… If it stays here, tap Open Anki.":"JP Echo.apkg downloaded. Open it from Downloads to import it into Anki."}catch(error){$("#anki-status").textContent=error.message||"Anki export failed."}finally{button.disabled=false;button.textContent="Export to Anki"}}
function openAnki(automatic=false){const android=/android/i.test(navigator.userAgent),ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if(android){window.location.href="intent:#Intent;package=com.ichi2.anki;end";return true}if(ios){window.location.href="anki://";return true}if(!automatic)$("#anki-status").textContent="Open JP Echo.apkg from your Downloads folder to import it into Anki.";return false}
async function importHistory(file){if(!file)return;try{const backup=JSON.parse(await file.text());if(backup.schemaVersion!==1||!Array.isArray(backup.sentences))throw new Error("Unsupported backup.");const merged=mergeSentences(await listSentences(),backup.sentences);await replaceAll(merged);setStatus("Imported "+backup.sentences.length+" sentence(s).");renderHistory()}catch(error){setStatus(error.message||"Import failed.",true)}}
for(const tab of document.querySelectorAll(".tab[data-view]"))tab.onclick=()=>showView(tab.dataset.view);$("#translate").onclick=performTranslation;$("#english-input").onkeydown=event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")performTranslation()};$("#play-pause").onclick=()=>{if(!current)return;if(loop.running){loop.togglePause();return}const voice=voices[Number($("#voice").value)]||voices[0];loop.play(selectedPlainJapanese(),{voice,rate:Number($("#rate").value)})};$("#show-english").onchange=()=>{saveSettings();renderSentence()};$("#show-furigana").onchange=()=>{saveSettings();renderSentence()};$("#show-polite").onchange=()=>{resetSession();saveSettings();renderSentence()};$("#rate").oninput=()=>{const rate=Number($("#rate").value);$("#rate-value").textContent=rate.toFixed(1)+"×";resetSession();loop.setRate(rate)};$("#settings-button").onclick=()=>$("#settings-dialog").showModal();$("#close-settings").onclick=()=>{saveSettings();$("#settings-dialog").close();renderPracticeNotices()};$("#export-anki").onclick=exportAnki;$("#open-anki").onclick=()=>openAnki();$("#export").onclick=exportHistory;$("#import").onclick=()=>$("#import-file").click();$("#import-file").onchange=event=>importHistory(event.target.files[0]);
$("#onboard-start").onclick=()=>showView("setup");$("#onboard-restore").onclick=()=>{finishOnboarding();showView("library");$("#import-file").click()};
$("#setup-back").onclick=()=>showView(settings.onboarded?"practice":"onboard");$("#setup-provider").onchange=showSetupFields;$("#setup-save").onclick=saveSetup;$("#setup-skip").onclick=finishOnboarding;
$("#clear-filters").onclick=()=>{$("#history-search").value="";$("#clear-history-search").hidden=true;$("#history-filter").value="all";settings.historyFilter="all";localStorage.setItem("jp-echo-settings",JSON.stringify(settings));renderHistory()};
addEventListener("online",renderPracticeNotices);addEventListener("offline",renderPracticeNotices);
$("#sentence-back").onclick=()=>{detail=null;showView("library")};$("#sentence-play").onclick=playDetail;$("#sentence-edit").onclick=openEditor;$("#sentence-cancel").onclick=closeEditor;$("#sentence-editor").onsubmit=saveEdit;
$("#sentence-delete").onclick=askDelete;$("#delete-cancel").onclick=()=>$("#delete-dialog").close();$("#delete-confirm").onclick=confirmDelete;$("#delete-dialog").onclick=event=>{if(event.target===$("#delete-dialog"))$("#delete-dialog").close()};
$("#start-review").onclick=startReview;$("#review-practice").onclick=()=>showView("practice");$("#review-back").onclick=()=>{stopReviewListening();showView("review")};$("#review-done").onclick=()=>showView("practice");$("#review-home-link").onclick=()=>showView("review");$("#review-check").onclick=revealReview;$("#review-skip").onclick=skipReview;$("#review-mic").onclick=toggleReviewListening;$("#review-answer").oninput=updateCheckButton;$("#review-audio").onclick=playReviewAudio;$("#review-again").onclick=()=>rateReview("again");$("#review-ok").onclick=()=>rateReview("ok");
$("#settings-button").onclick=openSettings;$("#settings-nav").onclick=openSettings;$("#dismiss-settings").onclick=cancelSettings;$("#cancel-settings").onclick=cancelSettings;$("#install-app").onclick=installApp;$("#settings-dialog").addEventListener("cancel",event=>{event.preventDefault();cancelSettings()});$("#settings-dialog").onclick=event=>{if(event.target===$("#settings-dialog"))cancelSettings()};$("#voice").onchange=resetSession;$("#provider").onchange=showProviderConfig;$("#theme").onchange=()=>applyTheme($("#theme").value);window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;updateInstallUI()});window.addEventListener("appinstalled",()=>{installPrompt=null;updateInstallUI()});
$("#history-search").oninput=()=>{$("#clear-history-search").hidden=!$("#history-search").value;renderHistory()};$("#clear-history-search").onclick=()=>{$("#history-search").value="";$("#clear-history-search").hidden=true;$("#history-search").focus();renderHistory()};for(const id of ["#history-filter","#history-order","#history-direction"]){$(id).onchange=()=>{settings.historyFilter=$("#history-filter").value;settings.historyOrder=$("#history-order").value;settings.historyDirection=$("#history-direction").value;localStorage.setItem("jp-echo-settings",JSON.stringify(settings));renderHistory()}}
const legacyOrders={newest:["created","desc"],oldest:["created","asc"],echoes:["echoes","desc"],due:["due","asc"]},legacy=legacyOrders[settings.historyOrder];if(legacy){settings.historyOrder=legacy[0];settings.historyDirection=settings.historyDirection||legacy[1]}resetSettingsForm();applyTheme();$("#show-english").checked=settings.showEnglish??false;$("#show-furigana").checked=settings.showFurigana??true;$("#show-polite").checked=settings.showPolite??false;$("#history-filter").value=settings.historyFilter||"all";$("#history-order").value=settings.historyOrder||"created";$("#history-direction").value=settings.historyDirection||"desc";speechSynthesis.onvoiceschanged=populateVoices;populateVoices();showView(settings.onboarded||hasTranslator()?"practice":"onboard");refreshDueBadge();setupRecognition();updateInstallUI();if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js");
