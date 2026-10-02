/**
 * @module utils/transliterate
 * @description Bidirectional Ethiopian Ge'ez (Amharic) <-> Latin transliteration engine
 * and operational branch code generator. Enables bilingual branch discovery and automated
 * short-code synthesis for operational reporting.
 */

/**
 * Curated dictionary of common Addis Ababa operational locations, subcities, and landmarks.
 * Provides accurate contextual transliterations beyond pure syllabic approximation.
 * @constant
 * @type {Readonly<Record<string, { latin: string[], amharic: string }>>}
 */
const CURATED_LOCATIONS = Object.freeze({
  'ቦሌ': { latin: ['bole'], amharic: 'ቦሌ' },
  'ቦሌ መድኃኔዓለም': { latin: ['bole medhanialem', 'bole medhanealem'], amharic: 'ቦሌ መድኃኔዓለም' },
  'ቦሌ መድሃኒአለም': { latin: ['bole medhanialem', 'bole medhanealem'], amharic: 'ቦሌ መድኃኔዓለም' },
  'ፒያሳ': { latin: ['piassa', 'piazza', 'piyasa'], amharic: 'ፒያሳ' },
  'መገናኛ': { latin: ['megnagna', 'megenagna', 'megenanya'], amharic: 'መገናኛ' },
  'ሲኤምሲ': { latin: ['cmc'], amharic: 'ሲኤምሲ' },
  'ሳርቤት': { latin: ['sarbet', 'sar bet'], amharic: 'ሳርቤት' },
  'ሳር ቤት': { latin: ['sarbet', 'sar bet'], amharic: 'ሳርቤት' },
  'ካዛንቺስ': { latin: ['kazanchis', 'kazanchise'], amharic: 'ካዛንቺስ' },
  'ጀሞ': { latin: ['jemo'], amharic: 'ጀሞ' },
  'ጎተራ': { latin: ['gotera'], amharic: 'ጎተራ' },
  'አራት ኪሎ': { latin: ['arat kilo', '4 kilo'], amharic: 'አራት ኪሎ' },
  'ስድስት ኪሎ': { latin: ['sidist kilo', '6 kilo'], amharic: 'ስድስት ኪሎ' },
  'ሃያ ሁለት': { latin: ['haya hulet', '22'], amharic: 'ሃያ ሁለት' },
  'ገርጂ': { latin: ['gerji'], amharic: 'ገርጂ' },
  'ሰሚት': { latin: ['summit', 'semit'], amharic: 'ሰሚት' },
  'ለቡ': { latin: ['lebu'], amharic: 'ለቡ' },
  'ቃሊቲ': { latin: ['kaliti', 'qality', 'kality'], amharic: 'ቃሊቲ' },
  'አየር ጤና': { latin: ['ayer tena', 'ayertena'], amharic: 'አየር ጤና' },
  'ጦር ኃይሎች': { latin: ['tor hailoch', 'torhayloch'], amharic: 'ጦር ኃይሎች' },
  'ሜክሲኮ': { latin: ['mexico', 'meksiko'], amharic: 'ሜክሲኮ' },
  'ቄራ': { latin: ['kera', 'qera'], amharic: 'ቄራ' },
  'ብስራተ ገብርኤል': { latin: ['bisrate gabriel', 'bisrate gebriel'], amharic: 'ብስራተ ገብርኤል' },
  'ሀያት': { latin: ['hayat'], amharic: 'ሀያት' },
  'ኮተቤ': { latin: ['kotebe'], amharic: 'ኮተቤ' },
  'ሳሪስ': { latin: ['saris'], amharic: 'ሳሪስ' },
  'ፈረንሳይ': { latin: ['ferensay', 'french legation'], amharic: 'ፈረንሳይ' },
  'ሺሮ ሜዳ': { latin: ['shiro meda', 'shiromeda'], amharic: 'ሺሮ ሜዳ' },
  'መርካቶ': { latin: ['merkato', 'mercato'], amharic: 'መርካቶ' },
  'አውቶቡስ ተራ': { latin: ['autobus tera', 'autobus'], amharic: 'አውቶቡስ ተራ' },
  'ላምበረት': { latin: ['lamberet'], amharic: 'ላምበረት' },
  'አያት': { latin: ['ayat'], amharic: 'አያት' },
  'ጃክሮስ': { latin: ['jackros'], amharic: 'ጃክሮስ' },
  'ጎፋ': { latin: ['gofa'], amharic: 'ጎፋ' },
  'ጎፋ ገብርኤል': { latin: ['gofa gabriel', 'gofa gebriel'], amharic: 'ጎፋ ገብርኤል' },
  'ቡልቡላ': { latin: ['bulbula'], amharic: 'ቡልቡላ' },
  'ተክለሃይማኖት': { latin: ['teklehaimanot'], amharic: 'ተክለሃይማኖት' },
  'ፒኮክ': { latin: ['peacock'], amharic: 'ፒኮክ' },
});

