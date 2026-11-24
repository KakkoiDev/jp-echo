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

import {todayPlan,measuredPace,capMinutes} from "../n2-study.js";
test("the day plan runs delayed checks → new checks → timed reading and listening → targeted work → radio → breaks, inside six hours",()=>{
  const goal={goal:197,firstToday:40,unchecked:1800};
  const build=todayPlan({days:12,goal,weak:25,checks:12,aiReady:true,latestResults:"?book=x&attempt=y",examDate:new Date(2026,11,6),now:new Date(2026,10,24,9)});
  assert.deepEqual(build.steps.map(s=>s.kind),["check","recall","section","section","review","generate","recall","radio","rest"]);
  assert.equal(build.steps[0].href,"?view=check","yesterday's misses are checked first");
  assert.match(build.steps[1].line,/^157 unchecked N2 words and grammar points/);
  assert.ok(build.minutes<=360,"six hours including breaks");
  assert.equal(build.steps.find(s=>s.kind==="rest").minutes,40,"breaks are in the budget");
  const week=todayPlan({days:3,goal,weak:5,aiReady:false});
  assert.equal(week.phase,"final");assert.ok(!week.steps.some(s=>s.href?.includes("queue=new")),"no new material in exam week");
  assert.ok(week.minutes<=360);
  assert.equal(todayPlan({days:1,weak:5}).phase,"eve");
  assert.equal(todayPlan({days:0}).phase,"exam-day");
});
test("a scheduled full mock replaces the timed sections, and the day still fits six hours",()=>{
  const goal={goal:197,firstToday:0,unchecked:1800};
  const mock=todayPlan({days:10,goal,checks:5,nextMock:{id:"n2-set-2",title:"02"},examDate:new Date(2026,11,6),now:new Date(2026,10,26,9)});
  assert.deepEqual(mock.steps.slice(0,3).map(s=>s.kind),["check","mock","review"]);
  assert.ok(!mock.steps.some(s=>s.kind==="section"));
  assert.ok(mock.minutes<=360);
  const recent=todayPlan({days:12,goal,nextMock:{id:"n2-set-3",title:"03"},lastMockAt:"2026-11-23T10:00:00Z",aiReady:true,now:new Date(2026,10,24,9)});
  assert.ok(!recent.steps.some(s=>s.kind==="mock"),"a mock yesterday means sections today");
});
test("first checks follow the measured pace: zero history, slow pace, missed days, the last acquisition day",()=>{
  const examDate=new Date(2026,11,6), now=new Date(2026,10,24,9);
  const fresh=dailyGoal({inventory,recall:[],examDate,now});
  const zero=todayPlan({days:12,goal:fresh,examDate,now});
  assert.equal(zero.measured,false); assert.equal(zero.pace,36);
  assert.ok(zero.minutes<=360);
  assert.ok(zero.forecast && !zero.forecast.done);
  const slow=todayPlan({days:12,goal:fresh,pace:90,examDate,now});
  assert.ok(slow.overflow && slow.overflow.checks>0 && slow.overflow.needs>slow.overflow.fits,"a slow pace says what does not fit today (J1Overload)");
  assert.equal(slow.overflow.fits,360);
  assert.ok(slow.forecast.spill>zero.forecast.spill,"a slower pace spills more past the cut-off");
  assert.equal(slow.forecast.lastDay.toDateString(),new Date(2026,11,2).toDateString());
  // Missed days: fewer days left, the same inventory, a later finish.
  const late=new Date(2026,10,29,9), missed=dailyGoal({inventory,recall:[],examDate,now:late});
  const behind=todayPlan({days:daysUntil(examDate,late),goal:missed,examDate,now:late});
  assert.ok(missed.goal>fresh.goal); assert.ok(behind.forecast.spill>=zero.forecast.spill);
  // The last acquisition day still offers first checks; the next day does not.
  const last=new Date(2026,11,2,9);
  assert.ok(todayPlan({days:4,goal:dailyGoal({inventory,recall:[],examDate,now:last}),examDate,now:last}).steps.some(s=>s.href?.includes("queue=new")));
  const fast=todayPlan({days:12,goal:{goal:100,firstToday:0,unchecked:900},pace:20,examDate,now});
  assert.equal(fast.forecast.onTime,true);
});
test("measured pace needs enough checks; plans are trimmed to the budget in order",()=>{
  const now=new Date(2026,10,24,12);
  const events=Array.from({length:20},(_,i)=>({at:new Date(2026,10,24,9,i).toISOString(),grade:"instant",activeMs:20000+i*100}));
  assert.equal(measuredPace([{events}],now),21);
  assert.equal(measuredPace([{events:events.slice(0,5)}],now),null);
  const capped=capMinutes([{kind:"a",minutes:300},{kind:"b",minutes:100},{kind:"c",minutes:30},{kind:"rest",minutes:0}]);
  assert.deepEqual(capped.map(s=>s.minutes),[300,60,0]);
  assert.equal(capped.reduce((n,s)=>n+s.minutes,0),360);
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

import {sprintCheckpoint} from "../n2-study.js";
test("readiness uses recent first sittings with a separate-day repeat and section guard",()=>{
  const qs=[0,1,2,3].flatMap(skill=>Array.from({length:5},()=>({skill,key:1}))).map((q,index)=>({...q,index}));
  const papers=new Map(["a","b","c"].map(k=>[k,{questions:qs}]));
  const sample=(book,day)=>({book,phase:"results",startedAt:day+"T09:00:00",completedAt:day+"T12:00:00",answers:qs.map(()=>1),guesses:qs.map(()=>false)});
  const a=sample("a","2026-11-22"),b=sample("b","2026-11-23");
  const check=(...runs)=>sprintCheckpoint(runs,papers,[...papers.keys()],new Date(2026,10,24,20));
  assert.equal(check(a,b).met,true);
  assert.equal(check(a,sample("b","2026-11-22")).met,false);
  assert.equal(check(a,sample("a","2026-11-23")).met,false);
  assert.equal(check(a,sample("b","2026-11-12")).met,false);
  for (const q of qs.filter(q=>q.skill===3)) b.guesses[q.index]=true;
  assert.equal(check(a,b).met,false);
  assert.equal(check(a,b).recent[0].sections[2].correct,0);
});

test("the sprint day plan reserves breaks on baseline day and directs repair from checkpoint evidence",()=>{
  const options={days:12,now:new Date(2026,10,24),goal:{goal:800,firstToday:0,unchecked:1000},nextMock:{id:"b",title:"B"},weak:20,heardYesterday:8};
  const baseline=todayPlan({...options,checkpoint:{recent:[],met:false}});
  assert.ok(baseline.steps.some(s=>s.kind==="mock"));
  // Breaks are a 40-minute step inside the 360, so study time stays at or under 320.
  assert.ok(baseline.minutes<=360);
  assert.ok(baseline.minutes-baseline.steps.filter(s=>s.kind==="rest").reduce((n,s)=>n+s.minutes,0)<=320);
  const latest={meets:false,attempt:{book:"a",id:"1",completedAt:"2026-11-23T10:00:00"},sections:[{name:"Listening",rate:.4}]};
  const repair=todayPlan({...options,checkpoint:{recent:[latest],met:false}});
  assert.ok(repair.steps.some(s=>s.title==="Repair Listening"));
});

import {shortenPlan,maintenancePlan,resultsMonth} from "../n2-study.js";
test("a shortened day keeps checks, the weakest section, radio and a break in 90 minutes, and lists what moves (J3Short)",()=>{
  const plan=todayPlan({days:10,goal:{goal:150,firstToday:0,unchecked:1500},weak:20,checks:30,examDate:new Date(2026,11,6),now:new Date(2026,10,26,9)});
  const short=shortenPlan(plan,90);
  assert.deepEqual(short.steps.map(s=>s.kind),["check","section","radio","rest"]);
  assert.ok(short.minutes<=90);
  assert.ok(short.moved.some(s=>s.href?.includes("queue=new")),"first checks move to tomorrow");
  assert.ok(!short.moved.some(s=>s.kind==="check"));
});
test("after the exam, maintenance is checks and one radio round in about 15 minutes, with no first checks (J3After)",()=>{
  const m=maintenancePlan({checks:6,pace:30});
  assert.deepEqual(m.steps.map(s=>s.kind),["check","radio"]);
  assert.ok(m.minutes<=15);
  assert.equal(resultsMonth(new Date(2026,11,6)),"late January");
});

test("drilling part of a set disqualifies a later first sitting, never an earlier completed one", () => {
  const day = "2026-11-24";
  const questions = [0,1,2,3].map((skill,index)=>({skill,index,key:1}));
  const book = "n2-set-8";
  const attempt = {book, phase:"results", startedAt:day+"T08:00:00Z", completedAt:day+"T11:00:00Z", answers:[1,1,1,1], guesses:[false,false,false,false]};
  const run = createdAt => sprintCheckpoint([attempt],new Map([[book,{questions}],["short",{createdAt,drill:{tag:"change"},questions:[{source:book+"#89"}]}]]),[book],new Date(day+"T12:00:00Z"));
  assert.equal(run(day+"T07:00:00Z").recent.length,0);
  assert.equal(run(day+"T11:30:00Z").recent.length,1);
});
