import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { initDatabase, runSchema, runRaw } from './database/connection';
import pool from './database/connection';
import router from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', router);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function migrateRemoveTimesheetUnique(): Promise<void> {
  const result = await pool.query(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='timesheets'",
  );
  if (!result.rows.length) return;

  const tableSQL: string = (result.rows[0].sql as string) || '';
  if (!tableSQL.toUpperCase().includes('UNIQUE')) return;

  console.log('Migration: removing UNIQUE constraint from timesheets...');

  runRaw('PRAGMA foreign_keys = OFF');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS timesheets_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start_date TEXT NOT NULL,
      supervisor_id INTEGER NOT NULL,
      status TEXT DEFAULT 'draft',
      rejection_reason TEXT,
      submitted_at TEXT,
      approved_at TEXT,
      approved_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query('INSERT INTO timesheets_new SELECT * FROM timesheets');
  runRaw('DROP TABLE timesheets');
  runRaw('ALTER TABLE timesheets_new RENAME TO timesheets');
  runRaw('CREATE INDEX IF NOT EXISTS idx_timesheets_supervisor_id ON timesheets(supervisor_id)');
  runRaw('CREATE INDEX IF NOT EXISTS idx_timesheets_week_start_date ON timesheets(week_start_date)');
  runRaw('PRAGMA foreign_keys = ON');

  console.log('Migration complete: timesheets now allow multiple per week');
}

async function migrateOTCalculations(): Promise<void> {
  const cols = await pool.query('PRAGMA table_info(ot_calculations)');
  const hasWeekStart = cols.rows.some((r: any) => r.name === 'week_start_date');
  if (hasWeekStart) return;

  console.log('Migration: rebuilding ot_calculations for week-based OT...');
  runRaw('PRAGMA foreign_keys = OFF');
  runRaw('DROP TABLE IF EXISTS ot_calculations');
  runRaw(`CREATE TABLE ot_calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start_date TEXT NOT NULL,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    total_hours REAL NOT NULL,
    regular_hours REAL NOT NULL,
    ot_hours REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(week_start_date, employee_id)
  )`);
  runRaw('PRAGMA foreign_keys = ON');
  console.log('Migration: ot_calculations rebuilt with week_start_date key');
}

