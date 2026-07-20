/**
 * Cloudflare Pages Function: /functions/owner-auth.js
 *
 * Verifies the owner password against the OWNER_PASSWORD environment variable
 * (set in the Cloudflare dashboard — never in code) and, on success, returns a
 * short-lived signed session token. That token is what authorises no-charge
 * staff orders on send-order-email.js.
 *
 * Environment: OWNER_PASSWORD (secret, set in Cloudflare Pages → Settings).
 */

import { signOwnerToken, safeEqual } from './owner-token.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), { status: 400, headers: CORS });
  }

  const correct = env.OWNER_PASSWORD;
  if (!correct) {
    return new Response(JSON.stringify({ ok: false, error: 'Owner login not configured' }), { status: 500, headers: CORS });
  }

  if (!body || !safeEqual(body.password, correct)) {
    return new Response(JSON.stringify({ ok: false, error: 'Incorrect password' }), { status: 401, headers: CORS });
  }

  const token = await signOwnerToken(env);
  return new Response(JSON.stringify({ ok: true, token }), { status: 200, headers: CORS });
}
