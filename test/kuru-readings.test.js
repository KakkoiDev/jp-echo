import test from 'node:test';
import assert from 'node:assert/strict';
import {dictionaryReadings,readingSignature,backfillReadings} from '../readings.js';
import {READING_VERSION,readingText,speechText} from '../japanese-readings.js';
const target='五【ご】人【にん】の人【ひと】が来【らい】た。';
test('the reported five-people sentence renders and speaks kita with the real dictionary',()=>{
 const corrected=dictionaryReadings({target});
 assert.ok(corrected.target.endsWith('来【き】た。'));
 assert.ok(readingText(corrected.target).endsWith('がきた。'));
 assert.ok(speechText(corrected.target).endsWith('がキた。'));
});
test('real dictionary distinguishes irregular kuru suffixes from noun compounds',()=>{
 for(const [surface,reading] of [['た','き'],['て','き'],['ました','き'],['なさい','き'],['ない','こ'],['なければ','こ'],['られます','こ'],['させる','こ'],['よう','こ'],['る','く'],['れば','く']]){
  assert.equal(dictionaryReadings({target:`来【らい】${surface}`}).target,`来【${reading}】${surface}`);
 }
 assert.equal(dictionaryReadings({target:'来年【らいねん】です。'}).target,'来年【らいねん】です。');
});
test('saved checked sentences are repaired once after this reading-version upgrade',async()=>{
 const original={id:'five',target,readingVersion:READING_VERSION-1,source:'Five people came.',srs:{state:2,reps:7},reviews:[{rating:'ok',at:'2026-10-20T12:00:00Z'}]};original.readingSignature=readingSignature(original);
 let current=original,writes=0,reads=0;
 const options={list:async()=>[current],read:async()=>{reads++;return current},write:async(id,signature,next)=>{assert.equal(id,'five');assert.equal(signature,readingSignature(current));current=next;writes++},yieldTask:async()=>{}};
 await backfillReadings(options);
 assert.ok(current.target.endsWith('来【き】た。'));assert.equal(current.source,original.source);assert.deepEqual(current.reviews,original.reviews);assert.deepEqual(current.srs,original.srs);assert.equal(current.readingVersion,READING_VERSION);
 await backfillReadings(options);assert.equal(writes,1);assert.equal(reads,1);
});

test('a stale checked marker cannot preserve raita when a card is displayed',()=>{
 const saved={target,readingVersion:READING_VERSION};saved.readingSignature=readingSignature(saved);
 assert.ok(dictionaryReadings(saved).target.endsWith('来【き】た。'));
});
test('failed AI on an earlier card cannot prevent later local kita repairs',async()=>{
 const records=new Map([['unknown',{id:'unknown',target:'龘【とう】です。'}],['five',{id:'five',target}]]);
 await assert.rejects(backfillReadings({list:async()=>[...records.values()],read:async id=>records.get(id),write:async(id,signature,next)=>records.set(id,next),correct:async()=>{assert.ok(records.get('five').target.endsWith('来【き】た。'));throw Error('offline')},yieldTask:async()=>{}}),/offline/);
 assert.ok(records.get('five').target.endsWith('来【き】た。'));
 // Ambiguous 人 can still need AI; its deterministic 来 repair is saved first.
 assert.equal(records.get('unknown').readingVersion,undefined);
});
