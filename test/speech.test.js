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

test("pause also suspends the silent imitation interval", () => {
  spoken.length = 0;
  const timers = [];
  const cleared = [];
  let now = 1000;
  const loop = new ShadowLoop({onEcho:()=>{},onState:()=>{},setTimer:(fn,delay)=>{timers.push({fn,delay});return timers.length},clearTimer:id=>cleared.push(id),now:()=>now});
  loop.play("test",{rate:1});
  spoken[0].onend();
  now = 1200;
  assert.equal(loop.togglePause(),true);
  assert.deepEqual(cleared,[null,1]);
  assert.equal(loop.togglePause(),false);
  assert.equal(timers.length,2);
  assert.ok(timers[1].delay<timers[0].delay);
});

test("the loop shows it is playing without waiting for the engine", () => {
  spoken.length = 0;
  const states = [];
  const loop = new ShadowLoop({onEcho:()=>{},onState:s=>states.push(s),setWatchdogTimer:()=>1,clearWatchdogTimer:()=>{}});
  loop.play("これはテストです",{rate:1});
  // No onstart yet — the press alone puts the screen in the playing state, so
  // the arcs and the loop dot move the moment the user asks for them.
  assert.deepEqual(states,["speaking"]);
  spoken[0].onstart();
  assert.deepEqual(states,["speaking","speaking"]);
});

test("a voice that never starts gives up instead of hanging", () => {
  spoken.length = 0;
  const states = [];
  let fire = null;
  const loop = new ShadowLoop({onEcho:()=>{},onState:s=>states.push(s),setWatchdogTimer:fn=>{fire=fn;return 1},clearWatchdogTimer:()=>{}});
  loop.play("これはテストです",{rate:1});
  assert.equal(loop.running,true);
  fire();
  assert.deepEqual(states,["speaking","error"]);
  // Left running, the next press would only reach togglePause and report
  // "Paused" for a loop that never played.
  assert.equal(loop.running,false);
});

test("a voice that starts cancels the watchdog", () => {
  spoken.length = 0;
  const cleared = [];
  let fire = null;
  const loop = new ShadowLoop({onEcho:()=>{},onState:()=>{},setWatchdogTimer:fn=>{fire=fn;return 7},clearWatchdogTimer:id=>cleared.push(id)});
  loop.play("これはテストです",{rate:1});
  spoken[0].onstart();
  assert.deepEqual(cleared,[7]);
  fire();
  assert.equal(loop.running,true);
});

test("a synthesiser that throws reports the failure", () => {
  spoken.length = 0;
  const states = [];
  const speak = globalThis.speechSynthesis.speak;
  globalThis.speechSynthesis.speak = () => {throw new Error("no voice")};
  const loop = new ShadowLoop({onEcho:()=>{},onState:s=>states.push(s),setWatchdogTimer:()=>1,clearWatchdogTimer:()=>{}});
  loop.play("これはテストです",{rate:1});
  globalThis.speechSynthesis.speak = speak;
  assert.deepEqual(states,["speaking","error"]);
  assert.equal(loop.running,false);
});
