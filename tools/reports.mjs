#!/usr/bin/env node
// Read the learner's flags and bug reports from their backup gist.
//   node tools/reports.mjs [gist-id] [--all] [--json]
//   node tools/reports.mjs --html <report-id> > report.html   (rebuild the reported screen; save it in the repo root)
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
const htmlAt = args.indexOf("--html");
if (htmlAt >= 0) {
  const r = (JSON.parse(text).reports || []).find(x => x.id.startsWith(args[htmlAt + 1] || "-")), s = r?.snapshot;
  if (!s) { console.error("No snapshot on that report."); process.exit(1); }
  const [set, system] = String(s.theme).split("/"), theme = set === "light" || set === "dark" ? set : system || "light";
  console.log(`<!doctype html><html lang="en" data-theme="${theme}"${/off/.test(s.motion) ? ' class="motion-off"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!-- report ${r.id} · ${r.at} · ${r.version} · ${s.width}×${s.height} @${s.dpr} · theme ${s.theme} · motion ${s.motion} · scroll ${s.scroll} -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<link rel="stylesheet" href="./styles.css"><title>Report ${r.id.slice(0, 8)}</title></head>
<body class="n2" data-view="${s.view}" style="width:${s.width}px"><main id="n2-main">${s.html}</main></body></html>`);
  process.exit(0);
}
if (asJson) { console.log(JSON.stringify(reports, null, 2)); process.exit(0); }
console.log(reports.length + (all ? " reports" : " open reports") + " · gist " + id);
for (const r of reports) {
  console.log("\n— " + r.at + " · " + r.kind + " · " + r.status + " · " + (r.screen?.path || "") + " · " + (r.version || ""));
  if (r.subject) console.log("  about: " + [r.subject.type, r.subject.text, r.subject.reading && "(" + r.subject.reading + ")", r.subject.meaning].filter(Boolean).join(" "));
  if (r.reasons?.length) console.log("  reasons: " + r.reasons.join(", "));
  if (r.note) console.log("  note: " + r.note);
  if (r.subject?.extra && Object.keys(r.subject.extra).length) console.log("  context: " + JSON.stringify(r.subject.extra));
  if (r.snapshot) console.log("  snapshot: " + r.snapshot.width + "×" + r.snapshot.height + " (page " + (r.snapshot.page || "?") + ", scrolled " + r.snapshot.scroll + ") · theme " + r.snapshot.theme + " · motion " + r.snapshot.motion + " · " + (r.snapshot.html.length / 1000).toFixed(1) + " kB (--html " + r.id.slice(0, 8) + ")");
  console.log("  id: " + r.id);
}