async function migrateRemoveSupervisorFromEmployees(): Promise<void> {
  const cols = await pool.query('PRAGMA table_info(employees)');
  const hasSupervisorId = cols.rows.some((r: any) => r.name === 'supervisor_id');
  if (!hasSupervisorId) return;

  console.log('Migration: decoupling employees from supervisors...');
  runRaw('PRAGMA foreign_keys = OFF');

  // Create employee_projects if not exists
  runRaw(`CREATE TABLE IF NOT EXISTS employee_projects (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id, project_id)
  )`);

  // Migrate: assign each employee to all projects their supervisor was assigned to
  runRaw(`INSERT OR IGNORE INTO employee_projects (employee_id, project_id)
    SELECT e.id, ps.project_id
    FROM employees e
    JOIN project_supervisors ps ON ps.supervisor_id = e.supervisor_id
    WHERE e.supervisor_id IS NOT NULL`);

  // Recreate employees without supervisor_id
  runRaw(`CREATE TABLE employees_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hourly_rate REAL NOT NULL DEFAULT 0,
    position TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  runRaw(`INSERT INTO employees_new (id, name, hourly_rate, position, created_at, updated_at)
    SELECT id, name, hourly_rate, position, created_at, updated_at FROM employees`);
  runRaw('DROP TABLE employees');
  runRaw('ALTER TABLE employees_new RENAME TO employees');

  runRaw('PRAGMA foreign_keys = ON');
  console.log('Migration: employees decoupled from supervisors, employee_projects created');
}

async function migrateAddColumns(): Promise<void> {
  const columnMigrations = [
    { table: 'timesheet_rows', column: 'sick_days', sql: "ALTER TABLE timesheet_rows ADD COLUMN sick_days TEXT DEFAULT ''" },
    { table: 'timesheet_rows', column: 'pto_days',  sql: "ALTER TABLE timesheet_rows ADD COLUMN pto_days TEXT DEFAULT ''" },
    { table: 'users', column: 'is_active', sql: 'ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1' },
    { table: 'users', column: 'name', sql: "ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''" },
    { table: 'employees', column: 'is_active', sql: 'ALTER TABLE employees ADD COLUMN is_active INTEGER DEFAULT 1' },
    { table: 'projects', column: 'code', sql: 'ALTER TABLE projects ADD COLUMN code TEXT' },
    { table: 'timesheets', column: 'project_id', sql: 'ALTER TABLE timesheets ADD COLUMN project_id INTEGER REFERENCES projects(id)' },
  ];

  for (const migration of columnMigrations) {
    const cols = await pool.query(`PRAGMA table_info(${migration.table})`);
    const exists = cols.rows.some((row: any) => row.name === migration.column);
    if (!exists) {
      runRaw(migration.sql);
      console.log(`Migration: added ${migration.table}.${migration.column}`);
    }
  }
}

async function seedDemoData(): Promise<void> {
  const adminCheck = await pool.query("SELECT id FROM users WHERE email = 'admin@example.com'");
  if (adminCheck.rows.length > 0) return;

  console.log('Seeding demo data...');

  const adminHash = await bcrypt.hash('password123', 10);
  await pool.query(
    'INSERT INTO users (email, password_hash, role, company_name) VALUES ($1, $2, $3, $4)',
    ['admin@example.com', adminHash, 'admin', 'Demo Construction Co.'],
  );

  const supHash = await bcrypt.hash('password123', 10);
  await pool.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
    ['supervisor@example.com', supHash, 'supervisor'],
  );

  const supResult = await pool.query("SELECT id FROM users WHERE email = 'supervisor@example.com'");
  const supervisorId = supResult.rows[0].id;

  const projects = [
    ['Project Alpha - Commercial Build', 85000, 20],
    ['Project Beta - Residential Complex', 120000, 15],
    ['Project Gamma - Infrastructure', 45000, 25],
    ['Project Delta - Renovation', 30000, 18],
    ['Project Epsilon - Bridge Repair', 65000, 22],
  ];

  for (const [name, budget, overhead] of projects) {
    await pool.query(
      'INSERT INTO projects (name, labor_budget, overhead_percentage) VALUES ($1, $2, $3)',
      [name, budget, overhead],
    );
  }

  const employees = [
    ['John Smith', 28.5, 'Carpenter'],
    ['Maria Garcia', 32.0, 'Electrician'],
    ['Robert Johnson', 24.0, 'Laborer'],
    ['Jennifer Lee', 35.0, 'Foreman'],
    ['Michael Brown', 29.0, 'Plumber'],
    ['Lisa Davis', 26.5, 'Mason'],
    ['James Wilson', 30.0, 'Welder'],
    ['Sarah Martinez', 27.0, 'Painter'],
  ];

  const empIds: number[] = [];
  for (const [name, rate, position] of employees) {
    const empResult = await pool.query(
      'INSERT INTO employees (name, hourly_rate, position) VALUES ($1, $2, $3) RETURNING id',
      [name, rate, position],
    );
    empIds.push(empResult.rows[0].id);
  }

  // Assign all demo employees to first two projects
  const projectResult = await pool.query('SELECT id FROM projects ORDER BY id LIMIT 2');
  for (const emp of empIds) {
    for (const proj of projectResult.rows) {
      await pool.query(
        'INSERT OR IGNORE INTO employee_projects (employee_id, project_id) VALUES ($1, $2)',
        [emp, proj.id],
      );
    }
  }

  // Assign supervisor to first two projects
  for (const proj of projectResult.rows) {
    await pool.query(
      'INSERT OR IGNORE INTO project_supervisors (project_id, supervisor_id) VALUES ($1, $2)',
      [proj.id, supervisorId],
    );
  }

  console.log('Demo data seeded successfully');
  console.log('  Admin:      admin@example.com / password123');
  console.log('  Supervisor: supervisor@example.com / password123');
}

async function start(): Promise<void> {
  try {
    await initDatabase();
    console.log('Database initialized');

    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    runSchema(schema);
    console.log('Schema applied');

    await migrateRemoveTimesheetUnique();
    await migrateOTCalculations();
    await migrateAddColumns();
    await migrateRemoveSupervisorFromEmployees();
    await seedDemoData();

    app.listen(PORT, () => {
      console.log(`\nServer running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\nLogin at http://localhost:3000`);
      console.log('  Admin:      admin@example.com / password123');
      console.log('  Supervisor: supervisor@example.com / password123\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
