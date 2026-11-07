import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js'),api=read('api.js'),sw=read('sw.js');

test('every AI explanation asks for a reading after every kanji, in Echo notation',async()=>{
  const {READINGS_RULE}=await import('../api.js');
  assert.match(READINGS_RULE,/革命【かくめい】/);assert.match(READINGS_RULE,/every word, compound, example sentence and single kanji/);
  // Notes (word, grammar point, rewrites) share NOTE_RULES; the in-sentence dictionary explanation adds the rule itself.
  assert.match(api,/const NOTE_RULES="[^"]*Japanese inside the text is fine\. "\+READINGS_RULE;/);
  assert.match(app,/If uncertain say so\. \$\{READINGS_RULE\} Return JSON only: \{"definition":"\.\.\."\}/);
});

test('notes show their readings as ruby and are edited as raw notation',()=>{
  assert.match(app,/const show=n=>\{if\(render\)render\(n\);else text\.innerHTML=rubyHtml\(n\.text\);/);
  assert.match(app,/edit\.onclick=\(\)=>\{text\.textContent=note\.text;text\.contentEditable="true"/);
  assert.match(app,/\$\("#dictionary-explanation"\)\.innerHTML=escapeText\("AI explanation: "\)\+rubyHtml\(/);
});

test('Echo’s note is open near the top of the word sheet (WordNote), its tools inline',()=>{
  const sheet=html.slice(html.indexOf('<dialog id="word-dialog"'),html.indexOf('</dialog>',html.indexOf('<dialog id="word-dialog"')));
  assert.doesNotMatch(sheet,/word-note-jump|<details id="word-more"/,'no jump link, no collapse');
  const order=['id="word-title"','id="word-senses"','id="word-kanji"','id="word-more"','id="word-mine-head"','id="word-sentences"','class="kanji-say"','id="word-learn-nav"'].map(k=>sheet.indexOf(k));
  assert.ok(order.every(i=>i>=0)&&order.every((i,n)=>n===0||i>order[n-1]),'header, senses, kanji, Echo’s note, your sentences, say a sentence, previous/next');
  assert.doesNotMatch(sheet,/<summary>More options<\/summary>/);assert.match(sheet,/<div class="word-note-more"><div class="word-note-manage">/);
  assert.doesNotMatch(app,/wordNoteOpen/);
  assert.match(app,/block\.querySelector\("\.adjust-link"\)\.hidden=true;panel\.hidden=false;text\.contentEditable="false"/);
  assert.match(app,/\$\("#word-kanji-cells"\)\.replaceChildren\(\.\.\.chars\.map\(c=>kanjiCell\(c,kcover,kknown\)\)\)/,'each kanji opens its own sheet through the shared kanjiCell');
});

test('a waiting version switches only when the person taps Update now',()=>{
  const handlers={};let skips=0;
  vm.runInNewContext(sw,{self:{addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:()=>{skips++},registration:{scope:'https://echo.test/'},clients:{claim:async()=>{}}},caches:{},Request:class{},URL,fetch:async()=>{}});
  handlers.message({data:'something else'});assert.equal(skips,0);
  handlers.message({data:'echo:activate-update'});assert.equal(skips,1);
  // The page reloads only after its own request, never on an activation it did not ask for.
  assert.match(app,/navigator\.serviceWorker\.addEventListener\("controllerchange",\(\)=>\{if\(updating\)location\.reload\(\)\}\)/);
  assert.match(app,/updating=true;\$\("#update-now"\)\.disabled=true;waiting\.postMessage\("echo:activate-update"\)/);
  assert.match(html,/<div id="update-ready" class="update-ready" role="status" hidden>/);
});
