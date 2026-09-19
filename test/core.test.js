import test from "node:test";
import assert from "node:assert/strict";
import {createSentence,exportBackup,mergeSentences,rubyHtml,stripFurigana,validateTranslation} from "../core.js";
test("safe ruby HTML",()=>{assert.equal(rubyHtml("<b>日本【にほん】</b>"),"&lt;b&gt;<ruby>日本<rt>にほん</rt></ruby>&lt;/b&gt;");assert.equal(stripFurigana("日本【にほん】です"),"日本です")});
test("validates Japanese",()=>{assert.throws(()=>validateTranslation({japanese:"hello"}));assert.equal(validateTranslation({japanese:"日本【にほん】"}),"日本【にほん】")});
test("backup omits API key",()=>{const item=createSentence(" Japan "," 日本【にほん】 ",new Date("2026-01-01T00:00:00Z"),"one");assert.equal(item.plainJapanese,"日本");assert.equal(exportBackup([item],{apiKey:"secret",rate:1}).preferences.apiKey,undefined)});
test("merge is deterministic",()=>{const old={id:"x",english:"old",japanese:"古【ふる】い",echoCount:4,createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-02T00:00:00Z"},fresh={...old,english:"new",echoCount:2,createdAt:"2026-01-03T00:00:00Z",updatedAt:"2026-01-04T00:00:00Z"};const [merged]=mergeSentences([old],[fresh]);assert.equal(merged.english,"new");assert.equal(merged.echoCount,4);assert.equal(merged.createdAt,old.createdAt)});
