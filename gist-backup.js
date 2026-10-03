// Backup to a secret GitHub gist — the same shape as webmods/annotate's gist
// plugin: one stable file name, PATCH the remembered gist, POST a new secret
// gist when none is set, and a token that lives on this device only.
//
// Echo adds the automatic part: a change marks the library dirty, and a
// dirty library is uploaded once things go quiet, never more often than the
// minimum interval. Everything here is pure or takes its fetch as a
// parameter, so it is tested without a browser (test/gist-backup.test.js).

export const GIST_FILENAME = "echo-backup.json";
export const GIST_API = "https://api.github.com";
// Upload a couple of minutes after the last change, so a practice session of
// echoes (each one a save) becomes one upload instead of hundreds.
export const QUIET_MS = 2 * 60 * 1000;
// And never more often than this, however busy the session.
export const MIN_INTERVAL_MS = 5 * 60 * 1000;
export const TOKEN_HELP = "https://github.com/settings/personal-access-tokens/new";

// A gist id out of anything someone is likely to paste: the gist page with or
// without the owner, the API URL, or the bare id.
export function parseGistId(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;
  if (/^[0-9a-f]{20,}$/i.test(text)) return text;
  let url;
  try { url = new URL(text); } catch { return null; }
  const host = url.host.toLowerCase();
  if (host !== "gist.github.com" && host !== "api.github.com" && host !== "gist.githubusercontent.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // gist.githubusercontent.com/<owner>/<id>/raw/... carries the id second.
  const candidates = host === "gist.githubusercontent.com" ? [parts[1]] : [parts[parts.length - 1]];
  const id = candidates.find(part => part && /^[0-9a-f]{20,}$/i.test(part));
  return id || null;
}

// Decide whether an automatic upload should run now. `reason` is "change"
// (the quiet timer fired), "hidden" (the app is going to the background) or
// "open" (launch). A manual "Back up now" never asks this.
export function shouldAutoBackup({enabled, hasToken, dirty, lastAttemptAt = 0, lastChangeAt = 0, now = Date.now(), reason = "change"}) {
  if (!enabled || !hasToken || !dirty) return false;
  if (now - (Number(lastAttemptAt) || 0) < MIN_INTERVAL_MS) return false;
  // Leaving or opening the app is the moment to catch up; otherwise wait for quiet.
  if (reason === "hidden" || reason === "open") return true;
  return now - (Number(lastChangeAt) || 0) >= QUIET_MS;
}

function headers(token) {
  const out = {accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28"};
  if (token) out.authorization = "Bearer " + token;
  return out;
}

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

function failure(response, payload, id, verb) {
  const detail = payload?.message ? ": " + payload.message : "";
  if (response.status === 401) return new Error("GitHub rejected the token (401)" + detail);
  if (response.status === 403) return new Error("GitHub refused the request (403) — the token may lack Gists access, or the rate limit was hit" + detail);
  if (response.status === 404 && id) return new Error(`Gist not found, or the token cannot ${verb} it (404)` + detail);
  return new Error(`GitHub gist ${verb} failed (${response.status})` + detail);
}

// Upload the backup document. Updates `gist` when given, else creates a new
// secret gist (unlisted: not searchable, but readable by anyone with the URL).
export async function uploadBackup({token, gist, backup, fetchImpl = globalThis.fetch?.bind(globalThis)}) {
  if (!token) throw new Error("Add a GitHub token with Gists access first.");
  const id = parseGistId(gist);
  const sentences = Array.isArray(backup?.sentences) ? backup.sentences.length : 0;
  const body = {
    description: `Echo backup — ${sentences} sentence${sentences === 1 ? "" : "s"}`,
    files: {[GIST_FILENAME]: {content: JSON.stringify(backup)}},
  };
  if (!id) body.public = false;
  const response = await fetchImpl(id ? `${GIST_API}/gists/${id}` : `${GIST_API}/gists`, {
    method: id ? "PATCH" : "POST",
    headers: {...headers(token), "content-type": "application/json"},
    body: JSON.stringify(body),
  });
  const payload = await readJson(response);
  if (!response.ok) throw failure(response, payload, id, "update");
  if (!payload.id || !payload.html_url) throw new Error("GitHub returned no gist URL.");
  return {id: payload.id, url: payload.html_url, created: !id, sentences};
}

// Read the backup back. A token is optional: a secret gist is readable by URL.
// The API truncates files over about 1 MB, so a truncated file is read raw.
export async function downloadBackup({gist, token = "", fetchImpl = globalThis.fetch?.bind(globalThis)}) {
  const id = parseGistId(gist);
  if (!id) throw new Error("Paste the gist's URL or id.");
  const response = await fetchImpl(`${GIST_API}/gists/${id}`, {headers: headers(token)});
  const payload = await readJson(response);
  if (!response.ok) throw failure(response, payload, id, "read");
  const file = payload.files?.[GIST_FILENAME];
  if (!file) throw new Error(`That gist has no ${GIST_FILENAME}. Is it an Echo backup?`);
  let text = file.content;
  if (file.truncated || typeof text !== "string") {
    if (!file.raw_url) throw new Error("GitHub did not return the backup's contents.");
    const raw = await fetchImpl(file.raw_url);
    if (!raw.ok) throw new Error(`Could not download the backup file (${raw.status}).`);
    text = await raw.text();
  }
  try { return {backup: JSON.parse(text), url: payload.html_url || null, id}; }
  catch { throw new Error("The backup in that gist is not valid JSON."); }
}
