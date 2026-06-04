import { Response } from 'express';
import pool from '../database/connection';
import { AuthRequest } from '../middleware/auth';
import { calculateProjectFinancialSummary } from '../utils/calculations';
import { isNonEmptyString, isPositiveNumber, isBetween } from '../utils/validate';

export class ProjectController {
  private static async canAccessProject(req: AuthRequest, projectId: number): Promise<boolean> {
    if (req.user?.role !== 'supervisor') {
      return true;
    }

    const result = await pool.query(
      'SELECT 1 FROM project_supervisors WHERE project_id = $1 AND supervisor_id = $2',
      [projectId, req.user.id],
    );

    return result.rows.length > 0;
  }

  /**
   * Get all projects
   */
  static async getProjects(req: AuthRequest, res: Response) {
    try {
      let result;
      if (req.user?.role === 'supervisor') {
        // Supervisors only see projects they're assigned to
        result = await pool.query(
          `SELECT p.* FROM projects p
           JOIN project_supervisors ps ON ps.project_id = p.id
           WHERE ps.supervisor_id = $1
           ORDER BY CASE p.status WHEN 'active' THEN 1 WHEN 'on_hold' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END, p.created_at DESC`,
          [req.user.id],
        );
      } else {
        result = await pool.query(
          `SELECT * FROM projects ORDER BY
            CASE status WHEN 'active' THEN 1 WHEN 'on_hold' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END,
            created_at DESC`,
          [],
        );
      }
      res.json(result.rows);
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getProjectSupervisors(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      if (!(await ProjectController.canAccessProject(req, projectId))) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const result = await pool.query(
        `SELECT u.id, u.email, u.name FROM users u
         JOIN project_supervisors ps ON ps.supervisor_id = u.id
         WHERE ps.project_id = $1 ORDER BY u.email`,
        [projectId],
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Get project supervisors error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async addProjectSupervisor(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { supervisor_id } = req.body;
      if (!supervisor_id) return res.status(400).json({ error: 'supervisor_id required' });

      await pool.query(
        `INSERT INTO project_supervisors (project_id, supervisor_id) VALUES ($1, $2)`,
        [id, supervisor_id],
      );
      res.status(201).json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE') || error.message?.includes('unique')) {
        return res.status(409).json({ error: 'Supervisor already assigned' });
      }
      console.error('Add project supervisor error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getProjectEmployees(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      if (!(await ProjectController.canAccessProject(req, projectId))) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const result = await pool.query(
        `SELECT e.id, e.name, e.position, e.hourly_rate FROM employees e
         JOIN employee_projects ep ON ep.employee_id = e.id
         WHERE ep.project_id = $1 ORDER BY e.name`,
        [projectId],
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Get project employees error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async addProjectEmployee(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { employee_id } = req.body;
      if (!employee_id) return res.status(400).json({ error: 'employee_id required' });

      await pool.query(
        'INSERT INTO employee_projects (employee_id, project_id) VALUES ($1, $2)',
        [employee_id, id],
      );
      res.status(201).json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE') || error.message?.includes('unique')) {
        return res.status(409).json({ error: 'Employee already assigned' });
      }
      console.error('Add project employee error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async removeProjectEmployee(req: AuthRequest, res: Response) {
    try {
      const { id, employeeId } = req.params;
      await pool.query(
        'DELETE FROM employee_projects WHERE project_id = $1 AND employee_id = $2',
        [id, employeeId],
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Remove project employee error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async removeProjectSupervisor(req: AuthRequest, res: Response) {
    try {
      const { id, supervisorId } = req.params;
      await pool.query(
        `DELETE FROM project_supervisors WHERE project_id = $1 AND supervisor_id = $2`,
        [id, supervisorId],
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Remove project supervisor error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get project with financial summary
   */
  static async getProjectSummary(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      // Get project
      const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);

      if (projectResult.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!(await ProjectController.canAccessProject(req, projectId))) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const project = projectResult.rows[0];

      // Get all tickets for this project
      const ticketsResult = await pool.query(
        `SELECT t.hours, t.rate_type, t.amount, t.status
         FROM tickets t
         JOIN timesheet_rows tr ON t.timesheet_row_id = tr.id
         WHERE tr.project_id = $1`,
        [projectId],
      );

      const tickets = ticketsResult.rows;

      // Calculate totals
      let total_hours = 0;
      let regular_hours = 0;
      let ot_hours = 0;
      let total_amount = 0;
      let regular_amount = 0;
      let ot_amount = 0;

      const ticketsByType = {
        regular: 0,
        ot: 0,
        pending: 0,
        approved: 0,
      };

      for (const ticket of tickets) {
        if (ticket.status === 'approved') {
          total_hours += ticket.hours;
          total_amount += ticket.amount;
        }

        if (ticket.rate_type === 'regular') {
          if (ticket.status === 'approved') {
            regular_hours += ticket.hours;
            regular_amount += ticket.amount;
          }
          ticketsByType.regular++;
        } else {
          if (ticket.status === 'approved') {
            ot_hours += ticket.hours;
            ot_amount += ticket.amount;
          }
          ticketsByType.ot++;
        }

        if (ticket.status === 'pending') {
          ticketsByType.pending++;
        } else if (ticket.status === 'approved') {
          ticketsByType.approved++;
        }
      }

      const ot_spent = ot_amount;
      const current_week_hours = await ProjectController.getCurrentWeekHours(projectId);

      const financialSummary = calculateProjectFinancialSummary(
        project.labor_budget,
        project.overhead_percentage,
        {
          total_hours,
          ot_hours,
          total_amount,
          regular_amount,
          ot_amount,
        },
      );

      // Get assigned supervisors
      const supervisorsResult = await pool.query(
        `SELECT u.id, u.email, u.name FROM users u
         JOIN project_supervisors ps ON ps.supervisor_id = u.id
         WHERE ps.project_id = $1 ORDER BY u.email`,
        [projectId],
      );

      // Get timesheets that include rows for this project
      const timesheetsResult = await pool.query(
        `SELECT t.id, t.week_start_date, t.status, t.supervisor_id,
           u.email as supervisor_email,
           SUM(tr.total_hours) as project_hours
         FROM timesheets t
         JOIN timesheet_rows tr ON tr.timesheet_id = t.id AND tr.project_id = $1
         JOIN users u ON u.id = t.supervisor_id
         GROUP BY t.id, t.week_start_date, t.status, t.supervisor_id, u.email
         ORDER BY t.week_start_date DESC`,
        [projectId],
      );

      // Get employee breakdown for this project
      const employeesResult = await pool.query(
        `SELECT e.id, e.name, e.position,
           SUM(tr.total_hours) as total_hours,
           COALESCE(SUM(CASE WHEN tkt.status = 'approved' AND tkt.rate_type = 'ot' THEN tkt.hours ELSE 0 END), 0) as ot_hours,
           COALESCE(SUM(CASE WHEN tkt.status = 'approved' AND tkt.rate_type = 'regular' THEN tkt.hours ELSE 0 END), 0) as regular_hours,
           COALESCE(SUM(CASE WHEN tkt.status = 'approved' THEN tkt.amount ELSE 0 END), 0) as total_amount
         FROM employees e
         JOIN timesheet_rows tr ON tr.employee_id = e.id AND tr.project_id = $1
         LEFT JOIN tickets tkt ON tkt.timesheet_row_id = tr.id
         GROUP BY e.id, e.name, e.position
         ORDER BY SUM(tr.total_hours) DESC`,
        [projectId],
      );

      res.json({
        id: project.id,
        name: project.name,
        status: project.status,
        labor_budget: project.labor_budget,
        overhead_percentage: project.overhead_percentage,
        total_spent: financialSummary.total_spent,
        overhead_amount: financialSummary.overhead_amount,
        total_with_overhead: financialSummary.total_with_overhead,
        remaining: financialSummary.remaining,
        percent_spent: financialSummary.percent_spent,
        total_hours,
        ot_hours,
        regular_hours,
        ot_spent,
        regular_amount,
        current_week_hours,
        tickets_summary: {
          regular_tickets: ticketsByType.regular,
          ot_tickets: ticketsByType.ot,
          pending: ticketsByType.pending,
          approved: ticketsByType.approved,
        },
        supervisors: supervisorsResult.rows,
        timesheets: timesheetsResult.rows,
        employees: employeesResult.rows,
      });
    } catch (error) {
      console.error('Get project summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all project summaries (for dashboard)
   */
  static async getAllProjectSummaries(req: AuthRequest, res: Response) {
    try {
      const projectsResult = req.user?.role === 'supervisor'
        ? await pool.query(
            `SELECT p.* FROM projects p
             JOIN project_supervisors ps ON ps.project_id = p.id
             WHERE p.status = 'active' AND ps.supervisor_id = $1
             ORDER BY p.created_at DESC`,
            [req.user.id],
          )
        : await pool.query(
            `SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC`,
            [],
          );

      const summaries = [];

      for (const project of projectsResult.rows) {
        const summary = await ProjectController.buildProjectSummary(project.id, project);
        summaries.push(summary);
      }

      res.json(summaries);
    } catch (error) {
      console.error('Get all project summaries error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Build project summary object
   */
  static async buildProjectSummary(projectId: number, project: any) {
    const ticketsResult = await pool.query(
      `SELECT t.hours, t.rate_type, t.amount, t.status
       FROM tickets t
       JOIN timesheet_rows tr ON t.timesheet_row_id = tr.id
       WHERE tr.project_id = $1`,
      [projectId],
    );

    const tickets = ticketsResult.rows;

    let total_hours = 0;
    let ot_hours = 0;
    let total_amount = 0;
    let ot_amount = 0;

    const ticketsByType = {
      regular: 0,
      ot: 0,
      pending: 0,
      approved: 0,
    };

      for (const ticket of tickets) {
        if (ticket.status === 'approved') {
          total_hours += ticket.hours;
          total_amount += ticket.amount;
        }

        if (ticket.rate_type === 'regular') {
          ticketsByType.regular++;
        } else {
          if (ticket.status === 'approved') {
            ot_hours += ticket.hours;
            ot_amount += ticket.amount;
          }
          ticketsByType.ot++;
        }

      if (ticket.status === 'pending') {
        ticketsByType.pending++;
      } else if (ticket.status === 'approved') {
        ticketsByType.approved++;
      }
    }

    const current_week_hours = await ProjectController.getCurrentWeekHours(projectId);

    const financialSummary = calculateProjectFinancialSummary(
      project.labor_budget,
      project.overhead_percentage,
      {
        total_hours,
        ot_hours,
        total_amount,
        regular_amount: total_amount - ot_amount,
        ot_amount,
      },
    );

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      labor_budget: project.labor_budget,
      total_spent: financialSummary.total_spent,
      overhead_amount: financialSummary.overhead_amount,
      total_with_overhead: financialSummary.total_with_overhead,
      remaining: financialSummary.remaining,
      percent_spent: financialSummary.percent_spent,
      total_hours,
      ot_hours,
      ot_spent: ot_amount,
      current_week_hours,
      tickets_summary: {
        regular_tickets: ticketsByType.regular,
        ot_tickets: ticketsByType.ot,
        pending: ticketsByType.pending,
        approved: ticketsByType.approved,
      },
    };
  }

  /**
   * Get current week hours for a project
   */
  static async getCurrentWeekHours(projectId: number): Promise<number> {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));

    const result = await pool.query(
      `SELECT SUM(tr.total_hours) as total_hours
       FROM timesheet_rows tr
       JOIN timesheets t ON tr.timesheet_id = t.id
       WHERE tr.project_id = $1 AND t.week_start_date = $2`,
      [projectId, monday.toISOString().split('T')[0]],
    );

    return parseFloat(result.rows[0].total_hours || 0);
  }

  /**
   * Create new project (admin only)
   */
  static async createProject(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create projects' });
      }

      const { name, labor_budget, overhead_percentage, code } = req.body;

      if (!name || !labor_budget) {
        return res.status(400).json({ error: 'Name and labor_budget required' });
      }

      if (!isNonEmptyString(name, 200)) {
        return res.status(400).json({ error: 'Project name must be 1–200 characters' });
      }

      if (!isPositiveNumber(labor_budget)) {
        return res.status(400).json({ error: 'labor_budget must be a positive number' });
      }

      if (overhead_percentage !== undefined && !isBetween(overhead_percentage, 0, 200)) {
        return res.status(400).json({ error: 'overhead_percentage must be between 0 and 200' });
      }

      if (code !== undefined && code !== null && code !== '' && !isNonEmptyString(code, 20)) {
        return res.status(400).json({ error: 'Project code must be 1–20 characters' });
      }

      const result = await pool.query(
        `INSERT INTO projects (name, labor_budget, overhead_percentage, status, code)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, labor_budget, overhead_percentage || 20, 'active', code || null],
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete project (admin only)
   */
  static async deleteProject(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can delete projects' });
      }

      const { id } = req.params;

      await pool.query('DELETE FROM projects WHERE id = $1', [id]);

      res.json({ success: true });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update project (admin only)
   */
  static async updateProject(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update projects' });
      }

      const { id } = req.params;
      const { name, labor_budget, overhead_percentage, status, code } = req.body;

      if (name !== undefined && !isNonEmptyString(name, 200)) {
        return res.status(400).json({ error: 'Project name must be 1–200 characters' });
      }

      if (labor_budget !== undefined && !isPositiveNumber(labor_budget)) {
        return res.status(400).json({ error: 'labor_budget must be a positive number' });
      }

      if (overhead_percentage !== undefined && !isBetween(overhead_percentage, 0, 200)) {
        return res.status(400).json({ error: 'overhead_percentage must be between 0 and 200' });
      }

      const result = await pool.query(
        `UPDATE projects SET name = COALESCE($1, name),
         labor_budget = COALESCE($2, labor_budget),
         overhead_percentage = COALESCE($3, overhead_percentage),
         status = COALESCE($4, status),
         code = CASE WHEN $5 IS NOT NULL THEN $5 ELSE code END,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 RETURNING *`,
        [name, labor_budget, overhead_percentage, status, code !== undefined ? code : null, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
