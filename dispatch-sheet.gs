/**
 * PC TIRES — DISPATCH SHEET BUILDER
 * ------------------------------------------------------------------
 * Adds a clean, colour-coded "Dispatch" tab to the PCTires Customer
 * List sheet: upcoming installs grouped by day, sorted by time, with
 * the customer, phone, vehicle, tires and service laid out like a
 * dispatch board. Rebuild any time from the "PC Tires" menu.
 *
 * INSTALL (one time) — this project ALREADY contains the order
 * logger in Code.gs. Do NOT delete or edit Code.gs.
 *   1. In Apps Script, add a NEW script file (+ next to Files) named
 *      "Dispatch". Paste ONLY this code into it (no myFunction wrapper).
 *   2. Save.
 *   3. Reload the sheet. A "PC Tires" menu appears in the menu bar.
 *   4. PC Tires -> Refresh Dispatch (or run buildDispatch once from the
 *      editor). Approve the permission prompt the first time.
 *
 * OPTIONAL — auto-refresh every morning:
 *   Apps Script -> Triggers (clock icon) -> Add Trigger ->
 *   function: buildDispatch, event: Time-driven, Day timer, 6am-7am.
 * ------------------------------------------------------------------
 */

var BRAND_YELLOW = '#f5c518';
var DARK         = '#1d1d1d';
var LIGHT_GREY   = '#f4f4f4';
var BAND         = '#fafafa';
var RED          = '#c0392b';
var GREEN        = '#1e8f4e';

// Columns shown on the board, in order.
// (Named DISPATCH_COLS so it can't clash with the order logger's HEADERS in Code.gs.)
var DISPATCH_COLS = ['Time', 'Customer', 'Phone', 'Vehicle', 'Tires', 'Service', 'Notes'];
var COL_WIDTHS = [78, 160, 128, 170, 320, 200, 170];

// Tab where service-only jobs (swap, rotation, repair) are entered by hand.
var SERVICE_TAB = 'Service Bookings';
var SERVICE_COLS = ['Date', 'Time', 'Customer', 'Phone', 'Vehicle', 'Service', 'Notes'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PC Tires')
    .addItem('Refresh Dispatch', 'buildDispatch')
    .addSeparator()
    .addItem('Add Service Booking', 'addServiceBooking')
    .addToUi();
}

// Create the Service Bookings tab (with a styled header) if it doesn't exist yet.
function ensureServiceTab(ss) {
  var sh = ss.getSheetByName(SERVICE_TAB);
  if (sh) return sh;
  sh = ss.insertSheet(SERVICE_TAB);
  sh.getRange(1, 1, 1, SERVICE_COLS.length).setValues([SERVICE_COLS])
    .setFontWeight('bold').setBackground('#1a1a1a').setFontColor(BRAND_YELLOW);
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 120); sh.setColumnWidth(2, 90); sh.setColumnWidth(3, 160);
  sh.setColumnWidth(4, 128); sh.setColumnWidth(5, 170); sh.setColumnWidth(6, 200);
  sh.setColumnWidth(7, 220);
  return sh;
}

// Guided "add a service-only job" flow from the PC Tires menu.
function addServiceBooking() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureServiceTab(ss);

  function ask(label) {
    var res = ui.prompt('Add Service Booking', label, ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return null;
    return res.getResponseText().trim();
  }

  var date = ask('Appointment date  (e.g. July 25, 2026)');            if (date === null) return;
  var time = ask('Time  (e.g. 10:00 AM  — leave blank if unsure)');    if (time === null) return;
  var name = ask('Customer name');                                     if (name === null) return;
  var phone = ask('Phone');                                            if (phone === null) return;
  var vehicle = ask('Vehicle  (optional, e.g. 2021 F-150)');           if (vehicle === null) return;
  var service = ask('Service  (e.g. Seasonal Swap, Rotation, Flat Repair)'); if (service === null) return;

  sh.appendRow([date, time, name, phone, vehicle, service, '']);
  ss.toast('Service booking added for ' + name + '. Rebuilding board…', 'PC Tires', 3);
  buildDispatch();
}

