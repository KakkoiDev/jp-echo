import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wordNoteParts} from '../notes.js';

test('Echo’s word note shows how to say it, then the kanji (WordNote)',()=>{
 assert.deepEqual(wordNoteParts('Kanji meanings: 勉【べん】 exertion · 強【きょう】 strong.\nMora mnemonic: A giant snake coils round your desk.'),{mora:'A giant snake coils round your desk.',kanji:'勉【べん】 exertion · 強【きょう】 strong.'});
 assert.deepEqual(wordNoteParts('**Mora mnemonic:** a stamp\n\n**Kanji meanings:** none'),{mora:'a stamp',kanji:'none'},'either order, with bold labels');
 assert.equal(wordNoteParts('My own story, no labels.'),null,'a note without both parts shows whole');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/render:n=>renderWordNoteText\(block,n\.text\)\}\);\n  block\.currentText=\(\)=>note\.text;/,'adjusting still sends the whole raw note');
 assert.match(app,/t\("Echo’s note — the kanji"\)/);
 assert.match(app,/wordNoteParts\(note\.text\)\?\.mora\|\|note\.text/,'the notes list previews how to say it');
});

test('Echo’s notes: notes written with an old anchor can be rewritten together, yours are left alone',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<div id="notes-outdated" class="notes-outdated" hidden>[\s\S]*?Notes you wrote yourself are never touched\.[\s\S]*?id="notes-outdated-go"/,'Notes board: title, why, button, status');
 assert.match(app,/const outdatedNotes=entries=>entries\.filter\(\(\{note,word\}\)=>note\.by!=="you"&&moraRetiredIn\(/,'only Echo’s own versions');
 assert.match(app,/await putNote\(makeNote\(\{kind:"word",id:word\.id,part:"remember",text:made\.remember\}\)\)/,'through the backup-marking note wrapper, one at a time');
});
