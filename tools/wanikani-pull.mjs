// Pull your WaniKani subjects to a file, once, for reworking.
//
//   WANIKANI_TOKEN=... node tools/wanikani-pull.mjs
//
// The token comes from the environment, never an argument, so it stays out of
// shell history. The official API is used — not the site — one page at a
// time, with a pause between pages and a wait when asked to. Subsequent runs
// fetch only what changed since the last one.
//
// The output is data/wanikani/subjects.json, and that directory is ignored by
// git on purpose. This is the reference you rework from: WaniKani's stories
// and sentences, scrubbed with the app's own word list on the way in. It is
// yours to read and rewrite, and not something a public repository — whose
// Pages site hands its files to anyone — can carry. What you write from it is.
import {mkdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import {slimKanji, slimRadical, slimVocabulary, SCRUB_VERSION, SHAPE} from "../wanikani.js";

const API = "https://api.wanikani.com/v2/subjects";
const PAUSE_MS = 400;

export async function pull({token, out, fetch: doFetch = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), log = () => {}}) {
  if (!token) throw new Error("Set WANIKANI_TOKEN. A read-only personal access token is enough.");
  const file = out + "/subjects.json";
  const previous = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  // A word-list change makes the stored text stale, so the pull is full again.
  const since = previous?.meta?.scrubVersion === SCRUB_VERSION && previous?.meta?.shape === SHAPE ? previous.meta.updatedAfter : null;
  const kanji = new Map((since && previous?.kanji || []).map(k => [k.id, k]));
  const vocabulary = new Map((since && previous?.vocabulary || []).map(v => [v.id, v]));
  const radicals = new Map((since && previous?.radicals || []).map(r => [r.id, r]));

  let url = API + "?types=radical,kanji,vocabulary" + (since ? "&updated_after=" + encodeURIComponent(since) : "");
  const startedAt = new Date().toISOString();
  let page = 0, fetched = 0;
  while (url) {
    const response = await doFetch(url, {headers: {Authorization: "Bearer " + token, "Wanikani-Revision": "20170710"}});
    if (response.status === 429) {
      const wait = Number(response.headers?.get?.("Retry-After") || 60);
      log(`asked to wait ${wait}s`); await sleep(wait * 1000); continue;
    }
    if (response.status === 401) throw new Error("WaniKani did not accept that token.");
    if (!response.ok) throw new Error("WaniKani answered " + response.status + ".");
    const body = await response.json();
    for (const subject of body.data || []) {
      if (subject.object === "kanji") kanji.set(subject.id, slimKanji(subject));
      else if (subject.object === "vocabulary") vocabulary.set(subject.id, slimVocabulary(subject));
      else if (subject.object === "radical") radicals.set(subject.id, slimRadical(subject));
      fetched++;
    }
    page++;
    log(`page ${page}: ${fetched} of ${body.total_count ?? "?"}`);
    url = body.pages?.next_url || null;
    if (url) await sleep(PAUSE_MS);
  }
  const result = {
    meta: {pulledAt: startedAt, updatedAfter: startedAt, incremental: !!since, scrubVersion: SCRUB_VERSION, shape: SHAPE,
      kanji: kanji.size, vocabulary: vocabulary.size, radicals: radicals.size, source: "WaniKani API v2, personal use only"},
    radicals: [...radicals.values()].sort((a, b) => a.level - b.level || a.id - b.id),
    kanji: [...kanji.values()].sort((a, b) => a.level - b.level || a.id - b.id),
    vocabulary: [...vocabulary.values()].sort((a, b) => a.level - b.level || a.id - b.id),
  };
  mkdirSync(out, {recursive: true});
  writeFileSync(file, JSON.stringify(result, null, 1));
  return result.meta;
}

if (import.meta.url === new URL(process.argv[1], "file://").href || process.argv[1]?.endsWith("wanikani-pull.mjs")) {
  const out = new URL("../data/wanikani", import.meta.url).pathname;
  pull({token: process.env.WANIKANI_TOKEN, out, log: console.log})
    .then(meta => console.log(`data/wanikani/subjects.json: ${meta.kanji} kanji, ${meta.vocabulary} words${meta.incremental ? " (incremental)" : ""}`))
    .catch(error => { console.error(error.message); process.exit(1); });
}