/**
 * Syllabic Ge'ez Fidel to Latin phonetic mapping table.
 * Covers primary consonants across all 7 orders.
 * @constant
 * @type {Readonly<Record<string, string>>}
 */
const FIDEL_TO_LATIN = Object.freeze({
  // ሀ series
  'ሀ': 'ha', 'ሁ': 'hu', 'ሂ': 'hi', 'ሃ': 'ha', 'ሄ': 'he', 'ህ': 'h', 'ሆ': 'ho',
  // ለ series
  'ለ': 'le', 'ሉ': 'lu', 'ሊ': 'li', 'ላ': 'la', 'ሌ': 'le', 'ል': 'l', 'ሎ': 'lo', 'ሏ': 'lwa',
  // ሐ series
  'ሐ': 'ha', 'ሑ': 'hu', 'ሒ': 'hi', 'ሓ': 'ha', 'ሔ': 'he', 'ሕ': 'h', 'ሖ': 'ho', 'Host': 'hwa',
  // መ series
  'መ': 'me', 'ሙ': 'mu', 'ሚ': 'mi', 'ማ': 'ma', 'ሜ': 'me', 'ም': 'm', 'ሞ': 'mo', 'ሟ': 'mwa',
  // ሠ series
  'ሠ': 'se', 'ሡ': 'su', 'ሢ': 'si', 'ሣ': 'sa', 'ሤ': 'se', 'ሥ': 's', 'ሦ': 'so',
  // ረ series
  'ረ': 're', 'ሩ': 'ru', 'ሪ': 'ri', 'ራ': 'ra', 'ሬ': 're', 'ር': 'r', 'ሮ': 'ro', 'ሯ': 'rwa',
  // ሰ series
  'ሰ': 'se', 'ሱ': 'su', 'ሲ': 'si', 'ሳ': 'sa', 'ሴ': 'se', 'ስ': 's', 'ሶ': 'so', 'ሷ': 'swa',
  // ሸ series
  'ሸ': 'she', 'ሹ': 'shu', 'ሺ': 'shi', 'ሻ': 'sha', 'ሼ': 'she', 'ሽ': 'sh', 'ሾ': 'sho', 'ሿ': 'shwa',
  // ቀ series
  'ቀ': 'qe', 'ቁ': 'qu', 'ቂ': 'qi', 'ቃ': 'qa', 'ቄ': 'qe', 'ቅ': 'q', 'ቆ': 'qo', 'ቋ': 'qwa',
  // በ series
  'በ': 'be', 'ቡ': 'bu', 'ቢ': 'bi', 'ባ': 'ba', 'ቤ': 'be', 'ብ': 'b', 'ቦ': 'bo', 'ቧ': 'bwa',
  // ቨ series
  'ቨ': 've', 'ቩ': 'vu', 'ቪ': 'vi', 'ቫ': 'va', 'ቬ': 've', 'ቭ': 'v', 'ቮ': 'vo',
  // ተ series
  'ተ': 'te', 'ቱ': 'tu', 'ቲ': 'ti', 'ታ': 'ta', 'ቴ': 'te', 'ት': 't', 'ቶ': 'to', 'ቷ': 'twa',
  // ቸ series
  'ቸ': 'che', 'ቹ': 'chu', 'ቺ': 'chi', 'ቻ': 'cha', 'ቼ': 'che', 'ች': 'ch', 'ቾ': 'cho', 'ቿ': 'chwa',
  // ኀ series
  'ኀ': 'ha', 'ኁ': 'hu', 'ኂ': 'hi', 'ኃ': 'ha', 'ኄ': 'he', 'ኅ': 'h', 'ኆ': 'ho',
  // ነ series
  'ነ': 'ne', 'ኑ': 'nu', 'ኒ': 'ni', 'ና': 'na', 'ኔ': 'ne', 'ን': 'n', 'ኖ': 'no', 'ኗ': 'nwa',
  // ኘ series
  'ኘ': 'nye', 'ኙ': 'nyu', 'ኚ': 'nyi', 'ኛ': 'nya', 'ኜ': 'nye', 'ኝ': 'ny', 'ኞ': 'nyo', 'ኟ': 'nywa',
  // አ series
  'አ': 'a', 'ኡ': 'u', 'ኢ': 'i', 'ኣ': 'a', 'ኤ': 'e', 'እ': 'e', 'ኦ': 'o',
  // ከ series
  'ከ': 'ke', 'ኩ': 'ku', 'ኪ': 'ki', 'ካ': 'ka', 'ኬ': 'ke', 'ክ': 'k', 'ኮ': 'ko', 'ኳ': 'kwa',
  // ኸ series
  'ኸ': 'he', 'ኹ': 'hu', 'ኺ': 'hi', 'ኻ': 'ha', 'ኼ': 'he', 'ኽ': 'h', 'ኾ': 'ho',
  // ወ series
  'ወ': 'we', 'ዉ': 'wu', 'ዊ': 'wi', 'ዋ': 'wa', 'ዌ': 'we', 'ው': 'w', 'ዎ': 'wo',
  // ዐ series
  'ዐ': 'a', 'ዑ': 'u', 'ዒ': 'i', 'ዓ': 'a', 'ዔ': 'e', 'ዕ': 'e', 'ዖ': 'o',
  // ዘ series
  'ዘ': 'ze', 'ዙ': 'zu', 'ዚ': 'zi', 'ዛ': 'za', 'ዜ': 'ze', 'ዝ': 'z', 'ዞ': 'zo', 'ዟ': 'zwa',
  // ዠ series
  'ዠ': 'zhe', 'ዡ': 'zhu', 'ዢ': 'zhi', 'ዣ': 'zha', 'ዤ': 'zhe', 'ዥ': 'zh', 'ዦ': 'zho',
  // የ series
  'የ': 'ye', 'ዩ': 'yu', 'ዪ': 'yi', 'ያ': 'ya', 'ዬ': 'ye', 'ይ': 'y', 'ዮ': 'yo',
  // ደ series
  'ደ': 'de', 'ዱ': 'du', 'ዲ': 'di', 'ዳ': 'da', 'ዴ': 'de', 'ድ': 'd', 'ዶ': 'do', 'ዷ': 'dwa',
  // ጀ series
  'ጀ': 'je', 'ጁ': 'ju', 'ጂ': 'ji', 'ጃ': 'ja', 'ጄ': 'je', 'ጅ': 'j', 'ጆ': 'jo', 'ጇ': 'jwa',
  // ገ series
  'ገ': 'ge', 'ጉ': 'gu', 'ጊ': 'gi', 'ጋ': 'ga', 'ጌ': 'ge', 'ግ': 'g', 'ጎ': 'go', 'ጓ': 'gwa',
  // ጠ series
  'ጠ': 'te', 'ጡ': 'tu', 'ጢ': 'ti', 'ጣ': 'ta', 'ጤ': 'te', 'ጥ': 't', 'ጦ': 'to', 'ጧ': 'twa',
  // ጨ series
  'ጨ': 'che', 'ጩ': 'chu', 'ጪ': 'chi', 'ጫ': 'cha', 'ጬ': 'che', 'ጭ': 'ch', 'ጮ': 'cho', 'ጯ': 'chwa',
  // ጰ series
  'ጰ': 'pe', 'ጱ': 'pu', 'ጲ': 'pi', 'ጳ': 'pa', 'ጴ': 'pe', 'ጵ': 'p', 'ጶ': 'po',
  // ጸ series
  'ጸ': 'tse', 'ጹ': 'tsu', 'ጺ': 'tsi', 'ጻ': 'tsa', 'ጼ': 'tse', 'ጽ': 'ts', 'ጾ': 'tso',
  // ፀ series
  'ፀ': 'tse', 'ፁ': 'tsu', 'ፂ': 'tsi', 'ፃ': 'tsa', 'ፄ': 'tse', 'ፅ': 'ts', 'ፆ': 'tso',
  // ፈ series
  'ፈ': 'fe', 'ፉ': 'fu', 'ፊ': 'fi', 'ፋ': 'fa', 'ፌ': 'fe', 'ፍ': 'f', 'ፎ': 'fo', 'ፏ': 'fwa',
  // ፐ series
  'ፐ': 'pe', 'ፑ': 'pu', 'ፒ': 'pi', 'ፓ': 'pa', 'ፔ': 'pe', 'ፕ': 'p', 'ፖ': 'po',
});

