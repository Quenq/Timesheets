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
export declare function calculateOTBreakdown(totalHours: number): HourBreakdown;
/**
 * Calculate amount owed for hours at a given rate
 */
export declare function calculateAmount(hours: number, hourlyRate: number, isOT?: boolean): number;
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
export declare function calculateProjectFinancialSummary(laborBudget: number, overheadPercentage: number, projectData: ProjectSummaryData): {
    total_spent: number;
    overhead_amount: number;
    total_with_overhead: number;
    remaining: number;
    percent_spent: number;
};
/**
 * Get budget status color based on percent spent
 */
export declare function getBudgetStatusColor(percentSpent: number): 'green' | 'yellow' | 'red';
/**
 * Validate hours input
 */
export declare function validateHours(hours: number): {
    valid: boolean;
    error?: string;
};
/**
 * Get week date range
 */
export declare function getWeekDateRange(weekStartDate: string): {
    start: Date;
    end: Date;
};
/**
 * Get Monday date for a given date (week start)
 */
export declare function getMonday(date: Date): Date;
/**
 * Format decimal to 2 places
 */
export declare function formatDecimal(value: number): number;
//# sourceMappingURL=calculations.d.ts.map