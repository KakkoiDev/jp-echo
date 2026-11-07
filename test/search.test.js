import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoute,routeFor} from '../routes.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js'),sw=read('sw.js');

test('one search: /search keeps its query in the URL across reload and back',()=>{
 assert.equal(routeFor({view:'search',searchQuery:'かさ'}),'/search?q='+encodeURIComponent('かさ'));
 assert.equal(routeFor({view:'search'}),'/search');
 const route=parseRoute('/search?q=umbrella');assert.equal(route.view,'search');assert.equal(route.searchQuery,'umbrella');
 assert.match(app,/if\(route\.searchQuery!=null\)\$\("#search-input"\)\.value=route\.searchQuery/);
 assert.match(app,/\$\("#search-input"\)\.oninput=\(\)=>\{syncRoute\(\{\},true\);renderSearch\(\)\}/,'typing replaces the entry, it does not stack history');
 assert.match(sw,/radio\|search\|setup/,'offline: /search opens the installed shell');
});

test('the magnifier is the shared HeaderSearch in the one tab header, beside the gear',()=>{
 assert.match(html,/<h2 id="view-title" hidden><\/h2><button data-ui="button" type="button" class="icon-button header-search" aria-label="Search everything">/);
 assert.match(app,/hydrateHeaderSearch\(document,\{onOpen:openSearch\}\)/);
});

test('results open where they live: a word its sheet, a kanji its sheet, a sentence its page',()=>{
 const body=app.slice(app.indexOf('async function renderSearch'),app.indexOf('$("#search-input").oninput'));
 assert.match(body,/row\.onclick=\(\)=>openWord\(w,wordCoverage\(all\)\)/);
 assert.match(body,/row\.onclick=\(\)=>openKanji\(c,cover\)/);
 assert.match(body,/row\.onclick=\(\)=>openDetail\(item\.id\)/);
 assert.match(body,/escapeText\(plain\.slice\(0,at\)\)\+'<mark>'/,'the match is marked and the text escaped');
 for(const scope of ['all','sentences','words','kanji'])assert.match(html,new RegExp(`data-scope="${scope}"`));
});