/**
 * Checks whether the input string contains any Ge'ez/Ethiopic Unicode characters.
 * @function hasEthiopic
 * @param {string} text - Candidate string.
 * @returns {boolean} True if string contains Ethiopic characters.
 */
export const hasEthiopic = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /[\u1200-\u137F]/.test(text);
};

/**
 * Algorithmic syllabic transliteration of Amharic Fidel text to Latin characters.
 * @function transliterateFidelToLatin
 * @param {string} text - Amharic text.
 * @returns {string} Transliterated Latin string.
 */
export const transliterateFidelToLatin = (text) => {
  if (!text) return '';
  let result = '';
  for (const char of text) {
    if (FIDEL_TO_LATIN[char]) {
      result += FIDEL_TO_LATIN[char];
    } else {
      result += char;
    }
  }
  return result;
};

/**
 * Resolves comprehensive aliases for a branch name to ensure bidirectional
 * Amharic <-> English retrieval and searchability.
 *
 * @function resolveBranchAliases
 * @param {string} name - Branch name (either Amharic or English).
 * @returns {string[]} Array of unique, trimmed alternative names/aliases.
 */
export const resolveBranchAliases = (name) => {
  if (!name || typeof name !== 'string') return [];
  const cleanName = name.trim();
  const lowerName = cleanName.toLowerCase();
  const aliases = new Set([cleanName, lowerName]);

  // 1. Direct dictionary match
  if (CURATED_LOCATIONS[cleanName]) {
    const loc = CURATED_LOCATIONS[cleanName];
    aliases.add(loc.amharic);
    loc.latin.forEach((l) => {
      aliases.add(l);
      aliases.add(capitalize(l));
    });
  }

  // 2. Reverse dictionary match (English -> Amharic)
  for (const [amharicKey, entry] of Object.entries(CURATED_LOCATIONS)) {
    if (entry.latin.some((lat) => lat.toLowerCase() === lowerName || lowerName.includes(lat.toLowerCase()))) {
      aliases.add(amharicKey);
      entry.latin.forEach((l) => aliases.add(l));
    }
  }

  // 3. Algorithmic fallback if Amharic characters are detected
  if (hasEthiopic(cleanName)) {
    const algorithmicLatin = transliterateFidelToLatin(cleanName);
    if (algorithmicLatin) {
      aliases.add(algorithmicLatin.toLowerCase());
      aliases.add(capitalize(algorithmicLatin));
    }
  }

  return Array.from(aliases).filter(Boolean);
};

