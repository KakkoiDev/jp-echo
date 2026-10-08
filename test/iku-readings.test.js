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
