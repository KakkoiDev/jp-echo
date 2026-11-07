import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DICT_BUCKETS,bucketOf,bucketsFor,packPieces,createDictionary,pieceName,stemOf} from '../dictionary.js';
import {addLookupWords,wordSpans,wordsIn,word,ALL,TOTAL,isLookupWord} from '../words.js';

const CHOUKAI={id:1428310,w:'朝会',r:'ちょうかい',en:['morning assembly; morning meeting'],pos:['n']};
const pieces=packPieces([CHOUKAI,{id:2,w:'あい',r:'あい',en:['x'],pos:['n']},{id:3,w:'見上げる',r:'みあげる',en:['to look up at'],pos:['v1','vt']}]);
const fakeFetch=calls=>async url=>{calls.push(url);if(url.endsWith('manifest.json'))return {ok:true,json:async()=>({version:'2026-11-01',count:2,buckets:DICT_BUCKETS})};
 const n=Number(url.match(/(\d{3})\.json$/)[1]);return {ok:true,json:async()=>pieces[n]}};

test('pieces: one per first character, short kana-only words left out',()=>{
 assert.equal(pieces.length,DICT_BUCKETS);
 assert.deepEqual(pieces[bucketOf('朝')].map(r=>r[1]),['朝会']);
 assert.equal(pieces.flat().some(r=>r[1]==='あい'),false,'a two-kana word would match any run of kana');
 assert.equal(pieceName(7),'007.json');assert.equal(bucketsFor('朝会。abc').size,2,'only 朝 and 会: punctuation and latin fetch nothing');
 assert.equal(stemOf('見上げる',['v1']),'見上げ');assert.equal(stemOf('朝会',['n']),'朝会');
});

test('a sentence fetches only its characters’ pieces, from a dated folder, once',async()=>{
 const calls=[],dict=createDictionary({fetchImpl:fakeFetch(calls)});
 const found=await dict.wordsFor('それでは、朝会を始めます。');
 assert.deepEqual(found.map(w=>w.w),['朝会']);
 assert.ok(calls.every(u=>u.endsWith('manifest.json')||/\/dict\/2026-11-01\/\d{3}\.json$/.test(u)),'pieces live under dict/<version>/');
 const before=calls.length;await dict.wordsFor('朝会');assert.equal(calls.length,before,'a piece is fetched once per session');
 assert.deepEqual((await dict.wordsFor('山を見上げた。')).map(w=>w.w),['見上げる'],'a conjugated verb is found by its stem');
});

test('no dictionary built yet: lookups find nothing and break nothing',async()=>{
 const dict=createDictionary({fetchImpl:async()=>({ok:false,json:async()=>null})});
 assert.deepEqual(await dict.wordsFor('朝会'),[]);
});

test('looked-up words mark and open like any word, but never join the Words wall',()=>{
 const t='それでは、朝会を始めます。',total=TOTAL,size=ALL.length;
 assert.equal(wordSpans(t).some(s=>t.slice(s.start,s.end)==='朝会'),false);
 assert.equal(addLookupWords([CHOUKAI]),1);assert.equal(addLookupWords([CHOUKAI]),0,'added once');
 assert.ok(wordSpans(t).some(s=>t.slice(s.start,s.end)==='朝会'));assert.ok(wordsIn(t).has(1428310));
 assert.equal(word(1428310).w,'朝会');assert.ok(isLookupWord(word(1428310)));
 assert.equal(ALL.length,size);assert.equal(TOTAL,total,'the wall and its totals are unchanged');
 assert.equal(addLookupWords([{id:ALL[0].id,w:'偽',r:'にせ',en:['x'],pos:[]}]),0,'a common word keeps its id');
});

test('the app looks up uncommon words and the worker keeps the pieces',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(app,/dictionary\.wordsFor\(plain\)\.then\(found=>\{addLookupWords\(found\)/);
 assert.match(app,/root\.innerHTML=root\.__vocabularyMarkup;enableVocabulary\(root,target,lang,sentence,\{grammarHost,explain,lookedUp:true\}\)/,'one redraw, from the original markup');
 assert.match(sw,/const DICT_CACHE="jp-echo-dict";/);assert.match(sw,/"\.\/dictionary\.js"/);
 assert.doesNotMatch(sw,/startsWith\("jp-echo-dict"\)/,'app updates never clear the kept pieces');
});
