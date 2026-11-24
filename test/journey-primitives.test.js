import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planSteps, loadMeter, examLine, evidenceRow, pauseRing} from "../components.js";

// A minimal DOM: enough for the primitives, which build nodes and set text.
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.style = {}; this.attributes = {}; this.listeners = {}; this.className = ""; this._text = ""; }
  append(...c) { this.children.push(...c); }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(t, f) { this.listeners[t] = f; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent ?? "").join(""); }
}
const all = (el, pred, out = []) => { if (pred(el)) out.push(el); for (const c of el.children || []) if (c instanceof El) all(c, pred, out); return out; };
const byClass = (el, name) => all(el, n => n.className === name || n.attributes.class === name);
function withDom(fn) {
  const prev = global.document;
  global.document = {createElement: t => new El(t), createElementNS: (_, t) => new El(t), createTextNode: t => ({textContent: t})};
  try { return fn(); } finally { global.document = prev; }
}

test("plan steps number the day, mark one next step and tick done ones with 済", () => withDom(() => {
  let opened = null;
  const list = planSteps([
    {title: "Today's checks", line: "14 from yesterday", minutes: 12, state: "done", href: "?view=check"},
    {title: "Word first checks", line: "60 unchecked", minutes: 70, state: "next", onOpen: s => { opened = s.title; }},
    {title: "Breaks", line: "Counted in the 6 h", minutes: 40},
  ]);
  const rows = byClass(list, "plan-step");
  assert.deepEqual(rows.map(r => r.dataset.state), ["done", "next", ""]);
  assert.deepEqual(byClass(list, "plan-step-mark").map(m => m.textContent), ["済", "二", "三"], "a finished step stays, ticked (report 1ccf9988)");
  const [doneRow, nextRow, restRow] = byClass(list, "plan-step-row");
  assert.equal(doneRow.tagName, "A"); assert.equal(doneRow.href, "?view=check");
  assert.equal(nextRow.tagName, "BUTTON"); assert.equal(nextRow.attributes["aria-current"], "step");
  nextRow.listeners.click({preventDefault() {}}); assert.equal(opened, "Word first checks");
  assert.equal(restRow.tagName, "SPAN", "a step with nothing to open is not a control");
  assert.deepEqual(byClass(list, "plan-step-min").map(m => m.textContent), ["Done", "70 min", "40 min"]);
}));

test("the load meter always names its denominator and hatches what does not fit", () => withDom(() => {
  const meter = loadMeter({fits: 360, needs: 430, caption: "6 h of 7 h 10 min fits today"});
  const [bar] = byClass(meter, "load-meter-bar");
  assert.equal(bar.attributes.role, "img"); assert.equal(bar.attributes["aria-label"], "6 h of 7 h 10 min fits today");
  assert.equal(byClass(meter, "load-meter-caption")[0].textContent, "6 h of 7 h 10 min fits today");
  assert.equal(Math.round(parseFloat(byClass(meter, "load-meter-fill")[0].style.width)), 84);
  assert.equal(Math.round(parseFloat(byClass(meter, "load-meter-over")[0].style.width)), 16);
  const easy = loadMeter({fits: 90, needs: 90, caption: "90 min of the 6 h plan"});
  assert.equal(parseFloat(byClass(easy, "load-meter-over")[0].style.width), 0);
}));

test("the exam line links to the one goal editor; evidence rows show done or planned", () => withDom(() => {
  const line = examLine({text: "Exam Sun 6 Dec · first pass by Wed 2 Dec"});
  assert.equal(line.href, "./n2-mock.html#training-goal"); assert.match(line.textContent, /Change$/);
  const done = evidenceRow({done: true, title: "Checked once · right", line: "Word check", date: "21 Nov"});
  const planned = evidenceRow({title: "Recalled on another day · 0 of 1 planned", date: "27 Nov"});
  assert.equal(byClass(done, "evidence-mark")[0].dataset.done, "true");
  assert.equal(byClass(planned, "evidence-mark")[0].dataset.done, "false");
}));

test("the pause ring counts down with its arc, and holds still under reduced motion", () => withDom(() => {
  const prev = global.matchMedia;
  try {
    global.matchMedia = () => ({matches: false});
    const ring = pauseRing({total: 5});
    const arc = all(ring.el, n => n.attributes.class === "pause-ring-arc")[0];
    const num = all(ring.el, n => n.attributes.class === "pause-ring-num")[0];
    assert.equal(num.textContent, "5"); assert.equal(Number(arc.attributes["stroke-dashoffset"]), 0);
    ring.set(2); assert.equal(num.textContent, "2"); assert.ok(Number(arc.attributes["stroke-dashoffset"]) > 0);
    global.matchMedia = () => ({matches: true});
    ring.set(1); assert.equal(num.textContent, "1"); assert.equal(arc.attributes["stroke-dashoffset"], "0");
  } finally { global.matchMedia = prev; }
}));

test("the primitives are documented and styled with tokens only", () => {
  const docs = readFileSync(new URL("../COMPONENTS.md", import.meta.url), "utf8");
  for (const name of ["PlanSteps", "LoadMeter", "ExamLine", "EvidenceRow", "PauseRing"]) assert.match(docs, new RegExp("### " + name));
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf("/* Learning-journey primitives"));
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(block.slice(0, block.indexOf("@media (prefers-reduced-motion:reduce){.pause-ring-arc"))), "no raw colours");
});
