// The owner's drawn anchor set (docs/design/november): one 128px picture per
// anchor in a light and a dark drawing, under anchors/ and anchors-dark/,
// named by romaji. Voiced and p-sounds reuse their base anchor's picture —
// the giant (゛) or balloon (゜) is the corner mark, not a second drawing. A
// combined sound with an anchor of its own has its own picture; one that
// fuses two anchors has none. The anchors themselves stay MORA_MNEMONICS v4
// in core.js: this module only says where each one's drawing is and which
// Mora section shows it.
import {MORA_VOICED,MORA_YOON,MORA_MNEMONICS} from "./core.js";

export const MORA_ROMAJI = Object.freeze({
  "あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
  "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
  "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
  "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo",
  "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","を":"wo","ん":"n",
  "きゃ":"kya","きゅ":"kyu","きょ":"kyo","しゃ":"sha","しゅ":"shu","しょ":"sho","ちゃ":"cha","ちゅ":"chu","ちょ":"cho",
  "にゅ":"nyu","ひゃ":"hya","ひょ":"hyo","りゅ":"ryu","りょ":"ryo"
});

export const MORA_SECTIONS = Object.freeze(["base","voiced","combined","specials"]);

// The anchor a sound draws on: its own for a base kana or a combined sound
// with one, the unvoiced base for ゛/゜ (a giant or a balloon of it).
export function moraBase(mora) {
  const kana = String(mora || "").replace(/^っ/, "");
  const [first, small] = [kana[0], kana.slice(1)];
  const [base, mark] = MORA_VOICED[first] || [first, null];
  return {key: base + small, mark: mark === "巨大" ? "giant" : mark === "風船" ? "balloon" : null, kana};
}

export function moraPicture(mora) {
  const {key} = moraBase(mora), name = MORA_ROMAJI[key];
  if (!name || (key.length > 1 && !MORA_YOON[key])) return null;
  return {light: "/anchors/" + name + ".png", dark: "/anchors-dark/" + name + ".png"};
}

export function moraSection(mora) {
  const kana = String(mora || "");
  if (kana.startsWith("っ")) return "specials";
  if (kana.length > 1) return "combined";
  if (MORA_VOICED[kana]) return "voiced";
  return MORA_MNEMONICS[kana] ? "base" : "specials";
}

// Where a sound's cell is: /mora?section=…#<kana>. The strip in Echo's note
// and the drill link here.
export function moraCellHref(mora) {
  const {kana} = moraBase(mora);
  const section = moraSection(kana);
  return "/mora" + (section === "base" ? "" : "?section=" + section) + "#" + encodeURIComponent(kana);
}

// AnchorStrip items from moraMnemonicTokens(reading) (core.js).
export function anchorStripItems(tokens = []) {
  return tokens.map(token => {
    const {mark} = moraBase(token.mora);
    return {mora: token.mora, image: token.image, mark, picture: moraPicture(token.mora), href: moraCellHref(token.mora)};
  });
}

// Every picture the app precaches: the current anchors only. The six
// alternates on the AnchorAudit sheet wait for the owner's decision.
export const ANCHOR_PICTURES = Object.freeze(Object.values(MORA_ROMAJI).filter((name, i, all) => all.indexOf(name) === i)
  .flatMap(name => ["./anchors/" + name + ".png", "./anchors-dark/" + name + ".png"]));
