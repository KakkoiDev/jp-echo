import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startDrill,answerDrill,drillProgress} from '../mora-drill.js';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('DrillStart: the first sound waits for a tap; the choices open once it is heard',()=>{
 assert.match(app,/heard:false/,'a fresh drill has not been heard yet');
 assert.match(app,/function sayDrillSound\(\)\{[^\n]*if\(!drill\.heard\)\{drill\.heard=true;renderDrill\(\)\}/);
 assert.match(app,/else if\(waiting\)\{card\.disabled=true;card\.classList\.add\("waiting"\)/);
 assert.match(app,/t\("Tap to hear the first sound"\)/);
 assert.match(app,/\$\("#drill-next"\)\.onclick=[^\n]*sayDrillSound\(\)/,'each later sound plays by itself');
});

test('DrillMiss: your pick is marked and struck, the counter says how many repeat',()=>{
 let s=startDrill(['く','さ','ね','の']);s=answerDrill(s,'し');
 assert.equal(drillProgress(s).toRepeat,1);
 assert.match(app,/t\("Your pick"\)/);assert.match(app,/t\("Not this time"\)/);
 assert.match(app,/\+\(toRepeat\?" · "\+t\("\{n\} to repeat",\{n:toRepeat\}\):""\)/);
 assert.match(readFileSync(new URL('../styles.css',import.meta.url),'utf8'),/\.drill-choice\.picked \.drill-kanji\{text-decoration:line-through/);
});

test('DrillDonePerfect: one line instead of the misses list, and "Drill 10 more"',()=>{
 assert.match(app,/t\("Drill \{n\} more",\{n:DRILL_SIZE\}\)/);
 assert.match(app,/\$\("#drill-missed"\)\.hidden=!missed\.length/);
 assert.match(app,/Nothing to look at again\./);
});
