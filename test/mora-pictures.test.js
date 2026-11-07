import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {MORA_ROMAJI,ANCHOR_PICTURES,moraPicture,moraSection,moraCellHref,anchorStripItems} from '../mora-pictures.js';
import {MORA_MNEMONICS,MORA_MNEMONICS_VERSION,MORA_YOON,moraMnemonicTokens} from '../core.js';
import {parseRoute,routeFor} from '../routes.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('every current anchor has a light and a dark drawing; the undecided alternates do not ship',()=>{
 for(const kana of [...Object.keys(MORA_MNEMONICS),...Object.keys(MORA_YOON)]){const p=moraPicture(kana);assert.ok(p,kana);for(const f of [p.light,p.dark])assert.ok(existsSync(new URL('..'+f,import.meta.url)),f)}
 for(const dir of ['anchors','anchors-dark'])assert.deepEqual(readdirSync(new URL('../'+dir,import.meta.url)).filter(f=>f.includes('-')),[],'no よ→鎧, れ→レモン … alternates until the owner decides');
 assert.equal(MORA_MNEMONICS_VERSION,4,'the anchors themselves are unchanged');
});

test('voiced and p-sounds reuse the base drawing; a fused combined sound has none',()=>{
 assert.deepEqual(moraPicture('ぐ'),moraPicture('く'));assert.deepEqual(moraPicture('ぱ'),moraPicture('は'));
 assert.deepEqual(moraPicture('じょ'),moraPicture('しょ'));assert.equal(moraPicture('にゃ'),null);
});

test('offline: every drawing and the module are precached',()=>{
 const sw=read('sw.js');assert.match(sw,/"\.\/mora-pictures\.js"/);
 for(const path of ANCHOR_PICTURES)assert.ok(sw.includes(JSON.stringify(path)),path);
 assert.equal(ANCHOR_PICTURES.length,new Set(Object.values(MORA_ROMAJI)).size*2);
});

test('sections live in the URL and each cell has an address the strip can link to',()=>{
 assert.equal(routeFor({view:'mora',moraSection:'voiced'}),'/mora?section=voiced');
 assert.equal(routeFor({view:'mora',moraSection:'base'}),'/mora');
 assert.equal(parseRoute('/mora?section=combined').moraSection,'combined');
 assert.equal(parseRoute('/mora?section=nonsense').moraSection,'base');
 assert.equal(moraSection('く'),'base');assert.equal(moraSection('ぐ'),'voiced');assert.equal(moraSection('きょ'),'combined');
 assert.equal(moraCellHref('べ'),'/mora?section=voiced#'+encodeURIComponent('べ'));
 assert.match(read('app.js'),/cell\.id=mora;/);
});

test('Echo’s note strip: the reading’s anchors in order, each with its mark and its cell',()=>{
 const items=anchorStripItems(moraMnemonicTokens('べんきょう'));
 assert.deepEqual(items.map(i=>i.mora),['べ','ん','きょ','う']);
 assert.equal(items[0].mark,'giant');assert.ok(items[0].picture);
 assert.match(read('app.js'),/anchorStripItems\(moraMnemonicTokens\(w\.r\|\|""\)\)/);
});
