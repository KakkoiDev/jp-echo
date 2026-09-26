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

import {tagGrammar, TAG_BATCH} from "../api.js";

const shimau = {id: "te-shimau", title: "〜てしまう", level: "N4", hint: "completely; regret"};
const nagara = {id: "nagara", title: "〜ながら", level: "N4", hint: "while"};

test("tagging sends a closed list and keeps only ids from it", async () => {
  const seen = record({tags: {"1": ["te-shimau", "made-up"], "2": []}});
  const tags = await tagGrammar([{id: "a", plainTarget: "食べてしまった"}, {id: "b", plainTarget: "猫だ"}], [shimau, nagara], settings);
  assert.deepEqual(tags.get("a"), ["te-shimau"], "the invented id is dropped");
  assert.deepEqual(tags.get("b"), []);
  assert.match(seen[0].system, /te-shimau = 〜てしまう$/m, "id and title, and no gloss — the list is half the size");
  assert.doesNotMatch(seen[0].system, /completely; regret/);
  assert.match(seen[0].system, /from this list and no other/);
  assert.match(seen[0].user, /^1\. 食べてしまった\n2\. 猫だ$/);
});

test("tagging batches, so a big library is a few requests, not hundreds", async () => {
  const many = Array.from({length: TAG_BATCH + 1}, (_, i) => ({id: "s" + i, plainTarget: "文" + i}));
  const seen = record({tags: {}});
  const tags = await tagGrammar(many, [shimau], settings);
  assert.equal(seen.length, 2);
  assert.equal(tags.size, TAG_BATCH + 1, "every sentence gets an answer, even an empty one");
});

test("nothing to tag, or nothing to tag against, makes no request", async () => {
  let called = false;
  global.fetch = async () => { called = true; return reply({tags: {}}); };
  assert.equal((await tagGrammar([], [shimau], settings)).size, 0);
  assert.equal((await tagGrammar([{id: "a", plainTarget: "x"}], [], settings)).size, 0);
  assert.equal(called, false);
});

test("composing for a grammar point asks, then checks by asking again", async () => {
  // request 1: the sentence; request 2: the tag check, which reports the point
  const seen = record(
    {source: "I ate it all.", casual: "全部食べてしまった", polite: "全部食べてしまいました"},
    {tags: {"1": ["te-shimau"]}},
  );
  const card = await compose({grammar: shimau}, settings);
  assert.equal(card.casual, "全部食べてしまった");
  assert.deepEqual(card.grammar, ["te-shimau"], "the card arrives already tagged");
  assert.equal(seen.length, 2);
  assert.match(seen[0].system, /MUST use the grammar point 〜てしまう \(completely; regret\)/);
  assert.match(seen[1].system, /from this list and no other/);
});

test("a sentence the model itself does not tag with the point is retried, then refused", async () => {
  const seen = record(
    {source: "I ate.", casual: "食べた", polite: "食べました"},
    {tags: {"1": []}},                                                       // check: not there
    {source: "I ate it all.", casual: "全部食べてしまった", polite: "全部食べてしまいました"},
    {tags: {"1": ["te-shimau"]}},                                            // check: there
  );
  const card = await compose({grammar: shimau}, settings);
  assert.equal(card.casual, "全部食べてしまった");
  assert.equal(seen.length, 4);
  assert.match(seen[2].user, /does not use 〜てしまう/);
  assert.match(seen[2].user, /食べた/, "the rejected sentence is quoted back");
});
