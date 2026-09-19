export class ShadowLoop{
  constructor({onEcho,onState}){this.onEcho=onEcho;this.onState=onState;this.running=false;this.paused=false;this.timer=null}
  play(text,{voice,rate=1}){this.stop(false);this.running=true;const speak=()=>{if(!this.running)return;const utterance=new SpeechSynthesisUtterance(text),started=performance.now();utterance.lang="ja-JP";utterance.voice=voice||null;utterance.rate=rate;utterance.onstart=()=>this.onState("speaking");utterance.onerror=event=>{if(event.error!=="canceled")this.onState("error");this.running=false};utterance.onend=()=>{if(!this.running)return;this.onEcho();const duration=Math.max(900,performance.now()-started);this.onState("imitate");this.timer=setTimeout(speak,duration+500)};speechSynthesis.speak(utterance)};speak()}
  togglePause(){if(!this.running)return false;if(this.paused)speechSynthesis.resume();else speechSynthesis.pause();this.paused=!this.paused;this.onState(this.paused?"paused":"speaking");return this.paused}
  stop(notify=true){this.running=false;this.paused=false;clearTimeout(this.timer);speechSynthesis.cancel();if(notify)this.onState("stopped")}
}
export function japaneseVoices(){return speechSynthesis.getVoices().filter(voice=>voice.lang.toLowerCase().startsWith("ja"))}
export function recognitionFactory(){const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)return null;const recognition=new Recognition();recognition.lang="en-US";recognition.interimResults=false;recognition.maxAlternatives=1;return recognition}
