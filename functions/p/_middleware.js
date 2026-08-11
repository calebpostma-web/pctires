// /functions/p/_middleware.js — SUPERSEDED, intentionally a no-op.
//
// The per-SKU product page now lives at functions/product.js (/product?id=<id>).
// This file used to render it for /p/<id>, but a Cloudflare Pages directory that
// contains only a _middleware.js and no route file never gets routed — /p/<id>
// returned 404 in production while /used-tires (a top-level function) worked.
//
// It survives as a stub only because push-pctires.ps1 deploys via the GitHub
// Contents API and can add or update files but never delete them. Deleting the
// file locally would leave the old version live on GitHub forever; overwriting
// it with a pass-through neutralises it instead.
//
// next() hands the request to the asset server, which applies _redirects — so
// /p/<id> still ends up 301'd to /product?id=<id> either way.
//
// Safe to actually delete from the repo whenever the deploy path can express a
// deletion (a normal `git rm` + push).
export async function onRequest(context) {
  return context.next();
}