function buildDispatch() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();

  // --- 1. Find the orders tab by its header row (robust to tab name) ---
  var src = null, headerRowIdx = -1, cols = null;
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var vals = sheets[s].getDataRange().getValues();
    for (var r = 0; r < Math.min(3, vals.length); r++) {
      var row = vals[r].map(function (x) { return String(x).trim(); });
      if (row.indexOf('Appointment Date') > -1 && row.indexOf('Customer Name') > -1) {
        src = sheets[s]; headerRowIdx = r; cols = row; break;
      }
    }
    if (src) break;
  }
  if (!src) {
    SpreadsheetApp.getUi().alert('Could not find the orders tab (looked for "Appointment Date" + "Customer Name" columns).');
    return;
  }

  var idx = function (name) { return cols.indexOf(name); };
  var iDate = idx('Appointment Date'), iTime = idx('Appointment Time'),
      iName = idx('Customer Name'), iPhone = idx('Phone'), iVeh = idx('Vehicle'),
      iItems = idx('Items Ordered'), iSvc = idx('Installation Service'), iOrd = idx('Order #');

  var all = src.getDataRange().getValues().slice(headerRowIdx + 1);

  // --- 2. Build the job list: upcoming, de-duped, sorted ---
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var seen = {}, jobs = [];
  for (var i = 0; i < all.length; i++) {
    var row = all[i];
    var dateStr = String(row[iDate] || '').trim();
    if (!dateStr) continue;                 // no appointment date -> not on the board
    var d = parseApptDate(dateStr);
    if (!d || d < today) continue;          // skip unparseable + past dates

    var name = String(row[iName] || '').trim();
    var time = String(row[iTime] || '').trim();
    var key = name.toLowerCase() + '|' + dateStr + '|' + time;
    if (seen[key]) continue;                // drop double-submits
    seen[key] = true;

    jobs.push({
      d: d,
      time: time,
      name: name,
      phone: String(row[iPhone] || '').trim(),
      veh: String(row[iVeh] || '').trim(),
      items: String(row[iItems] || '').trim(),
      svc: String(row[iSvc] || '').trim(),
      notes: ''
    });
  }

  // --- 2b. Merge in service-only bookings from the Service Bookings tab ---
  ensureServiceTab(ss);
  var svcSheet = ss.getSheetByName(SERVICE_TAB);
  if (svcSheet && svcSheet.getLastRow() > 1) {
    var sv = svcSheet.getDataRange().getValues();
    var sHead = sv[0].map(function (x) { return String(x).trim(); });
    var sI = function (n) { return sHead.indexOf(n); };
    var sD = sI('Date'), sT = sI('Time'), sN = sI('Customer'),
        sP = sI('Phone'), sV = sI('Vehicle'), sS = sI('Service'), sNo = sI('Notes');
    for (var k = 1; k < sv.length; k++) {
      var rr = sv[k];
      var ds = String(rr[sD] || '').trim();
      if (!ds) continue;
      var dd = parseApptDate(ds);
      if (!dd || dd < today) continue;
      jobs.push({
        d: dd,
        time: String(rr[sT] || '').trim(),
        name: String(rr[sN] || '').trim(),
        phone: String(rr[sP] || '').trim(),
        veh: String(rr[sV] || '').trim(),
        items: '',
        svc: String(rr[sS] || '').trim(),
        notes: String(rr[sNo] || '').trim()
      });
    }
  }

  jobs.sort(function (a, b) {
    return (a.d - b.d) || (timeToMin(a.time) - timeToMin(b.time));
  });

  // --- 3. Fresh Dispatch tab ---
  var old = ss.getSheetByName('Dispatch');
  if (old) ss.deleteSheet(old);
  var sh = ss.insertSheet('Dispatch', 0);
  sh.setHiddenGridlines(true);
  for (var c = 0; c < COL_WIDTHS.length; c++) sh.setColumnWidth(c + 1, COL_WIDTHS[c]);

  var NC = DISPATCH_COLS.length;
  var rowPtr = 1;

  // Title band
  sh.getRange(rowPtr, 1, 1, NC).merge()
    .setValue('🛞  PC TIRES — DISPATCH')
    .setBackground(BRAND_YELLOW).setFontColor('#0a0a0a')
    .setFontSize(16).setFontWeight('bold')
    .setVerticalAlignment('middle');
  sh.setRowHeight(rowPtr, 34);
  rowPtr++;

  var stamp = Utilities.formatDate(new Date(), tz, "EEE MMM d, yyyy 'at' h:mm a");
  sh.getRange(rowPtr, 1, 1, NC).merge()
    .setValue('Updated ' + stamp + '  ·  ' + jobs.length + ' upcoming install' + (jobs.length === 1 ? '' : 's'))
    .setBackground(DARK).setFontColor('#bbbbbb').setFontSize(10).setFontStyle('italic');
  rowPtr++;
  rowPtr++; // spacer

  if (!jobs.length) {
    sh.getRange(rowPtr, 1, 1, NC).merge()
      .setValue('No upcoming installs booked. New bookings from the website appear here automatically after a refresh.')
      .setFontColor('#888888').setFontStyle('italic');
    sh.setFrozenRows(2);
    SpreadsheetApp.getActiveSpreadsheet().toast('Dispatch refreshed — 0 upcoming.', 'PC Tires', 3);
    return;
  }

  // --- 4. Render grouped by day ---
  var curDayKey = null, band = false;
  for (var j = 0; j < jobs.length; j++) {
    var job = jobs[j];
    var dayKey = Utilities.formatDate(job.d, tz, 'yyyy-MM-dd');

    if (dayKey !== curDayKey) {
      curDayKey = dayKey;
      band = false;

      var isToday = dayKey === Utilities.formatDate(today, tz, 'yyyy-MM-dd');
      var label = Utilities.formatDate(job.d, tz, 'EEEE  ·  MMMM d').toUpperCase()
                + (isToday ? '   — TODAY' : '');
      sh.getRange(rowPtr, 1, 1, NC).merge()
        .setValue(label)
        .setBackground(isToday ? BRAND_YELLOW : DARK)
        .setFontColor(isToday ? '#0a0a0a' : '#ffffff')
        .setFontWeight('bold').setFontSize(12).setVerticalAlignment('middle');
      sh.setRowHeight(rowPtr, 26);
      rowPtr++;

      // Column headers
      sh.getRange(rowPtr, 1, 1, NC).setValues([DISPATCH_COLS])
        .setBackground(LIGHT_GREY).setFontColor('#333333')
        .setFontWeight('bold').setFontSize(9);
      rowPtr++;
    }

    var timeCell = job.time ? prettyTime(job.time) : '— set time';
    var rowVals = [[timeCell, job.name, job.phone, job.veh, job.items, job.svc, job.notes || '']];
    var rng = sh.getRange(rowPtr, 1, 1, NC);
    rng.setValues(rowVals).setFontSize(10).setVerticalAlignment('middle')
       .setWrap(false);
    rng.setBackground(band ? BAND : '#ffffff');
    sh.setRowHeight(rowPtr, 24);

    // Time cell styling
    var tCell = sh.getRange(rowPtr, 1);
    if (job.time) tCell.setFontWeight('bold').setFontColor('#0a0a0a');
    else tCell.setFontColor(RED).setFontStyle('italic').setFontWeight('bold');

    // Highlight "Not booked" service as a soft flag
    if (job.svc && job.svc.toLowerCase() === 'not booked') {
      sh.getRange(rowPtr, 6).setFontColor('#999999').setFontStyle('italic');
    }

    band = !band;
    rowPtr++;
  }

  sh.setFrozenRows(2);
  SpreadsheetApp.getActiveSpreadsheet().toast('Dispatch refreshed — ' + jobs.length + ' upcoming.', 'PC Tires', 3);
}

// "July 22, 2026" / "Jul 22 2026" / ISO -> Date (local midnight), or null.
function parseApptDate(s) {
  if (!s) return null;
  var d = new Date(s);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// "16:30" / "9:00" / "9:00 AM" -> minutes from midnight. Blank -> 9999 (sorts last).
function timeToMin(s) {
  s = String(s || '').trim();
  if (!s) return 9999;
  var m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 9999;
  var h = parseInt(m[1], 10), min = parseInt(m[2], 10), ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

// "16:30" -> "4:30 PM"
function prettyTime(s) {
  var mins = timeToMin(s);
  if (mins === 9999) return s;
  var h = Math.floor(mins / 60), m = mins % 60;
  var ap = h < 12 ? 'AM' : 'PM';
  var h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ':' + ('0' + m).slice(-2) + ' ' + ap;
}
