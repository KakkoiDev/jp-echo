import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyReviewBudget,limitReviewSession} from '../review-modes.js';
const now=Date.parse('2026-10-19T12:00:00Z'),day=20*3600000;
const event=(state,at=now-3600000,rating='ok')=>({state,at:new Date(at).toISOString(),rating});
const card=(id,state,reviews=[])=>({id,target:'はい',srs:{state,due:'2020-01-01T00:00:00Z'},reviews});
test('finishing 200 existing reviews leaves zero even though other cards remain due',()=>{
 const completed=Array.from({length:200},(_,i)=>card('done'+i,2,[event(2)]));
 const due=Array.from({length:300},(_,i)=>card('due'+i,2));
 const settings={reviewNewLimit:0,reviewExistingLimit:200};
 assert.equal(limitReviewSession(due,settings,[...completed,...due],now).length,0);
 assert.equal(limitReviewSession(due,settings,[...JSON.parse(JSON.stringify(completed)),...due],now).length,0,'survives reopening');
});
test('new and existing daily allowances retain their separate limits and pre-grade state',()=>{
 const items=[card('introduced',1,[event(0)]),card('learning',1,[event(1)]),card('new',0),card('review',2)];
 const budget=dailyReviewBudget(items,{reviewNewLimit:2,reviewExistingLimit:3},now);
 assert.deepEqual(budget.used,{new:1,review:1});assert.deepEqual(budget.remaining,{new:1,review:2});
 assert.equal(limitReviewSession(items.slice(2),{reviewNewLimit:1,reviewExistingLimit:1},items,now).length,0);
});
test('allowance releases exactly 20 hours after the grade, without deleting history',()=>{
 const items=[card('done',2,[event(2,now-day+1)]),card('due',2)];
 assert.equal(limitReviewSession([items[1]],{reviewExistingLimit:1},items,now).length,0);
 assert.equal(limitReviewSession([items[1]],{reviewExistingLimit:1},items,now+1).length,1);
 assert.equal(items[0].reviews.length,1);
});
test('Again consumes allowance and undo restores it',()=>{
 const items=[card('again',3,[event(2,now-5000,'again')]),card('due',2)];
 assert.equal(limitReviewSession([items[1]],{reviewExistingLimit:1},items,now).length,0);
 items[0].reviews.pop();assert.equal(limitReviewSession([items[1]],{reviewExistingLimit:1},items,now).length,1);
});
test('legacy history is classified by first historical attempt, not current card state',()=>{
 const items=[card('old',2,[{at:new Date(now-day-1).toISOString(),rating:'ok'},{at:new Date(now-1).toISOString(),rating:'ok'}]),card('introduced',1,[{at:new Date(now-1).toISOString(),rating:'again'}])];
 assert.deepEqual(dailyReviewBudget(items,{},now).used,{new:1,review:1});
});
test('invalid, future, skipped and expired entries cannot consume allowance',()=>{
 const items=[card('a',2,[event(2,now+1),event(2,now-day),event(2,now-1,'skip'),{at:'invalid',rating:'ok'}])];
 assert.deepEqual(dailyReviewBudget(items,{},now).used,{new:0,review:0});
});
test('lowering a limit reports the first time allowance will actually be free',()=>{
 const history=[event(2,now-3000),event(2,now-2000),event(2,now-1000)];
 const budget=dailyReviewBudget([card('a',2,history)],{reviewExistingLimit:1},now);
 assert.equal(budget.nextAvailable,now-1000+day);
});
test('real review entry records its prior state for daily accounting',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(source,/rating,mode,state:sentence\.srs\?\.state\?\?0/);
});
test('real navigation badge counts history of cards that are no longer due',async()=>{
 const {readFileSync}=await import('node:fs');const {dueSentences}=await import('../srs.js');
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');const body=source.match(/async function refreshDueBadge\(\)\{([^\n]*)\}/)[1];
 const completed=card('done',2,[event(2,Date.now()-1000)]);completed.srs.due='2099-01-01T00:00:00Z';
 let count;await new Function('listSentences','ensureSchedule','dueSentences','limitReviewSession','settings','updateDueBadge',`return (async()=>{${body}})()`)(async()=>[completed,card('due',2)],s=>s,dueSentences,limitReviewSession,{reviewNewLimit:0,reviewExistingLimit:1},value=>count=value);
 assert.equal(count,0);
});

test('20-hour reset frees both allowances before 24 hours and preserves recent grades',()=>{
 const items=[card('new',1,[event(0,now-21*3600000)]),card('old',2,[event(2,now-21*3600000)]),card('recent',2,[event(2,now-19*3600000)])];
 const before=structuredClone(items);
 const budget=dailyReviewBudget(items,{reviewNewLimit:1,reviewExistingLimit:2},now);
 assert.deepEqual(budget.used,{new:0,review:1});
 assert.deepEqual(budget.remaining,{new:1,review:1});
 assert.deepEqual(items,before);
});
