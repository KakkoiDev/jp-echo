export const SCHEMA_VERSION = 2;

// A working set rather than every ISO code: a 200-entry dropdown is unusable,
// and a device only ever has voices for a handful of these. Codes are the ones
// speechSynthesis and SpeechRecognition expect.
export const LANGUAGES = [
  ["ja","Japanese"],["en","English"],["es","Spanish"],["fr","French"],["de","German"],
  ["it","Italian"],["pt","Portuguese"],["nl","Dutch"],["sv","Swedish"],["nb","Norwegian"],
  ["da","Danish"],["fi","Finnish"],["pl","Polish"],["cs","Czech"],["sk","Slovak"],
  ["hu","Hungarian"],["ro","Romanian"],["el","Greek"],["ru","Russian"],["uk","Ukrainian"],
  ["tr","Turkish"],["ar","Arabic"],["he","Hebrew"],["fa","Persian"],["hi","Hindi"],
  ["bn","Bengali"],["ta","Tamil"],["th","Thai"],["vi","Vietnamese"],["id","Indonesian"],
  ["ms","Malay"],["tl","Filipino"],["ko","Korean"],["zh","Chinese (Mandarin)"],
  ["yue","Chinese (Cantonese)"],["ca","Catalan"],["hr","Croatian"],["bg","Bulgarian"],
  ["sr","Serbian"],["lt","Lithuanian"],["lv","Latvian"],["et","Estonian"],["is","Icelandic"],
  ["af","Afrikaans"],["sw","Swahili"],["ur","Urdu"]
];
const LANGUAGE_NAMES = new Map(LANGUAGES);
export function languageName(code){return LANGUAGE_NAMES.get(code)||code}
// Furigana and the casual/polite pair are Japanese-only. Every other target
// gets one plain translation, and the toggles that drive them hide themselves.
export function hasRegisters(code){return code==="ja"}
export function hasFurigana(code){return code==="ja"}
export const DEFAULT_PAIR = {sourceLang:"en",targetLang:"ja"};
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

export function validateTranslation(result, targetLang = "ja") {
  const japanese = normalizeFurigana(String(result?.japanese || "").trim());
  // Only Japanese can be script-checked this cheaply. For everything else a
  // non-empty answer is all we can honestly assert.
  if (!japanese) throw new Error("The translator returned nothing.");
  if (targetLang === "ja" && !/[\u3040-\u30ff\u3400-\u9fff]/.test(japanese)) throw new Error("The translator did not return a Japanese sentence.");
  return japanese;
}

export function validateTranslations(result, targetLang = "ja") {
  const casual = validateTranslation({japanese:result?.casual || result?.casualJapanese || result?.translation || result?.japanese}, targetLang);
  if (!hasRegisters(targetLang)) return {casual,polite:casual};
  const polite = validateTranslation({japanese:result?.polite || result?.politeJapanese || result?.japanese || result?.casualJapanese}, targetLang);
  return {casual,polite};
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

export function createSentence(source, translation, now = new Date(), id = newId(), pair = DEFAULT_PAIR) {
  const {sourceLang,targetLang}={...DEFAULT_PAIR,...pair};
  const forms=typeof translation==="string"?{casual:translation,polite:translation}
    :{casual:translation.casual??translation.casualJapanese,polite:translation.polite??translation.politeJapanese??translation.casual??translation.casualJapanese};
  const casual=forms.casual.trim(),polite=(forms.polite||forms.casual).trim();
  return {id,sourceLang,targetLang,
    source:source.trim(),target:casual,plainTarget:stripFurigana(casual).trim(),
    casualTarget:casual,plainCasualTarget:stripFurigana(casual).trim(),
    politeTarget:polite,plainPoliteTarget:stripFurigana(polite).trim(),
    echoCount:0,createdAt:now.toISOString(),updatedAt:now.toISOString(),
    translationProvider:"deepseek",schemaVersion:SCHEMA_VERSION};
}

// Records written before languages existed were all English to Japanese. The
// old field names are kept readable here rather than anywhere else: every
// other reader works from the neutral ones.
export function migrateSentence(record) {
  if (!record || record.schemaVersion >= SCHEMA_VERSION) return record;
  const casual=record.casualJapanese||record.japanese||"";
  const polite=record.politeJapanese||casual;
  const {english,japanese,plainJapanese,casualJapanese,plainCasualJapanese,politeJapanese,plainPoliteJapanese,...rest}=record;
  return {...rest,sourceLang:"en",targetLang:"ja",
    source:english||"",target:casual,plainTarget:plainJapanese||stripFurigana(casual).trim(),
    casualTarget:casual,plainCasualTarget:plainCasualJapanese||stripFurigana(casual).trim(),
    politeTarget:polite,plainPoliteTarget:plainPoliteJapanese||stripFurigana(polite).trim(),
    schemaVersion:SCHEMA_VERSION};
}

export function mergeSentences(current, incoming) {
  const merged = new Map(current.map(migrateSentence).map(item => [item.id, item]));
  for (const candidate of incoming) {
    const item = migrateSentence(candidate);
    if (!item?.id || !item.source || !item.target) continue;
    const candidate2 = item;
    const old = merged.get(candidate2.id);
    if (!old) { merged.set(candidate2.id, candidate2); continue; }
    const newest = Date.parse(candidate2.updatedAt) > Date.parse(old.updatedAt) ? candidate2 : old;
    merged.set(candidate2.id, {...newest,echoCount:Math.max(Number(old.echoCount)||0,Number(candidate2.echoCount)||0),createdAt:Date.parse(old.createdAt)<=Date.parse(candidate2.createdAt)?old.createdAt:candidate2.createdAt});
  }
  return [...merged.values()];
}

export function exportBackup(sentences, preferences = {}) {
  const {apiKey, providerKeys, ...safe} = preferences;
  return {schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),sentences,preferences:safe};
}
