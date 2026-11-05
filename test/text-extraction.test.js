import test from 'node:test';import assert from 'node:assert/strict';
import{splitPassage,passageCandidates,validateExtractedBatch,classifyExtraction,vocabularyInventory,analyzePassage}from'../text-extraction.js';
const row={index:0,text:'猫が来た。',context:'猫が来た。犬が来た。'},response={sentences:[{index:0,target:'猫【ねこ】が来【き】た。',source:'A cat came.',words:[{lemma:'猫',quote:'猫',meaning:'cat'},{lemma:'来る',quote:'来た',meaning:'come'}]}]};
const matcher={wordSpans:()=>[],wordById:()=>null};
test('split pasted Japanese paragraphs, quotation endings and punctuation without rewriting',()=>{assert.deepEqual(splitPassage('「こんにちは。」\n猫が来た！犬も来た？\nまだ続く'),['「こんにちは。」','猫が来た！','犬も来た？','まだ続く']);assert.throws(()=>splitPassage('a'.repeat(30001)),/30,000/);assert.throws(()=>splitPassage('猫。'.repeat(121)),/120/)});
test('remove duplicates in all registers and the pasted passage while retaining source context',()=>{const result=passageCandidates('猫が来た。犬が来た。犬が来た。',[{target:'猫【ねこ】が来【き】た。'}]);assert.equal(result.length,1);assert.equal(result[0].text,'犬が来た。');assert.match(result[0].context,/猫/)});
test('model output must preserve exact Japanese, valid readings, English meaning and vocabulary evidence',()=>{assert.equal(validateExtractedBatch(response,[row])[0].words[1].lemma,'来る');for(const patch of [{target:'犬【いぬ】が来【き】た。'},{target:'猫【cat】が来【き】た。'},{source:'猫が来た。'},{index:2},{words:[{lemma:'犬',quote:'犬',meaning:'dog'}]}])assert.throws(()=>validateExtractedBatch({sentences:[{...response.sentences[0],...patch}]},[row]));assert.throws(()=>validateExtractedBatch({sentences:[]},[row]));});
test('never encountered and encountered-but-not-learned are distinct filters',()=>{const rows=validateExtractedBatch(response,[row]),inventory={encountered:new Set(['猫']),learned:new Set()};assert.deepEqual(classifyExtraction(rows,inventory,matcher)[0].fresh.map(w=>w.lemma),['来る']);assert.deepEqual(classifyExtraction(rows,inventory,matcher,'unlearned')[0].fresh.map(w=>w.lemma),['猫']);assert.equal(classifyExtraction(rows,{encountered:new Set(['猫','来る']),learned:new Set(['猫','来る'])},matcher).length,0)});
test('imported unknown vocabulary is encountered on the next passage and learned after review',()=>{const inventory=vocabularyInventory([{targetLang:'ja',extractedVocabulary:[{lemma:'猫'},{lemma:'来る'}],srs:{state:2}}],{sentenceWords:()=>new Set(),wordById:()=>null});assert.equal(classifyExtraction(validateExtractedBatch(response,[row]),inventory,matcher).length,0);assert.ok(inventory.learned.has('猫'))});
test('repeated vocabulary is counted across candidates and lower new-word counts come first',()=>{const rows=[{...row,words:[{lemma:'猫',quote:'猫',meaning:'cat'},{lemma:'来る',quote:'来た',meaning:'come'}]},{index:1,text:'猫。',words:[{lemma:'猫',quote:'猫',meaning:'cat'}]}];const result=classifyExtraction(rows,{encountered:new Set(),learned:new Set()},matcher);assert.equal(result[0].index,1);assert.equal(result[0].repeated[0].count,2)});
test('analysis is batched, reports progress and fails before importing on invalid model output',async()=>{const progress=[];const result=await analyzePassage([row],{ask:async()=>response,onProgress:(done,total)=>progress.push([done,total])});assert.equal(result.length,1);assert.deepEqual(progress,[[0,1],[1,1]]);await assert.rejects(analyzePassage([row],{ask:async()=>({})}));});

test('one missing proper-name reading does not block a passage preview',async()=>{
 const rows=passageCandidates('音声入力の現状を共有します。札幌中野冷機にヒアリングしました。');
 const result=await analyzePassage(rows,{ask:async()=>({sentences:[
  {index:0,target:'音声【おんせい】入力【にゅうりょく】の現状【げんじょう】を共有【きょうゆう】します。',source:'Here is the current status of voice input.',words:[]},
  {index:1,target:'札幌中野冷機にヒアリングしました。',source:'We interviewed Sapporo Nakano Refrigeration.',words:[]}
 ]})});
 assert.equal(result.length,2);
 assert.equal(result[1].target,rows[1].text);
});

test('four detected words become four shorter, independent import drafts',async()=>{
 const terms=['権限','録音','削除','担当'];
 const original={index:4,text:'担当者には録音の削除に必要な権限があります。',source:'The person in charge has permission to delete recordings.',fresh:terms.map(lemma=>({lemma,quote:lemma,meaning:'test gloss'}))};
 const targets=['権限【けんげん】がありません。','録音【ろくおん】を聞【き】きます。','削除【さくじょ】します。','私【わたし】が担当【たんとう】します。'];
 const translations=['I do not have permission.','I listen to the recording.','I will delete it.','I will take charge.'];
 const {adaptExtraction}=await import('../text-extraction.js');
 const drafts=await adaptExtraction(original,{...matcher,nextIndex:12,ask:async input=>{
  assert.deepEqual(JSON.parse(input).focus.map(w=>w.lemma),terms);
  return {sentences:terms.map((lemma,i)=>({lemma,quote:lemma,target:targets[i],source:translations[i]}))};
 }});
 assert.deepEqual(drafts.map(d=>d.index),[12,13,14,15]);
 assert.deepEqual(drafts.map(d=>d.words.map(w=>w.lemma)),terms.map(w=>[w]));
 assert.deepEqual(drafts.map(d=>d.target),targets);
 assert.equal(original.index,4);
 const preview=classifyExtraction(drafts,{encountered:new Set(),learned:new Set()},{wordSpans:()=>[{id:1,start:0,end:1}],wordById:()=>({w:'別の語'})});
 assert.deepEqual(preview.map(d=>d.fresh.map(w=>w.lemma)),terms.map(w=>[w]));
});

test('adaptation rejects omissions, long drafts, mixed targets, and existing duplicates',async()=>{
 const {adaptExtraction}=await import('../text-extraction.js');
 const original={index:0,text:'この権限があればすべての録音を聞くことができます。',fresh:['権限','録音'].map(lemma=>({lemma,quote:lemma,meaning:'test gloss'}))};
 const valid=[{lemma:'権限',quote:'権限',target:'権限がない。',source:'I do not have permission.'},{lemma:'録音',quote:'録音',target:'録音を聞く。',source:'I listen to the recording.'}];
 for(const [sentences,existing,error] of [
  [valid.slice(0,1),[],/one example per word/],
  [[{...valid[0],target:'権限があるので'+ 'とても'.repeat(20)+'便利です。'},valid[1]],[],/short sentence/],
  [[{...valid[0],target:'録音の権限がない。'},valid[1]],[],/another focus word/],
  [[{...valid[0],target:'許可がない。'},valid[1]],[],/missed its focus word/],
  [valid,['録音【ろくおん】を聞く。'],/duplicate/],
 ])await assert.rejects(adaptExtraction(original,{...matcher,existing,ask:async()=>({sentences})}),error);
});
