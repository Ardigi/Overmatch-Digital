'use client';

import {
  ArrowTrendingUpIcon,
  ChartPieIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

export default function SalesHeader() {
  const stats = [
    {
      label: 'Pipeline Value',
      value: '$1,850,000',
      change: '+22%',
      positive: true,
      icon: CurrencyDollarIcon,
    },
    {
      label: 'Qualified Leads',
      value: '47',
      change: '+12 this month',
      positive: true,
      icon: UserGroupIcon,
    },
    {
      label: 'Conversion Rate',
      value: '24%',
      change: '+3.2%',
      positive: true,
      icon: ArrowTrendingUpIcon,
    },
    {
      label: 'Average Deal Size',
      value: '$125,000',
      change: '+8%',
      positive: true,
      icon: ChartPieIcon,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Sales & Lead Management</h1>
      <p className="mt-2 text-gray-600">
        Track leads, manage your sales pipeline, and calculate ROI for prospects
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <Icon className="h-12 w-12 text-primary-600" />
                <span
                  className={`text-sm font-medium ${
                    stat.positive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-bold text-gray-900">{stat.value}</h3>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
