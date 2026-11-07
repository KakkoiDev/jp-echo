// Share an AI key inside an invite link, with no server. The same scheme as
// Minihongo's key-share.js (KakkoiDev/minihongo, site/static/key-share.js),
// with Echo's own associated data, so a link made for one app never opens in
// the other.
//
// The key is encrypted in the sender's browser and travels in the link's
// #fragment, which browsers never send to any server (not the site host, not
// analytics, not link-preview bots). The recipient's browser decrypts it with
// an unlock code that the sender passes on separately.
//
//   unlock code ──PBKDF2-SHA256 (600k rounds, random salt)──▶ AES-256 key
//   {provider, key, model?, speech?} ──AES-GCM (random IV)──▶ ciphertext
//   link: https://echo.kakkoi.dev/#key=v1.<salt>.<iv>.<ciphertext>  (base64url)
//
// The salt and IV are random per link and not secret. Everything depends on
// the unlock code staying out of the link. 12 Crockford base32 characters =
// 60 bits, which with 600k PBKDF2 rounds is far beyond offline guessing.
// Expiry lives inside the encrypted payload and is enforced by Echo only: it
// stops casual reuse, not a determined holder.

export const KEY_SHARE_VERSION = "v1";
const KEY_SHARE_ROUNDS = 600000;
const KEY_SHARE_AAD = new TextEncoder().encode("echo-ai-key-v1");
// Crockford base32: no I, L, O or U, so the code survives being read aloud.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const b64url = {
  encode(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(text) {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  },
};

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

async function deriveAesKey(code, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalizeUnlockCode(code)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name: "PBKDF2", hash: "SHA-256", salt, iterations: KEY_SHARE_ROUNDS},
    material,
    {name: "AES-GCM", length: 256},
    false,
    ["encrypt", "decrypt"],
  );
}

export class KeyShareError extends Error {
  constructor(code) { super(code); this.code = code; } // 'unsupported' | 'malformed' | 'wrong-code' | 'expired'
}

export const isSupported = () => !!((globalThis.isSecureContext ?? true) && globalThis.crypto?.subtle);

// payload: {provider?, key?, model?, speech?: {groq}}: an AI key, a Groq
// speech key, or both. days: a number, or 0 for no expiry.
// Returns {token, code}: the token goes after '#key=', the code is shown to the sender.
export async function sealKey(payload, days = 0, now = Date.now()) {
  if (!isSupported()) throw new KeyShareError("unsupported");
  const code = makeUnlockCode();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = {...payload, v: 1};
  if (days > 0) body.exp = now + days * 86400000;
  const aes = await deriveAesKey(code, salt);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv, additionalData: KEY_SHARE_AAD}, aes, new TextEncoder().encode(JSON.stringify(body))));
  const token = [KEY_SHARE_VERSION, salt, iv, sealed].map(part => (typeof part === "string" ? part : b64url.encode(part))).join(".");
  return {token, code};
}

export function readToken(hash = globalThis.location?.hash || "") {
  const match = String(hash).match(/[#&]key=([A-Za-z0-9._-]+)/);
  return match ? match[1] : null;
}

export async function openKey(token, code, now = Date.now()) {
  if (!isSupported()) throw new KeyShareError("unsupported");
  const parts = String(token).split(".");
  if (parts.length !== 4 || parts[0] !== KEY_SHARE_VERSION) throw new KeyShareError("malformed");
  let salt, iv, sealed;
  try { [salt, iv, sealed] = parts.slice(1).map(b64url.decode); }
  catch { throw new KeyShareError("malformed"); }
  let plain;
  try {
    const aes = await deriveAesKey(code, salt);
    plain = await crypto.subtle.decrypt({name: "AES-GCM", iv, additionalData: KEY_SHARE_AAD}, aes, sealed);
  } catch {
    // AES-GCM authenticates: a wrong code (or a tampered link) fails here.
    throw new KeyShareError("wrong-code");
  }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(plain)); }
  catch { throw new KeyShareError("malformed"); }
  const ai = !!(body?.provider && body?.key), speech = !!body?.speech?.groq;
  if (!ai && !speech) throw new KeyShareError("malformed");
  if (body.exp && now > body.exp) throw new KeyShareError("expired");
  return body;
}
