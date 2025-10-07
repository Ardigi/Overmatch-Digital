'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useControlStats } from '@/hooks/api/useControls';

interface ControlStat {
  name: string;
  value: number;
  percentage: number;
  icon: any;
  color: string;
  bgColor: string;
}

export default function ControlsStats() {
  const { data, loading, error, execute } = useControlStats();
  const [stats, setStats] = useState<ControlStat[]>([]);
  const [totalControls, setTotalControls] = useState(0);

  useEffect(() => {
    if (data) {
      // Transform API data to stats format
      const total = data.total || 0;
      const implemented = data.implemented || 0;
      const partiallyImplemented = data.partiallyImplemented || 0;
      const notImplemented = data.notImplemented || 0;
      const notApplicable = data.notApplicable || 0;

      const statsData: ControlStat[] = [
        {
          name: 'Implemented',
          value: implemented,
          percentage: total > 0 ? Math.round((implemented / total) * 100) : 0,
          icon: CheckCircleIcon,
          color: 'text-green-600 bg-green-100',
          bgColor: 'bg-green-600',
        },
        {
          name: 'Partially Implemented',
          value: partiallyImplemented,
          percentage: total > 0 ? Math.round((partiallyImplemented / total) * 100) : 0,
          icon: ExclamationTriangleIcon,
          color: 'text-yellow-600 bg-yellow-100',
          bgColor: 'bg-yellow-600',
        },
        {
          name: 'Not Implemented',
          value: notImplemented,
          percentage: total > 0 ? Math.round((notImplemented / total) * 100) : 0,
          icon: XCircleIcon,
          color: 'text-red-600 bg-red-100',
          bgColor: 'bg-red-600',
        },
        {
          name: 'Not Applicable',
          value: notApplicable,
          percentage: total > 0 ? Math.round((notApplicable / total) * 100) : 0,
          icon: ClockIcon,
          color: 'text-gray-600 bg-gray-100',
          bgColor: 'bg-gray-600',
        },
      ];

      setStats(statsData);
      setTotalControls(total);
    } else {
      // Use mock data as fallback
      const mockStats: ControlStat[] = [
        {
          name: 'Implemented',
          value: 142,
          percentage: 65,
          icon: CheckCircleIcon,
          color: 'text-green-600 bg-green-100',
          bgColor: 'bg-green-600',
        },
        {
          name: 'Partially Implemented',
          value: 45,
          percentage: 21,
          icon: ExclamationTriangleIcon,
          color: 'text-yellow-600 bg-yellow-100',
          bgColor: 'bg-yellow-600',
        },
        {
          name: 'Not Implemented',
          value: 28,
          percentage: 13,
          icon: XCircleIcon,
          color: 'text-red-600 bg-red-100',
          bgColor: 'bg-red-600',
        },
        {
          name: 'Not Applicable',
          value: 3,
          percentage: 1,
          icon: ClockIcon,
          color: 'text-gray-600 bg-gray-100',
          bgColor: 'bg-gray-600',
        },
      ];
      setStats(mockStats);
      setTotalControls(mockStats.reduce((sum, stat) => sum + stat.value, 0));
    }
  }, [data]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
          ))}
        </div>
        <div className="mt-6 bg-gray-200 h-32 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
          <p className="text-sm text-red-800">Failed to load control statistics</p>
          <button
            onClick={() => execute()}
            className="ml-auto text-sm text-red-600 hover:text-red-700 flex items-center"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
                      <div className="ml-2 flex items-baseline text-sm font-semibold text-gray-600">
                        ({stat.percentage}%)
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Overall Implementation Progress</h3>
          <button
            onClick={() => execute()}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
            title="Refresh statistics"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="relative">
          <div className="overflow-hidden h-8 text-xs flex rounded-lg bg-gray-200">
            {stats.map((stat) => (
              <div
                key={stat.name}
                style={{ width: `${stat.percentage}%` }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${stat.bgColor} transition-all duration-500`}
              >
                {stat.percentage > 5 && <span className="font-semibold">{stat.percentage}%</span>}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-600">
            <span>0 controls</span>
            <span>{totalControls} total controls</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4">
          {stats.map((stat) => (
            <div key={stat.name} className="flex items-center">
              <div className={`h-3 w-3 rounded-full ${stat.bgColor}`}></div>
              <span className="ml-2 text-sm text-gray-600">
                {stat.name} ({stat.value})
              </span>
            </div>
          ))}
        </div>

        {/* Additional Metrics */}
        {data && (
          <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-500">Test Coverage</p>
              <p className="text-lg font-semibold text-gray-900">
                {data.testCoverage ? `${Math.round(data.testCoverage)}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Effectiveness</p>
              <p className="text-lg font-semibold text-gray-900">
                {data.avgEffectiveness ? `${Math.round(data.avgEffectiveness)}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Controls Due for Testing</p>
              <p className="text-lg font-semibold text-gray-900">
                {data.dueForTesting || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Open Gaps</p>
              <p className="text-lg font-semibold text-gray-900">
                {data.openGaps || 0}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}