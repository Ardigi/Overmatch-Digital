'use client';

import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  PlayIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface AutomatedCheck {
  id: string;
  name: string;
  description: string;
  controlId: string;
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  lastRun?: Date;
  nextRun: Date;
  status: 'passing' | 'failing' | 'pending' | 'running';
  passRate: number;
  integrations: string[];
  enabled: boolean;
}

const automatedChecks: AutomatedCheck[] = [
  {
    id: '1',
    name: 'MFA Enforcement Check',
    description: 'Verify all privileged users have MFA enabled',
    controlId: 'CC6.1',
    frequency: 'hourly',
    lastRun: new Date(Date.now() - 30 * 60 * 1000),
    nextRun: new Date(Date.now() + 30 * 60 * 1000),
    status: 'failing',
    passRate: 87,
    integrations: ['Okta', 'Azure AD'],
    enabled: true,
  },
  {
    id: '2',
    name: 'Access Review Compliance',
    description: 'Check for completed quarterly access reviews',
    controlId: 'CC6.2',
    frequency: 'weekly',
    lastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'passing',
    passRate: 100,
    integrations: ['Okta', 'Jira'],
    enabled: true,
  },
  {
    id: '3',
    name: 'Password Policy Compliance',
    description: 'Validate password complexity and rotation requirements',
    controlId: 'CC6.3',
    frequency: 'daily',
    lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000),
    status: 'passing',
    passRate: 94,
    integrations: ['Okta', 'Azure AD'],
    enabled: true,
  },
  {
    id: '4',
    name: 'SSL Certificate Expiry',
    description: 'Monitor SSL certificates expiring within 30 days',
    controlId: 'CC6.7',
    frequency: 'daily',
    lastRun: new Date(Date.now() - 6 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 18 * 60 * 60 * 1000),
    status: 'passing',
    passRate: 100,
    integrations: ['AWS', 'Datadog'],
    enabled: true,
  },
  {
    id: '5',
    name: 'Backup Verification',
    description: 'Verify successful completion of automated backups',
    controlId: 'A1.2',
    frequency: 'daily',
    lastRun: new Date(Date.now() - 3 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 21 * 60 * 60 * 1000),
    status: 'passing',
    passRate: 99.9,
    integrations: ['AWS', 'Azure'],
    enabled: true,
  },
  {
    id: '6',
    name: 'Vulnerability Scan Results',
    description: 'Check for critical vulnerabilities in infrastructure',
    controlId: 'CC7.1',
    frequency: 'weekly',
    status: 'pending',
    nextRun: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    passRate: 78,
    integrations: ['Datadog', 'AWS'],
    enabled: false,
  },
];

const statusConfig = {
  passing: { icon: CheckCircleIcon, color: 'text-green-600', bgColor: 'bg-green-100' },
  failing: { icon: XCircleIcon, color: 'text-red-600', bgColor: 'bg-red-100' },
  pending: { icon: ClockIcon, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  running: { icon: ArrowPathIcon, color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

const frequencyLabels = {
  realtime: 'Real-time',
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function AutomatedChecks() {
  const [checks, setChecks] = useState(automatedChecks);
  const [runningChecks, setRunningChecks] = useState<string[]>([]);

  const handleRunCheck = async (checkId: string) => {
    setRunningChecks((prev) => [...prev, checkId]);
    setChecks((prev) =>
      prev.map((check) => (check.id === checkId ? { ...check, status: 'running' } : check))
    );

    // Simulate check execution
    await new Promise((resolve) => setTimeout(resolve, 3000));

    setChecks((prev) =>
      prev.map((check) => {
        if (check.id === checkId) {
          const passed = Math.random() > 0.2;
          return {
            ...check,
            status: passed ? 'passing' : 'failing',
            lastRun: new Date(),
            passRate: passed ? Math.min(100, check.passRate + 1) : Math.max(0, check.passRate - 5),
          };
        }
        return check;
      })
    );
    setRunningChecks((prev) => prev.filter((id) => id !== checkId));
  };

  const handleToggleCheck = (checkId: string) => {
    setChecks((prev) =>
      prev.map((check) => (check.id === checkId ? { ...check, enabled: !check.enabled } : check))
    );
  };

  return (
    <div>
      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500">Total Checks</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{checks.length}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-xs text-green-600">Passing</p>
          <p className="mt-1 text-2xl font-semibold text-green-900">
            {checks.filter((c) => c.status === 'passing').length}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-xs text-red-600">Failing</p>
          <p className="mt-1 text-2xl font-semibold text-red-900">
            {checks.filter((c) => c.status === 'failing').length}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-blue-600">Enabled</p>
          <p className="mt-1 text-2xl font-semibold text-blue-900">
            {checks.filter((c) => c.enabled).length}
          </p>
        </div>
      </div>

      {/* Checks Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Check
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Frequency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pass Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schedule
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {checks.map((check) => {
              const status = statusConfig[check.status];
              const StatusIcon = status.icon;

              return (
                <tr key={check.id} className={!check.enabled ? 'opacity-50' : ''}>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{check.name}</div>
                      <div className="text-xs text-gray-500">{check.description}</div>
                      <div className="mt-1 flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {check.controlId}
                        </span>
                        {check.integrations.map((integration) => (
                          <span key={integration} className="text-xs text-gray-500">
                            {integration}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}
                    >
                      <StatusIcon
                        className={`mr-1 h-3 w-3 ${check.status === 'running' ? 'animate-spin' : ''}`}
                      />
                      {check.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {frequencyLabels[check.frequency]}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 mr-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              check.passRate >= 95
                                ? 'bg-green-500'
                                : check.passRate >= 80
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${check.passRate}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-gray-900">{check.passRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {check.lastRun && <div>Last: {format(check.lastRun, 'MMM d, h:mm a')}</div>}
                    <div>Next: {format(check.nextRun, 'MMM d, h:mm a')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleRunCheck(check.id)}
                        disabled={!check.enabled || runningChecks.includes(check.id)}
                        className="text-primary-600 hover:text-primary-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PlayIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleToggleCheck(check.id)}
                        className={`${check.enabled ? 'text-gray-600' : 'text-gray-400'} hover:text-gray-900`}
                      >
                        <Cog6ToothIcon className="h-5 w-5" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <DocumentTextIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
