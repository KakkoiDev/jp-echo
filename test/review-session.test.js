import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionLimit,limitReviewSession} from '../review-modes.js';
const card=(id,state)=>({id,srs:{state}});
test('defaults independently cap new and existing cards at twenty',()=>{
 const due=Array.from({length:35},(_,i)=>[card('n'+i,0),card('r'+i,2)]).flat();
 const queue=limitReviewSession(due);
 assert.equal(queue.length,40);
 assert.deepEqual(queue,due.slice(0,40));
});
test('learning and relearning share the existing review allowance',()=>{
 const due=[card('n',0),card('l',1),card('r',2),card('re',3),card('n2',0)];
 assert.deepEqual(limitReviewSession(due,{reviewNewLimit:1,reviewExistingLimit:2}).map(x=>x.id),['n','l','r']);
 assert.equal(due.length,5);
});
test('zero disables either bucket independently or both',()=>{
 const due=[card('n',0),card('r',2)];
 assert.deepEqual(limitReviewSession(due,{reviewNewLimit:0}),[due[1]]);
 assert.deepEqual(limitReviewSession(due,{reviewExistingLimit:0}),[due[0]]);
 assert.deepEqual(limitReviewSession(due,{reviewNewLimit:0,reviewExistingLimit:0}),[]);
});
test('large limits are supported and unused allowance does not spill between buckets',()=>{
 const due=Array.from({length:250},(_,i)=>card(i,0));
 assert.equal(limitReviewSession(due,{reviewNewLimit:1000,reviewExistingLimit:0}).length,250);
 assert.equal(limitReviewSession(due,{reviewNewLimit:2,reviewExistingLimit:1000}).length,2);
});
test('limits normalize to nonnegative whole numbers and preserve zero',()=>{
 for(const v of [undefined,null,'',NaN,Infinity,'oops'])assert.equal(sessionLimit(v),20);
 assert.equal(sessionLimit('0'),0);assert.equal(sessionLimit(-4),0);assert.equal(sessionLimit(3.9),3);
});

test('starting a session applies saved limits to the real due queue',async()=>{
 const {readFileSync}=await import('node:fs');
 const {dueSentences}=await import('../srs.js');
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const body=source.match(/async function startReview\(\)\{(.*?)\}\nfunction reviewJapanese/s)[1];
 const items=[card('n',0),card('r',2),card('future',2)].map(x=>({...x,srs:{...x.srs,due:x.id==='future'?'2099-01-01T00:00:00Z':'2020-01-01T00:00:00Z'}}));
 const run=new Function('listSentences','ensureReviewTrack','ensureSchedule','saveSentence','dueSentences','limitReviewSession','settings','showView','renderReview',`return (async()=>{let reviewBusy=false,reviewQueue,reviewIndex,reviewUndo;${body};return reviewQueue})()`);
 let shown;
 const queue=await run(async()=>items,x=>x,x=>x,async()=>{},dueSentences,limitReviewSession,{reviewNewLimit:0,reviewExistingLimit:1},x=>shown=x,()=>{});
 assert.deepEqual(queue.map(x=>x.id),['r']);assert.equal(shown,'session');
});

test('navigation badge reflects session limits rather than the entire backlog',async()=>{
 const {readFileSync}=await import('node:fs');
 const {dueSentences}=await import('../srs.js');
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const body=source.match(/async function refreshDueBadge\(\)\{([^\n]*)\}/)[1];
 const items=Array.from({length:100},(_,id)=>({...card(id,2),srs:{state:2,due:'2020-01-01T00:00:00Z'}}));
 const run=new Function('listSentences','ensureSchedule','dueSentences','limitReviewSession','settings','updateDueBadge',`return (async()=>{${body}})()`);
 for(const limit of [undefined,0,5,200]){
  let count;
  await run(async()=>items,x=>x,dueSentences,limitReviewSession,{reviewExistingLimit:limit},x=>count=x);
  assert.equal(count,Math.min(100,limit??20));
 }
});
