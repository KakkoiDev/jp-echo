// Vendored from KakkoiDev/link-core v0.2.0 (commit 4551c013d417307efe46f69980391b54305556cf),
// link-core.js, verbatim below this header. Change it in link-core first and
// bring the copy over in the same change; Echo's own rules live in key-share.js.

// link-core: put a secret inside a link, with no server.
//
// A payload (an AI provider key, a speech key, sync credentials …) is
// encrypted in the sender's browser and travels in the link's #fragment,
// which browsers never send to any server (not the site host, not analytics,
// not link-preview bots). The recipient's browser decrypts it with an unlock
// code that the sender passes on separately.
//
//   unlock code ──PBKDF2-SHA256 (600k rounds, random salt)──▶ AES-256 key
//   {…payload, v: 1, exp?} ──deflate if shorter──AES-GCM (random IV, app as associated data)──▶ ciphertext
//   link: https://app.example/#key=v1.<salt>.<iv>.<ciphertext>   (base64url)
//
// The salt and IV are random per link and not secret. Everything depends on
// the unlock code staying out of the link. 12 Crockford base32 characters =
// 60 bits, which with 600k PBKDF2 rounds is far beyond offline guessing.
// The app name is bound as AES-GCM associated data, so a link sealed for one
// app never opens in another. Expiry lives inside the encrypted payload and
// is enforced by the opening app: it stops casual reuse, not a determined
// holder of the link and the code.
//
// The exact format, with test vectors, is SPEC.md.
// Zero dependencies; Web Crypto only (browsers in a secure context, Node 20+).

export const LINK_VERSION = "v1";
const ROUNDS = 600000;
// Crockford base32: no I, L, O or U, so the code survives being read aloud.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const DAY = 86400000;

export class LinkError extends Error {
  // code: 'unsupported' | 'malformed' | 'wrong-code' | 'expired'
  constructor(code) { super(code); this.name = "LinkError"; this.code = code; }
}

export const isLinkSupported = () => !!((globalThis.isSecureContext ?? true) && globalThis.crypto?.subtle);

const b64url = {
  encode(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(text) {
    if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("not base64url");
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  },
};

// 12 characters in three groups of four, e.g. "7K2M-QX9D-4HTB".
export function makeUnlockCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map(b => CODE_ALPHABET[b % 32]).join(""); // 256 % 32 == 0: unbiased
  return chars.match(/.{4}/g).join("-");
}

// Accept what people actually type: lower case, spaces, missing dashes, and
// the letters Crockford folds into digits (O→0, I/L→1).
export function normalizeUnlockCode(code) {
  return String(code).toUpperCase().replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0").replace(/[IL]/g, "1");
}

function associatedData(app) {
  if (typeof app !== "string" || !app) throw new TypeError("link-core: options.app must be a non-empty string");
  return new TextEncoder().encode(app);
}

async function deriveAesKey(code, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalizeUnlockCode(code)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name: "PBKDF2", hash: "SHA-256", salt, iterations: ROUNDS},
    material,
    {name: "AES-GCM", length: 256},
    false,
    ["encrypt", "decrypt"],
  );
}

