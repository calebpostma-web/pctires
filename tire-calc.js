/* ============================================================================
   PC Tires — shared tire calculator library  (tire-calc.js)
   Used by: /tire-size-calculator, /plus-sizing-calculator, /tread-depth-calculator
   ----------------------------------------------------------------------------
   Pure functions, no DOM. Exposed as window.PCTCalc.
   PCT_METRIC_SIZES / PCT_FLOTATION_SIZES mirror TIRE_SIZES in index.html
   (generated 2026-10-22 from the 1,583-entry list). If TIRE_SIZES grows,
   regenerate the two constants below — they decide which sizes get a
   "Shop this size" link and which plus/minus candidates are offered.
   ========================================================================== */
(function () {
  'use strict';

  const PCT_METRIC_SIZES={"115":{"70":[15]},"125":{"70":[16,17,18,19],"80":[17],"90":[16]},"135":{"70":[19],"80":[13,18],"90":[17]},"145":{"60":[20],"65":[15],"70":[12],"85":[18]},"155":{"55":[14],"60":[15,18,20],"65":[13,14,15,16],"70":[12,13,14,15,16,17,19],"80":[13,14,15,16,17,19],"85":[18],"90":[18]},"165":{"55":[14],"60":[13,14,15,16],"65":[13,14,15,16],"70":[13,14,15,16],"80":[13,14,15,16,17],"90":[17]},"175":{"50":[13,16],"55":[15,16,20],"60":[13,14,15,16,19],"65":[13,14,15,16],"70":[13,14,15,16],"75":[14],"80":[13,14,15,16,19]},"185":{"50":[16],"55":[13,14,15,16,17],"60":[13,14,15,16,17],"65":[13,14,15,16,17],"70":[13,14,15,16,17],"75":[14,16],"80":[13,14,15,16,17]},"195":{"40":[17],"45":[15,16,17,18,19],"50":[13,14,15,16,17,19,20],"55":[13,14,15,16,17,20],"60":[13,14,15,16,17,18],"65":[13,14,15,16,17],"70":[13,14,15,16,17],"75":[13,14,15,16,17],"80":[15]},"205":{"40":[16,17,18],"45":[15,16,17,18],"50":[13,14,15,16,17,18],"55":[13,14,15,16,17,18,19],"60":[13,14,15,16,17,18],"65":[13,14,15,16,17,18],"70":[13,14,15,16,17,18],"75":[13,14,15,16,17,18],"80":[16]},"215":{"35":[17,18,19],"40":[15,16,17,18],"45":[15,16,17,18,20],"50":[13,14,15,16,17,18,19],"55":[13,14,15,16,17,18],"60":[13,14,15,16,17,18],"65":[13,14,15,16,17,18],"70":[13,14,15,16,17,18],"75":[13,14,15,16,17,17.5,18],"85":[16]},"225":{"30":[20],"35":[16,17,18,19,20],"40":[15,16,17,18,19,20,23],"45":[13,15,16,17,18,19,21],"50":[13,14,15,16,17,18,19],"55":[13,14,15,16,17,18,19],"60":[13,14,15,16,17,18,19],"65":[13,14,15,16,17,18,19],"70":[13,14,15,16,17,17.5,18,19,19.5],"75":[13,14,15,16,17,17.5,18,19]},"235":{"30":[17,18,19,20,22],"35":[16,17,18,19,20,23],"40":[15,16,17,18,19,20],"45":[15,16,17,18,19,20,21],"50":[13,14,15,16,17,18,19,20,21],"55":[13,14,15,16,17,18,19,20],"60":[13,14,15,16,17,18,19,20],"65":[13,14,15,16,17,18,19],"70":[13,14,15,16,17,18,19],"75":[13,14,15,16,17,17.5,18,19],"80":[13,14,15,16,17,18,19],"85":[13,14,15,16,17,18,19]},"245":{"30":[17,18,19,20,21,22],"35":[16,17,18,19,20,21,23],"40":[15,16,17,18,19,20,21,23],"45":[15,16,17,18,19,20,21],"50":[13,14,15,16,17,18,19,20],"55":[13,14,15,16,17,18,19,20],"60":[13,14,15,16,17,18,19,20],"65":[13,14,15,16,17,18,19,20],"70":[13,14,15,16,17,17.5,18,19,19.5,20],"75":[13,14,15,16,17,18,19,20]},"255":{"25":[19,20],"30":[17,18,19,20,21,22,24],"35":[16,17,18,19,20,21,22,23],"40":[15,16,17,18,19,20,21,22,23],"45":[15,16,17,18,19,20,21,22],"50":[13,14,15,16,17,18,19,20,21],"55":[13,14,15,16,17,18,19,20,21],"60":[13,14,15,16,17,18,19,20],"65":[13,14,15,16,17,18,19,20],"70":[13,14,15,16,17,18,19,20,22.5],"75":[13,14,15,16,17,18,19,20],"80":[17],"85":[16]},"265":{"30":[17,18,19,20,21,22],"35":[16,17,18,19,20,21,22,23,24],"40":[15,16,17,18,19,20,21,22],"45":[15,16,17,18,19,20,21,22],"50":[13,14,15,16,17,18,19,20,21,22],"55":[13,14,15,16,17,18,19,20,21,22],"60":[13,14,15,16,17,18,19,20,21,22],"65":[13,14,15,16,17,18,19,20,21,22],"70":[13,14,15,16,17,17.5,18,19,19.5,20,21,22,22.5],"75":[13,14,15,16,17,18,19,20,21,22]},"275":{"25":[19,20,21,22,24],"30":[17,18,19,20,21,22,23,24],"35":[16,17,18,19,20,21,22,23,24],"40":[15,16,17,18,19,20,21,22,23,24],"45":[15,16,17,18,19,20,21,22],"50":[13,14,15,16,17,18,19,20,21,22,24],"55":[13,14,15,16,17,18,19,20,21,22],"60":[13,14,15,16,17,18,19,20,21,22],"65":[13,14,15,16,17,18,19,20,21,22],"70":[13,14,15,16,17,18,19,20,21,22,22.5],"75":[13,14,15,16,17,18,19,20,21,22],"80":[17,22.5,24.5]},"285":{"25":[19,20,21,22],"30":[17,18,19,20,21,22,23,24],"35":[16,17,18,19,20,21,22,23,24],"40":[15,16,17,18,19,20,21,22,23,24],"45":[15,16,17,18,19,20,21,22],"50":[13,14,15,16,17,18,19,20,21,22],"55":[13,14,15,16,17,18,19,20,21,22],"60":[13,14,15,16,17,18,19,20,21,22],"65":[13,14,15,16,17,18,19,20,21,22],"70":[13,14,15,16,17,18,19,19.5,20,21,22,22.5],"75":[13,14,15,16,17,18,19,20,21,22,22.5,24.5]},"295":{"25":[19,20,21,22,26,28],"30":[17,18,19,20,21,22,23,24,26],"35":[16,17,18,19,20,21,22,23,24],"40":[15,16,17,18,19,20,21,22],"45":[15,16,17,18,19,20,21,22,24],"50":[13,14,15,16,17,18,19,20,21,22],"55":[13,14,15,16,17,18,19,20,21,22],"60":[13,14,15,16,17,18,19,20,21,22,22.5],"65":[13,14,15,16,17,18,19,20,21,22],"70":[13,14,15,16,17,18,19,20,21,22],"75":[13,14,15,16,17,18,19,20,21,22,22.5,24.5],"80":[13,14,15,16,17,18,19,20,21,22,22.5]},"305":{"25":[19,20,21,22],"30":[17,18,19,20,21,22,23,24,26],"35":[16,17,18,19,20,21,22,23,24],"40":[15,16,17,18,19,20,21,22,23],"45":[15,16,17,18,19,20,21,22],"50":[13,14,15,16,17,18,19,20,21,22],"55":[13,14,15,16,17,18,19,20,21,22],"60":[13,14,15,16,17,18,19,20,21,22],"65":[13,14,15,16,17,18,19,20,21,22],"70":[13,14,15,16,17,18,19,19.5,20,21,22,22.5],"75":[13,14,15,16,17,18,19,20,21,22],"80":[13,14,15,16,17,18,19,20,21,22],"85":[13,14,15,16,17,18,19,20,21,22],"90":[13,14,15,16,17,18,19,20,21,22]},"315":{"25":[19,20,21,22,23],"30":[17,18,19,20,21,22,23,24,30],"35":[16,17,18,19,20,21,22],"40":[15,16,17,18,19,20,21,22,26],"45":[15,16,17,18,19,20,21,22,24],"50":[13,14,15,16,17,18,19,20,21,22,24],"55":[13,14,15,16,17,18,19,20,21,22],"60":[13,14,15,16,17,18,19,20,21,22],"65":[13,14,15,16,17,18,19,20,21,22],"70":[13,14,15,16,17,18,19,20,21,22,22.5],"75":[13,14,15,16,17,18,19,20,21,22],"80":[13,14,15,16,17,18,19,20,21,22,22.5]},"325":{"25":[19,20,21,22],"30":[17,18,19,20,21,22,23,24],"35":[16,17,18,19,20,21,22,23,24,28],"40":[15,16,17,18,19,20,21,22],"45":[15,16,17,18,19,20,21,22,24],"50":[13,14,15,16,17,18,19,20,21,22],"55":[13,14,15,16,17,18,19,20,21,22],"60":[13,14,15,16,17,18,19,20,21,22],"65":[18]},"335":{"25":[19,20,21,22],"30":[17,18,19,20,21,22,23,24],"35":[16,17,18,19,20,21,22],"40":[15,16,17,18,19,20,21,22],"45":[15,16,17,18,19,20,21,22],"50":[13,14,15,16,17,18,19,20,21,22]},"345":{"25":[19,20,21,22],"30":[17,18,19,20,21,22],"35":[15,16,17,18,19,20,21,22],"40":[15,16,17,18,19,20,21,22],"60":[17]},"355":{"25":[19,21,22],"30":[19],"40":[22,24]},"375":{"20":[21],"40":[24],"45":[22]},"385":{"55":[22.5],"65":[22.5],"70":[16]},"425":{"65":[22.5]},"445":{"50":[22.5],"65":[22.5]}};
  const PCT_FLOTATION_SIZES=["22X10.00R10","22X10.00R12","22X11.00R10","22X11.00R12","22X7.00R10","22X7.00R12","22X8.00R10","22X8.00R12","23X10.00R10","23X10.00R12","23X11.00R10","23X11.00R12","23X8.00R10","23X8.00R12","23X8.50R12","24X10.00R11","24X10.00R12","24X11.00R10","24X11.00R12","24X11.00R14","24X12.00R12","24X8.00R12","24X9.00R12","25X10.00R12","25X10.00R14","25X11.00R12","25X11.00R14","25X8.00R12","26X10.00R12","26X10.00R14","26X11.00R12","26X11.00R14","26X12.00R12","26X12.00R14","26X8.00R12","26X8.00R14","26X9.00R12","26X9.00R14","27X11.00R12","27X11.00R14","27X12.00R14","27X8.50R14","27X9.00R12","27X9.00R14","28X10.00R12","28X10.00R14","28X10.00R18","28X11.00R14","28X12.00R14","28X9.00R14","29X10.00R15","29X11.00R14","29X9.00R14","30X10.00R14","30X10.00R15","30X10.00R16","30X11.00R14","30X9.50R15","31X10.00R14","31X10.00R15","31X10.50R15","32X10.00R14","32X10.00R15","32X10.00R16","32X11.50R15","32X11.50R17","32X9.50R15","33X10.00R15","33X10.00R18","33X10.00R20","33X10.50R15","33X10.50R17","33X10.50R18","33X11.50R15","33X11.50R17","33X11.50R18","33X11.50R20","33X12.50R15","33X12.50R16","33X12.50R17","33X12.50R18","33X12.50R20","33X12.50R22","33X12.50R24","33X13.50R15","33X13.50R17","33X13.50R20","33X13.50R22","33X13.50R24","33X15.50R16.5","33X9.00R15","34X10.50R17","34X11.50R20","35X10.00R15","35X10.00R16","35X10.00R18","35X10.00R20","35X10.50R17","35X11.00R15","35X11.50R15","35X11.50R16","35X11.50R17","35X11.50R18","35X11.50R20","35X12.50R15","35X12.50R17","35X12.50R18","35X12.50R20","35X12.50R22","35X12.50R24","35X12.50R26","35X12.50R28","35X13.50R15","35X13.50R17","35X13.50R20","35X13.50R22","35X13.50R24","35X13.50R26","35X14.50R15","35X14.50R17","35X14.50R20","35X15.50R20","35X15.50R22","35X9.00R15","37X11.50R17","37X11.50R18","37X11.50R20","37X12.50R16.5","37X12.50R17","37X12.50R18","37X12.50R20","37X12.50R22","37X12.50R26","37X13.50R17","37X13.50R18","37X13.50R20","37X13.50R22","37X13.50R24","37X13.50R26","37X14.50R15","37X14.50R17","37X14.50R20","37X14.50R22","37X14.50R24","38X11.50R17","38X11.50R18","38X11.50R20","38X12.50R17","38X13.50R17","38X13.50R18","38X13.50R20","38X13.50R22","38X13.50R24","38X14.50R17","38X14.50R20","38X15.50R15","38X15.50R18","38X15.50R20","38X15.50R22","38X15.50R24","38X15.50R26","39X13.50R17","40X12.50R17","40X12.50R18","40X13.50R17","40X13.50R18","40X13.50R20","40X14.50R17","40X14.50R20","40X14.50R22","40X15.50R20","40X15.50R22","40X15.50R24","40X15.50R26","40X15.50R28","42X13.50R17","42X13.50R20","42X14.50R17","42X14.50R20","42X14.50R24","42X15.50R20","42X15.50R22","42X15.50R24","42X15.50R26","42X15.50R28","42X16.50R30","44X16.50R30"];

  const MM_PER_IN = 25.4;

  /* ---------- Parsing -------------------------------------------------- */
  // Accepts: 225/60R17, P225/60R17, LT265/70R17, 225/60 R 17, 225-60-17,
  //          255/35ZR19, 225/60R17 99H, 33x12.50R18, 33X12.50R18LT, 35x12.5-20
  function parseSize(input) {
    if (!input) return null;
    let s = String(input).toUpperCase().replace(/\s+/g, '');
    s = s.replace(/^(P|LT|C|T|ST)(?=\d)/, '');
    // flotation: 33X12.50R18
    let m = s.match(/^(\d{2}(?:\.\d+)?)X(\d{1,2}(?:\.\d+)?)[R-]?(\d{2}(?:\.\d)?)/);
    if (m) {
      const diaIn = parseFloat(m[1]), widIn = parseFloat(m[2]), rim = parseFloat(m[3]);
      if (!(diaIn > rim)) return null;
      return makeFlotation(diaIn, widIn, rim);
    }
    // metric: 225/60R17  225/60-17  225-60-17  255/35ZR19
    m = s.match(/^(\d{3})[\/-](\d{2,3})(?:Z?R|-)?(\d{2}(?:\.\d)?)/);
    if (m) {
      return makeMetric(parseInt(m[1], 10), parseInt(m[2], 10), parseFloat(m[3]));
    }
    return null;
  }

  function makeMetric(width, aspect, rim) {
    if (!(width >= 100 && width <= 445 && aspect >= 20 && aspect <= 95 && rim >= 10 && rim <= 30)) return null;
    const sidewallMm = width * aspect / 100;
    const diameterMm = rim * MM_PER_IN + 2 * sidewallMm;
    return finish({
      type: 'metric', width, aspect, rim,
      label: width + '/' + aspect + 'R' + fmtRim(rim),
      sectionMm: width, sidewallMm, diameterMm
    });
  }

  function makeFlotation(diaIn, widIn, rim) {
    const diameterMm = diaIn * MM_PER_IN;
    const sectionMm = widIn * MM_PER_IN;
    const sidewallMm = (diaIn - rim) / 2 * MM_PER_IN;
    const aspect = Math.round(sidewallMm / sectionMm * 100);
    return finish({
      type: 'flotation', width: Math.round(sectionMm), aspect, rim,
      diaIn, widIn,
      label: fmtNum(diaIn) + 'X' + widIn.toFixed(2) + 'R' + fmtRim(rim),
      sectionMm, sidewallMm, diameterMm
    });
  }

  function finish(t) {
    t.circumferenceMm = Math.PI * t.diameterMm;
    t.revsPerKm = 1e6 / t.circumferenceMm;
    t.diameterIn = t.diameterMm / MM_PER_IN;
    t.sidewallIn = t.sidewallMm / MM_PER_IN;
    t.sectionIn = t.sectionMm / MM_PER_IN;
    t.inCatalogue = isInCatalogue(t);
    return t;
  }

  function fmtRim(r) { return Number.isInteger(r) ? String(r) : r.toFixed(1); }
  function fmtNum(n) { return Number.isInteger(n) ? String(n) : String(n); }

  /* ---------- Catalogue lookup ---------------------------------------- */
  function isInCatalogue(t) {
    if (t.type === 'flotation') return PCT_FLOTATION_SIZES.indexOf(t.label) !== -1;
    const w = PCT_METRIC_SIZES[String(t.width)];
    if (!w) return false;
    const a = w[String(t.aspect)];
    return !!a && a.indexOf(t.rim) !== -1;
  }
  function catalogueWidths() { return Object.keys(PCT_METRIC_SIZES).map(Number).sort((a, b) => a - b); }
  function catalogueAspects(width) {
    const w = PCT_METRIC_SIZES[String(width)]; return w ? Object.keys(w).map(Number).sort((a, b) => a - b) : [];
  }
  function catalogueRims(width, aspect) {
    const w = PCT_METRIC_SIZES[String(width)]; return w && w[String(aspect)] ? w[String(aspect)].slice() : [];
  }
  function allMetricSizes() {
    const out = [];
    Object.keys(PCT_METRIC_SIZES).forEach(w => {
      Object.keys(PCT_METRIC_SIZES[w]).forEach(a => {
        PCT_METRIC_SIZES[w][a].forEach(r => out.push(makeMetric(+w, +a, +r)));
      });
    });
    return out;
  }

  /* ---------- Comparison ---------------------------------------------- */
  // delta = (B - A) / A
  function compare(a, b) {
    const dPct = (b.diameterMm - a.diameterMm) / a.diameterMm * 100;
    const rows = [
      { key: 'sectionMm',  label: 'Section width',   unit: 'mm',  a: a.sectionMm,  b: b.sectionMm,  d: b.sectionMm - a.sectionMm, dec: 0 },
      { key: 'aspect',     label: 'Aspect ratio',    unit: '%',   a: a.aspect,     b: b.aspect,     d: b.aspect - a.aspect, dec: 0 },
      { key: 'sidewallMm', label: 'Sidewall height', unit: 'mm',  a: a.sidewallMm, b: b.sidewallMm, d: b.sidewallMm - a.sidewallMm, dec: 1 },
      { key: 'diameterMm', label: 'Overall diameter',unit: 'mm',  a: a.diameterMm, b: b.diameterMm, d: b.diameterMm - a.diameterMm, dec: 1 },
      { key: 'diameterIn', label: 'Overall diameter',unit: 'in',  a: a.diameterIn, b: b.diameterIn, d: b.diameterIn - a.diameterIn, dec: 2 },
      { key: 'circumferenceMm', label: 'Circumference', unit: 'mm', a: a.circumferenceMm, b: b.circumferenceMm, d: b.circumferenceMm - a.circumferenceMm, dec: 0 },
      { key: 'revsPerKm',  label: 'Revolutions',     unit: 'per km', a: a.revsPerKm, b: b.revsPerKm, d: b.revsPerKm - a.revsPerKm, dec: 0 },
      { key: 'rim',        label: 'Rim diameter',    unit: 'in',  a: a.rim,        b: b.rim,        d: b.rim - a.rim, dec: 0 }
    ];
    // Speedometer: when the speedo (calibrated for A) reads S, true speed = S * Db/Da
    const ratio = b.diameterMm / a.diameterMm;
    const speedo = [50, 60, 80, 100, 120].map(s => ({ indicated: s, actual: s * ratio }));
    return { dPct, ratio, rows, speedo, verdict: verdictFor(dPct, a, b) };
  }

  // Industry rule of thumb: keep overall diameter within ±3% of original.
  // Inside ±1.5% most speedometers / ABS / stability systems won't notice.
  function verdictFor(dPct, a, b) {
    const abs = Math.abs(dPct);
    const notes = [];
    let level, title, text;
    if (abs <= 1.5) {
      level = 'good'; title = 'Good fit';
      text = 'Overall diameter is within 1.5% of the original. Speedometer, odometer, ABS and stability control will read essentially the same.';
    } else if (abs <= 3) {
      level = 'warn'; title = 'Borderline';
      text = 'Diameter differs by more than 1.5% but under 3%. Usually workable, but the speedometer will be off by the amount shown below and clearance should be checked at full steering lock and full suspension compression.';
    } else {
      level = 'bad'; title = 'Not recommended';
      text = 'Diameter differs by more than 3%. Expect a noticeably wrong speedometer and odometer, possible ABS / traction-control faults, and clearance problems at the fenders, struts or liners.';
    }
    if (b.sectionMm - a.sectionMm >= 20) notes.push('New tire is ' + Math.round(b.sectionMm - a.sectionMm) + ' mm wider — check inner-fender and strut clearance, and confirm your rim width supports it.');
    if (a.sectionMm - b.sectionMm >= 20) notes.push('New tire is ' + Math.round(a.sectionMm - b.sectionMm) + ' mm narrower — fine for winter, but confirm your rim width is not too wide for it.');
    if (b.rim !== a.rim) notes.push('Rim diameter changes from ' + fmtRim(a.rim) + '" to ' + fmtRim(b.rim) + '" — this needs different wheels. Bolt pattern, offset, centre bore and brake-caliper clearance all have to match your vehicle.');
    if (dPct > 0) notes.push('Larger tire: speedometer reads LOW (you are going faster than shown) and the odometer under-counts.');
    if (dPct < 0) notes.push('Smaller tire: speedometer reads HIGH (you are going slower than shown) and the odometer over-counts.');
    notes.push('Always match or exceed the load index and speed rating on your door-jamb placard. Dimensions alone do not make a tire safe for your vehicle.');
    return { level, title, text, notes };
  }

  /* ---------- Plus / minus sizing ------------------------------------- */
  // Returns candidates from the catalogue on rim (base.rim + step), diameter
  // within maxPct, sorted by closeness of diameter then by expected width.
  function sizingCandidates(base, step, opts) {
    opts = opts || {};
    const maxPct = opts.maxPct || 3;
    const limit = opts.limit || 4;
    const targetRim = base.rim + step;
    const idealWidth = base.width + 10 * step;    // the textbook +10 mm per inch of rim
    const out = [];
    allMetricSizes().forEach(c => {
      if (!c || c.rim !== targetRim) return;
      const dPct = (c.diameterMm - base.diameterMm) / base.diameterMm * 100;
      if (Math.abs(dPct) > maxPct) return;
      // Stay within ±20 mm of the textbook width for that rim — a 275 is not a
      // sensible "plus one" for a car that came on a 225.
      if (Math.abs(c.width - idealWidth) > 20) return;
      const widthPenalty = Math.abs(c.width - idealWidth) / 10;
      out.push({ size: c, dPct, score: Math.abs(dPct) + widthPenalty * 0.6 });
    });
    out.sort((x, y) => x.score - y.score);
    return out.slice(0, limit).map(x => ({ size: x.size, dPct: x.dPct, grade: Math.abs(x.dPct) <= 1.5 ? 'good' : 'warn' }));
  }

  /* ---------- Tread life ---------------------------------------------- */
  const LEGAL_MIN_32 = 2;           // 2/32" = 1.5875 mm; Ontario Reg. 625 says 1.5 mm
  const LEGAL_MIN_MM = 1.5;
  function mmTo32(mm) { return mm / MM_PER_IN * 32; }
  function t32ToMm(t) { return t / 32 * MM_PER_IN; }

  // params: current32, original32, annualKm, kmDriven (opt), treadwear (opt), dateCode (opt: Date)
  function treadLife(p) {
    const cur = p.current32, orig = p.original32;
    const usable = Math.max(0, cur - LEGAL_MIN_32);
    const usableNew = Math.max(0.01, orig - LEGAL_MIN_32);
    const pctRemaining = Math.max(0, Math.min(100, usable / usableNew * 100));
    const worn = Math.max(0, orig - cur);

    // Wear rate (32nds per km). Best → worst evidence:
    let kmRemaining = null, basis = '';
    if (p.kmDriven > 0 && worn > 0) {
      const ratePerKm = worn / p.kmDriven;
      kmRemaining = usable / ratePerKm; basis = 'measured wear over ' + Math.round(p.kmDriven).toLocaleString('en-CA') + ' km';
    } else if (p.treadwear > 0) {
      // Rough UTQG rule of thumb: grade × 100 miles ≈ life of the full usable tread.
      const lifeKm = p.treadwear * 100 * 1.609;
      kmRemaining = lifeKm * (usable / usableNew); basis = 'UTQG treadwear ' + p.treadwear + ' (≈' + Math.round(lifeKm / 1000) + ',000 km when new, rough)';
    } else if (p.kmDriven > 0 && worn === 0) {
      kmRemaining = null; basis = 'no measurable wear yet';
    } else {
      const lifeKm = p.defaultLifeKm || 70000;
      kmRemaining = lifeKm * (usable / usableNew); basis = 'typical all-season life of ' + Math.round(lifeKm / 1000) + ',000 km (no wear data entered)';
    }
    const monthsRemaining = (kmRemaining !== null && p.annualKm > 0) ? kmRemaining / p.annualKm * 12 : null;

    // Verdict by depth first, then by time.
    let level, title, text;
    if (cur <= LEGAL_MIN_32) {
      level = 'bad'; title = 'Replace now';
      text = 'At or below the 1.5 mm (2/32") legal minimum in Ontario. The tire is worn out and can fail a safety inspection.';
    } else if (cur <= 4) {
      level = 'bad'; title = 'Replace soon';
      text = 'Under 4/32" (3.2 mm) a tire has lost most of its wet grip and nearly all of its snow traction. Plan on replacing before the next wet or winter season.';
    } else if (cur <= 6) {
      level = 'warn'; title = 'Watch it';
      text = 'Between 4/32" and 6/32". Still legal and fine in dry weather, but snow and slush performance is fading. Not enough for a full Chatham-Kent winter if these are your winter tires.';
    } else {
      level = 'good'; title = 'Good tread';
      text = 'Plenty of tread. Keep rotating every 8,000–10,000 km and checking pressure monthly.';
    }

    // Age advisory
    let age = null;
    if (p.dateCode instanceof Date && !isNaN(p.dateCode)) {
      const years = (Date.now() - p.dateCode.getTime()) / (365.25 * 864e5);
      age = { years };
      if (years >= 10) { age.level = 'bad'; age.text = 'These tires are ' + years.toFixed(1) + ' years old. Most manufacturers say replace at 10 years regardless of tread.'; if (level !== 'bad') { level = 'bad'; title = 'Replace now (age)'; } }
      else if (years >= 6) { age.level = 'warn'; age.text = 'These tires are ' + years.toFixed(1) + ' years old. Rubber hardens after about 6 years — grip drops even with deep tread. Have them inspected for sidewall cracking each season.'; if (level === 'good') { level = 'warn'; title = 'Good tread, ageing rubber'; } }
      else { age.level = 'good'; age.text = 'Age is not a concern yet (' + years.toFixed(1) + ' years).'; }
    }
    return { usable32: usable, pctRemaining, kmRemaining, monthsRemaining, basis, level, title, text, age,
             currentMm: t32ToMm(cur), originalMm: t32ToMm(orig) };
  }

  // Parse a DOT week/year code like "3823" → Date (Monday of ISO week approx)
  function parseDotCode(code) {
    const m = String(code || '').trim().match(/^(\d{2})(\d{2})$/);
    if (!m) return null;
    const wk = parseInt(m[1], 10), yy = parseInt(m[2], 10);
    if (wk < 1 || wk > 53) return null;
    const year = 2000 + yy;
    const d = new Date(year, 0, 1 + (wk - 1) * 7);
    return d > new Date() ? null : d;
  }

  /* ---------- Formatting helpers -------------------------------------- */
  function fmt(n, dec) { return Number(n).toLocaleString('en-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function fmtSigned(n, dec) { const v = fmt(Math.abs(n), dec); return n > 0 ? '+' + v : n < 0 ? '−' + v : v; }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ---------- Size picker UI (shared by size + plus-sizing pages) ----- */
  // mountPicker(rootEl, { onChange(tire|null), presets:[['Car','205/55R16'],...] })
  // rootEl needs: input.size-text, select.w, select.a, select.r, .chips, .err
  function mountPicker(root, opts) {
    const txt = root.querySelector('.size-text'), selW = root.querySelector('.w'), selA = root.querySelector('.a'), selR = root.querySelector('.r');
    const chips = root.querySelector('.chips'), err = root.querySelector('.err');
    let current = null;

    function opt(sel, values, placeholder, keep) {
      const prev = keep ? sel.value : '';
      sel.innerHTML = '<option value="">' + placeholder + '</option>' + values.map(v => '<option value="' + v + '">' + fmtRim(v) + '</option>').join('');
      if (prev && values.map(String).indexOf(String(prev)) !== -1) sel.value = prev;
    }
    opt(selW, catalogueWidths(), 'Width');
    opt(selA, [], 'Aspect');
    opt(selR, [], 'Rim');

    function emit(t, src) {
      current = t;
      err.textContent = '';
      if (t && !t.inCatalogue) err.textContent = 'We don’t list ' + t.label + ' online, but we can likely order it — call or text 519-397-4686.';
      if (opts.onChange) opts.onChange(t, src);
      markChip();
    }
    function markChip() {
      if (!chips) return;
      chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', !!current && c.dataset.size === current.label));
    }
    function syncSelects(t) {
      if (!t || t.type !== 'metric' || !t.inCatalogue) { selW.value = ''; opt(selA, [], 'Aspect'); opt(selR, [], 'Rim'); return; }
      selW.value = String(t.width);
      opt(selA, catalogueAspects(t.width), 'Aspect'); selA.value = String(t.aspect);
      opt(selR, catalogueRims(t.width, t.aspect), 'Rim'); selR.value = String(t.rim);
    }
    selW.addEventListener('change', () => {
      opt(selA, selW.value ? catalogueAspects(+selW.value) : [], 'Aspect', true);
      opt(selR, (selW.value && selA.value) ? catalogueRims(+selW.value, +selA.value) : [], 'Rim', true);
      fromSelects();
    });
    selA.addEventListener('change', () => {
      opt(selR, (selW.value && selA.value) ? catalogueRims(+selW.value, +selA.value) : [], 'Rim', true);
      fromSelects();
    });
    selR.addEventListener('change', fromSelects);
    function fromSelects() {
      if (!(selW.value && selA.value && selR.value)) { if (current) emit(null, 'select'); return; }
      const t = makeMetric(+selW.value, +selA.value, +selR.value);
      txt.value = t ? t.label : '';
      emit(t, 'select');
    }
    txt.addEventListener('input', () => {
      const t = parseSize(txt.value);
      syncSelects(t);
      if (t) emit(t, 'text'); else if (current) emit(null, 'text');
    });
    txt.addEventListener('blur', () => {
      if (txt.value.trim() && !parseSize(txt.value)) err.textContent = 'Couldn’t read that. Try the format 225/60R17 or 33x12.50R18.';
    });
    if (chips && opts.presets) {
      chips.innerHTML = opts.presets.map(p => '<button type="button" class="chip" data-size="' + p[1] + '">' + p[0] + ' · ' + p[1] + '</button>').join('');
      chips.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        set(b.dataset.size, 'chip');
      });
    }
    function set(label, src) {
      const t = parseSize(label);
      txt.value = t ? t.label : (label || '');
      syncSelects(t);
      emit(t, src || 'set');
    }
    return { set, get: () => current };
  }

  window.PCTCalc = {
    parseSize, makeMetric, makeFlotation, compare, sizingCandidates, treadLife, parseDotCode,
    isInCatalogue, catalogueWidths, catalogueAspects, catalogueRims, allMetricSizes,
    mmTo32, t32ToMm, LEGAL_MIN_32, LEGAL_MIN_MM,
    shopUrl: t => '/?buysize=' + encodeURIComponent(t.label),
    fmtRim, fmt, fmtSigned, esc, mountPicker
  };
})();
