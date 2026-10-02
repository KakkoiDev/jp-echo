import test from 'node:test';import assert from 'node:assert/strict';import {analyzeSentenceGrammar} from '../api.js';import {coverage} from '../grammar.js';
test('analysis retains exact grammar evidence usable by existing sentence coverage',async()=>{
 const previous=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({matches:[{id:'です',quote:'です'},{id:'fake',quote:'本'}]})}}]})});
 try{const result=await analyzeSentenceGrammar('本です。',[{id:'です',title:'です'}],{provider:'deepseek',providerKeys:{deepseek:'test'}});assert.deepEqual(result.grammar,['です']);assert.deepEqual(coverage([{id:'sentence',createdAt:'2026-01-01',...result}]).get('です'),['sentence'])}finally{global.fetch=previous}
});
