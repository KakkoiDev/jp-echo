import test from "node:test";
import assert from "node:assert/strict";
import {cleanTags, coverage, isTagged, summarise, untagged} from "../grammar.js";

// grammar-data.js is a placeholder in the repo, so the list is empty here and
// every id is unknown. That is the case the code must survive, and it is also
// the case that makes these tests honest: nothing passes because a fixture
// happened to match.

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
  assert.deepEqual(summarise(cover), {met: 0, total: 0});
});
