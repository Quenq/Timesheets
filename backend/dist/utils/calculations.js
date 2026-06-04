"use strict";
/**
 * OT Calculation Utilities
 * All calculations are performed server-side to ensure accuracy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateOTBreakdown = calculateOTBreakdown;
exports.calculateAmount = calculateAmount;
exports.calculateProjectFinancialSummary = calculateProjectFinancialSummary;
exports.getBudgetStatusColor = getBudgetStatusColor;
exports.validateHours = validateHours;
exports.getWeekDateRange = getWeekDateRange;
exports.getMonday = getMonday;
exports.formatDecimal = formatDecimal;
/**
 * Calculate OT hours based on total weekly hours
 * Hours 1-40 = Regular, Hours 41+ = Overtime
 */
function calculateOTBreakdown(totalHours) {
    const regularThreshold = 40;
    const regular_hours = Math.min(totalHours, regularThreshold);
    const ot_hours = Math.max(0, totalHours - regularThreshold);
    return {
        regular_hours: parseFloat(regular_hours.toFixed(2)),
        ot_hours: parseFloat(ot_hours.toFixed(2)),
        total_hours: parseFloat(totalHours.toFixed(2)),
    };
}
/**
 * Calculate amount owed for hours at a given rate
 */
function calculateAmount(hours, hourlyRate, isOT = false) {
    // OT is typically 1.5x the regular rate
    const rate = isOT ? hourlyRate * 1.5 : hourlyRate;
    return parseFloat((hours * rate).toFixed(2));
}
function calculateProjectFinancialSummary(laborBudget, overheadPercentage, projectData) {
    const total_spent = projectData.total_amount;
    const overhead_amount = (total_spent * overheadPercentage) / 100;
    const total_with_overhead = total_spent + overhead_amount;
    const remaining = laborBudget - total_with_overhead;
    const percent_spent = (total_with_overhead / laborBudget) * 100;
    return {
        total_spent: parseFloat(total_spent.toFixed(2)),
        overhead_amount: parseFloat(overhead_amount.toFixed(2)),
        total_with_overhead: parseFloat(total_with_overhead.toFixed(2)),
        remaining: parseFloat(remaining.toFixed(2)),
        percent_spent: parseFloat(percent_spent.toFixed(2)),
    };
}
/**
 * Get budget status color based on percent spent
 */
function getBudgetStatusColor(percentSpent) {
    if (percentSpent < 95)
        return 'green';
    if (percentSpent <= 100)
        return 'yellow';
    return 'red';
}
/**
 * Validate hours input
 */
function validateHours(hours) {
    if (hours < 0 || hours > 24) {
        return { valid: false, error: 'Hours must be between 0 and 24 per day' };
    }
    return { valid: true };
}
/**
 * Get week date range
 */
function getWeekDateRange(weekStartDate) {
    const start = new Date(weekStartDate);
    const end = new Date(weekStartDate);
    end.setDate(end.getDate() + 6);
    return { start, end };
}
/**
 * Get Monday date for a given date (week start)
 */
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}
/**
 * Format decimal to 2 places
 */
function formatDecimal(value) {
    return parseFloat(value.toFixed(2));
}
//# sourceMappingURL=calculations.js.map