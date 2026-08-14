// /functions/used-tires.js — 301 to /used. Do not add logic here.
//
// History: this route served the used/budget API, which was a bug — a Pages
// Function shadows the static asset on its path, so /used-tires returned
// {"ok":true,"tires":[]} instead of the page. The API moved to /used-stock
// (functions/used-stock.js), and the page then moved to /used, so this route
// is now purely a redirect.
//
// The file stays because push-pctires.ps1 can add and update but never delete;
// removing it locally would strand the old API version live on GitHub.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/used';
  return Response.redirect(url.toString(), 301);
}
