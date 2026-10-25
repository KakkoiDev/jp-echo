import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {exportBackup,mergeSentences,replaceSentenceContent} from '../core.js';
import {routeFor,parseRoute} from '../routes.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const functionText=name=>source.slice(source.indexOf(`async function ${name}(`),source.indexOf('\n}',source.indexOf(`async function ${name}(`))+2);
const card={id:'one',schemaVersion:4,source:'Five people came.',target:'五人が来た。',createdAt:'2026-10-20T00:00:00Z',updatedAt:'2026-10-20T00:00:00Z',reviews:[{rating:'ok'}],srs:{state:2,reps:4},echoCount:3};
test('review flag persists fresh storage data, updates open copies and can be removed',async()=>{
 let saved={...structuredClone(card),echoCount:8};const messages=[];
 const button={disabled:false};
 const ctx=vm.createContext({reviewBusy:false,current:structuredClone(card),detail:structuredClone(card),reviewQueue:[structuredClone(card)],getSentence:async()=>structuredClone(saved),saveSentence:async item=>{saved=structuredClone(item)},updateReviewPrevious(){},renderFlagButton(button,s){button.flagged=s.flagged},toast:message=>messages.push(message)});
 vm.runInContext(functionText('toggleSentenceFlag'),ctx);
 await ctx.toggleSentenceFlag(card,button);
 assert.equal(saved.flagged,true);assert.equal(saved.echoCount,8);assert.deepEqual(saved.reviews,card.reviews);assert.deepEqual(saved.srs,card.srs);
 assert.equal(ctx.reviewQueue[0].flagged,true);assert.equal(ctx.current.flagged,true);assert.equal(ctx.detail.flagged,true);assert.equal(button.disabled,false);assert.equal(ctx.reviewBusy,false);
 await ctx.toggleSentenceFlag(card,button);assert.equal(saved.flagged,false);assert.equal(messages.length,2);
});
test('failed flag save restores controls without changing the review card',async()=>{
 const ctx=vm.createContext({reviewBusy:false,reviewQueue:[card],getSentence:async()=>card,saveSentence:async()=>{throw Error('Storage full')},updateReviewPrevious(){},toast(){}});
 vm.runInContext(functionText('toggleSentenceFlag'),ctx);const button={};await ctx.toggleSentenceFlag(card,button);
 assert.equal(button.disabled,false);assert.equal(ctx.reviewBusy,false);assert.equal(ctx.reviewQueue[0].flagged,undefined);
});
test('flagged library filter combines with sentence search and survives route navigation',()=>{
 const body=source.match(/let items=all\.filter\(item=>\{(.*?)\}\);const comparators/s)[1];
 const matches=new Function('item','query','filter','now',body);
 assert.equal(matches({...card,flagged:true},'five','flagged',Date.now()),true);
 assert.equal(matches({...card,flagged:true},'missing','flagged',Date.now()),false);
 assert.equal(matches(card,'','flagged',Date.now()),false);
 assert.equal(parseRoute(routeFor({view:'library',historyFilter:'flagged'})).historyFilter,'flagged');
});
test('flags survive backup import and sentence corrections',()=>{
 const flagged={...card,flagged:true};
 const restored=mergeSentences([],JSON.parse(JSON.stringify(exportBackup([flagged]))).sentences)[0];
 assert.equal(restored.flagged,true);
 assert.equal(replaceSentenceContent(restored,{source:'They came.',casual:'来た。'}).flagged,true);
});
test('delete from practice removes saved card and restores editable source for retry',async()=>{
 const input={value:'',dispatchEvent(){},focus(){this.focused=true}};let deleted,view;
 const ctx=vm.createContext({current:card,detail:card,reviewQueue:[card,{id:'other'}],resetSession(){},deleteSentence:async id=>{deleted=id},restoreExample:async()=>{},renderSentence(){},showView:name=>{view=name},setPracticeMode(){},enteringTarget:()=>false,$:()=>input,Event:class{},refreshDueBadge(){},setStatus(){}});
 vm.runInContext(functionText('deletePracticeSentence'),ctx);await ctx.deletePracticeSentence(card);
 assert.equal(deleted,card.id);assert.equal(ctx.current,null);assert.equal(ctx.detail,null);assert.equal(ctx.reviewQueue.length,1);assert.equal(view,'practice');assert.equal(input.value,card.source);assert.equal(input.focused,true);
});
test('new sentence actions and review flag are wired to the existing editor and confirm sheet',()=>{
 assert.match(html,/id="practice-edit"/);assert.match(html,/id="practice-delete"/);assert.match(html,/<option value="flagged">Flagged<\/option>/);
 assert.match(source,/\$\("#practice-delete"\)\.onclick=\(\)=>askDelete\(current,deletePracticeSentence\)/);
 assert.match(source,/async function editPracticeSentence\(\).*await openDetail\(current.id\).*openEditor\(\)/);
 assert.match(source,/\$\("#review-flag"\)\.onclick=\(\)=>toggleSentenceFlag\(reviewQueue\[reviewIndex\]/);
 // The flag stays outside review-meta, which is hidden on answer reveal.
 assert.ok(html.indexOf('id="review-flag"')<html.indexOf('id="review-panel"'));
});

test('library progress counts every sentence once, including missing schedules and relearning',()=>{
 const fields=new Map();const ctx=vm.createContext({$:key=>{if(!fields.has(key))fields.set(key,{});return fields.get(key)}});
 const start=source.indexOf('function renderLibraryProgress('),end=source.indexOf('\nlet historyRenderVersion',start);
 vm.runInContext(source.slice(start,end),ctx);
 ctx.renderLibraryProgress([{},{srs:{state:0}},{srs:{state:1}},{srs:{state:2}},{srs:{state:3},skipped:true}]);
 assert.equal(fields.get('#library-progress-new').textContent,'2');assert.equal(fields.get('#library-progress-practicing').textContent,'2');assert.equal(fields.get('#library-progress-learned').textContent,'1');
 ctx.renderLibraryProgress([]);for(const field of fields.values())assert.equal(field.textContent,'0');
 assert.match(source,/renderLibraryTool\(all\);renderLibraryProgress\(all\)/);
});
