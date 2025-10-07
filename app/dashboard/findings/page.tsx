'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  InformationCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useMemo, useState } from 'react';
import { ErrorBoundary, ErrorMessage } from '@/components/ui/ErrorBoundary';
import { CardSkeleton, ListSkeleton } from '@/components/ui/LoadingSkeletons';

// Mock data for findings
const findingsData = [
  {
    id: 'F-2024-001',
    title: 'Inadequate password complexity requirements',
    description: 'Current password policy allows 8 character passwords without special characters',
    severity: 'high',
    status: 'open',
    control: 'AC-2: Account Management',
    dateIdentified: '2024-11-15',
    dueDate: '2024-12-31',
    assignee: 'IT Security Team',
    remediationPlan: 'Update password policy to require 12+ characters with complexity',
  },
  {
    id: 'F-2024-002',
    title: 'Missing audit logs for privileged actions',
    description: 'Administrator actions in production environment are not being logged',
    severity: 'critical',
    status: 'in_progress',
    control: 'AU-2: Audit Events',
    dateIdentified: '2024-11-20',
    dueDate: '2024-12-15',
    assignee: 'DevOps Team',
    remediationPlan: 'Enable comprehensive logging for all privileged account activities',
  },
  {
    id: 'F-2024-003',
    title: 'Outdated incident response plan',
    description: 'IR plan last updated in 2022, missing cloud incident procedures',
    severity: 'medium',
    status: 'open',
    control: 'IR-1: Incident Response Policy',
    dateIdentified: '2024-12-01',
    dueDate: '2025-01-15',
    assignee: 'Security Team',
    remediationPlan: 'Update IR plan to include cloud-specific procedures and contacts',
  },
  {
    id: 'F-2024-004',
    title: 'Incomplete employee termination process',
    description: 'Access not consistently revoked within 24 hours of termination',
    severity: 'high',
    status: 'resolved',
    control: 'AC-2: Account Management',
    dateIdentified: '2024-10-10',
    dueDate: '2024-11-30',
    assignee: 'HR Team',
    remediationPlan: 'Implemented automated deprovisioning workflow',
    dateResolved: '2024-11-28',
  },
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'text-red-700 bg-red-100';
    case 'high':
      return 'text-orange-700 bg-orange-100';
    case 'medium':
      return 'text-yellow-700 bg-yellow-100';
    case 'low':
      return 'text-blue-700 bg-blue-100';
    default:
      return 'text-gray-700 bg-gray-100';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'resolved':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" aria-label="Resolved" />;
    case 'in_progress':
      return <ClockIcon className="h-5 w-5 text-blue-500" aria-label="In Progress" />;
    default:
      return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" aria-label="Open" />;
  }
};

const ITEMS_PER_PAGE = 5;

export default function FindingsPage() {
  const [findings, setFindings] = useState(findingsData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Filter findings based on status
  const filteredFindings = useMemo(() => {
    if (statusFilter === 'all') return findings;
    return findings.filter((finding) => finding.status === statusFilter);
  }, [findings, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredFindings.length / ITEMS_PER_PAGE);
  const paginatedFindings = filteredFindings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate summary stats
  const stats = useMemo(() => {
    const criticalHigh = findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    ).length;
    const mediumLow = findings.filter(
      (f) => f.severity === 'medium' || f.severity === 'low'
    ).length;
    const inProgress = findings.filter((f) => f.status === 'in_progress').length;
    const resolved = findings.filter((f) => f.status === 'resolved').length;

    return { criticalHigh, mediumLow, inProgress, resolved };
  }, [findings]);

  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorMessage
          title="Failed to load findings"
          message={error}
          onRetry={() => {
            setError(null);
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 800);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Findings</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">
          Track and remediate audit findings and control deficiencies
        </p>
      </div>

      {/* Findings Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                  </div>
                  <div className="ml-3 sm:ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                        Critical/High
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">{stats.criticalHigh}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                  </div>
                  <div className="ml-3 sm:ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                        Medium/Low
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">{stats.mediumLow}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                  <div className="ml-3 sm:ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                        In Progress
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">{stats.inProgress}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-4 sm:p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                  <div className="ml-3 sm:ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                        Resolved
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">{stats.resolved}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Findings List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-medium text-gray-900">
              {statusFilter === 'all'
                ? 'All Findings'
                : `${statusFilter.replace('_', ' ')} Findings`}
              <span className="ml-2 text-sm text-gray-500">({filteredFindings.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              {/* Mobile filter toggle */}
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="sm:hidden inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                aria-label="Toggle filters"
              >
                <FunnelIcon className="h-4 w-4" />
              </button>

              {/* Desktop filter */}
              <select
                className="hidden sm:block pl-3 pr-10 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md min-h-[44px]"
                value={statusFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>

              <button
                className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 min-h-[44px]"
                aria-label="Create new finding"
              >
                <PlusIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Finding</span>
              </button>
            </div>
          </div>

          {/* Mobile filter dropdown */}
          {showMobileFilters && (
            <div className="mt-4 sm:hidden">
              <select
                className="block w-full pl-3 pr-10 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md"
                value={statusFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          )}
        </div>

        {isLoading ? (
          <ListSkeleton items={3} />
        ) : filteredFindings.length === 0 ? (
          <div className="text-center py-12 px-4">
            <ExclamationCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No findings found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {statusFilter === 'all'
                ? 'Get started by creating a new finding.'
                : `No ${statusFilter.replace('_', ' ')} findings.`}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {paginatedFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="p-4 sm:p-6 hover:bg-gray-50 focus-within:bg-gray-50"
                  tabIndex={0}
                  role="article"
                  aria-label={`Finding ${finding.id}: ${finding.title}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                        {getStatusIcon(finding.status)}
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 break-words">
                          {finding.id}: {finding.title}
                        </h3>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(finding.severity)}`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{finding.description}</p>
                      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-500">Control:</span>
                          <p className="mt-1 text-gray-900 break-words">{finding.control}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Identified:</span>
                          <p className="mt-1 text-gray-900">
                            {new Date(finding.dateIdentified).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Due Date:</span>
                          <p className="mt-1 text-gray-900">
                            {new Date(finding.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Assignee:</span>
                          <p className="mt-1 text-gray-900 break-words">{finding.assignee}</p>
                        </div>
                      </div>
                      {finding.status === 'resolved' && finding.dateResolved && (
                        <div className="mt-3 text-sm text-green-600">
                          Resolved on {new Date(finding.dateResolved).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      className="ml-4 p-2 text-gray-400 hover:text-gray-500 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      aria-label={`More options for finding ${finding.id}`}
                    >
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
