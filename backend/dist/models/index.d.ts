export interface User {
    id: number;
    email: string;
    password_hash: string;
    role: 'admin' | 'supervisor';
    company_name: string;
    created_at: Date;
    updated_at: Date;
}
export interface Project {
    id: number;
    name: string;
    labor_budget: number;
    overhead_percentage: number;
    status: 'active' | 'completed' | 'on_hold';
    created_at: Date;
    updated_at: Date;
}
export interface Employee {
    id: number;
    name: string;
    supervisor_id: number;
    hourly_rate: number;
    position: string;
    created_at: Date;
    updated_at: Date;
}
export interface Timesheet {
    id: number;
    week_start_date: string;
    supervisor_id: number;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    rejection_reason?: string;
    submitted_at?: Date;
    approved_at?: Date;
    approved_by?: number;
    created_at: Date;
    updated_at: Date;
}
export interface TimesheetRow {
    id: number;
    timesheet_id: number;
    employee_id: number;
    project_id: number;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
    total_hours: number;
    created_at: Date;
    updated_at: Date;
}
export interface OTCalculation {
    id: number;
    timesheet_id: number;
    employee_id: number;
    total_hours: number;
    regular_hours: number;
    ot_hours: number;
    created_at: Date;
}
export interface Ticket {
    id: number;
    timesheet_row_id: number;
    hours: number;
    rate_type: 'regular' | 'ot';
    hourly_rate: number;
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: Date;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    token: string;
    user: {
        id: number;
        email: string;
        role: string;
    };
}
export interface CreateTimesheetRequest {
    week_start_date: string;
    rows: CreateTimesheetRowRequest[];
}
export interface CreateTimesheetRowRequest {
    employee_id: number;
    project_id: number;
    hours: {
        [key: string]: number;
    };
}
export interface TimesheetSummary {
    project_id: number;
    project_name: string;
    total_hours: number;
    regular_hours: number;
    ot_hours: number;
    amount: number;
    status: string;
}
export interface ProjectFinancialSummary {
    id: number;
    name: string;
    labor_budget: number;
    total_spent: number;
    overhead_amount: number;
    total_with_overhead: number;
    remaining: number;
    percent_spent: number;
    total_hours: number;
    ot_hours: number;
    ot_spent: number;
    current_week_hours: number;
    tickets_summary: {
        regular_tickets: number;
        ot_tickets: number;
        pending: number;
        approved: number;
    };
}
//# sourceMappingURL=index.d.ts.map