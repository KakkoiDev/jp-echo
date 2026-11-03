import {speechText} from "./japanese-readings.js";
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
  play(text,{voice,rate=1,lang="ja"}){text=lang==="ja"?speechText(text):text;this.stop(false);this.running=true;this.rate=rate;this.text=text;this.voice=voice||null;this.lang=lang||"ja";const cycle=++this.cycle;const speak=()=>{if(!this.running||this.paused||cycle!==this.cycle)return;const utterance=new SpeechSynthesisUtterance(text),started=this.now();this.utterance=utterance;this.phase="speaking";utterance.lang=this.lang;utterance.voice=voice||null;utterance.rate=this.rate;utterance.onstart=()=>{if(cycle!==this.cycle)return;this.clearWatchdog();this.onState("speaking")};utterance.onerror=event=>{if(cycle!==this.cycle)return;this.clearWatchdog();this.utterance=null;if(event.error!=="canceled")this.onState("error");this.running=false};utterance.onend=()=>{if(!this.running||cycle!==this.cycle)return;this.clearWatchdog();this.utterance=null;this.onEcho();const duration=Math.max(900,this.now()-started);this.phase="imitate";this.onState("imitate");this.schedule(speak,duration+500)};this.onState("speaking");this.armWatchdog(cycle);try{speechSynthesis.speak(utterance)}catch{this.clearWatchdog();this.utterance=null;this.running=false;this.phase="stopped";this.onState("error")}};speak()}
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


// A discussion is one shadowing object: speak every turn in order, leave the
// learner the same imitation gap after each, then wrap to turn one.
export class ConversationLoop extends ShadowLoop{
  playConversation(turns,options={}){const clean=turns.map((turn,i)=>typeof turn==="string"?{text:turn,role:i%2?"user":"ai"}:{text:String(turn.text||turn.target||"").trim(),role:turn.role||"ai"}).filter(t=>t.text);if(!clean.length)return;this.stop(false);this.running=true;this.rate=options.rate||1;this.lang=options.lang||"ja";this.conversation=clean;this.voiceFor=options.voiceFor||(()=>options.voice||null);this.conversationIndex=0;const cycle=++this.cycle;const speak=()=>{if(!this.running||this.paused||cycle!==this.cycle)return;const turn=this.conversation[this.conversationIndex],utterance=new SpeechSynthesisUtterance(this.lang==="ja"?speechText(turn.text):turn.text),started=this.now();this.text=turn.text;this.utterance=utterance;this.phase="speaking";utterance.lang=this.lang;utterance.voice=this.voiceFor(turn,this.conversationIndex)||null;utterance.rate=this.rate;utterance.onstart=()=>{if(cycle!==this.cycle)return;this.clearWatchdog();this.onState("speaking",this.conversationIndex)};utterance.onerror=e=>{if(cycle!==this.cycle)return;this.clearWatchdog();this.utterance=null;if(e.error!=="canceled")this.onState("error",this.conversationIndex);this.running=false};utterance.onend=()=>{if(!this.running||cycle!==this.cycle)return;this.clearWatchdog();this.utterance=null;this.onEcho?.(this.conversationIndex);const duration=Math.max(900,this.now()-started);this.phase="imitate";this.onState("imitate",this.conversationIndex);this.conversationIndex=(this.conversationIndex+1)%this.conversation.length;this.schedule(speak,duration+500)};this.onState("speaking",this.conversationIndex);this.armWatchdog(cycle);try{speechSynthesis.speak(utterance)}catch{this.running=false;this.onState("error",this.conversationIndex)}};speak()}
  togglePause(){if(!this.running)return false;if(this.paused){this.playConversation(this.conversation,{voiceFor:this.voiceFor,rate:this.rate,lang:this.lang});return false}return super.togglePause()}
}
// One utterance, no loop: a mora and its anchor when a table cell is tapped.
export function speakOnce(text,{voice=null,rate=1,lang="ja"}={}){try{speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(lang==="ja"?speechText(text):text);utterance.lang=lang;utterance.voice=voice||null;utterance.rate=rate;speechSynthesis.speak(utterance);return true}catch{return false}}


// One utterance that resolves when it ends — or after a watchdog, because
// engines drop utterances without firing onend, and Radio must not stall at
// 2 a.m. waiting on one. Cancelling (stop) resolves it too.
export function speakAndWait(text,{voice=null,rate=1,lang="ja",volume=1}={}){
  return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(watchdog);resolve()};
    const watchdog=setTimeout(finish,4000+String(text).length*400);
    try{const utterance=new SpeechSynthesisUtterance(lang==="ja"?speechText(text):text);utterance.lang=lang;utterance.voice=voice||null;utterance.rate=rate;utterance.volume=volume;
      utterance.onend=finish;utterance.onerror=finish;speechSynthesis.speak(utterance)}catch{finish()}})}

// Radio walks the night plan from radio.js: each phase starts again from the
// newest sentence and wraps. Everything time- and sound-related is injected
// so the order is tested without a speech engine or a real night.
export class RadioPlayer{
  constructor({speak=speakAndWait,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>Date.now(),cancel=()=>{try{speechSynthesis.cancel()}catch{}},onState=()=>{},onDone=()=>{}}={}){Object.assign(this,{speak,wait,now,cancel,onState,onDone});this.run=0;this.running=false}
  // steps(phase,item,into) and phaseAt(elapsed) come from radio.js; voices
  // maps a language code to a voice. The first utterance is spoken before
  // any await, so it stays inside the tap that started Radio (iOS).
  start(queue,{steps,phaseAt,voiceFor=()=>null,rate=1}){if(!queue.length)return false;const run=++this.run;this.running=true;this.startedAt=this.now();this.loop(run,queue,{steps,phaseAt,voiceFor,rate});return true}
  async loop(run,queue,{steps,phaseAt,voiceFor,rate}){let index=0,phase=null;
    while(run===this.run){const at=phaseAt(this.now()-this.startedAt);
      if(at.phase!==phase){phase=at.phase;index=0}
      if(at.phase==="done"){this.running=false;this.onState(at,null);this.onDone();return}
      const item=at.phase==="settle"?null:queue[index%queue.length];this.onState(at,item);
      if(!item){await this.wait(Math.min(at.left,30000));continue}
      index++;
      for(const step of steps(at.phase,item,at.into)){if(run!==this.run)return;
        if(step.say)await this.speak(step.say,{lang:step.lang,volume:step.volume,rate,voice:voiceFor(step.lang)});else await this.wait(step.pause)}}}
  stop(){this.run++;this.running=false;this.cancel()}
}

// A soft pink-noise bed under the night, from a looped generated buffer: no
// file, no network, works offline. Home sleep-cueing studies play cues over a
// steady noise so each cue is less of an event. Started from the tap (iOS).
export class NoiseBed{
  start(level=.04){if(this.context)return;const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
    const context=new Context(),length=context.sampleRate*4,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
    // Paul Kellet's economy pink filter over white noise.
    let b0=0,b1=0,b2=0;for(let i=0;i<length;i++){const white=Math.random()*2-1;b0=.99765*b0+white*.099046;b1=.963*b1+white*.2965164;b2=.57*b2+white*1.0526913;data[i]=(b0+b1+b2+white*.1848)*.2}
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;gain.gain.linearRampToValueAtTime(level,context.currentTime+8);
    source.connect(gain).connect(context.destination);source.start();this.context=context}
  stop(){try{this.context?.close()}catch{}this.context=null}
}
