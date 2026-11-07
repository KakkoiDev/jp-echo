import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DRILL_POOL,DRILL_SIZE,drillRound,drillChoices,startDrill,answerDrill,nextDrill,drillDone,drillProgress} from '../mora-drill.js';
import {MORA_VOICED} from '../core.js';
import {parseRoute,routeFor} from '../routes.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const seeded=(seed=7)=>()=>{seed=(seed*9301+49297)%233280;return seed/233280};

test('a round is ten sounds: last misses first, then sounds from noted words, then the table',()=>{
 const round=drillRound({misses:['ち','れ'],readings:['べんきょう'],random:seeded()});
 assert.equal(round.length,DRILL_SIZE);assert.deepEqual(round.slice(0,2),['ち','れ']);
 for(const kana of ['べ','ん','きょ','う'])assert.ok(round.includes(kana),kana);
 assert.equal(new Set(round).size,round.length,'no sound twice');
 assert.ok(!DRILL_POOL.includes('を'),'を shares お’s tea');
});

test('choices are four of the same kind, so the corner mark never gives a voiced sound away',()=>{
 for(const kana of ['く','ぐ','ぱ','きょ']){const four=drillChoices(kana,seeded(3));assert.equal(four.length,4);assert.ok(four.includes(kana));
  const kind=k=>k.length>1?'c':MORA_VOICED[k]?MORA_VOICED[k][1]:'b';assert.ok(four.every(k=>kind(k)===kind(kana)),kana+': '+four)}
});

test('a miss shows the answer and comes back once at the end; only first tries count',()=>{
 let s=startDrill(['く','さ']);
 s=answerDrill(s,'か');assert.equal(s.answered.right,false);assert.deepEqual(s.queue,['く','さ','く']);assert.deepEqual(s.misses,['く']);
 s=nextDrill(s);s=answerDrill(s,'さ');s=nextDrill(s);
 assert.deepEqual(drillProgress(s),{n:2,total:2,repeat:true});
 s=answerDrill(s,'か');assert.deepEqual(s.queue,['く','さ','く'],'a second miss does not queue again');
 s=nextDrill(s);assert.ok(drillDone(s));assert.equal(s.firstTry,1);
});

test('free practice: its own route, never scheduled, never on the Review badge or FSRS',()=>{
 assert.equal(routeFor({view:'drill'}),'/mora/drill');assert.equal(parseRoute('/mora/drill').view,'drill');
 const drill=read('mora-drill.js'),app=read('app.js');
 assert.doesNotMatch(drill,/srs|reviewSentence|saveSentence|updateDueBadge/);
 const body=app.slice(app.indexOf('let drill=null;'),app.indexOf('$("#mora-drill-open")'));
 assert.doesNotMatch(body,/saveSentence|reviewSentence|updateDueBadge|ensureSchedule/);
 assert.match(read('sw.js'),/"\.\/mora-drill\.js"[\s\S]*mora\\\/drill\|/);
});
