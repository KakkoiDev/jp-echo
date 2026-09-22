import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_PAIR,LANGUAGES,createSentence,hasRegisters,migrateSentence,newId,exportBackup,mergeSentences,normalizeFurigana,rubyHtml,stripFurigana,validateTranslation,validateTranslations} from "../core.js";
test("safe ruby HTML",()=>{assert.equal(rubyHtml("<b>日本【にほん】</b>"),"&lt;b&gt;<ruby>日本<rt>にほん</rt></ruby>&lt;/b&gt;");assert.equal(stripFurigana("日本【にほん】です"),"日本です")});
test("removes redundant kana furigana",()=>{const bad="これはテスト【てすと】です、うまくいっています。";assert.equal(normalizeFurigana(bad),"これはテストです、うまくいっています。");assert.equal(normalizeFurigana("これ【これ】はテスト【てすと】です"),"これはテストです");assert.equal(rubyHtml(bad),"これはテストです、うまくいっています。");assert.equal(validateTranslation({japanese:bad}),"これはテストです、うまくいっています。")});
test("validates Japanese",()=>{assert.throws(()=>validateTranslation({japanese:"hello"}));assert.equal(validateTranslation({japanese:"日本【にほん】"}),"日本【にほん】")});
test("validates casual and polite Japanese",()=>{assert.deepEqual(validateTranslations({casual:"行【い】く",polite:"行【い】きます"}),{casual:"行【い】く",polite:"行【い】きます"});assert.deepEqual(validateTranslations({japanese:"行【い】く"}),{casual:"行【い】く",polite:"行【い】く"})});
test("backup omits provider credentials",()=>{const item=createSentence(" Japan "," 日本【にほん】 ",new Date("2026-01-01T00:00:00Z"),"one");assert.equal(item.plainTarget,"日本");const preferences=exportBackup([item],{apiKey:"secret",providerKeys:{openai:"also-secret"},rate:1}).preferences;assert.equal(preferences.apiKey,undefined);assert.equal(preferences.providerKeys,undefined)});
test("merge is deterministic",()=>{const old={id:"x",english:"old",japanese:"古【ふる】い",echoCount:4,createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-02T00:00:00Z"},fresh={...old,english:"new",echoCount:2,createdAt:"2026-01-03T00:00:00Z",updatedAt:"2026-01-04T00:00:00Z"};const [merged]=mergeSentences([old],[fresh]);assert.equal(merged.source,"new");assert.equal(merged.echoCount,4);assert.equal(merged.createdAt,old.createdAt)});

test("an empty reading never reaches the screen or the voice", () => {
  const raw = "これはテスト【】の文【ぶん】だ。";
  assert.equal(normalizeFurigana(raw), "これはテストの文【ぶん】だ。");
  assert.equal(stripFurigana(raw), "これはテストの文だ。");
  assert.ok(!rubyHtml(raw).includes("【"), "no stray bracket survives into the markup");
  assert.match(rubyHtml(raw), /<ruby>文<rt>ぶん<\/rt><\/ruby>/, "a real reading still renders");
});

test("a whitespace-only reading is dropped too", () => {
  assert.equal(stripFurigana("テスト【 】です"), "テストです");
});


// globalThis.crypto is getter-only in node, so the stub goes in by descriptor.
const withCrypto=(value,fn)=>{const real=Object.getOwnPropertyDescriptor(globalThis,"crypto");
  Object.defineProperty(globalThis,"crypto",{value,configurable:true,writable:true});
  try{fn()}finally{Object.defineProperty(globalThis,"crypto",real)}};

test("ids do not need a secure context", () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  // Plain http: randomUUID is missing, getRandomValues is not.
  withCrypto({getRandomValues}, () => {
    const id = newId();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(newId(), id);
    assert.equal(createSentence("hi", "やあ").id.length, 36);
  });
});

test("an id is still produced with no crypto at all", () => {
  withCrypto(undefined, () => {
    assert.match(newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

test("a v1 sentence migrates to a language pair", () => {
  const old={id:"x",english:"Japan",japanese:"日本【にほん】",plainJapanese:"日本",
    casualJapanese:"日本【にほん】だ",politeJapanese:"日本【にほん】です",
    echoCount:3,createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-02T00:00:00Z",
    srs:{state:2,due:"2026-02-01T00:00:00Z",reps:5},schemaVersion:1};
  const now=migrateSentence(old);
  assert.equal(now.schemaVersion,2);
  assert.deepEqual({sourceLang:now.sourceLang,targetLang:now.targetLang},DEFAULT_PAIR);
  assert.equal(now.source,"Japan");
  assert.equal(now.casualTarget,"日本【にほん】だ");
  assert.equal(now.politeTarget,"日本【にほん】です");
  assert.equal(now.plainTarget,"日本");
  // the history that makes a sentence worth keeping survives
  assert.equal(now.echoCount,3);
  assert.deepEqual(now.srs,old.srs);
  assert.equal(now.createdAt,old.createdAt);
  // and the old names are gone rather than shadowing the new ones
  assert.equal(now.english,undefined);
  assert.equal(now.japanese,undefined);
  assert.equal(migrateSentence(now),now,"migrating twice is a no-op");
});

test("a non-Japanese target gets one plain translation", () => {
  assert.equal(hasRegisters("fr"),false);
  assert.equal(hasRegisters("ja"),true);
  const only=validateTranslations({translation:"Bonjour le monde"},"fr");
  assert.deepEqual(only,{casual:"Bonjour le monde",polite:"Bonjour le monde"});
  // no script check to lean on, so only emptiness is an error
  assert.throws(()=>validateTranslations({translation:"   "},"fr"));
  assert.throws(()=>validateTranslations({japanese:"hello"},"ja"),/Japanese/);
});

test("a sentence carries the pair it was made with", () => {
  const item=createSentence("Hello","Bonjour",new Date("2026-01-01T00:00:00Z"),"one",{sourceLang:"en",targetLang:"fr"});
  assert.equal(item.targetLang,"fr");
  assert.equal(item.target,"Bonjour");
  assert.equal(item.plainTarget,"Bonjour");
  assert.equal(item.schemaVersion,2);
  assert.ok(LANGUAGES.some(([code])=>code==="fr"));
});
