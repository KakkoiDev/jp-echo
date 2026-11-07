import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('Write it again: a fresh wording that replaces the sentence, through the one rewrite',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/id="sentence-edit"[\s\S]*?<\/button><button data-ui="button" id="sentence-again" type="button" class="settings-row menu-row"><span class="menu-glyph" lang="ja" aria-hidden="true">新<\/span>[\s\S]*?Write it again/);
 assert.match(app,/\$\("#sentence-again"\)\.onclick=\(\)=>\{if\(!detail\|\|!hasTranslator\(\)\)return;openEditor\(\);\$\("#sentence-instruction"\)\.value=t\(WRITE_AGAIN\);rewriteDetailSentence\(\)/,'no second rewrite: the instruction is filled in and the same flow runs');
 assert.match(app,/\$\("#sentence-again"\)\.disabled=!hasTranslator\(\)/);
 assert.match(app,/Save to replace this sentence\./,'nothing changes until Save, and Save replaces');
});
