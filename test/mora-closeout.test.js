import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moraPicture} from '../mora-pictures.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('MoraCombined: rows run base then voiced, each labelled, 33 cells',()=>{
 const app=read('app.js');
 assert.match(app,/MORA_YOON_ROWS=\["き","ぎ","し","じ","ち","に","ひ","び","ぴ","み","り"\]/);
 assert.match(app,/moraTable\(\$\("#mora-yoon-table"\),MORA_YOON_ROWS,options,\["ya","yu","yo"\],\{rowLabels:true\}\)/);
});

test('a fused combined sound shows both anchors with ＋ and a FUSED tag, never a blank cell',()=>{
 assert.equal(moraPicture('にゃ'),null,'にゃ has no anchor of its own');
 assert.ok(moraPicture('に')&&moraPicture('や'),'its two anchors both have pictures');
 const app=read('app.js');
 assert.match(app,/mora-fused-pictures[^\n]*mora-fused-plus[^\n]*＋/);
 assert.match(app,/mora-fused-tag/);
});

test('MoraSpecials: small っ, ん and を with pictures, the marks open their sections',()=>{
 const html=read('index.html');
 assert.match(html,/id="mora-special-tte"/);
 assert.match(html,/id="mora-special-n"/);assert.match(html,/id="mora-special-wo"/);
 assert.match(html,/class="mora-special-link" data-section="voiced"/);
 assert.match(html,/class="mora-special-link" data-section="combined"/);
 assert.match(read('app.js'),/#mora-section-specials \[data-section\]/);
});

test('Test yourself sits on its own line, with what it does (MoraCompact)',()=>{
 assert.match(read('index.html'),/<div class="mora-controls mora-test"><label><input id="mora-quiz" type="checkbox"> Test yourself<\/label><span class="mora-test-hint">hides the anchors until you tap<\/span>/);
});

test('each voiced mark card carries its reason (MoraVoiced)',()=>{
 const html=read('index.html');
 assert.match(html,/mora-mark-why[^>]*>Voiced sounds feel big: <span lang="ja">ゴロゴロ<\/span>/);
 assert.match(html,/mora-mark-why[^>]*>P is a popping sound/);
});

test('Mora v5: five anchors changed, pictures follow, old notes are pointed out',async()=>{
 const {MORA_MNEMONICS,MORA_MNEMONICS_VERSION,moraMnemonicPrompt}=await import('../core.js');
 assert.equal(MORA_MNEMONICS_VERSION,5);
 assert.deepEqual(['よ','れ','ち','ん','こ'].map(k=>MORA_MNEMONICS[k]),['鎧','レモン','地図','判子','駒']);
 assert.match(moraMnemonicPrompt(),/みょ=水＋鎧/);assert.match(moraMnemonicPrompt(),/ご=巨大な駒/);assert.doesNotMatch(moraMnemonicPrompt(),/ヨット|頷き|蝶々|冷蔵庫|氷/);
 const app=read('app.js'),html=read('index.html');
 assert.match(app,/MORA_V4_RETIRED=Object\.freeze\(\{"よ":"ヨット","れ":"冷蔵庫","ち":"蝶々","ん":"頷き","こ":"氷"\}\)/);
 assert.match(html,/id="word-note-retired"/);assert.doesNotMatch(html,/頷き|is a nod/);
});
