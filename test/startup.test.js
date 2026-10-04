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
