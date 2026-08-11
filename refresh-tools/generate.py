# -*- coding: utf-8 -*-
# PC Tires model landing page generator - 2026-07-06
# Reads tdg-data.txt (live TDG stock+prices pulled through the site's own
# pricing engine) and emits one static page per tire model.
import json, os, re

DATA = 'tdg-data.txt'
FEED_IDS_FILE = 'feed-ids.txt'
OUTDIR = 'pages'
CHECKED = 'August 1, 2026'
LASTMOD = '2026-08-01'

# ------------------------------------------------- per-SKU landing page IDs
# build-feed.py writes feed-ids.txt (slug|size|load|speed|feed-id) for every row
# that survived feed validation. Each Buy button below targets /p/<feed-id> when
# a match exists, so a Buy click lands on that one size at its exact feed price.
# RUN ORDER MATTERS: build-feed.py must run BEFORE generate.py. If feed-ids.txt
# is missing, every Buy button silently falls back to the old size-search link,
# which is what Merchant Center rejected -- so we make that loud instead.
FEED_IDS = {}
if os.path.exists(FEED_IDS_FILE):
    for line in open(FEED_IDS_FILE, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'): continue
        p = line.split('|')
        if len(p) != 5: continue
        FEED_IDS[(p[0], p[1], p[2], p[3])] = p[4]
    print('loaded %d feed ids from %s' % (len(FEED_IDS), FEED_IDS_FILE))
else:
    print('WARNING: %s not found -- run build-feed.py FIRST.' % FEED_IDS_FILE)
    print('         Buy buttons will fall back to /?buysize= links, which')
    print('         Google Merchant Center rejects as non-purchasable.')

# ---------------------------------------------------------------- parse data
models_data = {}
key = None
for line in open(DATA, encoding='utf-8'):
    line = line.strip()
    if not line: continue
    if line.startswith('#'):
        brand, mkey, season, service = line[1:].split('|')
        key = mkey
        models_data[key] = {'brand': brand, 'season': season, 'service': service, 'rows': []}
    else:
        p = line.split('|')
        if len(p) != 5: continue
        size, load, speed, qty, price = p[0], p[1], p[2], int(p[3]), float(p[4])
        if not load or not speed: continue  # skip malformed odd items
        models_data[key]['rows'].append({'size': size, 'load': load, 'speed': speed, 'qty': qty, 'price': price})

# dedupe: same size+load+speed -> keep lowest price, sum qty
for k, v in models_data.items():
    merged = {}
    for r in v['rows']:
        dk = (r['size'], r['load'], r['speed'])
        if dk in merged:
            merged[dk]['qty'] += r['qty']
            merged[dk]['price'] = min(merged[dk]['price'], r['price'])
        else:
            merged[dk] = dict(r)
    def rim_of(s):
        m = re.search(r'R(\d+)', s)
        return int(m.group(1)) if m else 0
    def width_of(s):
        m = re.match(r'P?(\d{3})/', s) or re.match(r'(\d+)x', s) or re.match(r'LT(\d{3})/', s)
        return float(m.group(1)) if m else 0
    v['rows'] = sorted(merged.values(), key=lambda r: (rim_of(r['size']), width_of(r['size']), r['size']))

# ---------------------------------------------------------------- model copy
M = {}

M['antares-ingens-locus'] = dict(
  brand='Antares', model='Ingens-Locus', cat='All-Season Performance',
  title='Antares Ingens-Locus Tires in Chatham-Kent | Sizes & Prices | PC Tires',
  desc='Antares Ingens-Locus in stock in Chatham-Kent: the successor to the Ingens A1, a budget performance all-season in 18-22 inch sizes. Live prices, $25/tire local install.',
  keywords='antares ingens locus, ingens locus review, ingens locus price, antares performance tires, budget performance tires chatham',
  sub="The Ingens-Locus is Antares' newer performance all-season - the tire that's replacing the Ingens A1 in sport sizes. If you priced an A1 and your size was gone, this is where it went. Same budget-brand pricing, one generation newer.",
  intro=["Antares is shifting its performance sizes from the long-running Ingens A1 over to the Ingens-Locus. It's an asymmetric-tread all-season aimed at the same job - a quiet, affordable performance tire for cars, and it covers the bigger fitments the A1 is selling out of: 18s through 22s, including staggered setups.",
         "Same honest positioning as everything Antares makes: it's a budget tire, not a Michelin Pilot. But if you need a W-rated performance size and don't want to spend $300 a corner, this is one of the cheapest legitimate ways to do it - new, warrantied, and it balances up clean like Antares tires generally do."],
  whofor=["<strong>Your Ingens A1 size is discontinued</strong> - the Locus is the direct successor and covers most of those sport sizes.",
          "<strong>You drive a sedan or sporty car on 18-22 inch wheels</strong> and want new rubber without premium money.",
          "<strong>Staggered fitments</strong> - the size list below covers wide rears like 275s through 305s that get expensive fast in premium brands."],
  faqs=[("Is the Ingens-Locus replacing the Ingens A1?",
         "That's the direction. Antares is moving its performance sizes to the Locus, and at our distributor the A1 is already sold out in several sport sizes while the Locus is stocked deep in them. The A1 is still widely available in everyday sizes."),
        ("Is the Antares Ingens-Locus any good?",
         "For a budget performance all-season, yes. It's new, warrantied, and covers big-rim sizes at less than half of premium pricing. It won't out-grip a premium performance tire - but against a worn set or a used tire, it's a clear upgrade. We've written an honest take on the whole brand in our Antares review."),
        ("What sizes does the Ingens-Locus come in?",
         "Mostly 18 to 22 inch performance fitments - the full list of what's in stock through our distributor is on this page, with live pricing. If your size isn't listed, call us; catalogue coverage changes."),
        ("Do you install Ingens-Locus tires in Chatham-Kent?",
         "Yes - we sell them online or by phone and install locally for $25 a tire in Pain Court, minutes from Chatham. Mounted, balanced, out the door.")],
  related=[('/antares-tires-review','Are Antares Tires Any Good? Honest Review'),
           ('/antares-ingens-a1','Antares Ingens A1 - Sizes & Prices'),
           ('/do-you-need-premium-tires','Do You Really Need Premium Tires?')])

M['antares-ingens-a1'] = dict(
  brand='Antares', model='Ingens A1', cat='All-Season',
  title='Antares Ingens A1 Tires in Chatham-Kent | Sizes & Prices | PC Tires',
  desc='Antares Ingens A1 all-season tires from about $78/tire in Chatham-Kent. Huge size range 13-19 inch, in stock now. Live prices and $25/tire local install at PC Tires.',
  keywords='antares ingens a1, ingens a1 price, ingens a1 review, cheap all season tires chatham, budget tires chatham-kent',
  sub="The Ingens A1 is the budget all-season we sell more of than almost anything else - a quiet, comfortable daily-driver tire that starts under $80. It covers more sizes than any other Antares model, from 13-inch econoboxes to 19-inch sedans.",
  intro=["If you need a safe, new, warrantied set on a daily driver without spending four figures, this is the tire that does it. The Ingens A1 balances up with hardly any weight - the mark of a consistently built tire - rides quiet, and carries Antares' treadwear warranty (45,000 miles on most passenger sizes).",
         "One thing to know: Antares is transitioning its performance sizes to the newer Ingens-Locus, so some sport fitments of the A1 are selling through their last stock. Everyday sizes - 15s, 16s, 17s - remain stocked deep. If your size shows low below, call us and we'll check the day's count or quote the Locus equivalent."],
  whofor=["<strong>Daily drivers and commuters</strong> around Chatham-Kent that need honest, safe rubber cheap.",
          "<strong>Second vehicles and budget builds</strong> where premium money doesn't make sense.",
          "<strong>Anyone choosing between used tires and new</strong> - a new A1 with full tread and a warranty beats a half-worn used set for not much more."],
  faqs=[("How much do Antares Ingens A1 tires cost?",
         "In-stock sizes on this page run from about $78 to $185 a tire depending on size, checked "+CHECKED+". Common sizes like 205/55R16 and 195/65R15 land around $90-$101. Install is $25 a tire on top, HST extra."),
        ("Is the Antares Ingens A1 discontinued?",
         "Not across the board. Antares is moving performance sizes to the newer Ingens-Locus, and some sport sizes are selling through. The everyday sizes most drivers need are still stocked in volume - our distributor shows thousands of units."),
        ("Are Antares Ingens A1 tires safe?",
         "Yes. New, traceable, warrantied tires that meet the standards and pass a safety no problem. Budget doesn't mean unsafe - it means you're not paying for premium performance you may not need."),
        ("Do you have my size in stock?",
         "The table on this page is live distributor stock as of "+CHECKED+". If your size isn't there or shows low, call 519-397-4686 - we can usually have alternatives priced in minutes.")],
  related=[('/antares-tires-review','Are Antares Tires Any Good? Honest Review'),
           ('/antares-ingens-locus','Antares Ingens-Locus - the A1’s successor'),
           ('/are-used-tires-safe','Are Used Tires Safe?')])

M['antares-comfort-a5'] = dict(
  brand='Antares', model='Comfort A5', cat='Touring All-Season',
  title='Antares Comfort A5 Tires in Chatham-Kent | Sizes & Prices | PC Tires',
  desc='Antares Comfort A5 touring all-season for CUVs and SUVs from about $130/tire in Chatham-Kent. In-stock sizes, live prices, $25/tire local install.',
  keywords='antares comfort a5, comfort a5 price, budget suv tires chatham, cheap cuv tires ontario',
  sub="The Comfort A5 is Antares' touring all-season for CUVs and SUVs - the quiet, comfortable option for the RAV4s, Escapes and Equinoxes that make up half the driveways in Chatham-Kent.",
  intro=["Where the Ingens line leans sporty, the Comfort A5 is built for exactly what the name says: a smooth, quiet highway ride in the 16-21 inch sizes crossovers actually wear. It's the budget answer to the touring tires the big brands charge $250+ for.",
         "Like the rest of the Antares lineup, they're new, warrantied (45,000 miles on most sizes), and they balance up easily - which is what keeps the steering wheel steady at 110 on the 401."],
  whofor=["<strong>CUV and SUV daily drivers</strong> - school runs, groceries, the occasional London trip.",
          "<strong>Replacing worn factory tires cheaply</strong> when the dealer quote made your eyes water.",
          "<strong>Higher-mileage vehicles</strong> where a $1,200 premium set doesn't match the vehicle's remaining life."],
  faqs=[("What vehicles does the Antares Comfort A5 fit?",
         "It's a crossover/SUV touring size range - things like 225/65R16, 215/65R17, 235/45R20. Check the in-stock table on this page for your size, or call and we'll look it up from your door-jamb sticker."),
        ("How much does the Comfort A5 cost?",
         "In-stock sizes run about $130-$190 a tire as of "+CHECKED+", plus $25/tire install and HST. That's typically half the price of a premium touring tire in the same size."),
        ("Is the Comfort A5 good in snow?",
         "It's an all-season, not an all-weather or winter tire. Fine for three seasons; for Chatham-Kent winters we'd point you to the Polymax 4S (all-weather, snowflake-rated) or a dedicated winter set."),
        ("Do you install locally?",
         "Yes - $25 a tire, mounted and balanced in Pain Court, minutes from Chatham.")],
  related=[('/antares-polymax-4s','Antares Polymax 4S - All-Weather'),
           ('/antares-tires-review','Are Antares Tires Any Good?'),
           ('/pirelli-scorpion-as-plus-3','Pirelli Scorpion AS Plus 3 - the premium comparison')])

M['antares-ingens-ev'] = dict(
  brand='Antares', model='Ingens EV', cat='EV All-Season',
  title='Antares Ingens EV Tires in Chatham-Kent | EV Tires | PC Tires',
  desc='Antares Ingens EV: budget EV-oriented all-season tires from about $90/tire in Chatham-Kent. Quiet, efficient, in stock. $25/tire local install at PC Tires.',
  keywords='antares ingens ev, ev tires chatham, budget ev tires, tesla tires cheap, electric car tires ontario',
  sub="EV replacement tires are notoriously expensive - EVs are heavy, torquey, and eat rubber. The Ingens EV is Antares' answer: an EV-oriented all-season at a fraction of what the marquee EV tires cost.",
  intro=["Electric vehicles chew through tires 20-30% faster than gas cars, and the OEM-fitment replacements are often $350+ a corner. That math hurts. The Ingens EV is built for the job - quiet (there's no engine noise to hide tire roar) and designed around EV weight - at budget-brand pricing.",
         "It also works fine on regular gas cars in these sizes; nothing about an EV tire is wasted on a Civic. If you want cheap, quiet rubber in a 15-18 inch size, it's a legitimate pick either way."],
  whofor=["<strong>EV owners tired of $1,400 tire bills</strong> - Bolts, Leafs, Model 3s, Konas in these sizes.",
          "<strong>Hybrid and gas drivers</strong> who want a quiet budget all-season in the same fitments.",
          "<strong>High-wear situations</strong> - if your EV eats tires, halving the price per set changes the math."],
  faqs=[("Do EVs really need special tires?",
         "They benefit from them. EVs are heavier and deliver instant torque, so they wear tires faster, and cabin quiet makes tire noise more noticeable. EV-oriented tires target load capacity, wear and noise. That said, any correctly sized and load-rated tire is safe to run."),
        ("Will the Ingens EV work on a gas car?",
         "Yes, no problem at all. It's an all-season tire in normal passenger sizes - the EV focus just means it's built quiet and wear-resistant, which benefits any car."),
        ("How much do Ingens EV tires cost?",
         "In-stock sizes run about $90-$148 a tire as of "+CHECKED+" - compare that to $300+ for the big-name EV fitments. Install $25/tire, HST extra."),
        ("What EV sizes do you stock?",
         "The live table on this page shows current distributor stock - popular fitments like 225/45R17 and 225/40R18 are usually deep. Call with your door-jamb size and we'll confirm same-day.")],
  related=[('/antares-tires-review','Are Antares Tires Any Good?'),
           ('/antares-ingens-a1','Antares Ingens A1 - Sizes & Prices'),
           ('/how-to-find-tire-size','How to Find Your Tire Size')])

M['antares-polymax-4s'] = dict(
  brand='Antares', model='Polymax 4S', cat='All-Weather',
  title='Antares Polymax 4S All-Weather Tires | Chatham-Kent | PC Tires',
  desc='Antares Polymax 4S: budget all-weather tires with the 3PMSF snowflake rating, from about $86/tire in Chatham-Kent. One set, year-round. $25/tire install.',
  keywords='antares polymax 4s, polymax 4s review, cheap all weather tires, 3pmsf budget tires, all weather tires chatham',
  sub="The Polymax 4S is the cheapest way in Chatham-Kent to get a snowflake-rated tire on your car - one set that's legal and capable year-round, starting under $90.",
  intro=["All-weather is the category most local drivers should actually be in: it carries the 3PMSF mountain-snowflake rating (real snow capability, not just \"M+S\" marketing), so you skip the seasonal swap entirely. The catch is that name-brand all-weathers run $250-350 a tire. The Polymax 4S does the job for a third of that.",
         "This is the tire we reach for most on car and CUV walk-ins. It's not a premium tire and doesn't pretend to be - but new, snowflake-rated, warrantied rubber at this price is the best value in the budget aisle."],
  whofor=["<strong>One-set-year-round drivers</strong> - no storage, no spring/fall changeover appointments.",
          "<strong>Budget-first buyers who still face real winter</strong> - it's snowflake-rated, unlike an all-season.",
          "<strong>Smaller cars especially</strong> - 14 and 15 inch sizes start around $86, so a full set installed lands near $450."],
  faqs=[("Is the Polymax 4S rated for winter?",
         "Yes - it carries the 3PMSF (three-peak mountain snowflake) rating, the same certification winter tires carry. For serious ice or deep-snow backroads a dedicated winter tire still wins, but as a year-round tire it's legal and capable for Ontario winters."),
        ("All-weather vs all-season - what's the difference?",
         "All-season is a summer-biased compromise that hardens in the cold; all-weather carries the snowflake rating and stays capable in winter. If you only own one set of tires in Chatham-Kent, all-weather is the smarter category. Full breakdown in our all-season vs winter guide."),
        ("How much does the Polymax 4S cost?",
         "In-stock sizes run about $86-$152 a tire as of "+CHECKED+", plus $25/tire install. A full set on a compact car typically lands around $450-500 out the door."),
        ("How long do they last?",
         "Most sizes carry Antares' 45,000-mile treadwear warranty. All-weather compounds wear a bit faster than pure all-seasons - that's the price of winter capability in any brand.")],
  related=[('/all-season-vs-winter-tires','All-Season vs Winter Tires'),
           ('/antares-tires-review','Are Antares Tires Any Good?'),
           ('/bridgestone-weatherpeak','Bridgestone WeatherPeak - the premium all-weather')])

M['antares-grip-60-ice'] = dict(
  brand='Antares', model='Grip 60 Ice', cat='Winter',
  title='Antares Grip 60 Ice Winter Tires | Chatham-Kent | PC Tires',
  desc='Antares Grip 60 Ice winter tires from about $92/tire in Chatham-Kent. Budget dedicated winters, car and truck sizes in stock. $25/tire local install.',
  keywords='antares grip 60 ice, cheap winter tires chatham, budget snow tires ontario, winter tires chatham-kent',
  sub="A dedicated winter tire doesn't have to cost $250 a corner. The Grip 60 Ice is the budget winter we put on cars, CUVs and even LT trucks - and buying in summer or early fall beats the November rush every time.",
  intro=["Dedicated winters beat all-weathers on ice and deep snow, full stop - softer compound, deeper siping, built for cold only. The Grip 60 Ice brings that to budget pricing, in everything from 14-inch car sizes to LT truck fitments and 21-inch SUV sizes.",
         "Two pieces of shop advice: first, buy early - winter sizes sell out by mid-November and nobody restocks until it's too late. Second, if you want studs, ask about the studded variant; we can quote both."],
  whofor=["<strong>Anyone keeping a second winter set</strong> on the budget plan - full set installed often under $550.",
          "<strong>Rural Chatham-Kent drivers</strong> - drifted concessions are exactly what dedicated winters are for.",
          "<strong>Trucks too</strong> - LT sizes in stock, which is rare at this price point."],
  faqs=[("Are budget winter tires worth it?",
         "A budget dedicated winter beats a premium all-season in snow and cold - the category matters more than the brand. If the choice is Grip 60 Ice or staying on all-seasons through January, the Grip 60 Ice wins on safety, easily."),
        ("How much does the Grip 60 Ice cost?",
         "In-stock sizes run about $92-$253 a tire as of "+CHECKED+" - common car sizes land near $92-$130. Install $25/tire. A compact-car winter set typically comes in under $550 installed."),
        ("When should I put winter tires on in Ontario?",
         "Rule of thumb: on when daytime highs stay below 7°C - usually mid-November around Chatham-Kent - and off in early April. Order earlier than that; stock is seasonal and the popular sizes go first."),
        ("Does insurance give a discount for winter tires?",
         "Most Ontario insurers offer a winter tire discount, typically around 5%. Ask your broker - it usually requires them on from roughly December to March.")],
  related=[('/all-season-vs-winter-tires','All-Season vs Winter Tires'),
           ('/best-winter-tires-2026','Best Winter Tires 2026'),
           ('/michelin-x-ice-snow','Michelin X-Ice Snow - the premium winter')])

M['antares-goliath-at'] = dict(
  brand='Antares', model='Goliath AT', cat='All-Terrain / Light Truck',
  title='Antares Goliath AT All-Terrain Tires | Chatham-Kent | PC Tires',
  desc='Antares Goliath AT all-terrain truck tires from about $185/tire in Chatham-Kent - LT sizes, 33s and 35s in stock. Snowflake-capable AT look for half the name-brand price.',
  keywords='antares goliath at, cheap all terrain tires, budget 35s, at tires chatham, truck tires chatham-kent',
  sub="An aggressive all-terrain that actually looks the part - 33s and 35s included - for roughly half of what the name-brand ATs cost. This is the truck tire we quote when the KO2 price makes a guy wince.",
  intro=["The Goliath AT covers real truck fitments: LT-metric E-loads, flotation sizes like 35x12.50R20, and P-metric SUV sizes. Farm lanes, job sites, gravel, and the school run - it's built for the mixed use most Chatham-Kent trucks actually see.",
         "Name-brand ATs in a 35 run $450-550 a corner. The Goliath does the look and the work at $275-305. On a work truck that's a $1,000 difference per set, and the truck neither knows nor cares."],
  whofor=["<strong>Work trucks</strong> - contractors, farm trucks, anything that eats tires on gravel and doesn't justify premium rubber.",
          "<strong>The lifted-truck look on a budget</strong> - 33s and 35s in stock at half the usual money.",
          "<strong>Mixed highway/field use</strong> - E-load LT sizes with real load capacity for trailers and tools."],
  faqs=[("How much are Antares Goliath AT tires?",
         "In-stock sizes run about $185-$305 a tire as of "+CHECKED+". A set of 35x12.50R20s lands around $1,220 plus install - versus $1,800-2,200 for the big names."),
        ("Are they rated for snow?",
         "The Goliath AT is classified all-weather in our distributor's catalogue and handles Chatham-Kent winters the way most ATs do - well in snow, adequate on ice. For heavy winter highway miles, a dedicated winter is still the better tool."),
        ("Do you have E-load / LT sizes?",
         "Yes - LT245s through LT285s in D and E load ranges are in stock, plus flotation 33s and 35s. Check the table on this page or call for your exact fitment."),
        ("What's the install cost on truck tires?",
         "Installation is $25 a tire at our Pain Court shop. Larger and LT sizes are the same flat local install - mounted, balanced, torqued to spec.")],
  related=[('/farm-tires','Farm & Ag Tires'),
           ('/antares-smt-a7','Antares SMT A7 - Highway Truck Tire'),
           ('/antares-tires-review','Are Antares Tires Any Good?')])

M['antares-smt-a7'] = dict(
  brand='Antares', model='SMT A7', cat='Highway All-Season / Light Truck',
  title='Antares SMT A7 Truck & SUV Tires | Chatham-Kent | PC Tires',
  desc='Antares SMT A7 highway all-season for trucks and SUVs from about $137/tire in Chatham-Kent. P-metric and LT sizes in stock, $25/tire local install.',
  keywords='antares smt a7, cheap truck tires, highway tires chatham, budget suv truck tires ontario',
  sub="The SMT A7 is the highway tire for trucks and SUVs that never leave pavement - smoother and quieter than an AT, cheaper to run, and easier on fuel.",
  intro=["Most pickups around here never see worse than a gravel driveway - and an aggressive AT is the wrong tool for that truck. The SMT A7 is the highway-tread answer: quieter, longer-wearing, and cheaper than any comparable name-brand highway tire.",
         "Coverage runs from P-metric SUV sizes up through LT E-loads, so it fits everything from an Explorer to a 3/4-ton work truck that lives on the 401."],
  whofor=["<strong>Pavement-only pickups and SUVs</strong> - the sensible tire for how the truck is actually used.",
          "<strong>Highway commuters</strong> - quieter and smoother than an AT at half the rolling resistance drama.",
          "<strong>Fleet and work vehicles</strong> - LT sizes at budget prices keep per-vehicle costs down."],
  faqs=[("What's the difference between the SMT A7 and Goliath AT?",
         "Tread pattern and purpose. The Goliath AT is the aggressive all-terrain for mixed surfaces; the SMT A7 is a highway tread - quieter, smoother, and typically longer-wearing on pavement. If the truck stays on the road, the A7 is the better (and cheaper) tool."),
        ("How much does the SMT A7 cost?",
         "In-stock sizes run about $137-$226 a tire as of "+CHECKED+", plus $25/tire install. That's roughly half of premium highway-tire pricing in the same sizes."),
        ("Does it come in LT / E-load sizes?",
         "Yes - LT225/75R16 through LT285/75R16 E-loads are stocked alongside the P-metric SUV sizes. Full list in the table on this page."),
        ("Is it good in winter?",
         "It's an all-season highway tire - fine for three seasons. For winter, pair the truck with the Grip 60 Ice or run an all-weather like the Goliath AT.")],
  related=[('/antares-goliath-at','Antares Goliath AT - All-Terrain'),
           ('/antares-tires-review','Are Antares Tires Any Good?'),
           ('/tire-terms-explained','Tire Terms Explained')])

M['michelin-crossclimate2'] = dict(
  brand='Michelin', model='CrossClimate2', cat='All-Weather',
  title='Michelin CrossClimate2 Tires in Chatham-Kent | Prices | PC Tires',
  desc='Michelin CrossClimate2 all-weather tires in Chatham-Kent from about $232/tire - 3PMSF snowflake rated, one set year-round. 80+ sizes in stock, $25/tire install.',
  keywords='michelin crossclimate2, crossclimate 2 price canada, crossclimate2 chatham, best all weather tire, michelin tires chatham-kent',
  sub="The CrossClimate2 is the tire we recommend when someone says \"just give me the best one-set-year-round tire and I'll pay for it.\" Snowflake-rated, famously long-wearing, and consistently at the top of every all-weather test that matters.",
  intro=["Michelin built the CrossClimate2 to end the two-sets-of-tires routine: it carries the 3PMSF winter rating in a tire you run twelve months a year, with the V-shaped directional tread that made this line famous. It brakes like a proper all-season in the dry and keeps working when the snow flies.",
         "It's premium money - but the cost-per-kilometre story is real. These wear long enough that many drivers replace them on age rather than tread. With 80+ sizes in stock from cars to CUVs to LT truck fitments, odds are we have yours."],
  whofor=["<strong>One-set drivers who want the best</strong> - no changeovers, no storage, no compromise on winter capability.",
          "<strong>High-mileage commuters</strong> - the treadwear reputation makes the premium price math work.",
          "<strong>Family vehicles</strong> where winter braking distance is the number that matters most."],
  faqs=[("Is the CrossClimate2 good enough for Ontario winters?",
         "For most drivers, yes - it's 3PMSF snowflake-rated and among the best all-weathers in snow braking. If you do heavy rural winter driving or ice is your main worry, a dedicated winter like the X-Ice Snow still wins; for everything else the CC2 is the do-it-all answer."),
        ("How much does the CrossClimate2 cost in Canada?",
         "In our in-stock sizes it runs about $232-$688 a tire as of "+CHECKED+" depending on size - a 205/55R16 is around $232, common CUV sizes in the $300s. Install $25/tire at our shop."),
        ("CrossClimate2 vs winter tires - which should I buy?",
         "If you'll actually keep a second set and swap seasonally, dedicated winters + summer/all-seasons still perform best. If you know you won't, the CrossClimate2 is the strongest single-set compromise on the market."),
        ("Do you stock CrossClimate2 in Chatham-Kent?",
         "Yes - the table on this page is live distributor stock, usually 80+ sizes including CUV and LT fitments. Order online or call, installed for $25 a tire in Pain Court.")],
  related=[('/all-season-vs-winter-tires','All-Season vs Winter Tires'),
           ('/bridgestone-weatherpeak','Bridgestone WeatherPeak - all-weather alternative'),
           ('/do-you-need-premium-tires','Do You Really Need Premium Tires?')])

M['michelin-x-ice-snow'] = dict(
  brand='Michelin', model='X-Ice Snow', cat='Winter',
  title='Michelin X-Ice Snow Winter Tires | Chatham-Kent | PC Tires',
  desc='Michelin X-Ice Snow winter tires in Chatham-Kent from about $178/tire - 100+ sizes in stock. The premium studless winter benchmark. $25/tire local install.',
  keywords='michelin x-ice snow, x ice snow price, winter tires chatham, best winter tires ontario, michelin winter tires',
  sub="The X-Ice Snow is the studless winter benchmark - the tire the others get compared to on ice braking. If winter performance is the whole point, this is the top of the ladder.",
  intro=["Michelin's flagship winter uses its EverWinterGrip compound and full-depth siping to keep ice grip alive deep into the tire's life - the common winter-tire failure is going \"off\" after two seasons, and this one is engineered specifically against that.",
         "We stock over 100 sizes of it - cars, CUVs, SUVs, trucks. Winter tip from the shop: buy in summer or early fall. Come mid-November the popular sizes are gone province-wide and nobody restocks until spring."],
  whofor=["<strong>Ice-first buyers</strong> - freezing rain, polished intersections, the morning commute on glare ice.",
          "<strong>Keeping the car 4+ winters</strong> - the grip-longevity engineering pays off across seasons.",
          "<strong>Highway winter drivers</strong> - stable and quiet at speed in a way budget winters aren't."],
  faqs=[("How much do X-Ice Snow tires cost?",
         "Our in-stock sizes run about $178-$597 a tire as of "+CHECKED+" - a 205/55R16 lands around $224, common CUV sizes near $270-300. Install $25/tire, HST extra."),
        ("X-Ice Snow vs Blizzak - which is better?",
         "Both are top-tier. The X-Ice Snow's edge is ice grip retention over multiple seasons; Blizzaks are famous for first-season ice bite. You won't go wrong either way - we stock both, so we can price both in your size."),
        ("Is a premium winter tire worth it over a budget one?",
         "On ice, yes - premium studless winters brake measurably shorter. If your winter driving is mostly plowed town streets, a budget winter like the Grip 60 Ice covers you; if you do dark rural highways all winter, this is where the money goes."),
        ("When do winter tires sell out?",
         "Popular sizes get scarce by mid-November in Ontario. Order in summer or early fall - we'll install at $25 a tire whenever you're ready to swap.")],
  related=[('/best-winter-tires-2026','Best Winter Tires 2026'),
           ('/bridgestone-blizzak-icepeak','Bridgestone Blizzak IcePeak'),
           ('/antares-grip-60-ice','Antares Grip 60 Ice - budget winter')])

M['michelin-pilot-sport-as-4'] = dict(
  brand='Michelin', model='Pilot Sport All Season 4', cat='Ultra-High-Performance All-Season',
  title='Michelin Pilot Sport All Season 4 | Chatham-Kent | PC Tires',
  desc='Michelin Pilot Sport All Season 4 in Chatham-Kent from about $237/tire - 100+ UHP sizes in stock, Y-rated. The benchmark performance all-season. $25/tire install.',
  keywords='michelin pilot sport all season 4, pilot sport as4 price, performance tires chatham, uhp all season ontario',
  sub="The Pilot Sport All Season 4 is what you put on a performance car you actually drive year-round in Canada (minus the deep winter months). Y-rated grip with all-season manners - the UHP all-season the others chase.",
  intro=["Mustangs, M-cars, Stingers, quick sedans - anything with power deserves rubber that can use it. The PS AS4 brings Pilot Sport dry/wet grip to an all-season compound, in staggered and wide fitments up to 335s and 23-inch wheels.",
         "We stock over 100 sizes. Fair warning from the shop: this is not a winter tire - Y-rated performance compounds and January don't mix. Pair it with a winter set or look at an all-weather instead."],
  whofor=["<strong>Performance cars driven three seasons</strong> - the grip is real and the sizes go wide.",
          "<strong>Staggered fitments</strong> - matching front/rear sizes in stock, which saves the cross-border hunt.",
          "<strong>Daily-driven fast cars</strong> that need one civilized tire from March to November."],
  faqs=[("How much does the Pilot Sport All Season 4 cost?",
         "In-stock sizes run about $237-$743 a tire as of "+CHECKED+" - common 17-18 inch sizes land in the $250-290 range, big staggered 20s and 21s climb from there. Install $25/tire."),
        ("Can I drive the Pilot Sport AS4 in winter?",
         "It's an all-season, so it's legal - but a UHP compound is not what you want on ice at -15°C. Our honest advice: winter set from December to March, PS AS4 the rest of the year."),
        ("Do you stock staggered sizes?",
         "Yes - the in-stock table on this page includes wide rears (275s through 335s). If your combo isn't listed, call; the catalogue runs deeper than any one day's stock."),
        ("Is it worth it over a cheaper performance tire?",
         "If you use the performance, yes - braking and wet grip are where premium UHP earns its price. If the car is more show than go, the Antares Ingens-Locus covers big-rim sizes for a third of the money.")],
  related=[('/antares-ingens-locus','Antares Ingens-Locus - budget performance alternative'),
           ('/continental-dws06-plus','Continental DWS06 Plus'),
           ('/do-you-need-premium-tires','Do You Really Need Premium Tires?')])

M['pirelli-scorpion-as-plus-3'] = dict(
  brand='Pirelli', model='Scorpion AS Plus 3', cat='SUV/CUV Touring All-Season',
  title='Pirelli Scorpion AS Plus 3 Tires | Chatham-Kent | PC Tires',
  desc='Pirelli Scorpion AS Plus 3 in Chatham-Kent from about $203/tire - the long-wearing premium touring all-season for SUVs and CUVs. 30 sizes in stock, $25/tire install.',
  keywords='pirelli scorpion as plus 3, scorpion as plus 3 price, suv touring tires chatham, pirelli tires chatham-kent',
  sub="The Scorpion AS Plus 3 is Pirelli's long-haul touring tire for SUVs and CUVs - quiet, comfortable, and built to outlast the loan on the vehicle. One of the most-ordered premium tires at our shop.",
  intro=["This is the premium touring pick for the CR-Vs, RAV4s, Explorers and pickups that rack up real highway kilometres. It's engineered for exactly the things daily drivers actually notice: road noise, ride comfort, wet braking, and tread life - and it's earned its reputation on all four.",
         "We sell a lot of these, and they go on smooth and balance clean. In the premium SUV touring class it consistently prices a step under the equivalent Michelin while giving up very little."],
  whofor=["<strong>Highway-commuting SUVs and CUVs</strong> - Chatham to London/Windsor daily? This is the wear-life play.",
          "<strong>Comfort-first drivers</strong> - it's one of the quietest tires in its class.",
          "<strong>Half-ton trucks on pavement</strong> - 20 and 22 inch fitments in stock."],
  faqs=[("How much does the Scorpion AS Plus 3 cost?",
         "In-stock sizes run about $203-$349 a tire as of "+CHECKED+" - the popular 225/65R17 is around $203, most CUV sizes in the $230-270 range. Install $25/tire, HST extra."),
        ("Scorpion AS Plus 3 vs CrossClimate2?",
         "Different jobs. The Scorpion is a touring all-season - longer wear, quieter, but no snowflake rating. The CrossClimate2 is all-weather - winter-rated, slightly shorter wear. One set year-round? CC2. Winter set in the garage? The Scorpion is the better summer-side tire."),
        ("Is it good in snow?",
         "It's a capable all-season in light snow, but it carries no 3PMSF rating. For Chatham-Kent winters, pair it with dedicated winters or choose an all-weather instead."),
        ("Do you have my size?",
         "The table on this page shows live distributor stock - about 30 sizes, 17 to 22 inch. If yours isn't there, call 519-397-4686 and we'll check the wider catalogue.")],
  related=[('/pirelli-scorpion-weatheractive','Pirelli Scorpion Weatheractive - all-weather version'),
           ('/michelin-crossclimate2','Michelin CrossClimate2'),
           ('/antares-comfort-a5','Antares Comfort A5 - budget alternative')])

M['pirelli-scorpion-weatheractive'] = dict(
  brand='Pirelli', model='Scorpion Weatheractive', cat='All-Weather',
  title='Pirelli Scorpion Weatheractive Tires | Chatham-Kent | PC Tires',
  desc='Pirelli Scorpion Weatheractive all-weather tires in Chatham-Kent from about $217/tire - 3PMSF snowflake rated for year-round Ontario driving. $25/tire install.',
  keywords='pirelli scorpion weatheractive, weatheractive price, all weather suv tires, pirelli all weather chatham',
  sub="The Scorpion Weatheractive is Pirelli's snowflake-rated all-weather for SUVs and CUVs - the one-set answer for crossover drivers who want premium manners and real winter capability without the seasonal swap.",
  intro=["Take the Scorpion touring platform, give it a 3PMSF-rated compound and tread, and you get a tire that handles a Chatham-Kent January without pretending to be a dedicated winter. It's the direct competitor to the CrossClimate2 in the CUV/SUV sizes, typically a notch under it on price.",
         "We've shipped plenty of these to local driveways - it's a popular pick for exactly the vehicle this region runs on: the do-everything crossover that never gets a second set of tires."],
  whofor=["<strong>Crossover owners skipping the winter swap</strong> - snowflake-rated, so you're covered legally and practically.",
          "<strong>Premium buyers comparing against the CC2</strong> - similar mission, often $30-60 less per tire.",
          "<strong>Wet-road commuters</strong> - the Scorpion line's wet braking is a consistent strong suit."],
  faqs=[("Is the Scorpion Weatheractive winter-rated?",
         "Yes - it carries the 3PMSF mountain-snowflake rating, so it's certified for severe snow service and qualifies for most insurers' winter tire discounts when run year-round."),
        ("How much does it cost?",
         "In-stock sizes run about $217-$369 a tire as of "+CHECKED+" - the common 225/65R17 is around $217, most CUV sizes $240-300. Install $25/tire at the shop."),
        ("Weatheractive vs CrossClimate2 - which one?",
         "Both are excellent all-weathers. The CC2 has the edge in independent snow-braking tests; the Weatheractive typically costs less and rides a touch softer. In sizes where both are stocked we'll quote both - the right answer is often whichever is in stock in your size."),
        ("Will it wear out faster than a regular all-season?",
         "Slightly - that's true of every all-weather; winter-capable compounds trade a bit of tread life. Most drivers find the no-swap convenience more than pays for it.")],
  related=[('/michelin-crossclimate2','Michelin CrossClimate2'),
           ('/pirelli-scorpion-as-plus-3','Scorpion AS Plus 3 - touring version'),
           ('/all-season-vs-winter-tires','All-Season vs Winter Tires')])

M['continental-dws06-plus'] = dict(
  brand='Continental', model='ExtremeContact DWS06 Plus', cat='Ultra-High-Performance All-Season',
  title='Continental DWS06 Plus Tires | Chatham-Kent | PC Tires',
  desc='Continental ExtremeContact DWS06 Plus in Chatham-Kent from about $228/tire - the UHP all-season that actually works in light snow. 88 sizes in stock, $25/tire install.',
  keywords='continental dws06 plus, dws06 plus price, extremecontact dws06, performance all season chatham, continental tires chatham-kent',
  sub="DWS stands for Dry, Wet, Snow - and the DWS06 Plus is the rare performance all-season that means the third letter. It's the UHP tire we suggest when a performance-car owner admits the car sees November.",
  intro=["Continental's ExtremeContact DWS06 Plus is the benchmark for performance all-seasons that stay useful when the weather turns - consistently the best of the UHP class in cold and light snow, while giving up little to the Pilot Sport AS4 in the dry.",
         "The size range is enormous - 16s to 22s, wide staggered fitments, nearly 90 sizes in stock. Neat party trick: the tread has D-W-S letters molded in that wear away to tell you when the tire's no longer rated for snow, then wet."],
  whofor=["<strong>Performance cars driven deep into fall</strong> - the strongest cold-weather manners in the UHP class.",
          "<strong>AWD sports sedans</strong> - the classic DWS06 use case, from WRXs to Chargers.",
          "<strong>Staggered and wide fitments</strong> - 88 sizes in stock including 305s and 335s."],
  faqs=[("How much does the DWS06 Plus cost?",
         "In-stock sizes run about $228-$587 a tire as of "+CHECKED+" - common 17-18 inch sizes land around $240-290. Install $25/tire, HST extra."),
        ("DWS06 Plus vs Pilot Sport AS4?",
         "The Michelin edges it on outright dry grip; the Continental wins in cold and light snow and usually costs a bit less. If the car parks all winter, lean AS4. If it sees the shoulder seasons hard, lean DWS06 Plus."),
        ("Can it handle Ontario winter?",
         "Light snow, yes - genuinely better than other UHP all-seasons. But it has no 3PMSF rating, and it's not a winter tire. December to March on a performance car still means a proper winter set."),
        ("What do the D-W-S letters in the tread mean?",
         "They're wear indicators. All three visible = rated for dry, wet and snow. When the S wears away, it's a dry/wet tire only; when the W goes, it's time to replace. Simple and honest - we wish every tire did it.")],
  related=[('/michelin-pilot-sport-as-4','Michelin Pilot Sport All Season 4'),
           ('/antares-ingens-locus','Antares Ingens-Locus - budget performance'),
           ('/tire-terms-explained','Tire Terms Explained')])

M['bridgestone-weatherpeak'] = dict(
  brand='Bridgestone', model='WeatherPeak', cat='All-Weather',
  title='Bridgestone WeatherPeak Tires | Chatham-Kent | PC Tires',
  desc='Bridgestone WeatherPeak all-weather tires in Chatham-Kent from about $174/tire - 3PMSF rated, Blizzak winter know-how in a year-round tire. $25/tire install.',
  keywords='bridgestone weatherpeak, weatherpeak price, all weather tires chatham, bridgestone tires chatham-kent',
  sub="The WeatherPeak is Bridgestone's all-weather - Blizzak winter DNA folded into a tire you run all year. It's the value pick of the premium all-weather class, with car sizes starting around $174.",
  intro=["Bridgestone knows winter - the Blizzak name has owned Canadian winters for decades - and the WeatherPeak is that expertise applied to the no-swap, one-set category. 3PMSF snowflake rating, quiet touring ride, and strong wet grip.",
         "Where it stands out is price: it typically comes in under the CrossClimate2 and Weatheractive in matching sizes, which makes it the premium all-weather for people who flinched at the other two quotes. Car sizes from 15-inch up through 20-inch CUV fitments."],
  whofor=["<strong>Sedan and small-car drivers</strong> - true car sizes (185/60R15 up) that some all-weathers skip.",
          "<strong>Budget-conscious premium buyers</strong> - snowflake rating and a big-brand warranty for less.",
          "<strong>One-set households</strong> - no changeover, no storage, insured winter-discount eligible."],
  faqs=[("Is the WeatherPeak snowflake-rated?",
         "Yes - full 3PMSF certification, so it's rated for severe snow service and generally qualifies for Ontario insurers' winter-tire discounts."),
        ("How much does the WeatherPeak cost?",
         "In-stock sizes run about $174-$330 a tire as of "+CHECKED+" - a 205/55R16 is around $209, most CUV sizes in the $230-280 range. Install $25/tire."),
        ("WeatherPeak vs CrossClimate2?",
         "The CC2 tests a bit stronger in snow braking and wears famously long; the WeatherPeak is quieter than you'd expect, very close in most conditions, and usually meaningfully cheaper. In a tight budget-vs-best decision, we'll quote both in your size."),
        ("How does it compare to a Blizzak in winter?",
         "A dedicated Blizzak still wins in deep snow and on ice - that's the trade of any all-weather. The WeatherPeak's pitch is being 85% of the way there without owning two sets of tires.")],
  related=[('/michelin-crossclimate2','Michelin CrossClimate2'),
           ('/antares-polymax-4s','Antares Polymax 4S - budget all-weather'),
           ('/bridgestone-blizzak-icepeak','Bridgestone Blizzak IcePeak - dedicated winter')])

M['bridgestone-blizzak-icepeak'] = dict(
  brand='Bridgestone', model='Blizzak IcePeak', cat='Winter',
  title='Bridgestone Blizzak IcePeak Winter Tires | Chatham-Kent | PC Tires',
  desc='Bridgestone Blizzak IcePeak winter tires in Chatham-Kent from about $181/tire - the newest Blizzak, 38 sizes in stock. Order early, install $25/tire locally.',
  keywords='blizzak icepeak, bridgestone blizzak price, winter tires chatham, blizzak chatham-kent, best winter tires',
  sub="Blizzak is the winter tire name in Canada, and the IcePeak is the newest generation of it - the ice-first studless winter for cars, CUVs and trucks, with deep stock in the sizes Chatham-Kent actually drives.",
  intro=["When someone walks in and just says \"put winters on it,\" Blizzak is usually the name they already know. The IcePeak is Bridgestone's current studless line: multicell compound that bites ice, deep siping for snow, and a size range covering compact cars through 22-inch truck fitments.",
         "Stock right now is deep - 38 sizes, many in triple-digit quantities - but that's a July statement. Come November the popular sizes evaporate. If winters are in this year's plan, price them now and install when the temperature drops."],
  whofor=["<strong>Ice-heavy commutes</strong> - polished intersections and freezing rain are the Blizzak's home turf.",
          "<strong>Families wanting the known name</strong> - decades of Canadian winter reputation, current-generation tech.",
          "<strong>Trucks and SUVs too</strong> - 20 and 22 inch fitments in stock alongside the car sizes."],
  faqs=[("How much do Blizzak IcePeak tires cost?",
         "In-stock sizes run about $181-$425 a tire as of "+CHECKED+" - a 195/65R15 is around $181, common CUV sizes $240-270. Install $25/tire, HST extra."),
        ("Blizzak IcePeak vs Michelin X-Ice Snow?",
         "The two best-known studless winters in Canada. Blizzaks are famous for ice bite; the X-Ice Snow for keeping its grip over more seasons. We stock both - in your size, the honest answer is often price and availability."),
        ("When should I buy winter tires?",
         "Earlier than you think. Popular sizes sell out across Ontario by mid-November. Buy in summer or early fall, and we'll install at $25 a tire when the weather actually turns."),
        ("Do winter tires get an insurance discount in Ontario?",
         "Most Ontario insurers offer roughly 5% off for running winter tires December through March. Ask your broker - a set of Blizzaks usually pays part of its own way.")],
  related=[('/michelin-x-ice-snow','Michelin X-Ice Snow'),
           ('/antares-grip-60-ice','Antares Grip 60 Ice - budget winter'),
           ('/best-winter-tires-2026','Best Winter Tires 2026')])

# ---------------------------------------------------------------- template
CSS = """
:root{
  --black:#0a0a0a; --dark:#121212; --card:#161616; --raised:#1d1d1d;
  --border:#252525; --mid:#2d2d2d; --muted:#888;
  --light:#cfcfcf; --white:#f4f4f4;
  --yellow:#f5c518; --yellow-dim:rgba(245,197,24,0.1); --yellow-dark:#dba900;
  --green:#16a34a; --red:#dc2626;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--black);color:var(--white);font-family:'Barlow',sans-serif;font-size:16px;line-height:1.7;overflow-x:hidden}
.site-header{position:sticky;top:0;z-index:100;background:rgba(10,10,10,.96);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:14px 32px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:var(--white);text-decoration:none}
.logo .pc{color:var(--yellow)}
.nav-actions{display:flex;align-items:center;gap:18px}
.nav-actions a{font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-decoration:none;transition:color .2s}
.nav-actions a:hover{color:var(--white)}
.cta-btn{background:var(--yellow);color:var(--black);padding:9px 18px;font-weight:700;border-radius:2px;font-size:13px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;transition:background .2s}
.cta-btn:hover{background:var(--yellow-dark);color:var(--black)!important}
.promo-strip{background:linear-gradient(90deg,#000 0%,#1a1a1a 50%,#000 100%);color:var(--yellow);font-size:13px;font-weight:600;padding:9px 16px;text-align:center;border-bottom:1px solid var(--yellow)}
.promo-strip strong{color:var(--yellow);text-transform:uppercase;letter-spacing:.8px;font-weight:800}
.promo-strip code{background:var(--yellow);color:var(--black);padding:2px 8px;border-radius:2px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:800;letter-spacing:1.5px;margin-left:6px}
.wrap{max-width:820px;margin:0 auto;padding:60px 24px 80px}
.hero-meta{display:flex;gap:14px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-weight:600;margin-bottom:18px}
.hero-meta .sep{opacity:.4}
h1{font-family:'Barlow Condensed',sans-serif;font-size:clamp(34px,5vw,52px);line-height:1.08;font-weight:900;letter-spacing:-.5px;color:var(--white);margin-bottom:18px}
h1 .accent{color:var(--yellow)}
.subhead{font-size:18px;line-height:1.6;color:var(--light);margin-bottom:40px;max-width:680px}
h2{font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:800;color:var(--white);margin-top:56px;margin-bottom:18px;line-height:1.2;letter-spacing:-.2px}
h3{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:700;color:var(--yellow);margin-top:36px;margin-bottom:14px;line-height:1.2}
p{margin-bottom:18px;color:var(--light)}
ul, ol{margin:0 0 22px 22px;color:var(--light)}
li{margin-bottom:8px}
strong{color:var(--white)}
a{color:var(--yellow);text-decoration:none;border-bottom:1px solid rgba(245,197,24,.3);transition:border-color .15s}
a:hover{border-bottom-color:var(--yellow)}
.callout{background:var(--raised);border-left:3px solid var(--yellow);padding:20px 24px;margin:28px 0;border-radius:2px}
.callout strong{color:var(--yellow)}
.quick-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:26px 0}
.qf{background:var(--card);border:1px solid var(--border);border-radius:2px;padding:14px 16px}
.qf .qf-label{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);font-weight:700;margin-bottom:4px}
.qf .qf-val{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:var(--white)}
.qf .qf-val .accent{color:var(--yellow)}
.size-table{width:100%;border-collapse:collapse;margin:20px 0 8px;font-size:14px}
.size-table th{font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:1px;font-size:13px;color:var(--muted);text-align:left;padding:10px 12px;border-bottom:2px solid var(--border)}
.size-table td{padding:9px 12px;border-bottom:1px solid var(--border);color:var(--light)}
.size-table td:first-child{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--white)}
.size-table td:nth-child(4){font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;color:var(--yellow);white-space:nowrap}
.size-table tr:hover td{background:var(--card)}
.buy-link{display:inline-block;background:var(--yellow);color:#111;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:6px 14px;border-radius:2px;white-space:nowrap}
.buy-link:hover{background:var(--yellow-dark, #dba900)}
.stock-in{color:var(--green);font-weight:600}
.stock-low{color:#d97706;font-weight:600}
.price-note{font-size:13px;color:var(--muted);margin-bottom:26px}
.faq{background:var(--card);border:1px solid var(--border);padding:22px 26px;margin:14px 0;border-radius:2px}
.faq h4{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:var(--white);margin-bottom:8px}
.faq p{margin-bottom:0;font-size:15px}
.related{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:24px 0}
.related a{background:var(--card);border:1px solid var(--border);border-radius:2px;padding:16px 18px;font-weight:600;font-size:14px;border-bottom:1px solid var(--border)}
.related a:hover{border-color:var(--yellow)}
.cta-section{background:linear-gradient(135deg,var(--card) 0%,var(--raised) 100%);border:1px solid var(--border);border-top:3px solid var(--yellow);padding:36px 32px;margin-top:64px;text-align:center;border-radius:2px}
.cta-section h2{margin-top:0;color:var(--yellow)}
.cta-section p{font-size:16px;color:var(--light);max-width:520px;margin:0 auto 22px}
.cta-row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center}
.cta-phone{font-family:'IBM Plex Mono',monospace;font-size:18px;color:var(--white);text-decoration:none;border-bottom:0}
.cta-phone:hover{color:var(--yellow)}
footer{padding:36px 24px;border-top:1px solid var(--border);text-align:center;color:var(--muted);font-size:13px}
footer a{color:var(--muted);border-bottom:0}
footer a:hover{color:var(--yellow)}
@media(max-width:600px){
  .wrap{padding:36px 18px 60px}
  .site-header{padding:12px 16px}
  .nav-actions{gap:10px}
  .nav-actions a{font-size:11px}
  .cta-btn{padding:7px 12px;font-size:11px}
  h1{font-size:30px}
  h2{font-size:26px;margin-top:42px}
  .size-table td,.size-table th{padding:8px 8px}
}
"""

GTAG = """
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18156336783"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-18156336783');
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest && e.target.closest('a[href^="tel:"]');
    if (a && typeof gtag === 'function') {
      gtag('event', 'conversion', { 'send_to': 'AW-18156336783/SbSRCNu5nbEcEI_tztFD' });
    }
  }, true);
</script>
"""

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def build_page(slug, m, d):
    rows = d['rows']
    lo = min(r['price'] for r in rows); hi = max(r['price'] for r in rows)
    full = m['brand'] + ' ' + m['model']
    url = 'https://pctires.ca/' + slug
    data_key = slug[len(m['brand']) + 1:]

    trs = []
    for r in rows:
        stock = '<span class="stock-in">In stock</span>' if r['qty'] >= 5 else '<span class="stock-low">Low stock</span>'
        # Buy button destination, in order of preference:
        #
        #   1. /product?id=<feed-id> -- the per-SKU landing page (functions/product.js).
        #      This is the Google Merchant Center requirement: a Buy click must
        #      land on THIS size at THIS price with a working path to checkout,
        #      not on a page listing 100+ sizes. Same URL the feed's `link`
        #      column uses, so feed and site agree by construction.
        #
        #   2. /?buysize=...  -- fallback for sizes that are on the page but not
        #      in the feed (feed requires qty>=5 + GTIN + image; the page keeps
        #      anything qty>0). These aren't advertised, so a live size search is
        #      a fine destination. Plain metric size only: drop the P/LT/C prefix
        #      and any trailing load-range token, matching the site's own dropdowns.
        feed_id = FEED_IDS.get((data_key, r['size'], r['load'], r['speed']))
        if feed_id:
            buy_href = 'https://pctires.ca/product?id=%s' % feed_id
        else:
            plain_size = re.sub(r'^(P|LT|C)(?=\d)', '', r['size'].split(' ')[0])
            buy_href = 'https://pctires.ca/?buysize=%s&amp;brand=%s#catalog' % (plain_size.replace('/', '%2F'), m['brand'].replace(' ', '%20'))
        trs.append('<tr><td>%s</td><td>%s%s</td><td>%s</td><td>$%.2f</td><td><a class="buy-link" href="%s">Buy &rarr;</a></td></tr>' % (r['size'], r['load'], r['speed'], stock, r['price'], buy_href))
    table = '<table class="size-table"><thead><tr><th>Size</th><th>Load/Speed</th><th>Availability</th><th>Price / tire</th><th></th></tr></thead><tbody>' + ''.join(trs) + '</tbody></table>'

    product_ld = {
      "@context": "https://schema.org", "@type": "Product",
      "name": full + " Tires", "brand": {"@type": "Brand", "name": m['brand']},
      "description": m['desc'], "category": "Automotive Tires",
      "offers": {"@type": "AggregateOffer", "priceCurrency": "CAD",
        "lowPrice": "%.2f" % lo, "highPrice": "%.2f" % hi, "offerCount": len(rows),
        "availability": "https://schema.org/InStock",
        "seller": {"@type": "AutoPartsStore", "@id": "https://pctires.ca/#business",
          "name": "PC Tires", "telephone": "+1-519-397-4686", "priceRange": "$$",
          "image": "https://pctires.ca/favicon-192.png",
          "address": {"@type": "PostalAddress", "streetAddress": "7144 Grande River Line",
            "addressLocality": "Pain Court", "addressRegion": "ON", "postalCode": "N0P 1Z0", "addressCountry": "CA"}}}}
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage",
      "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in m['faqs']]}

    intro_html = '\n\n'.join('<p>' + p + '</p>' for p in m['intro'])
    whofor_html = '\n'.join('  <li>' + w + '</li>' for w in m['whofor'])
    faqs_html = '\n\n'.join('<div class="faq">\n  <h4>' + esc(q) + '</h4>\n  <p>' + a + '</p>\n</div>' for q, a in m['faqs'])
    related_html = '\n'.join('  <a href="' + h + '">' + t + ' &rarr;</a>' for h, t in m['related'])

    qf = '''<div class="quick-facts">
  <div class="qf"><div class="qf-label">Category</div><div class="qf-val">%s</div></div>
  <div class="qf"><div class="qf-label">From</div><div class="qf-val"><span class="accent">$%.2f</span>/tire</div></div>
  <div class="qf"><div class="qf-label">Sizes in stock</div><div class="qf-val">%d</div></div>
  <div class="qf"><div class="qf-label">Local install</div><div class="qf-val">$25<span style="font-size:13px;color:var(--muted)">/tire</span></div></div>
</div>''' % (m['cat'], lo, len(rows))

    html = '''<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>''' + esc(m['title']) + '''</title>
<meta name="description" content="''' + esc(m['desc']) + '''">
<meta name="keywords" content="''' + esc(m['keywords']) + '''">
<meta name="author" content="PC Tires — Chatham-Kent, Ontario">
<meta name="robots" content="index, follow">
<link rel="canonical" href="''' + url + '''">

<meta property="og:title" content="''' + esc(full) + ''' Tires in Chatham-Kent | PC Tires">
<meta property="og:description" content="''' + esc(m['desc']) + '''">
<meta property="og:type" content="website">
<meta property="og:url" content="''' + url + '''">
<meta property="og:locale" content="en_CA">
<meta property="og:site_name" content="PC Tires">

<script type="application/ld+json">
''' + json.dumps(product_ld, indent=1) + '''
</script>
<script type="application/ld+json">
''' + json.dumps(faq_ld, indent=1) + '''
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
''' + GTAG + '''
<style>''' + CSS + '''</style>
</head>
<body>

<div class="promo-strip">
  <strong>''' + esc(full).upper() + ''':</strong> from $''' + ('%.2f' % lo) + '''/tire + $25/tire local install. Call <code>519-397-4686</code>
</div>

<header class="site-header">
  <a href="/" class="logo"><span class="pc">PC</span>TIRES</a>
  <div class="nav-actions">
    <a href="/#catalog">Shop Tires</a>
    <a href="/used-tires">Budget Tires</a>
    <a href="tel:5193974686" class="cta-btn">519-397-4686</a>
  </div>
</header>

<div class="wrap">

<div class="hero-meta">
  <span>''' + esc(m['cat']) + '''</span>
  <span class="sep">&middot;</span>
  <span>Updated ''' + CHECKED + '''</span>
  <span class="sep">&middot;</span>
  <span>Chatham-Kent, Ontario</span>
</div>

<h1>''' + esc(full) + ''' <span class="accent">in Chatham-Kent</span></h1>

<p class="subhead">''' + m['sub'] + '''</p>

''' + qf + '''

''' + intro_html + '''

<h2>Sizes &amp; Prices In Stock Right Now</h2>

<p>These are live distributor-fed prices, checked ''' + CHECKED + '''. Every size below can be ordered today and installed locally for $25 a tire. Prices are per tire, HST extra.</p>

''' + table + '''

<p class="price-note">Prices checked ''' + CHECKED + ''' and refresh regularly &mdash; the checkout price on our <a href="/#catalog">shop page</a> is always the live one. Don&rsquo;t see your size? Call <a href="tel:5193974686">519-397-4686</a>; the full catalogue runs deeper than any one day&rsquo;s stock.</p>

<h2>Who It&rsquo;s For</h2>

<ul>
''' + whofor_html + '''
</ul>

<div class="callout">
  <p style="margin-bottom:0"><strong>Local install, honest advice:</strong> every tire we sell is installed for <strong>$25 a tire</strong> at our shop in Pain Court, minutes from Chatham &mdash; mounted, balanced and torqued to spec. Not sure this is the right tire for your driving? Call and we&rsquo;ll tell you straight, even if the answer is a cheaper tire.</p>
</div>

<h2>Frequently Asked Questions</h2>

''' + faqs_html + '''

<h2>Related Reading</h2>

<div class="related">
''' + related_html + '''
</div>

<div class="cta-section">
  <h2>Ready for a Set?</h2>
  <p>''' + esc(full) + ''' from $''' + ('%.2f' % lo) + ''' a tire, installed for $25 each in Pain Court. Order online or call &mdash; either way you get live pricing and a straight answer.</p>
  <div class="cta-row">
    <a href="/#catalog" class="cta-btn" style="font-size:14px;padding:13px 24px">Shop Tires &rarr;</a>
    <a href="tel:5193974686" class="cta-phone">519-397-4686</a>
  </div>
</div>

</div>

<footer>
  <p>PC Tires &mdash; Chatham-Kent, Ontario &middot; <a href="tel:5193974686">519-397-4686</a> &middot; <a href="/">pctires.ca</a></p>
  <p style="margin-top:8px;font-size:12px">&copy; 2026 PC Tires. Prices checked ''' + CHECKED + '''.</p>
</footer>

</body>
</html>'''
    return html

# ---------------------------------------------------------------- write pages
# (Tail reconstructed 2026-07-11 after accidental truncation; verified by
# diffing regenerated pages against the previously generated pages in the
# repo root -- only the intended Buy-button changes should differ.)
os.makedirs(OUTDIR, exist_ok=True)
manifest = []
for slug_key, m in M.items():
    data_key = slug_key[len(m['brand']) + 1:]
    d = models_data[data_key]
    path = os.path.join(OUTDIR, slug_key + '.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(build_page(slug_key, m, d))
    lo = min(r['price'] for r in d['rows'])
    manifest.append((slug_key, m['brand'] + ' ' + m['model'], len(d['rows']), lo))
    print('%-34s %-38s %3d sizes  from $%.2f' % (slug_key + '.html', m['brand'] + ' ' + m['model'], len(d['rows']), lo))

print('\n%d pages generated in %s/' % (len(manifest), OUTDIR))
print('Sitemap reminder: set <lastmod> to %s for these pages in sitemap.xml' % LASTMOD)
