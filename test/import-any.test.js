import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyImport,importIntent} from '../imports.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js');

test('files are routed by name or type',()=>{
  assert.equal(classifyImport({file:{name:'deck.json'}}).kind,'deck-file');
  assert.equal(classifyImport({file:{name:'x',type:'application/json'}}).kind,'deck-file');
  assert.equal(classifyImport({file:{name:'Kokoro.EPUB'}}).kind,'book');
  assert.equal(classifyImport({file:{name:'notes.txt'}}).kind,'text-file');
  assert.equal(classifyImport({file:{name:'a',type:'text/plain'}}).kind,'text-file');
  assert.equal(classifyImport({file:{name:'photo.png',type:'image/png'}}).kind,'unknown');
});

test('pasted text: JSON, gist links and ids, deck links, Japanese passages',()=>{
  assert.equal(classifyImport({text:'  '}).kind,'empty');
  const deck=classifyImport({text:'{"schemaVersion":2,"sentences":[]}'});assert.equal(deck.kind,'deck-json');assert.equal(deck.data.schemaVersion,2);
  assert.equal(classifyImport({text:'{"broken":'}).kind,'unknown');
  assert.equal(classifyImport({text:'[1,2]'}).kind,'unknown');
  assert.equal(classifyImport({text:'https://gist.github.com/me/0123456789abcdef0123'}).kind,'gist');
  assert.equal(classifyImport({text:'0123456789abcdef0123'}).kind,'gist');
  assert.equal(classifyImport({text:'https://api.github.com/gists/0123456789abcdef0123'}).kind,'gist');
  assert.equal(classifyImport({text:'https://github.com/me/decks/blob/main/cafe.json'}).kind,'deck-url');
  assert.equal(classifyImport({text:'今日は雨です。明日は晴れるでしょう。'}).kind,'passage');
  assert.equal(classifyImport({text:'hello there'}).kind,'unknown');
  for(const kind of ['deck-file','book','text-file','deck-json','gist','deck-url','passage'])assert.ok(importIntent({kind}).length>10,kind);
});

test('the Import page has one box for files, links and text, wired to the existing importers',()=>{
  assert.match(html,/<div id="import-any" class="import-any"/);
  assert.match(html,/<textarea data-ui="textarea" id="import-text"/);
  assert.match(html,/<input id="import-file" type="file" accept="application\/json,\.json,\.epub,application\/epub\+zip,\.txt,\.md,text\/plain" hidden>/);
  // Each kind reaches the one place that already handles it.
  assert.match(app,/case "deck-file":return importHistory\(file\)/);
  assert.match(app,/case "deck-json":return importDeckData\(result\.data\)/);
  assert.match(app,/case "deck-url":return importDeckURL\(result\.url,\$\("#import-go"\)\)/);
  assert.match(app,/case "gist":return restoreFromGist\(result\.gist,/);
  assert.match(app,/case "book":openTextExtraction\(\);return loadExtractionBook\(file\)/);
  assert.match(app,/case "passage":return openExtractionText\(result\.text\)/);
  assert.match(app,/async function gistRestore\(\)\{[\s\S]*?return restoreFromGist\(/);
});

test('Extract takes files through the same router: its button and a drop on the passage',()=>{
  assert.match(html,/<label class="file-button" for="extract-epub">Open a file<input id="extract-epub" class="sr-only" type="file" accept="\.epub,application\/epub\+zip,\.txt/);
  assert.match(app,/\$\('#extract-epub'\)\.onchange=async event=>\{const file=event\.target\.files\[0\];event\.target\.value='';if\(file\)await importAny\(\{file\}\)\}/);
  assert.match(app,/box\.addEventListener\('drop',event=>\{const file=event\.dataTransfer\?\.files\?\.\[0\];[^}]*void importAny\(\{file\}\)/);
});
