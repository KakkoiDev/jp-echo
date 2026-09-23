import {DEFAULT_PAIR,hasFurigana,hasRegisters,languageName,normalizeFurigana,validateTranslation,validateTranslations} from "./core.js";

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
export const PROVIDER_DEFAULTS={deepseek:"deepseek-chat",google:"gemini-2.5-flash",openai:"gpt-4.1-mini",anthropic:"claude-sonnet-4-5",local:"qwen3:4b"};

function jsonText(value){const text=String(value||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");return JSON.parse(text||"{}")}
async function fetchJson(url,options){const response=await fetch(url,options);if(!response.ok){let detail="";try{const body=await response.json();detail=body.error?.message||body.message||""}catch{}throw new Error("Translation failed ("+response.status+")"+(detail?": "+detail:"."))}return response.json()}
async function openAICompatible(provider,english,key,model,endpoint,system){const urls={deepseek:"https://api.deepseek.com/chat/completions",openai:"https://api.openai.com/v1/chat/completions"};const headers={"Content-Type":"application/json"};if(key)headers.Authorization="Bearer "+key;const body={model,messages:[{role:"system",content:system},{role:"user",content:english}]};if(provider!=="local")body.response_format={type:"json_object"};const payload=await fetchJson(endpoint||urls[provider],{method:"POST",headers,body:JSON.stringify(body)});return jsonText(payload.choices?.[0]?.message?.content)}
async function gemini(english,key,model,system){const payload=await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:english}]}],generationConfig:{responseMimeType:"application/json"}})});return jsonText(payload.candidates?.[0]?.content?.parts?.map(part=>part.text).join(""))}
async function anthropicRequest(english,key,model,system){const payload=await fetchJson("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model,max_tokens:700,system,messages:[{role:"user",content:english}]})});return jsonText(payload.content?.filter(part=>part.type==="text").map(part=>part.text).join(""))}
async function proxyRequest(url,english,provider,model,key,pair){const payload=await fetchJson(url,{method:"POST",headers:{"Content-Type":"application/json",...(key?{Authorization:"Bearer "+key}:{})},body:JSON.stringify({english,provider,model,...pair})});return (payload.casual||payload.casualJapanese||payload.translation)?payload:jsonText(payload.choices?.[0]?.message?.content)}

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
