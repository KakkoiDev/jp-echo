import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadingResolver,readingText,validateReadingCorrection,READING_VERSION} from '../japanese-readings.js';
import {backfillReadings,dictionaryReadings,readingSignature} from '../readings.js';
import {correctSentenceReadings} from '../api.js';
const resolve=createReadingResolver([{w:'重複',r:'ちょうふく'},{w:'食べる',r:'たべる'},{w:'生',r:'なま'},{w:'生',r:'せい'}]);
test('dictionary resolves compound and inflected stem readings, leaving ambiguous words explicit',()=>{
 assert.equal(resolve('重複【じゅうふく】しています。').text,'重複【ちょうふく】しています。');assert.equal(resolve('食【く】べた。').text,'食【た】べた。');assert.equal(resolve('生【なま】').issues.length,1);
});
test('speech uses precisely the displayed reading rather than asking TTS to disambiguate kanji',()=>{
 assert.equal(readingText('重複【ちょうふく】しています。'),'ちょうふくしています。');assert.equal(readingText('重複【じゅうふく】はない。'),'じゅうふくはない。');assert.equal(readingText('同【おな】じ内容【ないよう】'),'おなじないよう');
});
test('reading correction cannot rewrite text or omit kanji readings',()=>{
 assert.equal(validateReadingCorrection('重複はない。','重複【ちょうふく】はない。'),'重複【ちょうふく】はない。');assert.throws(()=>validateReadingCorrection('重複はない。','重複【ちょうふく】がない。'),/changed/);assert.throws(()=>validateReadingCorrection('重複はない。','重複はない。'),/omitted/);
});
test('backfill covers both registers, skips non-Japanese, resumes and leaves review data alone',async()=>{
 const records=new Map([['a',{id:'a',targetLang:'ja',source:'No duplicates.',target:'重複【じゅうふく】はない。',casualTarget:'重複【じゅうふく】はない。',politeTarget:'重複【じゅうふく】はありません。',srs:{reps:4},reviews:[{rating:'ok'}],echoCount:12}],['b',{id:'b',targetLang:'fr',target:'Bonjour'}]]);let calls=0;
 const options={list:async()=>[...records.values()],read:async id=>records.get(id),correct:async s=>{calls++;return Object.fromEntries(['target','casualTarget','politeTarget'].map(k=>[k,s[k].replaceAll('じゅうふく','ちょうふく')]))},write:async(id,expected,next)=>{assert.equal(expected,readingSignature(records.get(id)));records.set(id,next)},yieldTask:async()=>{}};
 await backfillReadings(options);assert.equal(calls,1);assert.equal(records.get('a').source,'No duplicates.');assert.deepEqual(records.get('a').reviews,[{rating:'ok'}]);assert.equal(records.get('a').echoCount,12);await backfillReadings(options);assert.equal(calls,1);
 const modified={...records.get('a'),target:'駅【えき】だ。'};assert.equal(dictionaryReadings(modified).readingVersion,undefined);
});
test('model correction validates every returned register before the application writes it',async()=>{
 const previous=global.fetch;let n=0;
 global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({sentences:[n++?'重複【ちょうふく】はない。':'重複【ちょうふく】がない。']})}}]})});
 try{const corrected=await correctSentenceReadings({target:'重複【じゅうふく】はない。'},{provider:'local',localEndpoint:'http://x/v1/chat/completions'});assert.equal(n,2);assert.equal(corrected.target,'重複【ちょうふく】はない。')}finally{global.fetch=previous}
});
test('learner reading overrides take precedence over dictionary preference',()=>{
 assert.equal(resolve('重複【ちょうふく】',{重複:'じゅうふく'}).text,'重複【じゅうふく】');assert.equal(resolve('食べた',{食:'た'}).text,'食【た】べた');
});
test('editing a checked sentence invalidates its completed reading check',()=>{
 const original={id:'a',targetLang:'ja',target:'駅【えき】',readingVersion:READING_VERSION};original.readingSignature=readingSignature(original);
 const changed=dictionaryReadings({...original,target:'学校【がっこう】'});assert.equal(changed.readingVersion,undefined);
});

test('exact reported sentence repairs 言う even when marked checked',()=>{
 const target='ざっくり言【げん】うと、移行【いこう】は半分【はんぶん】終【お】わっています。';
 const record={target,readingVersion:READING_VERSION};record.readingSignature=readingSignature(record);
 assert.equal(dictionaryReadings(record).target,'ざっくり言【い】うと、移行【いこう】は半分【はんぶん】終【お】わっています。');
});

test('backfill rejects an AI regression of the dictionary reading for 言う',async()=>{
 const original={id:'say',target:'ざっくり言【げん】うと、移行【いこう】は半分【はんぶん】終【お】わっています。'};
 let saved;
 await backfillReadings({list:async()=>[original],read:async()=>original,correct:async()=>({target:original.target}),write:async(id,signature,next)=>{saved=next},yieldTask:async()=>{}});
 assert.ok(saved.target.includes('言【い】う'));assert.equal(saved.readingVersion,READING_VERSION);
});

test('話し合う in the reported sharing sentence corrects both kanji readings',()=>{
 const target='どこが共有【きょうゆう】して話【はなし】し合【ごう】うのに一番【いちばん】いい場所【ばしょ】なの？';
 const corrected=dictionaryReadings({target}).target;
 assert.equal(corrected,'どこが共有【きょうゆう】して話【はな】し合【あ】うのに一番【いちばん】いい場所【ばしょ】なの？');
 assert.ok(readingText(corrected).includes('はなしあう'));
});

test('shared longest compound matching handles polite and past 話し合う',()=>{
 for(const [wrong,right] of [['話【はなし】し合【ごう】います','話【はな】し合【あ】います'],['話【はなし】し合【ごう】った','話【はな】し合【あ】った']]){
  assert.equal(dictionaryReadings({target:wrong}).target,right);
 }
});
