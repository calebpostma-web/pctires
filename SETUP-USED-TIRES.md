# Used & Budget Tires page — one-time setup

Two new files: `used-tires.html` (the page) and `functions/used-tires.js` (the backend).
Same KV + password pattern as your /tech portal, so this is familiar.

## Step 1 — Deploy the files
```powershell
cd "C:\Users\Caleb\Documents\Claude\Projects\PCtires"
.\push-pctires.ps1
```
This pushes the page and the function. Cloudflare auto-builds in ~60-90 sec.

## Step 2 — One-time Cloudflare setup (Pages project: pctires)
Exactly the three things you did for /tech, with new names:

1. **Create the storage box (KV namespace)**
   Cloudflare dashboard → Storage & Databases → KV → **Create namespace**
   Name it: `PC_USED_TIRES`

2. **Attach it to the site (binding)**
   Workers & Pages → **pctires** → Settings → Bindings (Functions) → **Add → KV namespace**
   - Variable name: `USED_KV`
   - KV namespace: `PC_USED_TIRES`

3. **Set your owner password (env variable)**
   Workers & Pages → **pctires** → Settings → Variables and Secrets → **Add** (Production)
   - Name: `USED_PASSWORD`
   - Value: whatever password you want (you can make it a Secret)

4. **Redeploy** so the new binding + variable take effect:
   Deployments → latest → **Retry deployment** (or just run `.\push-pctires.ps1` again).

## Step 3 — Add your tires
Go to **pctires.ca/used-tires** → tap the small **·** at the end of the footer links → enter your `USED_PASSWORD`.
The Add form appears: Type (Used / Budget New), Size, Brand, Cost/tire, Qty, optional Tread + Notes → **Add Tire**.
It saves instantly and shows on the page right away. Edit / mark Sold / Delete from the same panel.
Your phone remembers the password for the session, so day-to-day it's: open page → tap · → add.

## Notes
- Until Step 2 is done, the page loads but shows no tires and the owner login will say the namespace/password isn't configured. That's expected.
- Sold tires are hidden from customers but stay in your owner list (Relist to bring back).
- Nothing here touches your main TDG catalogue or the Odessa farm/trailer pages.

## Optional next step (say the word)
Add a "Used & Budget Tires" link to the main site nav/footer and to sitemap.xml so customers and Google find it. I can deliver that as a small patch script.
