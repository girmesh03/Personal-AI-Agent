import {
  gregorianToJdn,
  jdnToEthiopian,
  ethiopianToGregorianDate,
  ethiopianToJdn,
  jdnToGregorian,
  ETHIOPIAN_MONTHS,
} from '../src/utils/ethiopianCalendar.js';

function extractYMD(input) {
  if (!input) return null;
  if (input && typeof input.year === 'function' && typeof input.date === 'function') {
    return { year: input.year(), month: input.month() + 1, day: input.date() };
  }
  if (typeof input === 'string') {
    const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
  }
  if (input instanceof Date) {
    return { year: input.getFullYear(), month: input.getMonth() + 1, day: input.getDate() };
  }
  const d = new Date(input);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function fixedToEthiopianDate(input) {
  const ymd = extractYMD(input);
  if (!ymd) return null;
  const jdn = gregorianToJdn(ymd.year, ymd.month, ymd.day);
  return jdnToEthiopian(jdn);
}

// 30 random dates across 1990-2030 (Gregorian and Ethiopian known anchors)
const validationSuite = [
  // 1-7: Ethiopian New Year (Enkutatash) & Millennium
  { name: 'Millennium 2000 (Meskerem 1)', g: '2007-09-12', e: { year: 2000, month: 1, day: 1 } },
  { name: 'New Year 1994 (Meskerem 1)', g: '2001-09-11', e: { year: 1994, month: 1, day: 1 } },
  { name: 'New Year 2016 (Post-leap Meskerem 1)', g: '2023-09-12', e: { year: 2016, month: 1, day: 1 } },
  { name: 'New Year 2017 (Meskerem 1)', g: '2024-09-11', e: { year: 2017, month: 1, day: 1 } },
  { name: 'New Year 2018 (Meskerem 1)', g: '2025-09-11', e: { year: 2018, month: 1, day: 1 } },
  { name: 'New Year 2019 (Meskerem 1)', g: '2026-09-11', e: { year: 2019, month: 1, day: 1 } },
  { name: 'New Year 2020 (Post-leap Meskerem 1)', g: '2027-09-12', e: { year: 2020, month: 1, day: 1 } },

  // 8-15: Pagume (Month 13) boundaries
  { name: 'Pagume 1, 2015', g: '2023-09-06', e: { year: 2015, month: 13, day: 1 } },
  { name: 'Pagume 5, 2015', g: '2023-09-10', e: { year: 2015, month: 13, day: 5 } },
  { name: 'Pagume 6, 2015 (Leap Day)', g: '2023-09-11', e: { year: 2015, month: 13, day: 6 } },
  { name: 'Pagume 1, 2016', g: '2024-09-06', e: { year: 2016, month: 13, day: 1 } },
  { name: 'Pagume 5, 2016 (Common final day)', g: '2024-09-10', e: { year: 2016, month: 13, day: 5 } },
  { name: 'Pagume 1, 2018', g: '2026-09-06', e: { year: 2018, month: 13, day: 1 } },
  { name: 'Pagume 5, 2018 (Common final day)', g: '2026-09-10', e: { year: 2018, month: 13, day: 5 } },
  { name: 'Pagume 6, 2019 (Leap Day)', g: '2027-09-11', e: { year: 2019, month: 13, day: 6 } },

  // 16-20: Month 2 (Tikimt / October)
  { name: 'Tikimt 1, 2019', g: '2026-10-11', e: { year: 2019, month: 2, day: 1 } },
  { name: 'Tikimt 14, 2019 (Report date)', g: '2026-10-24', e: { year: 2019, month: 2, day: 14 } },
  { name: 'Tikimt 16, 2019 (Current date)', g: '2026-10-26', e: { year: 2019, month: 2, day: 16 } },
  { name: 'Tikimt 30, 2019 (Month 2 final day)', g: '2026-11-09', e: { year: 2019, month: 2, day: 30 } },
  { name: 'Tikimt 16, 2017', g: '2024-10-26', e: { year: 2017, month: 2, day: 16 } },

  // 21-25: Month 3 (Hidar), Month 4 (Tahsas), Month 5 (Tir)
  { name: 'Hidar 1, 2019', g: '2026-11-10', e: { year: 2019, month: 3, day: 1 } },
  { name: 'Tahsas 22, 1992 (Y2K)', g: '2000-01-01', e: { year: 1992, month: 4, day: 22 } },
  { name: 'Tahsas 28, 2016 (Genna post-leap)', g: '2024-01-07', e: { year: 2016, month: 4, day: 28 } },
  { name: 'Tahsas 29, 2017 (Genna common)', g: '2025-01-07', e: { year: 2017, month: 4, day: 29 } },
  { name: 'Tir 11, 2016 (Timkat post-leap)', g: '2024-01-20', e: { year: 2016, month: 5, day: 11 } },
  { name: 'Tir 11, 2017 (Timkat common)', g: '2025-01-19', e: { year: 2017, month: 5, day: 11 } },

  // 26-30: Month 6 (Yekatit), Month 8 (Miazia), Month 12 (Nehase)
  { name: 'Yekatit 21, 2016 (GC Leap day)', g: '2024-02-29', e: { year: 2016, month: 6, day: 21 } },
  { name: 'Yekatit 23, 2016 (Adwa Victory)', g: '2024-03-02', e: { year: 2016, month: 6, day: 23 } },
  { name: 'Miazia 27, 2016 (Patriots Day)', g: '2024-05-05', e: { year: 2016, month: 8, day: 27 } },
  { name: 'Nehase 22, 2016', g: '2024-08-28', e: { year: 2016, month: 12, day: 22 } },
  { name: 'Nehase 30, 2018', g: '2026-09-05', e: { year: 2018, month: 12, day: 30 } },
];

console.log('========================================================================================');
console.log('   ETHIOPIAN-GREGORIAN BIDIRECTIONAL VALIDATION MATRIX (30 RANDOM VERIFIED DATES)');
console.log('========================================================================================\n');

let passed = 0;
let failed = 0;

validationSuite.forEach((item, idx) => {
  // 1. Convert Gregorian string to Ethiopian:
  const ethCalc = fixedToEthiopianDate(item.g);
  const ethPass = ethCalc.year === item.e.year && ethCalc.month === item.e.month && ethCalc.day === item.e.day;

  // 2. Convert Ethiopian components back to Gregorian:
  const gregCalc = ethiopianToGregorianDate(item.e.year, item.e.month, item.e.day);
  const gregPass = gregCalc.isoDate === item.g;

  const monthName = ETHIOPIAN_MONTHS[item.e.month - 1].name;
  const status = (ethPass && gregPass) ? 'PASS' : 'FAIL';

  if (ethPass && gregPass) {
    passed++;
    console.log(`[${String(idx + 1).padStart(2, '0')}] ✅ ${status} | ${item.g} <---> ${monthName} ${item.e.day}, ${item.e.year} (${item.name})`);
  } else {
    failed++;
    console.log(`[${String(idx + 1).padStart(2, '0')}] ❌ ${status} | ${item.g} -> Eth: ${JSON.stringify(ethCalc)} (Expected: ${JSON.stringify(item.e)}), Greg: ${gregCalc.isoDate} (Expected: ${item.g}) (${item.name})`);
  }
});

console.log(`\n========================================================================================`);
console.log(`   VALIDATION SUMMARY: ${passed}/${validationSuite.length} PASSED (${Math.round((passed / validationSuite.length) * 100)}%)`);
console.log(`========================================================================================\n`);
