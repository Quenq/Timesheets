import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Timesheet, Employee, Project, TimesheetRow, OTCalculation, Supervisor } from '../types';
import { format, addDays, startOfWeek } from 'date-fns';
import { User } from '../types';
import toast from 'react-hot-toast';

interface TimesheetPageProps {
  user: User | null;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TimesheetPage({ user }: TimesheetPageProps) {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [otCalculations, setOTCalculations] = useState<OTCalculation[]>([]);
  const [weekDate, setWeekDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number>(0);
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [rejectModalId, setRejectModalId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const canCreateTimesheet = isSupervisor || isAdmin;

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    try {
      setError(null);
      const calls: Promise<any>[] = [api.getTimesheets(), api.getEmployees(), api.getProjects()];
      if (isAdmin) calls.push(api.getSupervisors());
      const results = await Promise.all(calls);
      const [sheetsData, empsData, projsData] = results;
      const supsData = isAdmin ? results[3] : [];

      setTimesheets(sheetsData);
      setEmployees(empsData);
      setProjects(projsData);
      setSupervisors(supsData);
      if (isAdmin && supsData.length > 0) {
        setSelectedSupervisorId(supsData[0].id);
      }

      const weekStart = format(weekDate, 'yyyy-MM-dd');
      const currentSheet = sheetsData.find((t: Timesheet) => t.week_start_date === weekStart);
      if (currentSheet) {
        await loadTimesheet(currentSheet.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }

  async function loadTimesheet(id: number) {
    try {
      const [detail, hist] = await Promise.all([
        api.getTimesheetDetail(id),
        api.getTimesheetHistory(id),
      ]);
      setSelectedTimesheet(detail.timesheet);
      setRows(detail.rows.map((r: TimesheetRow) => ({
        ...r,
        sick_days: r.sick_days || '',
      })));
      setOTCalculations(detail.ot_calculations);
      setHistory(hist);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load timesheet');
    }
  }

  async function createTimesheetForWeek() {
    try {
      setSaving(true);
      const weekStart = format(weekDate, 'yyyy-MM-dd');
      const supId = isAdmin ? (selectedSupervisorId || undefined) : undefined;

      // Check for duplicate timesheet for this supervisor + week
      const existingSheet = timesheets.find((t) => {
        if (t.week_start_date !== weekStart) return false;
        if (isAdmin && supId) return t.supervisor_id === supId;
        return true; // supervisor always matches their own
      });
      if (existingSheet) {
        toast.error('A timesheet already exists for this week. Use the existing one.');
        await loadTimesheet(existingSheet.id);
        setSaving(false);
        return;
      }

      const result = await api.createTimesheet(weekStart, [], supId);
      const updatedSheets = await api.getTimesheets();
      setTimesheets(updatedSheets);
      await loadTimesheet(result.id);
      toast.success('Timesheet created');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create timesheet');
    } finally {
      setSaving(false);
    }
  }

  async function saveTimesheet() {
    if (!selectedTimesheet) return;
    const err = validateRows();
    if (err) { toast.error(err); return; }
    try {
      setSaving(true);
      const isProposalFlow = isSupervisor && selectedTimesheet.status === 'approved';
      const rowsToSave = rows.map((row) => ({
        id: row.id,
        employee_id: row.employee_id,
        project_id: row.project_id,
        monday: row.monday,
        tuesday: row.tuesday,
        wednesday: row.wednesday,
        thursday: row.thursday,
        friday: row.friday,
        saturday: row.saturday,
        sunday: row.sunday,
        sick_days: row.sick_days,
      }));
      await api.updateTimesheetRows(selectedTimesheet.id, rowsToSave);
      await loadTimesheet(selectedTimesheet.id);
      const updatedSheets = await api.getTimesheets();
      setTimesheets(updatedSheets);
      toast.success(isProposalFlow ? 'Change proposal saved and sent for approval' : 'Timesheet saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save timesheet');
    } finally {
      setSaving(false);
    }
  }

  async function submitTimesheet() {
    if (!selectedTimesheet) return;
    try {
      setSaving(true);
      // Save current rows first, then submit
      const rowsToSave = rows.map((row) => ({
        id: row.id,
        employee_id: row.employee_id,
        project_id: row.project_id,
        monday: row.monday,
        tuesday: row.tuesday,
        wednesday: row.wednesday,
        thursday: row.thursday,
        friday: row.friday,
        saturday: row.saturday,
        sunday: row.sunday,
        sick_days: row.sick_days,
      }));
      await api.updateTimesheetRows(selectedTimesheet.id, rowsToSave);
      await api.submitTimesheet(selectedTimesheet.id);
      toast.success('Timesheet submitted for approval');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit timesheet');
    } finally {
      setSaving(false);
    }
  }

  async function approveTimesheet(id: number) {
    try {
      await api.approveTimesheet(id);
      toast.success('Timesheet approved');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve timesheet');
    }
  }

  function rejectTimesheet(id: number) {
    setRejectReason('');
    setRejectModalId(id);
  }

  async function confirmRejectTimesheet() {
    if (rejectModalId === null) return;
    const id = rejectModalId;
    setRejectModalId(null);
    try {
      await api.rejectTimesheet(id, rejectReason);
      toast.success('Timesheet rejected');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject timesheet');
    }
  }

  async function confirmDeleteTimesheet() {
    if (deleteConfirmId === null) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await api.deleteTimesheet(id);
      if (selectedTimesheet?.id === id) {
        setSelectedTimesheet(null);
        setRows([]);
        setOTCalculations([]);
        setHistory([]);
      }
      const updatedSheets = await api.getTimesheets();
      setTimesheets(updatedSheets);
      toast.success('Timesheet deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete timesheet');
    }
  }

  // ── Validation ──────────────────────────────────────────────────────
  function validateRows(): string | null {
    if (rows.length === 0) return 'Add at least one row before saving.';
    const seen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.employee_id) return `Row ${i + 1}: please select an employee.`;
      if (!row.project_id) return `Row ${i + 1}: please select a project.`;
      const key = `${row.employee_id}-${row.project_id}`;
      if (seen.has(key)) return `Row ${i + 1}: duplicate employee + project combination.`;
      seen.add(key);
    }
    return null;
  }

  // ── Copy from previous week ──────────────────────────────────────────
  async function copyFromPreviousWeek() {
    if (!selectedTimesheet) return;
    const prevWeekStart = format(addDays(weekDate, -7), 'yyyy-MM-dd');
    const prevSheet = timesheets.find((t) => t.week_start_date === prevWeekStart);
    if (!prevSheet) {
      toast.error('No timesheet found for the previous week.');
      return;
    }
    try {
      const detail = await api.getTimesheetDetail(prevSheet.id);
      const copiedRows: TimesheetRow[] = (detail.rows as TimesheetRow[]).map((r) => ({
        ...r,
        id: 0,
        timesheet_id: selectedTimesheet.id,
        monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
        friday: 0, saturday: 0, sunday: 0,
        total_hours: 0,
        sick_days: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      if (copiedRows.length === 0) {
        toast.error('The previous week timesheet has no rows to copy.');
        return;
      }
      setRows(copiedRows);
      toast.success(`Copied ${copiedRows.length} row${copiedRows.length !== 1 ? 's' : ''} from previous week`);
    } catch {
      toast.error('Failed to load previous week');
    }
  }

  function getSickDaysSet(row: TimesheetRow): Set<string> {
    return new Set((row.sick_days || '').split(',').filter(Boolean));
  }

  function toggleSickDay(index: number, day: string) {
    const newRows = [...rows];
    const row = { ...newRows[index] };
    const sickSet = getSickDaysSet(row);
    if (sickSet.has(day)) {
      sickSet.delete(day);
      (row as any)[day] = 0;
    } else {
      sickSet.add(day);
      (row as any)[day] = 8;
    }
    row.sick_days = Array.from(sickSet).join(',');
    row.total_hours = DAYS.reduce((sum, d) => sum + (parseFloat((row as any)[d]) || 0), 0);
    newRows[index] = row;
    setRows(newRows);
  }

  function updateRow(index: number, field: string, value: number) {
    const newRows = [...rows];
    const row = { ...newRows[index] };
    const sickSet = getSickDaysSet(row);
    if (sickSet.has(field)) return;
    (row as any)[field] = value;
    row.total_hours = Math.round(DAYS.reduce((sum, d) => sum + (parseFloat((row as any)[d]) || 0), 0) * 100) / 100;
    newRows[index] = row;
    setRows(newRows);
  }

  function updateRowEmployee(index: number, employeeId: number) {
    const newRows = [...rows];
    const emp = employees.find((e) => e.id === employeeId);
    newRows[index] = { ...newRows[index], employee_id: employeeId, employee_name: emp?.name || '' };
    setRows(newRows);
  }

  function updateRowProject(index: number, projectId: number) {
    const newRows = [...rows];
    const proj = projects.find((p) => p.id === projectId);
    // Reset employee to first one available for this project
    const firstEmp = employees.find((e) => (e.project_ids || []).includes(projectId));
    newRows[index] = {
      ...newRows[index],
      project_id: projectId,
      project_name: proj?.name || '',
      employee_id: firstEmp?.id || newRows[index].employee_id,
      employee_name: firstEmp?.name || newRows[index].employee_name,
    };
    setRows(newRows);
  }

  async function deleteRow(index: number) {
    try {
      const rowId = rows[index].id;
      if (isSupervisor && selectedTimesheet?.status === 'approved' && !selectedTimesheet.viewing_proposal) {
        setRows(rows.filter((_, i) => i !== index));
        return;
      }
      if (rowId) {
        await api.deleteTimesheetRow(rowId);
        if (selectedTimesheet) {
          await loadTimesheet(selectedTimesheet.id);
          const updatedSheets = await api.getTimesheets();
          setTimesheets(updatedSheets);
        }
        return;
      }
      setRows(rows.filter((_, i) => i !== index));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete row');
    }
  }

  function addNewRow() {
    if (!selectedTimesheet) return;
    const newRow: TimesheetRow = {
      id: 0,
      timesheet_id: selectedTimesheet.id,
      project_id: projects[0]?.id || 0,
      project_name: projects[0]?.name || '',
      employee_id: employees.find((e) => (e.project_ids || []).includes(projects[0]?.id))?.id || employees[0]?.id || 0,
      employee_name: employees.find((e) => (e.project_ids || []).includes(projects[0]?.id))?.name || employees[0]?.name || '',
      monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
      friday: 0, saturday: 0, sunday: 0,
      total_hours: 0,
      sick_days: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setRows([...rows, newRow]);
  }

  function navigateWeek(delta: number) {
    const newDate = addDays(weekDate, delta * 7);
    setWeekDate(newDate);
    setSelectedTimesheet(null);
    setRows([]);
    setOTCalculations([]);
    const newWeekStart = format(newDate, 'yyyy-MM-dd');
    const sheet = timesheets.find((t) => t.week_start_date === newWeekStart);
    if (sheet) loadTimesheet(sheet.id);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">Loading timesheets...</p>
      </div>
    );
  }

  const weekEnd = format(addDays(weekDate, 6), 'MMM dd');
  const weekStartFormatted = format(weekDate, 'MMM dd, yyyy');
  const canEdit = selectedTimesheet && (isSupervisor || isAdmin);
  const pendingTimesheets = isAdmin
    ? timesheets.filter((t) => t.status === 'pending' || t.proposal_status === 'pending')
    : [];

  // Submit modal calculations
  const totalHours = rows.reduce((sum, r) => sum + Number(r.total_hours || 0), 0);
  const uniqueEmployees = [...new Set(rows.map((r) => r.employee_name).filter(Boolean))];
  const totalAmount = rows.reduce((sum, r) => {
    const emp = employees.find((e) => e.id === r.employee_id);
    const rate = Number(emp?.hourly_rate || 0);
    const hrs = Number(r.total_hours || 0);
    return sum + hrs * rate;
  }, 0);

  return (
    <div>
      {/* Submit Confirmation Modal */}
      {showSubmitModal && selectedTimesheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Submit Timesheet</h3>
            <p className="text-sm text-gray-500 mb-5">Review before sending for approval</p>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Week</span>
                <span className="text-sm font-medium text-gray-900">
                  {format(weekDate, 'MMM dd')} – {format(addDays(weekDate, 6), 'MMM dd, yyyy')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Employees</span>
                <span className="text-sm font-medium text-gray-900">
                  {uniqueEmployees.length > 0 ? uniqueEmployees.join(', ') : '—'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Rows</span>
                <span className="text-sm font-medium text-gray-900">{rows.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Total Hours</span>
                <span className="text-sm font-bold text-gray-900">{totalHours.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Estimated Amount</span>
                <span className="text-sm font-bold text-green-600">
                  ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => { setShowSubmitModal(false); await submitTimesheet(); }}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm"
              >
                {saving ? 'Submitting...' : 'Confirm & Submit'}
              </button>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (() => {
        const ts = timesheets.find((t) => t.id === deleteConfirmId);
        const weekLabel = ts ? format(new Date(ts.week_start_date + 'T12:00:00'), 'MMM dd, yyyy') : `#${deleteConfirmId}`;
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Timesheet</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete the timesheet for <strong>week of {weekLabel}</strong>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmDeleteTimesheet}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                onClick={confirmRejectTimesheet}
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

      {/* Admin: Pending Approvals */}
      {isAdmin && pendingTimesheets.length > 0 && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Pending Approvals ({pendingTimesheets.length})
          </h3>
          <div className="space-y-3">
            {pendingTimesheets.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    Week of {format(new Date(t.week_start_date + 'T12:00:00'), 'MMM dd, yyyy')}
                  </p>
                  <p className="text-sm text-gray-600">{t.supervisor_email}</p>
                  <p className="text-sm text-gray-500">
                    {Number(t.total_hours || 0).toFixed(1)} hrs — ${Number(t.total_amount || 0).toFixed(2)}
                  </p>
                  {t.proposal_status === 'pending' && (
                    <p className="text-xs text-amber-700 font-medium mt-1">Pending change proposal</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveTimesheet(t.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectTimesheet(t.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => loadTimesheet(t.id)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="mb-6 bg-white p-6 rounded-lg shadow">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
            >
              ← Prev
            </button>
            <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded font-medium text-sm">
              {weekStartFormatted} – {weekEnd}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
            >
              Next →
            </button>
          </div>

          {/* Admin: supervisor selector */}
          {isAdmin && (
            <select
              value={selectedSupervisorId}
              onChange={(e) => setSelectedSupervisorId(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}{s.name ? ` (${s.name})` : ''}
                </option>
              ))}
            </select>
          )}

          {canCreateTimesheet && !selectedTimesheet && (
            <button
              onClick={createTimesheetForWeek}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
            >
              + New Timesheet for This Week
            </button>
          )}

          {selectedTimesheet && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                selectedTimesheet.status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : selectedTimesheet.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : selectedTimesheet.status === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {selectedTimesheet.status}
            </span>
          )}
          {selectedTimesheet?.proposal_status === 'pending' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase bg-amber-100 text-amber-700">
              proposal pending
            </span>
          )}
        </div>

        {selectedTimesheet?.status === 'rejected' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-red-800 text-sm mb-1">
                  Timesheet Rejected
                </p>
                {selectedTimesheet.rejection_reason ? (
                  <p className="text-red-700 text-sm">
                    <strong>Reason:</strong> {selectedTimesheet.rejection_reason}
                  </p>
                ) : (
                  <p className="text-red-600 text-sm italic">No reason provided.</p>
                )}
                <p className="text-red-600 text-xs mt-1">
                  Please review the timesheet, make any necessary corrections, and resubmit.
                </p>
              </div>
              {isSupervisor && (
                <button
                  onClick={() => {
                    const err = validateRows();
                    if (err) { toast.error(err); return; }
                    const totalHrs = rows.reduce((sum, r) => sum + Number(r.total_hours || 0), 0);
                    if (totalHrs === 0) { toast.error('No hours entered. Add hours before submitting.'); return; }
                    setShowSubmitModal(true);
                  }}
                  disabled={saving}
                  className="flex-shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 whitespace-nowrap"
                >
                  Resubmit for Approval
                </button>
              )}
            </div>
          </div>
        )}

        {selectedTimesheet?.proposal_status === 'pending' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
            <strong>Pending Change Proposal:</strong> the approved timesheet remains unchanged until an admin approves these edits.
          </div>
        )}

        {selectedTimesheet && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <button
                  onClick={saveTimesheet}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : isAdmin ? 'Save Changes' : selectedTimesheet.status === 'approved' ? 'Save Proposal' : 'Save Draft'}
                </button>
                {(selectedTimesheet.status === 'draft' || selectedTimesheet.status === 'rejected') && (
                  <button
                    onClick={() => {
                      const err = validateRows();
                      if (err) { toast.error(err); return; }
                      const totalHrs = rows.reduce((sum, r) => sum + Number(r.total_hours || 0), 0);
                      if (totalHrs === 0) { toast.error('No hours entered. Add hours before submitting.'); return; }
                      setShowSubmitModal(true);
                    }}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                  >
                    Submit for Approval
                  </button>
                )}
              </>
            )}
            {isAdmin && (selectedTimesheet.status === 'pending' || selectedTimesheet.proposal_status === 'pending') && (
              <>
                <button
                  onClick={() => approveTimesheet(selectedTimesheet.id)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectTimesheet(selectedTimesheet.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm"
                >
                  Reject
                </button>
              </>
            )}
            {(isAdmin || (isSupervisor && selectedTimesheet.status === 'draft')) && (
              <button
                onClick={() => setDeleteConfirmId(selectedTimesheet.id)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-medium text-sm ml-auto"
              >
                🗑 Delete Timesheet
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timesheet Table */}
      {selectedTimesheet ? (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-36">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-36">Project</th>
                {DAY_LABELS.map((d) => (
                  <th key={d} className="px-1 py-3 text-center font-semibold text-gray-700 w-20">
                    {d}
                    {canEdit && <div className="text-xs font-normal text-gray-400">hrs / sick</div>}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                {canEdit && (
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Del</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const sickSet = getSickDaysSet(row);
                return (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {canEdit ? (
                        <select
                          value={row.employee_id}
                          onChange={(e) => updateRowEmployee(idx, parseInt(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          {(() => {
                            const filtered = employees.filter((e) => !row.project_id || (e.project_ids || []).includes(row.project_id));
                            const currentInList = filtered.some((e) => e.id === row.employee_id);
                            const currentEmp = !currentInList ? employees.find((e) => e.id === row.employee_id) : null;
                            const options = currentEmp ? [currentEmp, ...filtered] : filtered;
                            if (options.length === 0) return <option value={0} disabled>No employees assigned to this project</option>;
                            return options.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}{!currentInList && e.id === row.employee_id ? ' ⚠' : ''}
                              </option>
                            ));
                          })()}
                        </select>
                      ) : (
                        <span className="font-medium">{row.employee_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {canEdit ? (
                        <select
                          value={row.project_id}
                          onChange={(e) => updateRowProject(idx, parseInt(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-600">{row.project_name}</span>
                      )}
                    </td>
                    {DAYS.map((day) => {
                      const isSick = sickSet.has(day);
                      return (
                        <td key={day} className="px-1 py-2 text-center">
                          {canEdit ? (
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="24"
                                step="0.5"
                                value={isSick ? 8 : (focusedCell === `${idx}-${day}` && (row as any)[day] === 0 ? '' : ((row as any)[day] || 0))}
                                disabled={isSick}
                                onFocus={() => setFocusedCell(`${idx}-${day}`)}
                                onBlur={() => setFocusedCell(null)}
                                onChange={(e) => updateRow(idx, day, parseFloat(e.target.value) || 0)}
                                className={`w-12 px-1 py-1 border rounded text-center text-sm ${
                                  isSick ? 'bg-orange-50 border-orange-200 text-orange-600' : 'border-gray-300'
                                }`}
                              />
                              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                                <input type="checkbox" checked={isSick} onChange={() => toggleSickDay(idx, day)} className="w-3 h-3" />
                                sick
                              </label>
                            </div>
                          ) : (
                            <span className={isSick ? 'text-orange-500 font-medium' : ''}>
                              {(row as any)[day] || 0}
                              {isSick && <span className="text-xs block">sick</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right font-semibold">
                      {row.total_hours.toFixed(1)}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => deleteRow(idx)}
                          className="text-red-500 hover:text-red-700 text-lg font-bold"
                          title="Delete row"
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No rows yet. {canEdit && 'Click "+ Add Row" to start entering hours.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canEdit && (
            <div className="px-4 py-4 border-t flex flex-wrap items-center gap-3">
              <button
                onClick={addNewRow}
                disabled={employees.length === 0 || projects.length === 0}
                className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium text-sm disabled:opacity-50"
              >
                + Add Row
              </button>
              {timesheets.some((t) => t.week_start_date === format(addDays(weekDate, -7), 'yyyy-MM-dd')) && (
                <button
                  onClick={copyFromPreviousWeek}
                  className="px-4 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg font-medium text-sm"
                >
                  📋 Copy from Previous Week
                </button>
              )}
              {(employees.length === 0 || projects.length === 0) && (
                <span className="text-sm text-red-500">
                  Need at least one employee and one project in Settings first.
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-700 font-semibold text-lg mb-2">No timesheet for this week</p>
          <p className="text-gray-400 text-sm mb-6">
            {canCreateTimesheet
              ? 'Create a new timesheet to start logging employee hours for this week.'
              : 'No timesheet has been submitted for this week yet.'}
          </p>
          {canCreateTimesheet && (
            <button
              onClick={createTimesheetForWeek}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {saving ? 'Creating...' : '+ Create Timesheet for This Week'}
            </button>
          )}
          {!canCreateTimesheet && (
            <p className="text-xs text-gray-400 mt-2">Navigate to another week or check back later.</p>
          )}
        </div>
      )}

      {/* OT Summary — admin only */}
      {isAdmin && otCalculations.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Weekly OT Summary <span className="text-sm font-normal text-gray-500">(across all timesheets this week)</span></h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {otCalculations.map((ot) => {
              return (
                <div key={ot.id} className="p-4 bg-gray-50 rounded-lg border">
                  <p className="font-semibold text-gray-900">{(ot as any).employee_name || `Employee #${ot.employee_id}`}</p>
                  <div className="mt-2 text-sm space-y-1">
                    <p className="text-gray-600">Total: <strong>{Number(ot.total_hours).toFixed(1)} hrs</strong></p>
                    <p className="text-green-600">Regular: {Number(ot.regular_hours).toFixed(1)} hrs</p>
                    {Number(ot.ot_hours) > 0 && (
                      <p className="text-orange-600 font-medium">OT: {Number(ot.ot_hours).toFixed(1)} hrs</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History Timeline */}
      {selectedTimesheet && history.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4 text-gray-900">History</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4">
              {history.map((entry, i) => {
                const config: Record<string, { icon: string; color: string; label: string }> = {
                  created:   { icon: '📄', color: 'bg-gray-100 text-gray-600',    label: 'Created'   },
                  submitted: { icon: '📤', color: 'bg-blue-100 text-blue-700',    label: 'Submitted' },
                  approved:  { icon: '✅', color: 'bg-green-100 text-green-700',  label: 'Approved'  },
                  rejected:  { icon: '❌', color: 'bg-red-100 text-red-700',      label: 'Rejected'  },
                };
                const c = config[entry.action] || config.created;
                const date = new Date(entry.created_at);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={i} className="flex items-start gap-4 pl-10 relative">
                    <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${c.color} border-2 border-white shadow-sm`}>
                      {c.icon}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.color}`}>
                          {c.label}
                        </span>
                        <span className="text-sm text-gray-700">{entry.performed_by_email}</span>
                        <span className="text-xs text-gray-400 ml-auto">{dateStr} {timeStr}</span>
                      </div>
                      {entry.note && (
                        <p className="mt-1 text-sm text-red-600 italic">"{entry.note}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* All Timesheets List */}
      {timesheets.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">All Timesheets</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Week</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Supervisor</th>
                  )}
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Hours</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Submitted</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b hover:bg-gray-50 ${selectedTimesheet?.id === t.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {format(new Date(t.week_start_date + 'T12:00:00'), 'MMM dd, yyyy')}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-600 text-xs">{t.supervisor_email}</td>
                    )}
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(t.total_hours || 0).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      ${Number(t.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                            t.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : t.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : t.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t.status}
                        </span>
                        {t.proposal_status === 'pending' && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold uppercase bg-amber-100 text-amber-700">
                            proposal pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {t.submitted_at ? format(new Date(t.submitted_at), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => loadTimesheet(t.id)}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                          View
                        </button>
                        {(isAdmin || (isSupervisor && t.status === 'draft')) && (
                          <button
                            onClick={() => setDeleteConfirmId(t.id)}
                            className="text-red-500 hover:text-red-700 font-medium text-sm"
                            title="Delete timesheet"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
