/**
 * Validates a voter's register number based on SRM Valliammai Engineering College AI & DS requirements:
 * - Must be up to 3 digits.
 * - Whitelist: 1-59, 301, 303, 304, 701.
 * - Exceptions (Invalid): 11, 23, 29, 47.
 */
export function validateRegisterNumber(regNoStr: string): { isValid: boolean; error?: string } {
  const trimmed = regNoStr.trim();

  if (!/^\d{1,3}$/.test(trimmed)) {
    return { isValid: false, error: 'Register number must be 1 to 3 digits only' };
  }

  const regNo = parseInt(trimmed, 10);

  const exceptions = [11, 23, 29, 47];
  if (exceptions.includes(regNo)) {
    return { isValid: false, error: 'Invalid Number' };
  }

  const isWhitelisted =
    (regNo >= 1 && regNo <= 59) ||
    regNo === 301 ||
    regNo === 303 ||
    regNo === 304 ||
    regNo === 701;

  if (isWhitelisted) {
    return { isValid: true };
  }

  return { isValid: false, error: 'Invalid Number' };
}
