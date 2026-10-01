import test from "node:test";
import assert from "node:assert/strict";
import {ensureReviewTrack,recordReviewMode,reviewMode,reviewModeMeta} from "../review-modes.js";

test("legacy sentences start with Listening and zero progress",()=>{
  const original={id:"s1"};
  const tracked=ensureReviewTrack(original);
  assert.equal(reviewMode(tracked),"listening");
  assert.deepEqual(tracked.reviewTrack.completed,{listening:0,reading:0,writing:0});
  assert.deepEqual(tracked.reviewTrack.attempts,{listening:0,reading:0,writing:0});
  assert.deepEqual(reviewModeMeta(tracked),{icon:"👂",label:"Listening"});
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
