import test from "node:test";
import assert from "node:assert/strict";
import {dueSentences,ensureSchedule,isDue,reviewSentence} from "../srs.js";

const now=new Date("2026-01-01T12:00:00Z");
const sentence={id:"one",english:"Hello",japanese:"こんにちは",createdAt:now.toISOString(),updatedAt:now.toISOString()};

test("new translations are immediately due",()=>{
  const scheduled=ensureSchedule(sentence,now);
  assert.equal(isDue(scheduled,now),true);
  assert.deepEqual(dueSentences([scheduled],now).map(item=>item.id),["one"]);
});

test("OK and Again use FSRS ratings",()=>{
  const ok=reviewSentence(sentence,"ok",now);
  const again=reviewSentence(sentence,"again",now);
  assert.equal(ok.srs.reps,1);
  assert.equal(again.srs.reps,1);
  assert.equal(again.srs.lapses,0);
  assert.ok(Date.parse(ok.srs.due)>now.getTime());
  assert.ok(Date.parse(again.srs.due)>now.getTime());
});
