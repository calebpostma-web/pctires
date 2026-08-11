# -*- coding: utf-8 -*-
# Build Google Merchant Center TSV feed from feed-src.txt, validated against
# the live model-page data (tdg-data.txt) so feed price == landing page price.
import re

META = {
  'ingens-a1':            ('Antares','Ingens A1','antares-ingens-a1','All-Season'),
  'ingens-locus':         ('Antares','Ingens-Locus','antares-ingens-locus','Performance All-Season'),
  'ingens-ev':            ('Antares','Ingens EV','antares-ingens-ev','All-Season'),
  'comfort-a5':           ('Antares','Comfort A5','antares-comfort-a5','Touring All-Season'),
  'polymax-4s':           ('Antares','Polymax 4S','antares-polymax-4s','All-Weather'),
  'grip-60-ice':          ('Antares','Grip 60 Ice','antares-grip-60-ice','Winter'),
  'goliath-at':           ('Antares','Goliath AT','antares-goliath-at','All-Terrain'),
  'smt-a7':               ('Antares','SMT A7','antares-smt-a7','Highway All-Season'),
  'crossclimate2':        ('Michelin','CrossClimate2','michelin-crossclimate2','All-Weather'),
  'x-ice-snow':           ('Michelin','X-Ice Snow','michelin-x-ice-snow','Winter'),
  'pilot-sport-as-4':     ('Michelin','Pilot Sport All Season 4','michelin-pilot-sport-as-4','Performance All-Season'),
  'scorpion-as-plus-3':   ('Pirelli','Scorpion AS Plus 3','pirelli-scorpion-as-plus-3','Touring All-Season'),
  'scorpion-weatheractive':('Pirelli','Scorpion Weatheractive','pirelli-scorpion-weatheractive','All-Weather'),
  'dws06-plus':           ('Continental','ExtremeContact DWS06 Plus','continental-dws06-plus','Performance All-Season'),
  'weatherpeak':          ('Bridgestone','WeatherPeak','bridgestone-weatherpeak','All-Weather'),
  'blizzak-icepeak':      ('Bridgestone','Blizzak IcePeak','bridgestone-blizzak-icepeak','Winter'),
}

GPC = 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Tires'

def gtin_valid(g):
    if not g.isdigit() or len(g) not in (8, 12, 13, 14):
        return False
    digits = [int(c) for c in g]
    check = digits[-1]
    body = digits[:-1][::-1]
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(body))
    return (10 - total % 10) % 10 == check

# page price map: min price per (slug,size,load,speed) — replicates page dedupe
page_price = {}
for line in open('tdg-data.txt', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#'):
        if line.startswith('#'):
            cur = line[1:].split('|')[1]
        continue
    p = line.split('|')
    if len(p) != 5: continue
    k = (cur, p[0], p[1], p[2])
    pr = float(p[4])
    if k not in page_price or pr < page_price[k]:
        page_price[k] = pr

rows, dropped_price, dropped_gtin, dropped_missing, seen_ids = [], 0, 0, 0, set()
# feed-ids.txt lets generate.py point each model-page Buy button at the matching
# /p/<id> landing page. It is written here rather than in generate.py so that
# only rows which actually survived feed validation can ever be linked to.
feed_ids = []
for line in open('feed-src.txt', encoding='utf-8'):
    line = line.strip()
    if not line: continue
    slug, size, load, speed, qty, price, gtin, mpn, img = line.split('|')
    price = float(price)
    k = (slug, size, load, speed)
    if k not in page_price:
        dropped_missing += 1; continue
    if abs(page_price[k] - price) > 0.005:
        dropped_price += 1; continue
    if not gtin_valid(gtin):
        dropped_gtin += 1; print('BAD GTIN:', slug, size, gtin); continue
    brand, model, pageslug, season = META[slug]
    pid = slug + '-' + mpn.replace(' ', '')
    if pid in seen_ids: continue
    seen_ids.add(pid)
    disp_size = size[1:] if size.startswith('P') and size[1:4].isdigit() else size
    title = '%s %s %s %s%s %s Tire' % (brand, model, disp_size, load, speed, season)
    desc = ('%s %s %s tire, size %s, load index %s, speed rating %s. New tire with full manufacturer warranty. '
            'Sold by PC Tires in Chatham-Kent, Ontario with local installation for $25 per tire.') % (
            brand, model, season.lower(), disp_size, load, speed)
    # The landing page MUST be the per-SKU page, not the shared model page.
    # /product?id=<id> is served by functions/product.js, which reads this same feed
    # file -- so the price Google sees on the landing page is the price in this
    # row, by construction. Pointing `link` at the model page is what got the
    # account flagged for "user cannot complete purchase" + price mismatch
    # (Merchant Center, Aug 2026).
    link = 'https://pctires.ca/product?id=' + pid
    image = 'https://' + img.replace(' ', '%20')
    rows.append([pid, title, desc, link, image, 'in_stock', '%.2f CAD' % price, 'new', brand, gtin, mpn, GPC, 'Tires > ' + season])
    feed_ids.append('%s|%s|%s|%s|%s' % (slug, size, load, speed, pid))

header = ['id','title','description','link','image_link','availability','price','condition','brand','gtin','mpn','google_product_category','product_type']
with open('product-feed.txt', 'w', encoding='utf-8') as f:
    f.write('\t'.join(header) + '\n')
    for r in rows:
        assert all('\t' not in c and '\n' not in c for c in r)
        f.write('\t'.join(r) + '\n')

with open('feed-ids.txt', 'w', encoding='utf-8') as f:
    f.write('# slug|size|load|speed|feed-id  -- written by build-feed.py, read by generate.py\n')
    f.write('\n'.join(feed_ids) + '\n')

print('feed items: %d | dropped: price-mismatch %d, not-on-page %d, bad-gtin %d' % (len(rows), dropped_price, dropped_missing, dropped_gtin))
print('feed-ids.txt rows: %d' % len(feed_ids))
brands = {}
for r in rows: brands[r[8]] = brands.get(r[8], 0) + 1
print('by brand:', brands)
