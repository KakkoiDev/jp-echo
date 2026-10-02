import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const preference=source.slice(source.indexOf('function storePreference('),source.indexOf('const settings=readSettings();'));
const save=preference+source.slice(source.indexOf('function saveWorkspace('),source.indexOf('let applyingRoute=false;'));
function context(setItem){return {document:{body:{dataset:{view:'library'}}},workspace:()=>({historyQuery:'old'}),discussionMode:'chat',settings:{mapView:'words'},$:id=>({value:id==='#history-search'?'automation':''}),localStorage:{setItem},WORKSPACE_KEY:'jp-echo-workspace'};}
test('failed workspace persistence does not interrupt opening Library or searching',()=>{
  for(const name of ['QuotaExceededError','SecurityError']){
    const ctx=context(()=>{const error=new Error(name);error.name=name;throw error;});
    const result=runInNewContext(save+';saveWorkspace({view:"library"})',ctx);
    assert.equal(result.view,'library');assert.equal(result.historyQuery,'automation');assert.equal(result.mapView,'words');
  }
});
test('workspace still remembers navigation when storage is available',()=>{
  let saved;const ctx=context((key,value)=>{saved={key,value:JSON.parse(value)};});
  runInNewContext(save+';saveWorkspace({view:"map"})',ctx);
  assert.equal(saved.key,'jp-echo-workspace');assert.equal(saved.value.view,'map');assert.equal(saved.value.historyQuery,'automation');
});

test('startup settings writes tolerate full storage and retain readable preferences',()=>{
 const ctx={localStorage:{getItem:()=>'{"onboarded":true,"targetLang":"ja"}',setItem:()=>{throw new Error('Full')}}};
 assert.equal(runInNewContext(preference+';storePreference("jp-echo-settings","{}")',ctx),false);
 assert.equal(runInNewContext(preference+';readSettings().targetLang',ctx),'ja');
 for(const value of ['{broken','null','[]','123']){ctx.localStorage.getItem=()=>value;assert.equal(Object.keys(runInNewContext(preference+';readSettings()',ctx)).length,0)}
});
