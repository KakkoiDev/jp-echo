import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';
const script=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
// Follow the shipped cache name, so bumping it does not need a test edit.
const CURRENT=script.match(/const CACHE="(jp-echo-v\d+)"/)[1],PREVIOUS='jp-echo-v'+(Number(CURRENT.slice(9))-1);
function worker(){const handlers={},deleted=[],added=[];let network=0;const stored=new Map([['https://echo.test/index.html','installed-shell'],['https://echo.test/api.js','installed-api']]);const cache={match:async(input)=>stored.get(new URL(typeof input==='string'?input:input.url,'https://echo.test/').href.split('?')[0]),addAll:async requests=>added.push(...requests)};class WorkerRequest{constructor(path,options){this.url=new URL(path,'https://echo.test/').href;this.cache=options.cache}};const self={location:{origin:'https://echo.test'},registration:{scope:'https://echo.test/'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,handler)=>handlers[name]=handler};vm.runInNewContext(script,{self,URL,Request:WorkerRequest,caches:{open:async()=>cache,keys:async()=>[PREVIOUS,CURRENT,'jp-echo-prefs','other-app'],delete:async key=>deleted.push(key)},fetch:async()=>{network++;throw Error('offline')}});return {handlers,deleted,added,network:()=>network,fetch:async(path,mode='cors')=>{let promise;handlers.fetch({request:{url:'https://echo.test'+path,method:'GET',mode},respondWith:p=>promise=p});return promise}}}
test('offline installed PWA opens sentence, grammar and dictionary deep links',async()=>{const w=worker();for(const path of ['/','/sentences/test','/grammar/minihongo%3Agram-1','/words/-1','/kanji/駅','/review'])assert.equal(await w.fetch(path,'navigate'),'installed-shell');assert.equal(w.network(),0)});
test('installed modules stay in the same version even with cache-busting query',async()=>{const w=worker();assert.equal(await w.fetch('/api.js?v=old'),'installed-api');assert.equal(w.network(),0)});
test('upgrading retains reminder preferences and other application caches',async()=>{const w=worker();let completion;w.handlers.activate({waitUntil:p=>completion=p});await completion;assert.deepEqual(w.deleted,[PREVIOUS])});
test('installation refreshes every shell asset and all assets exist',async()=>{const w=worker();let completion;w.handlers.install({waitUntil:p=>completion=p});await completion;for(const request of w.added){assert.equal(request.cache,'reload');const path=new URL(request.url).pathname;assert.ok(path==='/'||existsSync(new URL('..'+path,import.meta.url)),path)}});

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const registration=html.slice(html.indexOf("if('serviceWorker' in navigator){"),html.indexOf('</script>',html.indexOf("if('serviceWorker' in navigator){")));
test('worker installation waits for open app clients instead of forcing activation',async()=>{
 let install,skipCalls=0;
 const self={addEventListener:(name,handler)=>{if(name==='install')install=handler},skipWaiting:()=>{skipCalls++}};
 vm.runInNewContext(script,{self,caches:{open:async()=>({addAll:async()=>{}})},Request:class{constructor(){}}});
 let pending;install({waitUntil:p=>pending=p});await pending;assert.equal(skipCalls,0);
});
test('delayed controller changes and update checks preserve the route and unsaved session',async()=>{
 for(const path of ['/sentences/test','/words/-1','/review','/settings']){
  for(const controlled of [false,true]){
   const listeners={},state={path,answer:'unsaved typed answer',reviewIndex:2,modal:'vocabulary'},before={...state};let reloads=0,updates=0,registrations=0;
   const location={pathname:path,search:'',reload:()=>{reloads++;state.answer='';state.path='/'}};
   const window={dispatchEvent:()=>{throw Error('Worker must not dispatch navigation or reload events')}};
   const navigator={serviceWorker:{controller:controlled?{}:null,addEventListener:(name,handler)=>listeners[name]=handler,register:async(url,options)=>{registrations++;assert.equal(url,'/sw.js');assert.equal(options.updateViaCache,'none');return {update:async()=>{updates++}}}}};
   vm.runInNewContext(registration,{navigator,window,location});await window.echoWorker;
   // Activation may arrive seconds after opening, and may fire more than once.
   for(let i=0;i<3;i++)listeners.controllerchange?.();
   assert.equal(reloads,0);assert.deepEqual(state,before);assert.equal(registrations,1);assert.equal(updates,1);
  }
 }
});
test('failed worker update cannot reload or navigate the open page',async()=>{
 const window={},navigator={serviceWorker:{register:async()=>({update:()=>Promise.reject(Error('offline'))})}};
 vm.runInNewContext(registration,{navigator,window,location:{reload:()=>assert.fail('unexpected reload')}});await window.echoWorker;
});
