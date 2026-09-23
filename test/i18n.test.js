import test from "node:test";
import assert from "node:assert/strict";
import {applyI18n, hasDictionary, setDictionary, t} from "../i18n.js";

test("an unknown string is returned as written", () => {
  setDictionary(null);
  assert.equal(t("Ready to practice."), "Ready to practice.");
  assert.equal(hasDictionary(), false);
});

test("a known string is translated", () => {
  setDictionary({"Ready to practice.": "Prêt à pratiquer."});
  assert.equal(t("Ready to practice."), "Prêt à pratiquer.");
  assert.equal(t("Something else"), "Something else", "and an unknown one still falls back");
  assert.equal(hasDictionary(), true);
});

test("placeholders are filled after translation, not before", () => {
  setDictionary({"Enter a sentence in {language}.": "Écrivez une phrase en {language}."});
  assert.equal(t("Enter a sentence in {language}.", {language: "japonais"}),
    "Écrivez une phrase en japonais.");
});

test("an unfilled placeholder is left alone rather than blanked", () => {
  setDictionary(null);
  assert.equal(t("Hello {name} and {other}", {name: "you"}), "Hello you and {other}");
});

test("an empty dictionary is the same as none", () => {
  setDictionary({});
  assert.equal(hasDictionary(), false);
  assert.equal(t("Play"), "Play");
});
