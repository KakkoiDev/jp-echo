export const SCHEMA_VERSION = 1;
const notation = /([\u3400-\u4dbf\u4e00-\u9fff々]+)【([^】]+)】/g;
const escapeHtml = value => value.replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

export function stripFurigana(value = "") {
  return value.replace(/【[^】]+】/g, "");
}

export function rubyHtml(value = "") {
  let out = "", offset = 0;
  for (const match of value.matchAll(notation)) {
    out += escapeHtml(value.slice(offset, match.index));
    out += "<ruby>" + escapeHtml(match[1]) + "<rt>" + escapeHtml(match[2]) + "</rt></ruby>";
    offset = match.index + match[0].length;
  }
  return out + escapeHtml(value.slice(offset));
}

export function validateTranslation(result) {
  const japanese = String(result?.japanese || "").trim();
  if (!japanese || !/[\u3040-\u30ff\u3400-\u9fff]/.test(japanese)) throw new Error("DeepSeek did not return a Japanese sentence.");
  return japanese;
}

export function validateTranslations(result) {
  const casualJapanese = validateTranslation({japanese:result?.casualJapanese || result?.japanese});
  const politeJapanese = validateTranslation({japanese:result?.politeJapanese || result?.japanese || result?.casualJapanese});
  return {casualJapanese,politeJapanese};
}

export function createSentence(english, japanese, now = new Date(), id = crypto.randomUUID()) {
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
  const {apiKey, ...safe} = preferences;
  return {schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),sentences,preferences:safe};
}
