import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const app=await readFile(new URL("../app.js",import.meta.url),"utf8");
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");

test("word mnemonic has working explicit edit delete regenerate and voice controls",()=>{
  for(const cls of ["note-adjust-mic","note-edit","note-save","note-delete","note-regenerate"])assert.match(html,new RegExp('class="[^"]*'+cls));
  assert.match(app,/text\.onblur=null/,"word note disables the generic blur-save race");
  assert.match(app,/edit\.onclick=/);assert.match(app,/saveEdit\.onclick=/);assert.match(app,/del\.onclick=async/);assert.match(app,/regen\.onclick=async/);
  assert.match(app,/deleteNote\(noteKey\("word",w\.id,"remember"\)\)/);
  assert.match(app,/bindDictation\(mic,instruction,status\)/);
  assert.match(app,/writeWordNote\(\{word:w\.w,reading:w\.r,meaning:w\.en\.join/,"regenerate starts from word data, not old note");
});

test("rewrite passes the actual current note and persists the replacement",()=>{
  assert.match(app,/adjustNote\(\{about,kind,current:block\.currentText\?block\.currentText\(\):current\(\),instruction\}/);
  assert.match(app,/note=await onSave\(made,"you"\)/);
});

test("library exposes skipped filter and review persists then clears skipped state",()=>{
  assert.match(html,/<option value="skipped">Skipped<\/option>/);
  assert.match(app,/filter==="skipped"\)return item\.skipped===true/);
  assert.match(app,/skipped:true,skippedAt:new Date/);
  assert.match(app,/skipped:false,skippedAt:null/);
});

test("workspace restoration keeps page searches practice mode and open tool modal",()=>{
  assert.match(app,/WORKSPACE_KEY="jp-echo-workspace"/);
  assert.match(app,/historyQuery:/);assert.match(app,/mapQuery:/);assert.match(app,/discussionMode/);
  assert.match(app,/async function restoreWorkspace/);
  assert.match(app,/s\.modal\.kind==="word"/);assert.match(app,/s\.modal\.kind==="kanji"/);assert.match(app,/s\.modal\.kind==="grammar"/);
});

test("discussion UI includes scenario dictation and sentence saving",()=>{
  assert.match(html,/id="discussion-scenario-mic"/);
  assert.match(app,/discussion-scenario-mic/);
  assert.match(app,/Save sentence/);
  assert.match(app,/createSentence\(turn\.source/);
});

test("settings support same-language pairs swap and three voice policies",()=>{
  assert.match(html,/id="settings-swap-langs"/);
  assert.match(html,/id="discussion-voice-ai"/);assert.match(html,/id="discussion-voice-user"/);
  assert.match(app,/Random voice/);assert.match(app,/Default voice/);
  assert.match(app,/setPair\(targetLang\(\),sourceLang\(\)\)/);
  assert.doesNotMatch(app,/if\(source===target\)source=/,"same-language pairs must not be rewritten");
});

test("target voice management is reachable from settings and missing-voice notice",()=>{
  assert.match(html,/id="voice-manage"/);assert.match(html,/id="voice-install"/);
  assert.match(app,/voice-manage/);assert.match(app,/voice-install/);
  assert.match(app,/installTargetVoice/);
});


test("word practice is creation from intent rather than validation",()=>{assert.match(html,/id="word-say-go"[^>]*><span class="label">Create sentence<\/span>/);assert.match(app,/composeWordFromIntent\(/);assert.doesNotMatch(app,/That sentence does not use \{word\}/);assert.match(app,/Give Echo the meaning you want to express/)});
