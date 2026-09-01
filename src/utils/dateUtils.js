/**
 * Timezone-safe Date Utilities
 * Ensures dates are not shifted forward/backward by UTC vs Local time conversions.
 */

/**
 * Returns a 'YYYY-MM-DD' formatted string representing the LOCAL date.
 * Does NOT shift via UTC (which causes off-by-one day issues in evening/morning).
 * @param {Date|string|number} [dateVal=new Date()]
 * @returns {string} 'YYYY-MM-DD'
 */
export const getLocalDateString = (dateVal = new Date()) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
      return dateVal.split('T')[0];
    }
  }
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Converts any date representation to 'YYYY-MM-DD' suitable for HTML <input type="date">.
 * Preserves the exact YYYY-MM-DD portion if string is provided.
 * @param {Date|string|number} dateVal
 * @returns {string} 'YYYY-MM-DD'
 */
export const formatDateToInput = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const clean = dateVal.trim();
    if (clean.includes('T')) {
      return clean.split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      return clean.substring(0, 10);
    }
  }
  return getLocalDateString(dateVal);
};

/**
 * Formats a date value into 'DD/MM/YYYY'.
 * Timezone-safe: parses 'YYYY-MM-DD' parts directly to avoid UTC offset shifts.
 * @param {Date|string|number} dateVal
 * @returns {string} 'DD/MM/YYYY' or 'N/A'
 */
export const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return 'N/A';
  if (typeof dateVal === 'string') {
    const clean = dateVal.includes('T') ? dateVal.split('T')[0] : dateVal.trim();
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
  }
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Parses 'YYYY-MM-DD' or other date string into a local Date object.
 * Avoids `new Date("YYYY-MM-DD")` which parses as UTC midnight.
 * @param {string|Date} dateVal
 * @returns {Date}
 */
export const parseLocalDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
    const [y, m, d] = dateVal.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateVal);
};

/**
 * Returns Urdu day name for a given date.
 * @param {string|Date} dateVal
 * @returns {string}
 */
export const getDayNameUrdu = (dateVal) => {
  if (!dateVal) return '';
  const d = parseLocalDate(dateVal);
  if (isNaN(d.getTime())) return '';
  const daysUrdu = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  return daysUrdu[d.getDay()];
};

/**
 * Returns English day name for a given date.
 * @param {string|Date} dateVal
 * @returns {string}
 */
export const getDayNameEnglish = (dateVal) => {
  if (!dateVal) return '';
  const d = parseLocalDate(dateVal);
  if (isNaN(d.getTime())) return '';
  const daysEnglish = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return daysEnglish[d.getDay()];
};
