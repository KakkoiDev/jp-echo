import test from "node:test";
import assert from "node:assert/strict";
import {ensureReviewTrack,nextSkill,recordReviewMode,reviewMode,reviewModeMeta,skillMix,skillReason} from "../review-modes.js";

test("legacy sentences start with Listening and zero progress",()=>{
  const original={id:"s1"};
  const tracked=ensureReviewTrack(original);
  assert.equal(reviewMode(tracked),"listening");
  assert.deepEqual(tracked.reviewTrack.completed,{listening:0,reading:0,writing:0});
  assert.deepEqual(tracked.reviewTrack.attempts,{listening:0,reading:0,writing:0});
  assert.equal(reviewModeMeta(tracked).icon,"聴");assert.equal(reviewModeMeta(tracked).label,"Listening");
});

test("OK rotates one skill at a time and records independent completion",()=>{
  const at=new Date("2026-10-01T12:00:00Z");
  const a=recordReviewMode({id:"s1"},"ok",at);
  assert.equal(reviewMode(a),"reading");
  assert.deepEqual(a.reviewTrack.completed,{listening:1,reading:0,writing:0});
  const b=recordReviewMode(a,"ok",at);
  assert.equal(reviewMode(b),"writing");
  assert.deepEqual(b.reviewTrack.completed,{listening:1,reading:1,writing:0});
  const c=recordReviewMode(b,"ok",at);
  assert.equal(reviewMode(c),"listening");
  assert.deepEqual(c.reviewTrack.completed,{listening:1,reading:1,writing:1});
});

test("Again keeps the same skill and counts the attempt without completing it",()=>{
  const reading=ensureReviewTrack({id:"s1",reviewTrack:{next:"reading",completed:{listening:1},attempts:{listening:1}}});
  const after=recordReviewMode(reading,"again",new Date("2026-10-01T12:00:00Z"));
  assert.equal(reviewMode(after),"reading");
  assert.equal(after.reviewTrack.completed.reading,0);
  assert.equal(after.reviewTrack.attempts.reading,1);
  assert.equal(after.reviewTrack.last.mode,"reading");
  assert.equal(after.reviewTrack.last.rating,"again");
});

test("skill glyphs replace the emoji: 聴 listen, 読 read, 書 write", () => {
  assert.deepEqual(["listening", "reading", "writing"].map(mode => reviewModeMeta(mode).icon), ["聴", "読", "書"]);
  assert.deepEqual(["listening", "reading", "writing"].map(mode => reviewModeMeta(mode).title), ["Listen", "Read it", "Write it"]);
  for (const meta of Object.values({a: reviewModeMeta("listening"), b: reviewModeMeta("reading"), c: reviewModeMeta("writing")})) assert.doesNotMatch(meta.icon, /\p{Extended_Pictographic}/u);
});

test("the card's reason line follows the real track, including Again", () => {
  let s = ensureReviewTrack({id: "s"});
  assert.equal(skillReason(s), "Sound only this time. First visit for this sentence; get it right and next time you will read it.");
  s = recordReviewMode(s, "ok");
  assert.match(skillReason(s), /^The Japanese only this time, without furigana\. You heard it last time; get it right and next time you will write it\.$/);
  s = recordReviewMode(s, "again");
  assert.equal(reviewMode(s), "reading", "Again keeps the skill");
  assert.match(skillReason(s), /did not stick last time, so this skill comes round again/);
  s = recordReviewMode(recordReviewMode(s, "ok"), "ok");
  assert.match(skillReason(s), /You wrote it last time; get it right and next time you will read it\./);
  assert.equal(nextSkill("writing"), "listening");
});

test("today's skill mix counts each due sentence's next skill", () => {
  const read = recordReviewMode(ensureReviewTrack({id: "r"}), "ok");
  assert.deepEqual(skillMix([{id: "a"}, {id: "b"}, read]), {listening: 2, reading: 1, writing: 0});
  assert.deepEqual(skillMix([]), {listening: 0, reading: 0, writing: 0});
});
