import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const code=app.slice(app.indexOf('function bindDictation('),app.indexOf('function setupRecognition('));
function harness({native=true,broken=false}={}){
 const events=[];const recognizer={start(){events.push('recognition')},abort(){events.push('abort')}};
 const mic={classList:{add(){},remove(){}},setAttribute(){}};
 const ctx=vm.createContext({navigator:{mediaDevices:{getUserMedia:async()=>{events.push('microphone');throw Error('test microphone unavailable')}}},window:{MediaRecorder:class{}},performance:{now:()=>0},recognitionFactory:()=>native?recognizer:null,inputLang:'en',localStorage:{getItem:()=>broken?'1':null},storePreference(){},resetSession(){events.push('loop stopped')},discussionLoop:{stop(){events.push('conversation stopped')}},speechSynthesis:{cancel(){events.push('speech cancelled')}},DICTATION:{},setTimeout:()=>1,clearTimeout(){},dictationError:()=>'',appendHeard(){}});
 vm.runInContext(code,ctx);ctx.bindDictation(mic,{value:''},{textContent:''});return {mic,events};
}
test('starting native dictation stops sentence loops and queued speech before capture',()=>{
 const h=harness();h.mic.onclick();assert.deepEqual(h.events,['loop stopped','conversation stopped','speech cancelled','recognition']);
 h.mic.onclick();assert.equal(h.events.at(-1),'abort');assert.equal(h.events.filter(e=>e==='recognition').length,1);
});
for(const options of [{native:false},{broken:true}])test(`recorded fallback stops playback before microphone access: ${JSON.stringify(options)}`,async()=>{
 const h=harness(options);h.mic.onclick();await Promise.resolve();
 assert.deepEqual(h.events,['loop stopped','conversation stopped','speech cancelled','microphone']);
});
