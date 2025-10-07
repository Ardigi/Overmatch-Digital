'use client';

import {
  BuildingOfficeIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export default function ClientsHeader() {
  const stats = [
    {
      label: 'Total Clients',
      value: '47',
      change: '+12%',
      positive: true,
      icon: BuildingOfficeIcon,
    },
    {
      label: 'Active Engagements',
      value: '23',
      change: '+5',
      positive: true,
      icon: ChartBarIcon,
    },
    {
      label: 'Pending Audits',
      value: '8',
      change: '2 overdue',
      positive: false,
      icon: ClockIcon,
    },
    {
      label: 'Completed This Quarter',
      value: '15',
      change: '+25%',
      positive: true,
      icon: CheckCircleIcon,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
      <p className="mt-2 text-gray-600">
        Manage client relationships, contracts, and SOC audit engagements
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
