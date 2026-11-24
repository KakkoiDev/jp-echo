// Share an AI key inside an invite link, with no server. The mechanism is
// link-core (KakkoiDev/link-core, vendored as ./link-core.js; Minihongo uses
// the same library); this file holds only Echo's choices:
//
//   - the associated data is "echo-ai-key-v1", forever: every invite and
//     device link already sent was sealed with it, and a link sealed for
//     another app never opens here;
//   - "#key=…" is an invite (someone's AI keys), "#link=…" one of your own
//     devices (the gist sync's token and address, optionally your AI keys);
//   - a link must carry an AI key, a Groq speech key or the gist sync.
//
// The unlock code never goes into the link. Expiry is enforced by Echo only.
// See link-core's README for the threat model.
import {sealLink, openLink, readLinkToken, isLinkSupported, makeUnlockCode, normalizeUnlockCode, LinkError, LINK_VERSION} from "./link-core.js";

export const KEY_SHARE_VERSION = LINK_VERSION;
const APP = "echo-ai-key-v1";

export {makeUnlockCode, normalizeUnlockCode};
export const KeyShareError = LinkError; // .code: 'unsupported' | 'malformed' | 'wrong-code' | 'expired'
export const isSupported = isLinkSupported;

// What Echo can use: an AI key, a Groq speech key, the gist sync, or several.
const usable = body => !!(body?.provider && body?.key) || !!body?.speech?.groq || !!(body?.sync?.token && body?.sync?.gist);

// payload: {provider?, key?, model?, speech?: {groq}, sync?: {token, gist}}. days: a number, or 0 for no expiry.
// Returns {token, code}: the token goes after '#key=' or '#link=', the code is shown to the sender.
export const sealKey = (payload, days = 0, now = Date.now()) => sealLink(payload, {app: APP, days, now});

export const readToken = (hash = globalThis.location?.hash || "", name = "key") => readLinkToken(hash, name);

export const openKey = (token, code, now = Date.now()) => openLink(token, code, {app: APP, now, accept: usable});
