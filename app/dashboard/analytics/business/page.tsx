'use client';

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ChartPieIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Suspense, useState } from 'react';
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

const kpiMetrics = [
  {
    name: 'Total Revenue',
    value: '$1.2M',
    change: '+12.5%',
    trending: 'up',
    icon: CurrencyDollarIcon,
  },
  {
    name: 'Active Clients',
    value: '145',
    change: '+8.2%',
    trending: 'up',
    icon: UserGroupIcon,
  },
  {
    name: 'Average Deal Size',
    value: '$45K',
    change: '+15.3%',
    trending: 'up',
    icon: BriefcaseIcon,
  },
  {
    name: 'Client Retention',
    value: '95%',
    change: '-0.5%',
    trending: 'down',
    icon: ChartBarIcon,
  },
];

const revenueData = [
  { month: 'Jan', actual: 85000, forecast: 82000, lastYear: 72000 },
  { month: 'Feb', actual: 92000, forecast: 88000, lastYear: 75000 },
  { month: 'Mar', actual: 98000, forecast: 95000, lastYear: 80000 },
  { month: 'Apr', actual: 105000, forecast: 102000, lastYear: 85000 },
  { month: 'May', actual: 112000, forecast: 108000, lastYear: 88000 },
  { month: 'Jun', actual: 118000, forecast: 115000, lastYear: 92000 },
];

const serviceBreakdown = [
  { name: 'SOC 2 Type II', value: 45, revenue: 540000 },
  { name: 'SOC 1', value: 20, revenue: 240000 },
  { name: 'ISO 27001', value: 15, revenue: 180000 },
  { name: 'Penetration Testing', value: 12, revenue: 144000 },
  { name: 'Other Services', value: 8, revenue: 96000 },
];

const clientGrowth = [
  { quarter: 'Q1 2023', newClients: 12, churned: 2, net: 10, total: 105 },
  { quarter: 'Q2 2023', newClients: 15, churned: 3, net: 12, total: 117 },
  { quarter: 'Q3 2023', newClients: 18, churned: 2, net: 16, total: 133 },
  { quarter: 'Q4 2023', newClients: 20, churned: 4, net: 16, total: 149 },
  { quarter: 'Q1 2024', newClients: 22, churned: 3, net: 19, total: 168 },
];

const pipelineMetrics = [
  { stage: 'Qualified Leads', value: 45, amount: '$2.1M' },
  { stage: 'Proposals Sent', value: 28, amount: '$1.3M' },
  { stage: 'Negotiation', value: 15, amount: '$675K' },
  { stage: 'Closing', value: 8, amount: '$360K' },
];

const COLORS = ['#0369a1', '#0891b2', '#06b6d4', '#22d3ee', '#67e8f9'];

// Loading skeleton component
function MetricSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-32"></div>
          <div className="h-4 bg-gray-200 rounded w-20 mt-2"></div>
        </div>
        <div className="h-8 w-8 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse"></div>
      <div className="h-80 bg-gray-100 rounded animate-pulse"></div>
    </div>
  );
}

export default function BusinessAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('6months');
  const [selectedView, setSelectedView] = useState<'overview' | 'revenue' | 'clients' | 'pipeline'>(
    'overview'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab navigation configuration
  const viewTabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'revenue', label: 'Revenue', icon: CurrencyDollarIcon },
    { id: 'clients', label: 'Clients', icon: UserGroupIcon },
    { id: 'pipeline', label: 'Pipeline', icon: ChartPieIcon },
  ] as const;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header with better hierarchy */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Business Analytics</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Track performance metrics and make data-driven decisions
            </p>
          </div>

          {/* Larger, more accessible time range selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="time-range" className="text-sm font-medium text-gray-700">
              Time Range:
            </label>
            <select
              id="time-range"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[140px]"
              aria-label="Select time range for analytics"
            >
              <option value="1month">Last Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Progressive disclosure with tabs */}
      <div className="mb-6">
        <nav className="flex space-x-1 rounded-lg bg-gray-100 p-1" role="tablist">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedView(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                selectedView === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              role="tab"
              aria-selected={selectedView === tab.id}
              aria-controls={`${tab.id}-panel`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">Error loading analytics: {error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Content based on selected view */}
      <div role="tabpanel" id={`${selectedView}-panel`}>
        {selectedView === 'overview' && (
          <>
            {/* KPI Cards with loading states */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
                : kpiMetrics.map((metric) => (
                    <div
                      key={metric.name}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200 focus-within:ring-2 focus-within:ring-primary-500"
                      tabIndex={0}
                      role="article"
                      aria-label={`${metric.name}: ${metric.value}, ${metric.change} from previous period`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">{metric.name}</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                          <div className="flex items-center mt-2">
                            {metric.trending === 'up' ? (
                              <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                            )}
                            <span
                              className={`text-sm ml-1 ${
                                metric.trending === 'up' ? 'text-green-500' : 'text-red-500'
                              }`}
                            >
                              {metric.change}
                            </span>
                          </div>
                        </div>
                        <metric.icon className="h-8 w-8 text-gray-400" />
                      </div>
                    </div>
                  ))}
            </div>

            {/* Show limited charts in overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isLoading ? (
                <>
                  <ChartSkeleton />
                  <ChartSkeleton />
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h2>
                    <div className="h-64 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="actual"
                            stroke="#0369a1"
                            strokeWidth={2}
                            name="Actual"
                          />
                          <Line
                            type="monotone"
                            dataKey="forecast"
                            stroke="#06b6d4"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Forecast"
                          />
                          <Line
                            type="monotone"
                            dataKey="lastYear"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            name="Last Year"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Growth</h2>
                    <div className="h-64 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={clientGrowth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="quarter" />
                          <YAxis />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="total"
                            stroke="#0369a1"
                            fill="#0369a1"
                            fillOpacity={0.3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Revenue View */}
        {selectedView === 'revenue' && (
          <div className="space-y-6">
            {isLoading ? (
              <>
                <ChartSkeleton />
                <ChartSkeleton />
              </>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Revenue Trends & Forecast
                  </h2>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="#0369a1"
                          strokeWidth={2}
                          name="Actual"
                        />
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          name="Forecast"
                        />
                        <Line
                          type="monotone"
                          dataKey="lastYear"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          name="Last Year"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Service Revenue Breakdown
                  </h2>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={serviceBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}%`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {serviceBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Clients View */}
        {selectedView === 'clients' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Client Acquisition & Growth
            </h2>
            {isLoading ? (
              <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clientGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="newClients" stackId="a" fill="#22c55e" name="New Clients" />
                    <Bar dataKey="churned" stackId="a" fill="#ef4444" name="Churned" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Pipeline View */}
        {selectedView === 'pipeline' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Pipeline Overview</h2>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-2 bg-gray-200 rounded-full"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {pipelineMetrics.map((stage, index) => (
                  <div key={stage.stage} role="group" aria-label={`${stage.stage} pipeline stage`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">{stage.stage}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {stage.value} deals
                        </span>
                        <span className="text-sm text-gray-500 ml-2">({stage.amount})</span>
                      </div>
                    </div>
                    <div
                      className="w-full bg-gray-200 rounded-full h-3"
                      role="progressbar"
                      aria-valuenow={(stage.value / pipelineMetrics[0].value) * 100}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${(stage.value / pipelineMetrics[0].value) * 100}%`,
                          backgroundColor: COLORS[index],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
