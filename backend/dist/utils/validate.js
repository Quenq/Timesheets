"use strict";
/** Shared validation helpers for all controllers */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEmail = isValidEmail;
exports.isPositiveNumber = isPositiveNumber;
exports.isNonNegativeNumber = isNonNegativeNumber;
exports.isNonEmptyString = isNonEmptyString;
exports.isBetween = isBetween;
exports.isValidDateStr = isValidDateStr;
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function isPositiveNumber(val) {
    const n = Number(val);
    return !isNaN(n) && isFinite(n) && n > 0;
}
function isNonNegativeNumber(val) {
    const n = Number(val);
    return !isNaN(n) && isFinite(n) && n >= 0;
}
function isNonEmptyString(val, maxLen = 200) {
    return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}
function isBetween(val, min, max) {
    const n = Number(val);
    return !isNaN(n) && isFinite(n) && n >= min && n <= max;
}
function isValidDateStr(val) {
    if (typeof val !== 'string')
        return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val));
}
//# sourceMappingURL=validate.js.map