// One-off: pull the 響 outline out of Shippori Mincho SemiBold and print the
// path data used in icon.svg and mask-icon.svg. The committed SVGs carry the
// path, so nothing at runtime depends on the font being installed.
//   npm i opentype.js && node tools/glyph-path.mjs
import opentype from "opentype.js";
import {readFileSync} from "node:fs";

const TILE = 512, GLYPH_HEIGHT = 0.70, NUDGE_DOWN = 0.02;
const file = process.argv[2] || "shippori-subset.ttf";
const buffer = readFileSync(file);
const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const glyph = font.charToGlyph("響");
if (!glyph.index) throw new Error("the font has no 響 — fetch a subset that includes it");

const box = glyph.getBoundingBox();
const size = (TILE * GLYPH_HEIGHT) / (box.y2 - box.y1) * font.unitsPerEm;
const scale = size / font.unitsPerEm;
// getPath puts the baseline at y and flips to SVG's y-down space.
const x = TILE / 2 - (box.x1 + box.x2) / 2 * scale;
const y = TILE / 2 + TILE * NUDGE_DOWN + (box.y1 + box.y2) / 2 * scale;
const path = glyph.getPath(x, y, size);
const drawn = path.getBoundingBox();
console.error(`ink ${(drawn.x2 - drawn.x1).toFixed(1)}×${(drawn.y2 - drawn.y1).toFixed(1)} of ${TILE}` +
  ` (${((drawn.y2 - drawn.y1) / TILE * 100).toFixed(1)}% tall), centre ${((drawn.x1 + drawn.x2) / 2).toFixed(1)},${((drawn.y1 + drawn.y2) / 2).toFixed(1)}`);
console.log(path.toPathData(2));
