import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RADIO_MINUTE,radioPlan,radioPhase,radioQueue,radioSteps,cueVolume} from '../radio.js';
import {parseRoute,routeFor} from '../routes.js';

const studied=(id,at,extra={})=>({id,target:id+'【よみ】',plainTarget:id,source:'meaning of '+id,sourceLang:'en',targetLang:'ja',srs:{last_review:at},...extra});

test('Radio plays studied sentences only, most recently studied first',()=>{
 const queue=radioQueue([studied('old','2026-10-01T00:00:00Z'),{id:'new-card',target:'未',srs:{due:'2026-11-01'}},studied('newest','2026-11-02T00:00:00Z'),studied('mid','2026-10-20T00:00:00Z')]);
 assert.deepEqual(queue.map(item=>item.id),['newest','mid','old']);
 assert.equal(queue[0].source,'meaning of newest');
});

test('the night follows the research first: wind-down, settle, cues, then the rest of the night',()=>{
 const plan=radioPlan({hours:8});
 assert.deepEqual(plan.map(part=>part.phase),['wind-down','settle','cues','night']);
 assert.equal(plan.reduce((sum,part)=>sum+part.minutes,0),8*60);
 assert.equal(radioPhase(0,plan).phase,'wind-down');
 assert.equal(radioPhase(15*RADIO_MINUTE,plan).phase,'settle');
 assert.equal(radioPhase(60*RADIO_MINUTE,plan).phase,'cues');
 assert.equal(radioPhase(4*60*RADIO_MINUTE,plan).phase,'night');
 assert.equal(radioPhase(8*60*RADIO_MINUTE,plan).phase,'done');
 assert.equal(radioPlan({hours:42}).reduce((sum,part)=>sum+part.minutes,0),8*60,'unknown lengths fall back to the default');
});

// Schreiner, Lehmann & Rasch 2015: a translation straight after a sleep cue
// cancels its benefit. The deep-sleep cues never carry the meaning.
test('deep-sleep cues are the sentence alone; the meaning comes in the wind-down and the rest of the night',()=>{
 const item=radioQueue([studied('a','2026-11-01T00:00:00Z')])[0];
 const said=phase=>radioSteps(phase,item).filter(step=>step.say).map(step=>step.say);
 assert.deepEqual(said('cues'),['a【よみ】']);
 assert.deepEqual(said('wind-down'),['a【よみ】','meaning of a','a【よみ】']);
 assert.deepEqual(said('night'),['a【よみ】','meaning of a']);
 assert.deepEqual(radioSteps('settle',item),[]);
 const cue=radioSteps('cues',item).find(step=>step.say);assert.equal(cue.lang,'ja');
});

test('cues fade in quietly and stay quiet',()=>{
 assert.ok(cueVolume(0)<cueVolume(5*RADIO_MINUTE));
 assert.equal(cueVolume(60*RADIO_MINUTE),cueVolume(10*RADIO_MINUTE));
 assert.ok(cueVolume(60*RADIO_MINUTE)<=0.5);
});

test('the player walks each phase from the newest sentence and stops at the end of the night',async()=>{
 globalThis.speechSynthesis??={cancel(){}};globalThis.SpeechSynthesisUtterance??=class{};
 const {RadioPlayer}=await import('../speech.js');
 let clock=0;const said=[];let done=false;
 const plan=[{phase:'wind-down',minutes:1},{phase:'cues',minutes:1}];
 const player=new RadioPlayer({now:()=>clock,speak:async(text,{lang})=>{said.push([radioPhase(clock,plan).phase,text,lang]);clock+=5000},wait:async ms=>{clock+=ms},cancel:()=>{},onDone:()=>{done=true}});
 const queue=radioQueue([studied('b','2026-10-01T00:00:00Z'),studied('a','2026-11-01T00:00:00Z')]);
 player.start(queue,{steps:radioSteps,phaseAt:elapsed=>radioPhase(elapsed,plan)});
 for(let i=0;i<500&&!done;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(done,'the player ended with the night');
 assert.deepEqual(said.slice(0,3).map(x=>x[1]),['a【よみ】','meaning of a','a【よみ】'],'newest first, with its meaning, in the wind-down');
 const cues=said.filter(x=>x[0]==='cues');
 assert.equal(cues[0][1],'a【よみ】','the cues start again from the newest');
 assert.ok(cues.every(x=>x[2]==='ja'),'no meaning during the cues');
});

test('Radio is a route of its own, cached for the night offline',()=>{
 assert.equal(routeFor({view:'radio'}),'/radio');
 assert.equal(parseRoute('/radio').view,'radio');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(sw,/"\.\/radio\.js"/);
 assert.match(sw,/mora\|radio\|/);
});

test('the night screen keeps the phone awake and the setup says so',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/wakeLock\?\.request\("screen"\)/);
 assert.match(app,/visibilitychange[^\n]*radio\.running[^\n]*holdRadioWake/,'the lock is taken again when the page returns');
 assert.match(html,/id="review-radio"/);assert.match(app,/id:"radio",glyph:"夜"/);assert.match(html,/id="radio-night"/);
});
