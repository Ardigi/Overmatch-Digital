'use client';

import {
  CalendarDaysIcon,
  ClockIcon,
  EnvelopeIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface ScheduledReport {
  id: string;
  name: string;
  template: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  nextRun: string;
  recipients: number;
  lastRun?: string;
  status: 'active' | 'paused';
}

const scheduledReports: ScheduledReport[] = [
  {
    id: '1',
    name: 'Weekly Compliance Status',
    template: 'Executive Summary',
    frequency: 'weekly',
    nextRun: 'Monday, 9:00 AM',
    recipients: 5,
    lastRun: 'Jan 15, 2024',
    status: 'active',
  },
  {
    id: '2',
    name: 'Monthly Security Metrics',
    template: 'Security Dashboard',
    frequency: 'monthly',
    nextRun: 'Feb 1, 2024',
    recipients: 12,
    lastRun: 'Jan 1, 2024',
    status: 'active',
  },
  {
    id: '3',
    name: 'Quarterly SOC 2 Report',
    template: 'SOC 2 Type II Full',
    frequency: 'quarterly',
    nextRun: 'Apr 1, 2024',
    recipients: 3,
    lastRun: 'Jan 1, 2024',
    status: 'active',
  },
];

const frequencyColors = {
  daily: 'bg-blue-100 text-blue-700',
  weekly: 'bg-green-100 text-green-700',
  monthly: 'bg-yellow-100 text-yellow-700',
  quarterly: 'bg-purple-100 text-purple-700',
};

export default function ReportScheduler() {
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Scheduled Reports</h2>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <PlusIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {scheduledReports.map((report) => (
            <div
              key={report.id}
              className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">{report.name}</h3>
                <button
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    report.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {report.status}
                </button>
              </div>

              <p className="text-xs text-gray-600 mb-2">Template: {report.template}</p>

              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex items-center">
                  <CalendarDaysIcon className="h-3 w-3 mr-1" />
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${frequencyColors[report.frequency]}`}
                  >
                    {report.frequency}
                  </span>
                  <span className="ml-2">Next: {report.nextRun}</span>
                </div>

                <div className="flex items-center">
                  <UserGroupIcon className="h-3 w-3 mr-1" />
                  <span>{report.recipients} recipients</span>
                </div>

                {report.lastRun && (
                  <div className="flex items-center">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    <span>Last run: {report.lastRun}</span>
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center justify-end space-x-2">
                <button className="text-xs text-gray-600 hover:text-gray-900">Edit</button>
                <button className="text-xs text-gray-600 hover:text-gray-900">Pause</button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center">
              <CalendarDaysIcon className="h-4 w-4 mr-2 text-gray-400" />
              Schedule New Report
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center">
              <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
              Manage Recipients
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
