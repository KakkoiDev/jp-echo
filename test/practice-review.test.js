import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js'),css=read('styles.css');

test('Radio joins Start review from 7 pm, as an outlined button, only when there is something to play',()=>{
 const src=app.slice(app.indexOf('const isEvening='),app.indexOf('// Practice, returning'));
 const fields=new Map(),$=id=>{if(!fields.has(id))fields.set(id,{hidden:false,textContent:''});return fields.get(id)};
 const ctx=vm.createContext({$,t:(s,v={})=>s.replace(/\{(\w+)\}/g,(_,k)=>v[k]),radioQueue:all=>all,Date});vm.runInContext(src,ctx);
 const at=h=>new Date(2026,10,7,h,0).getTime();
 ctx.renderReviewRadio([1,2,3],at(19));assert.equal($('#review-radio').hidden,false);assert.equal($('#review-radio-label').textContent,'Radio — tonight’s 3 sentences');
 ctx.renderReviewRadio([1,2,3],at(14));assert.equal($('#review-radio').hidden,true,'in the day it is in Library → Tools');
 ctx.renderReviewRadio([],at(21));assert.equal($('#review-radio').hidden,true,'nothing studied, nothing to play');
 assert.match(html,/id="review-radio" class="outline review-radio"/);
});

test('Review home is action first: count, Start review, Radio, then the mix and counts',()=>{
 const home=html.slice(html.indexOf('<div id="review-overview"'),html.indexOf('<div id="review-stats"'));
 const order=['id="due-count"','id="start-review"','id="review-radio"','id="review-skill-mix"','class="breakdown"'].map(m=>home.indexOf(m));
 assert.ok(order.every((v,i)=>v>=0&&(i===0||v>order[i-1])),order.join());
 assert.doesNotMatch(home,/ring-stage/);
});

test('Practice keeps one 話読本 row into Library#tools, and a returning learner can replay the last three',()=>{
 assert.match(app,/\$\("#welcome-tools"\)\.onclick=\(\)=>\{showView\("library"\);history\.replaceState\(history\.state,"",location\.pathname\+location\.search\+"#tools"\)/);
 assert.match(app,/\.slice\(0,3\);\s*\$\("#welcome"\)\.classList\.toggle\("returning",recent\.length>0\)/);
 assert.match(app,/openSentence\(ensureSchedule\(fresh\)\);\$\("#play-pause"\)\.click\(\)/,'one tap replays the loop');
 assert.match(css,/\.welcome\.returning strong\{font-size:23px;/);
});
