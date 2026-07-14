/**
 * Cloudflare Pages middleware for /q/* — quote share links.
 *
 * The site is a single-page app. Quote links (pctires.ca/q/CODE) used to work
 * only because Cloudflare served index.html for every unmatched URL (a soft-404).
 * Adding a real 404.html correctly returns 404 for junk URLs, but that also
 * caught /q/CODE and broke quotes.
 *
 * This middleware runs for any request under /q/ and serves the app's index.html
 * with a 200, so the SPA boots. The front-end then reads the /q/CODE path on load
 * and fetches the quote from /quote?code=CODE (see functions/quote.js).
 *
 * Scoped to /q/ only — all other routes are untouched.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/index.html';
  url.search = '';
  const asset = await context.env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
  return new Response(asset.body, {
    status: 200,
    headers: asset.headers,
  });
}
