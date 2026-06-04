import React, { useState } from 'react';
import api from '../services/api';
import { format, startOfWeek, addDays } from 'date-fns';

export function ExportPage() {
  const [rangeMode, setRangeMode] = useState<'single' | 'range'>('single');
  const [weekDate, setWeekDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekEndDate, setWeekEndDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    try {
      setError(null);
      setLoading(true);

      const weekStart = format(weekDate, 'yyyy-MM-dd');
      const weekEnd = rangeMode === 'range' ? format(weekEndDate, 'yyyy-MM-dd') : undefined;

      if (weekEnd && weekEnd < weekStart) {
        setError('End week must be on or after start week.');
        return;
      }

      const blob = await api.exportToExcel(weekStart, weekEnd);

      const rangeLabel = weekEnd ? `${weekStart}_to_${weekEnd}` : weekStart;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timesheets-${rangeLabel}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export');
    } finally {
      setLoading(false);
    }
  }

  const startLabel = format(weekDate, 'MMM dd, yyyy');
  const endLabel = format(addDays(weekDate, 6), 'MMM dd, yyyy');
  const endRangeLabel = format(addDays(weekEndDate, 6), 'MMM dd, yyyy');

  return (
    <div>
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Export Timesheets</h2>
        <p className="text-sm text-gray-500 mb-6">Export approved timesheets to Excel. Company name is pulled from your admin profile.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Range mode toggle */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setRangeMode('single')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${rangeMode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Single Week
          </button>
          <button
            onClick={() => setRangeMode('range')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${rangeMode === 'range' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Date Range
          </button>
        </div>

        <div className="mb-8 space-y-4">
          {/* Week start selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {rangeMode === 'range' ? 'Start Week' : 'Week'}
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekDate(addDays(weekDate, -7))}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
              >
                ← Prev
              </button>
              <div className="flex-1 text-center bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                <p className="text-sm font-semibold text-blue-700">
                  {startLabel} – {endLabel}
                </p>
              </div>
              <button
                onClick={() => setWeekDate(addDays(weekDate, 7))}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Week end selector (range mode) */}
          {rangeMode === 'range' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Week</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setWeekEndDate(addDays(weekEndDate, -7))}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  ← Prev
                </button>
                <div className="flex-1 text-center bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                  <p className="text-sm font-semibold text-blue-700">
                    {format(weekEndDate, 'MMM dd, yyyy')} – {endRangeLabel}
                  </p>
                </div>
                <button
                  onClick={() => setWeekEndDate(addDays(weekEndDate, 7))}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  Next →
                </button>
              </div>
              {format(weekEndDate, 'yyyy-MM-dd') < format(weekDate, 'yyyy-MM-dd') && (
                <p className="mt-1 text-xs text-red-500">End week must be on or after start week.</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-700">
          <p className="font-medium mb-1">The export includes:</p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>Company name header (from your admin profile)</li>
            <li>Summary sheet with project totals per week</li>
            <li>Individual sheets for each project</li>
            <li>All-projects consolidated summary</li>
            {rangeMode === 'range' && <li>All approved timesheets across the selected date range</li>}
          </ul>
        </div>

        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          {loading ? 'Generating Excel...' : 'Export to Excel (.xlsx)'}
        </button>
      </div>
    </div>
  );
}
