export const SCHEMA_VERSION = 1;
const notation = /([\u3400-\u4dbf\u4e00-\u9fff々]+)【(?!\s*】)([^】]+)】/g;
const escapeHtml = value => value.replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

// Anything in brackets that is not a reading for a kanji run is dropped,
// including an empty 【】 — models emit those when they decline to supply a
// reading, and they must never reach the screen or the voice.
// Synchronized with JP Core's jp_core.furigana and browser/jp-core.js.
const stray = /【[^】]*】/g;

export function normalizeFurigana(value = "") {
  let out = "", offset = 0;
  for (const match of value.matchAll(notation)) {
    out += value.slice(offset, match.index).replace(stray, "");
    out += match[0];
    offset = match.index + match[0].length;
  }
  return out + value.slice(offset).replace(stray, "");
}

export function stripFurigana(value = "") {
  return value.replace(stray, "");
}

export function rubySegments(value = "") {
  value = normalizeFurigana(value);
  const segments = [];
  let offset = 0;
  for (const match of value.matchAll(notation)) {
    if (match.index > offset) segments.push({text: value.slice(offset, match.index)});
    segments.push({text: match[1], reading: match[2]});
    offset = match.index + match[0].length;
  }
  if (offset < value.length) segments.push({text: value.slice(offset)});
  return segments;
}

export function segmentHtml(segment) {
  return segment.reading
    ? "<ruby>" + escapeHtml(segment.text) + "<rt>" + escapeHtml(segment.reading) + "</rt></ruby>"
    : escapeHtml(segment.text);
}

export function rubyHtml(value = "") {
  return rubySegments(value).map(segmentHtml).join("");
}

export function validateTranslation(result) {
  const japanese = normalizeFurigana(String(result?.japanese || "").trim());
  if (!japanese || !/[\u3040-\u30ff\u3400-\u9fff]/.test(japanese)) throw new Error("DeepSeek did not return a Japanese sentence.");
  return japanese;
}

export function validateTranslations(result) {
  const casualJapanese = validateTranslation({japanese:result?.casualJapanese || result?.japanese});
  const politeJapanese = validateTranslation({japanese:result?.politeJapanese || result?.japanese || result?.casualJapanese});
  return {casualJapanese,politeJapanese};
}

// crypto.randomUUID is secure-context only, so it is simply missing over
// plain http — a custom domain before its certificate lands, a LAN address,
// a file:// open. getRandomValues has no such restriction, so the id comes
// from there and randomUUID is only a shortcut when it exists.
export function newId(){
  if(typeof crypto!=="undefined"&&crypto.randomUUID)return crypto.randomUUID();
  const bytes=new Uint8Array(16);
  if(typeof crypto!=="undefined"&&crypto.getRandomValues)crypto.getRandomValues(bytes);
  else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function createSentence(english, japanese, now = new Date(), id = newId()) {
  const forms=typeof japanese==="string"?{casualJapanese:japanese,politeJapanese:japanese}:japanese;
  const casualJapanese=forms.casualJapanese.trim(),politeJapanese=forms.politeJapanese.trim();
  return {id,english:english.trim(),japanese:casualJapanese,plainJapanese:stripFurigana(casualJapanese).trim(),casualJapanese,plainCasualJapanese:stripFurigana(casualJapanese).trim(),politeJapanese,plainPoliteJapanese:stripFurigana(politeJapanese).trim(),echoCount:0,createdAt:now.toISOString(),updatedAt:now.toISOString(),translationProvider:"deepseek",schemaVersion:SCHEMA_VERSION};
}

export function mergeSentences(current, incoming) {
  const merged = new Map(current.map(item => [item.id, item]));
  for (const candidate of incoming) {
    if (!candidate?.id || !candidate.english || !candidate.japanese) continue;
    const old = merged.get(candidate.id);
    if (!old) { merged.set(candidate.id, candidate); continue; }
    const newest = Date.parse(candidate.updatedAt) > Date.parse(old.updatedAt) ? candidate : old;
    merged.set(candidate.id, {...newest,echoCount:Math.max(Number(old.echoCount)||0,Number(candidate.echoCount)||0),createdAt:Date.parse(old.createdAt)<=Date.parse(candidate.createdAt)?old.createdAt:candidate.createdAt});
  }
  return [...merged.values()];
}

export function exportBackup(sentences, preferences = {}) {
  const {apiKey, providerKeys, ...safe} = preferences;
  return {schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),sentences,preferences:safe};
}
