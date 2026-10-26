/**
 * @module utils/AdapterEthiopianDayjs
 * @description Localized Material-UI DatePicker adapter subclassing AdapterDayjs for authentic
 * 13-month Ethiopian calendar calculations in 100% English UI Chrome.
 * Scoped locally to MuiDatePicker to guarantee 100% collision immunity across the platform.
 */

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {
  toEthiopianDate,
  ethiopianToGregorianDate,
  getDaysInEthiopianMonth,
  getDayOfWeekForEthiopianDate,
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_DAYS_OF_WEEK,
} from './ethiopianCalendar.js';

export class AdapterEthiopianDayjs extends AdapterDayjs {
  getYear = (value) => {
    if (!value || !value.isValid()) return null;
    const eth = toEthiopianDate(value);
    return eth ? eth.year : null;
  };

  getMonth = (value) => {
    if (!value || !value.isValid()) return null;
    const eth = toEthiopianDate(value);
    return eth ? eth.month - 1 : null; // 0-indexed: 0..12
  };

  getDate = (value) => {
    if (!value || !value.isValid()) return null;
    const eth = toEthiopianDate(value);
    return eth ? eth.day : null;
  };

  getDaysInMonth = (value) => {
    if (!value || !value.isValid()) return 30;
    const eth = toEthiopianDate(value);
    return eth ? getDaysInEthiopianMonth(eth.year, eth.month) : 30;
  };

