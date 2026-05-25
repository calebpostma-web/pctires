# Shareable Quote Links — Cloudflare Setup

One-time setup. After this you can build a cart, hit **⚡ Share as Quote →**, and text the link to a customer.

## Files involved

- `functions/quote.js` — Cloudflare Function handling POST (create) / GET (retrieve) / PATCH (mark paid)
- `_redirects` — Rewrites `/q/CODE` URLs to the SPA so the customer's browser can load the quote
- `index.html` — Owner UI (Share Quote button + modal) and customer-side quote loader

## What you need to do in the Cloudflare dashboard

### 1. Create the KV namespace

1. Cloudflare dashboard → **Workers & Pages** → **KV** (left sidebar)
2. **Create a namespace**
3. Name it `PC_TIRES_QUOTES`
4. Save

### 2. Bind it to the Pages project

1. Cloudflare dashboard → **Workers & Pages** → click on **pctires**
2. **Settings** → **Functions** (or **Bindings** depending on UI version) → **KV namespace bindings**
3. **Add binding**:
   - **Variable name**: `QUOTES_KV`  *(exactly this — the function looks for `env.QUOTES_KV`)*
   - **KV namespace**: `PC_TIRES_QUOTES`
4. Save and **Redeploy** the Pages project (the binding only takes effect on a fresh deploy)

### 3. (Optional) Set the OWNER_CODE env var

The function defaults to `pctowner2026` to match the client-side code on day one. If you ever change the client-side `OWNER_CODE`, also set this in Cloudflare:

1. **Settings** → **Environment variables** → **Production**
2. Add: `OWNER_CODE` = your current code
3. Save and redeploy

## How to test once it's live

1. Open pctires.ca in a private/incognito window
2. Click the member login icon → enter `pctowner2026` (or your owner code)
3. Add a couple of tires to the cart
4. Open the cart drawer — you should see a green **⚡ Share as Quote →** button below Checkout
5. Click it → enter a test name like "Test Customer" + a note → **Create Link →**
6. Copy the URL — should look like `https://pctires.ca/q/A4F7XYZ2`
7. Open that URL in another incognito window (as a customer)
8. You should see a yellow banner with your note + the cart loaded with the items you added
9. Proceed through checkout to confirm the full flow still works

## How the quote lifecycle works

| State | TTL | What customer sees |
|-------|-----|--------------------|
| `open` (created) | 30 days | Banner + pre-loaded cart, can check out |
| `paid` (after Stripe success) | 90 days from payment | "This quote has already been paid. Thank you!" |
| Expired | Deleted | "Quote link no longer valid" — they'll call you |

After a customer pays, the quote auto-locks so the same link can't be used to charge again. Caleb's existing Stripe Idempotency-Key plus this lock means three layers of double-charge protection.

## What's stored in each quote

- Item references only: `itemNumber`, `qty`, `install`, `itemType` per line
- Customer name + phone + note (your text)
- Created/paid timestamps
- Payment intent ID once paid

## Why no prices are stored

When the customer opens the link, the site fetches **live TDG data** for each item so they see the same prices as if they had searched themselves. Matches the rest of the site's behaviour. If TDG cost moves between quote creation and the customer opening the link, they see the current price — same as any other shopper. No surprise discrepancies between phone quote and live site.

## Customer View toggle

Separate feature shipped at the same time. When you're signed in as owner, you see TDG cost pricing by default — useful for ordering decisions, but awkward when a customer is looking over your shoulder.

A new **⚡ Cost View** button in the nav (only visible when signed in as owner) flips your display to **👁 Retail View** — the same prices the customer sees. Click again to flip back. State persists across page loads.

## What's NOT stored

- Card numbers (Stripe handles those)
- Sensitive customer info — only what you typed in
- Prices — always fetched live from TDG
