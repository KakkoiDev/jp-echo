import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toolShelfHtml,headerSearchHtml,filterButtonHtml,anchorStripHtml,cornerMarkHtml,themedPictureHtml,savedMarkHtml,savedMarkSvg} from '../components.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8'),doc=readFileSync(new URL('../COMPONENTS.md',import.meta.url),'utf8');

test('ToolShelf lays every tool out as a glyph tile with a label and an accessible name',()=>{
 const html=toolShelfHtml([{id:'discussion',glyph:'話',label:'Discussion'},{id:'map',glyph:'学',label:'Kanji',name:'Kanji, words and grammar'}]);
 assert.match(html,/^<nav class="tool-shelf" aria-label="Tools">/);
 assert.equal((html.match(/class="tool-shelf-tile"/g)||[]).length,2);
 assert.match(html,/data-tool="map" aria-label="Kanji, words and grammar"><span class="tool-shelf-glyph" lang="ja" aria-hidden="true">学<\/span><span class="tool-shelf-label">Kanji<\/span>/);
 assert.match(css,/\.tool-shelf-glyph\{width:52px;height:52px;[^}]*var\(--hairline\)[^}]*var\(--panel\)[^}]*font-size:21px;color:var\(--seal-deep\)/);
});

test('HeaderSearch is the shared icon button with a drawn magnifier, named for what it does',()=>{
 const html=headerSearchHtml();
 assert.match(html,/class="icon-button header-search" aria-label="Search everything"><svg/);
 assert.doesNotMatch(html,/🔍/);
});

test('FilterButton names the current filter and never owns the filters themselves',()=>{
 assert.match(filterButtonHtml('All · Newest'),/^<span class="filter-button-label">All · Newest<\/span><svg/);
 assert.match(css,/\.filter-button\{height:34px;[^}]*border:1px solid var\(--hairline\);border-radius:3px;[^}]*font-size:12px;[^}]*color:var\(--ink-soft\)/);
});

test('AnchorStrip links each anchor of a reading, in order, to its Mora cell with the one corner mark',()=>{
 const items=[{mora:'べ',image:'巨大な蛇',mark:'giant',href:'/mora?section=voiced#べ',picture:{light:'anchors/he.png',dark:'anchors-dark/he.png'}},{mora:'ん',image:'頷き',href:'/mora?section=specials#ん'}];
 const html=anchorStripHtml(items);
 assert.equal((html.match(/class="anchor-cell"/g)||[]).length,2);
 assert.ok(html.indexOf('べ')<html.indexOf('ん'),'reading order');
 assert.match(html,/href="\/mora\?section=voiced#べ"/);
 assert.match(html,/<span class="anchor-modifier">巨大な<\/span>蛇/);
 assert.match(html,/class="corner-mark giant"[^>]*>巨</);
 assert.match(html,/picture-light" src="anchors\/he.png"[\s\S]*picture-dark" src="anchors-dark\/he.png"/);
 assert.equal((html.match(/anchor-arrow/g)||[]).length,1,'an arrow between anchors, not after the last');
 const compact=anchorStripHtml(items,{compact:true});
 assert.match(compact,/<span class="anchor-chip"><b>べ<\/b>巨大な蛇<\/span><span class="anchor-chip"><b>ん<\/b>頷き<\/span>/);
});

test('one corner mark for giant and balloon, and text from the library is escaped',()=>{
 assert.match(cornerMarkHtml('giant'),/aria-label="giant"[^>]*>巨</);
 assert.match(cornerMarkHtml('balloon'),/class="corner-mark balloon"/);
 assert.equal(cornerMarkHtml(null),'');
 assert.doesNotMatch(anchorStripHtml([{mora:'<b>',image:'"x"',href:'javascript:"'}]),/<b>|"x"/);
 assert.doesNotMatch(toolShelfHtml([{id:'a',glyph:'<i>',label:'<img>'}]),/<i>|<img>/);
});

test('a themed picture shows the drawing for the active theme, including a forced one',()=>{
 const html=themedPictureHtml({light:'a.png',dark:'d.png'});
 assert.match(html,/picture-light" src="a.png"[\s\S]*picture-dark" src="d.png"/);
 assert.match(css,/\[data-theme="dark"\] \.themed-picture \.picture-light\{display:none\}/);
 assert.match(css,/@media\(prefers-color-scheme:dark\)\{\[data-theme="system"\] \.themed-picture \.picture-light\{display:none\}/);
});

test('the new primitives are documented before any screen uses them',()=>{
 for(const name of ['ToolShelf','HeaderSearch','FilterButton','AnchorStrip'])assert.match(doc,new RegExp('### '+name));
});

test('the settings gear is drawn like the search glyph: a line, not a filled cog',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const gears=html.match(/<svg class="gear-glyph"[^]*?<\/svg>/g)||[];
 assert.equal(gears.length,2,'the header button and the desktop rail');
 for(const gear of gears){assert.match(gear,/viewBox="0 0 16 16" fill="none"/);assert.doesNotMatch(gear,/fill="currentColor"/);assert.match(gear,/stroke-width="1\.3"/)}
});

test('SavedMark is one drawn bookmark: a 12px row mark or the sheet\'s pressed IconButton, never a new colour',()=>{
 assert.match(savedMarkSvg(),/^<svg class="saved-glyph" width="9" height="12" viewBox="0 0 12 16" fill="none" aria-hidden="true"><path d="M2 1\.5h8v13l-4-3\.2-4 3\.2v-13Z" stroke="currentColor" stroke-width="1\.4"/);
 assert.match(savedMarkSvg({size:16}),/width="12" height="16"/);
 assert.match(savedMarkHtml(true,{label:'Saved'}),/^<span class="saved-mark" data-saved="true" role="img" aria-label="Saved"><svg class="saved-glyph"/);
 assert.match(savedMarkHtml(false),/data-saved="false" aria-hidden="true"/);
 assert.match(savedMarkHtml(true,{label:'<b>'}),/aria-label="&lt;b&gt;"/,'labels are escaped');
 assert.doesNotMatch(savedMarkSvg(),/🔖|#[0-9a-f]{3,6}/i,'drawn, and coloured only by tokens');
 const block=css.slice(css.indexOf('/* Saved words'));
 assert.ok(block.length>100,'one block headed Saved words');
 assert.doesNotMatch(block,/#[0-9a-fA-F]{3,8}\b|rgba?\(/,'no raw colours in the Saved words block');
 assert.match(block,/\.saved-mark\[data-saved=true\] \.saved-glyph,\.icon-button\[aria-pressed="true"\] \.saved-glyph\{fill:var\(--seal\)\}/);
 assert.match(html,/<button data-ui="button" id="word-save" class="icon-button small hit word-save" type="button" aria-pressed="false" aria-label="Save word"><\/button><button data-ui="button" id="word-close"/,'the toggle sits in the sheet head, before Close');
 assert.match(doc,/### SavedMark/);
 // Rows show the mark, never a button; every row form goes through savedMarkHtml.
 assert.ok((app.match(/savedMarkHtml\(/g)||[]).length>=4,'search, words map, lookup and notes rows');
 assert.doesNotMatch(app,/<svg[^>]*viewBox="0 0 12 16"/,'no copied bookmark markup in app.js');
});
