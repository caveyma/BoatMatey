/**
 * Shared currency options and display helper for cost fields (fuel log, haulout, service, etc.)
 */

export const CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc (Fr)' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (C$)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (A$)' },
  { code: 'NOK', symbol: 'kr', label: 'Norwegian Krone (kr)' },
  { code: 'SEK', symbol: 'kr', label: 'Swedish Krona (kr)' },
  { code: 'DKK', symbol: 'kr', label: 'Danish Krone (kr)' },
];

const DEFAULT_CODE = 'GBP';

/**
 * @param {string} [code] - ISO 4217 currency code (e.g. GBP, USD)
 * @returns {string} Symbol for display (e.g. £, $)
 */
export function currencySymbol(code) {
  const c = CURRENCIES.find((x) => x.code === (code || DEFAULT_CODE));
  return c ? c.symbol : '£';
}

/**
 * @param {number} amount
 * @param {string} [code]
 * @param {number} [decimals=2]
 * @returns {string} e.g. "£12.56" or "0.010 £/L"
 */
export function formatAmount(amount, code = DEFAULT_CODE, decimals = 2) {
  const sym = currencySymbol(code);
  return sym + Number(amount).toFixed(decimals);
}
