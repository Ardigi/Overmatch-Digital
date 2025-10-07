'use client';

import {
  ArrowUpIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  XCircleIcon,
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
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function ComplianceMetrics() {
  // Trust Services Criteria compliance data
  const tscCompliance = [
    { criteria: 'Security', score: 94, controls: 45, compliant: 42 },
    { criteria: 'Availability', score: 96, controls: 28, compliant: 27 },
    { criteria: 'Processing Integrity', score: 91, controls: 32, compliant: 29 },
    { criteria: 'Confidentiality', score: 93, controls: 38, compliant: 35 },
    { criteria: 'Privacy', score: 89, controls: 41, compliant: 36 },
  ];

  const controlEffectiveness = [
    { month: 'Jan', automated: 78, manual: 65, hybrid: 72 },
    { month: 'Feb', automated: 82, manual: 68, hybrid: 75 },
    { month: 'Mar', automated: 85, manual: 70, hybrid: 78 },
    { month: 'Apr', automated: 88, manual: 72, hybrid: 80 },
    { month: 'May', automated: 91, manual: 74, hybrid: 82 },
    { month: 'Jun', automated: 93, manual: 76, hybrid: 85 },
    { month: 'Jul', automated: 95, manual: 78, hybrid: 87 },
  ];

  const auditFindings = [
    { severity: 'Critical', count: 0, color: '#ef4444' },
    { severity: 'High', count: 2, color: '#f59e0b' },
    { severity: 'Medium', count: 5, color: '#eab308' },
    { severity: 'Low', count: 12, color: '#10b981' },
    { severity: 'Observation', count: 8, color: '#6b7280' },
  ];

  const frameworkCoverage = [
    { framework: 'SOC 2', coverage: 95, required: 184, implemented: 175 },
    { framework: 'ISO 27001', coverage: 88, required: 114, implemented: 100 },
    { framework: 'GDPR', coverage: 92, required: 67, implemented: 62 },
    { framework: 'HIPAA', coverage: 85, required: 54, implemented: 46 },
  ];

  const radarData = tscCompliance.map((item) => ({
    criteria: item.criteria,
    A: item.score,
    fullMark: 100,
  }));

  const complianceTimeline = [
    { date: '2024-07-01', event: 'Quarterly Control Review', status: 'completed' },
    { date: '2024-08-15', event: 'SOC 2 Type II Audit', status: 'upcoming' },
    { date: '2024-09-01', event: 'ISO 27001 Surveillance', status: 'upcoming' },
    { date: '2024-10-01', event: 'Annual Risk Assessment', status: 'planned' },
  ];

  const controlStats = {
    total: 184,
    automated: 112,
    manual: 48,
    hybrid: 24,
    effectiveness: 92,
  };

  return (
    <div className="space-y-6">
      {/* Overall Compliance Score */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Overall Compliance Score</h3>
            <p className="text-gray-600 mt-1">Across all frameworks and Trust Services Criteria</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-green-600">92%</div>
            <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
              <ArrowUpIcon className="h-4 w-4" />
              <span>+5% from last quarter</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Services Criteria Radar */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">TSC Compliance by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="criteria" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Compliance %"
                dataKey="A"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Control Effectiveness Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={controlEffectiveness}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="automated"
                stroke="#10b981"
                strokeWidth={2}
                name="Automated"
              />
              <Line
                type="monotone"
                dataKey="manual"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Manual"
              />
              <Line
                type="monotone"
                dataKey="hybrid"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Hybrid"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Control Statistics */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <ShieldCheckIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{controlStats.total}</p>
          <p className="text-sm text-gray-600">Total Controls</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <CheckCircleIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{controlStats.automated}</p>
          <p className="text-sm text-gray-600">Automated</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <ClockIcon className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{controlStats.manual}</p>
          <p className="text-sm text-gray-600">Manual</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <ChartBarIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{controlStats.hybrid}</p>
          <p className="text-sm text-gray-600">Hybrid</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <DocumentTextIcon className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{controlStats.effectiveness}%</p>
          <p className="text-sm text-gray-600">Effectiveness</p>
        </div>
      </div>

      {/* Audit Findings and Framework Coverage */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Audit Findings</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={auditFindings} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="severity" type="category" />
              <Tooltip />
              <Bar dataKey="count">
                {auditFindings.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Good news!</span> No critical findings in the last 6
              months
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Framework Coverage</h3>
          <div className="space-y-4">
            {frameworkCoverage.map((framework) => (
              <div key={framework.framework}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{framework.framework}</span>
                  <span className="text-sm text-gray-600">
                    {framework.implemented}/{framework.required} controls
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      framework.coverage >= 90 ? 'bg-green-600' : 'bg-yellow-600'
                    }`}
                    style={{ width: `${framework.coverage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{framework.coverage}% compliant</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compliance Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Timeline</h3>
        <div className="space-y-3">
          {complianceTimeline.map((item, index) => (
            <div key={index} className="flex items-center gap-4">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  item.status === 'completed'
                    ? 'bg-green-100'
                    : item.status === 'upcoming'
                      ? 'bg-yellow-100'
                      : 'bg-gray-100'
                }`}
              >
                {item.status === 'completed' ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                ) : item.status === 'upcoming' ? (
                  <ClockIcon className="h-5 w-5 text-yellow-600" />
                ) : (
                  <CalendarIcon className="h-5 w-5 text-gray-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.event}</p>
                <p className="text-sm text-gray-600">{new Date(item.date).toLocaleDateString()}</p>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  item.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : item.status === 'upcoming'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Compliance Insights</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• Control automation increased by 15% this quarter</p>
          <p>• 100% of high-risk controls tested in the last 30 days</p>
          <p>• Average remediation time improved by 3 days</p>
          <p>• Next certification renewal in 45 days</p>
        </div>
      </div>
    </div>
  );
}
