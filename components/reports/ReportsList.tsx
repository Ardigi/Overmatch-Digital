'use client';

import {
  ArrowDownTrayIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentIcon,
  EyeIcon,
  ShareIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Report {
  id: string;
  name: string;
  type: 'soc1' | 'soc2' | 'compliance' | 'security' | 'custom';
  description: string;
  generatedAt: string;
  generatedBy: string;
  period: string;
  status: 'completed' | 'generating' | 'failed' | 'scheduled';
  format: 'pdf' | 'excel' | 'word';
  size?: string;
  tags: string[];
  shareCount: number;
}

const reports: Report[] = [
  {
    id: '1',
    name: 'SOC 2 Type II Report - Q4 2023',
    type: 'soc2',
    description:
      'Comprehensive SOC 2 Type II compliance report covering all Trust Services Criteria',
    generatedAt: '2024-01-15 09:30 AM',
    generatedBy: 'Sarah Johnson',
    period: 'Oct 1, 2023 - Dec 31, 2023',
    status: 'completed',
    format: 'pdf',
    size: '12.5 MB',
    tags: ['soc2', 'type-ii', 'quarterly', 'final'],
    shareCount: 5,
  },
  {
    id: '2',
    name: 'Monthly Security Metrics Dashboard',
    type: 'security',
    description:
      'Key security metrics including vulnerability trends, incident response times, and control effectiveness',
    generatedAt: '2024-01-10 02:15 PM',
    generatedBy: 'System Automated',
    period: 'December 2023',
    status: 'completed',
    format: 'excel',
    size: '3.2 MB',
    tags: ['security', 'metrics', 'monthly'],
    shareCount: 12,
  },
  {
    id: '3',
    name: 'Access Control Compliance Report',
    type: 'compliance',
    description: 'Detailed analysis of access control implementation and user privilege management',
    generatedAt: '2024-01-18 11:00 AM',
    generatedBy: 'Emily Rodriguez',
    period: 'January 2024',
    status: 'generating',
    format: 'pdf',
    tags: ['access-control', 'compliance', 'ac-controls'],
    shareCount: 0,
  },
  {
    id: '4',
    name: 'Executive Summary - SOC 1 Report',
    type: 'soc1',
    description: 'High-level summary of SOC 1 findings and management response',
    generatedAt: '2024-01-05 04:45 PM',
    generatedBy: 'Michael Chen',
    period: 'Year 2023',
    status: 'completed',
    format: 'word',
    size: '856 KB',
    tags: ['soc1', 'executive', 'annual'],
    shareCount: 8,
  },
  {
    id: '5',
    name: 'Weekly Compliance Status Update',
    type: 'custom',
    description: 'Custom report tracking compliance project progress and open items',
    generatedAt: 'Scheduled',
    generatedBy: 'System Automated',
    period: 'Weekly',
    status: 'scheduled',
    format: 'pdf',
    tags: ['weekly', 'status', 'automated'],
    shareCount: 0,
  },
];

const reportTypeConfig = {
  soc1: { icon: DocumentIcon, color: 'bg-blue-100 text-blue-700' },
  soc2: { icon: DocumentIcon, color: 'bg-purple-100 text-purple-700' },
  compliance: { icon: ChartBarIcon, color: 'bg-green-100 text-green-700' },
  security: { icon: ChartBarIcon, color: 'bg-red-100 text-red-700' },
  custom: { icon: DocumentIcon, color: 'bg-gray-100 text-gray-700' },
};

const statusConfig = {
  completed: { icon: CheckCircleIcon, color: 'text-green-600', text: 'Completed' },
  generating: { icon: ClockIcon, color: 'text-yellow-600', text: 'Generating...' },
  failed: { icon: XCircleIcon, color: 'text-red-600', text: 'Failed' },
  scheduled: { icon: CalendarIcon, color: 'text-blue-600', text: 'Scheduled' },
};

export default function ReportsList() {
  const router = useRouter();
  const [filter, setFilter] = useState<
    'all' | 'soc1' | 'soc2' | 'compliance' | 'security' | 'custom'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReports = reports.filter((report) => {
    const matchesFilter = filter === 'all' || report.type === filter;
    const matchesSearch =
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleDownload = (report: Report) => {
    // Handle report download
    console.log('Downloading report:', report.name);
  };

  const handleView = (report: Report) => {
    // Handle report viewing
    console.log('Viewing report:', report.name);
  };

  const handleShare = (report: Report) => {
    // Handle report sharing
    console.log('Sharing report:', report.name);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Generated Reports</h2>
          <button
            onClick={() => router.push('/dashboard/reports/builder')}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Generate New Report
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />

          <div className="flex space-x-2">
            {['all', 'soc1', 'soc2', 'compliance', 'security', 'custom'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type as typeof filter)}
                className={`px-3 py-2 rounded-md text-sm font-medium capitalize ${
                  filter === type
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {type === 'all' ? 'All Reports' : type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {filteredReports.map((report) => {
          const typeConfig = reportTypeConfig[report.type];
          const status = statusConfig[report.status];
          const Icon = typeConfig.icon;
          const StatusIcon = status.icon;

          return (
            <div key={report.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{report.name}</h3>
                    <p className="mt-1 text-sm text-gray-600">{report.description}</p>

                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {report.period}
                      </span>
                      <span>
                        Generated {report.generatedAt} by {report.generatedBy}
                      </span>
                      {report.size && <span>{report.size}</span>}
                    </div>

                    <div className="mt-2 flex items-center space-x-2">
                      {report.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <div className={`flex items-center ${status.color}`}>
                    <StatusIcon className="h-5 w-5" />
                    <span className="ml-1 text-sm">{status.text}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {report.status === 'completed' && (
                <div className="mt-4 flex items-center justify-between pl-11">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleView(report)}
                      className="inline-flex items-center text-sm text-gray-700 hover:text-gray-900"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => handleDownload(report)}
                      className="inline-flex items-center text-sm text-gray-700 hover:text-gray-900"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Download
                    </button>
                    <button
                      onClick={() => handleShare(report)}
                      className="inline-flex items-center text-sm text-gray-700 hover:text-gray-900"
                    >
                      <ShareIcon className="h-4 w-4 mr-1" />
                      Share
                    </button>
                  </div>
                  {report.shareCount > 0 && (
                    <span className="text-xs text-gray-500">
                      Shared with {report.shareCount}{' '}
                      {report.shareCount === 1 ? 'person' : 'people'}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="px-6 py-12 text-center">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No reports match your search criteria</p>
        </div>
      )}
    </div>
  );
}
