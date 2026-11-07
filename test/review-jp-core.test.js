import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reviewSentence,REVIEW_MODES} from "../review.js";

const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");

// review.js is JP Core's browser/review.js, copied unchanged (README § JP Core).
// These due dates were produced by Echo's own srs.js bundle before the switch:
// a learner's stored `srs` must keep scheduling exactly as it did.
test("the shared scheduler gives the due dates Echo's own engine gave", () => {
  const steps=[
    ["ok","2026-01-01T09:00:00.000Z","2026-01-01T09:10:00.000Z",1,1,0],
    ["ok","2026-01-01T09:15:00.000Z","2026-01-03T09:15:00.000Z",2,2,0],
    ["ok","2026-01-02T09:00:00.000Z","2026-01-11T09:00:00.000Z",2,3,0],
    ["again","2026-01-12T09:00:00.000Z","2026-01-12T09:10:00.000Z",3,4,1],
    ["ok","2026-01-12T09:20:00.000Z","2026-01-13T09:20:00.000Z",2,5,1],
    ["ok","2026-01-20T09:00:00.000Z","2026-01-28T09:00:00.000Z",2,6,1]
  ];
  let sentence={id:"a",createdAt:"2026-01-01T00:00:00.000Z"};
  for(const [rating,at,due,state,reps,lapses] of steps){
    // Stored state goes through JSON (IndexedDB, backups) between visits.
    sentence=JSON.parse(JSON.stringify(reviewSentence(sentence,rating,new Date(at))));
    assert.deepEqual([sentence.srs.due,sentence.srs.state,sentence.srs.reps,sentence.srs.lapses],[due,state,reps,lapses],at);
  }
});

test("review.js is the one review engine: precached, checked, imported directly", async () => {
  const source=read("review.js");
  assert.doesNotMatch(source,/^\s*import\s/m,"JP Core's copy has no imports");
  assert.match(read("sw.js"),/"\.\/review\.js"/);
  assert.match(read("package.json"),/node --check review\.js/);
  for(const gone of ["srs.js","anki-schedule.js"]){
    assert.doesNotMatch(read("sw.js"),new RegExp(gone.replace(".","\\.")));
    assert.doesNotMatch(read("app.js"),new RegExp(gone.replace(".","\\.")));
  }
  // Echo's presentation layer reuses JP Core's rotation rather than its own.
  assert.match(read("review-modes.js"),/from "\.\/review\.js"/);
  assert.deepEqual(Object.keys((await import("../review-modes.js")).REVIEW_MODE_META),[...REVIEW_MODES]);
});
