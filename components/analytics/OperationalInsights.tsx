'use client';

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  CogIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function OperationalInsights() {
  // Project performance metrics
  const projectMetrics = [
    { month: 'Jan', onTime: 85, onBudget: 90, clientSatisfaction: 88 },
    { month: 'Feb', onTime: 88, onBudget: 92, clientSatisfaction: 90 },
    { month: 'Mar', onTime: 90, onBudget: 91, clientSatisfaction: 92 },
    { month: 'Apr', onTime: 92, onBudget: 93, clientSatisfaction: 94 },
    { month: 'May', onTime: 91, onBudget: 94, clientSatisfaction: 93 },
    { month: 'Jun', onTime: 93, onBudget: 95, clientSatisfaction: 95 },
    { month: 'Jul', onTime: 95, onBudget: 96, clientSatisfaction: 96 },
  ];

  // Resource utilization
  const resourceUtilization = [
    { role: 'Senior Auditors', utilized: 92, available: 8, total: 100 },
    { role: 'Auditors', utilized: 85, available: 15, total: 100 },
    { role: 'Consultants', utilized: 78, available: 22, total: 100 },
    { role: 'Project Managers', utilized: 88, available: 12, total: 100 },
    { role: 'Technical Specialists', utilized: 75, available: 25, total: 100 },
  ];

  // Project pipeline
  const projectPipeline = [
    { stage: 'In Planning', count: 8, value: 320000 },
    { stage: 'In Progress', count: 15, value: 875000 },
    { stage: 'Under Review', count: 5, value: 285000 },
    { stage: 'Completed (Month)', count: 12, value: 680000 },
  ];

  // Team productivity
  const teamProductivity = [
    { name: 'Control Testing', completed: 245, target: 250, efficiency: 98 },
    { name: 'Evidence Collection', completed: 189, target: 200, efficiency: 94.5 },
    { name: 'Risk Assessments', completed: 42, target: 45, efficiency: 93.3 },
    { name: 'Client Reports', completed: 38, target: 40, efficiency: 95 },
  ];

  // Process efficiency
  const processEfficiency = [
    { process: 'Client Onboarding', avgDays: 3.2, target: 5, improvement: 36 },
    { process: 'Evidence Collection', avgDays: 12.5, target: 15, improvement: 17 },
    { process: 'Control Testing', avgDays: 8.7, target: 10, improvement: 13 },
    { process: 'Report Generation', avgDays: 2.1, target: 3, improvement: 30 },
    { process: 'Client Approval', avgDays: 4.5, target: 7, improvement: 36 },
  ];

  const operationalKPIs = {
    avgProjectDuration: 68,
    firstTimePassRate: 94,
    clientRetention: 96,
    employeeSatisfaction: 88,
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Operational KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <ClockIcon className="h-8 w-8 text-blue-600" />
            <ArrowTrendingDownIcon className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {operationalKPIs.avgProjectDuration} days
          </p>
          <p className="text-sm text-gray-600">Avg Project Duration</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
            <ArrowTrendingUpIcon className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{operationalKPIs.firstTimePassRate}%</p>
          <p className="text-sm text-gray-600">First-Time Pass Rate</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <UserGroupIcon className="h-8 w-8 text-purple-600" />
            <ArrowTrendingUpIcon className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{operationalKPIs.clientRetention}%</p>
          <p className="text-sm text-gray-600">Client Retention</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <UserGroupIcon className="h-8 w-8 text-yellow-600" />
            <ArrowTrendingUpIcon className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {operationalKPIs.employeeSatisfaction}%
          </p>
          <p className="text-sm text-gray-600">Employee Satisfaction</p>
        </div>
      </div>

      {/* Project Performance and Resource Utilization */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Performance Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={projectMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="onTime"
                stroke="#3b82f6"
                strokeWidth={2}
                name="On Time"
              />
              <Line
                type="monotone"
                dataKey="onBudget"
                stroke="#10b981"
                strokeWidth={2}
                name="On Budget"
              />
              <Line
                type="monotone"
                dataKey="clientSatisfaction"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Satisfaction"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Utilization</h3>
          <div className="space-y-3">
            {resourceUtilization.map((resource) => (
              <div key={resource.role}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{resource.role}</span>
                  <span className="text-sm text-gray-600">{resource.utilized}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      resource.utilized >= 90
                        ? 'bg-red-600'
                        : resource.utilized >= 80
                          ? 'bg-yellow-600'
                          : 'bg-green-600'
                    }`}
                    style={{ width: `${resource.utilized}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">Alert:</span> Senior Auditors at 92% capacity -
              consider hiring
            </p>
          </div>
        </div>
      </div>

      {/* Project Pipeline and Team Productivity */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Pipeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectPipeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" angle={-45} textAnchor="end" height={80} />
              <YAxis yAxisId="left" />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Projects" />
              <Bar yAxisId="right" dataKey="value" fill="#10b981" name="Value" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Productivity</h3>
          <div className="space-y-3">
            {teamProductivity.map((metric) => (
              <div key={metric.name} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{metric.name}</span>
                  <span
                    className={`text-sm font-semibold ${
                      metric.efficiency >= 95 ? 'text-green-600' : 'text-yellow-600'
                    }`}
                  >
                    {metric.efficiency}% efficiency
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Completed: {metric.completed}</span>
                  <span>•</span>
                  <span>Target: {metric.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Process Efficiency */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Process Efficiency</h3>
        <div className="grid grid-cols-5 gap-4">
          {processEfficiency.map((process) => (
            <div key={process.process} className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-20 h-20">
                  <circle
                    className="text-gray-200"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="36"
                    cx="40"
                    cy="40"
                  />
                  <circle
                    className="text-green-600"
                    strokeWidth="8"
                    strokeDasharray={`${process.improvement * 2.26} 226`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="36"
                    cx="40"
                    cy="40"
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <span className="absolute text-lg font-semibold">{process.improvement}%</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mt-2">{process.process}</p>
              <p className="text-xs text-gray-600">{process.avgDays} days avg</p>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Alerts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-900 mb-1">Critical Issues</p>
              <ul className="text-red-800 space-y-1">
                <li>• 2 projects at risk of deadline miss</li>
                <li>• Senior auditor capacity at 92%</li>
                <li>• Evidence collection backlog growing</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-green-900 mb-1">Operational Wins</p>
              <ul className="text-green-800 space-y-1">
                <li>• Process efficiency improved 25% YTD</li>
                <li>• Zero critical incidents this quarter</li>
                <li>• Client satisfaction at all-time high</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