  startOfMonth = (value) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value.startOf('month');
    const greg = ethiopianToGregorianDate(eth.year, eth.month, 1);
    return dayjs(greg.isoDate);
  };

  endOfMonth = (value) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value.endOf('month');
    const lastDay = getDaysInEthiopianMonth(eth.year, eth.month);
    const greg = ethiopianToGregorianDate(eth.year, eth.month, lastDay);
    return dayjs(greg.isoDate);
  };

  startOfYear = (value) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value.startOf('year');
    const greg = ethiopianToGregorianDate(eth.year, 1, 1);
    return dayjs(greg.isoDate);
  };

  endOfYear = (value) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value.endOf('year');
    const lastDay = getDaysInEthiopianMonth(eth.year, 13);
    const greg = ethiopianToGregorianDate(eth.year, 13, lastDay);
    return dayjs(greg.isoDate);
  };

  addMonths = (value, count) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value.add(count, 'month');
    let totalMonths = eth.year * 13 + (eth.month - 1) + count;
    let newYear = Math.floor(totalMonths / 13);
    let newMonth = (totalMonths % 13) + 1;
    let maxDays = getDaysInEthiopianMonth(newYear, newMonth);
    let newDay = Math.min(eth.day, maxDays);
    const greg = ethiopianToGregorianDate(newYear, newMonth, newDay);
    return dayjs(greg.isoDate);
  };

  addYears = (value, count) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value.add(count, 'year');
    let newYear = eth.year + count;
    let maxDays = getDaysInEthiopianMonth(newYear, eth.month);
    let newDay = Math.min(eth.day, maxDays);
    const greg = ethiopianToGregorianDate(newYear, eth.month, newDay);
    return dayjs(greg.isoDate);
  };

  setYear = (value, year) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value;
    const maxDays = getDaysInEthiopianMonth(year, eth.month);
    const newDay = Math.min(eth.day, maxDays);
    const greg = ethiopianToGregorianDate(year, eth.month, newDay);
    return dayjs(greg.isoDate);
  };

  setMonth = (value, monthIndex) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value;
    const newMonth = monthIndex + 1;
    const maxDays = getDaysInEthiopianMonth(eth.year, newMonth);
    const newDay = Math.min(eth.day, maxDays);
    const greg = ethiopianToGregorianDate(eth.year, newMonth, newDay);
    return dayjs(greg.isoDate);
  };

  setDate = (value, day) => {
    const eth = toEthiopianDate(value);
    if (!eth) return value;
    const greg = ethiopianToGregorianDate(eth.year, eth.month, day);
    return dayjs(greg.isoDate);
  };

  isSameMonth = (value, comparing) => {
    if (!value || !comparing) return false;
    const ethA = toEthiopianDate(value);
    const ethB = toEthiopianDate(comparing);
    if (!ethA || !ethB) return false;
    return ethA.year === ethB.year && ethA.month === ethB.month;
  };

  isSameYear = (value, comparing) => {
    if (!value || !comparing) return false;
    const ethA = toEthiopianDate(value);
    const ethB = toEthiopianDate(comparing);
    if (!ethA || !ethB) return false;
    return ethA.year === ethB.year;
  };

  isSameDay = (value, comparing) => {
    if (!value || !comparing) return false;
    const ethA = toEthiopianDate(value);
    const ethB = toEthiopianDate(comparing);
    if (!ethA || !ethB) return false;
    return ethA.year === ethB.year && ethA.month === ethB.month && ethA.day === ethB.day;
  };

  getMonthArray = (value) => {
    const eth = toEthiopianDate(value);
    const year = eth ? eth.year : this.getYear(value);
    const months = [];
    for (let m = 1; m <= 13; m++) {
      const greg = ethiopianToGregorianDate(year, m, 1);
      months.push(dayjs(greg.isoDate));
    }
    return months;
  };

  format = (value, formatKey) => {
    if (!value || !value.isValid()) return '';
    const eth = toEthiopianDate(value);
    if (!eth) return '';
    const monthObj = ETHIOPIAN_MONTHS[eth.month - 1] || { name: `Month ${eth.month}` };
    const monthName = monthObj.name;
    const monthShort = monthName.slice(0, 3);
    const day = eth.day;
    const dd = String(day).padStart(2, '0');
    const mm = String(eth.month).padStart(2, '0');
    const yy = String(eth.year).slice(-2);
    const year = eth.year;
    const dayOfWeek = value.day();
    const dayObj = ETHIOPIAN_DAYS_OF_WEEK[dayOfWeek] || { short: 'Sun', name: 'Sunday' };

    switch (formatKey) {
      case 'year':
        return String(year);
      case 'month':
        return monthName;
      case 'monthShort':
        return monthShort;
      case 'dayOfMonth':
        return String(day);
      case 'fullDate':
        return `${monthName} ${day}, ${year}`;
      case 'keyboardDate':
        return `${dd}-${mm}-${yy}`;
      case 'shortDate':
        return `${monthShort} ${day}`;
      case 'normalDate':
        return `${day} ${monthName}`;
      case 'weekday':
        return dayObj.name;
      case 'weekdayShort':
        return dayObj.short;
      default:
        return this.formatByString(value, this.formats[formatKey] || 'YYYY-MM-DD');
    }
  };

  formatByString = (value, formatString) => {
    if (!value || !value.isValid()) return '';
    const eth = toEthiopianDate(value);
    if (!eth) return '';
    const monthObj = ETHIOPIAN_MONTHS[eth.month - 1] || { name: `Month ${eth.month}` };
    const monthName = monthObj.name;
    const monthShort = monthName.slice(0, 3);
    const day = eth.day;
    const dd = String(day).padStart(2, '0');
    const mm = String(eth.month).padStart(2, '0');
    const yy = String(eth.year).slice(-2);
    const year = eth.year;
    const dayOfWeek = value.day();
    const dayObj = ETHIOPIAN_DAYS_OF_WEEK[dayOfWeek] || { short: 'Sun', name: 'Sunday' };

    return formatString
      .replace(/YYYY/g, String(year))
      .replace(/YY/g, yy)
      .replace(/MMMM/g, monthName)
      .replace(/MMM/g, monthShort)
      .replace(/MM/g, mm)
      .replace(/DD/g, dd)
      .replace(/D/g, String(day))
      .replace(/dddd/g, dayObj.name)
      .replace(/ddd/g, dayObj.short)
      .replace(/dd/g, dayObj.short.slice(0, 2))
      .replace(/\bd\b/g, String(dayOfWeek));
  };
}

export default AdapterEthiopianDayjs;
