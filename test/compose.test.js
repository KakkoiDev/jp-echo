import test from "node:test";
import assert from "node:assert/strict";
import {carries, compose} from "../api.js";

const ok = payload => ({ok: true, json: async () => payload});
const reply = body => ok({choices: [{message: {content: JSON.stringify(body)}}]});
const settings = {provider: "deepseek", providerKeys: {deepseek: "k"}, sourceLang: "en", targetLang: "ja"};

// What a conversation with the model looked like: every system prompt, and
// every user turn, in order.
function record(...bodies) {
  const seen = [];
  let call = 0;
  global.fetch = async (url, options) => {
    const sent = JSON.parse(options.body);
    seen.push({system: sent.messages[0].content, user: sent.messages[1].content});
    return reply(bodies[Math.min(call++, bodies.length - 1)]);
  };
  return seen;
}

test("the required kanji is demanded, and the sentence comes back", async () => {
  const seen = record({source: "Where is the station?", casual: "駅【えき】はどこ？", polite: "駅【えき】はどこですか。"});
  const card = await compose({kanji: "駅"}, settings);
  assert.equal(card.source, "Where is the station?");
  assert.equal(card.casual, "駅【えき】はどこ？");
  assert.equal(seen.length, 1, "no retry was needed");
  assert.match(seen[0].system, /MUST contain the character 駅/);
  assert.equal(seen[0].user, "駅");
});

test("a sentence missing the kanji is rejected and retried, naming the failure", async () => {
  const seen = record(
    {source: "Where is it?", casual: "どこですか。", polite: "どこですか。"},        // no 駅
    {source: "Where is the station?", casual: "駅【えき】はどこ？", polite: "駅【えき】はどこですか。"},
  );
  const card = await compose({kanji: "駅"}, settings);
  assert.equal(card.casual, "駅【えき】はどこ？", "the second answer is the one kept");
  assert.equal(seen.length, 2);
  assert.match(seen[1].user, /does not contain 駅/);
  assert.match(seen[1].user, /どこですか。/, "the rejected sentence is quoted back");
});

test("two failures give up rather than saving a sentence that teaches nothing", async () => {
  const seen = record({source: "Where is it?", casual: "どこですか。", polite: "どこですか。"});
  await assert.rejects(() => compose({kanji: "駅"}, settings), /kept writing sentences without 駅/);
  assert.equal(seen.length, 2, "one retry, not an endless loop");
});

test("the kanji counts when it is only in the polite form", async () => {
  record({source: "Where is it?", casual: "どこ？", polite: "駅【えき】はどこですか。"});
  const card = await compose({kanji: "駅"}, settings);
  assert.equal(card.polite, "駅【えき】はどこですか。");
});

test("a reading that merely mentions the kanji is not a sighting", () => {
  // The check runs on the sentence with its notation stripped, so a character
  // can only pass by actually being written in the sentence.
  assert.equal(carries({casual: "えきはどこですか。", polite: "えきはどこですか。"}, "駅"), false);
  assert.equal(carries({casual: "駅【えき】はどこ", polite: ""}, "駅"), true);
});

test("kanji you already know are offered as a preference, not a rule", async () => {
  const seen = record({source: "Where is the station?", casual: "駅【えき】はどこ？", polite: "駅【えき】はどこですか。"});
  await compose({kanji: "駅", known: "日本語駅"}, settings);
  assert.match(seen[0].system, /prefer these characters/);
  assert.match(seen[0].system, /日本語/);
  assert.ok(!/prefer these characters[^.]*駅/.test(seen[0].system), "the target is not listed as its own preference");
});

test("a known set too large to be worth the prompt is left out", async () => {
  const many = Array.from({length: 501}, (_, i) => String.fromCharCode(0x4e00 + i)).join("");
  const seen = record({source: "Where is the station?", casual: "駅【えき】はどこ？", polite: "駅【えき】はどこですか。"});
  await compose({kanji: "駅", known: many}, settings);
  assert.ok(!seen[0].system.includes("prefer these characters"));
});

test("𠮟 survives the round trip, surrogate pair and all", async () => {
  record({source: "Do not scold me.", casual: "𠮟【しか】らないで", polite: "𠮟【しか】らないでください"});
  const card = await compose({kanji: "𠮟"}, settings);
  assert.equal(card.casual, "𠮟【しか】らないで");
});

test("asking for nothing is refused before a request is made", async () => {
  let called = false;
  global.fetch = async () => { called = true; return reply({}); };
  await assert.rejects(() => compose({kanji: ""}, settings), /Nothing was asked for/);
  assert.equal(called, false);
});
