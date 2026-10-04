import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {reviewSentence} from '../srs.js';
import {recordReviewMode,reviewMode} from '../review-modes.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const undo=app.slice(app.indexOf('let reviewBusy=false'),app.indexOf('// The one backup document:'));
const skip=app.slice(app.indexOf('async function skipReview()'),app.indexOf('function playReviewAudio()'));
function harness(){
 const elements=new Map(),store=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:'typed answer',disabled:false});return elements.get(id)};
 const sentence={id:'first',source:'Original',targetLang:'ja',echoCount:3,createdAt:'2026-01-01',reviews:[],reviewTrack:{completed:{listening:0,reading:0,writing:0},attempts:{listening:0,reading:0,writing:0}}};store.set(sentence.id,structuredClone(sentence));
 const ctx={$,structuredClone,reviewQueue:[sentence,{...sentence,id:'second'}],reviewIndex:0,reviewRevealed:true,echoesAtCardStart:1,current:sentence,detail:null,reviewSentence,recordReviewMode,reviewMode,resetSession(){},stopReviewListening(){},getSentence:async id=>structuredClone(store.get(id)),saveSentence:async s=>store.set(s.id,structuredClone(s)),refreshDueBadge(){},toast(){},updateCheckButton(){},renderReview(){ctx.reviewRevealed=false;ctx.$('#review-answer').value='';ctx.updateReviewPrevious()},revealReview:async()=>{ctx.reviewRevealed=true}};
 vm.createContext(ctx);vm.runInContext(undo+skip+';globalThis.actions={rateReview,previousReview,skipReview}',ctx);return {ctx,store,$,sentence};
}
test('Back reverses OK, restores the revealed answer and allows a replacement grade',async()=>{
 const h=harness();await h.ctx.actions.rateReview('ok');assert.equal(h.ctx.reviewIndex,1);assert.equal(h.store.get('first').reviews.length,1);
 const latest=h.store.get('first');latest.source='Edited in another view';latest.echoCount=9;h.store.set('first',latest);
 await h.ctx.actions.previousReview();const restored=h.store.get('first');assert.equal(h.ctx.reviewIndex,0);assert.deepEqual(restored.reviews,[]);assert.equal(restored.srs,undefined);assert.equal(restored.lastRating,undefined);assert.deepEqual(restored.reviewTrack,h.sentence.reviewTrack);assert.equal(restored.source,'Edited in another view');assert.equal(restored.echoCount,9);assert.equal(h.ctx.reviewRevealed,true);assert.equal(h.$('#review-answer').value,'typed answer');assert.equal(h.$('#review-previous').disabled,true);
 await h.ctx.actions.rateReview('again');assert.equal(h.store.get('first').reviews.length,1);assert.equal(h.store.get('first').lastRating,'again');
});
test('Back undoes Skip and supports multiple steps including the completion screen',async()=>{
 const h=harness();await h.ctx.actions.skipReview();assert.equal(h.store.get('first').skipped,true);
 h.ctx.reviewRevealed=true;await h.ctx.actions.rateReview('ok');assert.equal(h.ctx.reviewIndex,2);
 await h.ctx.actions.previousReview();assert.equal(h.ctx.reviewIndex,1);await h.ctx.actions.previousReview();assert.equal(h.ctx.reviewIndex,0);assert.equal(h.store.get('first').skipped,undefined);assert.equal(h.store.get('first').skippedAt,undefined);
});
test('failed undo leaves the queue and undo entry available for retry',async()=>{
 const h=harness();await h.ctx.actions.rateReview('ok');const save=h.ctx.saveSentence;h.ctx.saveSentence=async()=>{throw Error('Storage full')};await h.ctx.actions.previousReview();assert.equal(h.ctx.reviewIndex,1);assert.equal(h.$('#review-previous').disabled,false);h.ctx.saveSentence=save;await h.ctx.actions.previousReview();assert.equal(h.ctx.reviewIndex,0);
});