/**
 * Auto-generates a standardized uppercase operational branch code.
 * Example:
 * - "Bole" -> "BOLE-01"
 * - "ቦሌ" -> transliterates to "BOLE" -> "BOLE-01"
 * - "Bole Medhanialem" -> "BOLE-01" (or "BM-01")
 * - If code collision exists among supervisor's branches, increments sequence ("BOLE-02", etc.)
 *
 * @function generateBranchCode
 * @param {string} name - Branch name.
 * @param {string[]} existingCodes - List of existing uppercase codes for this user.
 * @returns {string} Unique auto-generated operational branch code.
 */
export const generateBranchCode = (name, existingCodes = []) => {
  if (!name || typeof name !== 'string') return 'BR-01';

  let latinBase = '';
  const trimmed = name.trim();

  // 1. Check curated location dictionary first
  if (CURATED_LOCATIONS[trimmed]) {
    latinBase = CURATED_LOCATIONS[trimmed].latin[0];
  } else if (hasEthiopic(trimmed)) {
    latinBase = transliterateFidelToLatin(trimmed);
  } else {
    latinBase = trimmed;
  }

  // Extract primary operational prefix (alphanumeric only)
  const words = latinBase.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
  let prefix = '';

  if (words.length === 1) {
    prefix = words[0].substring(0, 4).toUpperCase();
  } else if (words.length > 1) {
    // For multi-word branches, e.g. "Bole Medhanialem" -> use first word prefix "BOLE"
    prefix = words[0].substring(0, 4).toUpperCase();
  }

  if (!prefix || prefix.length < 2) {
    prefix = 'BR';
  }

  // Ensure prefix is at least 2 chars
  if (prefix.length < 2) {
    prefix = (prefix + 'X').substring(0, 2);
  }

  const existingUpper = new Set(existingCodes.map((c) => String(c).toUpperCase()));

  // Find next available sequence number
  let counter = 1;
  let candidate = `${prefix}-${String(counter).padStart(2, '0')}`;
  while (existingUpper.has(candidate)) {
    counter += 1;
    candidate = `${prefix}-${String(counter).padStart(2, '0')}`;
  }

  return candidate;
};

