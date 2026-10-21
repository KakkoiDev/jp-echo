import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {reviewMode,reviewModeMeta,skillReason} from '../review-modes.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function harness(mode,overrides={}){
 const fields=new Map(),$=id=>{if(!fields.has(id))fields.set(id,{attrs:{},value:'',textContent:'',hidden:false,disabled:false,dataset:{},style:{},classList:{toggle(){},remove(){}},setAttribute(key,value){this.attrs[key]=value},replaceChildren(){},focus(){}});return fields.get(id)};
 const sentence={id:'card',target:'駅【えき】です。',source:'It is a station.',targetLang:'ja',reviewTrack:{next:mode},...overrides};
 let callbacks,canceled=0;
 const ctx={$,document:{querySelector:$},reviewQueue:[sentence],reviewIndex:0,reviewRevealed:false,reviewRecognition:null,reviewListening:false,reviewSpeechPending:false,reviewMode,reviewModeMeta,skillReason,itemTarget:s=>s.targetLang,sourceLang:()=> 'en',targetLang:()=> 'fr',refreshReviewStats(){},updateReviewPrevious(){},resetSession(){},renderSidePanel(){},stageLabel:()=>'',stageClass:()=>'',skillTrio:()=>({}),reviewPlainJapanese:()=> '駅です。',Number,requestAnimationFrame(){},fitTextArea(){},transcribeAudio(){},settings:{},recognitionFactory(){},createReviewSpeechCapture:options=>{callbacks=options;return {start(){options.onState('Recording… Tap again to stop.')},cancel(){canceled++},finish:async()=>{options.onState('Ready to check.')}}}};
 vm.createContext(ctx);
 const recordBlock=app.slice(app.indexOf('function reviewRecognitionLang()'),app.indexOf('async function skipReview()'));
 const renderBlock=app.slice(app.indexOf('function renderReview(){'),app.indexOf('async function renderReviewComplete()'));
 const check=app.match(/function updateCheckButton\(\)\{[^\n]*\}/)[0];
 vm.runInContext(recordBlock+renderBlock+check+';globalThis.actions={renderReview,startReviewListening,stopReviewListening,toggleReviewListening}',ctx);
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

test('changing cards cancels capture and ignores both stale text and stale recording state',()=>{
 const h=harness('reading');h.ctx.actions.renderReview();h.ctx.actions.startReviewListening();const old=h.callbacks;
 h.ctx.reviewQueue.push({...h.ctx.reviewQueue[0],id:'next',targetLang:'fr'});h.ctx.reviewIndex=1;h.ctx.actions.renderReview();
 old.onText('wrong card');old.onState('Transcribing…');
 assert.ok(h.canceled);assert.equal(h.$('#review-answer').value,'');assert.equal(h.$('#review-mic').disabled,false);assert.equal(h.ctx.reviewSpeechPending,false);
 h.ctx.actions.startReviewListening();assert.equal(h.callbacks.lang,'fr');
});
test('recording again replaces a reading attempt and cannot receive results from the previous recording',()=>{
 const h=harness('reading');h.ctx.actions.renderReview();h.ctx.actions.startReviewListening();const old=h.callbacks;old.onText('first');old.onState('Ready to check.');
 h.ctx.actions.startReviewListening();h.callbacks.onText('second');old.onText('late first');old.onState('Transcribing…');
 assert.equal(h.$('#review-answer').value,'second');assert.equal(h.$('#review-mic').disabled,false);assert.ok(h.canceled);
});
test('dictation replaces successive recognition hypotheses instead of duplicating typed text',()=>{
 const h=harness('writing',{targetLang:'fr'});h.ctx.actions.renderReview();h.$('#review-answer').value='Bonjour';h.ctx.actions.startReviewListening();
 h.callbacks.onText('tout');h.callbacks.onText('tout le monde');
 assert.equal(h.$('#review-answer').value,'Bonjour tout le monde');assert.equal(h.callbacks.lang,'fr');
 assert.equal(h.$('#review-mic').attrs['aria-label'],'Stop recording');
 h.callbacks.onState('Ready to check.');assert.equal(h.$('#review-mic').attrs['aria-label'],'Dictate your answer');
});
test('mic controls stop an active recording and check remains blocked until transcription finishes',async()=>{
 const h=harness('writing');h.ctx.actions.renderReview();h.ctx.actions.toggleReviewListening();h.callbacks.onText('駅です');
 assert.equal(h.$('#review-check').disabled,true);assert.equal(h.$('#review-mic').attrs['aria-pressed'],'true');
 await h.ctx.actions.toggleReviewListening();assert.equal(h.$('#review-check').disabled,false);assert.equal(h.$('#review-mic').attrs['aria-pressed'],'false');
});
test('a failed or empty writing recording does not allow revealing an empty answer',()=>{
 const h=harness('writing');h.ctx.actions.renderReview();h.ctx.actions.startReviewListening();h.callbacks.onState('Nothing heard. Try recording again.');
 assert.equal(h.ctx.reviewSpeechPending,false);assert.equal(h.$('#review-check').disabled,true);assert.equal(h.$('#review-mic').disabled,false);
 h.$('#review-answer').value='駅です';
 const edit=app.match(/\$\("#review-answer"\)\.oninput=\(\)=>\{([^\n]*?)\};/)[1];vm.runInContext('(()=>{'+edit+'})()',h.ctx);
 assert.equal(h.$('#review-check').disabled,false);
});
