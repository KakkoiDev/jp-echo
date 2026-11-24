#!/usr/bin/env node
// Read the learner's flags and bug reports from their backup gist.
//   node tools/reports.mjs [gist-id] [--all] [--json]
// The gist id defaults to the newest gist whose description starts "Echo backup".
// Uses the gh CLI (already signed in); never prints tokens.
import {execFileSync} from "node:child_process";
const args = process.argv.slice(2), all = args.includes("--all"), asJson = args.includes("--json");
const gh = (...a) => execFileSync("gh", a, {encoding: "utf8", maxBuffer: 64 << 20});
let id = args.find(a => /^[0-9a-f]{20,}$/i.test(a));
if (!id) id = gh("gist", "list", "--limit", "100").split("\n").map(l => l.split("\t")).find(c => /^Echo backup/.test(c[1] || ""))?.[0];
if (!id) { console.error("No Echo backup gist found."); process.exit(1); }
const gist = JSON.parse(gh("api", "gists/" + id));
const file = gist.files?.["echo-reports.json"];
if (!file) { console.log("No reports in gist " + id + " yet."); process.exit(0); }
const text = file.truncated ? execFileSync("curl", ["-sL", file.raw_url], {encoding: "utf8"}) : file.content;
const reports = (JSON.parse(text).reports || []).filter(r => all || r.status === "open");
if (asJson) { console.log(JSON.stringify(reports, null, 2)); process.exit(0); }
console.log(reports.length + (all ? " reports" : " open reports") + " · gist " + id);
for (const r of reports) {
  console.log("\n— " + r.at + " · " + r.kind + " · " + r.status + " · " + (r.screen?.path || "") + " · " + (r.version || ""));
  if (r.subject) console.log("  about: " + [r.subject.type, r.subject.text, r.subject.reading && "(" + r.subject.reading + ")", r.subject.meaning].filter(Boolean).join(" "));
  if (r.reasons?.length) console.log("  reasons: " + r.reasons.join(", "));
  if (r.note) console.log("  note: " + r.note);
  if (r.subject?.extra && Object.keys(r.subject.extra).length) console.log("  context: " + JSON.stringify(r.subject.extra));
  console.log("  id: " + r.id);
}
