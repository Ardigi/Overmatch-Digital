'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function ExecutiveDashboard() {
  // Mock data for executive metrics
  const revenueData = [
    { month: 'Jan', revenue: 320000, target: 300000 },
    { month: 'Feb', revenue: 380000, target: 350000 },
    { month: 'Mar', revenue: 420000, target: 400000 },
    { month: 'Apr', revenue: 460000, target: 450000 },
    { month: 'May', revenue: 510000, target: 500000 },
    { month: 'Jun', revenue: 580000, target: 550000 },
    { month: 'Jul', revenue: 620000, target: 600000 },
  ];

  const complianceScore = [
    { month: 'Jan', score: 78 },
    { month: 'Feb', score: 82 },
    { month: 'Mar', score: 85 },
    { month: 'Apr', score: 88 },
    { month: 'May', score: 91 },
    { month: 'Jun', score: 93 },
    { month: 'Jul', score: 95 },
  ];

  const clientGrowth = [
    { month: 'Jan', clients: 45, newClients: 5 },
    { month: 'Feb', clients: 52, newClients: 7 },
    { month: 'Mar', clients: 58, newClients: 6 },
    { month: 'Apr', clients: 65, newClients: 7 },
    { month: 'May', clients: 74, newClients: 9 },
    { month: 'Jun', clients: 82, newClients: 8 },
    { month: 'Jul', clients: 91, newClients: 9 },
  ];

  const projectDistribution = [
    { name: 'SOC 2 Type II', value: 45, color: '#3b82f6' },
    { name: 'SOC 2 Type I', value: 20, color: '#10b981' },
    { name: 'SOC 1', value: 15, color: '#f59e0b' },
    { name: 'Readiness', value: 12, color: '#8b5cf6' },
    { name: 'Other', value: 8, color: '#6b7280' },
  ];

  const keyMetrics = [
    {
      title: 'Total Revenue YTD',
      value: '$3.2M',
      change: '+24%',
      trend: 'up',
      icon: CurrencyDollarIcon,
      color: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      title: 'Active Clients',
      value: '91',
      change: '+102%',
      trend: 'up',
      icon: UserGroupIcon,
      color: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Compliance Score',
      value: '95%',
      change: '+17%',
      trend: 'up',
      icon: ShieldCheckIcon,
      color: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Avg. Project Duration',
      value: '68 days',
      change: '-15%',
      trend: 'down',
      icon: ClockIcon,
      color: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
    },
  ];

  const topPartners = [
    { name: 'Anderson & Associates CPA', revenue: 450000, projects: 12 },
    { name: 'TechAudit Partners', revenue: 320000, projects: 8 },
    { name: 'Regional Business Advisors', revenue: 225000, projects: 15 },
    { name: 'Compliance First LLC', revenue: 175000, projects: 5 },
  ];

  const upcomingMilestones = [
    { title: 'Q3 Revenue Target', deadline: '2024-09-30', progress: 78 },
    { title: 'SOC 2 Recertification', deadline: '2024-08-15', progress: 90 },
    { title: 'Partner Summit', deadline: '2024-08-20', progress: 65 },
    { title: 'Platform 2.0 Launch', deadline: '2024-09-01', progress: 45 },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {keyMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className={`${metric.color} rounded-lg p-6`}>
              <div className="flex items-center justify-between mb-4">
                <Icon className={`h-8 w-8 ${metric.iconColor}`} />
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    metric.trend === 'up' ? 'text-green-600' : 'text-green-600'
                  }`}
                >
                  {metric.trend === 'up' ? (
                    <ArrowUpIcon className="h-4 w-4" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4" />
                  )}
                  {metric.change}
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              <p className="text-sm text-gray-600">{metric.title}</p>
            </div>
          );
        })}
      </div>

      {/* Revenue and Compliance Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Target</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value / 1000}k`} />
              <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                fill="#dbeafe"
                name="Actual Revenue"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#ef4444"
                strokeDasharray="5 5"
                name="Target"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Score Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={complianceScore}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981' }}
                name="Compliance Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Client Growth and Project Distribution */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={clientGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="clients" fill="#3b82f6" name="Total Clients" />
              <Bar dataKey="newClients" fill="#10b981" name="New Clients" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={projectDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {projectDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Partners and Milestones */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Partners</h3>
          <div className="space-y-3">
            {topPartners.map((partner, index) => (
              <div
                key={partner.name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-600 rounded-full font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{partner.name}</p>
                    <p className="text-sm text-gray-600">{partner.projects} projects</p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900">
                  ${(partner.revenue / 1000).toFixed(0)}k
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Milestones</h3>
          <div className="space-y-3">
            {upcomingMilestones.map((milestone) => (
              <div key={milestone.title} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{milestone.title}</p>
                  <span className="text-sm text-gray-600">{milestone.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      milestone.progress >= 80
                        ? 'bg-green-600'
                        : milestone.progress >= 60
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                    }`}
                    style={{ width: `${milestone.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Due: {new Date(milestone.deadline).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Alerts */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-900 mb-1">Executive Attention Required</p>
            <ul className="text-yellow-800 space-y-1">
              <li>• 3 high-risk items require immediate review</li>
              <li>• Q3 hiring targets behind by 2 positions</li>
              <li>• Partner satisfaction score dropped 5% this month</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
