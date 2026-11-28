// The Transport component (board 14, designer handoff 28 Nov): one way to play sound in Quick round.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {TRANSPORT_GLYPHS, TRANSPORT_LABEL, TRANSPORT_SIZE, transportGlyph} from "../components.js";

const src = p => readFileSync(new URL(p, import.meta.url), "utf8");
const html = src("../n2-mock.html"), css = src("../styles.css"), mock = src("../n2-mock.js"), components = src("../components.js");

test("the glyphs: state glyphs filled, moves in 2 px strokes, on a 24 px grid; no sun or moon", () => {
  assert.deepEqual(TRANSPORT_GLYPHS, ["play", "pause", "stop", "replay", "previous", "next", "later", "voice"]);
  for (const g of ["play", "pause", "stop"]) assert.match(transportGlyph(g), /viewBox="0 0 24 24"[^>]*>.*fill="currentColor"/, g);
  for (const g of ["replay", "previous", "next", "later", "voice"]) assert.match(transportGlyph(g), /stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/, g);
  assert.match(transportGlyph("play"), /M8 5\.6v12\.8a1 1 0 0 0 1\.5\.86l10\.2-6\.4/);
  assert.equal(transportGlyph("moon"), "");
  assert.deepEqual(TRANSPORT_SIZE, {"tp-start": 20, "tp-main": 26, "tp-side": 22, "tp-hero": 40, "tp-night": 24});
  for (const [g, label] of Object.entries({play: "Play", pause: "Pause", replay: "Replay", previous: "Previous", next: "Next", later: "Later", stop: "Stop the Night Radio", voice: "Hear it again"})) assert.equal(TRANSPORT_LABEL[g], label);
});

test("the sizes and states as the board draws them, in Echo's tokens", () => {
  assert.match(css, /\.tp-start\{display:flex;align-items:center;gap:14px;width:100%;height:60px;padding:0 10px 0 8px;border-radius:18px;border:0;background:var\(--sumi\);color:var\(--washi\)/);
  assert.match(css, /\.tp-start \.tp-disc\{width:44px;height:44px;flex:none;border-radius:22px;background:var\(--washi\)/);
  assert.match(css, /\.tp-main\{width:64px;height:64px;border:0;background:var\(--sumi\);color:var\(--washi\)\}/);
  assert.match(css, /\.tp-side\{width:52px;height:52px;border:1\.5px solid var\(--hairline\)/);
  assert.match(css, /\.tp-hero\{width:96px;height:96px/);
  assert.match(css, /\.tp-night\{width:72px;height:72px;border:1\.5px solid var\(--night-ring\);background:transparent;color:var\(--night-text\)\}/);
  // Playing and paused: a 3 px ring 5 px outside the disc; finished: outline with replay and "Again".
  assert.match(css, /:is\(\.tp-main,\.tp-hero\):is\(\[data-state=playing\],\[data-state=paused\]\)::before\{content:"";position:absolute;inset:-8px/);
  assert.match(css, /\.tp-main\[data-state=finished\]\{background:transparent;color:var\(--sumi\);border:2px solid var\(--sumi\)\}/);
  // Disabled: --rule ground, --ink-muted at full opacity, the disc dashed; never an opacity fade.
  assert.match(css, /body \.tp-start:disabled,body \.tp-start\[aria-disabled=true\]\{background:var\(--rule\);color:var\(--ink-muted\);opacity:1/);
  assert.match(css, /body \.tp-start:disabled \.tp-disc,body \.tp-start\[aria-disabled=true\] \.tp-disc\{background:transparent;border:1\.5px dashed var\(--ink-muted\)/);
  // Raw colour in the Transport block: only the night's three greys.
  const block = css.slice(css.indexOf("/* Transport (board 14"), css.indexOf("/* Signs (map 12)"));
  assert.deepEqual([...new Set(block.match(/#[0-9A-Fa-f]{6}\b/g))].sort(), ["#3A342B", "#857D70", "#9A9184"]);
});

test("every place that plays sound uses the component, and a disabled start says why", () => {
  for (const id of ["game-day-start", "game-night-start", "game-home-radio", "game-sleep"]) assert.match(html, new RegExp('class="tp-start[^"]*" id="' + id + '"[^>]*data-tp data-tp-glyph="play"'), id);
  for (const id of ["day-prev", "day-repeat", "day-later", "day-next"]) assert.match(html, new RegExp('class="tp-side" id="' + id + '"'), id);
  assert.match(html, /class="tp-main" id="day-play" type="button" data-tp data-tp-glyph="play" data-state="ready"/);
  assert.match(html, /class="tp-hero" id="game-say" type="button" data-tp data-tp-glyph="voice"/);
  assert.match(html, /class="tp-night" id="game-night-stop" type="button" data-tp data-tp-glyph="stop"/);
  assert.match(html, /<p class="tp-why" id="game-night-why"><\/p>/);
  assert.match(mock, /\$\("game-night-why"\)\.textContent = tonight\.cued\.length \? "" : "Play a few rounds first: the night only replays today\.";/);
  assert.match(mock, /^mountTransport\(\);$/m);
  assert.match(mock, /setTransport\(\$\("day-play"\), done \? \{glyph: "replay", state, label: "Play again from the start"\}/);
  // No play, stop or moon drawn by a screen: the moon path and text Play/Stop buttons are gone.
  assert.doesNotMatch(html, /M20 14\.5A8 8 0 1 1/, "no moon");
  assert.doesNotMatch(html, /M7 4l13 8-13 8z[\s\S]{0,80}Start the/, "no hand-drawn play on a start");
  assert.doesNotMatch(html, />Stop<\/button>|id="day-play"[^>]*>Play</);
  assert.doesNotMatch(mock, /\$\("day-play"\)\.textContent/);
  assert.match(components, /export function setTransport\(el, \{glyph, state, label, progress\} = \{\}\)/);
  // The board's colour rule: no indigo button fill left for playback.
  assert.doesNotMatch(css, /\.qr-btn-night\{/);
});

test("the map's passes: signs, one voice line, 24-hour times, no Echo panel in the skins", () => {
  for (const k of ["昼", "夜"]) assert.match(html, new RegExp('<span class="qr-sign" lang="ja" aria-hidden="true">' + k + "</span>"));
  assert.match(css, /\.qr-sign\{width:40px;height:40px;flex:none;border-radius:10px;border:1px solid var\(--hairline\)/);
  assert.match(html, /id="game-settings-open" type="button"><span class="qr-glyph" lang="ja" aria-hidden="true">設<\/span>Settings/);
  assert.match(mock, /const SAY_ALOUD = "Say it out loud";/); assert.match(html, /声<\/b> Say it with the voice<\/p>/);
  assert.match(mock, / \+ \(paperReview \? "" : " · back next round"\);/);
  assert.match(src("../radio.js"), /String\(d\.getHours\(\)\)\.padStart\(2, "0"\)/);
  assert.match(html, /id="game-set-bedtime-shown" aria-hidden="true">23:30<\/span><input class="qr-timefield" id="game-set-bedtime" type="time"/);
  assert.match(mock, /skinned = params\.get\("from"\) === "game" \|\| params\.get\("boss"\) === "1";/);
  assert.match(html, /role="tab" data-mode="listen" type="button">Listen<\/button>/, "one segment, no glyphs");
});
