import test from "node:test";
import assert from "node:assert/strict";
import {translate,writeWordNote,discuss,composeWordFromIntent} from "../api.js";
import {MORA_MNEMONICS,moraMnemonicPrompt,moraMnemonicTokens} from "../core.js";

const modelReply={casual:"今日【きょう】はいい",polite:"今日【きょう】はいいです"};
const translation={source:"Today is good",casual:"今日【きょう】はいい",polite:"今日【きょう】はいいです"};
function response(payload){return {ok:true,json:async()=>payload}}

test("Gemini uses its native endpoint and API key",async()=>{let request;global.fetch=async(url,options)=>(request={url,options},response({candidates:[{content:{parts:[{text:JSON.stringify(modelReply)}]}}]}));assert.deepEqual(await translate("Today is good",{provider:"google",providerKeys:{google:"gem-key"},providerModels:{google:"gemini-test"}}),translation);assert.match(request.url,/gemini-test:generateContent$/);assert.equal(request.options.headers["x-goog-api-key"],"gem-key");assert.equal(JSON.parse(request.options.body).generationConfig.responseMimeType,"application/json")});

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


test("Mora v1 keeps the frozen canonical anchors",()=>{assert.equal(MORA_MNEMONICS["え"],"海老");assert.equal(MORA_MNEMONICS["ぬ"],"縫い針");assert.equal(MORA_MNEMONICS["ほ"],"本");assert.equal(MORA_MNEMONICS["る"],"ルーペ");assert.equal(MORA_MNEMONICS["を"],"ヲタ芸");assert.match(moraMnemonicPrompt(),/が=泥の傘/);assert.match(moraMnemonicPrompt(),/ぱ=泡の花/)});

test("word learning help sends Mora v1 and causal-scene rules to the AI",async()=>{let body;global.fetch=async(url,options)=>(body=JSON.parse(options.body),response({choices:[{message:{content:JSON.stringify({remember:"氷 hits a 鰐 into 寿司.",anchors:["氷","鰐","寿司"]})}}]}));await writeWordNote({word:"壊す",reading:"こわす",meaning:"to break",kind:"verb"},{provider:"local",localEndpoint:"http://x/v1/chat/completions",providerModels:{local:"test"}});const system=body.messages[0].content;assert.match(system,/Echo Mora v1/);assert.match(system,/こ=氷/);assert.match(system,/わ=鰐/);assert.match(system,/す=寿司/);assert.match(system,/causal animation/);assert.match(system,/meaning itself/)});

test("Mora anchors are derived from the exact furigana, including long vowels",()=>{assert.deepEqual(moraMnemonicTokens("操作"),[]);assert.deepEqual(moraMnemonicTokens("そうさ"),[{mora:"そ",image:"算盤"},{mora:"う",image:"牛"},{mora:"さ",image:"猿"}]);assert.deepEqual(moraMnemonicTokens("ほうふ"),[{mora:"ほ",image:"本"},{mora:"う",image:"牛"},{mora:"ふ",image:"船"}])});

test("word mnemonic rejects a model that substitutes its own anchors and retries",async()=>{let n=0;global.fetch=async()=>response({choices:[{message:{content:JSON.stringify(n++?{remember:"本 meets 牛 on a 船.",anchors:["本","牛","船"]}:{remember:"A sail rides a boat.",anchors:["帆","船"]})}}]});const out=await writeWordNote({word:"豊富",reading:"ほうふ",meaning:"abundant; plentiful; rich",kind:"adjective"},{provider:"local",localEndpoint:"http://x/v1/chat/completions",providerModels:{local:"test"}});assert.equal(n,2);assert.match(out.remember,/本/)});


test("discussion opens with an AI turn and translates a learner reply",async()=>{const replies=[{user:{target:"",source:""},ai:{target:"いらっしゃいませ。","source":"Welcome."}},{user:{target:"味噌【みそ】ラーメンをお願【ねが】いします。","source":"Miso ramen, please."},ai:{target:"かしこまりました。","source":"Certainly."}}];let n=0;global.fetch=async()=>response({choices:[{message:{content:JSON.stringify(replies[n++])}}]});const settings={provider:"local",localEndpoint:"http://x/v1/chat/completions",providerModels:{local:"test"}};const first=await discuss({scenario:"ramen shop"},settings);assert.equal(first.ai.target,"いらっしゃいませ。");const second=await discuss({scenario:"ramen shop",message:"Miso ramen please",history:[{role:"ai",...first.ai}]},settings);assert.match(second.user.target,/味噌/);assert.equal(second.ai.source,"Certainly.")});


test("word exercise treats learner text as intent and creates a fresh sentence containing the studied word",async()=>{let body;global.fetch=async(url,options)=>(body=JSON.parse(options.body),response({choices:[{message:{content:JSON.stringify({source:"This shop has a rich selection.",casual:"この店【みせ】は商品【しょうひん】が豊富【ほうふ】だ。",polite:"この店【みせ】は商品【しょうひん】が豊富【ほうふ】です。"})}}]}));const card=await composeWordFromIntent({word:{word:"豊富",reading:"ほうふ",meaning:"abundant; plentiful; rich"},intent:"They have a lot of different products"},{provider:"local",localEndpoint:"http://x/v1/chat/completions",providerModels:{local:"test"},sourceLang:"en",targetLang:"ja"});assert.match(card.casual,/豊富/);assert.match(body.messages[0].content,/do not judge or validate/i);assert.match(body.messages[1].content,/They have a lot of different products/)});

test("word intent composition retries if the model omits the studied word",async()=>{let n=0;global.fetch=async()=>response({choices:[{message:{content:JSON.stringify(n++?{source:"There are many resources.",casual:"資源【しげん】が豊富【ほうふ】だ。",polite:"資源【しげん】が豊富【ほうふ】です。"}:{source:"There are many resources.",casual:"資源【しげん】がたくさんある。",polite:"資源【しげん】がたくさんあります。"})}}]});const card=await composeWordFromIntent({word:{word:"豊富",reading:"ほうふ",meaning:"abundant"},intent:"There are lots of resources"},{provider:"local",localEndpoint:"http://x/v1/chat/completions",providerModels:{local:"test"},sourceLang:"en",targetLang:"ja"});assert.equal(n,2);assert.match(card.casual,/豊富/)});
