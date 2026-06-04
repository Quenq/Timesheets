"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const authController_1 = require("../controllers/authController");
const timesheetController_1 = require("../controllers/timesheetController");
const projectController_1 = require("../controllers/projectController");
const employeeController_1 = require("../controllers/employeeController");
const exportController_1 = require("../controllers/exportController");
const router = (0, express_1.Router)();
// Authentication routes
router.post('/auth/login', authController_1.AuthController.login);
router.post('/auth/register', authController_1.AuthController.register);
router.get('/auth/me', auth_1.authenticateToken, authController_1.AuthController.me);
// Supervisor management routes (admin only)
router.get('/supervisors', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), authController_1.AuthController.getSupervisors);
router.post('/supervisors', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), authController_1.AuthController.createSupervisor);
router.patch('/supervisors/:id', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), authController_1.AuthController.updateSupervisor);
router.post('/supervisors/:id/toggle-active', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), authController_1.AuthController.toggleSupervisorActive);
// Timesheet routes
router.post('/timesheets', auth_1.authenticateToken, timesheetController_1.TimesheetController.createTimesheet);
router.get('/timesheets', auth_1.authenticateToken, timesheetController_1.TimesheetController.getTimesheets);
router.get('/timesheets/:id', auth_1.authenticateToken, timesheetController_1.TimesheetController.getTimesheetDetail);
router.patch('/timesheets/:id', auth_1.authenticateToken, timesheetController_1.TimesheetController.updateTimesheetRows);
router.post('/timesheets/:id/submit', auth_1.authenticateToken, timesheetController_1.TimesheetController.submitTimesheet);
router.post('/timesheets/:id/approve', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), timesheetController_1.TimesheetController.approveTimesheet);
router.post('/timesheets/:id/reject', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), timesheetController_1.TimesheetController.rejectTimesheet);
router.get('/timesheets/:id/history', auth_1.authenticateToken, timesheetController_1.TimesheetController.getTimesheetHistory);
router.delete('/timesheets/rows/:rowId', auth_1.authenticateToken, timesheetController_1.TimesheetController.deleteTimesheetRow);
router.delete('/timesheets/:id', auth_1.authenticateToken, timesheetController_1.TimesheetController.deleteTimesheet);
// Project routes
router.get('/projects', auth_1.authenticateToken, projectController_1.ProjectController.getProjects);
router.post('/projects', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), projectController_1.ProjectController.createProject);
router.get('/projects/summaries/all', auth_1.authenticateToken, projectController_1.ProjectController.getAllProjectSummaries);
router.get('/projects/:id', auth_1.authenticateToken, projectController_1.ProjectController.getProjectSummary);
router.patch('/projects/:id', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), projectController_1.ProjectController.updateProject);
router.delete('/projects/:id', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), projectController_1.ProjectController.deleteProject);
router.get('/projects/:id/supervisors', auth_1.authenticateToken, projectController_1.ProjectController.getProjectSupervisors);
router.post('/projects/:id/supervisors', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), projectController_1.ProjectController.addProjectSupervisor);
router.delete('/projects/:id/supervisors/:supervisorId', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), projectController_1.ProjectController.removeProjectSupervisor);
router.get('/projects/:id/employees', auth_1.authenticateToken, projectController_1.ProjectController.getProjectEmployees);
router.post('/projects/:id/employees', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), projectController_1.ProjectController.addProjectEmployee);
router.delete('/projects/:id/employees/:employeeId', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), projectController_1.ProjectController.removeProjectEmployee);
// Employee routes
router.get('/employees', auth_1.authenticateToken, employeeController_1.EmployeeController.getEmployees);
router.get('/employees/hours-report', auth_1.authenticateToken, timesheetController_1.TimesheetController.getEmployeeHoursReport);
router.post('/employees', auth_1.authenticateToken, employeeController_1.EmployeeController.createEmployee);
router.patch('/employees/:id', auth_1.authenticateToken, employeeController_1.EmployeeController.updateEmployee);
router.delete('/employees/:id', auth_1.authenticateToken, employeeController_1.EmployeeController.deleteEmployee);
router.post('/employees/:id/toggle-active', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), employeeController_1.EmployeeController.toggleEmployeeActive);
// Admin alerts
router.get('/admin/alerts', auth_1.authenticateToken, (0, auth_1.authorizeRole)('admin'), timesheetController_1.TimesheetController.getAdminAlerts);
// Export routes
router.get('/export/excel', auth_1.authenticateToken, exportController_1.ExportController.exportToExcel);
exports.default = router;
//# sourceMappingURL=index.js.map