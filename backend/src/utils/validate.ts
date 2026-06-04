/** Shared validation helpers for all controllers */

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isPositiveNumber(val: any): boolean {
  const n = Number(val);
  return !isNaN(n) && isFinite(n) && n > 0;
}

export function isNonNegativeNumber(val: any): boolean {
  const n = Number(val);
  return !isNaN(n) && isFinite(n) && n >= 0;
}

export function isNonEmptyString(val: any, maxLen = 200): boolean {
  return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}

export function isBetween(val: any, min: number, max: number): boolean {
  const n = Number(val);
  return !isNaN(n) && isFinite(n) && n >= min && n <= max;
}

export function isValidDateStr(val: any): boolean {
  if (typeof val !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val));
}
