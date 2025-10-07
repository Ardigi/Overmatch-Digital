'use client';

import { ArrowDownIcon, ArrowUpIcon, MinusIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface Metric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  status: 'good' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
  description: string;
}

const initialMetrics: Metric[] = [
  {
    id: '1',
    name: 'Password Compliance',
    value: 94,
    unit: '%',
    trend: 'up',
    trendValue: 2,
    status: 'good',
    threshold: { warning: 90, critical: 80 },
    description: 'Users meeting password policy requirements',
  },
  {
    id: '2',
    name: 'MFA Adoption',
    value: 87,
    unit: '%',
    trend: 'up',
    trendValue: 5,
    status: 'warning',
    threshold: { warning: 95, critical: 85 },
    description: 'Active users with MFA enabled',
  },
  {
    id: '3',
    name: 'Patch Compliance',
    value: 78,
    unit: '%',
    trend: 'down',
    trendValue: 3,
    status: 'critical',
    threshold: { warning: 95, critical: 90 },
    description: 'Systems with latest security patches',
  },
  {
    id: '4',
    name: 'Access Reviews',
    value: 100,
    unit: '%',
    trend: 'stable',
    trendValue: 0,
    status: 'good',
    threshold: { warning: 95, critical: 90 },
    description: 'Completed quarterly access reviews',
  },
  {
    id: '5',
    name: 'Encryption Coverage',
    value: 96,
    unit: '%',
    trend: 'up',
    trendValue: 1,
    status: 'good',
    threshold: { warning: 95, critical: 90 },
    description: 'Data encrypted at rest and in transit',
  },
  {
    id: '6',
    name: 'Backup Success Rate',
    value: 99.9,
    unit: '%',
    trend: 'stable',
    trendValue: 0,
    status: 'good',
    threshold: { warning: 99, critical: 95 },
    description: 'Successful backup completion rate',
  },
];

export default function ComplianceMetrics() {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Simulate real-time metric updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((metric) => {
          // Simulate small random changes
          const change = (Math.random() - 0.5) * 2;
          const newValue = Math.max(0, Math.min(100, metric.value + change));
          const trend = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable';

          // Determine status based on thresholds
          let status: 'good' | 'warning' | 'critical' = 'good';
          if (newValue < metric.threshold.critical) {
            status = 'critical';
          } else if (newValue < metric.threshold.warning) {
            status = 'warning';
          }

          return {
            ...metric,
            value: Math.round(newValue * 10) / 10,
            trend,
            trendValue: Math.abs(Math.round(change)),
            status,
          };
        })
      );
      setLastUpdated(new Date());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return ArrowUpIcon;
      case 'down':
        return ArrowDownIcon;
      default:
        return MinusIcon;
    }
  };

  return (
    <div>
      {/* Last Updated */}
      <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
        <span>Auto-refreshing every 10 seconds</span>
        <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {metrics.map((metric) => {
          const TrendIcon = getTrendIcon(metric.trend);
          const statusColor = getStatusColor(metric.status);

          return (
            <div
              key={metric.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{metric.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">{metric.description}</p>
                </div>
                <div className={`rounded-full p-1 ${statusColor}`}>
                  <SparklesIcon className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div className="flex items-baseline">
                  <span className="text-2xl font-semibold text-gray-900">{metric.value}</span>
                  <span className="ml-1 text-sm text-gray-500">{metric.unit}</span>
                </div>
                <div
                  className={`flex items-center text-sm ${
                    metric.trend === 'up'
                      ? 'text-green-600'
                      : metric.trend === 'down'
                        ? 'text-red-600'
                        : 'text-gray-600'
                  }`}
                >
                  <TrendIcon className="h-4 w-4 mr-1" />
                  {metric.trendValue > 0 && `${metric.trendValue}%`}
                </div>
              </div>

              {/* Threshold Indicator */}
              <div className="mt-3">
                <div className="relative pt-1">
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                    <div
                      style={{ width: `${metric.value}%` }}
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                        metric.status === 'good'
                          ? 'bg-green-500'
                          : metric.status === 'warning'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                  </div>
                  {/* Threshold markers */}
                  <div
                    className="absolute top-0 h-2 w-0.5 bg-yellow-600"
                    style={{ left: `${metric.threshold.warning}%` }}
                  />
                  <div
                    className="absolute top-0 h-2 w-0.5 bg-red-600"
                    style={{ left: `${metric.threshold.critical}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>Target: {metric.threshold.warning}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-center">
        <button className="text-sm text-primary-600 hover:text-primary-500">
          Configure metric thresholds →
        </button>
      </div>
    </div>
  );
}
