import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nextExamDate,daysUntil,estimate,recallQueue,recallRecord,weakTargets,dailyGoal,closedSkills} from "../n2-study.js";

const inventory=JSON.parse(readFileSync(new URL("../n2-inventory.json",import.meta.url),"utf8"));

test("the JLPT date is the first Sunday of July or December",()=>{
  assert.equal(nextExamDate(new Date(2026,10,24)).toDateString(),new Date(2026,11,6).toDateString());
  assert.equal(nextExamDate(new Date(2026,11,6)).toDateString(),new Date(2026,11,6).toDateString());
  assert.equal(nextExamDate(new Date(2026,11,7)).toDateString(),new Date(2027,6,4).toDateString());
  assert.equal(daysUntil(new Date(2026,11,6),new Date(2026,10,24,23,30)),12);
});

test("section estimates follow JLPT's three sections of 60 with a 19-point floor",()=>{
  const questions=[];
  for(const [skill,n] of [[0,30],[1,20],[2,20],[3,30]])for(let i=0;i<n;i++)questions.push({index:questions.length,skill,key:1});
  const answers=questions.map(q=>q.skill===2?(q.index%4===0?1:2):1); // reading: 5 of 20
  const done=estimate({questions},{phase:"results",answers});
  assert.deepEqual(done.sections.map(s=>s.scaled),[60,15,60]);
  assert.equal(done.total,135);
  assert.equal(done.pass,false,"a section under 19 fails even above 90 in total");
  const written=estimate({questions},{phase:"rest",answers});
  assert.equal(written.sections[2].scaled,null);
  assert.equal(written.complete,false);
  assert.deepEqual(closedSkills("written"),[]);
});

test("the newest evidence decides whether a target is weak",()=>{
  const target=["word",...inventory.words[3].slice(0,2)];
  const miss={target,dimension:"meaning",answered:true,correct:false,guessed:false,at:"2026-11-20T00:00:00Z"};
  let weak=weakTargets("meaning",[],[miss]);
  assert.equal(weak.get(JSON.stringify(target)).weak,true);
  const later={id:JSON.stringify(["meaning",...target]),target,dimension:"meaning",last:"instant",events:[{at:"2026-11-22T00:00:00Z",grade:"instant"}]};
  weak=weakTargets("meaning",[later],[miss]);
  assert.equal(weak.get(JSON.stringify(target)).weak,false,"a later clean check clears an old mock miss");
  // Reading evidence never touches the meaning deck.
  assert.equal(weakTargets("reading",[later],[miss]).size,0);
});

test("the daily queue puts weak items first and holds today's checks for tomorrow",()=>{
  const now=new Date(2026,10,24,10);
  const first=recallQueue({type:"meaning",inventory,today:"2026-11-24"});
  assert.equal(first.length,20);
  const done=recallRecord(null,first[0],"instant",now), slow=recallRecord(null,first[1],"slow",new Date(2026,10,23,10));
  const next=recallQueue({type:"meaning",inventory,recall:[done,slow],today:"2026-11-24"});
  assert.equal(next[0].id,first[1].id,"yesterday's slow item comes first");
  assert.ok(!next.some(r=>r.id===first[0].id),"an item checked today waits");
  assert.deepEqual(recallQueue({type:"meaning",filter:"weak",inventory,recall:[done,slow],today:"2026-11-24"}).map(r=>r.id),[first[1].id]);
  assert.ok(recallQueue({type:"reading",inventory}).every(r=>r.item.prompt!==r.item.reading),"kana words are not reading checks");
});

test("the daily goal spreads first checks across the days that actually assign new material",()=>{
  const g=dailyGoal({inventory,recall:[],examDate:new Date(2026,11,6),now:new Date(2026,10,24,9)});
  assert.equal(g.daysLeft,9);
  assert.equal(g.goal,Math.ceil((1748+221)/9));
});

import {todayPlan} from "../n2-study.js";
test("the day plan runs warm-up → new checks → exam practice → review → wind-down, and lightens near the exam",()=>{
  const goal={goal:197,firstToday:40,unchecked:1800};
  const build=todayPlan({days:12,goal,weak:25,nextMock:{id:"n2-set-2",title:"02"},aiReady:true,latestResults:"?book=x&attempt=y"});
  assert.deepEqual(build.steps.map(s=>s.kind),["recall","recall","radio","mock","review","rest"]);
  assert.equal(todayPlan({days:12,goal,heardYesterday:4}).steps[0].href,"?view=radio&mode=check","yesterday's Day Radio is checked first");
  assert.match(build.steps[1].line,/157 first checks left/);
  const recent=todayPlan({days:12,goal,weak:0,nextMock:{id:"n2-set-3",title:"03"},lastMockAt:"2026-11-23T10:00:00Z",aiReady:true,now:new Date(2026,10,24,9)});
  assert.equal(recent.steps.find(s=>s.kind==="generate")?.disabled,false,"a mock yesterday means targeted practice today");
  const week=todayPlan({days:3,goal,weak:5,aiReady:false});
  assert.equal(week.phase,"final");assert.ok(!week.steps.some(s=>s.title.startsWith("New words")),"no new material in exam week");
  assert.equal(todayPlan({days:1,weak:5}).phase,"eve");
  assert.equal(todayPlan({days:0}).phase,"exam-day");
});
test("exam day asks nothing of you: the calm step only plays Day Radio",()=>{
  const day=todayPlan({days:0});
  assert.ok(day.steps.every(s=>s.kind!=="recall"&&s.kind!=="mock"&&s.kind!=="generate"));
  assert.equal(day.steps.find(s=>s.glyph==="温").href,"?view=radio&mode=listen");
});

import {coverage} from "../n2-study.js";
test("a newer grammar miss removes automatic status until repaired, within the tested skill", () => {
  const [row] = recallQueue({type: "grammar", inventory});
  const first = recallRecord(null, row, "instant", new Date(2026, 10, 20));
  const record = recallRecord(first, row, "instant", new Date(2026, 10, 21));
  const miss = {target: row.item.target, answered: true, correct: false, at: "2026-11-23T00:00:00Z"};
  assert.equal(coverage(inventory, [record], [{...miss, skill: 1}]).grammar.automatic, 0);
  assert.equal(coverage(inventory, [record], [{...miss, skill: 3}]).grammar.automatic, 1);
});

test("every allotted first-check day is available in the plan", () => {
  const examDate = new Date(2026, 11, 6);
  for (const [day, remaining] of [[2, 1], [3, 0], [6, 0]]) {
    const goal = dailyGoal({inventory, examDate, now: new Date(2026, 11, day)});
    assert.equal(goal.daysLeft, remaining);
    assert.equal(goal.goal > 0, todayPlan({days: 6-day, goal}).steps.some(s => s.href?.includes("queue=new")));
  }
});
