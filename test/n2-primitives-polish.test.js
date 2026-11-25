import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const page = read("n2-mock.html"), mock = read("n2-mock.js"), css = read("styles.css"), components = read("components.js");

test("heads: one-line title with ellipsis, a kind line, a counter that never wraps, buttons that never shrink (G1)", () => {
  assert.match(css, /:is\(\.tool-head,\.drill-head\)>:not\(\.tool-titles,\.drill-title\)\{flex-shrink:0\}/);
  assert.match(css, /:is\(\.tool-head,\.drill-head\) :is\(\.tool-title,\.drill-title\),:is\(\.tool-head,\.drill-head\) \.tool-titles>\.overline\{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
  assert.match(css, /\.drill-progress\{[^}]*white-space:nowrap;font-variant-numeric:tabular-nums\}/);
  assert.match(page, /<span class="drill-title">Recall<\/span><span class="overline" id="recall-sub"/, "Recall's head names the deck and queue");
});

test("bottom bars: SVG icon buttons from components.js, never text arrows; disabled and ON states (G2)", () => {
  for (const name of ["chevronLeftSvg", "chevronRightSvg", "replaySvg", "flagSvg"]) assert.match(components, new RegExp("export const " + name + "="));
  const bars = page.slice(page.indexOf('id="day-bar-actions"'), page.indexOf("</section>", page.indexOf('id="day-bar-actions"'))) + page.slice(page.indexOf('class="review-actions n2-exam-bar"'), page.indexOf("</div>", page.indexOf('class="review-actions n2-exam-bar"')));
  assert.doesNotMatch(bars, /[‹›⟲]/, "no text glyph arrows in a bar");
  for (const id of ["day-prev", "day-repeat", "day-next", "prev", "next"]) assert.match(page, new RegExp('id="' + id + '"[^>]*aria-label="[^"]+"[^>]*data-icon='));
  assert.match(page, /id="day-later"[^>]*aria-pressed="false" data-icon="flag"/);
  assert.match(mock, /const BAR_ICONS = \{prev: chevronLeftSvg, next: chevronRightSvg, replay: replaySvg, flag: flagSvg\}/);
  assert.match(css, /\.review-actions button:disabled\{opacity:\.45;border-color:var\(--hairline\)/);
  assert.match(css, /\.review-actions \[aria-pressed=true\]\{background:var\(--seal-tint\);border-color:var\(--seal-edge\);color:var\(--seal-deep\)\}/);
  assert.match(css, /\[aria-pressed=true\]>\.flag-glyph path\{fill:currentColor\}/, "ON shows the filled flag");
});

test("every N2 disclosure is a CollapseRow; results build theirs with collapseRow (G3, S2)", () => {
  assert.match(components, /export function collapseRow\(/);
  assert.doesNotMatch(mock, /el\("details"[^)]*n2-more/);
  assert.doesNotMatch(css, /\.n2-more/);
  for (const d of page.match(/<details[^>]*>/g)) assert.match(d, /collapse-row/, d);
  assert.match(mock, /title: "Time · " \+ total \+ " min answering" \+ \(pausedMin \? " · " \+ pausedMin \+ " min paused" : ""\)/, "paused time is said apart, never as answer time");
});

test("Recall: Previous card in the card with its label, Missed seal-outlined, Instant the filled grade, no ruby gaps (R1–R3)", () => {
  assert.match(page, /class="n2-card-top"><p class="overline" id="recall-ask"><\/p><button[^>]*id="recall-prev"[^>]*data-icon="prev"[^>]*><span>Previous card<\/span>/);
  assert.match(page, /class="again" data-grade="missed"/); assert.match(page, /class="outline" data-grade="slow"/); assert.match(page, /class="primary" data-grade="instant"/);
  assert.match(css, /\.n2-grades \.again\{border-color:var\(--seal-edge\);color:var\(--seal-deep\)\}/);
  assert.match(css, /\.n2-day-example \[lang=ja\]\{line-height:2\.1\}/); assert.match(css, /\.n2-day-example rt\{margin:0/);
});

test("Day Radio: furigana on the example, a how-to row open on the first visit only (14)", () => {
  assert.match(mock, /\$\("day-example-ja"\)\.replaceChildren\(\.\.\.\(example \? exampleNodes\(example\.ja, patternNeedles\(item\.text\)\)/);
  assert.match(page, /id="day-howto"[\s\S]*How Day Radio works[\s\S]*Shown open on your first visit only/);
  assert.match(mock, /box\.open = !seen;/);
});

test("Today's checks: one quiet provenance line with a ? that opens the rest (18)", () => {
  assert.match(page, /id="check-provenance"><span id="check-why"><\/span><button[^>]*id="check-help"[^>]*aria-expanded="false"[^>]*aria-label="Why this check">\?<\/button>/);
  assert.match(page, /id="check-note" hidden/);
  assert.match(mock, /CONTEXT_SHORT = \{fresh: "a sentence you haven't seen"/);
});
