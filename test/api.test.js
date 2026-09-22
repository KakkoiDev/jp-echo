import test from "node:test";
import assert from "node:assert/strict";
import {translate} from "../api.js";

const modelReply={casual:"今日【きょう】はいい",polite:"今日【きょう】はいいです"};
const translation={casual:"今日【きょう】はいい",polite:"今日【きょう】はいいです"};
function response(payload){return {ok:true,json:async()=>payload}}

test("Gemini uses its native endpoint and API key",async()=>{let request;global.fetch=async(url,options)=>(request={url,options},response({candidates:[{content:{parts:[{text:JSON.stringify(modelReply)}]}}]}));assert.deepEqual(await translate("Today is good",{provider:"google",providerKeys:{google:"gem-key"},providerModels:{google:"gemini-test"}}),translation);assert.match(request.url,/gemini-test:generateContent\?key=gem-key/);assert.equal(JSON.parse(request.options.body).generationConfig.responseMimeType,"application/json")});

test("Anthropic sends browser-safe API headers",async()=>{let request;global.fetch=async(url,options)=>(request={url,options},response({content:[{type:"text",text:JSON.stringify(modelReply)}]}));await translate("Today is good",{provider:"anthropic",providerKeys:{anthropic:"claude-key"},providerModels:{anthropic:"claude-test"}});assert.equal(request.url,"https://api.anthropic.com/v1/messages");assert.equal(request.options.headers["x-api-key"],"claude-key");assert.equal(request.options.headers["anthropic-dangerous-direct-browser-access"],"true")});

test("local provider uses configured OpenAI-compatible endpoint without a key",async()=>{let request;global.fetch=async(url,options)=>(request={url,options},response({choices:[{message:{content:JSON.stringify(modelReply)}}]}));assert.deepEqual(await translate("Today is good",{provider:"local",localEndpoint:"http://localhost:1234/v1/chat/completions",providerModels:{local:"local-model"}}),translation);assert.equal(request.url,"http://localhost:1234/v1/chat/completions");assert.equal(request.options.headers.Authorization,undefined);assert.equal(JSON.parse(request.options.body).model,"local-model")});
