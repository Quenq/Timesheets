import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { EmployeeHoursReport } from '../types';
import { User } from '../types';
import { format, startOfWeek, addDays } from 'date-fns';

interface EmployeeHoursPageProps {
  user: User | null;
}

export function EmployeeHoursPage({ user }: EmployeeHoursPageProps) {
  const [report, setReport] = useState<EmployeeHoursReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchReport(params?: { week_start?: string; week_end?: string }) {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getEmployeeHoursReport(params);
      setReport(data);
      setExpandedRow(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params: any = {};
    if (weekStart) params.week_start = weekStart;
    if (weekEnd) params.week_end = weekEnd;
    fetchReport(params);
  }

  function clearFilter() {
    setWeekStart('');
    setWeekEnd('');
    fetchReport();
  }

  function setCurrentWeek() {
    const monday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const sunday = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6), 'yyyy-MM-dd');
    setWeekStart(monday);
    setWeekEnd(sunday);
  }

  function toggleRow(id: number) {
    setExpandedRow(expandedRow === id ? null : id);
  }

  function exportToCSV() {
    const headers = isAdmin
      ? ['Employee', 'Position', 'Total Hours', 'Regular Hours', 'OT Hours', 'Sick Days', 'Hourly Rate', 'Regular Pay', 'OT Pay', 'Total Cost']
      : ['Employee', 'Position', 'Total Hours', 'Regular Hours', 'OT Hours'];

    const dataRows = report.map((row) => {
      const rate = Number(row.hourly_rate || 0);
      const regularPay = Number(row.regular_hours || 0) * rate;
      const otPay = Number(row.ot_hours || 0) * rate * 1.5;
      if (isAdmin) {
        return [
          row.employee_name,
          row.position || '',
          Number(row.total_hours || 0).toFixed(1),
          Number(row.regular_hours || 0).toFixed(1),
          Number(row.ot_hours || 0).toFixed(1),
          Number(row.sick_days_count || 0),
          rate.toFixed(2),
          regularPay.toFixed(2),
          otPay.toFixed(2),
          (regularPay + otPay).toFixed(2),
        ];
      }
      return [
        row.employee_name,
        row.position || '',
        Number(row.total_hours || 0).toFixed(1),
        Number(row.regular_hours || 0).toFixed(1),
        Number(row.ot_hours || 0).toFixed(1),
      ];
    });

    const csv = [headers, ...dataRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateLabel = weekStart && weekEnd ? `${weekStart}_${weekEnd}` : new Date().toISOString().slice(0, 10);
    link.download = `employee-hours-${dateLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const isAdmin = user?.role === 'admin';
  const totalHours = report.reduce((sum, r) => sum + Number(r.total_hours || 0), 0);
  const totalOT = report.reduce((sum, r) => sum + Number(r.ot_hours || 0), 0);
  const totalSick = report.reduce((sum, r) => sum + Number(r.sick_days_count || 0), 0);
  const totalRegularPay = report.reduce((sum, r) => {
    const rate = Number(r.hourly_rate || 0);
    return sum + Number(r.regular_hours || 0) * rate;
  }, 0);
  const totalOTPay = report.reduce((sum, r) => {
    const rate = Number(r.hourly_rate || 0);
    return sum + Number(r.ot_hours || 0) * rate * 1.5;
  }, 0);
  const totalLaborCost = totalRegularPay + totalOTPay;

  // number of visible columns (for colSpan)
  const colCount = isAdmin ? 8 : 5;

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-6">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From (week start)</label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To (week end)</label>
            <input
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="button"
            onClick={setCurrentWeek}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
          >
            This Week
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Filter
          </button>
          {(weekStart || weekEnd) && (
            <button
              type="button"
              onClick={clearFilter}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
            >
              Clear
            </button>
          )}
          {report.length > 0 && (
            <button
              type="button"
              onClick={exportToCSV}
              className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
            >
              ⬇ Export CSV
            </button>
          )}
        </form>
      </div>

      {/* Summary Cards */}
      <div className={`mb-6 grid gap-4 ${isAdmin ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2'}`}>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}</p>
          <p className="text-sm text-gray-500">Total Hours</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{totalOT.toFixed(1)}</p>
          <p className="text-sm text-gray-500">OT Hours</p>
        </div>
        {isAdmin && (
          <>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{totalSick}</p>
              <p className="text-sm text-gray-500">Sick Days</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center border-t-4 border-green-400">
              <p className="text-xl font-bold text-green-600">
                ${totalRegularPay.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-gray-500">Regular Pay</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center border-t-4 border-orange-400">
              <p className="text-xl font-bold text-orange-500">
                ${totalOTPay.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-gray-500">OT Pay</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center border-t-4 border-purple-400">
              <p className="text-xl font-bold text-purple-600">
                ${totalLaborCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-gray-500">Total Labor</p>
            </div>
          </>
        )}
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isAdmin && report.length > 0 && (
          <div className="px-6 py-2 bg-blue-50 border-b text-xs text-blue-600 font-medium">
            Click a row to see cost breakdown
          </div>
        )}
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading report...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {isAdmin && <th className="px-3 py-3 w-6" />}
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Employee</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Position</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-700">Total Hrs</th>
                <th className="px-6 py-3 text-right font-semibold text-green-700">Regular Hrs</th>
                <th className="px-6 py-3 text-right font-semibold text-orange-600">OT Hrs</th>
                {isAdmin && <th className="px-6 py-3 text-right font-semibold text-blue-600">Sick Days</th>}
                {isAdmin && <th className="px-6 py-3 text-right font-semibold text-purple-700">Total Cost</th>}
              </tr>
            </thead>
            <tbody>
              {report.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-6 py-12 text-center text-gray-500">
                    No data found for the selected period.
                  </td>
                </tr>
              ) : (
                report.map((row) => {
                  const rate = Number(row.hourly_rate || 0);
                  const regularPay = Number(row.regular_hours || 0) * rate;
                  const otPay = Number(row.ot_hours || 0) * rate * 1.5;
                  const totalPay = regularPay + otPay;
                  const isExpanded = expandedRow === row.employee_id;

                  return (
                    <React.Fragment key={row.employee_id}>
                      {/* Main row */}
                      <tr
                        className={`border-b transition-colors ${isAdmin ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-gray-50'} ${isExpanded ? 'bg-blue-50' : ''}`}
                        onClick={() => isAdmin && toggleRow(row.employee_id)}
                      >
                        {isAdmin && (
                          <td className="px-3 py-3 text-center text-gray-400 text-xs">
                            {isExpanded ? '▼' : '▶'}
                          </td>
                        )}
                        <td className="px-6 py-3 font-medium text-gray-900">{row.employee_name}</td>
                        <td className="px-6 py-3 text-gray-600">{row.position || '-'}</td>
                        <td className="px-6 py-3 text-right font-semibold">
                          {Number(row.total_hours || 0).toFixed(1)}
                        </td>
                        <td className="px-6 py-3 text-right text-green-700">
                          {Number(row.regular_hours || 0).toFixed(1)}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {Number(row.ot_hours || 0) > 0 ? (
                            <span className="text-orange-600 font-semibold">
                              {Number(row.ot_hours || 0).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400">0.0</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-3 text-right">
                            {Number(row.sick_days_count || 0) > 0 ? (
                              <span className="text-blue-600 font-semibold">{row.sick_days_count}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="px-6 py-3 text-right font-semibold text-purple-700">
                            ${totalPay.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </td>
                        )}
                      </tr>

                      {/* Expandable cost breakdown row */}
                      {isAdmin && isExpanded && (
                        <tr className="bg-blue-50 border-b">
                          <td colSpan={colCount + 1} className="px-8 py-4">
                            <div className="flex flex-wrap gap-6 items-center">
                              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                                Cost Breakdown — {row.employee_name}
                              </div>
                              <div className="flex flex-wrap gap-4">
                                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border text-sm">
                                  <span className="text-gray-500">Regular Hours $ = </span>
                                  <span className="font-bold text-green-600">${regularPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {Number(row.ot_hours || 0) > 0 && (
                                  <div className="bg-white rounded-lg px-4 py-2 shadow-sm border text-sm">
                                    <span className="text-gray-500">OT Hours $ = </span>
                                    <span className="font-bold text-orange-500">${otPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-purple-200 text-sm">
                                  <span className="text-gray-500">Total = </span>
                                  <span className="font-bold text-purple-600">${totalPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border text-sm">
                                  <span className="text-gray-500">Sick = </span>
                                  <span className="font-bold text-blue-600">{Number(row.sick_days_count || 0)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {report.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  {isAdmin && <td />}
                  <td className="px-6 py-3 font-bold text-gray-700" colSpan={2}>
                    TOTAL ({report.length} employees)
                  </td>
                  <td className="px-6 py-3 text-right font-bold">{totalHours.toFixed(1)}</td>
                  <td className="px-6 py-3 text-right font-bold text-green-700">
                    {report.reduce((s, r) => s + Number(r.regular_hours || 0), 0).toFixed(1)}
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-orange-600">{totalOT.toFixed(1)}</td>
                  {isAdmin && <td className="px-6 py-3 text-right font-bold text-blue-600">{totalSick}</td>}
                  {isAdmin && (
                    <td className="px-6 py-3 text-right font-bold text-purple-600">
                      ${totalLaborCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
