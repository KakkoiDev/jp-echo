// Which reading each kanji of a word takes: 就任 しゅうにん → 就 しゅう, 任 にん.
//
// The game's unit of learning is the kanji with its reading, not the word
// (owner, 26 Nov): a word is the example that carries them. This splits a
// word's reading over its kanji using each kanji's dictionary readings
// (kanji-readings.js, KANJIDIC), allowing the sound changes Japanese makes
// where kanji meet: voicing (会社 かいしゃ / 株式会社 がいしゃ), p-sounds after っ
// or ん (発 はつ → 出発 しゅっぱつ), and a small っ (学 がく → 学校 がっこう).
// Each part names the reading as heard and its base, the dictionary reading
// it comes from, so 発 in 出発 and 発 in 発見 are the same thing learned.
// Build-time only (tools/build-level-inventories.mjs): the page reads the
// result from the inventories and never loads KANJIDIC for this.
const KANJI = /[一-鿿々]/;
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const VOICE = {か:"が",き:"ぎ",く:"ぐ",け:"げ",こ:"ご",さ:"ざ",し:"じ",す:"ず",せ:"ぜ",そ:"ぞ",た:"だ",ち:"ぢ",つ:"づ",て:"で",と:"ど",は:"ば",ひ:"び",ふ:"ぶ",へ:"べ",ほ:"ぼ"};
const HALF = {は:"ぱ",ひ:"ぴ",ふ:"ぷ",へ:"ぺ",ほ:"ぽ"};
const I_ROW = {う:"い",く:"き",ぐ:"ぎ",す:"し",つ:"ち",ぬ:"に",ぶ:"び",む:"み",る:"り"};

// The dictionary readings of one kanji, as hiragana: on'yomi, and kun'yomi
// as the part the kanji itself covers (before the dot), plus the noun form of
// a verb when the okurigana is dropped (話 はなし from はな.す, 受付 うけつけ).
export function baseReadings(entry) {
  const out = new Set();
  for (const on of entry?.on || []) out.add(toHira(on.replace(/-/g, "")));
  for (const kun of entry?.kun || []) {
    const [stem, okuri = ""] = toHira(kun.replace(/-/g, "")).split(".");
    if (stem) out.add(stem);
    if (!okuri) continue;
    const last = okuri.at(-1);
    if (I_ROW[last]) out.add(stem + okuri.slice(0, -1) + I_ROW[last]); // godan: はな.す → はなし
    if (last === "る") out.add(stem + okuri.slice(0, -1));              // ichidan: う.ける → うけ
  }
  return [...out].filter(Boolean);
}
// The forms a base reading can take inside a word: [heard, base].
function forms(base, {first, last}) {
  const out = [[base, base]], head = base[0], tail = base.at(-1), body = base.slice(0, -1);
  if (!first) { if (VOICE[head]) out.push([VOICE[head] + base.slice(1), base]); if (HALF[head]) out.push([HALF[head] + base.slice(1), base]); }
  if (!last && base.length > 1 && "つくちき".includes(tail)) {
    out.push([body + "っ", base]);
    if (!first && VOICE[head]) out.push([VOICE[head] + body.slice(1) + "っ", base]);
  }
  return out;
}

// parts: one {k, r, base} per kanji, or null when the word does not split
// cleanly (an irregular reading such as 今日 きょう, or a kanji KANJIDIC does
// not list). 々 takes the kanji before it. Kana in the word must line up.
export function splitReading(text, reading, readings) {
  const chars = [...String(text || "")], kana = toHira(String(reading || ""));
  const kanjiAt = chars.map((c, i) => KANJI.test(c) ? i : -1).filter(i => i >= 0);
  if (!kanjiAt.length) return null;
  const memo = new Map();
  const walk = (i, at) => {
    const key = i + ":" + at;
    if (memo.has(key)) return memo.get(key);
    let result = null;
    if (i === chars.length) result = at === kana.length ? [] : null;
    else if (!KANJI.test(chars[i])) {
      const c = toHira(chars[i]);
      result = kana.startsWith(c, at) ? walk(i + 1, at + c.length) : /[ぁ-ゖー]/.test(c) ? null : walk(i + 1, at);
    } else {
      const k = chars[i] === "々" ? chars[i - 1] : chars[i];
      const options = baseReadings(readings[k]).flatMap(b => forms(b, {first: i === kanjiAt[0], last: i === kanjiAt.at(-1)}));
      // The longest reading that lets the rest line up, the plain form before a changed one.
      for (const [heard, base] of options.sort((a, b) => b[0].length - a[0].length || (a[0] === a[1] ? -1 : 1))) {
        if (!kana.startsWith(heard, at)) continue;
        const rest = walk(i + 1, at + heard.length);
        if (rest) { result = [{k, r: heard, base}, ...rest]; break; }
      }
    }
    memo.set(key, result);
    return result;
  };
  return walk(0, 0);
}
