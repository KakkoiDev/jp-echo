import {DEFAULT_PAIR,hasFurigana,hasRegisters,languageName,normalizeFurigana,stripFurigana,validateTranslation,validateTranslations} from "./core.js";

// The prompt is built from the pair. Only Japanese asks for furigana and the
// two registers; every other target gets one plain sentence, because neither
// idea survives translation to, say, French.
function systemPrompt(sourceLang,targetLang){
  const from=languageName(sourceLang),to=languageName(targetLang);
  if(hasRegisters(targetLang))return `Translate the ${from} sentence into natural modern ${to} in both casual and polite registers. Return JSON only: {"casual":"...","polite":"..."}. Add a reading after every kanji run using this exact notation: 漢字【かんじ】. Do not add readings to hiragana or katakana. Do not add romaji, explanations, alternatives, or markdown.`;
  return `Translate the ${from} sentence into natural modern ${to}. Return JSON only: {"translation":"..."}. Do not add transliteration, explanations, alternatives, or markdown.`;
}

// Entering the language being learnt — repeating what a native said — asks a
// different question. The sentence is already in the target language, so there
// is nothing to translate into it: what is missing is what it means, and, for
// Japanese, the readings, which someone who just heard it cannot supply.
// The card that comes out is the same shape either way.
function reversePrompt(sourceLang,targetLang){
  const known=languageName(sourceLang),learning=languageName(targetLang);
  if(hasFurigana(targetLang))return `The sentence is in ${learning}. Return JSON only: {"translation":"...","target":"..."}. "translation" is what it means in natural ${known}. "target" is the same ${learning} sentence, unchanged except that a reading is added after every kanji run using this exact notation: 漢字【かんじ】. Do not reword it, do not change its register, and do not add readings to hiragana or katakana. No romaji, explanations, alternatives, or markdown.`;
  return `The sentence is in ${learning}. Return JSON only: {"translation":"..."}, what it means in natural ${known}. Do not add transliteration, explanations, alternatives, or markdown.`;
}
// Asking for a sentence that must contain something is not translating: there
// is no input to translate. Forcing a required kanji into a sentence someone
// typed gives nonsense ("I like cats" has no room for 駅), so the sentence is
// chosen to fit the kanji instead of the other way round, and the model writes
// both halves.
function composePrompt(sourceLang,targetLang,required,known){
  const from=languageName(sourceLang),to=languageName(targetLang);
  const want=typeof required==="string"?`the character ${required}`:`the grammar point ${required.title}${required.hint?" ("+required.hint+")":""}`;
  const shape=hasRegisters(targetLang)
    ? `Return JSON only: {"source":"...","casual":"...","polite":"..."}. "source" is what the sentence means in natural ${from}. "casual" and "polite" are the same sentence in those two registers, each with a reading after every kanji run in this exact notation: 漢字【かんじ】. Do not add readings to hiragana or katakana.`
    : `Return JSON only: {"source":"...","translation":"..."}. "source" is what the sentence means in natural ${from}; "translation" is the ${to}.`;
  // Stated twice and given a reason, because a single polite mention is the
  // instruction models drop first. It is checked afterwards regardless.
  const must=typeof required==="string"
    ?`The sentence MUST contain the character ${required}. That is the entire point of this request — a sentence without ${required} is useless and will be thrown away. Do not substitute a synonym, a different word, or write it in kana.`
    :`The sentence MUST use ${want}. That is the entire point of this request — a sentence that does not use it is useless and will be thrown away. Do not substitute a related construction.`;
  const prefer=known?` Where the rest of the sentence is a free choice, prefer these characters, so it does not introduce more than it teaches: ${known}.` : "";
  return `Write one short, natural, everyday ${to} sentence a learner could say out loud. ${must}${prefer} ${shape} No romaji, explanations, alternatives, or markdown.`;
}

// Which grammar points a sentence uses is not something a regex can tell —
// 〜ておく, 〜といた and 〜とく are one point with three surfaces — so the
// model is asked, in batches, against a closed list of ids. It is told to use
// only those ids; what comes back is filtered to them anyway.
function tagPrompt(targetLang,points){
  const to=languageName(targetLang);
  const list=points.map(p=>p.id+" = "+p.title+(p.hint?" ("+p.hint+")":"")).join("\n");
  return `You will be given numbered ${to} sentences. For each, list the ids of the grammar points it uses, from this list and no other:\n${list}\n\nReturn JSON only: {"tags":{"<number>":["id","id"],...}}. A sentence that uses none of them gets an empty array. Do not invent ids. No explanations or markdown.`;
}
export const TAG_BATCH=30;
export async function tagGrammar(sentences,points,settings={}){
  if(!points.length||!sentences.length)return new Map();
  const pair={targetLang:settings.targetLang||DEFAULT_PAIR.targetLang};
  const chosen=chosenProvider(settings),known=new Set(points.map(p=>p.id)),out=new Map();
  for(let i=0;i<sentences.length;i+=TAG_BATCH){
    const batch=sentences.slice(i,i+TAG_BATCH);
    const text=batch.map((s,n)=>(n+1)+". "+stripFurigana(s.plainTarget||s.target||"")).join("\n");
    const raw=await ask(text,tagPrompt(pair.targetLang,points),chosen,settings);
    const tags=raw?.tags||{};
    batch.forEach((s,n)=>{const got=tags[String(n+1)];out.set(s.id,[...new Set((Array.isArray(got)?got:[]).filter(id=>known.has(id)))])});
  }
  return out;
}

