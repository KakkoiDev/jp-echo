// The interface, in the language you already know.
//
// Keyed by the English string rather than by an invented id, and applied by
// walking the document rather than by marking up every element. The first
// attempt did mark them up, and the script that did it wrapped 19 checkbox
// labels in a span — which is exactly what `label > span:first-child` styles
// as a field label. Rewriting 150 elements to translate them is a lot of
// chances to change how one of them looks.
//
// So nothing in index.html changes. The cost is that two identical English
// strings cannot be translated differently; if that ever bites, the string is
// the wrong string.

let dictionary = null;

// The English a node started with. Translating a translated node would look
// its own output up in the catalogue and find nothing, so the original is kept
// and every pass starts from it.
const ORIGINAL = Symbol("english");
const ORIGINAL_ATTRIBUTES = Symbol("english attributes");
// What this module last wrote. If the value has changed since, the interface
// wrote it — applyLanguageUI rewrites the placeholder whenever the input
// language moves — and that new value is the English to translate from now on.
// Caching the first English forever kept translating a string the screen no
// longer shows.
const WRITTEN = Symbol("last written");
const WRITTEN_ATTRIBUTES = Symbol("last written attributes");

export function setDictionary(next) { dictionary = next && Object.keys(next).length ? next : null; }
export function hasDictionary() { return dictionary !== null; }

/** Translate one string, filling {name} placeholders. */
export function t(english, vars) {
  const text = (dictionary && dictionary[english]) || english;
  return vars ? text.replace(/\{(\w+)\}/g, (whole, name) => name in vars ? vars[name] : whole) : text;
}

const ATTRIBUTES = ["placeholder", "aria-label", "title"];
const SKIP = new Set(["SCRIPT", "STYLE", "SVG", "PATH", "G", "CIRCLE", "RECT", "TEMPLATE"]);

function translateNode(node) {
  if (node.nodeType === 3) {
    if (node[WRITTEN] === undefined || node.nodeValue !== node[WRITTEN]) node[ORIGINAL] = node.nodeValue;
    const original = node[ORIGINAL];
    const trimmed = original.trim();
    if (!trimmed) return;
    const translated = t(trimmed);
    node.nodeValue = translated === trimmed ? original : original.replace(trimmed, translated);
    node[WRITTEN] = node.nodeValue;
    return;
  }
  if (node.nodeType !== 1 || SKIP.has(node.tagName)) return;
  for (const attribute of ATTRIBUTES) {
    if (!node.hasAttribute(attribute)) continue;
    // On a symbol, not in dataset: a data- attribute cannot hold a colon, and
    // the originals have no business showing up in the markup.
    const originals = node[ORIGINAL_ATTRIBUTES] ??= {};
    const written = node[WRITTEN_ATTRIBUTES] ??= {};
    const current = node.getAttribute(attribute);
    if (!(attribute in written) || current !== written[attribute]) originals[attribute] = current;
    const value = t(originals[attribute]);
    node.setAttribute(attribute, value);
    written[attribute] = value;
  }
  for (const child of node.childNodes) translateNode(child);
}

/** Retranslate a subtree from the English it was written in. */
export function applyI18n(root = document.body) {
  if (root) translateNode(root);
}
