import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ProjectFinancialSummary, Timesheet, EmployeeHoursReport, AdminAlerts } from '../types';
import { User } from '../types';
import { format, startOfWeek, addDays } from 'date-fns';
import toast from 'react-hot-toast';

interface DashboardProps {
  user: User | null;
}

export function Dashboard({ user }: DashboardProps) {
  const [projects, setProjects] = useState<ProjectFinancialSummary[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [employeeHours, setEmployeeHours] = useState<EmployeeHoursReport[]>([]);
  const [alerts, setAlerts] = useState<AdminAlerts | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectFinancialSummary | null>(null);
  const [rejectModalId, setRejectModalId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    try {
      setError(null);
      if (isSupervisor) {
        const [sheetsData, hoursData] = await Promise.all([
          api.getTimesheets(),
          api.getEmployeeHoursReport(),
        ]);
        setTimesheets(sheetsData);
        setEmployeeHours(hoursData);
      } else {
        const [projectsData, sheetsData, alertsData] = await Promise.all([
          api.getAllProjectSummaries(),
          api.getTimesheets(),
          api.getAdminAlerts(),
        ]);
        setProjects(projectsData);
        setTimesheets(sheetsData);
        setAlerts(alertsData);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: number) {
    try {
      await api.approveTimesheet(id);
      toast.success('Timesheet approved');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    }
  }

  function handleReject(id: number) {
    setRejectReason('');
    setRejectModalId(id);
  }

  async function confirmReject() {
    if (rejectModalId === null) return;
    const id = rejectModalId;
    setRejectModalId(null);
    try {
      await api.rejectTimesheet(id, rejectReason);
      toast.success('Timesheet rejected');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  // ── Supervisor Dashboard ──────────────────────────────────────────
  if (isSupervisor) {
    const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const thisWeekEnd = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6), 'yyyy-MM-dd');
    const myPending = timesheets.filter((t) => t.status === 'pending' || t.proposal_status === 'pending');
    const myApproved = timesheets.filter((t) => t.status === 'approved');
    const myDraft = timesheets.filter((t) => t.status === 'draft');
    const thisWeekSheets = timesheets.filter((t) => t.week_start_date === thisWeekStart);
    const totalHrsThisWeek = thisWeekSheets.reduce((sum, t) => sum + Number(t.total_hours || 0), 0);
    const totalOTThisWeek = employeeHours.reduce((sum, e) => sum + Number(e.ot_hours || 0), 0);
    const totalHrsAll = employeeHours.reduce((sum, e) => sum + Number(e.total_hours || 0), 0);

    return (
      <div>
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Hours This Week</p>
            <p className="text-3xl font-bold text-blue-600">{totalHrsThisWeek.toFixed(1)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-orange-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">OT Hours</p>
            <p className="text-3xl font-bold text-orange-500">{totalOTThisWeek.toFixed(1)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-yellow-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Pending Approval</p>
            <p className="text-3xl font-bold text-yellow-600">{myPending.length}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-400">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Approved</p>
            <p className="text-3xl font-bold text-green-600">{myApproved.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Employee Hours */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">My Employees</h3>
                <button onClick={() => navigate('/employee-hours')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Full report →</button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Employee</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Position</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Total Hrs</th>
                    <th className="px-4 py-3 text-right font-semibold text-green-700">Regular</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-500">OT Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeHours.map((e) => (
                    <tr key={e.employee_id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.employee_name}</td>
                      <td className="px-4 py-3 text-gray-500">{e.position}</td>
                      <td className="px-4 py-3 text-right font-semibold">{Number(e.total_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{Number(e.regular_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-orange-500 font-medium">{Number(e.ot_hours).toFixed(1)}</td>
                    </tr>
                  ))}
                  {employeeHours.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No employee data</td></tr>
                  )}
                </tbody>
                {employeeHours.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 font-semibold text-sm">
                    <tr>
                      <td className="px-4 py-3" colSpan={2}>TOTAL ({employeeHours.length} employees)</td>
                      <td className="px-4 py-3 text-right">{totalHrsAll.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{employeeHours.reduce((s, e) => s + Number(e.regular_hours), 0).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-orange-500">{totalOTThisWeek.toFixed(1)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Right: My Timesheets */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">My Timesheets</h3>
                <button onClick={() => navigate('/timesheets')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Manage →</button>
              </div>
              <div className="divide-y">
                {timesheets.slice(0, 8).map((t) => (
                  <div key={t.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(t.week_start_date + 'T12:00:00'), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-gray-500">{Number(t.total_hours || 0).toFixed(1)} hrs</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        t.status === 'approved' ? 'bg-green-100 text-green-700' :
                        t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        t.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {t.status}
                      </span>
                      {t.proposal_status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase bg-amber-100 text-amber-700">
                          proposal pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {timesheets.length === 0 && (
                  <p className="px-6 py-6 text-center text-sm text-gray-500">No timesheets yet</p>
                )}
              </div>
            </div>

            {/* Quick status summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Status Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Draft</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">{myDraft.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending Approval</span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">{myPending.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Approved</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">{myApproved.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Rejected</span>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">{timesheets.filter(t => t.status === 'rejected').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // ── End Supervisor Dashboard ──────────────────────────────────────

  const pendingTimesheets = timesheets.filter((t) => t.status === 'pending' || t.proposal_status === 'pending');

  // Aggregate financial totals from all projects
  const totalHours = projects.reduce((sum, p) => sum + p.total_hours, 0);
  const totalOTHours = projects.reduce((sum, p) => sum + p.ot_hours, 0);
  const totalOTPay = projects.reduce((sum, p) => sum + (p.ot_spent || 0), 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.total_spent, 0);
  const totalRegularPay = totalSpent - totalOTPay;
  const totalWithOverhead = projects.reduce((sum, p) => sum + p.total_with_overhead, 0);
  const totalBudget = projects.reduce((sum, p) => sum + p.labor_budget, 0);
  const overallBudgetPct = totalBudget > 0 ? (totalWithOverhead / totalBudget) * 100 : 0;

  const onTrackProjects = projects.filter((p) => p.percent_spent < 80).length;
  const warningProjects = projects.filter((p) => p.percent_spent >= 80 && p.percent_spent < 90).length;
  const alertProjects = projects.filter((p) => p.percent_spent >= 90 && p.percent_spent <= 100).length;
  const overBudgetProjects = projects.filter((p) => p.percent_spent > 100).length;
  const budgetAlertList = projects.filter((p) => p.percent_spent >= 80).sort((a, b) => b.percent_spent - a.percent_spent);

  return (
    <div>
      {/* Reject Confirmation Modal */}
      {rejectModalId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Timesheet</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a reason (optional). The supervisor will see this.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={confirmReject}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm"
              >
                Reject
              </button>
              <button
                onClick={() => setRejectModalId(null)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm"
              >
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

      {/* Admin Action Items */}
      {alerts && (() => {
        const totalAlerts =
          alerts.projects_without_supervisors.length +
          alerts.employees_without_projects.length +
          alerts.overdue_pending_timesheets.length +
          alerts.supervisors_missing_this_week.length;

        if (totalAlerts === 0) return null;

        return (
          <div className="mb-6 bg-white rounded-lg shadow border border-amber-200">
            <button
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                <div>
                  <h3 className="font-bold text-gray-900">Action Items</h3>
                  <p className="text-xs text-gray-500">{totalAlerts} issue{totalAlerts !== 1 ? 's' : ''} need attention</p>
                </div>
              </div>
              <span className="text-gray-400 text-sm">{alertsOpen ? '▲ Collapse' : '▼ Expand'}</span>
            </button>

            {alertsOpen && (
              <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.projects_without_supervisors.length > 0 && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-2">
                      🏗️ Projects without supervisor ({alerts.projects_without_supervisors.length})
                    </h4>
                    <ul className="text-sm text-orange-700 space-y-1">
                      {alerts.projects_without_supervisors.map(p => (
                        <li key={p.id} className="flex items-center gap-2">
                          <span className="text-orange-400">•</span>
                          <button onClick={() => navigate('/settings')} className="hover:underline text-left">{p.name}</button>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => navigate('/settings')} className="mt-2 text-xs text-orange-600 font-medium hover:underline">
                      Assign in Settings →
                    </button>
                  </div>
                )}

                {alerts.employees_without_projects.length > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      👷 Employees without project ({alerts.employees_without_projects.length})
                    </h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {alerts.employees_without_projects.slice(0, 5).map(e => (
                        <li key={e.id} className="flex items-center gap-2">
                          <span className="text-yellow-500">•</span> {e.name}
                        </li>
                      ))}
                      {alerts.employees_without_projects.length > 5 && (
                        <li className="text-yellow-500 text-xs">...and {alerts.employees_without_projects.length - 5} more</li>
                      )}
                    </ul>
                    <button onClick={() => navigate('/settings')} className="mt-2 text-xs text-yellow-600 font-medium hover:underline">
                      Assign in Settings →
                    </button>
                  </div>
                )}

                {alerts.overdue_pending_timesheets.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                      ⏰ Overdue pending timesheets ({alerts.overdue_pending_timesheets.length})
                    </h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {alerts.overdue_pending_timesheets.map(t => (
                        <li key={t.id}>
                          <button onClick={() => navigate('/timesheets')} className="hover:underline text-left">
                            {t.supervisor_email} — {format(new Date(t.week_start_date + 'T12:00:00'), 'MMM dd')} ({t.days_pending}d pending)
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => navigate('/timesheets')} className="mt-2 text-xs text-red-600 font-medium hover:underline">
                      Review in Timesheets →
                    </button>
                  </div>
                )}

                {alerts.supervisors_missing_this_week.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      📋 No timesheet this week ({alerts.supervisors_missing_this_week.length})
                    </h4>
                    <p className="text-xs text-blue-500 mb-2">Week of {alerts.current_week}</p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {alerts.supervisors_missing_this_week.slice(0, 5).map(s => (
                        <li key={s.id} className="flex items-center gap-2">
                          <span className="text-blue-400">•</span> {s.name || s.email}
                        </li>
                      ))}
                      {alerts.supervisors_missing_this_week.length > 5 && (
                        <li className="text-blue-400 text-xs">...and {alerts.supervisors_missing_this_week.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div
          onClick={() => navigate('/timesheets')}
          className="bg-white p-5 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow border-l-4 border-yellow-400"
        >
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Pending Approval</p>
          <p className="text-3xl font-bold text-yellow-600">{pendingTimesheets.length}</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-400">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Hours</p>
          <p className="text-3xl font-bold text-blue-600">{totalHours.toFixed(1)}</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-orange-400">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">OT Hours</p>
          <p className="text-3xl font-bold text-orange-500">{totalOTHours.toFixed(1)}</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-400">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Regular Pay</p>
          <p className="text-2xl font-bold text-green-600">${totalRegularPay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-orange-500">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">OT Pay</p>
          <p className="text-2xl font-bold text-orange-600">${totalOTPay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-400">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Labor</p>
          <p className="text-2xl font-bold text-purple-600">${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Budget Overview / Project Detail — toggles on row click */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        {selectedProject ? (
          // — Single project view —
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium mb-1 flex items-center gap-1"
                >
                  ← All Projects
                </button>
                <h3 className="text-lg font-bold text-gray-900">{selectedProject.name}</h3>
                <p className="text-sm text-gray-500">Budget includes overhead</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  ${selectedProject.total_with_overhead.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span className="text-sm font-normal text-gray-500"> / ${selectedProject.labor_budget.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </p>
                <p className={`text-sm font-semibold ${selectedProject.percent_spent > 100 ? 'text-red-600' : selectedProject.percent_spent >= 90 ? 'text-orange-600' : selectedProject.percent_spent >= 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {selectedProject.percent_spent.toFixed(1)}% used
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all ${selectedProject.percent_spent > 100 ? 'bg-red-500' : selectedProject.percent_spent >= 90 ? 'bg-orange-500' : selectedProject.percent_spent >= 80 ? 'bg-yellow-400' : 'bg-green-500'}`}
                style={{ width: `${Math.min(selectedProject.percent_spent, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Total Hours</p>
                <p className="text-xl font-bold text-blue-600">{selectedProject.total_hours.toFixed(1)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">OT Hours</p>
                <p className="text-xl font-bold text-orange-500">{selectedProject.ot_hours.toFixed(1)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Labor Spent</p>
                <p className="text-xl font-bold text-gray-900">${selectedProject.total_spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Remaining</p>
                <p className={`text-xl font-bold ${selectedProject.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${selectedProject.remaining.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </>
        ) : (
          // — All projects view —
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Overall Budget Status</h3>
                <p className="text-sm text-gray-500">All active projects — includes overhead · click a project row to drill in</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  ${totalWithOverhead.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span className="text-sm font-normal text-gray-500"> / ${totalBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </p>
                <p className={`text-sm font-semibold ${overallBudgetPct > 100 ? 'text-red-600' : overallBudgetPct >= 90 ? 'text-orange-600' : overallBudgetPct >= 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {overallBudgetPct.toFixed(1)}% used
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${overallBudgetPct > 100 ? 'bg-red-500' : overallBudgetPct >= 90 ? 'bg-orange-500' : overallBudgetPct >= 80 ? 'bg-yellow-400' : 'bg-green-500'}`}
                style={{ width: `${Math.min(overallBudgetPct, 100)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{onTrackProjects} On Track</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />{warningProjects} ≥80%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />{alertProjects} ≥90%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{overBudgetProjects} Over Budget</span>
            </div>
            {/* Budget alert banners */}
            {budgetAlertList.length > 0 && (
              <div className="mt-4 space-y-2">
                {budgetAlertList.map((p) => {
                  const isOver = p.percent_spent > 100;
                  const isAlert = p.percent_spent >= 90;
                  const bg = isOver ? 'bg-red-50 border-red-300 text-red-700' : isAlert ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-yellow-50 border-yellow-300 text-yellow-700';
                  const icon = isOver ? '🔴' : isAlert ? '🟠' : '🟡';
                  return (
                    <div key={p.id} className={`flex items-center justify-between px-4 py-2 border rounded-lg text-sm ${bg}`}>
                      <span>{icon} <strong>{p.name}</strong> — {p.percent_spent.toFixed(1)}% used</span>
                      <span className="font-semibold">${p.remaining.toLocaleString('en-US', { maximumFractionDigits: 0 })} remaining</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left col: Pending approvals + Projects table */}
        <div className="lg:col-span-2 space-y-8">

          {/* Pending Timesheets */}
          {isAdmin && pendingTimesheets.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Pending Approvals</h3>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                  {pendingTimesheets.length}
                </span>
              </div>
              <div className="divide-y">
                {pendingTimesheets.map((t) => (
                  <div key={t.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {format(new Date(t.week_start_date + 'T12:00:00'), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500">{t.supervisor_email}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span className="text-blue-600 font-medium">{Number(t.total_hours || 0).toFixed(1)} hrs</span>
                        <span className="text-green-600 font-medium">${Number(t.total_amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      </div>
                      {t.proposal_status === 'pending' && (
                        <p className="text-xs text-amber-700 font-medium mt-1">Pending change proposal</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(t.id)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(t.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-sm font-medium hover:bg-red-100"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Active Projects</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Project</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Hrs</th>
                    <th className="px-4 py-3 text-right font-semibold text-orange-600">OT Hrs</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Spent</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Budget</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Remaining</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProject(selectedProject?.id === p.id ? null : p)}
                      className={`border-b cursor-pointer hover:bg-blue-50 transition-colors ${selectedProject?.id === p.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}
                            className="text-blue-400 hover:text-blue-700 text-xs font-bold ml-1"
                            title="Open project details"
                          >
                            ↗
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{p.total_hours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-orange-600 font-medium">{p.ot_hours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">${p.total_spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-gray-700">${p.labor_budget.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${p.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${p.remaining.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${p.percent_spent > 100 ? 'bg-red-500' : p.percent_spent >= 90 ? 'bg-orange-500' : p.percent_spent >= 80 ? 'bg-yellow-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(p.percent_spent, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${p.percent_spent > 100 ? 'text-red-600' : p.percent_spent >= 90 ? 'text-orange-600' : p.percent_spent >= 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {p.percent_spent.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No active projects</td>
                    </tr>
                  )}
                </tbody>
                {projects.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 font-semibold">
                    <tr
                      onClick={() => setSelectedProject(null)}
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-700">TOTAL</td>
                      <td className="px-4 py-3 text-right text-gray-900">{totalHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{totalOTHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">${totalSpent.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-gray-900">${totalBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className={`px-4 py-3 text-right ${totalBudget - totalWithOverhead >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${(totalBudget - totalWithOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Right col: Pay breakdown + Recent timesheets */}
        <div className="space-y-6">

          {/* Pay Breakdown Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Pay Breakdown</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <div>
                  <p className="text-sm text-gray-600">Regular Pay</p>
                  <p className="text-xs text-gray-400">hrs × rate</p>
                </div>
                <p className="text-lg font-bold text-green-600">
                  ${totalRegularPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <div>
                  <p className="text-sm text-gray-600">OT Pay</p>
                  <p className="text-xs text-gray-400">hrs × rate × 1.5</p>
                </div>
                <p className="text-lg font-bold text-orange-500">
                  ${totalOTPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <div>
                  <p className="text-sm text-gray-600">Labor Total</p>
                  <p className="text-xs text-gray-400">regular + OT</p>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  ${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">With Overhead</p>
                  <p className="text-xs text-gray-400">labor + overhead %</p>
                </div>
                <p className="text-xl font-bold text-purple-600">
                  ${totalWithOverhead.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Timesheets */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Recent Timesheets</h3>
              <button
                onClick={() => navigate('/timesheets')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all →
              </button>
            </div>
            <div className="divide-y">
              {timesheets.slice(0, 8).map((t) => (
                <div key={t.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(t.week_start_date + 'T12:00:00'), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500">{t.supervisor_email}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                          t.status === 'approved' ? 'bg-green-100 text-green-700' :
                          t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          t.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {t.status}
                      </span>
                      {t.proposal_status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase bg-amber-100 text-amber-700">
                          proposal pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{Number(t.total_hours || 0).toFixed(1)} hrs</p>
                  </div>
                </div>
              ))}
              {timesheets.length === 0 && (
                <p className="px-6 py-6 text-center text-sm text-gray-500">No timesheets yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
