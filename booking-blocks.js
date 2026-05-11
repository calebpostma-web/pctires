// ─────────────────────────────────────────────────────────────────────────
//  PC TIRES — BOOKING TIME BLOCKS
//
//  Edit this file to control when appointments can/can't be booked.
//  Push to GitHub and changes are live in ~90 seconds.
//
//  Used by:  swap.html  (and eventually the #services section on index.html)
// ─────────────────────────────────────────────────────────────────────────

const BOOKING_BLOCKS = {

  // Days closed entirely — format 'YYYY-MM-DD'
  // Add/remove holidays, vacation days, etc.
  closedDates: [
    '2026-05-19',  // Victoria Day
    '2026-07-01',  // Canada Day
    '2026-08-03',  // Civic Holiday
    '2026-09-07',  // Labour Day
    '2026-10-12',  // Thanksgiving
    '2026-11-11',  // Remembrance Day
    '2026-12-25',  // Christmas
    '2026-12-26',  // Boxing Day
    '2027-01-01',  // New Year's Day
  ],

  // Weekdays closed every week (0=Sun, 1=Mon, ... 6=Sat)
  closedWeekdays: [0],  // Sundays closed

  // Specific time slots blocked on specific dates
  // Use when you have a personal appointment, vacation half-day, etc.
  // Format: 'YYYY-MM-DD': ['10:00 AM', '10:30 AM', '11:00 AM']
  blockedSlots: {
    // '2026-05-15': ['9:00 AM', '9:30 AM'],   // example: HVAC service call that morning
  },

  // Time slots blocked EVERY day (e.g. lunch break)
  // Leave empty if you don't want a fixed lunch block
  dailyBlocked: [
    // '12:00 PM',
    // '12:30 PM',
  ],

  // Business hours — first bookable slot to last
  hoursStart: '8:00 AM',
  hoursEnd: '5:00 PM',           // last bookable slot Mon-Fri
  saturdayHoursEnd: '3:00 PM',   // earlier close Saturday

  // Booking window
  minLeadHours: 24,    // earliest a customer can book is 24h from now
  maxAdvanceDays: 60,  // furthest out a customer can book is 60 days
};

// ─────────────────────────────────────────────────────────────────────────
//  HELPER FUNCTIONS — used by booking pages, don't edit unless you mean to
// ─────────────────────────────────────────────────────────────────────────

function bb_parseTime(s) {
  // '8:00 AM' -> minutes from midnight (e.g. 480)
  if (!s) return 0;
  const m = s.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function bb_formatTime(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const period = h24 < 12 ? 'AM' : 'PM';
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + period;
}

function bb_isDateBlocked(yyyymmdd) {
  if (!yyyymmdd) return true;
  const date = new Date(yyyymmdd + 'T12:00:00');
  if (BOOKING_BLOCKS.closedDates.includes(yyyymmdd)) return true;
  if (BOOKING_BLOCKS.closedWeekdays.includes(date.getDay())) return true;
  return false;
}

function bb_isSlotBlocked(yyyymmdd, time) {
  if (BOOKING_BLOCKS.dailyBlocked.includes(time)) return true;
  const blocks = BOOKING_BLOCKS.blockedSlots[yyyymmdd] || [];
  return blocks.includes(time);
}

// Returns available time slots for a given YYYY-MM-DD string
function bb_getAvailableSlots(yyyymmdd) {
  if (!yyyymmdd || bb_isDateBlocked(yyyymmdd)) return [];
  const date = new Date(yyyymmdd + 'T12:00:00');
  const isSaturday = date.getDay() === 6;
  const endTime = isSaturday ? BOOKING_BLOCKS.saturdayHoursEnd : BOOKING_BLOCKS.hoursEnd;
  const slots = [];
  let cur = bb_parseTime(BOOKING_BLOCKS.hoursStart);
  const end = bb_parseTime(endTime);
  while (cur <= end) {
    const timeStr = bb_formatTime(cur);
    if (!bb_isSlotBlocked(yyyymmdd, timeStr)) slots.push(timeStr);
    cur += 30; // 30-minute slots
  }
  return slots;
}

// Min/max dates for booking inputs — respects minLeadHours and maxAdvanceDays
function bb_getDateRange() {
  const now = new Date();
  const min = new Date(now.getTime() + BOOKING_BLOCKS.minLeadHours * 3600 * 1000);
  // bump to next non-closed day
  while (bb_isDateBlocked(bb_toYMD(min))) {
    min.setDate(min.getDate() + 1);
  }
  const max = new Date(now);
  max.setDate(max.getDate() + BOOKING_BLOCKS.maxAdvanceDays);
  return { min: bb_toYMD(min), max: bb_toYMD(max) };
}

function bb_toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
