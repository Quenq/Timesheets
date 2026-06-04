import { Response } from 'express';
import pool from '../database/connection';
import { AuthRequest } from '../middleware/auth';
import { calculateAmount, formatDecimal } from '../utils/calculations';

export class TimesheetController {
  private static getTicketStatusForTimesheetStatus(status: string): 'pending' | 'approved' | 'rejected' {
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }

  private static async validateRowsForUser(
    user: NonNullable<AuthRequest['user']>,
    rows: any[],
  ) {
    const projectIds = [...new Set(rows.map((r: any) => r.project_id).filter(Boolean))];

    if (user.role === 'supervisor') {
      for (const projectId of projectIds) {
        const assigned = await pool.query(
          'SELECT 1 FROM project_supervisors WHERE project_id = $1 AND supervisor_id = $2',
          [projectId, user.id],
        );
        if (assigned.rows.length === 0) {
          throw new Error(`Not assigned to project ${projectId}`);
        }
      }
    }

    for (const row of rows) {
      if (row.employee_id && row.project_id) {
        const empAssigned = await pool.query(
          'SELECT 1 FROM employee_projects WHERE employee_id = $1 AND project_id = $2',
          [row.employee_id, row.project_id],
        );
        if (empAssigned.rows.length === 0) {
          throw new Error('Employee not assigned to that project');
        }
      }
    }
  }

