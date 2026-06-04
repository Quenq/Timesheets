"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeController = void 0;
const connection_1 = __importDefault(require("../database/connection"));
const validate_1 = require("../utils/validate");
class EmployeeController {
    static async getEmployees(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ error: 'Not authenticated' });
            const projectId = req.query.project_id ? parseInt(req.query.project_id) : null;
            let query;
            let params;
            if (projectId) {
                // Return employees assigned to a specific project
                // Supervisors must be assigned to that project
                if (req.user.role === 'supervisor') {
                    const assigned = await connection_1.default.query('SELECT 1 FROM project_supervisors WHERE project_id = $1 AND supervisor_id = $2', [projectId, req.user.id]);
                    if (assigned.rows.length === 0) {
                        return res.status(403).json({ error: 'Not assigned to this project' });
                    }
                }
                query = `
          SELECT e.*, GROUP_CONCAT(ep2.project_id) as project_ids
          FROM employees e
          JOIN employee_projects ep ON ep.employee_id = e.id AND ep.project_id = $1
          LEFT JOIN employee_projects ep2 ON ep2.employee_id = e.id
          GROUP BY e.id
          ORDER BY e.name`;
                params = [projectId];
            }
            else if (req.user.role === 'supervisor') {
                // Return employees from all projects this supervisor is assigned to
                query = `
          SELECT DISTINCT e.*, GROUP_CONCAT(ep.project_id) as project_ids
          FROM employees e
          JOIN employee_projects ep ON ep.employee_id = e.id
          JOIN project_supervisors ps ON ps.project_id = ep.project_id AND ps.supervisor_id = $1
          GROUP BY e.id
          ORDER BY e.name`;
                params = [req.user.id];
            }
            else {
                // Admin: all employees with their project ids
                const includeInactive = req.query.include_inactive === 'true';
                query = `
          SELECT e.*, GROUP_CONCAT(ep.project_id) as project_ids
          FROM employees e
          LEFT JOIN employee_projects ep ON ep.employee_id = e.id
          ${includeInactive ? '' : "WHERE COALESCE(e.is_active, 1) = 1"}
          GROUP BY e.id
          ORDER BY e.name`;
                params = [];
            }
            const result = await connection_1.default.query(query, params);
            const rows = result.rows.map((r) => ({
                ...r,
                project_ids: r.project_ids
                    ? r.project_ids.split(',').map(Number)
                    : [],
            }));
            res.json(rows);
        }
        catch (error) {
            console.error('Get employees error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async createEmployee(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ error: 'Not authenticated' });
            if (req.user.role !== 'admin')
                return res.status(403).json({ error: 'Admin only' });
            const { name, hourly_rate, position } = req.body;
            if (!name || !hourly_rate) {
                return res.status(400).json({ error: 'Name and hourly_rate required' });
            }
            if (!(0, validate_1.isNonEmptyString)(name, 100)) {
                return res.status(400).json({ error: 'Name must be 1–100 characters' });
            }
            if (!(0, validate_1.isPositiveNumber)(hourly_rate)) {
                return res.status(400).json({ error: 'hourly_rate must be a positive number' });
            }
            if (position !== undefined && position !== null && position !== '' && !(0, validate_1.isNonEmptyString)(position, 100)) {
                return res.status(400).json({ error: 'Position must be under 100 characters' });
            }
            const result = await connection_1.default.query('INSERT INTO employees (name, hourly_rate, position) VALUES ($1, $2, $3) RETURNING *', [name, hourly_rate, position || null]);
            res.status(201).json({ ...result.rows[0], project_ids: [] });
        }
        catch (error) {
            console.error('Create employee error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async updateEmployee(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ error: 'Not authenticated' });
            if (req.user.role !== 'admin')
                return res.status(403).json({ error: 'Admin only' });
            const { id } = req.params;
            const { name, hourly_rate, position } = req.body;
            const result = await connection_1.default.query(`UPDATE employees SET
         name = COALESCE($1, name),
         hourly_rate = COALESCE($2, hourly_rate),
         position = COALESCE($3, position),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 RETURNING *`, [name, hourly_rate, position, id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found' });
            }
            const epResult = await connection_1.default.query('SELECT project_id FROM employee_projects WHERE employee_id = $1', [id]);
            res.json({
                ...result.rows[0],
                project_ids: epResult.rows.map((r) => r.project_id),
            });
        }
        catch (error) {
            console.error('Update employee error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async deleteEmployee(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ error: 'Not authenticated' });
            if (req.user.role !== 'admin')
                return res.status(403).json({ error: 'Admin only' });
            const { id } = req.params;
            const result = await connection_1.default.query('DELETE FROM employees WHERE id = $1 RETURNING id', [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found' });
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Delete employee error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async toggleEmployeeActive(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ error: 'Not authenticated' });
            if (req.user.role !== 'admin')
                return res.status(403).json({ error: 'Admin only' });
            const { id } = req.params;
            const current = await connection_1.default.query('SELECT is_active FROM employees WHERE id = $1', [id]);
            if (current.rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found' });
            }
            const newActive = (current.rows[0].is_active ?? 1) ? 0 : 1;
            await connection_1.default.query('UPDATE employees SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newActive, id]);
            res.json({ success: true, is_active: newActive });
        }
        catch (error) {
            console.error('Toggle employee active error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.EmployeeController = EmployeeController;
//# sourceMappingURL=employeeController.js.map