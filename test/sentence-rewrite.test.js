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
const local={provider:'local',localEndpoint:'http://x/v1/chat/completions',sourceLang:'en',targetLang:'ja'};
function mockReplies(replies,requests){global.fetch=async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(replies[Math.min(requests.length-1,replies.length-1)])}}]})}}}
test('unchanged wording triggers a retry even when readings and punctuation differ',async()=>{
 const original=global.fetch,requests=[];
 mockReplies([{source:'Go to the station.',casual:'駅【えき】 に 行【い】く！',polite:'駅に行きます。'},{source:'Walk to the station.',casual:'駅まで歩く。',polite:'駅まで歩きます。'}],requests);
 try{const result=await rewriteSentence({current:'駅に行く。',source:'Go to the station.',instruction:'Use walking instead'},local);assert.equal(requests.length,2);assert.equal(result.casual,'駅まで歩く。');assert.match(requests[1].messages[1].content,/repeated the original/)}finally{global.fetch=original}
});
test('a change to the hidden casual form cannot mask an unchanged polite draft',async()=>{
 const original=global.fetch,requests=[];
 mockReplies([{source:'Go to the station.',casual:'駅まで向かう。',polite:'駅に行きます。'}],requests);
 try{await assert.rejects(rewriteSentence({current:'駅に行きます。',source:'Go to the station.',instruction:'Make a different example',register:'polite'},local),/original sentence twice/);assert.equal(requests.length,2)}finally{global.fetch=original}
});
test('non-Japanese rewrites also reject an unchanged draft',async()=>{
 const original=global.fetch,requests=[];
 mockReplies([{source:'Hello.',translation:'Bonjour !'}],requests);
 try{await assert.rejects(rewriteSentence({current:'Bonjour.',source:'Hello.',instruction:'Use a different greeting'},{...local,targetLang:'fr'}),/original sentence twice/)}finally{global.fetch=original}
});
