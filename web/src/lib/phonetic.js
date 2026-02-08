/**
 * NATO phonetic alphabet and spoken digits for VHF distress scripts.
 * Used for vessel name and callsign spelling (user can override in DB).
 */

const NATO = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot',
  G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima',
  M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo',
  S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey',
  X: 'X-ray', Y: 'Yankee', Z: 'Zulu'
};

// Spoken digits (aviation/marine: "Tree", "Fower", "Fife", "Niner")
const DIGITS = {
  '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Tree', '4': 'Fower',
  '5': 'Fife', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Niner'
};

/**
 * Convert a single character to its phonetic word (letter or digit).
 * @param {string} c - Single character
 * @returns {string} Phonetic word or empty string
 */
function charToPhonetic(c) {
  const upper = String(c).toUpperCase();
  if (NATO[upper]) return NATO[upper];
  if (DIGITS[c]) return DIGITS[c];
  return '';
}

/**
 * Spell a word letter-by-letter (and digit-by-digit) using NATO/digits.
 * @param {string} word - One word (no spaces)
 * @returns {string} Space-separated phonetic words, e.g. "Mike India Delta..."
 */
export function spellWord(word) {
  if (!word || typeof word !== 'string') return '';
  const trimmed = word.trim();
  if (!trimmed) return '';
  const parts = [];
  for (const c of trimmed) {
    const ph = charToPhonetic(c);
    if (ph) parts.push(ph);
  }
  return parts.join(' ');
}

/**
 * Spell vessel name: split by spaces/hyphens, spell each word, join with " / ".
 * @param {string} vesselName - Full vessel name, e.g. "Midnight Star"
 * @returns {string} e.g. "Mike India Delta November India Golf Hotel Tango / Sierra Tango Alpha Romeo"
 */
export function spellVesselName(vesselName) {
  if (!vesselName || typeof vesselName !== 'string') return '';
  const words = vesselName.trim().split(/[\s\-]+/).filter(Boolean);
  return words.map((w) => spellWord(w)).filter(Boolean).join(' / ');
}

/**
 * Spell callsign: each character (letters and digits) spelled.
 * @param {string} callsign - e.g. "MABC123"
 * @returns {string} e.g. "Mike Alfa Bravo Charlie One Two Tree"
 */
export function spellCallsign(callsign) {
  if (!callsign || typeof callsign !== 'string') return '';
  return spellWord(callsign.trim().replace(/\s/g, ''));
}

/**
 * Get phonetic line for vessel name. Prefer user override if provided.
 * @param {string} vesselName - Vessel name
 * @param {string|null} overridePhonetic - vessel_name_phonetic from DB
 * @returns {string}
 */
export function getVesselNamePhonetic(vesselName, overridePhonetic) {
  if (overridePhonetic && String(overridePhonetic).trim()) {
    return String(overridePhonetic).trim();
  }
  return spellVesselName(vesselName || '');
}

/**
 * Get phonetic line for callsign. Prefer user override if provided.
 * @param {string} callsign - Callsign
 * @param {string|null} overridePhonetic - callsign_phonetic from DB
 * @returns {string}
 */
export function getCallsignPhonetic(callsign, overridePhonetic) {
  if (overridePhonetic && String(overridePhonetic).trim()) {
    return String(overridePhonetic).trim();
  }
  return spellCallsign(callsign || '');
}
