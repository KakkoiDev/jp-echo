import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {ShadowLoop} from '../speech.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function harness(sentence){
 const spoken=[],states=[],timers=[],watchdogs=[];let echoes=0;
 globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
 globalThis.speechSynthesis={speak:utterance=>spoken.push(utterance),cancel(){}};
 const loop=new ShadowLoop({onEcho:()=>echoes++,onState:s=>states.push(s),setTimer:fn=>{timers.push(fn);return timers.length},clearTimer(){},now:()=>1000,setWatchdogTimer:fn=>{watchdogs.push(fn);return watchdogs.length},clearWatchdogTimer(){}});
 const fields={'#voice':{value:'default'},'#rate':{value:'0.8'}},voices=[{name:'Preferred',default:true}];
 const context={reviewQueue:[sentence],reviewIndex:0,loop,$:id=>fields[id],voices,Number,Math,reviewJapanese:s=>s.target,itemTarget:s=>s.targetLang,targetLang:()=> 'en'};
 vm.createContext(context);vm.runInContext(app.match(/function playReviewAudio\(\)\{[^\n]*\}/)[0]+';globalThis.play=playReviewAudio',context);
 return {context,loop,spoken,states,timers,watchdogs,fields,voices,get echoes(){return echoes}};
}
test('both review audio buttons call the real playback action using furigana, card language and saved speed',()=>{
 const h=harness({id:'one',targetLang:'ja',target:'ログ吐【は】いてる？'});
 for(const id of ['review-front-audio','review-audio']){
  assert.match(app,new RegExp('\\$\\("#'+id+'"\\)\\.onclick=playReviewAudio'));
 }
 h.context.play();assert.equal(h.spoken[0].text,'ログハいてる？');assert.equal(h.spoken[0].lang,'ja');assert.equal(h.spoken[0].rate,0.8);assert.equal(h.spoken[0].voice,h.voices[0]);h.loop.stop();
});
test('non-Japanese cards use their own language and keep their text intact',()=>{
 const h=harness({id:'one',targetLang:'fr',target:'Bonjour, tout le monde !'});h.context.play();
 assert.equal(h.spoken[0].lang,'fr');assert.equal(h.spoken[0].text,'Bonjour, tout le monde !');h.loop.stop();
});
test('pause and resume restart the current sentence, while canceled callbacks cannot affect the next card',()=>{
 const h=harness({id:'one',targetLang:'ja',target:'同【おな】じです。'});h.context.play();const old=h.spoken[0],staleEnd=old.onend,staleError=old.onerror;
 h.context.play();assert.equal(h.loop.paused,true);h.context.play();assert.equal(h.spoken.at(-1).text,'オナじです。');
 h.loop.stop();h.context.reviewQueue.push({id:'two',targetLang:'fr',target:'Salut.'});h.context.reviewIndex=1;h.context.play();
 staleEnd();staleError({error:'canceled'});assert.equal(h.loop.running,true);assert.equal(h.echoes,0);assert.equal(h.spoken.at(-1).lang,'fr');h.loop.stop();
});
test('a speech engine that never starts reports an error and can retry the same review',()=>{
 const h=harness({id:'one',targetLang:'ja',target:'駅【えき】です。'});h.context.play();h.watchdogs.at(-1)();
 assert.equal(h.loop.running,false);assert.equal(h.states.at(-1),'error');h.context.play();assert.equal(h.spoken.length,2);assert.equal(h.loop.running,true);h.loop.stop();
});
test('leaving review cancels recording, and advancing cards cancels pending TTS callbacks',()=>{
 const show=app.slice(app.indexOf('function showView('),app.indexOf('\n',app.indexOf('function showView(')));
 assert.match(show,/if\(name!=="session"\)stopReviewListening\(\)/);assert.match(show,/speechSynthesis\.cancel\(\)/);
 const h=harness({id:'one',targetLang:'ja',target:'駅【えき】です。'});h.context.play();const staleEnd=h.spoken[0].onend;
 h.loop.stop();staleEnd();assert.equal(h.echoes,0);assert.equal(h.timers.length,0);assert.equal(h.loop.running,false);
});
