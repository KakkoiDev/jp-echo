import test from "node:test";
import assert from "node:assert/strict";
import {diffTokens, isExactMatch, markAttempt, markTarget, tokenize} from "../diff.js";

const plain = parts => parts.map(part => part.text).join("");
const marked = parts => parts.filter(part => part.changed).map(part => part.text ?? part.html).join("|");

test("tokenises Japanese into units smaller than the sentence", () => {
  const tokens = tokenize("今日は電車が遅れています。");
  assert.ok(tokens.length > 1);
  assert.equal(tokens.join(""), "今日は電車が遅れています。");
});

test("an identical answer is marked nowhere", () => {
  const target = "今日【きょう】は電車【でんしゃ】が遅【おく】れています。";
  assert.equal(marked(markAttempt("今日は電車が遅れています。", target)), "");
  assert.equal(marked(markTarget("今日は電車が遅れています。", target)), "");
  assert.equal(isExactMatch("今日は電車が遅れています。", target), true);
});

test("a wrong ending is marked in the attempt and in the sentence", () => {
  const target = "今日【きょう】は電車【でんしゃ】が遅【おく】れています。";
  const attempt = "今日は電車が遅れました。";
  assert.equal(plain(markAttempt(attempt, target)), attempt, "the attempt is shown back in full");
  const said = marked(markAttempt(attempt, target));
  assert.ok(said.length > 0, "the wrong ending is marked");
  assert.ok("ました".includes(said), `the mark stays inside the wrong ending, got ${said}`);
  assert.ok(!said.includes("電車") && !said.includes("今日"), "the shared opening is left alone");
  assert.match(marked(markTarget(attempt, target)), /ています/);
  assert.equal(isExactMatch(attempt, target), false);
});

test("the sentence keeps every reading, marked or not", () => {
  const parts = markTarget("今日は電車が遅れました。", "今日【きょう】は電車【でんしゃ】が遅【おく】れています。");
  const html = parts.map(part => part.html).join("");
  assert.match(html, /<ruby>今日<rt>きょう<\/rt><\/ruby>/);
  assert.match(html, /<ruby>遅<rt>おく<\/rt><\/ruby>/);
  assert.equal(html.replace(/<[^>]+>/g, "").replace(/きょう|でんしゃ|おく/g, ""), "今日は電車が遅れています。");
});

test("an empty answer marks the whole sentence and nothing else", () => {
  const target = "駅【えき】はどこですか。";
  assert.deepEqual(markAttempt("", target), []);
  assert.equal(markTarget("", target).every(part => part.changed), true);
});

test("an answer sharing nothing with the sentence is marked end to end", () => {
  const parts = markAttempt("ありがとう", "駅【えき】はどこですか。");
  assert.equal(plain(parts), "ありがとう");
  assert.equal(parts.every(part => part.changed), true);
});

test("diffTokens keeps runs together", () => {
  assert.deepEqual(diffTokens(["a", "b", "c"], ["a", "x", "y", "c"]), [
    {type: "same", tokens: ["a"]},
    {type: "removed", tokens: ["b"]},
    {type: "added", tokens: ["x", "y"]},
    {type: "same", tokens: ["c"]},
  ]);
});

test("html is escaped, so an answer cannot inject markup", () => {
  const html = markTarget("", "<script>").map(part => part.html).join("");
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
});
