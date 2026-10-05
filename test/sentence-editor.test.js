import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizeFurigana,stripFurigana,rubySegments,replaceSentenceContent} from '../core.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const editor=app.slice(app.indexOf('let editorGeneration=0'),app.indexOf('function playDetail()'));
function harness(rewriteSentence){
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:'',disabled:false,hidden:false,open:false,textContent:'',style:{},scrollHeight:100,replaceChildren(){},focus(){}});return elements.get(id)};
 let saved;
 const old={id:'test',source:'Go to the station.',targetLang:'ja',sourceLang:'en',target:'駅に行く。',casualTarget:'駅に行く。',politeTarget:'駅に行きます。',echoCount:12,reviews:[{rating:'ok'}],grammar:['old'],grammarAnalysis:{old:true}};
 const ctx={LANGUAGES:[["en","English"],["fr","French"]],Option:class{},$,detail:old,current:null,settings:{},hasTranslator:()=>true,resetSession(){},preferredTarget:s=>s.casualTarget,sentenceRegister:()=> 'casual',sourceLang:()=> 'en',itemTarget:s=>s.targetLang,hasFurigana:()=>true,normalizeFurigana,stripFurigana,replaceSentenceContent,fitTextArea(){},rewriteSentence,saveSentence:async s=>{saved=s},renderSentence(){},renderDetail(){}};
 vm.createContext(ctx);vm.runInContext(editor+';globalThis.actions={openEditor,closeEditor,saveEdit,rewriteDetailSentence}',ctx);
 return {ctx,$,get saved(){return saved}};
}
test('rewrite updates the draft and meaning, then Save persists both forms without losing reviews',async()=>{
 const h=harness(async()=>({source:'Walk to the station.',casual:'駅まで歩く。',polite:'駅まで歩きます。'}));
 h.ctx.actions.openEditor();h.$('#sentence-instruction').value='Use walking';
 await h.ctx.actions.rewriteDetailSentence();assert.equal(h.$('#sentence-draft').value,'駅まで歩く。');assert.equal(h.$('#sentence-source-draft').value,'Walk to the station.');assert.equal(h.saved,undefined);
 await h.ctx.actions.saveEdit({preventDefault(){}});assert.equal(h.saved.target,'駅まで歩く。');assert.equal(h.saved.politeTarget,'駅まで歩きます。');assert.equal(h.saved.source,'Walk to the station.');assert.equal(h.saved.echoCount,12);assert.deepEqual(h.saved.reviews,[{rating:'ok'}]);assert.equal(h.saved.grammar,undefined);
});
test('cancelled rewrite cannot overwrite or enable controls belonging to a newer request',async()=>{
 const completions=[];const h=harness(()=>new Promise(resolve=>completions.push(resolve)));
 h.ctx.actions.openEditor();h.$('#sentence-instruction').value='Rewrite';const first=h.ctx.actions.rewriteDetailSentence();
 h.ctx.actions.closeEditor();h.ctx.actions.openEditor();assert.equal(h.$('#sentence-save').disabled,false);h.$('#sentence-instruction').value='Second rewrite';const second=h.ctx.actions.rewriteDetailSentence();
 completions[0]({source:'Old request',casual:'古い文。',polite:'古い文です。'});await first;assert.equal(h.$('#sentence-draft').value,'駅に行く。');assert.equal(h.$('#sentence-rewrite').disabled,true);assert.equal(h.$('#sentence-save').disabled,true);
 completions[1]({source:'New request',casual:'新しい文。',polite:'新しい文です。'});await second;assert.equal(h.$('#sentence-draft').value,'新しい文。');assert.equal(h.$('#sentence-save').disabled,false);
});
test('requirements precede separate visible sentence and meaning fields',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const form=html.slice(html.indexOf('<form id="sentence-editor">'),html.indexOf('</form>',html.indexOf('<form id="sentence-editor">')));
 assert.ok(form.indexOf('id="sentence-instruction"')<form.indexOf('id="sentence-draft"'));
 assert.ok(form.indexOf('id="sentence-draft"')<form.indexOf('id="sentence-source-draft"'));
 assert.doesNotMatch(form,/<details/);assert.match(form,/Generate new sentence/);assert.match(form,/Meaning of the new sentence/);
 assert.match(app,/if\(editorOpenId!==detail\?\.id\)openEditor\(\)/);
});

test('legacy Japanese meaning-language metadata is corrected before requesting and saving English',async()=>{
 let options;const h=harness(async(request,settings)=>{options=settings;return {source:'You look at me, and I guide you.',casual:'君が僕を見て、僕が君を導く。',polite:'君が僕を見て、僕が君を導きます。'}});
 h.ctx.detail.sourceLang='ja';h.ctx.actions.openEditor();assert.equal(h.$('#sentence-meaning-language').value,'en');h.$('#sentence-instruction').value='make the meaning in English';await h.ctx.actions.rewriteDetailSentence();assert.equal(options.sourceLang,'en');assert.equal(h.$('#sentence-source-draft').value,'You look at me, and I guide you.');await h.ctx.actions.saveEdit({preventDefault(){}});assert.equal(h.saved.sourceLang,'en');assert.equal(h.saved.source,'You look at me, and I guide you.');
});
