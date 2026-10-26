/**
 * @module utils/ethiopianCalendar
 * @description Bidirectional Ethiopian-Gregorian calendar conversion utility using Julian Day Number (JDN) algorithms.
 * Used for dynamic derivation of Ethiopian dates across reports, date filters, and UI displays.
 */

/**
 * Converts a Gregorian date (year, month 1-12, day 1-31) to Julian Day Number (JDN).
 * @param {number} year - Gregorian year (e.g., 2026).
 * @param {number} month - Gregorian month (1-12).
 * @param {number} day - Gregorian day of month (1-31).
 * @returns {number} Julian Day Number.
 */
export function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Converts a Julian Day Number (JDN) to Gregorian date components.
 * @param {number} jdn - Julian Day Number.
 * @returns {{ year: number, month: number, day: number }} Gregorian date components.
 */
export function jdnToGregorian(jdn) {
  const l = jdn + 68569;
  const n = Math.floor((4 * l) / 146097);
  const l2 = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l2 + 1)) / 1461001);
  const l3 = l2 - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l3) / 2447);
  const day = l3 - Math.floor((2447 * j) / 80);
  const l4 = Math.floor(j / 11);
  const month = j + 2 - 12 * l4;
  const year = 100 * (n - 49) + i + l4;
  return { year, month, day };
}

/**
 * Converts a Julian Day Number (JDN) to Ethiopian date components.
 * @param {number} jdn - Julian Day Number.
 * @returns {{ year: number, month: number, day: number }} Ethiopian date components.
 */
export function jdnToEthiopian(jdn) {
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

/**
 * Converts Ethiopian date components to Julian Day Number (JDN).
 * @param {number} year - Ethiopian year (e.g., 2019).
 * @param {number} month - Ethiopian month (1-13).
 * @param {number} day - Ethiopian day (1-30, or 1-6 for Pagume).
 * @returns {number} Julian Day Number.
 */
export function ethiopianToJdn(year, month, day) {
  return 1723856 + 365 * year + Math.floor(year / 4) + 30 * (month - 1) + day - 1;
}

/**
 * Converts a JS Date, Dayjs instance, timestamp, or ISO date string to Ethiopian calendar date components.
 * Safely extracts Gregorian Y-M-D components without timezone distortion (eliminates UTC midnight off-by-one shifts).
 * @param {Date|object|string|number} dateInput - Date object, Dayjs instance, timestamp, or ISO string.
 * @returns {{ year: number, month: number, day: number }|null} Ethiopian date object.
 */
export function toEthiopianDate(dateInput) {
  if (!dateInput) return null;
  let year, month, day;

  // Dayjs instance
  if (dateInput && typeof dateInput.year === 'function' && typeof dateInput.date === 'function') {
    year = dateInput.year();
    month = dateInput.month() + 1;
    day = dateInput.date();
  } else if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      year = parseInt(m[1], 10);
      month = parseInt(m[2], 10);
      day = parseInt(m[3], 10);
    }
  } else if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return null;
    year = dateInput.getFullYear();
    month = dateInput.getMonth() + 1;
    day = dateInput.getDate();
  }

  // Fallback for timestamps or arbitrary objects
  if (!year || !month || !day) {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }

  const jdn = gregorianToJdn(year, month, day);
  return jdnToEthiopian(jdn);
}

/**
 * Formats a Gregorian date into an Ethiopian date string formatted as DD-MM-YY.
 * @param {Date|string|number} dateInput - Date object, timestamp, or ISO string.
 * @returns {string|null} Formatted Ethiopian date string (e.g. "11-02-19").
 */
