import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js'),css=read('styles.css'),components=read('components.js');

test('practice keeps one ⋯ button; edit, flag, open and delete live in its sheet (PracticeMenu.dc.html)',()=>{
  assert.match(html,/id="practice-more" class="icon-button"[^>]*aria-label="More for this sentence"/);
  assert.doesNotMatch(html,/sentence-quick-actions/);
  const sheet=html.match(/<dialog id="practice-menu"[\s\S]*?<\/dialog>/)?.[0];assert.ok(sheet);
  for(const id of ['practice-edit','practice-flag','practice-open','practice-delete'])assert.match(sheet,new RegExp('id="'+id+'"[^>]*class="settings-row menu-row'));
  assert.match(sheet,/The loop keeps playing while this is open\./);
  // Opening the sheet never touches the loop.
  const open=app.match(/\$\("#practice-more"\)\.onclick=[^\n]*/)[0];assert.doesNotMatch(open,/loop\./);
});

test('the flag is a drawn icon in every place it appears, never the ⚑ character',()=>{
  for(const [name,source] of [['index.html',html],['app.js',app]])assert.doesNotMatch(source,/⚑/,name);
  assert.match(components,/export const flagSvg=`<svg class="flag-glyph"/);
  assert.match(components,/export function renderFlagButton\(/);assert.doesNotMatch(app,/function renderFlagButton\(/);
  // The review flag is an icon button in the session bar, named by its label.
  const bar=html.match(/<div class="session-bar"><button data-ui="button" id="review-back"[\s\S]*?<\/div>/)[0];
  assert.match(bar,/id="review-flag" type="button" class="icon-button" aria-pressed="false" aria-label="Flag for later"/);
  assert.match(css,/\[aria-pressed="true"\] \.flag-glyph\{fill:currentColor\}/);
});

test('when the device asks for less motion, Settings says that is why the echo is still',()=>{
  assert.match(html,/<p id="motion-hint" class="hint">/);
  assert.match(app,/const reducedMotion=matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(app,/motion==="system"&&reducedMotion\.matches\?t\("Your device is asking for less motion right now/);
  assert.match(app,/root\.classList\.toggle\("motion-off",motion==="off"\);renderMotionHint\(motion\)/);
  // The playing state reaches every live ring and arc pair, not only the arcs.
  assert.match(app,/document\.querySelectorAll\("\.arcs > \.echo, \.ripple\.echo\.live"\)/);
});

test('settings and the end of a session say "a day" (Settings.dc.html, ReviewDone.dc.html)',()=>{
  assert.match(html,/<h4>Reviews<\/h4>/);assert.match(html,/<span>New a day<\/span>/);assert.match(html,/<span>Reviews a day<\/span>/);
  assert.match(html,/A “day” is the last 20 hours/);
  assert.match(app,/\$\("#review-complete-title"\)\.textContent=done&&remaining\.length\?t\("All said for today"\):t\("All said"\)/);
});
