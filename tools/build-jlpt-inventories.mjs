// Rebuild the research inventories from the versioned Echo catalogues.
import {writeFileSync} from "node:fs";
import {WORDS} from "../words-data.js";
import {GRAMMAR} from "../grammar-data.js";

for (const level of ["N5", "N4", "N3", "N1"]) {
  const vocabulary = WORDS.filter(word => word.jlpt === level);
  const grammar = GRAMMAR.filter(point => point.level === level)
    .map(({id, title}) => ({id, title}));
  const data = {schema: "echo.jlpt.inventory.v1", level, coverage: "assigned-band",
    vocabularySource: "words-data.js (JMdict, EDRDG, CC BY-SA 4.0; level credits in JLPT-EXPANSION-HANDOFF.md)",
    grammarSource: "grammar-data.js (Echo catalogue identifiers and titles)", vocabulary, grammar};
  const path = new URL("../datasets/jlpt/" + level.toLowerCase() + ".json", import.meta.url);
  writeFileSync(path, JSON.stringify(data, null, 1) + "\n");
}
