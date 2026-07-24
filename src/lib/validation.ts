/**
 * Validates and normalizes a voter's register number for SRM VEC AI & DS:
 * - Accepts 1 to 3 digit inputs.
 * - Normalizes leading zeros (e.g., "01" -> "1", "034" -> "34").
 * - Whitelist: 1-59, 301, 303, 304, 701.
 * - Exceptions (Invalid): 11, 23, 29, 47.
 */

// Total whitelist count: (59 - 4 exceptions) + 4 extra = 59 eligible voters total
export const TOTAL_ELIGIBLE_VOTERS = 59;

export function validateRegisterNumber(regNoStr: string): {
  isValid: boolean;
  normalizedRegNo?: string;
  error?: string;
} {
  const trimmed = regNoStr.trim();

  if (!/^\d{1,3}$/.test(trimmed)) {
    return { isValid: false, error: 'Register number must be 1 to 3 digits only' };
  }

  const regNoInt = parseInt(trimmed, 10);
  const normalizedRegNo = regNoInt.toString();

  const exceptions = [11, 23, 29, 47];
  if (exceptions.includes(regNoInt)) {
    return { isValid: false, error: 'Invalid Number' };
  }

  const isWhitelisted =
    (regNoInt >= 1 && regNoInt <= 59) ||
    regNoInt === 301 ||
    regNoInt === 303 ||
    regNoInt === 304 ||
    regNoInt === 701;

  if (isWhitelisted) {
    return { isValid: true, normalizedRegNo };
  }

  return { isValid: false, error: 'Invalid Number' };
}
