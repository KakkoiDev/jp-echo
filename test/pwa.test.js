import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';
const script=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
// Follow the shipped cache name, so bumping it does not need a test edit.
const CURRENT=script.match(/const CACHE="(jp-echo-v\d+)"/)[1],PREVIOUS='jp-echo-v'+(Number(CURRENT.slice(9))-1);
function worker(){const handlers={},deleted=[],added=[];let network=0;const stored=new Map([['https://echo.test/index.html','installed-shell'],['https://echo.test/api.js','installed-api']]);const cache={match:async(input)=>stored.get(new URL(typeof input==='string'?input:input.url,'https://echo.test/').href.split('?')[0]),addAll:async requests=>added.push(...requests)};class WorkerRequest{constructor(path,options){this.url=new URL(path,'https://echo.test/').href;this.cache=options.cache}};const self={location:{origin:'https://echo.test'},registration:{scope:'https://echo.test/'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,handler)=>handlers[name]=handler};vm.runInNewContext(script,{self,URL,Request:WorkerRequest,caches:{open:async()=>cache,keys:async()=>[PREVIOUS,CURRENT,'jp-echo-prefs','other-app'],delete:async key=>deleted.push(key)},fetch:async()=>{network++;throw Error('offline')}});return {handlers,deleted,added,network:()=>network,fetch:async(path,mode='cors')=>{let promise;handlers.fetch({request:{url:'https://echo.test'+path,method:'GET',mode},respondWith:p=>promise=p});return promise}}}
test('offline installed PWA opens sentence, grammar and dictionary deep links',async()=>{const w=worker();for(const path of ['/','/sentences/test','/grammar/minihongo%3Agram-1','/words/-1','/kanji/駅','/review'])assert.equal(await w.fetch(path,'navigate'),'installed-shell');assert.equal(w.network(),0)});
test('installed modules stay in the same version even with cache-busting query',async()=>{const w=worker();assert.equal(await w.fetch('/api.js?v=old'),'installed-api');assert.equal(w.network(),0)});
test('upgrading retains reminder preferences and other application caches',async()=>{const w=worker();let completion;w.handlers.activate({waitUntil:p=>completion=p});await completion;assert.deepEqual(w.deleted,[PREVIOUS])});
// Install fetches each file at a version-specific address (a CDN holding the
// previous deploy cannot answer it) and stores it under its plain address.
function installer({failPath=null}={}){const fetched=[],stored=[],responses=[];class Rebuilt{constructor(body,init){this.body=body;this.init=init;this.url=''}}class R{constructor(input,options={}){this.url=new URL(typeof input==='string'?input:input.href,'https://echo.test/').href;this.cache=options.cache}}
 let install;const self={registration:{scope:'https://echo.test/'},addEventListener:(name,handler)=>{if(name==='install')install=handler},skipWaiting:()=>{throw Error('install must not skip waiting')}};
 vm.runInNewContext(script,{self,URL,Request:R,Response:Rebuilt,caches:{open:async()=>({put:async(request,response)=>{stored.push(request.url);responses.push(response)}})},fetch:async request=>{fetched.push(request);const ok=!failPath||new URL(request.url).pathname!==failPath;return {ok,status:ok?200:404,statusText:'OK',headers:{'content-type':'text/javascript'},url:request.url,arrayBuffer:async()=>new ArrayBuffer(1)}}});
 return {run:()=>new Promise((resolve,reject)=>install({waitUntil:p=>p.then(resolve,reject)})),fetched,stored,responses}}
test('installation fetches every asset fresh, at this version, and stores it under its plain address',async()=>{const w=installer();await w.run();
 assert.ok(w.fetched.length>20);
 for(const request of w.fetched){assert.equal(request.cache,'reload');const url=new URL(request.url);assert.equal(url.searchParams.get('echo-cache'),CURRENT);const path=url.pathname;assert.ok(path==='/'||existsSync(new URL('..'+path,import.meta.url)),path)}
 for(const url of w.stored)assert.ok(!url.includes('echo-cache'),url);
 assert.ok(w.stored.includes('https://echo.test/app.js'));});
// Safari rejects a module the worker answers with a response carrying another
// address, so the fetched (…?echo-cache=…) response is never stored as is.
test('installed responses are rebuilt so they carry no cache-busting address',async()=>{const w=installer();await w.run();
 assert.equal(w.responses.length,w.stored.length);for(const response of w.responses){assert.ok(response instanceof Object&&'init' in response,'stored a fetched response');assert.equal(response.url,'');assert.equal(response.init.status,200);assert.equal(response.init.headers['content-type'],'text/javascript')}});
test('a version is cached whole or not at all: one failed file fails the install',async()=>{await assert.rejects(installer({failPath:'/core.js'}).run(),/Could not cache/)});

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const registration=html.slice(html.indexOf("if('serviceWorker' in navigator){"),html.indexOf('</script>',html.indexOf("if('serviceWorker' in navigator){")));
test('worker installation waits for open app clients instead of forcing activation',async()=>{
 // installer() throws if install calls skipWaiting.
 await installer().run();
});
test('the startup error panel can update Echo even when app.js never loaded',()=>{
 assert.match(html,/onclick="window\.echoRepair\(this\)">Update Echo<\/button>/);
 assert.match(html,/if\(registration\?\.waiting\)\{navigator\.serviceWorker\.addEventListener\('controllerchange',\(\)=>location\.reload\(\)\);registration\.waiting\.postMessage\('echo:activate-update'\);return\}/);
 // Only Echo's offline copies are cleared; data stores are never touched here.
 assert.match(html,/if\(\/\^jp-echo-v\\d\+\$\/\.test\(key\)\)await caches\.delete\(key\)/);
 assert.doesNotMatch(html,/indexedDB\.deleteDatabase|localStorage\.clear/);
 assert.doesNotMatch(html,/Echo v130/);
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

test('a module that fails only in this browser is named on the error panel',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/for\(const path of paths\.filter\(p=>p!=='app\.js'\)\)try\{await import\('\/'\+path\)\}catch\(e\)\{failed=path\+/,'each module is imported on its own, app.js excepted');
 assert.match(html,/Failing here: /);
});
