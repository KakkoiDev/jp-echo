import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {radioItems,examplesFromDecks,examplesFromSets,dayQueue,daySteps,chooseExample,yesterdayChecks,radioEvent,listeningWeak,DayPlayer} from "../day-radio.js";
import {weakTargets,recallQueue} from "../n2-study.js";

const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),"utf8"));
const inventory=read("../n2-inventory.json");
const decks=[read("../decks/n2-words.json"),read("../decks/n2-grammar.json")];
const items=radioItems(inventory);
const idx=inventory.words.findIndex(w=>w[0]==="就任"); // 見通し itself is not in the inventory; same case
const mitooshi=["word",...inventory.words[idx].slice(0,2)];
const K=JSON.stringify;

test("every N2 word and grammar point has a deck example for Day Radio",()=>{
  const ex=examplesFromDecks(inventory,decks);
  assert.equal(items.size,inventory.words.length+inventory.grammar.length);
  const missing=[...items.keys()].filter(k=>!ex.has(k));
  assert.ok(missing.length<5,missing.length+" without an example");
});

test("the queue plays weak items first, keeps room for unchecked ones, and moves today's to the back",()=>{
  const miss={target:mitooshi,dimension:"meaning",answered:true,correct:false,guessed:false,at:"2026-11-24T09:00:00Z"};
  const q=dayQueue({inventory,evidence:[miss],size:20,today:"2026-11-24"});
  assert.equal(K(q[0].target),K(mitooshi));assert.equal(q[0].why,"weak");
  assert.ok(q.filter(i=>i.why==="new").length>=5,"a quarter stays for new items");
  const heard=radioEvent({target:mitooshi,kind:"exposure",source:"day-radio",mode:"listen",now:new Date("2026-11-24T10:00:00Z")});
  const again=dayQueue({inventory,evidence:[miss],events:[heard],size:20,today:"2026-11-24"});
  assert.equal(K(again.at(-1).target),K(mitooshi),"already heard today goes last");
  const later=dayQueue({inventory,later:[mitooshi],size:20});
  assert.equal(later[0].why,"later");
});

test("listen plays word, meaning, example and the word again; recall pauses before the reveal; no example still plays",()=>{
  const item=items.get(K(mitooshi)), example={id:"x",ja:"見通【みとお】しが立【た】たない。",en:"No outlook yet."};
  const listen=daySteps("listen",item,example);
  assert.deepEqual(listen.filter(s=>s.say).map(s=>s.lang),["ja","en","ja","en","ja"]);
  const recall=daySteps("recall",item,example,{pause:8});
  assert.equal(recall[0].say,example.ja);assert.equal(recall[1].pause,8000);assert.ok(recall[2].reveal);
  assert.equal(daySteps("listen",item,null).filter(s=>s.say).length,3);
  assert.equal(daySteps("recall",item,null)[0].say.startsWith("就任"),true);
});

test("the 見通し case (with 就任): missed by ear, heard on Day Radio, checked next day in a fresh sentence; the written reading record is untouched",()=>{
  const examples=new Map([[K(mitooshi),[{id:"deck",ja:"A。",en:"a"},{id:"exam",ja:"B。",en:""}]]]);
  const recall=[{id:K(["reading",...mitooshi]),target:mitooshi,dimension:"reading",last:"instant",days:["2026-11-22","2026-11-23"],updatedAt:"2026-11-23T08:00:00Z",events:[{at:"2026-11-23T08:00:00Z",grade:"instant"}]}];
  const missedByEar=radioEvent({target:mitooshi,kind:"recall",grade:"missed",source:"day-radio",mode:"recall",exampleId:"deck",now:new Date("2026-11-23T09:00:00Z")});
  const heard=radioEvent({target:mitooshi,kind:"exposure",source:"day-radio",mode:"listen",exampleId:"deck",now:new Date("2026-11-23T10:00:00")});
  assert.equal(listeningWeak([missedByEar]).get(K(mitooshi)).weak,true);
  const checks=yesterdayChecks({events:[missedByEar,heard],recall,items,examples,today:"2026-11-24"});
  assert.equal(checks.length,1);assert.equal(checks[0].example.id,"exam","a sentence other than the one heard");
  const caught=radioEvent({target:mitooshi,kind:"recall",grade:"got",source:"check-yesterday",mode:"check",exampleId:"exam",now:new Date("2026-11-24T09:00:00Z")});
  assert.equal(listeningWeak([missedByEar,caught]).get(K(mitooshi)).weak,false);
  // Written reading: still instant, still not weak, still out of the weak queue.
  assert.equal(weakTargets("reading",recall,[]).get(K(mitooshi)).weak,false);
  assert.ok(!recallQueue({type:"reading",filter:"weak",inventory,recall}).length);
  assert.equal(yesterdayChecks({events:[missedByEar,heard,caught],recall,items,examples,today:"2026-11-24"}).length,0,"done once per day");
  assert.equal(chooseExample(examples.get(K(mitooshi)),new Set(["deck"])).id,"exam");
});

test("exam questions give second contexts, without blanks or ordering puzzles",()=>{
  const sets=[{id:"s",questions:[{target:mitooshi,prompt:"今後の【見通し】を説明した。"},{target:mitooshi,prompt:"（　）が立たない。"},{target:mitooshi,prompt:"新しい社長の【就任】が発表された。読み方はどれか。"}]}];
  const ex=examplesFromSets(sets).get(K(mitooshi));
  assert.deepEqual(ex.map(e=>e.ja),["今後の見通しを説明した。","新しい社長の就任が発表された。"]);
});

test("the player walks the queue, reveals, jumps and stops",async()=>{
  const said=[],seen=[],reveals=[];
  const p=new DayPlayer({speak:async t=>{said.push(t)},wait:async()=>{},onItem:(i,n)=>seen.push(n),onReveal:(i,n)=>reveals.push(n)});
  let done;const finished=new Promise(r=>done=r);p.onDone=done;
  const queue=[...items.values()].slice(0,3);
  p.start(queue,{steps:item=>daySteps("recall",item,null,{pause:1})});
  await finished;
  assert.deepEqual(seen,[0,1,2]);assert.deepEqual(reveals,[0,1,2]);assert.equal(said.length,9);
  p.start(queue,{index:2,steps:item=>daySteps("listen",item,null)});
  p.stop();assert.equal(p.running,false);
});
