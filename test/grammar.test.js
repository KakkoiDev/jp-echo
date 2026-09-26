import test from "node:test";
import assert from "node:assert/strict";
import {cleanTags, coverage, isTagged, POINTS, summarise, untagged} from "../grammar.js";

// These tests use ids that are on no list ("unknown", "x") so they hold
// whatever grammar-data.js carries — the placeholder or the real index.

test("an untagged sentence is work to do; an empty tag list is an answer", () => {
  assert.equal(isTagged({}), false);
  assert.equal(isTagged({grammar: []}), true);
  assert.deepEqual(untagged([{id: "a"}, {id: "b", grammar: []}, {id: "c", grammar: ["x"]}]).map(s => s.id), ["a"]);
  assert.deepEqual(untagged([{grammar: undefined}]), [], "no id, not counted as anything");
});

test("tags the list does not know are dropped, and duplicates collapse", () => {
  assert.deepEqual(cleanTags(["not-a-point", "not-a-point"]), []);
  assert.deepEqual(cleanTags("nonsense"), []);
  assert.deepEqual(cleanTags(undefined), []);
});

test("coverage counts nothing off-list, and never a sentence with no id", () => {
  const cover = coverage([{id: "a", grammar: ["unknown"], createdAt: "2026-01-01"}, {grammar: ["unknown"]}]);
  assert.equal(cover.size, 0);
  assert.deepEqual(summarise(cover, []), {met: 0, total: 0});
  assert.deepEqual(summarise(cover), {met: 0, total: POINTS.length}, "the total is the list, met is none of it");
});

test("a tag that arrived URL-encoded is read as the readable id", () => {
  if (!POINTS.length) return;
  const first = POINTS[0].id;
  assert.deepEqual(cleanTags([encodeURIComponent(first), first]), [first], "decoded, then collapsed with its twin");
  assert.deepEqual(cleanTags(["%E0%A4%A"]), [], "a broken encoding is not a crash, just not a point");
});
