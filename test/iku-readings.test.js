import test from 'node:test';
import assert from 'node:assert/strict';
import {dictionaryReadings} from '../readings.js';
test('real dictionary repairs persisted iku readings without changing history',()=>{
 for(const suffix of ['く','きます','かない','ける','こう','った','って']){
 const record={id:123,target:`行【ぎょう】${suffix}`,history:[{rating:3}],readingVersion:2};
 const corrected=dictionaryReadings(record);
 assert.equal(corrected.target,`行【い】${suffix}`);
 assert.deepEqual(corrected.history,record.history);
 assert.equal(corrected.id,record.id);
 }
 assert.equal(dictionaryReadings({target:'行【おこな】った'}).target,'行【おこな】った');
});

test('real dictionary fixes the reported difficult judgment and adjective inflections',()=>{
 assert.equal(dictionaryReadings({target:'判断【はんだん】が難【なん】しいところです。'}).target,'判断【はんだん】が難【むずか】しいところです。');
 for(const ending of ['い','くない','かった','ければ'])assert.equal(dictionaryReadings({target:`難【なん】し${ending}`}).target,`難【むずか】し${ending}`);
});

test('reported onaji sentence is repaired for display and browser speech',async()=>{
 const {speechText}=await import('../japanese-readings.js');
 const target=dictionaryReadings({target:'同【どう】じような経験【けいけん】が何度【なんど】かあります。'}).target;
 assert.equal(target,'同【おな】じような経験【けいけん】が何度【なんど】かあります。');
 assert.equal(speechText(target),'オナじようなケイケンがナンドかあります。');
});
