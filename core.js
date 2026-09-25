// Synchronized with JP Core's browser/jp-core.js. Everything below the
// language list is a verbatim copy: change these rules in JP Core first and
// bring the copy over in the same change. The list itself is ours — which
// languages the dropdown offers is an application choice, not a Japanese one.
// The browser distribution of JP Core's Japanese primitives: the 漢字【かんじ】
// notation, its renderers, reading alignment, and the sentence schema.
//
// This file is the canonical source for consumers that cannot run Python — a
// static PWA, a service worker, an extension. It mirrors jp_core.furigana,
// jp_core.reading, and jp_core.corpus, and every rule here is decided there
// first. A consumer copies this file; it does not fork it.
export const SCHEMA_VERSION = 2;

// The lookahead rejects an annotation with nothing in it; `stray` then removes
// it. A model emits 【】 when it declines to supply a reading, and letting it
// through puts literal brackets on screen and reads them aloud.
const notation = /([㐀-䶿一-鿿々\u{20000}-\u{3134F}]+)【(?!\s*】)([^】]+)】/gu;
const stray = /【[^】]*】/g;
// The same class `notation` accepts, for code that has to recognise a base run
// before there is a reading on it. If these two drift, a run one brackets is a
// run the other drops as a stray, and the reading disappears with no error.
//
// The supplementary span is ext-B through ext-G. 𠮟 (U+20B9F) is joyo and lives
// there, and a class stopping at U+9FFF dropped its reading exactly that way.
export const KANJI = /[㐀-䶿一-鿿々\u{20000}-\u{3134F}]/u;
const KANA = /^[ぁ-ゟー]+$/;
const escapeHtml = value => value.replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

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
// Furigana and the casual/polite pair are Japanese-only. Every other target
// gets one plain translation.
export function hasRegisters(code){return code==="ja"}
export function hasFurigana(code){return code==="ja"}
export const DEFAULT_PAIR = {sourceLang:"en",targetLang:"ja"};

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

// --- reading generation ------------------------------------------------------
// The browser twin of jp_core.reading. A reading is a dictionary lookup, not a
// generation task, so these place a reading an analyser supplied and never
// invent one: anything that does not line up is emitted bare.

// ァ..ヴ only. ヵ and ヶ sit at the top of the katakana block but have no
// hiragana anyone writes, and 一ヶ月 would come back as 一ゖ月.
export function toHiragana(value = "") {
  return value.replace(/[ァ-ヴ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// Compounds an analyser gets wrong because it segments them, and segmenting
// loses the sound change that only exists across the seam. Kept in step with
// jp_core.reading.PRONUNCIATION_OVERRIDES; 十分 is absent from both because it
// is じゅっぷん as a duration and じゅうぶん as "enough".
export const PRONUNCIATION_OVERRIDES = {
  "一回":"いっかい","一階":"いっかい","一個":"いっこ","一冊":"いっさつ","一歳":"いっさい",
  "一足":"いっそく","一点":"いってん","一杯":"いっぱい","一匹":"いっぴき","一分":"いっぷん",
  "一本":"いっぽん","一泊":"いっぱく","一枚":"いちまい","一週間":"いっしゅうかん",
  "一生":"いっしょう","一緒":"いっしょ",
  "六回":"ろっかい","六階":"ろっかい","六個":"ろっこ","六本":"ろっぽん","六匹":"ろっぴき",
  "六杯":"ろっぱい","六分":"ろっぷん",
  "八回":"はっかい","八階":"はっかい","八個":"はっこ","八本":"はっぽん","八匹":"はっぴき",
  "八杯":"はっぱい","八分":"はっぷん","八冊":"はっさつ",
  "十回":"じゅっかい","十階":"じゅっかい","十個":"じゅっこ","十本":"じゅっぽん",
  "十匹":"じゅっぴき","十杯":"じゅっぱい","十冊":"じゅっさつ","十歳":"じゅっさい",
  "三本":"さんぼん","三匹":"さんびき","三杯":"さんばい","三階":"さんがい","三分":"さんぷん",
  "三百":"さんびゃく","三千":"さんぜん",
  "何本":"なんぼん","何匹":"なんびき","何杯":"なんばい","何階":"なんがい","何分":"なんぷん",
  "何回":"なんかい",
  "日本":"にほん"
};

// Walk base and reading in step, handing each kanji run whatever lies between
// the kana runs that bracket it: 話し合う / はなしあう pins し at index 2 and
// う at 4, which leaves はな for 話 and あ for 合. Returns null when the two do
// not line up rather than splitting the difference.
export function alignReading(base, reading) {
  if (!base || !reading || !KANA.test(reading)) return null;
  const runs = [];
  for (const ch of base) {
    const kanji = KANJI.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === kanji) last.text += ch;
    else runs.push({kanji, text: ch});
  }
  if (!runs.some(run => run.kanji)) return [{text: base}];
  const segments = [];
  let pos = 0;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (!run.kanji) {
      if (!reading.startsWith(run.text, pos)) return null;
      segments.push({text: run.text});
      pos += run.text.length;
      continue;
    }
    const next = runs[i + 1];
    // Every kanji run needs at least one kana of its own, hence pos + 1.
    const end = next ? reading.indexOf(next.text, pos + 1) : reading.length;
    if (end < 0 || end <= pos) return null;
    segments.push({text: run.text, reading: reading.slice(pos, end)});
    pos = end;
  }
  return pos === reading.length ? segments : null;
}

// The inverse of rubySegments: tokens back out as notation.
export function segmentsToNotation(segments = []) {
  return segments.map(part => part.reading ? `${part.text}【${part.reading}】` : part.text).join("");
}

// Merge adjacent tokens whose joined surface has a known reading, so an
// override can repair a compound the analyser split.
function applyOverrides(tokens, overrides) {
  const keys = Object.keys(overrides);
  if (!keys.length) return tokens;
  const longest = Math.max(...keys.map(key => key.length));
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    let joined = "", match = null;
    for (let span = i; span < tokens.length; span++) {
      joined += tokens[span][0];
      if (joined.length > longest) break;
      if (overrides[joined]) match = [span, joined, overrides[joined]];
    }
    if (match) { out.push([match[1], match[2]]); i = match[0]; }
    else out.push(tokens[i]);
  }
  return out;
}

// tokens: [[surface, reading], ...] from a morphological analyser, the reading
// in kana or empty. Returns canonical notation.
export function readingsToNotation(tokens, overrides = {}) {
  let out = "";
  for (const [surface, reading] of applyOverrides([...tokens], {...PRONUNCIATION_OVERRIDES, ...overrides})) {
    const kana = reading && reading !== "*" ? toHiragana(reading) : "";
    const segments = kana ? alignReading(surface, kana) : null;
    out += segments ? segmentsToNotation(segments) : surface;
  }
  return out;
}

// --- sentences ---------------------------------------------------------------

export function validateTranslation(result, targetLang = "ja") {
  const japanese = normalizeFurigana(String(result?.japanese || "").trim());
  // Only Japanese can be script-checked this cheaply. For everything else a
  // non-empty answer is all we can honestly assert.
  if (!japanese) throw new Error("The translator returned nothing.");
  if (targetLang === "ja" && !/[぀-ヿ㐀-鿿]/.test(japanese)) throw new Error("The translator did not return a Japanese sentence.");
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
  for (const record of incoming) {
    const candidate = migrateSentence(record);
    if (!candidate?.id || !candidate.source || !candidate.target) continue;
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
