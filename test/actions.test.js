import test from "node:test";
import assert from "node:assert/strict";
import {saveDiscussionTurn} from "../actions.js";

test("discussion save waits for persistence and returns the record that was written",async()=>{
  let release,written;const pending=new Promise(resolve=>release=resolve);
  const save=async sentence=>{written=sentence;await pending};
  let settled=false;
  const promise=saveDiscussionTurn({source:"There are many resources.",target:"資源【しげん】が豊富【ほうふ】です。"},{sourceLang:"en",targetLang:"ja",now:()=>new Date("2026-09-29T00:00:00Z"),save}).then(x=>(settled=true,x));
  await Promise.resolve();
  assert.equal(settled,false,"UI must not claim Saved before IndexedDB completes");
  assert.equal(written.source,"There are many resources.");
  release();
  const saved=await promise;
  assert.equal(settled,true);
  assert.equal(saved.id,written.id);
  assert.equal(saved.targetLang,"ja");
});

test("discussion save failure is propagated and never becomes a fake success",async()=>{
  await assert.rejects(()=>saveDiscussionTurn({source:"x",target:"豊富【ほうふ】だ"},{sourceLang:"en",targetLang:"ja",save:async()=>{throw new Error("disk failed")}}),/disk failed/);
});
