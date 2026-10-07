import test from 'node:test';import assert from 'node:assert/strict';
import {validateDeckBackup,deckJSONURL,fetchDeckBackup} from '../imports.js';import {mergeSentences} from '../core.js';
const card={id:'deck-1',source:'Who is that person?',target:'あの人は誰？'},deck={schemaVersion:2,sentences:[card]};
test('deck JSON accepts full sentences, supplies safe dates and preserves progress on reimport',()=>{const parsed=validateDeckBackup(deck);assert.equal(parsed.sentences[0].createdAt,'1970-01-01T00:00:00.000Z');const existing={...parsed.sentences[0],id:'mine',echoCount:8,srs:{reps:4}};const merged=mergeSentences([existing],parsed.sentences);assert.equal(merged.length,1);assert.equal(merged[0].id,'mine');assert.deepEqual(merged[0].srs,existing.srs)});
test('invalid rows reject the entire deck before persistence',()=>{for(const invalid of [null,{}, {schemaVersion:99,sentences:[]},{...deck,sentences:[card,{...card,target:''}]},{...deck,sentences:[{...card,casualTarget:12}]}])assert.throws(()=>validateDeckBackup(invalid));assert.equal(deck.sentences[0].createdAt,undefined)});
test('older Echo backups remain supported',()=>{assert.equal(validateDeckBackup({schemaVersion:1,sentences:[{id:'old',english:'A person',japanese:'人'}]}).sentences[0].target,'人')});
test('GitHub file links become downloadable raw JSON URLs',()=>{assert.equal(deckJSONURL('https://github.com/owner/repo/blob/main/deck.json'),'https://raw.githubusercontent.com/owner/repo/main/deck.json');for(const url of ['javascript:alert(1)','https://user:pass@example.com/deck.json','bad'])assert.throws(()=>deckJSONURL(url))});
test('URL imports validate downloaded JSON and show actionable download failures',async()=>{assert.equal((await fetchDeckBackup('https://example.com/deck.json',{fetchImpl:async()=>({ok:true,json:async()=>deck})})).sentences.length,1);await assert.rejects(fetchDeckBackup('https://example.com/deck.json',{fetchImpl:async()=>({ok:false,status:404})}),/404/);await assert.rejects(fetchDeckBackup('https://example.com/deck.json',{fetchImpl:async()=>{throw Error('CORS')}}),/Import deck JSON/);await assert.rejects(fetchDeckBackup('https://example.com/deck.json',{fetchImpl:async()=>({ok:true,json:async()=>{throw Error('HTML')}})}),/not a JSON file/)});

import {runImportFeedback} from '../imports.js';
function importUI(){return {textContent:'',dataset:{},classList:{toggle(){}},setAttribute(key,value){this[key]=value}}}
test('import shows pending before work, waits for persistence before success, and restores controls',async()=>{
 const status=importUI(),button={disabled:false},states=[];let finish;const saving=new Promise(resolve=>finish=resolve);
 const task=runImportFeedback({status,buttons:[button],label:'backup.json',load:async()=>deck,save:()=>saving,yieldUI:async()=>{states.push(status.textContent)}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(button.disabled,true);assert.match(status.textContent,/Importing 1/);assert.equal(status.dataset.state,'pending');
 finish({added:0,total:899});await task;assert.match(status.textContent,/Import complete/);assert.match(status.textContent,/existing sentences merged/);assert.equal(button.disabled,false);assert.equal(status['aria-busy'],'false');assert.match(states[0],/Reading backup.json/);
});
test('parse and storage errors clear busy state and never announce completion',async()=>{
 for(const stage of ['load','save']){const status=importUI(),button={disabled:false};let completed=false;const result=await runImportFeedback({status,buttons:[button],load:async()=>{if(stage==='load')throw Error('Invalid JSON');return deck},save:async()=>{throw Error('Storage full')},onComplete:()=>completed=true,yieldUI:async()=>{}});assert.equal(result,null);assert.match(status.textContent,/Import failed:/);assert.equal(status.dataset.state,'error');assert.equal(button.disabled,false);assert.equal(completed,false)}
});