// The plaintext's first byte says how the body is stored (SPEC.md):
// "{" (0x7B) is the JSON itself, as every v0.1 link has it; 0x00 is followed
// by the JSON compressed with deflate-raw. Old links open unchanged.
const PLAIN_JSON = 0x7b, PLAIN_DEFLATE = 0x00;
// An opened link never inflates past this: a link is a few hundred bytes.
const MAX_BODY = 65536;
const canCompress = () => typeof CompressionStream === "function";

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes) {
  if (typeof DecompressionStream !== "function") throw new LinkError("unsupported");
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY) throw new Error("too large");
      chunks.push(value);
    }
  } catch {
    reader.cancel().catch(() => {});
    throw new LinkError("malformed");
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

// payload: any JSON object. app: the associated data that binds the link to
// one app (keep it fixed; to rename, see openLink's previousApps).
// days: lifetime, or 0 for no expiry. compress: deflate the body first when
// that makes the link shorter (default) or never (false).
// Returns {token, code}: the token goes in the #fragment, the code is shown
// to the sender only.
export async function sealLink(payload, {app, days = 0, now = Date.now(), compress = true} = {}) {
  const aad = associatedData(app);
  if (!isLinkSupported()) throw new LinkError("unsupported");
  const code = makeUnlockCode();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = {...payload, v: 1};
  if (days > 0) body.exp = now + days * DAY;
  let plain = new TextEncoder().encode(JSON.stringify(body));
  if (compress && canCompress()) {
    const packed = await deflate(plain);
    if (packed.length + 1 < plain.length) plain = Uint8Array.of(PLAIN_DEFLATE, ...packed);
  }
  const aes = await deriveAesKey(code, salt);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv, additionalData: aad}, aes, plain));
  const token = [LINK_VERSION, ...[salt, iv, sealed].map(b64url.encode)].join(".");
  return {token, code};
}

const hasContent = body => Object.keys(body).some(key => key !== "v" && key !== "exp");

// Returns the payload as sealed, plus `v` and, if it expires, `exp` (ms).
// accept(body) → boolean lets the app refuse a well-formed link that carries
// nothing it can use ('malformed'); by default any non-empty payload passes.
// previousApps: ids the app was sealed under before a rename, tried after
// `app` (the slow key derivation runs once, so each costs almost nothing).
export async function openLink(token, code, {app, previousApps = [], now = Date.now(), accept = hasContent} = {}) {
  const bindings = [app, ...previousApps].map(associatedData);
  if (!isLinkSupported()) throw new LinkError("unsupported");
  const parts = String(token).split(".");
  if (parts.length !== 4 || parts[0] !== LINK_VERSION) throw new LinkError("malformed");
  let salt, iv, sealed;
  try { [salt, iv, sealed] = parts.slice(1).map(b64url.decode); }
  catch { throw new LinkError("malformed"); }
  let plain = null;
  try {
    const aes = await deriveAesKey(code, salt);
    for (const additionalData of bindings) {
      try { plain = new Uint8Array(await crypto.subtle.decrypt({name: "AES-GCM", iv, additionalData}, aes, sealed)); break; }
      catch { /* try the next binding */ }
    }
  } catch { /* key derivation failed */ }
  // AES-GCM authenticates: a wrong code, a tampered link, or a link sealed
  // for another app all fail here, and are indistinguishable by design.
  if (!plain) throw new LinkError("wrong-code");
  if (plain[0] === PLAIN_DEFLATE) plain = await inflate(plain.subarray(1));
  else if (plain[0] !== PLAIN_JSON) throw new LinkError("malformed");
  let body;
  try { body = JSON.parse(new TextDecoder().decode(plain)); }
  catch { throw new LinkError("malformed"); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !accept(body)) throw new LinkError("malformed");
  if (body.exp && now > body.exp) throw new LinkError("expired");
  return body;
}

// Finds `name=<token>` in a #fragment ("#key=…", "#tools&link=…").
// Different names keep different kinds of link apart (an invite is not a
// device link).
export function readLinkToken(hash = globalThis.location?.hash || "", name = "key") {
  const match = String(hash).match(new RegExp("[#&]" + name + "=([A-Za-z0-9._-]+)"));
  return match ? match[1] : null;
}

// Optional: once the link is opened (or refused), take the token out of the
// address bar and the current history entry, keeping any other #fragment
// parts. Returns true if something was removed.
export function forgetLinkToken(name = "key", {location = globalThis.location, history = globalThis.history} = {}) {
  if (!location || !history) return false;
  const hash = String(location.hash || "").replace(/^#/, "");
  const parts = hash.split("&").filter(Boolean);
  const kept = parts.filter(part => !part.startsWith(name + "="));
  if (kept.length === parts.length) return false;
  history.replaceState(history.state, "", location.pathname + location.search + (kept.length ? "#" + kept.join("&") : ""));
  return true;
}
