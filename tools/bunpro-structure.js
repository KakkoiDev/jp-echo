// Paste into the browser console on https://bunpro.jp/grammar_points while
// logged in. It reads the index page in front of you and nothing else.
//
// What it takes: each grammar point's name, its slug, its JLPT level, its
// position in the list — Bunpro's teaching order — and a short English gloss
// if one sits beside the name on the index.
// What it never takes: it does not open a single grammar point, so it cannot
// reach an explanation, an example sentence, or audio. The structure, not
// the product.
//
// Output: a JSON array on the console, copied to the clipboard where the
// console allows it. Save it as tools/bunpro-grammar.json in the repo and run
// tools/build-grammar-data.mjs.
(() => {
  const LEVEL = /^(?:JLPT\s*)?N([1-5])\b/i;
  const points = new Map();
  let level = null;

  // Document order, so a heading sets the level for every link after it until
  // the next heading. That survives most layouts without knowing any of them.
  for (const el of document.body.querySelectorAll("*")) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join(" ").trim();
    const m = own.match(LEVEL);
    if (m && own.length < 24) { level = "N" + m[1]; continue; }
    if (el.tagName === "A" && /\/grammar_points\/[^/?#]+/.test(el.getAttribute("href") || "")) {
      const slug = el.getAttribute("href").match(/\/grammar_points\/([^/?#]+)/)[1];
      if (points.has(slug)) continue;
      const title = el.innerText.trim().split("\n")[0].trim();
      // A gloss is a short Latin-script line next to the name, if the index
      // shows one. Best effort; blank is fine.
      const rest = el.innerText.trim().split("\n").slice(1).map(s => s.trim()).find(s => s && /^[\x20-\x7E]+$/.test(s) && s.length < 60) || "";
      points.set(slug, {slug, title, level, order: points.size, hint: rest});
    }
  }

  const list = [...points.values()];
  const missing = list.filter(p => !p.level).length;
  const byLevel = {};
  for (const p of list) byLevel[p.level || "?"] = (byLevel[p.level || "?"] || 0) + 1;
  console.log(`${list.length} grammar points`, byLevel, missing ? `(${missing} with no level found — send me the structure dump below)` : "");

  if (missing || !list.length) {
    // Enough to write a better walker against, without the page's content:
    // the tag path and class names around the first few links, no text.
    const path = el => { const out = []; for (let n = el, i = 0; n && n !== document.body && i < 6; n = n.parentElement, i++) out.unshift(n.tagName.toLowerCase() + (n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).slice(0, 3).join(".") : "")); return out.join(" > "); };
    const links = [...document.querySelectorAll('a[href*="/grammar_points/"]')].slice(0, 3);
    console.log("STRUCTURE DUMP (no content):", JSON.stringify({
      links: links.map(path),
      headings: [...document.querySelectorAll("h1,h2,h3,h4,[class*=level],[class*=jlpt]")].slice(0, 12).map(path),
    }, null, 1));
  }

  const json = JSON.stringify(list, null, 1);
  try { copy(json); console.log("copied to clipboard"); } catch { console.log(json); }
  return list.length;
})();
