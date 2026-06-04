import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ProjectDetail, User } from '../types';
import { format } from 'date-fns';

interface ProjectDetailPageProps {
  user: User | null;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

function statusBadge(status: string) {
  const cls =
    status === 'active'
      ? 'bg-green-100 text-green-700'
      : status === 'on_hold'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function timesheetStatusBadge(status: string) {
  const cls =
    status === 'approved'
      ? 'bg-green-100 text-green-700'
      : status === 'pending'
      ? 'bg-yellow-100 text-yellow-700'
      : status === 'rejected'
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${cls}`}>
      {status}
    </span>
  );
}

export function ProjectDetailPage({ user }: ProjectDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editOverhead, setEditOverhead] = useState('');
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchProject() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProjectSummary(Number(id));
      setProject(data);
      setEditName(data.name);
      setEditBudget(String(data.labor_budget));
      setEditOverhead(String(data.overhead_percentage));
      setEditStatus(data.status);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!project) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await api.updateProject(project.id, {
        name: editName,
        labor_budget: parseFloat(editBudget),
        overhead_percentage: parseFloat(editOverhead),
        status: editStatus,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchProject();
    } catch (err: any) {
      setSaveError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error || 'Project not found'}</p>
        <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const budgetColor =
    project.percent_spent > 100
      ? 'bg-red-500'
      : project.percent_spent >= 90
      ? 'bg-orange-500'
      : project.percent_spent >= 80
      ? 'bg-yellow-400'
      : 'bg-green-500';

  const budgetTextColor =
    project.percent_spent > 100
      ? 'text-red-600'
      : project.percent_spent >= 90
      ? 'text-orange-600'
      : project.percent_spent >= 80
      ? 'text-yellow-600'
      : 'text-green-600';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mb-2"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {statusBadge(project.status)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {project.timesheets.length} timesheet{project.timesheets.length !== 1 ? 's' : ''} ·{' '}
            {project.employees.length} employee{project.employees.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {isAdmin ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Labor Budget</p>
            <p className="text-2xl font-bold text-blue-600">
              ${project.labor_budget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-gray-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-gray-800">
              ${project.total_spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">w/ overhead: ${project.total_with_overhead.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className={`bg-white rounded-lg shadow p-5 border-l-4 ${project.remaining >= 0 ? 'border-green-400' : 'border-red-400'}`}>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Remaining</p>
            <p className={`text-2xl font-bold ${project.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${project.remaining.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-purple-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Budget Used</p>
            <p className={`text-2xl font-bold ${budgetTextColor}`}>{project.percent_spent.toFixed(1)}%</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Hours</p>
            <p className="text-2xl font-bold text-blue-600">{project.total_hours.toFixed(1)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Regular Hours</p>
            <p className="text-2xl font-bold text-green-600">{project.regular_hours.toFixed(1)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-orange-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">OT Hours</p>
            <p className="text-2xl font-bold text-orange-500">{project.ot_hours.toFixed(1)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-indigo-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">This Week</p>
            <p className="text-2xl font-bold text-indigo-600">{project.current_week_hours.toFixed(1)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Budget Progress (admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Budget Progress</h3>
                <span className={`text-sm font-semibold ${budgetTextColor}`}>
                  {project.percent_spent.toFixed(1)}% used
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className={`h-3 rounded-full transition-all ${budgetColor}`}
                  style={{ width: `${Math.min(project.percent_spent, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Regular Pay</p>
                  <p className="font-bold text-green-600">
                    ${project.regular_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">OT Pay</p>
                  <p className="font-bold text-orange-500">
                    ${project.ot_spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Overhead ({project.overhead_percentage}%)</p>
                  <p className="font-bold text-gray-700">
                    ${project.overhead_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Hours This Week</p>
                  <p className="font-bold text-indigo-600">{project.current_week_hours.toFixed(1)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Employee Hours Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Employees</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Position</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Total Hrs</th>
                    <th className="px-4 py-3 text-right font-semibold text-green-700">Regular</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-500">OT Hrs</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Cost</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {project.employees.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                      <td className="px-4 py-3 text-gray-500">{e.position || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{Number(e.total_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{Number(e.regular_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-orange-500 font-medium">{Number(e.ot_hours).toFixed(1)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right text-gray-700">
                          ${Number(e.total_amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                      )}
                    </tr>
                  ))}
                  {project.employees.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-400">
                        No employees recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
                {project.employees.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 font-semibold text-sm">
                    <tr>
                      <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                      <td className="px-4 py-3 text-right">{project.total_hours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{project.regular_hours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-orange-500">{project.ot_hours.toFixed(1)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          ${project.total_spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Timesheets Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Timesheets</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Week</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Supervisor</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Hrs on Project</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {project.timesheets.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {format(new Date(t.week_start_date + 'T12:00:00'), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t.supervisor_email}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {Number(t.project_hours).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center">{timesheetStatusBadge(t.status)}</td>
                    </tr>
                  ))}
                  {project.timesheets.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        No timesheets yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Edit Form (admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Edit Project</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Labor Budget ($)</label>
                  <input
                    type="number"
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    min="0"
                    step="1000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Overhead (%)</label>
                  <input
                    type="number"
                    value={editOverhead}
                    onChange={(e) => setEditOverhead(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                {saveSuccess && <p className="text-xs text-green-600">Saved successfully!</p>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Assigned Supervisors */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-bold text-gray-900 mb-3">Assigned Supervisors</h3>
            {project.supervisors.length === 0 ? (
              <p className="text-sm text-gray-400">No supervisors assigned</p>
            ) : (
              <div className="space-y-2">
                {project.supervisors.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold uppercase flex-shrink-0">
                      {(s.name || s.email).charAt(0)}
                    </div>
                    <div>
                      {s.name && <p className="text-sm font-medium text-gray-900">{s.name}</p>}
                      <p className="text-xs text-gray-500">{s.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate('/settings')}
                className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Manage in Settings →
              </button>
            )}
          </div>

          {/* Hours Breakdown (supervisor) */}
          {!isAdmin && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Hours Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600">Total Hours</span>
                  <span className="font-bold text-gray-900">{project.total_hours.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600">Regular Hours</span>
                  <span className="font-bold text-green-600">{project.regular_hours.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600">OT Hours</span>
                  <span className="font-bold text-orange-500">{project.ot_hours.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Week</span>
                  <span className="font-bold text-indigo-600">{project.current_week_hours.toFixed(1)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Ticket Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-bold text-gray-900 mb-4">Ticket Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Regular tickets</span>
                <span className="font-semibold">{project.tickets_summary.regular_tickets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">OT tickets</span>
                <span className="font-semibold text-orange-500">{project.tickets_summary.ot_tickets}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-500">Pending</span>
                <span className="font-semibold text-yellow-600">{project.tickets_summary.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Approved</span>
                <span className="font-semibold text-green-600">{project.tickets_summary.approved}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
