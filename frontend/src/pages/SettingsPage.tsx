import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Employee, Project, Supervisor } from '../types';
import { User } from '../types';
import toast from 'react-hot-toast';

interface SettingsPageProps {
  user: User | null;
}

export function SettingsPage({ user }: SettingsPageProps) {
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<'employees' | 'projects' | 'supervisors'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Employee form
  const [newEmployee, setNewEmployee] = useState({ name: '', hourly_rate: '', position: '' });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showInactiveEmployees, setShowInactiveEmployees] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<number | null>(null);

  // Project form
  const [newProject, setNewProject] = useState({ name: '', code: '', labor_budget: '', overhead_percentage: '20' });
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [deleteProjectId, setDeleteProjectId] = useState<{ id: number; name: string } | null>(null);
  const [projectSupervisors, setProjectSupervisors] = useState<any[]>([]);
  const [projectEmployees, setProjectEmployees] = useState<any[]>([]);
  const [addingSupToProject, setAddingSupToProject] = useState<number>(0);
  const [addingEmpToProject, setAddingEmpToProject] = useState<number>(0);

  // Supervisor form
  const [newSupervisor, setNewSupervisor] = useState({ email: '', password: '', name: '' });
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null);
  const [editSupForm, setEditSupForm] = useState({ email: '', name: '', password: '' });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    try {
      setError(null);
      // Admin gets all employees including inactive so they can manage them
      const calls: Promise<any>[] = [api.getEmployees(undefined, isAdmin), api.getProjects()];
      if (isAdmin) calls.push(api.getSupervisors());
      const results = await Promise.all(calls);
      setEmployees(results[0]);
      setProjects(results[1]);
      if (isAdmin) setSupervisors(results[2]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  // --- Employee handlers ---
  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.hourly_rate) {
      toast.error('Name and hourly rate required');
      return;
    }
    try {
      setSaving(true);
      await api.createEmployee(newEmployee.name, parseFloat(newEmployee.hourly_rate), newEmployee.position);
      setNewEmployee({ name: '', hourly_rate: '', position: '' });
      fetchData();
      toast.success('Employee added');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;
    try {
      setSaving(true);
      await api.updateEmployee(editingEmployee.id, {
        name: editingEmployee.name,
        hourly_rate: editingEmployee.hourly_rate,
        position: editingEmployee.position,
      });
      setEditingEmployee(null);
      fetchData();
      toast.success('Employee updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEmployee(id: number) {
    setDeleteEmployeeId(id);
  }

  async function confirmDeleteEmployee() {
    if (deleteEmployeeId === null) return;
    const id = deleteEmployeeId;
    setDeleteEmployeeId(null);
    try {
      await api.deleteEmployee(id);
      fetchData();
      toast.success('Employee deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete employee');
    }
  }

  async function handleToggleEmployeeActive(id: number) {
    try {
      const result = await api.toggleEmployeeActive(id);
      fetchData();
      toast.success(result.is_active ? 'Employee activated' : 'Employee archived');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update employee');
    }
  }

  // --- Project handlers ---
  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name || !newProject.labor_budget) {
      toast.error('Name and labor budget required');
      return;
    }
    try {
      setSaving(true);
      await api.createProject(newProject.name, parseFloat(newProject.labor_budget), parseFloat(newProject.overhead_percentage), newProject.code || undefined);
      setNewProject({ name: '', code: '', labor_budget: '', overhead_percentage: '20' });
      fetchData();
      toast.success('Project created');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProject) return;
    try {
      setSaving(true);
      await api.updateProject(editingProject.id, {
        name: editingProject.name,
        code: editingProject.code,
        labor_budget: editingProject.labor_budget,
        overhead_percentage: editingProject.overhead_percentage,
        status: editingProject.status,
      });
      setEditingProject(null);
      fetchData();
      toast.success('Project updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject(id: number, name: string) {
    setDeleteProjectId({ id, name });
  }

  async function confirmDeleteProject() {
    if (!deleteProjectId) return;
    const { id } = deleteProjectId;
    setDeleteProjectId(null);
    try {
      await api.deleteProject(id);
      fetchData();
      toast.success('Project deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete project');
    }
  }

  async function openEditProject(proj: Project) {
    setEditingProject(proj);
    setAddingSupToProject(0);
    setAddingEmpToProject(0);
    try {
      const [sups, emps] = await Promise.all([
        api.getProjectSupervisors(proj.id),
        api.getProjectEmployees(proj.id),
      ]);
      setProjectSupervisors(sups);
      setProjectEmployees(emps);
    } catch {
      setProjectSupervisors([]);
      setProjectEmployees([]);
    }
  }

  async function handleAddSupToProject() {
    if (!editingProject || !addingSupToProject) return;
    try {
      await api.addProjectSupervisor(editingProject.id, addingSupToProject);
      setProjectSupervisors(await api.getProjectSupervisors(editingProject.id));
      setAddingSupToProject(0);
      fetchData();
      toast.success('Supervisor assigned');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign supervisor');
    }
  }

  async function handleRemoveSupFromProject(supervisorId: number) {
    if (!editingProject) return;
    try {
      await api.removeProjectSupervisor(editingProject.id, supervisorId);
      setProjectSupervisors(await api.getProjectSupervisors(editingProject.id));
      fetchData();
      toast.success('Supervisor removed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove supervisor');
    }
  }

  async function handleAddEmpToProject() {
    if (!editingProject || !addingEmpToProject) return;
    try {
      await api.addProjectEmployee(editingProject.id, addingEmpToProject);
      setProjectEmployees(await api.getProjectEmployees(editingProject.id));
      setAddingEmpToProject(0);
      fetchData();
      toast.success('Employee assigned');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign employee');
    }
  }

  async function handleRemoveEmpFromProject(employeeId: number) {
    if (!editingProject) return;
    try {
      await api.removeProjectEmployee(editingProject.id, employeeId);
      setProjectEmployees(await api.getProjectEmployees(editingProject.id));
      fetchData();
      toast.success('Employee removed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove employee');
    }
  }

  // --- Supervisor handlers ---
  async function handleAddSupervisor(e: React.FormEvent) {
    e.preventDefault();
    if (!newSupervisor.email || !newSupervisor.password) {
      toast.error('Email and password required');
      return;
    }
    try {
      setSaving(true);
      await api.createSupervisor(newSupervisor);
      setNewSupervisor({ email: '', password: '', name: '' });
      fetchData();
      toast.success('Supervisor created');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create supervisor');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSupervisor(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSupervisor) return;
    try {
      setSaving(true);
      const data: any = { email: editSupForm.email, name: editSupForm.name };
      if (editSupForm.password) data.password = editSupForm.password;
      await api.updateSupervisor(editingSupervisor.id, data);
      setEditingSupervisor(null);
      fetchData();
      toast.success('Supervisor updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update supervisor');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSupervisorActive(id: number) {
    try {
      const result = await api.toggleSupervisorActive(id);
      fetchData();
      toast.success(result.is_active ? 'Supervisor activated' : 'Supervisor deactivated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle supervisor');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  const tabs = [
    { key: 'employees', label: 'Employees' },
    { key: 'projects', label: 'Projects' },
    ...(isAdmin ? [{ key: 'supervisors', label: 'Supervisors' }] : []),
  ] as { key: 'employees' | 'projects' | 'supervisors'; label: string }[];

  // Filtered lists
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      (emp.position || '').toLowerCase().includes(employeeSearch.toLowerCase());
    const matchesActive = showInactiveEmployees ? true : (emp.is_active ?? 1) === 1;
    return matchesSearch && matchesActive;
  });

  const filteredProjects = projects.filter(proj =>
    proj.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (proj.code || '').toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div>
      {/* Delete Employee Modal */}
      {deleteEmployeeId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Employee</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure? This will permanently delete the employee and all their timesheet records. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmDeleteEmployee}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm">
                Delete
              </button>
              <button onClick={() => setDeleteEmployeeId(null)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {deleteProjectId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Project</h3>
            <p className="text-sm text-gray-600 mb-6">
              Delete <strong>"{deleteProjectId.name}"</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmDeleteProject}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm">
                Delete
              </button>
              <button onClick={() => setDeleteProjectId(null)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 border-b">
        <div className="flex gap-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===================== EMPLOYEES TAB ===================== */}
      {tab === 'employees' && (
        <div className="space-y-6">
          {isAdmin && editingEmployee && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Edit Employee</h3>
                <form onSubmit={handleUpdateEmployee} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editingEmployee.name}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingEmployee.hourly_rate}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, hourly_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <input
                      type="text"
                      value={editingEmployee.position || ''}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Projects: {editingEmployee.project_ids?.length
                      ? editingEmployee.project_ids.map(id => projects.find(p => p.id === id)?.name || `#${id}`).join(', ')
                      : 'None — assign via Projects tab'}
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={saving}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingEmployee(null)}
                      className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {isAdmin ? (
              <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Add Employee</h3>
                <form onSubmit={handleAddEmployee} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label>
                    <input type="number" step="0.01" value={newEmployee.hourly_rate}
                      onChange={(e) => setNewEmployee({ ...newEmployee, hourly_rate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="$25.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <input type="text" value={newEmployee.position}
                      onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g., Carpenter" />
                  </div>
                  <p className="text-xs text-gray-400">Assign to projects after creating via the Projects tab.</p>
                  <button type="submit" disabled={saving}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                    {saving ? 'Adding...' : 'Add Employee'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Employees</h3>
                <p className="text-sm text-gray-500">
                  Supervisors can view assigned employees here, but employee creation and edits are admin-only.
                </p>
              </div>
            )}

            <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-lg shadow overflow-hidden`}>
              <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="flex-1 min-w-40 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
                {isAdmin && (
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showInactiveEmployees}
                      onChange={(e) => setShowInactiveEmployees(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Show archived
                  </label>
                )}
                <span className="text-xs text-gray-400">{filteredEmployees.length} / {employees.length}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Position</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Rate</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Projects</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                        {employees.length === 0
                          ? 'No employees yet. Add your first employee using the form.'
                          : 'No employees match your search.'}
                      </td>
                    </tr>
                  ) : filteredEmployees.map((emp) => {
                    const isInactive = (emp.is_active ?? 1) === 0;
                    return (
                      <tr key={emp.id} className={`border-b hover:bg-gray-50 ${isInactive ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {emp.name}
                          {isInactive && <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">archived</span>}
                        </td>
                        <td className="px-6 py-3 text-gray-600">{emp.position || '-'}</td>
                        <td className="px-6 py-3 font-semibold">${emp.hourly_rate.toFixed(2)}</td>
                        <td className="px-6 py-3 text-gray-500 text-xs">
                          {emp.project_ids?.length
                            ? emp.project_ids.map(id => projects.find(p => p.id === id)?.name || `#${id}`).join(', ')
                            : <span className="text-orange-400">None</span>}
                        </td>
                        <td className="px-6 py-3">
                          {isAdmin ? (
                            <div className="flex gap-3">
                              <button onClick={() => setEditingEmployee(emp)}
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm">Edit</button>
                              <button onClick={() => handleToggleEmployeeActive(emp.id)}
                                className={`font-medium text-sm ${isInactive ? 'text-green-600 hover:text-green-700' : 'text-yellow-600 hover:text-yellow-700'}`}>
                                {isInactive ? 'Restore' : 'Archive'}
                              </button>
                              <button onClick={() => handleDeleteEmployee(emp.id)}
                                className="text-red-500 hover:text-red-700 font-medium text-sm">Delete</button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PROJECTS TAB ===================== */}
      {tab === 'projects' && (
        <div className="space-y-6">
          {editingProject && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-y-auto py-8">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg my-auto">
                <h3 className="text-lg font-bold mb-4">Edit Project</h3>
                <form onSubmit={handleUpdateProject} className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                      <input type="text" value={editingProject.name}
                        onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code <span className="text-gray-400">(opt)</span></label>
                      <input type="text" maxLength={20} value={editingProject.code || ''}
                        onChange={(e) => setEditingProject({ ...editingProject, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="ABC-01" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Labor Budget</label>
                    <input type="number" step="100" value={editingProject.labor_budget}
                      onChange={(e) => setEditingProject({ ...editingProject, labor_budget: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Overhead %</label>
                    <input type="number" step="0.1" value={editingProject.overhead_percentage}
                      onChange={(e) => setEditingProject({ ...editingProject, overhead_percentage: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={editingProject.status}
                      onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value as Project['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={saving}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingProject(null)}
                      className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
                      Cancel
                    </button>
                  </div>
                </form>

                {isAdmin && (
                  <>
                    {/* Supervisor Assignments */}
                    <div className="mt-5 pt-5 border-t">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Assigned Supervisors</h4>
                      <div className="space-y-2 mb-3">
                        {projectSupervisors.length === 0 && (
                          <p className="text-xs text-gray-400">No supervisors assigned yet</p>
                        )}
                        {projectSupervisors.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                            <span className="text-sm text-gray-700">{s.name || s.email}</span>
                            <button onClick={() => handleRemoveSupFromProject(s.id)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <select value={addingSupToProject}
                          onChange={(e) => setAddingSupToProject(parseInt(e.target.value))}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                          <option value={0}>— Add supervisor —</option>
                          {supervisors
                            .filter((s) => !projectSupervisors.find((ps: any) => ps.id === s.id))
                            .map((s) => (
                              <option key={s.id} value={s.id}>{s.name || s.email}</option>
                            ))}
                        </select>
                        <button onClick={handleAddSupToProject} disabled={!addingSupToProject}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded text-sm font-medium">
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Employee Assignments */}
                    <div className="mt-5 pt-5 border-t">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Assigned Employees</h4>
                      <div className="space-y-2 mb-3">
                        {projectEmployees.length === 0 && (
                          <p className="text-xs text-gray-400">No employees assigned yet</p>
                        )}
                        {projectEmployees.map((e: any) => (
                          <div key={e.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                            <div>
                              <span className="text-sm text-gray-700 font-medium">{e.name}</span>
                              {e.position && <span className="text-xs text-gray-400 ml-2">{e.position}</span>}
                            </div>
                            <button onClick={() => handleRemoveEmpFromProject(e.id)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <select value={addingEmpToProject}
                          onChange={(e) => setAddingEmpToProject(parseInt(e.target.value))}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm">
                          <option value={0}>— Add employee —</option>
                          {employees
                            .filter((e) => !projectEmployees.find((pe: any) => pe.id === e.id))
                            .map((e) => (
                              <option key={e.id} value={e.id}>{e.name}{e.position ? ` (${e.position})` : ''}</option>
                            ))}
                        </select>
                        <button onClick={handleAddEmpToProject} disabled={!addingEmpToProject}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded text-sm font-medium">
                          Add
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {isAdmin ? (
              <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Add Project</h3>
                <form onSubmit={handleAddProject} className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                      <input type="text" value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                      <input type="text" maxLength={20} value={newProject.code}
                        onChange={(e) => setNewProject({ ...newProject, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="ABC-01" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Labor Budget</label>
                    <input type="number" step="100" value={newProject.labor_budget}
                      onChange={(e) => setNewProject({ ...newProject, labor_budget: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="$50000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Overhead %</label>
                    <input type="number" step="0.1" value={newProject.overhead_percentage}
                      onChange={(e) => setNewProject({ ...newProject, overhead_percentage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <button type="submit" disabled={saving}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                    {saving ? 'Adding...' : 'Add Project'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Projects</h3>
                <p className="text-sm text-gray-500">
                  Supervisors can review assigned projects here. Project creation and configuration are admin-only.
                </p>
              </div>
            )}

            <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-lg shadow overflow-hidden`}>
              <div className="px-4 py-3 border-b flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-xs text-gray-400">{filteredProjects.length} / {projects.length}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Code</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Budget</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">OH%</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                        {projects.length === 0
                          ? 'No projects yet. Create your first project using the form.'
                          : 'No projects match your search.'}
                      </td>
                    </tr>
                  ) : filteredProjects.map((proj) => (
                    <tr key={proj.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{proj.name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{proj.code || '—'}</td>
                      <td className="px-6 py-3 font-semibold">${proj.labor_budget.toLocaleString()}</td>
                      <td className="px-6 py-3">{proj.overhead_percentage}%</td>
                      <td className="px-6 py-3 capitalize">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          proj.status === 'active' ? 'bg-green-100 text-green-700'
                          : proj.status === 'completed' ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {proj.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {isAdmin && (
                          <div className="flex items-center gap-3">
                            <button onClick={() => openEditProject(proj)}
                              className="text-blue-600 hover:text-blue-700 font-medium text-sm">Edit</button>
                            <button onClick={() => handleDeleteProject(proj.id, proj.name)}
                              className="text-red-500 hover:text-red-700 font-medium text-sm">Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUPERVISORS TAB ===================== */}
      {tab === 'supervisors' && isAdmin && (
        <div className="space-y-6">
          {editingSupervisor && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Edit Supervisor</h3>
                <form onSubmit={handleUpdateSupervisor} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={editSupForm.email}
                      onChange={(e) => setEditSupForm({ ...editSupForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" value={editSupForm.name}
                      onChange={(e) => setEditSupForm({ ...editSupForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password <span className="text-gray-400 font-normal">(leave blank to keep)</span>
                    </label>
                    <input type="password" value={editSupForm.password}
                      onChange={(e) => setEditSupForm({ ...editSupForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="New password" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={saving}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingSupervisor(null)}
                      className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Add Supervisor</h3>
              <form onSubmit={handleAddSupervisor} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={newSupervisor.email}
                    onChange={(e) => setNewSupervisor({ ...newSupervisor, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={newSupervisor.name}
                    onChange={(e) => setNewSupervisor({ ...newSupervisor, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" value={newSupervisor.password}
                    onChange={(e) => setNewSupervisor({ ...newSupervisor, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <button type="submit" disabled={saving}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                  {saving ? 'Adding...' : 'Add Supervisor'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {/* Assigned supervisors */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-3 bg-gray-50 border-b">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Assigned to Projects ({supervisors.filter(s => s.project_count > 0).length})
                  </h4>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-gray-700">Email</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-700">Name</th>
                      <th className="px-6 py-3 text-center font-semibold text-gray-700">Projects</th>
                      <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisors.filter(s => s.project_count > 0).length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-400 text-sm">No supervisors assigned yet</td></tr>
                    ) : supervisors.filter(s => s.project_count > 0).map((sup) => (
                      <tr key={sup.id} className="border-b hover:bg-gray-50">
                        <td className={`px-6 py-3 font-medium ${!sup.is_active ? 'text-gray-400' : 'text-gray-900'}`}>{sup.email}</td>
                        <td className="px-6 py-3 text-gray-600">{sup.name || '-'}</td>
                        <td className="px-6 py-3 text-center">{sup.project_count}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sup.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {sup.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-3">
                            <button onClick={() => { setEditingSupervisor(sup); setEditSupForm({ email: sup.email, name: sup.name || '', password: '' }); }}
                              className="text-blue-600 hover:text-blue-700 font-medium text-sm">Edit</button>
                            <button onClick={() => handleToggleSupervisorActive(sup.id)}
                              className={`font-medium text-sm ${sup.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}>
                              {sup.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Unassigned supervisors */}
              {supervisors.filter(s => s.project_count === 0).length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-3 bg-gray-50 border-b">
                    <h4 className="text-sm font-semibold text-gray-500">
                      Not Assigned to Any Project ({supervisors.filter(s => s.project_count === 0).length})
                    </h4>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Email</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Name</th>
                        <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supervisors.filter(s => s.project_count === 0).map((sup) => (
                        <tr key={sup.id} className="border-b hover:bg-gray-50">
                          <td className={`px-6 py-3 font-medium ${!sup.is_active ? 'text-gray-400' : 'text-gray-900'}`}>{sup.email}</td>
                          <td className="px-6 py-3 text-gray-600">{sup.name || '-'}</td>
                          <td className="px-6 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sup.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {sup.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex gap-3">
                              <button onClick={() => { setEditingSupervisor(sup); setEditSupForm({ email: sup.email, name: sup.name || '', password: '' }); }}
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm">Edit</button>
                              <button onClick={() => handleToggleSupervisorActive(sup.id)}
                                className={`font-medium text-sm ${sup.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}>
                                {sup.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
