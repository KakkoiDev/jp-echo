#!/usr/bin/env node
// Are Echo's copies of the files it shares with JP Core still the same?
//   node tools/check-jp-core.mjs [path-to-a-jp-core-checkout]
// The path defaults to $JP_CORE, then ../jp-core. JP Core's browser files
// import "./jp-core.js" where Echo's import "./core.js"; nothing else may
// differ. Exits 1 and names the files that drifted. Change a shared file in
// one repository, bring it to the other, then run this.
import {readFileSync, existsSync} from "node:fs";
import {resolve} from "node:path";
const root = resolve(process.argv[2] || process.env.JP_CORE || "../jp-core"), SHARED = ["japanese-readings.js", "japanese-words.js", "grammar-spans.js"];
if (!existsSync(resolve(root, "browser"))) { console.error("No JP Core checkout at " + root + " (pass its path, or set JP_CORE)."); process.exit(2); }
const asCore = text => text.replaceAll("./core.js", "./jp-core.js");
const drifted = SHARED.filter(file => asCore(readFileSync(file, "utf8")) !== readFileSync(resolve(root, "browser", file), "utf8"));
for (const file of SHARED) console.log((drifted.includes(file) ? "differs  " : "same     ") + file);
if (drifted.length) { console.error("\n" + drifted.length + " shared file(s) differ from " + root + "/browser."); process.exit(1); }
