// blind.mjs <set.json> <out.json>: the paper as a candidate sees it, without keys, explanations, cues, tags or targets.
import {readFileSync, writeFileSync} from "node:fs";
import {levelRows} from "../../jlpt-sets.js";
const set = JSON.parse(readFileSync(process.argv[2], "utf8"));
writeFileSync(process.argv[3], JSON.stringify(levelRows(set).map(r => ({n: r.index + 1, section: r.label, instruction: r.instruction, context: r.context, prompt: r.prompt, choices: r.choices})), null, 1));
