// Canonical browser Japanese lexical matching. Consumers provide dictionary data.
// Written and kana forms share inflection rules; unknown katakana runs stay whole.
export function createJapaneseWordMatcher(WORDS) {
const INDEX=new Map(WORDS.map(w=>[Number(w.id),w]));
const word=id=>INDEX.get(Number(id));
const NEXT = {
  v1: "るたてなまられよずにろさせち", "v1-s": "るたてなまられよずにろさせち", vk: "るたてなまいよれら",
  v5k: "かきくけこい", "v5k-s": "かきくけこっ", v5g: "がぎぐげごい", v5s: "さしすせそ", v5t: "たちつてとっ", v5n: "なにぬねのん",
  v5b: "ばびぶべぼん", v5m: "まみむめもん", v5r: "らりるれろっ", "v5r-i": "らりるれろっ", v5u: "わいうえおっ", "v5u-s": "わいうえおう", v5aru: "いらるれろっ",
  "adj-i": "いくかけさそ", "adj-ix": "いくかけさそ",
};
// Where a one-kana stem is trusted: after a kanji, or after て and で (an
// auxiliary: 食べている) or a particle (宿題をした, 犬がいた).
const AFTER_ONE = "てでをがはにもとへの";
const isKanji = c => /[㐀-䶿一-鿿豈-﫿]|[\u{20000}-\u{3134F}]/u.test(c || "");
const katakanaRun = /[ァ-ヺー]+/g;
const katakanaRanges = text => [...text.matchAll(katakanaRun)].map(m=>({start:m.index,end:m.index+m[0].length,surface:m[0]}));
const insideKatakana = (ranges,start,end) => ranges.some(r=>start<r.end&&end>r.start&&(start!==r.start||end!==r.end));
const isKana = c => /[ぁ-ゖァ-ヺー]/.test(c || "");
const allKana = s => [...s].every(isKana);

// The forms a word is looked for under: the written form, and for a word
// usually written in kana, its kanji too when that is all kanji (沢山, not
// 今日は for こんにちは). Each becomes a key — a stem for a word that
// conjugates — with the rule for what may follow. An interjection (はい) is
// a whole utterance, so it needs a kana-free edge on both sides, or は + いい
// would read as はい.
function keysOf(w, readings=false) {
  const out = [], pos = w.pos || [];
  const bound = pos.includes("int") && pos.length === 1;
  for (const form of [...new Set([w.w, readings&&pos.some(p=>NEXT[p]||p==="vs-i"||p==="vs-s")&&w.r!==w.w?w.r:null, w.k && !allKana(w.k) && [...w.k].every(isKanji) ? w.k : null].filter(Boolean))]) {
    const conj = pos.find(p => NEXT[p]);
    const suru = pos.some(p => p === "vs-i" || p === "vs-s") && form.endsWith("する") && form.length > 2;
    if (suru) { out.push({key: form.slice(0, -2), next: "すしせさ", kana: allKana(form)}); continue; }
    // する itself: し before ます, て, た, ない, よう, and the whole word.
    if (form === "する" && pos.some(p => p === "vs-i")) { out.push({key: "し", next: "まてたなよ", kana: true}, {key: form, next: null, kana: true}); continue; }
    if (conj && form.length >= 2) {
      out.push({key: form.slice(0, -1), next: NEXT[conj], kana: allKana(form)});
      // A two-kana word (いる, ある, いい) keeps its whole form too, since its
      // one-kana stem is only trusted after a kanji or て.
      if (form.length === 2 && allKana(form)) out.push({key: form, next: null, kana: true});
      continue;
    }
    out.push({key: form, next: null, kana: allKana(form), alone: form.length === 1 && isKanji(form), bound});
  }
  return out;
}
let FORMS = null, LONGEST = 1;
function index() {
  if (FORMS) return FORMS;
  FORMS = new Map();
  for (const w of WORDS) for (const k of keysOf(w)) {
    if (!k.key || k.key.length > 16) continue;
    LONGEST = Math.max(LONGEST, k.key.length);
    const hit = {...k, id: w.id}, list = FORMS.get(k.key);
    if (list) list.push(hit); else FORMS.set(k.key, [hit]);
  }
  return FORMS;
}

// The ids of the words a run of plain text uses. Every form that fits is a
// candidate; then the rules that stand in for a parser:
// - a stem of one kana (い for いる, し for する) only after a kanji, a
//   particle, or て and で, where an auxiliary sits: 食べている, 宿題をした,
//   not 会いたい;
// - a one-kanji word standing alone loses to a stem starting at the same
//   place: 行った is 行く, not 行 the row;
// - a kana word may not begin on a conjugation ending: 買わ is not わ;
// - two kana words that overlap resolve to the longer when they start
//   together (かわいい, not か) and to the earlier otherwise, so ですね is
//   です and ね, not すね — a single kana never blocks a later start.
function wordsIn(text = "") {
  const s = String(text), forms = index(), hits = [], ranges=katakanaRanges(String(text));
  for (let i = 0; i < s.length; i++) {
    for (let len = 1; len <= LONGEST && i + len <= s.length; len++) {
      const list = forms.get(s.slice(i, i + len));
      if (!list) continue;
      const after = s[i + len] || "", before = s[i - 1] || "";
      for (const h of list) {
        if (h.next) {
          if (!after || !h.next.includes(after)) continue;
          if (len === 1 && h.kana && isKana(before) && !AFTER_ONE.includes(before)) continue;
          hits.push({id: h.id, start: i, end: i + len + 1, kana: h.kana, stem: true});
        } else {
          if (h.alone && (isKanji(before) || isKanji(after))) continue;
          if (h.bound && (isKana(before) || isKana(after))) continue;
          hits.push({id: h.id, start: i, end: i + len, kana: h.kana, alone: h.alone});
        }
      }
    }
  }
  const stemStarts = new Set(), endings = new Set();
  for (const h of hits) if (h.stem) { stemStarts.add(h.start); endings.add(h.end - 1); }
  const found = new Set(), kana = [];
  for (const h of hits) {
    if(insideKatakana(ranges,h.start,h.end))continue;
    if (h.alone && stemStarts.has(h.start)) continue;
    if (h.kana && endings.has(h.start)) continue;
    if (h.kana) kana.push(h); else found.add(h.id);
  }
  kana.sort((a, b) => a.start - b.start || b.end - a.end);
  const chosen = [];
  for (const h of kana) {
    if (chosen.some(c => c.start === h.start || (c.end - c.start > 1 && c.start < h.start && h.start < c.end))) continue;
    chosen.push(h); found.add(h.id);
  }
  return found;
}

// Clickable dictionary spans use the same conjugation rules as coverage, but
// keep the whole surface form instead of exposing only the dictionary stem.
// The matcher has already proved that the first inflection kana is legal for
// this word; these are the common continuations that belong to that same verb.
const INFLECTION_TAILS=Object.freeze([
  "ませんでした","ていました","でいました","られました","させました",
  "なかった","たかった","ません","ました","ています","でいます","られます","させます",
  "なければ","ていた","でいた","られた","させた",
  "ます","ている","でいる","られる","させる","ない","たい","たくない","たくなかった",
  "れば","れる","せる","いる","いた","ください","た","て","で"
].sort((a,b)=>b.length-a.length));
function extendInflectedSurface(text,end){
  const rest=text.slice(end),last=text[end-1]||"";
  // Ichidan polite forms have already consumed ま, so only the remainder is
  // left. Godan polite forms still have the whole ます/ました tail.
  if(last==="ま"){
    for(const tail of ["せんでした","した","せん","す"])if(rest.startsWith(tail))return end+tail.length;
  }
  for(const tail of INFLECTION_TAILS)if(rest.startsWith(tail))return end+tail.length;
  return end;
}

// Return non-overlapping surface ranges linked to dictionary-form word ids.
// Supplying ids keeps review highlighting constrained to words the sentence
// matcher already recognised, avoiding a second independent tokenizer.
function wordSpans(text="",ids=null){
  const s=String(text),wanted=ids==null?null:new Set([...ids].map(Number)),hits=[],ranges=katakanaRanges(s);
  const words=wanted?[...wanted].map(word).filter(Boolean):WORDS;
  for(const w of words)for(const k of keysOf(w,true)){
    if(!k.key)continue;
    let from=0,indexAt;
    while((indexAt=s.indexOf(k.key,from))!==-1){
      const after=s[indexAt+k.key.length]||"",before=s[indexAt-1]||"";
      let end=indexAt+k.key.length,stem=false;
      if(k.next){
        if(!after||!k.next.includes(after)){from=indexAt+1;continue}
        if(k.key.length===1&&k.kana&&isKana(before)&&!AFTER_ONE.includes(before)){from=indexAt+1;continue}
        end=extendInflectedSurface(s,end+1);stem=true;
      }else{
        if(k.alone&&(isKanji(before)||isKanji(after))){from=indexAt+1;continue}
        if(k.bound&&(isKana(before)||isKana(after))){from=indexAt+1;continue}
      }
      if(!insideKatakana(ranges,indexAt,end))hits.push({id:w.id,start:indexAt,end,stem,dictionary:w.w});
      from=indexAt+Math.max(1,k.key.length);
    }
  }
  hits.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start)||(b.stem-a.stem)||String(a.dictionary).length-String(b.dictionary).length);
  const chosen=[];
  for(const hit of hits){
    const same=chosen.find(other=>hit.start===other.start&&hit.end===other.end);if(same){if(!same.ids.includes(hit.id))same.ids.push(hit.id);continue}
    if(chosen.some(other=>hit.start<other.end&&other.start<hit.end))continue;
    chosen.push({...hit,ids:[hit.id]});
  }
  for(const range of ranges)if(!chosen.some(h=>range.start<h.end&&h.start<range.end))chosen.push({...range,id:null,ids:[],dictionary:range.surface});
  return chosen.sort((a,b)=>a.start-b.start);
}



return {wordsIn,wordSpans,keysOf};
}
