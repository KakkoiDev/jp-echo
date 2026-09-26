import test from "node:test";
import assert from "node:assert/strict";
import {build, LEVELS, render} from "../tools/build-grammar-data.mjs";

const one = level => ({slug: "p-" + level, title: "〜" + level, level});
const full = LEVELS.map(one);

test("a list of names and levels builds, deduplicated and in level order", () => {
  const {points, byLevel} = build([...full, {slug: "p-N5", title: "dup", level: "N5"}, {slug: "nagara", title: "〜ながら", level: "N4", hint: "while"}]);
  assert.equal(points.length, 6, "the duplicate slug is dropped");
  assert.deepEqual(points.map(p => p.level), ["N5", "N4", "N4", "N3", "N2", "N1"]);
  assert.deepEqual(byLevel, {N5: 1, N4: 2, N3: 1, N2: 1, N1: 1});
  assert.deepEqual(points.find(p => p.id === "nagara"), {id: "nagara", title: "〜ながら", level: "N4", order: 6, hint: "while"});
  const {points: decoded} = build([...full, {slug: "%E3%81%A0", title: "だ", level: "N5"}, {slug: "だ", title: "だ again", level: "N5"}]);
  assert.equal(decoded.filter(p => p.id === "だ").length, 1, "an encoded slug is decoded to a readable id, and its decoded twin is a duplicate");
  assert.equal(decoded.find(p => p.id === "だ").title, "だ");
  const {points: badged} = build([...full, {slug: "ii", title: "いい", level: "N5", hint: "N5"}]);
  assert.equal(badged.find(p => p.id === "ii").hint, "", "a hint that is only the level badge is dropped");
});

test("anything beyond a name, a level and a gloss is refused", () => {
  // The whole reason the generator exists: a file that picked up an
  // explanation, an example or an audio URL does not become app data.
  for (const field of ["explanation", "examples", "audio", "body"]) {
    assert.throws(() => build([...full, {slug: "x", title: "x", level: "N5", [field]: "..."}]),
      new RegExp("carries fields this list must not: " + field));
  }
});

test("a gloss or title long enough to be prose is refused", () => {
  assert.throws(() => build([...full, {slug: "x", title: "x", level: "N5", hint: "a".repeat(81)}]), /hint is not a short string/);
  assert.throws(() => build([...full, {slug: "x", title: "t".repeat(81), level: "N5"}]), /title is not a short string/);
});

test("a level outside N5-N1, or a level with nothing in it, stops the build", () => {
  assert.throws(() => build([...full, {slug: "x", title: "x", level: "N6"}]), /expected one of N5 N4 N3 N2 N1/);
  assert.throws(() => build(full.filter(p => p.level !== "N3")), /no N3 points at all/);
  assert.throws(() => build([]), /not a non-empty array/);
});

test("the rendered module is what the app will import", () => {
  const source = render(build(full).points);
  assert.match(source, /^export const LEVELS = \["N5","N4","N3","N2","N1"\];$/m);
  assert.match(source, /no explanations, no example sentences,\n\/\/ no audio/);
  assert.equal((source.match(/"id":/g) || []).length, 5);
});

test("order is kept within a level, and comes from the index when it is given", () => {
  const {points} = build([
    {slug: "b", title: "b", level: "N4", order: 20}, {slug: "a", title: "a", level: "N4", order: 10},
    ...LEVELS.filter(l => l !== "N4").map(one),
  ]);
  assert.deepEqual(points.filter(p => p.level === "N4").map(p => p.id), ["a", "b"], "10 before 20, whatever the file order");
  assert.throws(() => build([...full, {slug: "x", title: "x", level: "N5", order: "third"}]), /order is not an integer/);
});
