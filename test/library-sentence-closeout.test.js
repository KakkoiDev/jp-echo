import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('LibraryFilter: the sheet says its search looks only in your sentences',()=>{
 assert.match(read('index.html'),/<p class="hint filter-sheet-hint">[^<]*This search looks only in your sentences; the magnifier in the header searches words and kanji too\.<\/p><div class="dialog-actions"><button data-ui="button" id="library-filter-done"/);
});

test('SentenceFocus: the echo count is on the History row, visible without opening it',()=>{
 assert.match(read('app.js'),/\$\("#sentence-history-count"\)\.textContent=t\("Made \{date\}"/);
});

test('Radio is offered from 7 pm until morning, and the hint says so',()=>{
 assert.match(read('index.html'),/Radio sits here from 7 pm until morning\./);
});

test('LibraryFilter: Direction is named for the chosen sort, Done spans the sheet',()=>{
 assert.match(read('app.js'),/function syncDirectionLabels\(\)\{const order=\$\("#history-order"\)\.value;for\(const option of \$\("#history-direction"\)\.options\)option\.textContent=t\(ORDER_LABELS\[order\+"-"\+option\.value\]/);
 assert.match(read('app.js'),/function libraryFilterSummary\(\)\{syncDirectionLabels\(\);/);
 assert.match(read('styles.css'),/#library-filter-sheet \.dialog-actions button\{width:100%/);
});
