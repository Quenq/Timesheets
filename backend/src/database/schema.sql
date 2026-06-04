-- Users table (supervisors and admin)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor')),
  name TEXT DEFAULT '',
  company_name TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  labor_budget REAL NOT NULL,
  overhead_percentage REAL DEFAULT 20.0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hourly_rate REAL NOT NULL,
  position TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Employee ↔ Project assignments (many-to-many)
CREATE TABLE IF NOT EXISTS employee_projects (
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, project_id)
);

-- Timesheets table (weekly submission)
CREATE TABLE IF NOT EXISTS timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start_date TEXT NOT NULL,
  supervisor_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TEXT,
  approved_at TEXT,
  approved_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Timesheet rows (individual employee hours per project)
CREATE TABLE IF NOT EXISTS timesheet_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheet_id INTEGER NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  monday REAL DEFAULT 0,
  tuesday REAL DEFAULT 0,
  wednesday REAL DEFAULT 0,
  thursday REAL DEFAULT 0,
  friday REAL DEFAULT 0,
  saturday REAL DEFAULT 0,
  sunday REAL DEFAULT 0,
  total_hours REAL DEFAULT 0,
  sick_days TEXT DEFAULT '',
  pto_days TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Change requests for edits to already-approved timesheets
CREATE TABLE IF NOT EXISTS timesheet_change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheet_id INTEGER NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  created_by_id INTEGER REFERENCES users(id),
  created_by_email TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timesheet_change_request_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_request_id INTEGER NOT NULL REFERENCES timesheet_change_requests(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  monday REAL DEFAULT 0,
  tuesday REAL DEFAULT 0,
  wednesday REAL DEFAULT 0,
  thursday REAL DEFAULT 0,
  friday REAL DEFAULT 0,
  saturday REAL DEFAULT 0,
  sunday REAL DEFAULT 0,
  total_hours REAL DEFAULT 0,
  sick_days TEXT DEFAULT '',
  pto_days TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- OT Calculation — keyed by (week_start_date, employee_id) so cross-timesheet OT works
CREATE TABLE IF NOT EXISTS ot_calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start_date TEXT NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  total_hours REAL NOT NULL,
  regular_hours REAL NOT NULL,
  ot_hours REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start_date, employee_id)
);

-- Tickets (for financial tracking)
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheet_row_id INTEGER NOT NULL REFERENCES timesheet_rows(id) ON DELETE CASCADE,
  hours REAL NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('regular', 'ot')),
  hourly_rate REAL NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Project ↔ Supervisor assignments (many-to-many)
CREATE TABLE IF NOT EXISTS project_supervisors (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, supervisor_id)
);

-- Timesheet history / audit log
CREATE TABLE IF NOT EXISTS timesheet_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheet_id INTEGER NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'submitted', 'approved', 'rejected')),
  performed_by_id INTEGER REFERENCES users(id),
  performed_by_email TEXT,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_timesheets_supervisor_id ON timesheets(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_week_start_date ON timesheets(week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_rows_timesheet_id ON timesheet_rows(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_change_requests_timesheet_id ON timesheet_change_requests(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_change_requests_status ON timesheet_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_timesheet_change_request_rows_request_id ON timesheet_change_request_rows(change_request_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_rows_employee_id ON timesheet_rows(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_projects_employee_id ON employee_projects(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_projects_project_id ON employee_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_timesheet_row_id ON tickets(timesheet_row_id);
CREATE INDEX IF NOT EXISTS idx_project_supervisors_supervisor_id ON project_supervisors(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_project_supervisors_project_id ON project_supervisors(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_history_timesheet_id ON timesheet_history(timesheet_id)
