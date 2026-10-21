import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewSpeechCapture} from '../review-speech.js';
import {checkReadingSpeech} from '../readings.js';
const timers={setTimer:()=>1,clearTimer:()=>{}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('native capture uses target language and waits for final recognition on reveal',async()=>{
 let recognizer,language;const text=[],states=[];
 const capture=createReviewSpeechCapture({...timers,lang:'fr',recognitionFactory:lang=>{language=lang;return recognizer={start(){},stop(){queueMicrotask(()=>{this.onresult({results:[[{transcript:'bonjour'}]]});this.onend()})},abort(){}}},onText:s=>text.push(s),onState:s=>states.push(s)});
 capture.start();assert.equal(language,'fr');assert.match(states[0],/Recording/);
 assert.equal(await capture.finish(),'bonjour');assert.equal(text.at(-1),'bonjour');assert.equal(states.at(-1),'Ready to check.');
});
test('cancellation settles immediately and ignores stale native results',async()=>{
 let recognizer;const text=[];
 const capture=createReviewSpeechCapture({...timers,lang:'ja',recognitionFactory:()=>recognizer={start(){},abort(){},stop(){}},onText:s=>text.push(s)});
 capture.start();capture.cancel();recognizer.onresult({results:[[{transcript:'stale'}]]});recognizer.onend();
 assert.equal(await capture.done,'');assert.deepEqual(text,[]);
});
function recordedHarness(transcribe=async()=> '読みました'){
 let recorder,stops=0;const states=[],texts=[];
 const tracks=[{stop(){stops++}}];
 class Recorder{constructor(){recorder=this;this.state='inactive';this.mimeType='audio/webm'}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['audio'])});this.onstop()}}
 const capture=createReviewSpeechCapture({...timers,lang:'ja',recognitionFactory:()=>null,Recorder,mediaDevices:{getUserMedia:async()=>({getTracks:()=>tracks})},transcribe,onState:s=>states.push(s),onText:s=>texts.push(s)});
 return {capture,states,texts,get recorder(){return recorder},get stops(){return stops}};
}
test('recorded fallback transcribes audio in the target language and releases microphone',async()=>{
 let language,bytes;const h=recordedHarness(async(blob,lang)=>{language=lang;bytes=blob.size;return '読みました'});
 h.capture.start();await tick();assert.equal(h.recorder.state,'recording');
 assert.equal(await h.capture.finish(),'読みました');assert.equal(language,'ja');assert.ok(bytes);assert.ok(h.stops);assert.equal(h.texts.at(-1),'読みました');
});
test('navigation during provider transcription cannot populate the next card',async()=>{
 let resolve;const h=recordedHarness(()=>new Promise(r=>resolve=r));h.capture.start();await tick();h.capture.finish();h.capture.cancel();resolve('late result');await tick();assert.deepEqual(h.texts,[]);assert.ok(h.stops);
});
test('permission arriving after cancellation immediately releases the microphone',async()=>{
 let grant,stops=0;const capture=createReviewSpeechCapture({...timers,lang:'ja',recognitionFactory:()=>null,Recorder:class {},mediaDevices:{getUserMedia:()=>new Promise(r=>grant=r)}});
 capture.start();capture.cancel();grant({getTracks:()=>[{stop(){stops++}}]});await tick();assert.equal(stops,1);
});
test('provider errors stay recoverable and do not leave the microphone open',async()=>{
 const h=recordedHarness(async()=>{throw Error('Add your speech key in Settings.')});h.capture.start();await tick();await h.capture.finish();assert.match(h.states.at(-1),/Settings/);assert.ok(h.stops);
});
test('browser speech errors start recorded fallback',async()=>{
 let recognizer,asked=false;const capture=createReviewSpeechCapture({...timers,lang:'ja',recognitionFactory:()=>recognizer={start(){},abort(){this.onend()},stop(){}},Recorder:class {},mediaDevices:{getUserMedia:async()=>{asked=true;throw Object.assign(Error(),{name:'NotAllowedError'})}}});
 capture.start();recognizer.onerror({error:'network'});await capture.done;assert.equal(asked,true);
});
test('reading check accepts equivalent kanji/kana and ignores punctuation without changing grades',()=>{
 const target='同【おな】じ経験【けいけん】です。';
 assert.equal(checkReadingSpeech('おなじけいけんです',target).status,'match');
 assert.equal(checkReadingSpeech('同じ経験です！',target).status,'match');
 assert.equal(checkReadingSpeech('どうじけいけんです',target).status,'different');
 assert.equal(checkReadingSpeech('',target).status,'empty');
 assert.equal(checkReadingSpeech('BONJOUR !','Bonjour.','fr').status,'match');
});
test('a native service that never ends is bounded after stopping',async()=>{
 const callbacks=new Map();let id=0;const states=[];
 const capture=createReviewSpeechCapture({lang:'ja',recognitionFactory:()=>({start(){},stop(){},abort(){}}),onState:s=>states.push(s),setTimer:fn=>{callbacks.set(++id,fn);return id},clearTimer:i=>callbacks.delete(i)});
 capture.start();const final=capture.finish();[...callbacks.values()].at(-1)();assert.equal(await final,'');assert.match(states.at(-1),/Nothing heard/);
});
test('finishing recording allows transcript edits before a separate reveal, without grading',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('async function revealReview()'),source.indexOf('function reviewVocabularyHits('));
 const fields=new Map(),$=id=>{if(!fields.has(id))fields.set(id,{value:'',hidden:true,textContent:'',innerHTML:'',classList:{toggle(){}},append(...args){this.parts=args}});return fields.get(id)};
 const sentence={id:'one',target:'駅【えき】です',source:'It is a station.',targetLang:'ja'};let finish;const capture={finish:()=>new Promise(r=>finish=r)};
 const state={reviewQueue:[sentence],reviewIndex:0,reviewRevealed:false,reviewRecognition:capture,reviewSpeechPending:true};
 const vm=await import('node:vm');const context={...state,$,reviewMode:()=> 'reading',reviewJapanese:s=>s.target,itemTarget:s=>s.targetLang,checkReadingSpeech,stopReviewListening(){},updateCheckButton(){},resetSession(){},enableReviewVocabulary(){},document:{querySelector:()=>({hidden:false}),createElement:()=>({})},rubyHtml:s=>s,settings:{},playReviewAudio(){},saveSentence(){assert.fail('reveal must not grade')}};
 vm.createContext(context);vm.runInContext(body+';globalThis.reveal=revealReview',context);
 const pending=context.reveal();assert.equal(context.reviewRevealed,false);
 $('#review-answer').value='misheard';context.reviewSpeechPending=false;finish();await pending;
 assert.equal(context.reviewRevealed,false);assert.equal($('#review-result').hidden,true);
 $('#review-answer').value='えきです';const reveal=context.reveal();finish();await reveal;
 assert.equal(context.reviewRevealed,true);assert.equal($('#review-speech-feedback').hidden,false);assert.match($('#review-speech-feedback').textContent,/matches/);
 assert.equal($('#review-result').hidden,false);assert.equal($('#review-actions').hidden,false);
});
