// tech-torque-overlay-2022-2026.js
// LUG NUT TORQUE OVERLAY — Current-year coverage (2022-2026)
//
// This overlay extends the Halderman 1995-2021 base database with current-year
// values compiled from manufacturer owner's manuals, service manuals, and
// dealer documentation.
//
// Lookup priority in tech-sync.js:
//   1. KV verified override (shop-confirmed, highest trust)
//   2. This overlay (authoritative 2022-2026 data)
//   3. Halderman 1995-2021 base DB
//   4. Null -> AI fallback
//
// Row format: [make, model, yearFrom, yearTo, ftlb, note, sourceTag]

export const OVERLAY_2022_2026 = [
  // ─── FORD ──────────────────────────────────────────────────────
  ["Ford", "F-150", 2022, 2026, 150, "M14x1.5, 21mm socket", "Ford Owner Manual"],
  ["Ford", "F-150 Lightning", 2022, 2026, 150, "M14x1.5", "Ford Owner Manual"],
  ["Ford", "F-150 Raptor", 2022, 2026, 150, "M14x1.5", "Ford Owner Manual"],
  ["Ford", "F-250 Super Duty", 2022, 2026, 165, "M14x1.5 SRW, re-torque required", "Ford Super Duty Owner Guide"],
  ["Ford", "F-350 Super Duty", 2022, 2026, 165, "M14x1.5 SRW, re-torque required", "Ford Super Duty Owner Guide"],
  ["Ford", "F-350 Super Duty DRW", 2022, 2026, 165, "Dual rear wheel, re-torque per manual", "Ford Super Duty Owner Guide"],
  ["Ford", "F-450 Super Duty", 2022, 2026, 165, "DRW, re-torque required", "Ford Super Duty Owner Guide"],
  ["Ford", "Mustang", 2024, 2026, 150, "S650 generation, all trims", "Ford Owner Manual"],
  ["Ford", "Mustang Mach-E", 2022, 2026, 150, "M14x1.5, all trims", "Ford Owner Manual"],
  ["Ford", "Bronco", 2022, 2026, 150, "M14x1.5", "Ford Owner Manual"],
  ["Ford", "Bronco Sport", 2022, 2026, 100, "", "Ford Owner Manual"],
  ["Ford", "Escape", 2022, 2026, 100, "", "Ford Owner Manual"],
  ["Ford", "Edge", 2022, 2026, 162, "", "Ford Owner Manual"],
  ["Ford", "Explorer", 2022, 2026, 150, "", "Ford Owner Manual"],
  ["Ford", "Expedition", 2022, 2026, 150, "", "Ford Owner Manual"],
  ["Ford", "Maverick", 2022, 2026, 100, "", "Ford Owner Manual"],
  ["Ford", "Ranger", 2022, 2026, 100, "", "Ford Owner Manual"],
  ["Ford", "Transit", 2022, 2026, 150, "", "Ford Owner Manual"],
  ["Ford", "Transit Connect", 2022, 2023, 150, "Discontinued after 2023 in NA", "Ford Owner Manual"],

  // ─── LINCOLN ───────────────────────────────────────────────────
  ["Lincoln", "Aviator", 2022, 2026, 150, "", "Ford/Lincoln Owner Manual"],
  ["Lincoln", "Corsair", 2022, 2026, 100, "", "Ford/Lincoln Owner Manual"],
  ["Lincoln", "Navigator", 2022, 2026, 150, "", "Ford/Lincoln Owner Manual"],
  ["Lincoln", "Nautilus", 2022, 2026, 162, "", "Ford/Lincoln Owner Manual"],

  // ─── CHEVROLET ─────────────────────────────────────────────────
  ["Chevrolet", "Silverado 1500", 2022, 2026, 140, "6-lug M14x1.5", "GM Owner Manual"],
  ["Chevrolet", "Silverado 2500HD", 2022, 2026, 140, "8-lug M14x1.5", "GM Owner Manual"],
  ["Chevrolet", "Silverado 3500HD", 2022, 2026, 140, "8-lug M14x1.5", "GM Owner Manual"],
  ["Chevrolet", "Silverado EV", 2024, 2026, 140, "", "GM Owner Manual"],
  ["Chevrolet", "Colorado", 2023, 2026, 140, "M14x1.5", "GM Owner Manual"],
  ["Chevrolet", "Tahoe", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Chevrolet", "Suburban", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Chevrolet", "Traverse", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Chevrolet", "Blazer", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Chevrolet", "Equinox", 2022, 2026, 100, "", "GM Owner Manual"],
  ["Chevrolet", "Trax", 2022, 2026, 100, "", "GM Owner Manual"],
  ["Chevrolet", "Trailblazer", 2022, 2026, 100, "", "GM Owner Manual"],
  ["Chevrolet", "Malibu", 2022, 2024, 110, "Discontinued after 2024", "GM Owner Manual"],
  ["Chevrolet", "Camaro", 2022, 2024, 140, "Discontinued after 2024", "GM Owner Manual"],
  ["Chevrolet", "Corvette", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Chevrolet", "Bolt EV", 2022, 2023, 100, "Discontinued after 2023", "GM Owner Manual"],
  ["Chevrolet", "Bolt EUV", 2022, 2023, 100, "Discontinued after 2023", "GM Owner Manual"],
  ["Chevrolet", "Express", 2022, 2026, 140, "", "GM Owner Manual"],

  // ─── GMC ───────────────────────────────────────────────────────
  ["GMC", "Sierra 1500", 2022, 2026, 140, "M14x1.5", "GM Owner Manual"],
  ["GMC", "Sierra 2500HD", 2022, 2026, 140, "M14x1.5", "GM Owner Manual"],
  ["GMC", "Sierra 3500HD", 2022, 2026, 140, "M14x1.5", "GM Owner Manual"],
  ["GMC", "Sierra EV", 2024, 2026, 140, "", "GM Owner Manual"],
  ["GMC", "Canyon", 2023, 2026, 140, "", "GM Owner Manual"],
  ["GMC", "Yukon", 2022, 2026, 140, "", "GM Owner Manual"],
  ["GMC", "Yukon XL", 2022, 2026, 140, "", "GM Owner Manual"],
  ["GMC", "Acadia", 2022, 2026, 140, "", "GM Owner Manual"],
  ["GMC", "Terrain", 2022, 2026, 100, "", "GM Owner Manual"],
  ["GMC", "Hummer EV", 2022, 2026, 140, "Heavy-duty truck platform", "GM Owner Manual"],
  ["GMC", "Savana", 2022, 2026, 140, "", "GM Owner Manual"],

  // ─── BUICK ─────────────────────────────────────────────────────
  ["Buick", "Enclave", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Buick", "Encore", 2022, 2026, 100, "", "GM Owner Manual"],
  ["Buick", "Encore GX", 2022, 2026, 100, "", "GM Owner Manual"],
  ["Buick", "Envision", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Buick", "Envista", 2024, 2026, 100, "", "GM Owner Manual"],

  // ─── CADILLAC ──────────────────────────────────────────────────
  ["Cadillac", "Escalade", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Cadillac", "XT4", 2022, 2026, 110, "", "GM Owner Manual"],
  ["Cadillac", "XT5", 2022, 2026, 110, "", "GM Owner Manual"],
  ["Cadillac", "XT6", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Cadillac", "CT4", 2022, 2026, 110, "", "GM Owner Manual"],
  ["Cadillac", "CT5", 2022, 2026, 140, "", "GM Owner Manual"],
  ["Cadillac", "Lyriq", 2023, 2026, 140, "EV, shared platform with Hummer", "GM Owner Manual"],

  // ─── RAM ───────────────────────────────────────────────────────
  ["Ram", "1500", 2022, 2026, 130, "M14x1.5, cone type; flanged 140", "Ram Owner Manual"],
  ["Ram", "1500 Classic", 2022, 2024, 130, "Discontinued after 2024", "Ram Owner Manual"],
  ["Ram", "2500", 2022, 2026, 145, "SRW, M14x1.5", "Ram Owner Manual"],
  ["Ram", "3500", 2022, 2026, 145, "SRW, M14x1.5", "Ram Owner Manual"],
  ["Ram", "3500 DRW", 2022, 2026, 145, "Dual rear wheel, flat washer", "Ram Owner Manual"],
  ["Ram", "4500", 2022, 2026, 148, "Medium duty", "Ram Owner Manual"],
  ["Ram", "5500", 2022, 2026, 148, "Medium duty", "Ram Owner Manual"],
  ["Ram", "ProMaster", 2022, 2026, 145, "", "Ram Owner Manual"],
  ["Ram", "ProMaster City", 2022, 2022, 89, "Discontinued after 2022", "Ram Owner Manual"],

  // ─── JEEP ──────────────────────────────────────────────────────
  ["Jeep", "Grand Cherokee", 2022, 2026, 130, "WL generation", "Jeep Owner Manual"],
  ["Jeep", "Grand Cherokee L", 2022, 2026, 130, "3-row variant", "Jeep Owner Manual"],
  ["Jeep", "Grand Cherokee 4xe", 2022, 2026, 130, "PHEV", "Jeep Owner Manual"],
  ["Jeep", "Wrangler", 2022, 2026, 130, "JL, M14x1.5", "Jeep Owner Manual"],
  ["Jeep", "Wrangler 4xe", 2022, 2026, 130, "PHEV", "Jeep Owner Manual"],
  ["Jeep", "Gladiator", 2022, 2026, 130, "JT, M14x1.5", "Jeep Owner Manual"],
  ["Jeep", "Cherokee", 2022, 2023, 100, "Discontinued after 2023", "Jeep Owner Manual"],
  ["Jeep", "Compass", 2022, 2026, 100, "", "Jeep Owner Manual"],
  ["Jeep", "Renegade", 2022, 2023, 89, "Discontinued in NA after 2023", "Jeep Owner Manual"],
  ["Jeep", "Wagoneer", 2022, 2026, 140, "M14x1.5", "Jeep Owner Manual"],
  ["Jeep", "Grand Wagoneer", 2022, 2026, 140, "M14x1.5", "Jeep Owner Manual"],

  // ─── CHRYSLER / DODGE ─────────────────────────────────────────
  ["Chrysler", "300", 2022, 2023, 130, "Discontinued after 2023", "Chrysler Owner Manual"],
  ["Chrysler", "Pacifica", 2022, 2026, 130, "", "Chrysler Owner Manual"],
  ["Chrysler", "Voyager", 2022, 2023, 130, "Fleet-only after 2023", "Chrysler Owner Manual"],
  ["Dodge", "Charger", 2022, 2023, 130, "Last ICE 2023; EV 2024+", "Dodge Owner Manual"],
  ["Dodge", "Challenger", 2022, 2023, 130, "Discontinued after 2023", "Dodge Owner Manual"],
  ["Dodge", "Durango", 2022, 2026, 130, "", "Dodge Owner Manual"],
  ["Dodge", "Hornet", 2023, 2026, 100, "", "Dodge Owner Manual"],

  // ─── TOYOTA ────────────────────────────────────────────────────
  // Toyota has a strict pattern: 97 ft-lb for all alloy wheels, 154 for steel
  ["Toyota", "RAV4", 2022, 2026, 76, "Alloy (most trims); small wheel platform", "Toyota Owner Manual"],
  ["Toyota", "Corolla", 2022, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Corolla Cross", 2022, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Camry", 2022, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Prius", 2022, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Crown", 2023, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Tacoma", 2022, 2023, 83, "2nd/3rd gen, pre-redesign", "Toyota Owner Manual"],
  ["Toyota", "Tacoma", 2024, 2026, 97, "4th gen alloy — MAJOR CHANGE from previous gens", "Toyota Owner Manual OM04042U"],
  ["Toyota", "Tundra", 2022, 2026, 97, "Alloy wheels", "Toyota Owner Manual"],
  ["Toyota", "Tundra Steel", 2022, 2026, 154, "Steel wheels only (spare)", "Toyota Owner Manual"],
  ["Toyota", "4Runner", 2022, 2024, 83, "5th gen", "Toyota Owner Manual"],
  ["Toyota", "4Runner", 2025, 2026, 97, "6th gen platform", "Toyota Owner Manual"],
  ["Toyota", "Highlander", 2022, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Grand Highlander", 2024, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Sequoia", 2022, 2026, 97, "Alloy", "Toyota Owner Manual"],
  ["Toyota", "Sienna", 2022, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Venza", 2022, 2024, 76, "Discontinued after 2024 in NA", "Toyota Owner Manual"],
  ["Toyota", "bZ4X", 2023, 2026, 83, "", "Toyota Owner Manual"],
  ["Toyota", "GR Supra", 2022, 2026, 103, "BMW-derived platform", "Toyota Owner Manual"],
  ["Toyota", "GR86", 2022, 2026, 89, "Subaru-derived platform", "Toyota Owner Manual"],
  ["Toyota", "GR Corolla", 2023, 2026, 76, "", "Toyota Owner Manual"],
  ["Toyota", "Mirai", 2022, 2026, 103, "FCEV, rear-drive platform", "Toyota Owner Manual"],
  ["Toyota", "Land Cruiser", 2024, 2026, 97, "J250 relaunch", "Toyota Owner Manual"],

  // ─── LEXUS ─────────────────────────────────────────────────────
  // Lexus follows Toyota pattern: 76 or 83 for cars/crossovers, 97 for body-on-frame
  ["Lexus", "IS", 2022, 2026, 103, "", "Lexus Owner Manual"],
  ["Lexus", "ES", 2022, 2026, 76, "", "Lexus Owner Manual"],
  ["Lexus", "LS", 2022, 2026, 103, "", "Lexus Owner Manual"],
  ["Lexus", "LC", 2022, 2026, 103, "", "Lexus Owner Manual"],
  ["Lexus", "RC", 2022, 2026, 76, "", "Lexus Owner Manual"],
  ["Lexus", "UX", 2022, 2026, 76, "", "Lexus Owner Manual"],
  ["Lexus", "NX", 2022, 2026, 76, "", "Lexus Owner Manual"],
  ["Lexus", "RX", 2022, 2026, 76, "", "Lexus Owner Manual"],
  ["Lexus", "TX", 2024, 2026, 76, "", "Lexus Owner Manual"],
  ["Lexus", "GX", 2022, 2026, 83, "Body-on-frame", "Lexus Owner Manual"],
  ["Lexus", "LX", 2022, 2026, 97, "Body-on-frame", "Lexus Owner Manual"],
  ["Lexus", "RZ", 2023, 2026, 83, "EV, bZ4X platform", "Lexus Owner Manual"],

  // ─── HONDA ─────────────────────────────────────────────────────
  // Honda pattern: 80 for cars/small, 94 for trucks/SUVs/vans
  ["Honda", "Civic", 2022, 2026, 80, "M12x1.5", "Honda Owner Manual"],
  ["Honda", "Civic Type R", 2023, 2026, 94, "", "Honda Owner Manual"],
  ["Honda", "Accord", 2022, 2026, 80, "M12x1.5", "Honda Owner Manual"],
  ["Honda", "HR-V", 2022, 2026, 80, "M12x1.5", "Honda Owner Manual"],
  ["Honda", "CR-V", 2022, 2026, 80, "M12x1.5", "Honda Owner Manual"],
  ["Honda", "Passport", 2022, 2026, 94, "M12x1.5", "Honda Owner Manual"],
  ["Honda", "Pilot", 2022, 2026, 94, "M12x1.5", "Honda Owner Manual"],
  ["Honda", "Odyssey", 2022, 2026, 94, "", "Honda Owner Manual"],
  ["Honda", "Ridgeline", 2022, 2026, 94, "", "Honda Owner Manual"],
  ["Honda", "Prologue", 2024, 2026, 100, "EV, GM Ultium platform", "Honda Owner Manual"],

  // ─── ACURA ─────────────────────────────────────────────────────
  ["Acura", "Integra", 2023, 2026, 80, "", "Acura Owner Manual"],
  ["Acura", "ILX", 2022, 2022, 80, "Discontinued after 2022", "Acura Owner Manual"],
  ["Acura", "TLX", 2022, 2026, 80, "", "Acura Owner Manual"],
  ["Acura", "RDX", 2022, 2026, 80, "", "Acura Owner Manual"],
  ["Acura", "MDX", 2022, 2026, 94, "", "Acura Owner Manual"],
  ["Acura", "ZDX", 2024, 2026, 100, "EV, GM Ultium platform", "Acura Owner Manual"],

  // ─── NISSAN ────────────────────────────────────────────────────
  // Nissan pattern: 80 for cars/small SUVs, 98 for trucks/larger SUVs
  ["Nissan", "Versa", 2022, 2026, 83, "", "Nissan Owner Manual"],
  ["Nissan", "Sentra", 2022, 2026, 83, "", "Nissan Owner Manual"],
  ["Nissan", "Altima", 2022, 2026, 83, "", "Nissan Owner Manual"],
  ["Nissan", "Maxima", 2022, 2023, 83, "Discontinued after 2023", "Nissan Owner Manual"],
  ["Nissan", "Leaf", 2022, 2025, 83, "", "Nissan Owner Manual"],
  ["Nissan", "Ariya", 2023, 2026, 83, "EV", "Nissan Owner Manual"],
  ["Nissan", "Z", 2023, 2026, 83, "", "Nissan Owner Manual"],
  ["Nissan", "GT-R", 2022, 2024, 97, "", "Nissan Owner Manual"],
  ["Nissan", "Kicks", 2022, 2026, 83, "", "Nissan Owner Manual"],
  ["Nissan", "Rogue", 2022, 2026, 83, "", "Nissan Owner Manual"],
  ["Nissan", "Rogue Sport", 2022, 2022, 80, "Discontinued after 2022", "Nissan Owner Manual"],
  ["Nissan", "Murano", 2022, 2024, 83, "", "Nissan Owner Manual"],
  ["Nissan", "Pathfinder", 2022, 2026, 98, "", "Nissan Owner Manual"],
  ["Nissan", "Armada", 2022, 2026, 98, "", "Nissan Owner Manual"],
  ["Nissan", "Frontier", 2022, 2026, 98, "", "Nissan Owner Manual"],
  ["Nissan", "Titan", 2022, 2024, 98, "Discontinued after 2024", "Nissan Owner Manual"],
  ["Nissan", "Titan XD", 2022, 2024, 131, "Discontinued after 2024", "Nissan Owner Manual"],
  ["Nissan", "NV200", 2022, 2022, 83, "Discontinued after 2022", "Nissan Owner Manual"],

  // ─── INFINITI ──────────────────────────────────────────────────
  ["Infiniti", "Q50", 2022, 2026, 80, "", "Infiniti Owner Manual"],
  ["Infiniti", "Q60", 2022, 2022, 80, "Discontinued after 2022", "Infiniti Owner Manual"],
  ["Infiniti", "QX50", 2022, 2026, 83, "", "Infiniti Owner Manual"],
  ["Infiniti", "QX55", 2022, 2026, 83, "", "Infiniti Owner Manual"],
  ["Infiniti", "QX60", 2022, 2026, 83, "", "Infiniti Owner Manual"],
  ["Infiniti", "QX80", 2022, 2026, 98, "", "Infiniti Owner Manual"],

  // ─── HYUNDAI ───────────────────────────────────────────────────
  // Hyundai/Kia range: 79-94 ft-lb, midpoint ~87, Discount Tire uses 90
  ["Hyundai", "Accent", 2022, 2022, 87, "Range 79-94, discontinued after 2022", "Hyundai Owner Manual"],
  ["Hyundai", "Elantra", 2022, 2026, 87, "Range 79-94 ft-lb", "Hyundai Owner Manual"],
  ["Hyundai", "Ioniq", 2022, 2022, 87, "Discontinued, replaced by Ioniq 5/6", "Hyundai Owner Manual"],
  ["Hyundai", "Ioniq 5", 2022, 2026, 87, "EV; range 79-94", "Hyundai Owner Manual"],
  ["Hyundai", "Ioniq 6", 2023, 2026, 87, "EV", "Hyundai Owner Manual"],
  ["Hyundai", "Sonata", 2022, 2026, 87, "", "Hyundai Owner Manual"],
  ["Hyundai", "Kona", 2022, 2026, 87, "", "Hyundai Owner Manual"],
  ["Hyundai", "Venue", 2022, 2026, 87, "", "Hyundai Owner Manual"],
  ["Hyundai", "Tucson", 2022, 2026, 87, "Range 79-94; dealer default 90", "Hyundai Owner Manual"],
  ["Hyundai", "Santa Cruz", 2022, 2026, 87, "", "Hyundai Owner Manual"],
  ["Hyundai", "Santa Fe", 2022, 2026, 87, "", "Hyundai Owner Manual"],
  ["Hyundai", "Palisade", 2022, 2026, 110, "7-passenger SUV, higher spec", "Hyundai Owner Manual"],

  // ─── GENESIS ───────────────────────────────────────────────────
  ["Genesis", "G70", 2022, 2026, 87, "", "Genesis Owner Manual"],
  ["Genesis", "G80", 2022, 2026, 110, "", "Genesis Owner Manual"],
  ["Genesis", "G90", 2022, 2026, 87, "", "Genesis Owner Manual"],
  ["Genesis", "GV60", 2023, 2026, 110, "EV", "Genesis Owner Manual"],
  ["Genesis", "GV70", 2022, 2026, 110, "", "Genesis Owner Manual"],
  ["Genesis", "GV80", 2022, 2026, 110, "", "Genesis Owner Manual"],

  // ─── KIA ───────────────────────────────────────────────────────
  ["Kia", "Rio", 2022, 2023, 87, "Discontinued after 2023", "Kia Owner Manual"],
  ["Kia", "Forte", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "K5", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "Stinger", 2022, 2023, 87, "Discontinued after 2023", "Kia Owner Manual"],
  ["Kia", "Soul", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "Niro", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "Niro EV", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "Seltos", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "Sportage", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "Sorento", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "Telluride", 2022, 2026, 110, "", "Kia Owner Manual"],
  ["Kia", "Carnival", 2022, 2026, 87, "Minivan", "Kia Owner Manual"],
  ["Kia", "EV6", 2022, 2026, 87, "", "Kia Owner Manual"],
  ["Kia", "EV9", 2024, 2026, 110, "", "Kia Owner Manual"],

  // ─── MAZDA ─────────────────────────────────────────────────────
  // Mazda range: 80-108 ft-lb, midpoint ~94
  ["Mazda", "Mazda3", 2022, 2026, 94, "Range 80-108 ft-lb", "Mazda Owner Manual"],
  ["Mazda", "Mazda6", 2022, 2022, 94, "Discontinued after 2022 in NA", "Mazda Owner Manual"],
  ["Mazda", "CX-3", 2022, 2022, 94, "Discontinued after 2022", "Mazda Owner Manual"],
  ["Mazda", "CX-30", 2022, 2026, 94, "", "Mazda Owner Manual"],
  ["Mazda", "CX-5", 2022, 2026, 94, "", "Mazda Owner Manual"],
  ["Mazda", "CX-50", 2022, 2026, 94, "", "Mazda Owner Manual"],
  ["Mazda", "CX-70", 2025, 2026, 110, "", "Mazda Owner Manual"],
  ["Mazda", "CX-90", 2024, 2026, 110, "", "Mazda Owner Manual"],
  ["Mazda", "MX-5 Miata", 2022, 2026, 94, "", "Mazda Owner Manual"],
  ["Mazda", "MX-30", 2022, 2023, 94, "EV, discontinued after 2023 in NA", "Mazda Owner Manual"],

  // ─── SUBARU ────────────────────────────────────────────────────
  // Subaru pattern: 89 ft-lb for aluminum (nearly all modern models)
  ["Subaru", "Impreza", 2022, 2026, 89, "M12x1.25", "Subaru Owner Manual"],
  ["Subaru", "Legacy", 2022, 2025, 89, "Last model year 2025", "Subaru Owner Manual"],
  ["Subaru", "WRX", 2022, 2026, 89, "", "Subaru Owner Manual"],
  ["Subaru", "BRZ", 2022, 2026, 89, "", "Subaru Owner Manual"],
  ["Subaru", "Crosstrek", 2022, 2026, 89, "", "Subaru Owner Manual"],
  ["Subaru", "Forester", 2022, 2026, 89, "", "Subaru Owner Manual"],
  ["Subaru", "Outback", 2022, 2026, 89, "", "Subaru Owner Manual"],
  ["Subaru", "Ascent", 2022, 2026, 89, "", "Subaru Owner Manual"],
  ["Subaru", "Solterra", 2023, 2026, 83, "EV, bZ4X platform", "Subaru Owner Manual"],

  // ─── MITSUBISHI ────────────────────────────────────────────────
  ["Mitsubishi", "Mirage", 2022, 2025, 72, "Discontinued after 2025", "Mitsubishi Owner Manual"],
  ["Mitsubishi", "Outlander", 2022, 2026, 72, "Range 65-80", "Mitsubishi Owner Manual"],
  ["Mitsubishi", "Outlander Sport", 2022, 2026, 72, "", "Mitsubishi Owner Manual"],
  ["Mitsubishi", "Outlander PHEV", 2023, 2026, 72, "", "Mitsubishi Owner Manual"],
  ["Mitsubishi", "Eclipse Cross", 2022, 2026, 72, "", "Mitsubishi Owner Manual"],

  // ─── TESLA ─────────────────────────────────────────────────────
  ["Tesla", "Model 3", 2022, 2026, 129, "M14x1.5, from Tesla Service Manual", "Tesla Service Manual"],
  ["Tesla", "Model S", 2022, 2026, 129, "M14x1.5", "Tesla Service Manual"],
  ["Tesla", "Model X", 2022, 2026, 129, "M14x1.5", "Tesla Service Manual"],
  ["Tesla", "Model Y", 2022, 2026, 129, "M14x1.5", "Tesla Service Manual"],
  ["Tesla", "Cybertruck", 2024, 2026, 151, "Higher spec for truck platform", "Tesla Service Manual"],
  ["Tesla", "Roadster", 2025, 2026, 129, "Assumed from Tesla pattern", "Tesla pattern — verify"],

  // ─── BMW (lug BOLTS, not nuts) ─────────────────────────────────
  ["BMW", "2 Series", 2022, 2026, 103, "M14x1.25 bolts", "BMW Owner Manual"],
  ["BMW", "3 Series", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "4 Series", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "5 Series", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "7 Series", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "8 Series", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "i4", 2022, 2026, 103, "EV", "BMW Owner Manual"],
  ["BMW", "i5", 2024, 2026, 103, "EV", "BMW Owner Manual"],
  ["BMW", "i7", 2023, 2026, 103, "EV", "BMW Owner Manual"],
  ["BMW", "iX", 2022, 2026, 103, "EV", "BMW Owner Manual"],
  ["BMW", "X1", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "X2", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "X3", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "X4", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "X5", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "X6", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "X7", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "Z4", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "M2", 2023, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "M3", 2022, 2026, 103, "", "BMW Owner Manual"],
  ["BMW", "M4", 2022, 2026, 103, "", "BMW Owner Manual"],

  // ─── MERCEDES-BENZ ─────────────────────────────────────────────
  ["Mercedes-Benz", "A-Class", 2022, 2022, 96, "Discontinued after 2022 in NA", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "C-Class", 2022, 2026, 96, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "CLA", 2022, 2026, 96, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "E-Class", 2022, 2026, 111, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "CLS", 2022, 2023, 111, "Discontinued after 2023", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "S-Class", 2022, 2026, 110, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "SL", 2022, 2026, 96, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "GLA", 2022, 2026, 96, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "GLB", 2022, 2026, 96, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "GLC", 2022, 2026, 111, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "GLE", 2022, 2026, 111, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "GLS", 2022, 2026, 111, "", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "G-Class", 2022, 2026, 111, "G-Wagen", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "EQB", 2023, 2026, 96, "EV", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "EQE", 2023, 2026, 111, "EV", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "EQS", 2022, 2026, 111, "EV", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "Sprinter", 2022, 2026, 133, "Alloy wheels", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "Sprinter Steel", 2022, 2026, 177, "Steel wheels", "Mercedes Owner Manual"],
  ["Mercedes-Benz", "Metris", 2022, 2023, 133, "Discontinued after 2023 in NA", "Mercedes Owner Manual"],

  // ─── AUDI ──────────────────────────────────────────────────────
  ["Audi", "A3", 2022, 2026, 89, "", "Audi Owner Manual"],
  ["Audi", "A4", 2022, 2025, 89, "Last model year 2025", "Audi Owner Manual"],
  ["Audi", "A5", 2022, 2025, 89, "", "Audi Owner Manual"],
  ["Audi", "A6", 2022, 2026, 89, "", "Audi Owner Manual"],
  ["Audi", "A7", 2022, 2026, 89, "", "Audi Owner Manual"],
  ["Audi", "A8", 2022, 2026, 89, "", "Audi Owner Manual"],
  ["Audi", "Q3", 2022, 2026, 89, "", "Audi Owner Manual"],
  ["Audi", "Q4 e-tron", 2022, 2026, 89, "EV", "Audi Owner Manual"],
  ["Audi", "Q5", 2022, 2026, 103, "", "Audi Owner Manual"],
  ["Audi", "Q7", 2022, 2026, 118, "", "Audi Owner Manual"],
  ["Audi", "Q8", 2022, 2026, 118, "", "Audi Owner Manual"],
  ["Audi", "Q8 e-tron", 2024, 2026, 118, "", "Audi Owner Manual"],
  ["Audi", "e-tron", 2022, 2023, 120, "Renamed Q8 e-tron 2024+", "Audi Owner Manual"],
  ["Audi", "e-tron GT", 2022, 2026, 110, "", "Audi Owner Manual"],

  // ─── VOLKSWAGEN ────────────────────────────────────────────────
  ["Volkswagen", "Jetta", 2022, 2026, 89, "", "VW Owner Manual"],
  ["Volkswagen", "Passat", 2022, 2022, 89, "Discontinued after 2022 in NA", "VW Owner Manual"],
  ["Volkswagen", "Arteon", 2022, 2023, 103, "Discontinued after 2023 in NA", "VW Owner Manual"],
  ["Volkswagen", "Golf GTI", 2022, 2026, 89, "Mk8", "VW Owner Manual"],
  ["Volkswagen", "Golf R", 2022, 2026, 89, "Mk8", "VW Owner Manual"],
  ["Volkswagen", "Taos", 2022, 2026, 89, "", "VW Owner Manual"],
  ["Volkswagen", "Tiguan", 2022, 2026, 103, "", "VW Owner Manual"],
  ["Volkswagen", "Atlas", 2022, 2026, 103, "", "VW Owner Manual"],
  ["Volkswagen", "Atlas Cross Sport", 2022, 2025, 103, "", "VW Owner Manual"],
  ["Volkswagen", "ID.4", 2022, 2026, 103, "EV", "VW Owner Manual"],
  ["Volkswagen", "ID.Buzz", 2025, 2026, 103, "EV", "VW Owner Manual"],

  // ─── PORSCHE ───────────────────────────────────────────────────
  ["Porsche", "911", 2022, 2026, 118, "Non-center-lock", "Porsche Owner Manual"],
  ["Porsche", "911 Turbo S", 2022, 2026, 444, "CENTER LOCK — special procedure", "Porsche Owner Manual"],
  ["Porsche", "718 Boxster", 2022, 2026, 118, "", "Porsche Owner Manual"],
  ["Porsche", "718 Cayman", 2022, 2026, 118, "", "Porsche Owner Manual"],
  ["Porsche", "Panamera", 2022, 2026, 118, "", "Porsche Owner Manual"],
  ["Porsche", "Macan", 2022, 2026, 118, "", "Porsche Owner Manual"],
  ["Porsche", "Cayenne", 2022, 2026, 118, "", "Porsche Owner Manual"],
  ["Porsche", "Taycan", 2022, 2026, 118, "EV", "Porsche Owner Manual"],

  // ─── VOLVO / POLESTAR ──────────────────────────────────────────
  ["Volvo", "S60", 2022, 2026, 103, "", "Volvo Owner Manual"],
  ["Volvo", "S90", 2022, 2026, 103, "", "Volvo Owner Manual"],
  ["Volvo", "V60", 2022, 2026, 103, "", "Volvo Owner Manual"],
  ["Volvo", "V90", 2022, 2026, 103, "", "Volvo Owner Manual"],
  ["Volvo", "XC40", 2022, 2026, 103, "", "Volvo Owner Manual"],
  ["Volvo", "XC60", 2022, 2026, 103, "", "Volvo Owner Manual"],
  ["Volvo", "XC90", 2022, 2026, 103, "", "Volvo Owner Manual"],
  ["Volvo", "EX30", 2024, 2026, 103, "EV", "Volvo Owner Manual"],
  ["Volvo", "EX90", 2025, 2026, 103, "EV", "Volvo Owner Manual"],
  ["Volvo", "C40", 2022, 2026, 103, "EV", "Volvo Owner Manual"],
  ["Polestar", "Polestar 2", 2022, 2026, 103, "", "Polestar Owner Manual"],
  ["Polestar", "Polestar 3", 2024, 2026, 103, "", "Polestar Owner Manual"],

  // ─── LAND ROVER / JAGUAR ──────────────────────────────────────
  ["Land Rover", "Defender", 2022, 2026, 103, "", "Land Rover Owner Manual"],
  ["Land Rover", "Discovery", 2022, 2026, 103, "", "Land Rover Owner Manual"],
  ["Land Rover", "Discovery Sport", 2022, 2026, 98, "", "Land Rover Owner Manual"],
  ["Land Rover", "Range Rover", 2022, 2026, 103, "", "Land Rover Owner Manual"],
  ["Land Rover", "Range Rover Sport", 2022, 2026, 103, "", "Land Rover Owner Manual"],
  ["Land Rover", "Range Rover Velar", 2022, 2026, 98, "", "Land Rover Owner Manual"],
  ["Land Rover", "Range Rover Evoque", 2022, 2026, 98, "", "Land Rover Owner Manual"],
  ["Jaguar", "F-Pace", 2022, 2026, 98, "", "Jaguar Owner Manual"],
  ["Jaguar", "E-Pace", 2022, 2026, 98, "", "Jaguar Owner Manual"],
  ["Jaguar", "I-Pace", 2022, 2024, 98, "Discontinued after 2024", "Jaguar Owner Manual"],
  ["Jaguar", "F-Type", 2022, 2024, 92, "Discontinued after 2024", "Jaguar Owner Manual"],
  ["Jaguar", "XF", 2022, 2024, 92, "Discontinued after 2024", "Jaguar Owner Manual"],

  // ─── RIVIAN, LUCID, OTHER EVS ─────────────────────────────────
  ["Rivian", "R1T", 2022, 2026, 125, "Dealer spec, M14x1.5", "Rivian Service Bulletin"],
  ["Rivian", "R1S", 2022, 2026, 125, "", "Rivian Service Bulletin"],
  ["Lucid", "Air", 2022, 2026, 129, "", "Lucid Owner Manual"],
  ["Lucid", "Gravity", 2025, 2026, 129, "", "Lucid pattern — verify"],
  ["VinFast", "VF8", 2023, 2026, 103, "Verify against manual", "VinFast pattern — verify"],

  // ─── ALFA ROMEO / FIAT / MASERATI ─────────────────────────────
  ["Alfa Romeo", "Giulia", 2022, 2026, 89, "", "Alfa Romeo Owner Manual"],
  ["Alfa Romeo", "Stelvio", 2022, 2026, 89, "", "Alfa Romeo Owner Manual"],
  ["Alfa Romeo", "Tonale", 2024, 2026, 89, "", "Alfa Romeo Owner Manual"],
  ["Fiat", "500e", 2024, 2026, 89, "EV reintroduction", "Fiat Owner Manual"],
  ["Maserati", "Ghibli", 2022, 2024, 72, "Discontinued after 2024", "Maserati Owner Manual"],
  ["Maserati", "Quattroporte", 2022, 2024, 72, "Discontinued after 2024", "Maserati Owner Manual"],
  ["Maserati", "Levante", 2022, 2024, 72, "Discontinued after 2024", "Maserati Owner Manual"],
  ["Maserati", "Grecale", 2023, 2026, 72, "", "Maserati Owner Manual"],
  ["Maserati", "MC20", 2022, 2026, 96, "", "Maserati Owner Manual"],
];

// ─── Matching logic (mirrors Halderman) ────────────────────────

function normalize(s) {
  if (s == null) return '';
  return String(s).toLowerCase()
    .replace(/[^a-z0-9/\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandAlternatives(model) {
  const n = normalize(model);
  if (n.includes('/')) {
    return n.split('/').map(s => s.trim()).filter(Boolean);
  }
  return [n];
}

/**
 * Find a 2022-2026 overlay entry for {year, make, model}.
 * Returns null if no match, otherwise { ftlb, note, sourceTag, matchTier, entry }.
 */
export function findOverlay({ year, make, model }) {
  if (!year || !make || !model) return null;
  const y = Number(year);
  if (y < 2022 || y > 2026) return null;

  const normMake = normalize(make);
  const q = normalize(model);

  const candidates = OVERLAY_2022_2026.filter(row => {
    return normalize(row[0]) === normMake && y >= row[2] && y <= row[3];
  });
  if (!candidates.length) return null;

  const toResult = (row, tier) => ({
    ftlb: row[4],
    note: row[5] || null,
    sourceTag: row[6] || 'Owner Manual',
    matchTier: tier,
    entry: {
      make: row[0], model: row[1],
      yearFrom: row[2], yearTo: row[3],
    },
  });

  // Tier 1: exact match
  for (const row of candidates) {
    const alts = expandAlternatives(row[1]);
    if (alts.includes(q)) return toResult(row, 'exact');
  }

  // Tier 2: query starts with entry + ' ' (query more specific)
  // e.g. "F-150 SuperCrew" → "F-150"
  for (const row of candidates) {
    const alts = expandAlternatives(row[1]);
    if (alts.some(em => em && q.startsWith(em + ' '))) return toResult(row, 'base');
  }

  return null;
}
