import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoute,routeFor} from '../routes.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js');

test('Library is the one home for tools: six tiles, Kanji and Mora only for Japanese',()=>{
 const tools=app.match(/const LIBRARY_TOOLS=(\[.*?\]);/)[1];
 for(const [glyph,id] of [['話','discussion'],['読','reading'],['本','extract'],['夜','radio'],['学','map'],['音','mora']])assert.match(tools,new RegExp(`id:"${id}",glyph:"${glyph}"`));
 assert.match(tools,/id:"map"[^}]*ja:true/);assert.match(tools,/id:"mora"[^}]*ja:true/);
 assert.doesNotMatch(html,/id="library-tool"|id="mora-open"/,'the old tool rows are gone, not duplicated');
 assert.match(html,/<p id="tools" class="sr-only">Tools<\/p><div id="library-tools"/,'/library#tools lands on the shelf');
});

test('the filters fold into one FilterButton; search, Cards, Sort and Direction live in its sheet',()=>{
 const sheet=html.slice(html.indexOf('<dialog id="library-filter-sheet"'),html.indexOf('</dialog>',html.indexOf('<dialog id="library-filter-sheet"')));
 for(const id of ['history-search','history-filter','history-order','history-direction'])assert.match(sheet,new RegExp(`id="${id}"`));
 assert.match(html,/<div class="list-head" hidden><span id="library-count"><\/span><div id="library-progress"[\s\S]*?<button data-ui="button" id="library-filter"/,'count, one meter line, the filter button');
 assert.match(app,/renderFilterButton\(\$\("#library-filter"\),libraryFilterSummary\(\)\)/);
 assert.match(app,/wireFilterButton\(\$\("#library-filter"\),\$\("#library-filter-sheet"\)\)/);
});

test('Echo’s notes: a 記 row in Library and its own route that survives reload',()=>{
 assert.equal(routeFor({view:'notes'}),'/words?notes=1');
 assert.equal(parseRoute('/words?notes=1').view,'notes');
 assert.equal(parseRoute('/words').view,'map','the Words wall is unchanged');
 assert.match(html,/id="library-notes-open"[^>]*><span class="library-notes-glyph" lang="ja" aria-hidden="true">記<\/span>Echo’s notes/);
 assert.match(app,/note\.kind==="word"&&note\.part==="remember"/);
 assert.match(app,/sort\(\(a,b\)=>String\(b\.note\.made\)\.localeCompare\(String\(a\.note\.made\)\)\)/,'newest first');
 assert.match(app,/entries\.slice\(0,3\)/,'the row shows the three newest');
});