  static async createTimesheet(req: AuthRequest, res: Response) {
    try {
      if (!req.user || !['supervisor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only supervisors and admins can create timesheets' });
      }

      const { week_start_date, rows, supervisor_id } = req.body;

      if (!week_start_date) {
        return res.status(400).json({ error: 'week_start_date required' });
      }

      const effectiveSupervisorId =
        req.user.role === 'admin' && supervisor_id ? supervisor_id : req.user.id;

      if (rows && Array.isArray(rows) && rows.length > 0) {
        try {
          await TimesheetController.validateRowsForUser(req.user, rows);
        } catch (validationError: any) {
          const statusCode = validationError.message?.startsWith('Not assigned to project') ? 403 : 400;
          return res.status(statusCode).json({ error: validationError.message || 'Invalid timesheet rows' });
        }
      }

      const result = await pool.query(
        'INSERT INTO timesheets (week_start_date, supervisor_id, status) VALUES ($1, $2, $3) RETURNING id',
        [week_start_date, effectiveSupervisorId, 'draft'],
      );
      const timesheetId: number = result.rows[0].id;

      if (rows && Array.isArray(rows)) {
        for (const row of rows) {
          await TimesheetController.addTimesheetRow(timesheetId, row);
        }
        await TimesheetController.recalculateWeeklyOT(week_start_date);
      }

      await TimesheetController.insertHistory(timesheetId, 'created', req.user.id, req.user.email);

      res.status(201).json({ id: timesheetId, status: 'draft' });
    } catch (error) {
      console.error('Create timesheet error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private static async insertHistory(
    timesheetId: number,
    action: string,
    userId: number,
    userEmail: string,
    note?: string,
  ) {
    await pool.query(
      `INSERT INTO timesheet_history (timesheet_id, action, performed_by_id, performed_by_email, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [timesheetId, action, userId, userEmail, note || null],
    );
  }

  private static async resetTimesheetToPending(
    timesheetId: number,
    userId: number,
    userEmail: string,
  ) {
    await pool.query(
      `UPDATE timesheets
       SET status = 'pending',
           submitted_at = CURRENT_TIMESTAMP,
           approved_at = NULL,
           approved_by = NULL,
           rejection_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [timesheetId],
    );

    await TimesheetController.insertHistory(
      timesheetId,
      'submitted',
      userId,
      userEmail,
      'Timesheet edited and resubmitted for approval',
    );
  }

  private static async getPendingChangeRequest(timesheetId: number) {
    const result = await pool.query(
      `SELECT *
       FROM timesheet_change_requests
       WHERE timesheet_id = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [timesheetId],
    );

    return result.rows[0] || null;
  }

  private static async getLatestChangeRequest(timesheetId: number) {
    const result = await pool.query(
      `SELECT *
       FROM timesheet_change_requests
       WHERE timesheet_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [timesheetId],
    );

    return result.rows[0] || null;
  }

  private static async getRowsForTable(
    table: 'timesheet_rows' | 'timesheet_change_request_rows',
    foreignKey: 'timesheet_id' | 'change_request_id',
    id: number,
  ) {
    const result = await pool.query(
      `SELECT tr.*, e.name as employee_name, p.name as project_name
       FROM ${table} tr
       JOIN employees e ON tr.employee_id = e.id
       JOIN projects p ON tr.project_id = p.id
       WHERE tr.${foreignKey} = $1
       ORDER BY e.name`,
      [id],
    );

    return result.rows;
  }

  private static async replaceChangeRequestRows(changeRequestId: number, rows: any[]) {
    await pool.query(
      'DELETE FROM timesheet_change_request_rows WHERE change_request_id = $1',
      [changeRequestId],
    );

    for (const row of rows) {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const dayValues = days.map((day) => parseFloat((row[day] as any) || 0) || 0);
      const total_hours = formatDecimal(dayValues.reduce((a, b) => a + b, 0));
      const sick_days = row.sick_days || '';
      const pto_days = row.pto_days || '';

      await pool.query(
        `INSERT INTO timesheet_change_request_rows
         (change_request_id, employee_id, project_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, total_hours, sick_days, pto_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [changeRequestId, row.employee_id, row.project_id, ...dayValues, total_hours, sick_days, pto_days],
      );
    }
  }

  private static async upsertPendingChangeRequest(
    timesheetId: number,
    rows: any[],
    userId: number,
    userEmail: string,
  ) {
    let changeRequest = await TimesheetController.getPendingChangeRequest(timesheetId);

    if (!changeRequest) {
      const createResult = await pool.query(
        `INSERT INTO timesheet_change_requests
         (timesheet_id, status, submitted_at, created_by_id, created_by_email, updated_at)
         VALUES ($1, 'pending', CURRENT_TIMESTAMP, $2, $3, CURRENT_TIMESTAMP)
         RETURNING *`,
        [timesheetId, userId, userEmail],
      );
      changeRequest = createResult.rows[0];
      await TimesheetController.insertHistory(
        timesheetId,
        'submitted',
        userId,
        userEmail,
        'Change request submitted for an approved timesheet',
      );
    } else {
      await pool.query(
        `UPDATE timesheet_change_requests
         SET submitted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP,
             rejection_reason = NULL
         WHERE id = $1`,
        [changeRequest.id],
      );
    }

    await TimesheetController.replaceChangeRequestRows(changeRequest.id, rows);

    return changeRequest.id;
  }

  private static async applyApprovedChangeRequest(
    timesheetId: number,
    changeRequestId: number,
    weekStartDate: string,
  ) {
    const proposalRows = await pool.query(
      `SELECT *
       FROM timesheet_change_request_rows
       WHERE change_request_id = $1
       ORDER BY id ASC`,
      [changeRequestId],
    );

    await pool.query(
      `DELETE FROM tickets
       WHERE timesheet_row_id IN (
         SELECT id FROM timesheet_rows WHERE timesheet_id = $1
       )`,
      [timesheetId],
    );
    await pool.query('DELETE FROM timesheet_rows WHERE timesheet_id = $1', [timesheetId]);

    for (const row of proposalRows.rows) {
      const {
        id: _proposalRowId,
        change_request_id: _changeRequestId,
        created_at: _createdAt,
        updated_at: _updatedAt,
        total_hours: _totalHours,
        ...rowData
      } = row;
      await TimesheetController.addTimesheetRow(timesheetId, rowData);
    }

    await pool.query(
      `UPDATE timesheet_change_requests
       SET status = 'approved',
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [changeRequestId],
    );
    await pool.query(
      'DELETE FROM timesheet_change_request_rows WHERE change_request_id = $1',
      [changeRequestId],
    );

    await TimesheetController.recalculateWeeklyOT(weekStartDate);
  }

  static async addTimesheetRow(
    timesheetId: number,
    row: {
      id?: number;
      employee_id: number;
      project_id: number;
      monday?: number;
      tuesday?: number;
      wednesday?: number;
      thursday?: number;
      friday?: number;
      saturday?: number;
      sunday?: number;
      sick_days?: string;
    },
  ) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayValues = days.map((day) => parseFloat((row[day as keyof typeof row] as any) || 0) || 0);
    const total_hours = formatDecimal(dayValues.reduce((a, b) => a + b, 0));
    const sick_days = row.sick_days || '';

    if (row.id) {
      await pool.query(
        `UPDATE timesheet_rows SET
         monday = $1, tuesday = $2, wednesday = $3, thursday = $4, friday = $5,
         saturday = $6, sunday = $7, total_hours = $8, sick_days = $9,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $10`,
        [...dayValues, total_hours, sick_days, row.id],
      );
    } else {
      const result = await pool.query(
        `INSERT INTO timesheet_rows
         (timesheet_id, employee_id, project_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, total_hours, sick_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [timesheetId, row.employee_id, row.project_id, ...dayValues, total_hours, sick_days],
      );
      row.id = result.rows[0].id;
    }
    // Tickets and OT are recalculated at week level — call recalculateWeeklyOT after all rows saved
  }

  // Recalculate OT and tickets for ALL timesheets in a week.
  // Cross-timesheet OT: hours 1-40 = regular, 41+ = OT, distributed across
  // rows in chronological order (timesheet_id ASC, row_id ASC).
  static async recalculateWeeklyOT(weekStartDate: string): Promise<void> {
    const sheetsResult = await pool.query(
      'SELECT id FROM timesheets WHERE week_start_date = $1',
      [weekStartDate],
    );
    const timesheetIds: number[] = sheetsResult.rows.map((r: any) => r.id);

    // If no timesheets remain for this week, clear all OT records for the week
    if (timesheetIds.length === 0) {
      await pool.query('DELETE FROM ot_calculations WHERE week_start_date = $1', [weekStartDate]);
      return;
    }

    const inPlaceholders = timesheetIds.map((_: any, i: number) => `$${i + 1}`).join(', ');

    // Remove OT records for employees who no longer have rows this week
    await pool.query(
      `DELETE FROM ot_calculations WHERE week_start_date = $1
       AND employee_id NOT IN (
         SELECT DISTINCT tr.employee_id FROM timesheet_rows tr
         WHERE tr.timesheet_id IN (${inPlaceholders})
       )`,
      [weekStartDate, ...timesheetIds],
    );

    // All distinct employees with hours this week
    const employeesResult = await pool.query(
      `SELECT DISTINCT tr.employee_id, e.hourly_rate
       FROM timesheet_rows tr
       JOIN employees e ON tr.employee_id = e.id
       WHERE tr.timesheet_id IN (${inPlaceholders})`,
      timesheetIds,
    );

    for (const emp of employeesResult.rows) {
      const employee_id: number = emp.employee_id;
      const hourly_rate: number = parseFloat(emp.hourly_rate);

      const rowInPlaceholders = timesheetIds.map((_: any, i: number) => `$${i + 2}`).join(', ');
      const rowsResult = await pool.query(
        `SELECT tr.id, tr.total_hours, t.status as timesheet_status
         FROM timesheet_rows tr
         JOIN timesheets t ON t.id = tr.timesheet_id
         WHERE tr.employee_id = $1
           AND tr.timesheet_id IN (${rowInPlaceholders})
         ORDER BY tr.timesheet_id ASC, tr.id ASC`,
        [employee_id, ...timesheetIds],
      );

      const allRows = rowsResult.rows;
      const totalHours = formatDecimal(
        allRows.reduce((sum: number, r: any) => sum + parseFloat(r.total_hours || 0), 0),
      );

      // Walk through rows filling regular hours first, then OT
      let remainingRegular = 40;
      for (const r of allRows) {
        const rowHours = formatDecimal(parseFloat(r.total_hours || 0));
        const rowRegular = formatDecimal(Math.min(rowHours, remainingRegular));
        const rowOT = formatDecimal(rowHours - rowRegular);
        const ticketStatus = TimesheetController.getTicketStatusForTimesheetStatus(r.timesheet_status);
        remainingRegular = formatDecimal(Math.max(0, remainingRegular - rowRegular));

        await pool.query('DELETE FROM tickets WHERE timesheet_row_id = $1', [r.id]);

        if (rowRegular > 0) {
          const amount = calculateAmount(rowRegular, hourly_rate, false);
          await pool.query(
            `INSERT INTO tickets (timesheet_row_id, hours, rate_type, hourly_rate, amount, status)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [r.id, rowRegular, 'regular', hourly_rate, amount, ticketStatus],
          );
        }
        if (rowOT > 0) {
          const amount = calculateAmount(rowOT, hourly_rate, true);
          await pool.query(
            `INSERT INTO tickets (timesheet_row_id, hours, rate_type, hourly_rate, amount, status)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [r.id, rowOT, 'ot', hourly_rate * 1.5, amount, ticketStatus],
          );
        }
      }

      // Upsert week-level OT summary
      await pool.query(
        'DELETE FROM ot_calculations WHERE week_start_date = $1 AND employee_id = $2',
        [weekStartDate, employee_id],
      );
      if (totalHours > 0) {
        const regularHours = formatDecimal(Math.min(40, totalHours));
        const otHours = formatDecimal(Math.max(0, totalHours - 40));
        await pool.query(
          `INSERT INTO ot_calculations (week_start_date, employee_id, total_hours, regular_hours, ot_hours)
           VALUES ($1, $2, $3, $4, $5)`,
          [weekStartDate, employee_id, totalHours, regularHours, otHours],
        );
      }
    }
  }

  static async getTimesheets(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      let query =
        `SELECT t.id, t.week_start_date, t.supervisor_id, t.status,
                t.submitted_at, t.approved_at, t.created_at,
                u.email as supervisor_email,
                (
                  SELECT cr.id
                  FROM timesheet_change_requests cr
                  WHERE cr.timesheet_id = t.id AND cr.status = 'pending'
                  ORDER BY cr.created_at DESC
                  LIMIT 1
                ) as proposal_id,
                (
                  SELECT cr.status
                  FROM timesheet_change_requests cr
                  WHERE cr.timesheet_id = t.id AND cr.status = 'pending'
                  ORDER BY cr.created_at DESC
                  LIMIT 1
                ) as proposal_status,
                (
                  SELECT cr.submitted_at
                  FROM timesheet_change_requests cr
                  WHERE cr.timesheet_id = t.id AND cr.status = 'pending'
                  ORDER BY cr.created_at DESC
                  LIMIT 1
                ) as proposal_submitted_at,
                COALESCE((SELECT SUM(tr2.total_hours) FROM timesheet_rows tr2 WHERE tr2.timesheet_id = t.id), 0) as total_hours,
                COALESCE((
                  SELECT SUM(tk2.amount)
                  FROM tickets tk2
                  JOIN timesheet_rows tr3 ON tk2.timesheet_row_id = tr3.id
                  WHERE tr3.timesheet_id = t.id
                    AND (
                      (t.status = 'approved' AND tk2.status = 'approved')
                      OR (t.status <> 'approved' AND tk2.status <> 'rejected')
                    )
                ), 0) as total_amount
         FROM timesheets t
         JOIN users u ON t.supervisor_id = u.id`;

      const params: any[] = [];

      if (req.user.role === 'supervisor') {
        query += ' WHERE t.supervisor_id = $1';
        params.push(req.user.id);
      }

      query += ' ORDER BY t.week_start_date DESC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Get timesheets error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTimesheetDetail(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { id } = req.params;
      const timesheetId = parseInt(id);

      const tsResult = await pool.query('SELECT * FROM timesheets WHERE id = $1', [timesheetId]);

      if (tsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      const timesheet = tsResult.rows[0];

      if (req.user.role === 'supervisor' && timesheet.supervisor_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const pendingChangeRequest = await TimesheetController.getPendingChangeRequest(timesheetId);
      const latestChangeRequest = pendingChangeRequest || await TimesheetController.getLatestChangeRequest(timesheetId);
      const approvedRows = await TimesheetController.getRowsForTable('timesheet_rows', 'timesheet_id', timesheetId);
      const rowsResult = pendingChangeRequest
        ? await TimesheetController.getRowsForTable('timesheet_change_request_rows', 'change_request_id', pendingChangeRequest.id)
        : approvedRows;

      const otResult = await pool.query(
        `SELECT ot.*, e.name as employee_name
         FROM ot_calculations ot
         JOIN employees e ON ot.employee_id = e.id
         WHERE ot.week_start_date = $1
         ORDER BY e.name`,
        [timesheet.week_start_date],
      );

      res.json({
        timesheet: {
          ...timesheet,
          proposal_id: latestChangeRequest?.id || null,
          proposal_status: pendingChangeRequest ? 'pending' : null,
          proposal_submitted_at: pendingChangeRequest?.submitted_at || null,
          viewing_proposal: !!pendingChangeRequest,
        },
        rows: rowsResult,
        approved_rows: approvedRows,
        ot_calculations: otResult.rows,
      });
    } catch (error) {
      console.error('Get timesheet detail error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateTimesheetRows(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { id } = req.params;
      const { rows } = req.body;
      const timesheetId = parseInt(id);

      const tsResult = await pool.query(
        'SELECT supervisor_id, week_start_date, status FROM timesheets WHERE id = $1',
        [timesheetId],
      );

      if (tsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      if (req.user.role === 'supervisor' && tsResult.rows[0].supervisor_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      try {
        await TimesheetController.validateRowsForUser(req.user, rows);
      } catch (validationError: any) {
        const statusCode = validationError.message?.startsWith('Not assigned to project') ? 403 : 400;
        return res.status(statusCode).json({ error: validationError.message || 'Invalid timesheet rows' });
      }

      if (req.user.role === 'supervisor' && tsResult.rows[0].status === 'approved') {
        const changeRequestId = await TimesheetController.upsertPendingChangeRequest(
          timesheetId,
          rows,
          req.user.id,
          req.user.email,
        );
        return res.json({
          success: true,
          status: tsResult.rows[0].status,
          proposal_status: 'pending',
          proposal_id: changeRequestId,
        });
      }

      for (const row of rows) {
        await TimesheetController.addTimesheetRow(timesheetId, row);
      }

      await TimesheetController.recalculateWeeklyOT(tsResult.rows[0].week_start_date);

      res.json({ success: true, status: tsResult.rows[0].status });
    } catch (error) {
      console.error('Update timesheet rows error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async submitTimesheet(req: AuthRequest, res: Response) {
    try {
      if (!req.user || !['supervisor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only supervisors and admins can submit timesheets' });
      }

      const { id } = req.params;
      const timesheetId = parseInt(id);

      const tsResult = await pool.query('SELECT * FROM timesheets WHERE id = $1', [timesheetId]);

      if (tsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      if (req.user.role !== 'admin' && tsResult.rows[0].supervisor_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await pool.query(
        `UPDATE timesheets SET status = $1, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        ['pending', timesheetId],
      );
      await pool.query(
        `UPDATE tickets SET status = 'pending'
         WHERE timesheet_row_id IN (
           SELECT id FROM timesheet_rows WHERE timesheet_id = $1
         )`,
        [timesheetId],
      );

      await TimesheetController.recalculateWeeklyOT(tsResult.rows[0].week_start_date);
      await TimesheetController.insertHistory(timesheetId, 'submitted', req.user.id, req.user.email);

      res.json({ success: true });
    } catch (error) {
      console.error('Submit timesheet error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async approveTimesheet(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can approve timesheets' });
      }

      const { id } = req.params;
      const timesheetId = parseInt(id);

      const tsResult = await pool.query(
        'SELECT status, week_start_date FROM timesheets WHERE id = $1',
        [timesheetId],
      );
      if (tsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      const pendingChangeRequest = await TimesheetController.getPendingChangeRequest(timesheetId);
      if (pendingChangeRequest && tsResult.rows[0].status === 'approved') {
        await TimesheetController.applyApprovedChangeRequest(
          timesheetId,
          pendingChangeRequest.id,
          tsResult.rows[0].week_start_date,
        );
        await pool.query(
          `UPDATE timesheet_change_requests
           SET reviewed_by = $1
           WHERE id = $2`,
          [req.user.id, pendingChangeRequest.id],
        );
        await pool.query(
          `UPDATE timesheets
           SET approved_at = CURRENT_TIMESTAMP,
               approved_by = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [req.user.id, timesheetId],
        );
        await TimesheetController.insertHistory(
          timesheetId,
          'approved',
          req.user.id,
          req.user.email,
          'Approved a pending change request',
        );
        return res.json({ success: true, proposal_approved: true });
      }

      if (tsResult.rows[0].status !== 'pending') {
        return res.status(400).json({ error: 'Only pending timesheets can be approved' });
      }

      const updateResult = await pool.query(
        `UPDATE timesheets SET status = $1, approved_at = CURRENT_TIMESTAMP, approved_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['approved', req.user.id, timesheetId],
      );

      if ((updateResult as any).rowCount === 0) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      await pool.query(
        `UPDATE tickets SET status = 'approved'
         WHERE timesheet_row_id IN (
           SELECT id FROM timesheet_rows WHERE timesheet_id = $1
         )`,
        [timesheetId],
      );

      await TimesheetController.insertHistory(timesheetId, 'approved', req.user.id, req.user.email);

      res.json({ success: true });
    } catch (error) {
      console.error('Approve timesheet error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async rejectTimesheet(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can reject timesheets' });
      }

      const { id } = req.params;
      const { rejection_reason } = req.body;
      const timesheetId = parseInt(id);

      const tsResult = await pool.query('SELECT status FROM timesheets WHERE id = $1', [timesheetId]);
      if (tsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      const pendingChangeRequest = await TimesheetController.getPendingChangeRequest(timesheetId);
      if (pendingChangeRequest && tsResult.rows[0].status === 'approved') {
        await pool.query(
          `UPDATE timesheet_change_requests
           SET status = 'rejected',
               rejection_reason = $1,
               reviewed_at = CURRENT_TIMESTAMP,
               reviewed_by = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [rejection_reason || null, req.user.id, pendingChangeRequest.id],
        );
        await pool.query(
          'DELETE FROM timesheet_change_request_rows WHERE change_request_id = $1',
          [pendingChangeRequest.id],
        );
        await TimesheetController.insertHistory(
          timesheetId,
          'rejected',
          req.user.id,
          req.user.email,
          rejection_reason || 'Rejected a pending change request',
        );
        return res.json({ success: true, proposal_rejected: true });
      }

      if (tsResult.rows[0].status !== 'pending') {
        return res.status(400).json({ error: 'Only pending timesheets can be rejected' });
      }

      const updateResult = await pool.query(
        `UPDATE timesheets SET status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['rejected', rejection_reason || null, timesheetId],
      );

      if ((updateResult as any).rowCount === 0) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }
      await pool.query(
        `UPDATE tickets SET status = 'rejected'
         WHERE timesheet_row_id IN (
           SELECT id FROM timesheet_rows WHERE timesheet_id = $1
         )`,
        [timesheetId],
      );

      await TimesheetController.insertHistory(timesheetId, 'rejected', req.user.id, req.user.email, rejection_reason || undefined);

      res.json({ success: true });
    } catch (error) {
      console.error('Reject timesheet error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteTimesheet(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { id } = req.params;
      const timesheetId = parseInt(id);

      const tsResult = await pool.query(
        'SELECT supervisor_id, status, week_start_date FROM timesheets WHERE id = $1',
        [timesheetId],
      );

      if (tsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      const ts = tsResult.rows[0];

      // Supervisors can only delete their own draft timesheets
      if (req.user.role === 'supervisor') {
        if (ts.supervisor_id !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized' });
        }
        if (ts.status !== 'draft') {
          return res.status(400).json({ error: 'Only draft timesheets can be deleted' });
        }
      }

      const weekStartDate = tsResult.rows[0].week_start_date;

      await pool.query(
        `DELETE FROM tickets WHERE timesheet_row_id IN (SELECT id FROM timesheet_rows WHERE timesheet_id = $1)`,
        [timesheetId],
      );
      await pool.query('DELETE FROM timesheet_rows WHERE timesheet_id = $1', [timesheetId]);
      await pool.query('DELETE FROM timesheets WHERE id = $1', [timesheetId]);

      // Recalculate weekly OT for remaining timesheets in that week
      await TimesheetController.recalculateWeeklyOT(weekStartDate);

      res.json({ success: true });
    } catch (error) {
      console.error('Delete timesheet error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteTimesheetRow(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { rowId } = req.params;
      const rowResult = await pool.query(
        `SELECT tr.id, tr.timesheet_id, t.supervisor_id, t.status, t.week_start_date, 'timesheet' as source
         FROM timesheet_rows tr
         JOIN timesheets t ON t.id = tr.timesheet_id
         WHERE tr.id = $1`,
        [rowId],
      );

      const proposalRowResult = rowResult.rows.length === 0
        ? await pool.query(
            `SELECT pr.id, cr.timesheet_id, t.supervisor_id, t.status, t.week_start_date, 'proposal' as source
             FROM timesheet_change_request_rows pr
             JOIN timesheet_change_requests cr ON cr.id = pr.change_request_id
             JOIN timesheets t ON t.id = cr.timesheet_id
             WHERE pr.id = $1 AND cr.status = 'pending'`,
            [rowId],
          )
        : { rows: [] as any[] };

      const resultRow = rowResult.rows[0] || proposalRowResult.rows[0];

      if (!resultRow) {
        return res.status(404).json({ error: 'Timesheet row not found' });
      }

      const row = resultRow;

      if (req.user.role === 'supervisor') {
        if (row.supervisor_id !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized' });
        }
      }

      if (row.source === 'proposal') {
        await pool.query('DELETE FROM timesheet_change_request_rows WHERE id = $1', [rowId]);
        return res.json({ success: true, proposal: true });
      }

      await pool.query('DELETE FROM tickets WHERE timesheet_row_id = $1', [rowId]);
      await pool.query('DELETE FROM timesheet_rows WHERE id = $1', [rowId]);
      await TimesheetController.recalculateWeeklyOT(row.week_start_date);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete row error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTimesheetHistory(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
      const { id } = req.params;
      const timesheetId = parseInt(id);

      // Supervisors can only see history of their own timesheets
      if (req.user.role === 'supervisor') {
        const ts = await pool.query('SELECT supervisor_id FROM timesheets WHERE id = $1', [timesheetId]);
        if (ts.rows.length === 0 || ts.rows[0].supervisor_id !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized' });
        }
      }

      const result = await pool.query(
        `SELECT * FROM timesheet_history WHERE timesheet_id = $1 ORDER BY created_at ASC`,
        [timesheetId],
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Get timesheet history error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getEmployeeHoursReport(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { week_start, week_end } = req.query;
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const wsDate = typeof week_start === 'string' && dateRegex.test(week_start) ? week_start : null;
      const weDateVal = typeof week_end === 'string' && dateRegex.test(week_end) ? week_end : null;

      // Date filters — ts-alias for timesheet join, ot-alias for direct week_start_date column
      const buildTsDateFilter = (tsAlias: string) => {
        const parts = [];
        if (wsDate) parts.push(`${tsAlias}.week_start_date >= '${wsDate}'`);
        if (weDateVal) parts.push(`${tsAlias}.week_start_date <= '${weDateVal}'`);
        return parts.length > 0 ? `AND ${parts.join(' AND ')}` : '';
      };
      const buildOtDateFilter = (otAlias: string) => {
        const parts = [];
        if (wsDate) parts.push(`${otAlias}.week_start_date >= '${wsDate}'`);
        if (weDateVal) parts.push(`${otAlias}.week_start_date <= '${weDateVal}'`);
        return parts.length > 0 ? `AND ${parts.join(' AND ')}` : '';
      };

      // Supervisor filter: only show employees from projects they manage
      const supervisorFilter =
        req.user.role === 'supervisor'
          ? `AND e.id IN (
               SELECT DISTINCT ep.employee_id FROM employee_projects ep
               JOIN project_supervisors ps ON ps.project_id = ep.project_id
               WHERE ps.supervisor_id = ${req.user.id}
             )`
          : '';

      const df1 = buildTsDateFilter('ts2');
      const df2 = buildOtDateFilter('ot2');
      const df3 = buildOtDateFilter('ot3');
      const df4 = buildTsDateFilter('ts5');

      const query = `
        SELECT
          e.id as employee_id,
          e.name as employee_name,
          e.position,
          e.hourly_rate,
          COALESCE((
            SELECT SUM(tr2.total_hours)
            FROM timesheet_rows tr2
            JOIN timesheets ts2 ON tr2.timesheet_id = ts2.id
            WHERE tr2.employee_id = e.id ${df1}
          ), 0) as total_hours,
          COALESCE((
            SELECT SUM(ot2.regular_hours)
            FROM ot_calculations ot2
            WHERE ot2.employee_id = e.id ${df2}
          ), 0) as regular_hours,
          COALESCE((
            SELECT SUM(ot3.ot_hours)
            FROM ot_calculations ot3
            WHERE ot3.employee_id = e.id ${df3}
          ), 0) as ot_hours,
          COALESCE((
            SELECT SUM(
              CASE WHEN tr2.sick_days = '' OR tr2.sick_days IS NULL THEN 0
              ELSE (LENGTH(tr2.sick_days) - LENGTH(REPLACE(tr2.sick_days, ',', '')) + 1) END
            )
            FROM timesheet_rows tr2
            JOIN timesheets ts5 ON tr2.timesheet_id = ts5.id
            WHERE tr2.employee_id = e.id ${df4}
          ), 0) as sick_days_count
        FROM employees e
        WHERE 1=1 ${supervisorFilter}
        ORDER BY e.name
      `;

      const result = await pool.query(query, []);
      res.json(result.rows);
    } catch (error) {
      console.error('Employee hours report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Admin alerts — projects without supervisors, employees without projects,
   * overdue pending timesheets, supervisors missing current week's timesheet
   */
  static async getAdminAlerts(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
      }

      // 1. Active projects without any supervisor
      const noSupResult = await pool.query(
        `SELECT p.id, p.name FROM projects p
         WHERE p.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM project_supervisors ps WHERE ps.project_id = p.id
           )
         ORDER BY p.name`,
      );

      // 2. Employees without any project assignment
      const noProjectResult = await pool.query(
        `SELECT e.id, e.name FROM employees e
         WHERE COALESCE(e.is_active, 1) = 1
           AND NOT EXISTS (
             SELECT 1 FROM employee_projects ep WHERE ep.employee_id = e.id
           )
         ORDER BY e.name`,
      );

      // 3. Overdue pending timesheets (pending for more than 3 days)
      const overdueResult = await pool.query(
        `SELECT t.id, t.week_start_date, t.submitted_at, u.email as supervisor_email
         FROM timesheets t
         JOIN users u ON u.id = t.supervisor_id
         WHERE t.status = 'pending'
           AND t.submitted_at IS NOT NULL
           AND (julianday('now') - julianday(t.submitted_at)) > 3
         ORDER BY t.submitted_at ASC`,
      );

      // 4. Active supervisors who have NOT submitted a timesheet for the current week
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today);
      monday.setDate(diff);
      const currentWeek = monday.toISOString().split('T')[0];

      const missingWeekResult = await pool.query(
        `SELECT u.id, u.email, u.name FROM users u
         WHERE u.role = 'supervisor' AND u.is_active = 1
           AND EXISTS (
             SELECT 1 FROM project_supervisors ps WHERE ps.supervisor_id = u.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM timesheets t
             WHERE t.supervisor_id = u.id AND t.week_start_date = $1
           )
         ORDER BY u.email`,
        [currentWeek],
      );

      res.json({
        projects_without_supervisors: noSupResult.rows,
        employees_without_projects: noProjectResult.rows,
        overdue_pending_timesheets: overdueResult.rows.map((r: any) => ({
          ...r,
          days_pending: Math.floor(
            (Date.now() - new Date(r.submitted_at).getTime()) / (1000 * 60 * 60 * 24),
          ),
        })),
        supervisors_missing_this_week: missingWeekResult.rows,
        current_week: currentWeek,
      });
    } catch (error) {
      console.error('Admin alerts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
