import React from 'react';
import { ProjectFinancialSummary } from '../types';

interface ProjectCardProps {
  project: ProjectFinancialSummary;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const getStatusColor = (percent: number) => {
    if (percent < 95) return 'bg-green-50 border-green-200';
    if (percent <= 100) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getTextColor = (percent: number) => {
    if (percent < 95) return 'text-green-700';
    if (percent <= 100) return 'text-yellow-700';
    return 'text-red-700';
  };

  const getProgressColor = (percent: number) => {
    if (percent < 95) return 'bg-green-500';
    if (percent <= 100) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-lg border cursor-pointer transition-shadow hover:shadow-lg ${getStatusColor(
        project.percent_spent,
      )}`}
    >
      <h3 className="text-xl font-bold text-gray-900 mb-4">{project.name}</h3>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Budget Status</span>
          <span className={`text-lg font-bold ${getTextColor(project.percent_spent)}`}>
            {project.percent_spent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getProgressColor(project.percent_spent)}`}
            style={{ width: `${Math.min(project.percent_spent, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Financial Info */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-gray-600">Labor Budget</p>
          <p className="text-lg font-bold text-gray-900">${project.labor_budget.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-600">Total Spent</p>
          <p className="text-lg font-bold text-gray-900">${project.total_spent.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-600">w/ Overhead (20%)</p>
          <p className="text-lg font-bold text-gray-900">${project.total_with_overhead.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-600">Remaining</p>
          <p className={`text-lg font-bold ${project.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${project.remaining.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Hours Info */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <div>
          <p className="text-gray-600 text-sm">Total Hours</p>
          <p className="text-xl font-bold text-gray-900">{project.total_hours.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-gray-600 text-sm">OT Hours</p>
          <p className="text-xl font-bold text-orange-600">{project.ot_hours.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-gray-600 text-sm">This Week</p>
          <p className="text-xl font-bold text-blue-600">{project.current_week_hours.toFixed(1)}</p>
        </div>
      </div>

      {/* Tickets Summary */}
      <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-2 text-center text-sm">
        <div>
          <p className="text-gray-600">Regular</p>
          <p className="font-bold text-gray-900">{project.tickets_summary.regular_tickets}</p>
        </div>
        <div>
          <p className="text-gray-600">OT</p>
          <p className="font-bold text-gray-900">{project.tickets_summary.ot_tickets}</p>
        </div>
        <div>
          <p className="text-gray-600">Pending</p>
          <p className="font-bold text-yellow-600">{project.tickets_summary.pending}</p>
        </div>
        <div>
          <p className="text-gray-600">Approved</p>
          <p className="font-bold text-green-600">{project.tickets_summary.approved}</p>
        </div>
      </div>
    </div>
  );
}
