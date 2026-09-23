import test from "node:test";
import assert from "node:assert/strict";
import {earliestPair, flipSentence, isReversed, pairLooksSwapped, repairPair} from "../repair.js";

test("a pair left swapped is restored from the direction that was chosen", () => {
  const settings = {sourceLang:"ja", targetLang:"en", basePair:{sourceLang:"en", targetLang:"ja"}};
  assert.equal(repairPair(settings), true);
  assert.equal(settings.sourceLang, "en");
  assert.equal(settings.targetLang, "ja");
  assert.equal(settings.basePair, undefined, "the evidence is consumed, so this runs once");
});

test("a pair that was never swapped is left exactly as it is", () => {
  const settings = {sourceLang:"en", targetLang:"ja", basePair:{sourceLang:"en", targetLang:"ja"}};
  assert.equal(repairPair(settings), false);
  assert.equal(settings.sourceLang, "en");
  assert.equal(settings.targetLang, "ja");
});

// Someone who deliberately changed both sides is not swapped, they are
// learning something else. basePair moved with them, so it does not match.
test("a deliberately different pair is not mistaken for a swap", () => {
  const settings = {sourceLang:"es", targetLang:"fr", basePair:{sourceLang:"es", targetLang:"fr"}};
  assert.equal(repairPair(settings), false);
  assert.equal(settings.sourceLang, "es");
});

test("no evidence means no repair", () => {
  const settings = {sourceLang:"ja", targetLang:"en"};
  assert.equal(repairPair(settings), false);
  assert.equal(settings.sourceLang, "ja", "a pair with nothing to compare against is left alone");
});

const pair = {sourceLang:"en", targetLang:"ja"};

test("a card filed the wrong way round is recognised", () => {
  assert.equal(isReversed({sourceLang:"ja", targetLang:"en"}, pair), true);
  assert.equal(isReversed({sourceLang:"en", targetLang:"ja"}, pair), false);
  assert.equal(isReversed({sourceLang:"en", targetLang:"en"}, pair), false, "a degenerate pair is not reversed");
  assert.equal(isReversed(null, pair), false);
});

test("flipping puts the language being learnt back in the big line", () => {
  const broken = {id:"x", sourceLang:"ja", targetLang:"en",
    source:"駅はどこですか。", target:"Where is the station?",
    plainTarget:"Where is the station?", casualTarget:"Where is the station?",
    plainCasualTarget:"Where is the station?", politeTarget:"Where is the station?",
    plainPoliteTarget:"Where is the station?", echoCount:4};
  const fixed = flipSentence(broken);
  assert.equal(fixed.sourceLang, "en");
  assert.equal(fixed.targetLang, "ja");
  assert.equal(fixed.source, "Where is the station?");
  assert.equal(fixed.target, "駅はどこですか。");
  assert.equal(fixed.casualTarget, "駅はどこですか。");
  assert.equal(fixed.politeTarget, "駅はどこですか。");
  assert.equal(fixed.plainTarget, "駅はどこですか。");
  assert.equal(fixed.echoCount, 4, "history is not a casualty of the repair");
  assert.equal(fixed.id, "x");
});

test("flipping is its own inverse", () => {
  const card = {id:"y", sourceLang:"ja", targetLang:"en", source:"はい", target:"Yes"};
  const back = flipSentence(flipSentence(card));
  assert.equal(back.source, card.source);
  assert.equal(back.target, card.target);
  assert.equal(back.sourceLang, card.sourceLang);
});

// The oldest card as evidence, for devices the basePair repair could not reach
// because they were swapped before that field existed.
const card = (id, createdAt, sourceLang, targetLang) => ({id, createdAt, sourceLang, targetLang});

test("the oldest card names the direction that was chosen", () => {
  const items = [
    card("c", "2026-09-22T00:00:00Z", "ja", "en"),
    card("a", "2026-09-01T00:00:00Z", "en", "ja"),
    card("b", "2026-09-10T00:00:00Z", "en", "ja"),
  ];
  assert.deepEqual(earliestPair(items), {sourceLang:"en", targetLang:"ja"},
    "order in the array does not matter, createdAt does");
});

test("no cards means no evidence", () => {
  assert.equal(earliestPair([]), null);
  assert.equal(earliestPair([{id:"x"}]), null, "a card with no pair on it proves nothing");
});

test("only the exact reverse counts as swapped", () => {
  assert.equal(pairLooksSwapped({sourceLang:"ja",targetLang:"en"}, {sourceLang:"en",targetLang:"ja"}), true);
  assert.equal(pairLooksSwapped({sourceLang:"en",targetLang:"ja"}, {sourceLang:"en",targetLang:"ja"}), false);
  assert.equal(pairLooksSwapped({sourceLang:"es",targetLang:"fr"}, {sourceLang:"en",targetLang:"ja"}), false,
    "a different pair is someone learning something else");
  assert.equal(pairLooksSwapped({sourceLang:"en",targetLang:"ja"}, null), false);
});
