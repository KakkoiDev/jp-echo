import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('window.echoReportError='),html.indexOf("if('serviceWorker' in navigator){"));
// Errors are shown as text, so a thrown message cannot inject HTML.
test('startup diagnostics remain usable when the app module fails',()=>{
 const panel={hidden:true},message={},listeners={},window={addEventListener:(name,fn)=>listeners[name]=fn};let timeout;
 runInNewContext(code,{window,document:{getElementById:id=>id==='startup-error'?panel:message},setTimeout:fn=>timeout=fn,Error});
 listeners.error({error:new Error('Module failed')});assert.equal(panel.hidden,false);assert.match(message.textContent,/Module failed/);
 listeners.unhandledrejection({reason:new Error('Database blocked')});assert.match(message.textContent,/Database blocked/);
 panel.hidden=true;window.echoAppReady=true;window.echoRouteReady=true;timeout();assert.equal(panel.hidden,true);
 window.echoAppReady=false;timeout();assert.match(message.textContent,/Startup did not finish/);
});
// Safari's "Importing a module script failed" names no file; the panel asks
// for every module the worker lists and names the ones that do not load.
test('a module failure names the module that does not load as a script',async()=>{
 const panel={hidden:true},message={after:node=>added.push(node.textContent)},listeners={},window={addEventListener:(name,fn)=>listeners[name]=fn},added=[];
 const sw='const ASSETS=["./","./app.js","./core.js","./icon.svg"]';
 const fetch=async path=>path==='/sw.js'?{text:async()=>sw}:{ok:path!=='/core.js',status:path==='/core.js'?404:200,headers:{get:()=>path==='/core.js'?'text/html':'text/javascript'}};
 runInNewContext(code,{window,document:{getElementById:id=>id==='startup-error'?panel:message,createElement:()=>({})},setTimeout:()=>{},Error,fetch});
 listeners.unhandledrejection({reason:new TypeError('Importing a module script failed.')});
 for(let i=0;i<20&&!added.length;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(added,['Not loading: core.js (404 text/html)']);
});
