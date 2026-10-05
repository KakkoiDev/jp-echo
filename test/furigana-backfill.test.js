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
