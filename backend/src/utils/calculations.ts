/**
 * OT Calculation Utilities
 * All calculations are performed server-side to ensure accuracy
 */

export interface HourBreakdown {
  regular_hours: number;
  ot_hours: number;
  total_hours: number;
}

/**
 * Calculate OT hours based on total weekly hours
 * Hours 1-40 = Regular, Hours 41+ = Overtime
 */
export function calculateOTBreakdown(totalHours: number): HourBreakdown {
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
export function calculateAmount(hours: number, hourlyRate: number, isOT: boolean = false): number {
  // OT is typically 1.5x the regular rate
  const rate = isOT ? hourlyRate * 1.5 : hourlyRate;
  return parseFloat((hours * rate).toFixed(2));
}

/**
 * Calculate project financial summary
 */
export interface ProjectSummaryData {
  total_hours: number;
  ot_hours: number;
  total_amount: number;
  regular_amount: number;
  ot_amount: number;
}

export function calculateProjectFinancialSummary(
  laborBudget: number,
  overheadPercentage: number,
  projectData: ProjectSummaryData,
): {
  total_spent: number;
  overhead_amount: number;
  total_with_overhead: number;
  remaining: number;
  percent_spent: number;
} {
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
export function getBudgetStatusColor(percentSpent: number): 'green' | 'yellow' | 'red' {
  if (percentSpent < 95) return 'green';
  if (percentSpent <= 100) return 'yellow';
  return 'red';
}

/**
 * Validate hours input
 */
export function validateHours(hours: number): { valid: boolean; error?: string } {
  if (hours < 0 || hours > 24) {
    return { valid: false, error: 'Hours must be between 0 and 24 per day' };
  }
  return { valid: true };
}

/**
 * Get week date range
 */
export function getWeekDateRange(weekStartDate: string): { start: Date; end: Date } {
  const start = new Date(weekStartDate);
  const end = new Date(weekStartDate);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

/**
 * Get Monday date for a given date (week start)
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Format decimal to 2 places
 */
export function formatDecimal(value: number): number {
  return parseFloat(value.toFixed(2));
}
