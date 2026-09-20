// Generates every raster identity asset from the outlines in icon-art.mjs, so
// the size ladder is never hand-drawn. Needs sharp, which is not a dependency
// of the app:
//   npm i sharp && node tools/build-icons.mjs
import sharp from "sharp";
import {mkdirSync, writeFileSync} from "node:fs";
import {SEAL, WORDMARK, WORDMARK_BOX} from "./icon-art.mjs";

const SEAL_RED = "#B8342A", IVORY = "#FCF7EE";
const LIGHT = {ground: "#F3F0E7", ink: "#1C1A17", seal: SEAL_RED, sealInk: IVORY, texture: "28,26,23", ripple: ".14"};
const DARK = {ground: "#191712", ink: "#F2EEE3", seal: "#E0614B", sealInk: "#1A1611", texture: "242,238,227", ripple: ".2"};

const tile = (background, fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">` +
  (background ? `<rect width="512" height="512" fill="${background}"/>` : "") +
  `<path fill="${fill}" d="${SEAL}"/></svg>`;

const render = (svg, size) => sharp(Buffer.from(svg), {density: 384}).resize(size, size).png({compressionLevel: 9});

// iOS wants a real image per device; everything else draws its own splash.
const SCREENS = [
  [1170, 2532], [1179, 2556], [1284, 2778], [1290, 2796], [1125, 2436],
  [1242, 2688], [828, 1792], [750, 1334], [1536, 2048], [1668, 2388], [2048, 2732],
];

// The proportions come straight off the splash mock in AppIcon.dc.html, which
// draws a 168-wide phone: a 62 seal, a 16 gap and the wordmark at 22.
function splash(width, height, theme) {
  const unit = width / 168;
  const sealSide = 62 * unit, gap = 16 * unit, wordSize = 22 * unit;
  const wordWidth = (WORDMARK_BOX.x2 - WORDMARK_BOX.x1) * wordSize / 100;
  const wordHeight = (WORDMARK_BOX.y2 - WORDMARK_BOX.y1) * wordSize / 100;
  const blockTop = (height - (sealSide + gap + wordHeight)) / 2;
  const wordScale = wordSize / 100;
  const wordX = (width - wordWidth) / 2 - WORDMARK_BOX.x1 * wordScale;
  const wordY = blockTop + sealSide + gap - WORDMARK_BOX.y1 * wordScale;
  const sealScale = sealSide / 512;
  const rippleCentre = blockTop + sealSide;
  const ring = radius => `<circle cx="${width / 2}" cy="${rippleCentre}" r="${radius * unit}" fill="none" stroke="${theme.seal}" stroke-opacity="${theme.ripple}" stroke-width="${Math.max(1, unit * 0.6)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><pattern id="warp" width="3" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="rgba(${theme.texture},.022)"/></pattern>
<pattern id="weft" width="1" height="4" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="rgba(${theme.texture},.014)"/></pattern></defs>
<rect width="${width}" height="${height}" fill="${theme.ground}"/>
<rect width="${width}" height="${height}" fill="url(#warp)"/><rect width="${width}" height="${height}" fill="url(#weft)"/>
${ring(44)}${ring(72)}${ring(102)}
<g transform="translate(${(width - sealSide) / 2} ${blockTop}) scale(${sealScale})">
<rect width="512" height="512" rx="33" fill="${theme.seal}"/><path fill="${theme.sealInk}" d="${SEAL}"/></g>
<g transform="translate(${wordX} ${wordY}) scale(${wordScale})"><path fill="${theme.ink}" d="${WORDMARK}"/></g>
</svg>`;
}

// PNG-in-ICO: every browser that matters reads it, and it keeps the 32 sharp.
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({size, data}) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8); entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(image => image.data)]);
}

const seal = tile(SEAL_RED, IVORY);
mkdirSync("splash", {recursive: true});

await render(seal, 192).toFile("icon-192.png");
await render(seal, 512).toFile("icon-512.png");
// The glyph is 70% of the tile, inside the 80% safe zone, so the maskable art
// is the same full-bleed square — a mask can take whatever it needs.
await render(seal, 512).toFile("icon-maskable-512.png");
await render(seal, 180).removeAlpha().toFile("apple-touch-icon.png");

writeFileSync("favicon.ico", ico([
  {size: 16, data: await sharp({create: {width: 16, height: 16, channels: 4, background: SEAL_RED}}).png().toBuffer()},
  {size: 32, data: await render(seal, 32).toBuffer()},
]));

for (const [width, height] of SCREENS) {
  // Flat ground, three hairlines and two marks — a palette holds it exactly and
  // keeps these off the wire budget.
  const options = {compressionLevel: 9, palette: true, colours: 64};
  await sharp(Buffer.from(splash(width, height, LIGHT))).png(options).toFile(`splash/${width}x${height}.png`);
  await sharp(Buffer.from(splash(width, height, DARK))).png(options).toFile(`splash/${width}x${height}-dark.png`);
}
console.log(`icons + ${SCREENS.length * 2} splash images written`);
