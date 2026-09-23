import test from "node:test";
import assert from "node:assert/strict";
import {translate} from "../api.js";

const modelReply={casual:"今日【きょう】はいい",polite:"今日【きょう】はいいです"};
const translation={source:"Today is good",casual:"今日【きょう】はいい",polite:"今日【きょう】はいいです"};
function response(payload){return {ok:true,json:async()=>payload}}

test("Gemini uses its native endpoint and API key",async()=>{let request;global.fetch=async(url,options)=>(request={url,options},response({candidates:[{content:{parts:[{text:JSON.stringify(modelReply)}]}}]}));assert.deepEqual(await translate("Today is good",{provider:"google",providerKeys:{google:"gem-key"},providerModels:{google:"gemini-test"}}),translation);assert.match(request.url,/gemini-test:generateContent\?key=gem-key/);assert.equal(JSON.parse(request.options.body).generationConfig.responseMimeType,"application/json")});

test("Anthropic sends browser-safe API headers",async()=>{let request;global.fetch=async(url,options)=>(request={url,options},response({content:[{type:"text",text:JSON.stringify(modelReply)}]}));await translate("Today is good",{provider:"anthropic",providerKeys:{anthropic:"claude-key"},providerModels:{anthropic:"claude-test"}});assert.equal(request.url,"https://api.anthropic.com/v1/messages");assert.equal(request.options.headers["x-api-key"],"claude-key");assert.equal(request.options.headers["anthropic-dangerous-direct-browser-access"],"true")});

test("local provider uses configured OpenAI-compatible endpoint without a key",async()=>{let request;global.fetch=async(url,options)=>(request={url,options},response({choices:[{message:{content:JSON.stringify(modelReply)}}]}));assert.deepEqual(await translate("Today is good",{provider:"local",localEndpoint:"http://localhost:1234/v1/chat/completions",providerModels:{local:"local-model"}}),translation);assert.equal(request.url,"http://localhost:1234/v1/chat/completions");assert.equal(request.options.headers.Authorization,undefined);assert.equal(JSON.parse(request.options.body).model,"local-model")});

// Typing the language you are learning must not reverse the card. The pair is
// the direction you are learning in; only the input side moves.
test("entering the target language still produces a source-to-target card",async()=>{
  let body;
  global.fetch=async(url,options)=>(body=JSON.parse(options.body),response({choices:[{message:{content:JSON.stringify(
    {translation:"Where is the station?",target:"駅【えき】はどこですか。"})}}]}));
  const card=await translate("駅はどこですか。",{provider:"local",localEndpoint:"http://x/v1/chat/completions",
    sourceLang:"en",targetLang:"ja",inputLang:"ja"});
  assert.equal(card.source,"Where is the station?","the known language lands in source");
  assert.equal(card.casual,"駅【えき】はどこですか。","what was typed lands in target, with readings");
  assert.equal(card.polite,card.casual,"both registers are the sentence as it was said");
  assert.match(body.messages[0].content,/sentence is in Japanese/,"the reverse prompt was used");
});

test("a reworded reverse answer falls back to what was typed",async()=>{
  global.fetch=async()=>response({choices:[{message:{content:JSON.stringify(
    {translation:"Where is the station?",target:""})}}]});
  const card=await translate("駅はどこですか。",{provider:"local",localEndpoint:"http://x/v1/chat/completions",
    sourceLang:"en",targetLang:"ja",inputLang:"ja"});
  assert.equal(card.casual,"駅はどこですか。");
});

test("a reverse answer with no meaning in it is refused",async()=>{
  global.fetch=async()=>response({choices:[{message:{content:JSON.stringify({target:"駅【えき】"})}}]});
  await assert.rejects(()=>translate("駅はどこですか。",{provider:"local",localEndpoint:"http://x/v1/chat/completions",
    sourceLang:"en",targetLang:"ja",inputLang:"ja"}),/returned nothing/);
});