export const PROVIDER_DEFAULTS={deepseek:"deepseek-chat",google:"gemini-2.5-flash",openai:"gpt-4.1-mini",anthropic:"claude-sonnet-4-5",local:"qwen3:4b"};

function jsonText(value){const text=String(value||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");return JSON.parse(text||"{}")}
async function fetchJson(url,options){const response=await fetch(url,options);if(!response.ok){let detail="";try{const body=await response.json();detail=body.error?.message||body.message||""}catch{}throw new Error("Translation failed ("+response.status+")"+(detail?": "+detail:"."))}return response.json()}
async function openAICompatible(provider,english,key,model,endpoint,system){const urls={deepseek:"https://api.deepseek.com/chat/completions",openai:"https://api.openai.com/v1/chat/completions"};const headers={"Content-Type":"application/json"};if(key)headers.Authorization="Bearer "+key;const body={model,messages:[{role:"system",content:system},{role:"user",content:english}]};if(provider!=="local")body.response_format={type:"json_object"};const payload=await fetchJson(endpoint||urls[provider],{method:"POST",headers,body:JSON.stringify(body)});return jsonText(payload.choices?.[0]?.message?.content)}
async function gemini(english,key,model,system){const payload=await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:english}]}],generationConfig:{responseMimeType:"application/json"}})});return jsonText(payload.candidates?.[0]?.content?.parts?.map(part=>part.text).join(""))}
async function anthropicRequest(english,key,model,system){const payload=await fetchJson("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model,max_tokens:700,system,messages:[{role:"user",content:english}]})});return jsonText(payload.content?.filter(part=>part.type==="text").map(part=>part.text).join(""))}
async function proxyRequest(url,english,provider,model,key,pair){const payload=await fetchJson(url,{method:"POST",headers:{"Content-Type":"application/json",...(key?{Authorization:"Bearer "+key}:{})},body:JSON.stringify({english,provider,model,...pair})});return (payload.casual||payload.casualJapanese||payload.translation)?payload:jsonText(payload.choices?.[0]?.message?.content)}

// Which provider, which key, which model — the same decision for anything
// that talks to a model, so it is made once.
function chosenProvider(settings){
  const keys=settings.providerKeys||{};
  const provider=settings.provider||["google","deepseek","openai","anthropic"].find(name=>keys[name])||(settings.apiKey?"deepseek":"google");
  const key=keys[provider]||(provider==="deepseek"?settings.apiKey:"")||"";
  const model=settings.providerModels?.[provider]||PROVIDER_DEFAULTS[provider];
  if(provider!=="local"&&!key)throw new Error(`Add your ${provider==="google"?"Gemini":provider[0].toUpperCase()+provider.slice(1)} API key in Settings.`);
  if(provider==="local"&&!settings.localEndpoint)throw new Error("Add your Ollama or LM Studio endpoint in Settings.");
  return {provider,key,model};
}
function ask(text,system,{provider,key,model},settings){
  if(provider==="google")return gemini(text,key,model,system);
  if(provider==="anthropic")return anthropicRequest(text,key,model,system);
  return openAICompatible(provider,text,key,model,provider==="local"?settings.localEndpoint:undefined,system);
}

function shapeComposed(raw,pair){
  const source=String(raw?.source||raw?.english||raw?.meaning||"").trim();
  if(!source)throw new Error("The model did not say what the sentence means.");
  return {source,...validateTranslations(raw,pair.targetLang)};
}
// The check the prompt cannot do. An instruction is a request, not a promise,
// and a sentence that quietly left the character out teaches nothing about it.
export function carries(card,required){
  return (stripFurigana(card?.casual||"")+stripFurigana(card?.polite||"")).includes(required);
}
// A known set beyond this is not worth spending prompt on: someone who has met
// that many kanji is not going to be tripped by whichever the model picks.
const KNOWN_LIMIT=500;

export async function compose({kanji,grammar,known=""},settings={}){
  if(grammar)return composeGrammar(grammar,settings);
  if(!kanji)throw new Error("Nothing was asked for.");
  const pair={sourceLang:settings.sourceLang||DEFAULT_PAIR.sourceLang,targetLang:settings.targetLang||DEFAULT_PAIR.targetLang};
  const chosen=chosenProvider(settings);
  let hint=[...String(known)].filter(character=>character!==kanji);
  const system=composePrompt(pair.sourceLang,pair.targetLang,kanji,hint.length&&hint.length<=KNOWN_LIMIT?hint.join(""):"");
  let text=kanji,last=null;
  // One retry, naming what went wrong. A second failure is the model refusing
  // the constraint, not misreading it, and another round costs a request for
  // nothing.
  for(let attempt=0;attempt<2;attempt++){
    const card=shapeComposed(await ask(text,system,chosen,settings),pair);
    if(carries(card,kanji))return card;
    last=stripFurigana(card.casual||"");
    text=`${kanji}\n\nYour previous answer was ${JSON.stringify(last)}, which does not contain ${kanji}. Write a different sentence that does.`;
  }
  throw new Error(`The model kept writing sentences without ${kanji}.`);
}

async function composeGrammar(point,settings){
  const pair={sourceLang:settings.sourceLang||DEFAULT_PAIR.sourceLang,targetLang:settings.targetLang||DEFAULT_PAIR.targetLang};
  const chosen=chosenProvider(settings),system=composePrompt(pair.sourceLang,pair.targetLang,point,"");
  let text=point.title,last=null;
  for(let attempt=0;attempt<2;attempt++){
    const card=shapeComposed(await ask(text,system,chosen,settings),pair);
    const tags=await tagGrammar([{id:"x",plainTarget:stripFurigana(card.casual||card.polite||"")}],[point],settings);
    if((tags.get("x")||[]).includes(point.id))return {...card,grammar:[point.id]};
    last=stripFurigana(card.casual||"");
    text=`${point.title}\n\nYour previous answer was ${JSON.stringify(last)}, which does not use ${point.title}. Write a different sentence that does.`;
  }
  throw new Error(`The model kept writing sentences without ${point.title}.`);
}

export async function translate(english,settings={}){const pair={sourceLang:settings.sourceLang||DEFAULT_PAIR.sourceLang,targetLang:settings.targetLang||DEFAULT_PAIR.targetLang};const reverse=(settings.inputLang||pair.sourceLang)===pair.targetLang;const system=reverse?reversePrompt(pair.sourceLang,pair.targetLang):systemPrompt(pair.sourceLang,pair.targetLang);const keys=settings.providerKeys||{};const provider=settings.provider||["google","deepseek","openai","anthropic"].find(name=>keys[name])||(settings.apiKey?"deepseek":"google"),key=keys[provider]||(provider==="deepseek"?settings.apiKey:"")||"",model=settings.providerModels?.[provider]||PROVIDER_DEFAULTS[provider];if(provider!=="local"&&!key)throw new Error(`Add your ${provider==="google"?"Gemini":provider[0].toUpperCase()+provider.slice(1)} API key in Settings.`);if(provider==="local"&&!settings.localEndpoint)throw new Error("Add your Ollama or LM Studio endpoint in Settings.");try{let raw;if(provider==="google")raw=await gemini(english,key,model,system);else if(provider==="anthropic")raw=await anthropicRequest(english,key,model,system);else raw=await openAICompatible(provider,english,key,model,provider==="local"?settings.localEndpoint:undefined,system);return shape(raw,english,pair,reverse)}catch(error){if(!settings.proxyUrl||!(error instanceof TypeError))throw error;return shape(await proxyRequest(settings.proxyUrl,english,provider,model,key,{...pair,inputLang:settings.inputLang}),english,pair,reverse)}}

// One card shape whichever way it was typed: source is always the
// language you know, target always the one you are learning. Reversing
// the input must not reverse the card, or the library starts showing
// English where the Japanese should be.
function shape(raw,typed,pair,reverse){
  if(!reverse)return {source:typed,...validateTranslations(raw,pair.targetLang)};
  const source=String(raw?.translation||raw?.source||"").trim();
  if(!source)throw new Error("The translator returned nothing.");
  // The model is asked to annotate the sentence, not to rewrite it, so
  // fall back to what was typed rather than trust a reworded one.
  const annotated=normalizeFurigana(String(raw?.target||"").trim());
  const target=validateTranslation({japanese:annotated||typed},pair.targetLang);
  // Both registers are the sentence as it was said. Inventing a polite
  // variant would change what the speaker actually said.
  return {source,casual:target,polite:target};
}
