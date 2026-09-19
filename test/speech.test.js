import test from "node:test";
import assert from "node:assert/strict";

class FakeUtterance {
  constructor(text) { this.text = text; }
}

globalThis.SpeechSynthesisUtterance = FakeUtterance;
const spoken = [];
globalThis.speechSynthesis = {
  speak: utterance => spoken.push(utterance),
  cancel() {}, pause() {}, resume() {}, getVoices: () => [],
};
globalThis.window = {
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  performance: globalThis.performance,
};

const {ShadowLoop} = await import("../speech.js");

test("repeats after a completed utterance", () => {
  spoken.length = 0;
  const timers = [];
  let echoes = 0;
  const loop = new ShadowLoop({onEcho:()=>echoes++,onState:()=>{},setTimer:fn=>timers.push(fn),clearTimer:()=>{},now:()=>1000});
  loop.play("これはテストです",{rate:1});
  assert.equal(spoken.length,1);
  spoken[0].onend();
  assert.equal(echoes,1);
  assert.equal(timers.length,1);
  timers[0]();
  assert.equal(spoken.length,2);
});

test("a stale cancellation cannot stop a new loop", () => {
  spoken.length = 0;
  const loop = new ShadowLoop({onEcho:()=>{},onState:()=>{}});
  loop.play("first",{rate:1});
  const staleError = spoken[0].onerror;
  loop.play("second",{rate:1});
  staleError({error:"canceled"});
  assert.equal(loop.running,true);
  assert.equal(spoken.at(-1).text,"second");
});

test("default browser timers keep their Window receiver", () => {
  spoken.length = 0;
  const originalClear = window.clearTimeout;
  let receiver;
  window.clearTimeout = function(timer){receiver=this;return originalClear(timer)};
  const loop = new ShadowLoop({onEcho:()=>{},onState:()=>{}});
  loop.stop(false);
  assert.equal(receiver,window);
  window.clearTimeout = originalClear;
});