/**
 * Returns expanded search terms including transliterations so search queries
 * match bidirectionally across English and Amharic.
 *
 * @function getBilingualSearchTerms
 * @param {string} query - Raw search query string.
 * @returns {string[]} Array of search terms to query.
 */
export const getBilingualSearchTerms = (query) => {
  if (!query || typeof query !== 'string') return [];
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const terms = new Set([trimmed, lower]);

  // If query is Amharic, find English equivalents
  if (hasEthiopic(trimmed)) {
    if (CURATED_LOCATIONS[trimmed]) {
      CURATED_LOCATIONS[trimmed].latin.forEach((l) => terms.add(l));
    }
    const transliterated = transliterateFidelToLatin(trimmed);
    if (transliterated) {
      terms.add(transliterated.toLowerCase());
    }
  } else {
    // If query is Latin, find Amharic equivalents
    for (const [amharicKey, entry] of Object.entries(CURATED_LOCATIONS)) {
      if (entry.latin.some((l) => l.toLowerCase() === lower || lower.includes(l.toLowerCase()))) {
        terms.add(amharicKey);
      }
    }
  }

  return Array.from(terms);
};

/**
 * Helper to capitalize string.
 * @private
 */
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default {
  hasEthiopic,
  transliterateFidelToLatin,
  resolveBranchAliases,
  generateBranchCode,
  getBilingualSearchTerms,
};
