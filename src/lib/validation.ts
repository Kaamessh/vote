/**
 * Validates and normalizes a voter's register number for SRM VEC AI & DS:
 * - Accepts 1 to 3 digit inputs.
 * - Normalizes leading zeros (e.g., "01" -> "1", "034" -> "34").
 * - Whitelist: 1-111, 301-305, 308-316, 701.
 * - Exceptions (Invalid): 11, 31, 58, 70.
 */

// Total whitelist count: (111 - 4 exceptions) + 5 + 9 + 1 = 122 eligible voters total
export const TOTAL_ELIGIBLE_VOTERS = 122;

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

  // Exceptions (Invalid)
  const exceptions = [11, 31, 58, 70];
  if (exceptions.includes(regNoInt)) {
    return { isValid: false, error: 'Invalid Number' };
  }

  // Whitelist check:
  // 1-111
  // 301, 302, 303, 304, 305
  // 308-316
  // 701
  const isWhitelisted =
    (regNoInt >= 1 && regNoInt <= 111) ||
    (regNoInt >= 301 && regNoInt <= 305) ||
    (regNoInt >= 308 && regNoInt <= 316) ||
    regNoInt === 701;

  if (isWhitelisted) {
    return { isValid: true, normalizedRegNo };
  }

  return { isValid: false, error: 'Invalid Number' };
}
