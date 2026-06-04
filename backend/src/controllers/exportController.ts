import { Response } from 'express';
import pool from '../database/connection';
import { AuthRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';

export class ExportController {
  /**
   * Export timesheets to Excel
   */
  static async exportToExcel(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can export' });
      }

      // Support both legacy `week` param and new `week_start`/`week_end` range
      const weekSingle = req.query.week as string | undefined;
      const weekStart = (req.query.week_start as string | undefined) || weekSingle;
      const weekEnd = (req.query.week_end as string | undefined) || weekSingle;

      if (!weekStart) {
        return res.status(400).json({ error: 'week or week_start parameter required (YYYY-MM-DD)' });
      }

      // Get company name from admin user profile
      const adminResult = await pool.query('SELECT company_name FROM users WHERE id = $1', [req.user.id]);
      const companyName: string = adminResult.rows[0]?.company_name || '';

      const workbook = new ExcelJS.Workbook();
      workbook.creator = companyName || 'Timesheet Tracker';
      workbook.created = new Date();

      // Collect all unique weeks in the range
      const weeks: string[] = [];
      if (weekStart === weekEnd || !weekEnd) {
        weeks.push(weekStart);
      } else {
        // Generate all Monday dates between weekStart and weekEnd
        const start = new Date(weekStart + 'T12:00:00');
        const end = new Date(weekEnd + 'T12:00:00');
        const current = new Date(start);
        while (current <= end) {
          weeks.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 7);
        }
      }

      const rangeLabel = weekStart === weekEnd || !weekEnd
        ? weekStart
        : `${weekStart}_to_${weekEnd}`;

      // Create summary sheet covering all weeks
      await ExportController.createSummarySheet(workbook, weekStart, weekEnd || weekStart, companyName);

      // Get all projects with approved timesheets in the range
      const sheetsResult = await pool.query(
        `SELECT DISTINCT p.id, p.name
         FROM timesheets t
         JOIN timesheet_rows tr ON tr.timesheet_id = t.id
         JOIN projects p ON tr.project_id = p.id
         WHERE t.week_start_date >= $1 AND t.week_start_date <= $2 AND t.status = 'approved'
         ORDER BY p.name`,
        [weekStart, weekEnd || weekStart],
      );

      for (const project of sheetsResult.rows) {
        await ExportController.createProjectSheet(workbook, project.name, project.id, weekStart, weekEnd || weekStart);
      }

      await ExportController.createAllProjectsSheet(workbook, weekStart, weekEnd || weekStart);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="timesheets-${rangeLabel}.xlsx"`);

      await workbook.xlsx.write(res);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create summary sheet
   */
  static async createSummarySheet(workbook: ExcelJS.Workbook, weekStart: string, weekEnd: string, companyName?: string) {
    const sheet = workbook.addWorksheet('Summary');

    // Set columns — ExcelJS writes header text to row 1
    sheet.columns = [
      { header: 'Week Starting', key: 'week', width: 15 },
      { header: 'Project', key: 'project', width: 25 },
      { header: 'Employees', key: 'employees', width: 12 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Regular Hours', key: 'regular_hours', width: 15 },
      { header: 'OT Hours', key: 'ot_hours', width: 12 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    // Style the column header row (currently at row 1)
    const origHeader = sheet.getRow(1);
    origHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    origHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
    origHeader.alignment = { horizontal: 'center', vertical: 'middle' };

    // Prepend company name + period rows above the header
    if (companyName) {
      const periodLabel = `Period: ${weekStart}${weekStart !== weekEnd ? ' – ' + weekEnd : ''}`;
      sheet.spliceRows(1, 0, [companyName], [periodLabel], []);
      sheet.getRow(1).font = { bold: true, size: 14 };
      sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    }

    // Get project summaries across date range
    const projectsResult = await pool.query(
      `SELECT DISTINCT p.id, p.name, t.week_start_date, COUNT(DISTINCT tr.employee_id) as employee_count
       FROM timesheets t
       JOIN timesheet_rows tr ON tr.timesheet_id = t.id
       JOIN projects p ON tr.project_id = p.id
       WHERE t.week_start_date >= $1 AND t.week_start_date <= $2 AND t.status = 'approved'
       GROUP BY p.id, p.name, t.week_start_date
       ORDER BY t.week_start_date, p.name`,
      [weekStart, weekEnd],
    );

    let totalHours = 0;
    let totalRegularHours = 0;
    let totalOTHours = 0;
    let totalAmount = 0;

    for (const project of projectsResult.rows) {
      const ticketsResult = await pool.query(
        `SELECT t.hours, t.rate_type, t.amount
         FROM tickets t
         JOIN timesheet_rows tr ON t.timesheet_row_id = tr.id
         JOIN timesheets ts ON tr.timesheet_id = ts.id
         WHERE tr.project_id = $1 AND ts.week_start_date = $2 AND t.status = 'approved'`,
        [project.id, project.week_start_date],
      );

      let projectHours = 0;
      let projectRegularHours = 0;
      let projectOTHours = 0;
      let projectAmount = 0;

      for (const ticket of ticketsResult.rows) {
        projectHours += ticket.hours;
        projectAmount += ticket.amount;

        if (ticket.rate_type === 'regular') {
          projectRegularHours += ticket.hours;
        } else {
          projectOTHours += ticket.hours;
        }
      }

      totalHours += projectHours;
      totalRegularHours += projectRegularHours;
      totalOTHours += projectOTHours;
      totalAmount += projectAmount;

      sheet.addRow({
        week: project.week_start_date,
        project: project.name,
        employees: project.employee_count,
        hours: projectHours.toFixed(2),
        regular_hours: projectRegularHours.toFixed(2),
        ot_hours: projectOTHours.toFixed(2),
        amount: `$${projectAmount.toFixed(2)}`,
        status: 'Approved',
      });
    }

    // Add totals row
    const totalRow = sheet.addRow({
      week: 'TOTAL',
      project: '',
      employees: '',
      hours: totalHours.toFixed(2),
      regular_hours: totalRegularHours.toFixed(2),
      ot_hours: totalOTHours.toFixed(2),
      amount: `$${totalAmount.toFixed(2)}`,
      status: '',
    });

    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0C0C0' } };
  }

  /**
   * Create project-specific sheet
   */
  static async createProjectSheet(
    workbook: ExcelJS.Workbook,
    projectName: string,
    projectId: number,
    weekStart: string,
    weekEnd: string,
  ) {
    const sheetName = projectName.substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = [
      { header: 'Employee', key: 'employee', width: 20 },
      { header: 'Mon', key: 'monday', width: 8 },
      { header: 'Tue', key: 'tuesday', width: 8 },
      { header: 'Wed', key: 'wednesday', width: 8 },
      { header: 'Thu', key: 'thursday', width: 8 },
      { header: 'Fri', key: 'friday', width: 8 },
      { header: 'Sat', key: 'saturday', width: 8 },
      { header: 'Sun', key: 'sunday', width: 8 },
      { header: 'Total', key: 'total', width: 10 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };

    // Get rows for project (across date range)
    const rowsResult = await pool.query(
      `SELECT tr.*, e.name as employee_name, t.week_start_date
       FROM timesheet_rows tr
       JOIN employees e ON tr.employee_id = e.id
       JOIN timesheets t ON tr.timesheet_id = t.id
       WHERE tr.project_id = $1 AND t.week_start_date >= $2 AND t.week_start_date <= $3 AND t.status = 'approved'
       ORDER BY t.week_start_date, e.name`,
      [projectId, weekStart, weekEnd],
    );

    let totalProjectHours = 0;
    let totalProjectAmount = 0;

    for (const row of rowsResult.rows) {
      // Get tickets for this row to calculate amount
      const ticketsResult = await pool.query(
        'SELECT SUM(amount) as total FROM tickets WHERE timesheet_row_id = $1',
        [row.id],
      );

      const amount = ticketsResult.rows[0].total || 0;
      totalProjectHours += row.total_hours;
      totalProjectAmount += amount;

      sheet.addRow({
        employee: `[${row.week_start_date}] ${row.employee_name}`,
        monday: row.monday,
        tuesday: row.tuesday,
        wednesday: row.wednesday,
        thursday: row.thursday,
        friday: row.friday,
        saturday: row.saturday,
        sunday: row.sunday,
        total: row.total_hours.toFixed(2),
        amount: `$${amount.toFixed(2)}`,
        status: 'Approved',
      });
    }

    // Add totals
    const totalRow = sheet.addRow({
      employee: 'TOTAL',
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: '',
      total: totalProjectHours.toFixed(2),
      amount: `$${totalProjectAmount.toFixed(2)}`,
      status: '',
    });

    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0C0C0' } };
  }

  /**
   * Create all-projects sheet
   */
  static async createAllProjectsSheet(workbook: ExcelJS.Workbook, weekStart: string, weekEnd: string) {
    const sheet = workbook.addWorksheet('All Projects');

    sheet.columns = [
      { header: 'Project', key: 'project', width: 20 },
      { header: 'Supervisor', key: 'supervisor', width: 20 },
      { header: 'Employees', key: 'employees', width: 12 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Regular', key: 'regular', width: 10 },
      { header: 'OT', key: 'ot', width: 10 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };

    const projectsResult = await pool.query(
      `SELECT DISTINCT p.id, p.name, u.email as supervisor_email
       FROM timesheets t
       JOIN timesheet_rows tr ON tr.timesheet_id = t.id
       JOIN projects p ON tr.project_id = p.id
       JOIN users u ON t.supervisor_id = u.id
       WHERE t.week_start_date >= $1 AND t.week_start_date <= $2 AND t.status = 'approved'
       ORDER BY p.name`,
      [weekStart, weekEnd],
    );

    let totalHours = 0;
    let totalRegularHours = 0;
    let totalOTHours = 0;
    let totalAmount = 0;

    for (const project of projectsResult.rows) {
      const ticketsResult = await pool.query(
        `SELECT t.hours, t.rate_type, t.amount
         FROM tickets t
         JOIN timesheet_rows tr ON t.timesheet_row_id = tr.id
         JOIN timesheets ts ON tr.timesheet_id = ts.id
         WHERE tr.project_id = $1 AND ts.week_start_date >= $2 AND ts.week_start_date <= $3 AND t.status = 'approved'`,
        [project.id, weekStart, weekEnd],
      );

      let projectHours = 0;
      let projectRegularHours = 0;
      let projectOTHours = 0;
      let projectAmount = 0;

      for (const ticket of ticketsResult.rows) {
        projectHours += ticket.hours;
        projectAmount += ticket.amount;

        if (ticket.rate_type === 'regular') {
          projectRegularHours += ticket.hours;
        } else {
          projectOTHours += ticket.hours;
        }
      }

      // Get employee count
      const empResult = await pool.query(
        `SELECT COUNT(DISTINCT tr.employee_id) as count
         FROM timesheet_rows tr
         JOIN timesheets t ON tr.timesheet_id = t.id
         WHERE tr.project_id = $1 AND t.week_start_date >= $2 AND t.week_start_date <= $3`,
        [project.id, weekStart, weekEnd],
      );

      totalHours += projectHours;
      totalRegularHours += projectRegularHours;
      totalOTHours += projectOTHours;
      totalAmount += projectAmount;

      sheet.addRow({
        project: project.name,
        supervisor: project.supervisor_email,
        employees: empResult.rows[0].count,
        hours: projectHours.toFixed(2),
        regular: projectRegularHours.toFixed(2),
        ot: projectOTHours.toFixed(2),
        amount: `$${projectAmount.toFixed(2)}`,
        status: 'Approved',
      });
    }

    // Add totals
    const totalRow = sheet.addRow({
      project: 'TOTAL',
      supervisor: '',
      employees: '',
      hours: totalHours.toFixed(2),
      regular: totalRegularHours.toFixed(2),
      ot: totalOTHours.toFixed(2),
      amount: `$${totalAmount.toFixed(2)}`,
      status: '',
    });

    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0C0C0' } };
  }
}
