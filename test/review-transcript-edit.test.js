import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {reviewMode,reviewModeMeta,skillReason} from '../review-modes.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function harness(mode){
 const fields=new Map(),$=id=>{if(!fields.has(id))fields.set(id,{value:'',textContent:'',hidden:false,disabled:false,dataset:{},style:{},classList:{toggle(){},remove(){}},setAttribute(){},replaceChildren(){},focus(){}});return fields.get(id)};
 const sentence={id:'card',target:'駅【えき】です。',source:'It is a station.',targetLang:'ja',reviewTrack:{next:mode}};
 let callbacks,canceled=0;
 const ctx={$,document:{querySelector:$},reviewQueue:[sentence],reviewIndex:0,reviewRevealed:false,reviewRecognition:null,reviewListening:false,reviewSpeechPending:false,reviewMode,reviewModeMeta,skillReason,itemTarget:s=>s.targetLang,sourceLang:()=> 'en',targetLang:()=> 'fr',refreshReviewStats(){},updateReviewPrevious(){},resetSession(){},renderSidePanel(){},stageLabel:()=>'',stageClass:()=>'',skillTrio:()=>({}),reviewPlainJapanese:()=> '駅です。',Number,requestAnimationFrame(){},fitTextArea(){},transcribeAudio(){},settings:{},recognitionFactory(){},createReviewSpeechCapture:options=>{callbacks=options;return {start(){options.onState('Recording… Tap again to stop.')},cancel(){canceled++},finish:async()=>{options.onState('Ready to check.')}}}};
 vm.createContext(ctx);
 const recordBlock=app.slice(app.indexOf('function reviewRecognitionLang()'),app.indexOf('async function skipReview()'));
 const renderBlock=app.slice(app.indexOf('function renderReview(){'),app.indexOf('async function renderReviewComplete()'));
 const check=app.match(/function updateCheckButton\(\)\{[^\n]*\}/)[0];
 vm.runInContext(recordBlock+renderBlock+check+';globalThis.actions={renderReview,startReviewListening}',ctx);
 return {ctx,$,get callbacks(){return callbacks},get canceled(){return canceled}};
}
test('reading and writing expose editable answers and microphones, listening stays audio-only',()=>{
 for(const mode of ['reading','writing','listening']){
  const h=harness(mode);h.ctx.actions.renderReview();
  assert.equal(h.$('#review-capture').hidden,mode==='listening');
  assert.equal(h.$('#review-answer-tools').hidden,mode==='listening');
  assert.equal(h.$('#review-answer').hidden,false);
  assert.equal(h.$('#review-result').hidden,true);
 }
});
test('reading transcript is visible before reveal, in the card language',()=>{
 const h=harness('reading');h.ctx.actions.renderReview();h.ctx.actions.startReviewListening();
 assert.equal(h.callbacks.lang,'ja');h.callbacks.onText('えきです');h.callbacks.onState('Ready to check.');
 assert.equal(h.$('#review-answer').value,'えきです');assert.equal(h.$('#review-capture').hidden,false);
 assert.equal(h.$('#review-result').hidden,true);assert.equal(h.ctx.reviewRevealed,false);assert.equal(h.$('#review-check').disabled,false);
});
test('writing can dictate without losing typed text or enabling check mid-transcription',()=>{
 const h=harness('writing');h.ctx.actions.renderReview();h.$('#review-answer').value='駅';h.ctx.actions.startReviewListening();
 h.callbacks.onText('です');h.callbacks.onState('Transcribing…');assert.equal(h.$('#review-answer').value,'駅です');assert.equal(h.$('#review-check').disabled,true);
 h.callbacks.onState('Ready to check.');assert.equal(h.$('#review-check').disabled,false);
});
test('manual transcript edits cancel recognition and reject late transcription',()=>{
 const h=harness('reading');h.ctx.actions.renderReview();h.ctx.actions.startReviewListening();h.callbacks.onText('misheard');
 h.$('#review-answer').value='corrected';
 const edit=app.match(/\$\("#review-answer"\)\.oninput=\(\)=>\{([^\n]*?)\};/)[1];
 vm.runInContext('(()=>{'+edit+'})()',h.ctx);
 h.callbacks.onText('late wrong transcript');assert.equal(h.$('#review-answer').value,'corrected');assert.ok(h.canceled);assert.equal(h.$('#review-check').disabled,false);
});
