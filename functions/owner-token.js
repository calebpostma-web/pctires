/**
 * Cloudflare Pages Function helper: owner session tokens.
 *
 * Stateless, HMAC-signed tokens so any function can verify an owner session
 * without a shared store. The signing secret is the OWNER_PASSWORD env var —
 * it never appears in client code.
 *
 *   token = "<expiryMillis>.<base64url(HMAC-SHA256(expiryMillis, OWNER_PASSWORD))>"
 */

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // owner sessions last 30 days (convenience on your own devices)

function enc(s) { return new TextEncoder().encode(String(s)); }

function b64url(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc(message));
  return b64url(sig);
}

export async function signOwnerToken(env) {
  const secret = env.OWNER_PASSWORD;
  if (!secret) throw new Error('OWNER_PASSWORD not configured');
  const exp = String(Date.now() + TTL_MS);
  const sig = await hmac(exp, secret);
  return exp + '.' + sig;
}

export async function verifyOwnerToken(token, env) {
  try {
    const secret = env.OWNER_PASSWORD;
    if (!secret || !token) return false;
    const parts = String(token).split('.');
    if (parts.length !== 2) return false;
    const exp = parts[0], sig = parts[1];
    if (!/^\d+$/.test(exp)) return false;
    if (Date.now() > Number(exp)) return false;             // expired
    const expected = await hmac(exp, secret);
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;                                        // constant-time compare
  } catch (e) {
    return false;
  }
}

// Constant-time string comparison for the password check.
export function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
