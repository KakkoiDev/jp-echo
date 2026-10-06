import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewStats} from '../review-modes.js';
const now=Date.parse('2026-10-06T14:00:00Z'),day=86400000;
const event=(ago,rating='ok',mode='listening')=>({at:new Date(now-ago).toISOString(),rating,mode});
test('rolling 24h counts both grades and only valid past timestamps',()=>{
 const items=[{id:'a',reviews:[event(0),event(day-1,'again','reading'),event(day),event(-1),{at:'bad',rating:'ok'},event(3,'skip')]}];
 const before=structuredClone(items),s=reviewStats(items,now);
 assert.equal(s.last24h,2);assert.equal(s.total,3);assert.equal(s.ok24h,1);assert.equal(s.again24h,1);assert.equal(s.unique24h,1);assert.equal(s.modes.reading,1);assert.deepEqual(items,before);
});
test('week bins partition the rolling seven-day history without duplicates',()=>{
 const s=reviewStats([{id:'a',reviews:[event(0),event(day),event(2*day),event(7*day-1),event(7*day)]}],now);
 assert.equal(s.last7d,4);assert.equal(s.days.reduce((n,d)=>n+d.count,0),4);assert.equal(s.days[0].count,1);assert.equal(s.days[1].count,1);assert.equal(s.total,5);
});
test('empty legacy records and missing skill metadata remain usable',()=>{
 const s=reviewStats([{id:'a'},{id:'b',reviews:null},{id:'c',reviews:[{at:new Date(now).toISOString(),rating:'ok'}]}],now);
 assert.equal(s.last24h,1);assert.equal(s.total,1);assert.deepEqual(s.modes,{listening:0,reading:0,writing:0});
});
test('restoring a snapshot after undo removes its grade from stats',()=>{
 const before={id:'a',reviews:[event(1000)]};
 const after={...before,reviews:[...before.reviews,event(0,'again')]};
 assert.equal(reviewStats([after],now).last24h,2);assert.equal(reviewStats([before],now).last24h,1);
});
