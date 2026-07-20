// ─────────────────────────────────────────────────
//  PC Tires — Google Sheets Order Logger
//  This is the sheet's Code.gs (deployed as a Web App).
//  After editing, redeploy: Deploy → Manage deployments →
//  (pencil/Edit) → Version: New version → Deploy.
//  The /exec URL stays the same.
// ─────────────────────────────────────────────────

const SHEET_ID = '1fndqHWR16sAJFj7S4HZDQ9tw-_QObzvglzFORPfuomM';

const HEADERS = [
  'Timestamp',
  'Order #',
  'Customer Name',
  'Email',
  'Phone',
  'Email Opt-In (CASL)',
  'VIN',
  'Vehicle',
  'Year',
  'Make',
  'Model',
  'Trim',
  'Search Method',
  'Items Ordered',
  'Add-ons',
  'Subtotal',
  'Add-on Total',
  'Tax',
  'Order Total',
  'Installation Service',
  'Appointment Date',
  'Appointment Time',
];

// Columns for the Service Bookings tab (must match the dispatch script).
const SERVICE_HEADERS = ['Date', 'Time', 'Customer', 'Phone', 'Vehicle', 'Service', 'Notes'];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // ── Service-only bookings (from the website "Book a Service" form) ──
    // Routed here by type:'service'. Writes to the Service Bookings tab so
    // it shows up on the dispatch board. Never touches the Orders tab.
    if (data.type === 'service') {
      let svcSheet = ss.getSheetByName('Service Bookings');
      if (!svcSheet) {
        svcSheet = ss.insertSheet('Service Bookings');
        svcSheet.appendRow(SERVICE_HEADERS);
        svcSheet.getRange(1, 1, 1, SERVICE_HEADERS.length)
          .setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#f5c518');
        svcSheet.setFrozenRows(1);
      }
      svcSheet.appendRow([
        data.preferredDate  || '',
        data.preferredTime  || '',
        data.customerName   || '',
        data.customerPhone  || '',
        data.vehicle        || '',
        data.service        || '',
        data.notes          || '',
      ]);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', type: 'service' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Orders sheet ──────────────────────────────
    let ordersSheet = ss.getSheetByName('Orders');
    if (!ordersSheet) {
      ordersSheet = ss.insertSheet('Orders');
      ordersSheet.appendRow(HEADERS);
      ordersSheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#1a1a1a')
        .setFontColor('#f5c518');
      ordersSheet.setFrozenRows(1);
    }

    ordersSheet.appendRow([
      data.timestamp        || new Date().toISOString(),
      data.orderNumber      || '',
      data.customerName     || '',
      data.customerEmail    || '',
      data.customerPhone    || '',
      data.caslOptIn        || 'No',
      data.vin              || '',
      data.vehicle          || '',
      data.vehicleYear      || '',
      data.vehicleMake      || '',
      data.vehicleModel     || '',
      data.vehicleTrim      || '',
      data.searchMethod     || '',
      data.items            || '',
      data.addons           || '',
      data.subtotal         || '',
      data.addonTotal       || '',
      data.tax              || '',
      data.total            || '',
      data.installationService || '',
      data.appointmentDate  || '',
      data.appointmentTime  || '',
    ]);

    // ── Email list sheet (CASL opt-ins only) ──────
    if (data.caslOptIn === 'Yes' && data.customerEmail) {
      let emailSheet = ss.getSheetByName('Email List');
      if (!emailSheet) {
        emailSheet = ss.insertSheet('Email List');
        emailSheet.appendRow(['Date Added', 'Name', 'Email', 'Phone', 'Vehicle', 'VIN', 'Source']);
        emailSheet.getRange(1, 1, 1, 7)
          .setFontWeight('bold')
          .setBackground('#1a1a1a')
          .setFontColor('#f5c518');
        emailSheet.setFrozenRows(1);
      }
      // Only add if email not already in list
      const existing = emailSheet.getDataRange().getValues().flat();
      if (!existing.includes(data.customerEmail)) {
        emailSheet.appendRow([
          new Date().toLocaleDateString('en-CA'),
          data.customerName    || '',
          data.customerEmail   || '',
          data.customerPhone   || '',
          data.vehicle         || '',
          data.vin             || '',
          'pctires.ca checkout',
        ]);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function — run manually to verify sheet access
function testWrite() {
  doPost({ postData: { contents: JSON.stringify({
    timestamp: new Date().toISOString(),
    orderNumber: 'PCT-TEST01',
    customerName: 'Caleb Postma',
    customerEmail: 'calebpostma@gmail.com',
    customerPhone: '519-380-5104',
    caslOptIn: 'Yes',
    vin: '2GCUKREC4P1234567',
    vehicle: '2023 Chevrolet Silverado 1500 LT Trail Boss',
    vehicleYear: '2023',
    vehicleMake: 'Chevrolet',
    vehicleModel: 'Silverado 1500',
    vehicleTrim: 'LT Trail Boss',
    searchMethod: 'vin',
    items: '4× Pirelli Scorpion XTM AT (275/65R18)',
    addons: 'Wiper Blade Replacement, Torque Re-check',
    subtotal: '345.08',
    addonTotal: '29.99',
    tax: '48.71',
    total: '523.78',
    installationService: '4-Tire Mount & Balance',
    appointmentDate: 'March 15, 2026',
    appointmentTime: '10:00 AM',
  })}});
}

// Test function — service booking path
function testServiceWrite() {
  doPost({ postData: { contents: JSON.stringify({
    type: 'service',
    service: 'Seasonal Swap',
    customerName: 'Test Customer',
    customerPhone: '519-000-0000',
    customerEmail: 'test@example.com',
    vehicle: '2021 Ford F-150',
    notes: 'Tires stored on site',
    preferredDate: 'July 25, 2026',
    preferredTime: '10:00 AM',
  })}});
}
