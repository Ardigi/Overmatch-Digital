'use client';

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  DocumentIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

interface Metric {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
}

const metrics: Metric[] = [
  {
    label: 'Total Reports',
    value: 156,
    change: 12,
    trend: 'up',
    icon: DocumentIcon,
  },
  {
    label: 'Avg. Generation Time',
    value: '2.3 min',
    change: -15,
    trend: 'down',
    icon: ClockIcon,
  },
  {
    label: 'Active Users',
    value: 24,
    change: 3,
    trend: 'up',
    icon: UsersIcon,
  },
];

export default function ReportMetrics() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Report Analytics</h2>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const TrendIcon = metric.trend === 'up' ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
            const trendColor = metric.trend === 'up' ? 'text-green-600' : 'text-red-600';

            return (
              <div key={metric.label} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{metric.value}</p>
                    <p className="text-xs text-gray-500">{metric.label}</p>
                  </div>
                </div>
                {metric.change !== undefined && (
                  <div className={`flex items-center ${trendColor}`}>
                    <TrendIcon className="h-4 w-4" />
                    <span className="ml-1 text-sm">{Math.abs(metric.change)}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Report Usage Chart */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Report Generation Trend</h3>
          <div className="space-y-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, index) => {
              const percentage = [65, 80, 45, 90, 70][index];

              return (
                <div key={day} className="flex items-center">
                  <span className="text-xs text-gray-500 w-8">{day}</span>
                  <div className="flex-1 ml-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="ml-2 text-xs text-gray-500 w-10 text-right">
                    {Math.round(percentage * 1.56)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Reports */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Most Generated</h3>
          <div className="space-y-2">
            {[
              { name: 'SOC 2 Type II', count: 45 },
              { name: 'Security Metrics', count: 38 },
              { name: 'Executive Summary', count: 32 },
            ].map((report) => (
              <div key={report.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{report.name}</span>
                <span className="text-gray-900 font-medium">{report.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
