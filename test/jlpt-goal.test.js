import test from "node:test";
import assert from "node:assert/strict";
import {dateKey, parseGoalDate, firstPassEnd, readGoal, reviewFocus} from "../jlpt-goal.js";
import {dailyGoal} from "../n2-study.js";
import {limitReviewSession} from "../review-modes.js";

test("a first pass counts local dates inclusively and keeps its anchor on later visits", () => {
  const plan = {started:"2026-11-24",days:8,exam:"2026-12-06",priority:true};
  assert.equal(dateKey(firstPassEnd(plan)), "2026-12-01");
  assert.equal(parseGoalDate("2026-02-30"), null);
  const quota = dailyGoal({inventory:{words:Array(100),grammar:[]},examDate:parseGoalDate(plan.exam),
    firstPassDate:firstPassEnd(plan),now:parseGoalDate("2026-11-28")});
  assert.equal(quota.daysLeft,4);
  assert.equal(quota.goal,25);
  assert.equal(firstPassEnd({...plan,days:null}),null);
  assert.equal(reviewFocus(plan,parseGoalDate("2026-12-07")),false);
});

test("the active goal promotes due deck cards within the existing Review limits", t => {
  const plan={started:"2026-11-24",days:4,exam:"2026-12-06",priority:true};
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>JSON.stringify(plan)}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,"localStorage",previous);else delete globalThis.localStorage});
  const due=[{id:"other"},{id:"n2-word-4"}];
  const pick=day=>limitReviewSession(due,{reviewNewLimit:1},due,parseGoalDate(day).getTime())[0].id;
  assert.equal(readGoal().days,4);
  assert.equal(pick("2026-12-01"),"n2-word-4");
  assert.equal(pick("2026-12-07"),"other");
  plan.priority=false;
  assert.equal(pick("2026-12-01"),"other");
});
