'use client';

import {
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

export default function BillingHeader() {
  const stats = [
    {
      label: 'Total Revenue (YTD)',
      value: '$2,148,000',
      change: '+24%',
      positive: true,
      icon: CurrencyDollarIcon,
    },
    {
      label: 'Monthly Recurring',
      value: '$378,000',
      change: '+12%',
      positive: true,
      icon: ArrowTrendingUpIcon,
    },
    {
      label: 'Outstanding',
      value: '$105,000',
      change: '8 invoices',
      positive: false,
      icon: ClockIcon,
    },
    {
      label: 'Collected This Month',
      value: '$342,000',
      change: '96.5% rate',
      positive: true,
      icon: CheckCircleIcon,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Billing & Revenue</h1>
      <p className="mt-2 text-gray-600">
        Manage invoicing, track revenue, and calculate SOC audit pricing
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
                    stat.positive ? 'text-green-600' : 'text-yellow-600'
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
