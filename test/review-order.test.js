import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewOrder,reviewSentenceLength,orderReviewSentences,limitReviewSession} from '../review-modes.js';
const card=(id,target,state=0)=>({id,target,srs:{state}});
test('review order defaults to the unchanged schedule',()=>{
 const due=[card('a','長い文です'),card('b','はい')];
 for(const value of [undefined,null,'invalid','scheduled']){
  assert.equal(reviewOrder(value),'scheduled');assert.equal(orderReviewSentences(due,value),due);
 }
});
test('length ordering is stable in both directions and does not mutate cards or queue',()=>{
 const due=[card('long','これは長い文です'),card('tie1','はい'),card('short','字'),card('tie2','いい')];
 const snapshot=structuredClone(due);
 assert.deepEqual(orderReviewSentences(due,'shortest').map(s=>s.id),['short','tie1','tie2','long']);
 assert.deepEqual(orderReviewSentences(due,'longest').map(s=>s.id),['long','tie1','tie2','short']);
 assert.deepEqual(due,snapshot);
});
test('length uses the practiced register and ignores ruby, punctuation, whitespace and meaning',()=>{
 assert.equal(reviewSentenceLength({target:'駅【えき】！ ？',source:'A very long meaning'}),1);
 assert.equal(reviewSentenceLength({target:'駅【えき】',casualTarget:'はい',politeTarget:'お願いします',reviewRegister:'polite'}),6);
 assert.equal(reviewSentenceLength({target:'駅【えき】',casualTarget:'はい'}),2);
 assert.equal(reviewSentenceLength({}),0);
});
test('length selects from all due cards before independently enforcing limits',()=>{
 const due=[card('long-new','とても長い文です'),card('long-review','こちらも長い文です',2),card('short-new','字'),card('short-review','はい',1)];
 assert.deepEqual(limitReviewSession(due,{reviewOrder:'shortest',reviewNewLimit:1,reviewExistingLimit:1}).map(s=>s.id),['short-new','short-review']);
 assert.deepEqual(limitReviewSession(due,{reviewOrder:'longest',reviewNewLimit:1,reviewExistingLimit:1}).map(s=>s.id),['long-review','long-new']);
 assert.deepEqual(limitReviewSession(due,{reviewOrder:'shortest',reviewNewLimit:0,reviewExistingLimit:1}).map(s=>s.id),['short-review']);
});
test('Settings saves and restores the order preference',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const sync=source.match(/function syncReviewOrderInput\(\)\{([^\n]*)\}/)[1];
 const save=source.match(/function saveReviewOrder\(input\)\{([^\n]*)\}/)[1];
 const field={value:''},settings={};let saved;
 const synchronize=()=>new Function('$','settings','reviewOrder',sync)(()=>field,settings,reviewOrder);
 synchronize();assert.equal(field.value,'scheduled');
 const change=new Function('input','settings','reviewOrder','persistSettings','syncReviewOrderInput','flashSaved','renderReviewHome','renderSidePanel',save);
 change({value:'longest'},settings,reviewOrder,()=>{saved={...settings};return true},synchronize,()=>{},()=>{},()=>{});
 assert.equal(saved.reviewOrder,'longest');assert.equal(field.value,'longest');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.indexOf('id="settings-review-order"')>html.indexOf('id="settings-view"'));
 assert.match(source,/resetSettingsForm\(\)\{syncReviewLimitInputs\(\);syncReviewOrderInput\(\)/);
});
