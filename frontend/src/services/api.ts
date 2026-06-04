import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403 && error.response?.data?.error === 'Invalid or expired token') {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      },
    );
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, role: string, company_name?: string) {
    const response = await this.client.post('/auth/register', { email, password, role, company_name });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Supervisor management endpoints (admin only)
  async getSupervisors() {
    const response = await this.client.get('/supervisors');
    return response.data;
  }

  async createSupervisor(data: { email: string; password: string; name?: string }) {
    const response = await this.client.post('/supervisors', data);
    return response.data;
  }

  async updateSupervisor(id: number, data: { email?: string; name?: string; password?: string }) {
    const response = await this.client.patch(`/supervisors/${id}`, data);
    return response.data;
  }

  async toggleSupervisorActive(id: number) {
    const response = await this.client.post(`/supervisors/${id}/toggle-active`);
    return response.data;
  }

  // Timesheet endpoints
  async createTimesheet(week_start_date: string, rows: any[], supervisor_id?: number) {
    const response = await this.client.post('/timesheets', { week_start_date, rows, supervisor_id });
    return response.data;
  }

  async getTimesheets() {
    const response = await this.client.get('/timesheets');
    return response.data;
  }

  async getTimesheetDetail(id: number) {
    const response = await this.client.get(`/timesheets/${id}`);
    return response.data;
  }

  async updateTimesheetRows(id: number, rows: any[]) {
    const response = await this.client.patch(`/timesheets/${id}`, { rows });
    return response.data;
  }

  async submitTimesheet(id: number) {
    const response = await this.client.post(`/timesheets/${id}/submit`);
    return response.data;
  }

  async approveTimesheet(id: number) {
    const response = await this.client.post(`/timesheets/${id}/approve`);
    return response.data;
  }

  async rejectTimesheet(id: number, rejection_reason?: string) {
    const response = await this.client.post(`/timesheets/${id}/reject`, { rejection_reason });
    return response.data;
  }

  async deleteTimesheet(id: number) {
    const response = await this.client.delete(`/timesheets/${id}`);
    return response.data;
  }

  async getTimesheetHistory(id: number) {
    const response = await this.client.get(`/timesheets/${id}/history`);
    return response.data;
  }

  async deleteTimesheetRow(rowId: number) {
    const response = await this.client.delete(`/timesheets/rows/${rowId}`);
    return response.data;
  }

  // Project endpoints
  async getProjects() {
    const response = await this.client.get('/projects');
    return response.data;
  }

  async getAllProjectSummaries() {
    const response = await this.client.get('/projects/summaries/all');
    return response.data;
  }

  async getProjectSummary(id: number) {
    const response = await this.client.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(name: string, labor_budget: number, overhead_percentage?: number, code?: string) {
    const response = await this.client.post('/projects', { name, labor_budget, overhead_percentage, code });
    return response.data;
  }

  async updateProject(id: number, data: { name?: string; labor_budget?: number; overhead_percentage?: number; status?: string; code?: string }) {
    const response = await this.client.patch(`/projects/${id}`, data);
    return response.data;
  }

  async deleteProject(id: number) {
    const response = await this.client.delete(`/projects/${id}`);
    return response.data;
  }

  async getProjectSupervisors(projectId: number) {
    const response = await this.client.get(`/projects/${projectId}/supervisors`);
    return response.data;
  }

  async addProjectSupervisor(projectId: number, supervisor_id: number) {
    const response = await this.client.post(`/projects/${projectId}/supervisors`, { supervisor_id });
    return response.data;
  }

  async removeProjectSupervisor(projectId: number, supervisorId: number) {
    const response = await this.client.delete(`/projects/${projectId}/supervisors/${supervisorId}`);
    return response.data;
  }

  // Employee endpoints
  async getEmployees(project_id?: number, include_inactive?: boolean) {
    const params: any = {};
    if (project_id) params.project_id = project_id;
    if (include_inactive) params.include_inactive = 'true';
    const response = await this.client.get('/employees', { params });
    return response.data;
  }

  async getProjectEmployees(projectId: number) {
    const response = await this.client.get(`/projects/${projectId}/employees`);
    return response.data;
  }

  async addProjectEmployee(projectId: number, employee_id: number) {
    const response = await this.client.post(`/projects/${projectId}/employees`, { employee_id });
    return response.data;
  }

  async removeProjectEmployee(projectId: number, employeeId: number) {
    const response = await this.client.delete(`/projects/${projectId}/employees/${employeeId}`);
    return response.data;
  }

  async getEmployeeHoursReport(params?: { week_start?: string; week_end?: string }) {
    const response = await this.client.get('/employees/hours-report', { params });
    return response.data;
  }

  async createEmployee(name: string, hourly_rate: number, position?: string) {
    const response = await this.client.post('/employees', { name, hourly_rate, position });
    return response.data;
  }

  async updateEmployee(id: number, data: any) {
    const response = await this.client.patch(`/employees/${id}`, data);
    return response.data;
  }

  async deleteEmployee(id: number) {
    const response = await this.client.delete(`/employees/${id}`);
    return response.data;
  }

  async toggleEmployeeActive(id: number) {
    const response = await this.client.post(`/employees/${id}/toggle-active`);
    return response.data;
  }

  // Admin alerts
  async getAdminAlerts() {
    const response = await this.client.get('/admin/alerts');
    return response.data;
  }

  // Export endpoints
  async exportToExcel(weekStart: string, weekEnd?: string) {
    const params: any = { week: weekStart, week_start: weekStart };
    if (weekEnd) params.week_end = weekEnd;
    const response = await this.client.get('/export/excel', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }
}

const api = new ApiClient();
export default api;
