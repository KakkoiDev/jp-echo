import test from "node:test";
import assert from "node:assert/strict";
import {forBackup, makeNote, mergeNotes, noteKey} from "../notes.js";
import {shapeNotes} from "../api.js";
import {exportBackup} from "../core.js";

test("a note knows whose it is, and keeps Echo's original for Reset", () => {
  const echo = makeNote({kind: "point", id: "te-shimau", part: "breath", text: "Attach しまう to the て-form.", now: new Date("2026-09-26T00:00:00Z")});
  assert.equal(echo.key, "point:te-shimau:breath"); assert.equal(echo.by, "echo"); assert.equal(echo.echo, echo.text);
  const yours = makeNote({kind: "point", id: "te-shimau", part: "breath", text: "Compare it with ておく.", echo: echo.echo, by: "you"});
  assert.equal(yours.by, "you"); assert.equal(yours.echo, "Attach しまう to the て-form.", "Echo's text rides along");
  assert.equal(noteKey("kanji", "学", "story"), "kanji:学:story");
});

test("a backup carries notes but never the example cache; restore keeps the newer of each", () => {
  const a = makeNote({kind: "point", id: "p", part: "breath", text: "old", now: new Date("2026-01-01T00:00:00Z")});
  const ex = makeNote({kind: "point", id: "p", part: "examples", text: [{ja: "x", en: "y"}]});
  assert.deepEqual(forBackup([a, ex]).map(n => n.part), ["breath"]);
  assert.deepEqual(exportBackup([], {}, forBackup([a, ex])).notes.map(n => n.key), ["point:p:breath"], "exportBackup takes the notes");
  const newer = makeNote({kind: "point", id: "p", part: "breath", text: "new", by: "you", now: new Date("2026-02-01T00:00:00Z")});
  const other = makeNote({kind: "kanji", id: "学", part: "story", text: {meaning: "m", reading: "r"}, by: "you"});
  const merged = mergeNotes([a, ex], [newer, other, ex, {key: "junk"}]);
  assert.equal(merged.find(n => n.key === "point:p:breath").text, "new", "the newer version wins");
  assert.ok(merged.some(n => n.key === "kanji:学:story"), "a note only in the backup is kept");
  assert.ok(merged.some(n => n.part === "examples"), "the local example cache stays");
  assert.equal(merged.filter(n => n.part === "examples").length, 1, "and the backup's example cache is ignored");
  assert.ok(!merged.some(n => n.key === "junk"));
});

test("Echo's note is whole, two examples, and to the rules", () => {
  const good = {breath: "Attach しまう to the て-form.", remember: "Shut, man.", examples: [{ja: "忘れてしまった。", en: "I went and forgot."}, {ja: "読んでしまいました。", en: "I finished reading it."}, {ja: "x", en: "y"}]};
  const shaped = shapeNotes(good);
  assert.equal(shaped.examples.length, 2, "two, whatever the model sent");
  assert.throws(() => shapeNotes({...good, remember: ""}), /whole note/);
  assert.throws(() => shapeNotes({...good, examples: [good.examples[0]]}), /whole note/);
  assert.throws(() => shapeNotes({...good, breath: "Gee, attach it."}), /rules/);
  assert.throws(() => shapeNotes({...good, breath: "<b>Attach</b> it."}), /rules/);
});

test("a word note is one field, refused if it breaks a rule", async () => {
  const {shapeWordNote} = await import("../api.js");
  assert.deepEqual(shapeWordNote({remember: "食べる: ta-BE-ru — a table you eat at."}), {remember: "食べる: ta-BE-ru — a table you eat at."});
  assert.throws(() => shapeWordNote({remember: ""}), /did not write/);
  assert.throws(() => shapeWordNote({remember: "Gee, it sticks."}), /rules/);
});
