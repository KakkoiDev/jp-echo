import test from "node:test";
import assert from "node:assert/strict";
import {ankiSchedule} from "../anki-schedule.js";

test("exports reviewed FSRS progress to Anki card fields",()=>{
  const created=Date.parse("2026-09-20T00:00:00Z")/1000;
  const row=ankiSchedule({due:"2026-10-01T00:00:00Z",scheduled_days:7,reps:4,lapses:1,state:2},created);
  assert.deepEqual(row,{type:2,queue:2,due:11,interval:7,factor:2500,reps:4,lapses:1,left:0});
});

test("keeps short-term learning due timestamps",()=>{
  const row=ankiSchedule({due:"2026-09-20T00:01:00Z",scheduled_days:0,reps:1,lapses:0,state:1},0);
  assert.equal(row.queue,1);
  assert.equal(row.due,Date.parse("2026-09-20T00:01:00Z")/1000);
  assert.equal(row.left,1001);
});