export function toEthiopianDateString(dateInput) {
  if (!dateInput) return null;
  const eth = toEthiopianDate(dateInput);
  if (!eth) return null;
  const dd = String(eth.day).padStart(2, '0');
  const mm = String(eth.month).padStart(2, '0');
  const yy = String(eth.year).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

/**
 * The 13 Ethiopian months with official English names, Amharic script references, and standard day counts.
 * In accordance with Ethiopian calendar laws and application language requirements, the year begins in September:
 * Month 1 (Meskerem) is September, Month 2 (Tikimt) is October, ..., Month 12 (Nehase) is August,
 * and Month 13 is strictly Pagume (5 days, 6 in leap years where year % 4 === 3).
 * Transliterated Amharic names (e.g. Meskerem, Tikimt) are permanently purged in favor of English.
 */
export const ETHIOPIAN_MONTHS = Object.freeze([
  { id: 1, name: 'September', amharic: 'መስከረም', days: 30 },
  { id: 2, name: 'October', amharic: 'ጥቅምት', days: 30 },
  { id: 3, name: 'November', amharic: 'ኅዳር', days: 30 },
  { id: 4, name: 'December', amharic: 'ታኅሣሥ', days: 30 },
  { id: 5, name: 'January', amharic: 'ጥር', days: 30 },
  { id: 6, name: 'February', amharic: 'የካቲት', days: 30 },
  { id: 7, name: 'March', amharic: 'መጋቢት', days: 30 },
  { id: 8, name: 'April', amharic: 'ሚያዝያ', days: 30 },
  { id: 9, name: 'May', amharic: 'ግንቦት', days: 30 },
  { id: 10, name: 'June', amharic: 'ሰኔ', days: 30 },
  { id: 11, name: 'July', amharic: 'ሐምሌ', days: 30 },
  { id: 12, name: 'August', amharic: 'ነሐሴ', days: 30 },
  { id: 13, name: 'Pagume', amharic: 'ጳጉሜ', days: 5 }, // 6 days in leap years where year % 4 === 3
]);

/**
 * Days of the week in English and Amharic, indexed 0 = Sunday to 6 = Saturday.
 */
export const ETHIOPIAN_DAYS_OF_WEEK = Object.freeze([
  { id: 0, short: 'Sun', amharicShort: 'እሁድ', name: 'Sunday' },
  { id: 1, short: 'Mon', amharicShort: 'ሰኞ', name: 'Monday' },
  { id: 2, short: 'Tue', amharicShort: 'ማክሰ', name: 'Tuesday' },
  { id: 3, short: 'Wed', amharicShort: 'ረቡዕ', name: 'Wednesday' },
  { id: 4, short: 'Thu', amharicShort: 'ሐሙስ', name: 'Thursday' },
  { id: 5, short: 'Fri', amharicShort: 'አርብ', name: 'Friday' },
  { id: 6, short: 'Sat', amharicShort: 'ቅዳሜ', name: 'Saturday' },
]);

/**
 * Returns number of days in an Ethiopian month, accounting for leap years in Pagume.
 * @param {number} year - Ethiopian year (e.g. 2019)
 * @param {number} month - Ethiopian month (1 to 13)
 * @returns {number} 30 for months 1-12; 5 or 6 for month 13 (Pagume)
 */
export function getDaysInEthiopianMonth(year, month) {
  if (month >= 1 && month <= 12) return 30;
  if (month === 13) {
    // In Ethiopian calendar, leap year occurs when (year % 4 === 3)
    return year % 4 === 3 ? 6 : 5;
  }
  return 30;
}

/**
 * Gets day-of-week index (0 = Sunday ... 6 = Saturday) for an Ethiopian date.
 * @param {number} year - Ethiopian year.
 * @param {number} month - Ethiopian month (1-13).
 * @param {number} day - Ethiopian day (1-30).
 * @returns {number} 0 (Sun) to 6 (Sat).
 */
export function getDayOfWeekForEthiopianDate(year, month, day) {
  const jdn = ethiopianToJdn(year, month, day);
  return (jdn + 1) % 7;
}

/**
 * Converts Ethiopian date components to Gregorian Date object and YYYY-MM-DD ISO string.
 * @param {number} year - Ethiopian year.
 * @param {number} month - Ethiopian month.
 * @param {number} day - Ethiopian day.
 * @returns {{ date: Date, isoDate: string, year: number, month: number, day: number }}
 */
export function ethiopianToGregorianDate(year, month, day) {
  const jdn = ethiopianToJdn(year, month, day);
  const greg = jdnToGregorian(jdn);
  const yStr = String(greg.year).padStart(4, '0');
  const mStr = String(greg.month).padStart(2, '0');
  const dStr = String(greg.day).padStart(2, '0');
  const isoDate = `${yStr}-${mStr}-${dStr}`;
  // Construct date in UTC noon to avoid timezone shift
  const date = new Date(Date.UTC(greg.year, greg.month - 1, greg.day, 12, 0, 0));
  return { date, isoDate, year: greg.year, month: greg.month, day: greg.day };
}

/**
 * Formats Ethiopian date object into full human-readable string in strictly 100% English.
 * @param {{ year: number, month: number, day: number }} eth - Ethiopian date components.
 * @param {boolean} [includeAmharic=false] - Deprecated parameter; app language mandate strictly requires English.
 * @returns {string} Formatted English string, e.g. "February 14, 2019".
 */
export function formatEthiopianFullDate(eth, includeAmharic = false) {
  if (!eth || !eth.year || !eth.month || !eth.day) return '';
  const monthMeta = ETHIOPIAN_MONTHS[eth.month - 1] || { name: `Month ${eth.month}`, amharic: '' };
  return `${monthMeta.name} ${eth.day}, ${eth.year}`;
}

/**
 * Parses an Ethiopian date string (formats: "DD-MM-YY", "YYYY-MM-DD", or { year, month, day }).
 * @param {string|object} input - Ethiopian date string or object.
 * @returns {{ year: number, month: number, day: number }|null}
 */
export function parseEthiopianDate(input) {
  if (!input) return null;
  if (typeof input === 'object' && input.year && input.month && input.day) {
    return { year: Number(input.year), month: Number(input.month), day: Number(input.day) };
  }
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();

  // If input is an ISO string (YYYY-MM-DD or full timestamp), it is strictly Gregorian.
  // Convert directly via toEthiopianDate to avoid treating Gregorian 2026 as Ethiopian year 2026!
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split('-');
    const yearCandidate = parseInt(parts[0], 10);
    // Ethiopian calendar is ~7-8 years behind Gregorian; any 4-digit year >= 2020 is Gregorian.
    if (yearCandidate >= 2020) {
      return toEthiopianDate(trimmed);
    }
    const ethConv = toEthiopianDate(trimmed);
    if (ethConv) return ethConv;
  }

  // Pattern: DD-MM-YY or DD-MM-YYYY
  const parts = trimmed.split('-');
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    // If year was passed first (YYYY-MM-DD)
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
      if (year >= 2020) {
        return toEthiopianDate(new Date(Date.UTC(year, month - 1, day)));
      }
    } else if (year < 100) {
      // 2-digit year e.g. '19' -> 2019
      year += 2000;
    }

    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return { year, month, day };
    }
  }

  return null;
}

/**
 * Computes human-readable duration between clockIn and clockOut strings in HH:mm format.
 * @param {string} clockIn - Arrival time (HH:mm).
 * @param {string} clockOut - Departure time (HH:mm).
 * @returns {string} Formatted duration string (e.g. "8h 30m" or "3h 00m").
 */
export function computeShiftDuration(clockIn, clockOut) {
  if (!clockIn || !clockOut) return '';
  const inParts = String(clockIn).split(':').map(Number);
  const outParts = String(clockOut).split(':').map(Number);
  if (inParts.length < 2 || outParts.length < 2) return '';

  let inMinutes = inParts[0] * 60 + inParts[1];
  let outMinutes = outParts[0] * 60 + outParts[1];

  // Handle shift crossing midnight
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60;
  }

  const diff = outMinutes - inMinutes;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export default {
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_DAYS_OF_WEEK,
  gregorianToJdn,
  jdnToGregorian,
  jdnToEthiopian,
  ethiopianToJdn,
  toEthiopianDate,
  toEthiopianDateString,
  getDaysInEthiopianMonth,
  getDayOfWeekForEthiopianDate,
  ethiopianToGregorianDate,
  formatEthiopianFullDate,
  parseEthiopianDate,
  computeShiftDuration,
};
