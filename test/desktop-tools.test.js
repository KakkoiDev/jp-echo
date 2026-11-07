import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toolListHtml} from '../components.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('the sidebar tool list is the shelf in list form, the current tool marked',()=>{
 const html=toolListHtml([{id:'discussion',glyph:'話',label:'Discussion'},{id:'mora',glyph:'音',label:'Mora',name:'Mora table'}],{current:'mora'});
 assert.match(html,/class="nav-tool"[^>]*data-tool="discussion"/);
 assert.match(html,/data-tool="mora"[^>]*aria-current="page"/);
 assert.match(html,/Mora table/,'the full name, not the short label');
 assert.match(html,/nav-tool-glyph[^>]*>音/);
});

test('desktop: one Tools group and one search in the sidebar, fed from the shelf',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('styles.css');
 assert.match(html,/id="nav-search"/);assert.match(html,/id="nav-tools"/);
 assert.match(app,/\$\("#nav-search"\)\.onclick=[^\n]*openSearch/);
 assert.match(app,/event\.key!=="\/"/,'the / shortcut opens search');
 assert.match(app,/function renderNavTools\(\)[^\n]*LIBRARY_TOOLS/);
 assert.match(css,/@media\(min-width:1024px\)[\s\S]*#history-view #library-tools[^{]*\{display:none\}/,'Library hides its shelf where the sidebar lists the tools');
});

test('desktop Mora: ten columns and the open cell beside the table',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('styles.css');
 assert.match(html,/<aside id="mora-detail"/);
 for(const id of ['mora-detail-kana','mora-detail-word','mora-detail-mark','mora-detail-words','mora-detail-hear'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/function renderMoraDetail/);
 assert.match(app,/moraOpen=mora;/,'tapping a cell opens it');
 assert.match(css,/repeat\(10,minmax\(0,1fr\)\)/);
 assert.match(css,/\.mora-detail\{display:none\}/,'phones keep the five-column table, no panel');
});
