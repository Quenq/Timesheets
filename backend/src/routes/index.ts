import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { AuthController } from '../controllers/authController';
import { TimesheetController } from '../controllers/timesheetController';
import { ProjectController } from '../controllers/projectController';
import { EmployeeController } from '../controllers/employeeController';
import { ExportController } from '../controllers/exportController';

const router = Router();

// Authentication routes
router.post('/auth/login', AuthController.login);
router.post('/auth/register', AuthController.register);
router.get('/auth/me', authenticateToken, AuthController.me);

// Supervisor management routes (admin only)
router.get('/supervisors', authenticateToken, authorizeRole('admin'), AuthController.getSupervisors);
router.post('/supervisors', authenticateToken, authorizeRole('admin'), AuthController.createSupervisor);
router.patch('/supervisors/:id', authenticateToken, authorizeRole('admin'), AuthController.updateSupervisor);
router.post('/supervisors/:id/toggle-active', authenticateToken, authorizeRole('admin'), AuthController.toggleSupervisorActive);

// Timesheet routes
router.post('/timesheets', authenticateToken, TimesheetController.createTimesheet);
router.get('/timesheets', authenticateToken, TimesheetController.getTimesheets);
router.get('/timesheets/:id', authenticateToken, TimesheetController.getTimesheetDetail);
router.patch('/timesheets/:id', authenticateToken, TimesheetController.updateTimesheetRows);
router.post('/timesheets/:id/submit', authenticateToken, TimesheetController.submitTimesheet);
router.post('/timesheets/:id/approve', authenticateToken, authorizeRole('admin'), TimesheetController.approveTimesheet);
router.post('/timesheets/:id/reject', authenticateToken, authorizeRole('admin'), TimesheetController.rejectTimesheet);
router.get('/timesheets/:id/history', authenticateToken, TimesheetController.getTimesheetHistory);
router.delete('/timesheets/rows/:rowId', authenticateToken, TimesheetController.deleteTimesheetRow);
router.delete('/timesheets/:id', authenticateToken, TimesheetController.deleteTimesheet);

// Project routes
router.get('/projects', authenticateToken, ProjectController.getProjects);
router.post('/projects', authenticateToken, authorizeRole('admin'), ProjectController.createProject);
router.get('/projects/summaries/all', authenticateToken, ProjectController.getAllProjectSummaries);
router.get('/projects/:id', authenticateToken, ProjectController.getProjectSummary);
router.patch('/projects/:id', authenticateToken, authorizeRole('admin'), ProjectController.updateProject);
router.delete('/projects/:id', authenticateToken, authorizeRole('admin'), ProjectController.deleteProject);
router.get('/projects/:id/supervisors', authenticateToken, ProjectController.getProjectSupervisors);
router.post('/projects/:id/supervisors', authenticateToken, authorizeRole('admin'), ProjectController.addProjectSupervisor);
router.delete('/projects/:id/supervisors/:supervisorId', authenticateToken, authorizeRole('admin'), ProjectController.removeProjectSupervisor);
router.get('/projects/:id/employees', authenticateToken, ProjectController.getProjectEmployees);
router.post('/projects/:id/employees', authenticateToken, authorizeRole('admin'), ProjectController.addProjectEmployee);
router.delete('/projects/:id/employees/:employeeId', authenticateToken, authorizeRole('admin'), ProjectController.removeProjectEmployee);

// Employee routes
router.get('/employees', authenticateToken, EmployeeController.getEmployees);
router.get('/employees/hours-report', authenticateToken, TimesheetController.getEmployeeHoursReport);
router.post('/employees', authenticateToken, EmployeeController.createEmployee);
router.patch('/employees/:id', authenticateToken, EmployeeController.updateEmployee);
router.delete('/employees/:id', authenticateToken, EmployeeController.deleteEmployee);
router.post('/employees/:id/toggle-active', authenticateToken, authorizeRole('admin'), EmployeeController.toggleEmployeeActive);

// Admin alerts
router.get('/admin/alerts', authenticateToken, authorizeRole('admin'), TimesheetController.getAdminAlerts);

// Export routes
router.get('/export/excel', authenticateToken, ExportController.exportToExcel);

export default router;
