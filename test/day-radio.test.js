import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {radioItems,examplesFromDecks,examplesFromSets,dayQueue,daySteps,chooseExample,radioEvent,listeningWeak,DayPlayer} from "../day-radio.js";
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

// The next-day check itself is held in test/n2-delayed.test.js (Today's checks).
test("the 見通し case (with 就任): missed by ear, caught by ear later; the written reading record is untouched",()=>{
  const examples=new Map([[K(mitooshi),[{id:"deck",ja:"A。",en:"a"},{id:"exam",ja:"B。",en:""}]]]);
  const recall=[{id:K(["reading",...mitooshi]),target:mitooshi,dimension:"reading",last:"instant",days:["2026-11-22","2026-11-23"],updatedAt:"2026-11-23T08:00:00Z",events:[{at:"2026-11-23T08:00:00Z",grade:"instant"}]}];
  const missedByEar=radioEvent({target:mitooshi,kind:"recall",grade:"missed",source:"day-radio",mode:"recall",exampleId:"deck",now:new Date("2026-11-23T09:00:00Z")});
  const heard=radioEvent({target:mitooshi,kind:"exposure",source:"day-radio",mode:"listen",exampleId:"deck",now:new Date("2026-11-23T10:00:00")});
  assert.equal(listeningWeak([missedByEar]).get(K(mitooshi)).weak,true);
  const caught=radioEvent({target:mitooshi,kind:"recall",grade:"got",source:"delayed-check",mode:"check",exampleId:"exam",now:new Date("2026-11-24T09:00:00Z")});
  assert.equal(listeningWeak([missedByEar,caught]).get(K(mitooshi)).weak,false);
  // Written reading: still instant, still not weak, still out of the weak queue.
  assert.equal(weakTargets("reading",recall,[]).get(K(mitooshi)).weak,false);
  assert.ok(!recallQueue({type:"reading",filter:"weak",inventory,recall}).length);
  assert.equal(chooseExample(examples.get(K(mitooshi)),new Set(["deck"])).id,"exam");
});

test("exam questions give second contexts, without blanks or ordering puzzles",()=>{
  const sets=[{id:"s",questions:[{target:mitooshi,prompt:"今後の【見通し】を説明した。"},{target:mitooshi,prompt:"（　）が立たない。"},{target:mitooshi,prompt:"新しい社長の【就任】が発表された。読み方はどれか。"}]}];
  const ex=examplesFromSets(sets).get(K(mitooshi));
  assert.deepEqual(ex.map(e=>e.ja),["今後の見通しを説明した。","新しい社長の就任【しゅうにん】が発表された。"]);
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

test("hearing a word correctly preserves an outstanding reading miss", () => {
  const miss = {target: mitooshi, dimension: "reading", answered: true, correct: false, at: "2026-11-21"};
  const got = {target: mitooshi, kind: "recall", skill: "listening", grade: "got", at: "2026-11-22"};
  assert.equal(dayQueue({inventory, evidence: [miss], events: [got], size: 1})[0].why, "weak");
});

test("a second batch can reach fresh items, and a checked inventory still plays", () => {
  const first = dayQueue({inventory, size: 3});
  const events = first.map(item => radioEvent({target: item.target, kind: "exposure"}));
  const second = dayQueue({inventory, events, size: 3});
  assert.ok(second.every(item => !first.some(old => K(old.target) === K(item.target))));
  const recall = [...items.values()].map(item => ({target: item.target}));
  assert.deepEqual(dayQueue({inventory, recall, size: 2}).map(x => x.why), ["review", "review"]);
});

test("skipped and failed playback never emit completion, including the final item", async () => {
  const completed = [];
  let release, finish;
  const done = new Promise(resolve => { finish = resolve; });
  const p = new DayPlayer({
    speak: text => text === "skip" ? new Promise(resolve => { release = resolve; }) : Promise.resolve(text === "ok"),
    onComplete: item => completed.push(item), onDone: finish
  });
  p.start(["skip", "ok", "failed"], {steps: item => [{say: item, lang: "en"}]});
  p.jump(1);
  release(true);
  await done;
  assert.deepEqual(completed, ["ok"]);
});

test("recall marks its pause for the PauseRing, and the player announces it before waiting (J2Recall)",async()=>{
  const item=items.get(K(mitooshi)),steps=daySteps("recall",item,null,{pause:5});
  assert.equal(steps[1].ring,true);assert.equal(steps[1].pause,5000);
  assert.ok(!daySteps("listen",item,null).some(s=>s.ring),"listen has no countdown");
  const rings=[];let done;const finished=new Promise(r=>done=r);
  const p=new DayPlayer({speak:async()=>true,wait:async()=>{},onRing:(i,ms)=>rings.push(ms),onDone:done});
  p.start([item],{steps:it=>daySteps("recall",it,null,{pause:3})});await finished;
  assert.deepEqual(rings,[3000]);
});

test("a spoken word carries its reading, so the voice never guesses (重役 is じゅうやく)", async () => {
  const {spokenWord, withReading} = await import("../day-radio.js");
  const {speechText} = await import("../japanese-readings.js");
  assert.equal(spokenWord("重役", "じゅうやく"), "重役【じゅうやく】");
  assert.equal(speechText(spokenWord("重役", "じゅうやく")), "ジュウヤク");
  assert.equal(spokenWord("ほぼ", "ほぼ"), "ほぼ");
  // A word with kana in it spreads its reading over its kanji (reports 7c4b87c8 ike-ikebana, 2577975b あいだもなく).
  assert.equal(spokenWord("生け花", "いけばな"), "生【い】け花【ばな】"); assert.equal(speechText(spokenWord("生け花", "いけばな")), "イけバナ");
  assert.equal(speechText(spokenWord("間もなく", "まもなく")), "マもなく"); assert.equal(speechText(spokenWord("間も無く", "まもなく")), "マもナく");
  assert.equal(speechText(spokenWord("引き出す", "ひきだす")), "ヒきダす"); assert.equal(speechText(spokenWord("お喋り", "おしゃべり")), "おシャベり");
  assert.equal(spokenWord("女～", "じょ～"), "女【じょ】～", "a mark stays in place (reports 4fccd568, edc6d8c3: おんな, はつ)"); assert.equal(speechText(spokenWord("初～", "しょ～")), "ショ～");
  assert.equal(spokenWord("～過ぎる", "～すぎる"), "～過【す】ぎる"); assert.equal(spokenWord("生け花", "はな"), "生け花【はな】", "what doesn't line up keeps the whole reading");
  assert.equal(withReading("重役が来た。", "重役", "じゅうやく"), "重役【じゅうやく】が来た。");
  assert.equal(withReading("重役【じゅうやく】が来た。", "重役", "じゅうやく"), "重役【じゅうやく】が来た。");
  const sets = [{id: "n2-set-9", questions: [{target: ["word", "重役", "じゅうやく"], prompt: "【重役】が会議に出た。"}]}];
  const {examplesFromSets} = await import("../day-radio.js");
  assert.equal([...examplesFromSets(sets).values()][0][0].ja, "重役【じゅうやく】が会議に出た。");
  const source = (await import("node:fs")).readFileSync(new URL("../n2-mock.js", import.meta.url), "utf8");
  assert.ok(!/say\(c\.item\.prompt\)/.test(source), "the recall screen speaks the word with its reading");
});
