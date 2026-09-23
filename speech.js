export class ShadowLoop{
  constructor({onEcho,onState,setTimer=(callback,delay)=>window.setTimeout(callback,delay),clearTimer=timer=>window.clearTimeout(timer),now=()=>window.performance.now(),setWatchdogTimer=(callback,delay)=>window.setTimeout(callback,delay),clearWatchdogTimer=timer=>window.clearTimeout(timer),watchdogMs=4000}){this.onEcho=onEcho;this.onState=onState;this.setTimer=setTimer;this.clearTimer=clearTimer;this.now=now;this.running=false;this.paused=false;this.timer=null;this.timerCallback=null;this.timerStarted=0;this.remaining=0;this.utterance=null;this.rate=1;this.text="";this.voice=null;this.lang="ja";this.cycle=0;this.phase="stopped";this.setWatchdogTimer=setWatchdogTimer;this.clearWatchdogTimer=clearWatchdogTimer;this.watchdogMs=watchdogMs;this.watchdog=null}
  schedule(callback,delay){this.timerCallback=callback;this.remaining=delay;this.timerStarted=this.now();this.timer=this.setTimer(()=>{this.timer=null;this.timerCallback=null;callback()},delay)}
  // The loop's visible state follows the press, not the speech engine. Browsers
  // accept speak() and then never fire onstart — no usable voice for the
  // language, a backgrounded tab, a synthesiser that drops the utterance — and
  // waiting on that callback left the screen reading "Ready" with nothing
  // moving and no way back: a second press only reached togglePause.
  armWatchdog(cycle){this.clearWatchdog();this.watchdog=this.setWatchdogTimer(()=>{if(this.watchdog===null)return;this.watchdog=null;if(cycle!==this.cycle||!this.running||this.paused)return;this.running=false;this.phase="stopped";this.utterance=null;try{speechSynthesis.cancel()}catch{}this.onState("error")},this.watchdogMs)}
  clearWatchdog(){if(this.watchdog===null||this.watchdog===undefined)return;this.clearWatchdogTimer(this.watchdog);this.watchdog=null}
  play(text,{voice,rate=1,lang="ja"}){this.stop(false);this.running=true;this.rate=rate;this.text=text;this.voice=voice||null;this.lang=lang||"ja";const cycle=++this.cycle;const speak=()=>{if(!this.running||this.paused||cycle!==this.cycle)return;const utterance=new SpeechSynthesisUtterance(text),started=this.now();this.utterance=utterance;this.phase="speaking";utterance.lang=this.lang;utterance.voice=voice||null;utterance.rate=this.rate;utterance.onstart=()=>{if(cycle!==this.cycle)return;this.clearWatchdog();this.onState("speaking")};utterance.onerror=event=>{if(cycle!==this.cycle)return;this.clearWatchdog();this.utterance=null;if(event.error!=="canceled")this.onState("error");this.running=false};utterance.onend=()=>{if(!this.running||cycle!==this.cycle)return;this.clearWatchdog();this.utterance=null;this.onEcho();const duration=Math.max(900,this.now()-started);this.phase="imitate";this.onState("imitate");this.schedule(speak,duration+500)};this.onState("speaking");this.armWatchdog(cycle);try{speechSynthesis.speak(utterance)}catch{this.clearWatchdog();this.utterance=null;this.running=false;this.phase="stopped";this.onState("error")}};speak()}
  setRate(rate){this.rate=rate;return this.rate}
  // Play always means the sentence, from its beginning.
  //
  // Resuming used to pick up where it stopped, which is fine mid-word and
  // useless in the silence where you repeat: the timer ran down without a
  // sound, so the press produced nothing you could hear and the button looked
  // broken. There is nothing worth preserving across a pause in a loop whose
  // whole job is to say one sentence over and over.
  togglePause(){
    if(!this.running)return false;
    if(this.paused){this.play(this.text,{voice:this.voice,rate:this.rate,lang:this.lang});return false}
    this.paused=true;
    // Cancelled rather than paused. A synthesiser left in the paused state is
    // the one that will not speak again on Android, and nothing here needs it
    // to hold its place.
    this.clearWatchdog();
    if(this.utterance){this.utterance.onstart=null;this.utterance.onend=null;this.utterance.onerror=null;this.utterance=null;try{speechSynthesis.cancel()}catch{}}
    if(this.timer){this.clearTimer(this.timer);this.timer=null}
    this.timerCallback=null;this.remaining=0;
    this.onState("paused");
    return true;
  }
  stop(notify=true){this.running=false;this.paused=false;this.phase="stopped";this.cycle++;this.clearWatchdog();this.clearTimer(this.timer);this.timer=null;this.timerCallback=null;this.remaining=0;if(this.utterance){this.utterance.onstart=null;this.utterance.onend=null;this.utterance.onerror=null;this.utterance=null}speechSynthesis.cancel();if(notify)this.onState("stopped")}
}
// Android reports ja_JP, desktop ja-JP, some engines just ja — so the match is
// on the leading subtag, not the whole string.
export function japaneseVoices(code="ja"){const want=String(code).toLowerCase();
  return speechSynthesis.getVoices().filter(voice=>String(voice.lang||"").toLowerCase().replace("_","-").split("-")[0]===want)}
export function recognitionFactory(lang="en-US"){const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)return null;const recognition=new Recognition();recognition.lang=lang;recognition.interimResults=false;recognition.maxAlternatives=1;return recognition}
