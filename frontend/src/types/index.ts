export interface User {
  id: number;
  email: string;
  role: 'admin' | 'supervisor';
  name?: string;
  company_name?: string;
}

export interface Project {
  id: number;
  name: string;
  code?: string;
  labor_budget: number;
  overhead_percentage: number;
  status: 'active' | 'completed' | 'on_hold';
  created_at: string;
  updated_at: string;
}

export interface ProjectFinancialSummary {
  id: number;
  name: string;
  status: string;
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

export interface Employee {
  id: number;
  name: string;
  hourly_rate: number;
  position: string;
  project_ids: number[];
  is_active?: number;
  created_at: string;
  updated_at: string;
}

export interface AdminAlerts {
  projects_without_supervisors: { id: number; name: string }[];
  employees_without_projects: { id: number; name: string }[];
  overdue_pending_timesheets: { id: number; week_start_date: string; supervisor_email: string; days_pending: number }[];
  supervisors_missing_this_week: { id: number; email: string; name: string }[];
  current_week: string;
}

export interface Supervisor {
  id: number;
  email: string;
  name: string;
  is_active: number;
  project_count: number;
  created_at: string;
}

export interface Timesheet {
  id: number;
  week_start_date: string;
  supervisor_id: number;
  supervisor_email?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  submitted_at?: string;
  approved_at?: string;
  approved_by?: number;
  total_hours?: number;
  total_amount?: number;
  proposal_status?: 'pending' | 'approved' | 'rejected' | null;
  proposal_id?: number | null;
  proposal_submitted_at?: string | null;
  viewing_proposal?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimesheetRow {
  id: number;
  timesheet_id: number;
  employee_id: number;
  project_id: number;
  employee_name: string;
  project_name: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  total_hours: number;
  sick_days: string;
  created_at: string;
  updated_at: string;
}

export interface OTCalculation {
  id: number;
  timesheet_id: number;
  employee_id: number;
  total_hours: number;
  regular_hours: number;
  ot_hours: number;
  created_at: string;
}

export interface Ticket {
  id: number;
  timesheet_row_id: number;
  hours: number;
  rate_type: 'regular' | 'ot';
  hourly_rate: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface TimesheetDetailResponse {
  timesheet: Timesheet;
  rows: TimesheetRow[];
  ot_calculations: OTCalculation[];
  approved_rows?: TimesheetRow[];
}

export interface ProjectDetail {
  id: number;
  name: string;
  status: string;
  labor_budget: number;
  overhead_percentage: number;
  total_spent: number;
  overhead_amount: number;
  total_with_overhead: number;
  remaining: number;
  percent_spent: number;
  total_hours: number;
  ot_hours: number;
  regular_hours: number;
  ot_spent: number;
  regular_amount: number;
  current_week_hours: number;
  tickets_summary: {
    regular_tickets: number;
    ot_tickets: number;
    pending: number;
    approved: number;
  };
  supervisors: { id: number; email: string; name?: string }[];
  timesheets: {
    id: number;
    week_start_date: string;
    status: string;
    supervisor_id: number;
    supervisor_email: string;
    project_hours: number;
  }[];
  employees: {
    id: number;
    name: string;
    position: string;
    total_hours: number;
    ot_hours: number;
    regular_hours: number;
    total_amount: number;
  }[];
}

export interface EmployeeHoursReport {
  employee_id: number;
  employee_name: string;
  position: string;
  hourly_rate: number;
  supervisor_email: string;
  total_hours: number;
  regular_hours: number;
  ot_hours: number;
  sick_days_count: number;
}
