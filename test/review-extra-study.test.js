import test from 'node:test';
import assert from 'node:assert/strict';
import {extraStudySession,limitReviewSession} from '../review-modes.js';
const card=(id,target='文',state=2)=>({id,target,srs:{state,due:'2020-01-01T00:00:00Z'}});
test('extra study bypasses exhausted allowances without changing saved settings or history',()=>{
 const settings={reviewNewLimit:0,reviewExistingLimit:0,reviewOrder:'shortest'};
 const due=Array.from({length:35},(_,i)=>card(i));const snapshot=structuredClone({settings,due});
 assert.equal(limitReviewSession(due,settings).length,0);assert.equal(extraStudySession(due,due,settings).length,20);
 assert.deepEqual({settings,due},snapshot);
});
test('extra study uses the chosen ordering and available due cards before early cards',()=>{
 const due=[card('long','とても長い文です'),card('short','文')],future=card('future','あ');future.srs.due='2099-01-01T00:00:00Z';
 assert.deepEqual(extraStudySession(due,[future,...due],{reviewOrder:'shortest'}).map(s=>s.id),['short','long']);
 assert.deepEqual(extraStudySession(due,due,{reviewOrder:'longest'}).map(s=>s.id),['long','short']);
});
test('when nothing is due, an explicit early-review batch uses the nearest scheduled cards',()=>{
 const soon=card('soon'),later=card('later');soon.srs.due='2098-01-01T00:00:00Z';later.srs.due='2099-01-01T00:00:00Z';
 assert.deepEqual(extraStudySession([],[later,soon]).map(s=>s.id),['soon','later']);
 assert.deepEqual(extraStudySession([],[]),[]);
 assert.deepEqual(extraStudySession([],[{...soon,skipped:true}]),[]);
});
test('extra study starts the standard review flow with normal grading and both entry points',async()=>{
 const {readFileSync}=await import('node:fs');const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const body=app.match(/async function startExtraStudy\(\)\{([^\n]*)\}/)[1];
 const items=Array.from({length:25},(_,i)=>card(i));let shown,rendered=false;
 const run=new Function('listSentences','ensureReviewTrack','ensureSchedule','saveSentence','dueSentences','extraStudySession','settings','showView','renderReview',`return (async()=>{let reviewBusy=false,reviewQueue,reviewIndex,reviewUndo;${body};return reviewQueue})()`);
 const queue=await run(async()=>items,s=>s,s=>s,async()=>{},s=>s,extraStudySession,{reviewExistingLimit:0},view=>shown=view,()=>rendered=true);
 assert.equal(queue.length,20);assert.equal(shown,'session');assert.equal(rendered,true);
 assert.match(app,/review-extra-study"\)\.onclick=startExtraStudy/);assert.match(app,/review-extra-more"\)\.onclick=startExtraStudy/);
});
