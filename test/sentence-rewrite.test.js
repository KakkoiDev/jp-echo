import test from 'node:test';
import assert from 'node:assert/strict';
import {rewriteSentence} from '../api.js';
import {replaceSentenceContent} from '../core.js';
test('rewrite sends current draft and directions and updates meaning and registers',async()=>{
 const original=global.fetch;let request;
 global.fetch=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({source:'Go to the station.',casual:'駅【えき】に行【い】く。',polite:'駅【えき】に行【い】きます。'})}}]})}};
 try{const result=await rewriteSentence({current:'長い文',source:'A long sentence',instruction:'Keep only the second part and use 駅'},{provider:'deepseek',providerKeys:{deepseek:'test'},sourceLang:'en',targetLang:'ja'});assert.equal(result.source,'Go to the station.');assert.match(request.messages[1].content,/second part/);assert.match(request.messages[0].content,/updated meaning/)}finally{global.fetch=original}
});
test('replacing content preserves identity, timestamps and every review field',()=>{
 const old={id:'card',sourceLang:'en',targetLang:'ja',createdAt:'2020-01-01',echoCount:12,reviews:[{rating:'ok'}],srs:{due:'tomorrow'},reviewTrack:{completed:{listening:2}}};
 const next=replaceSentenceContent(old,{source:'Station',casual:'駅【えき】',polite:'駅【えき】です。'},new Date('2026-10-02'));
 for(const key of ['id','createdAt','echoCount','reviews','srs','reviewTrack'])assert.deepEqual(next[key],old[key]);assert.equal(next.plainTarget,'駅');assert.equal(next.plainPoliteTarget,'駅です。');assert.equal(old.source,undefined);
});
