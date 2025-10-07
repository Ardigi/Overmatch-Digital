'use client';

import {
  ChartBarIcon,
  ClockIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import ComplianceStatusChart from '@/components/dashboard/ComplianceStatusChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import UpcomingTasks from '@/components/dashboard/UpcomingTasks';
import {
  ChartSkeleton,
  DashboardStatsSkeleton,
  TableSkeleton,
} from '@/components/ui/LoadingSkeleton';
import { useDashboardStats } from '@/hooks/api/useDashboard';

interface DashboardContentProps {
  userName?: string | null;
  initialStats?: {
    activeProjects: number;
    pendingEvidence: number;
    openFindings: number;
    upcomingDeadlines: number;
  };
}

export default function DashboardContent({ userName, initialStats }: DashboardContentProps) {
  // Use API hook to fetch dashboard stats
  const { data: apiStats, loading: statsLoading } = useDashboardStats();

  // Use API data if available, otherwise fall back to initial stats
  const stats = apiStats ||
    initialStats || {
      activeProjects: 0,
      pendingEvidence: 0,
      openFindings: 0,
      upcomingDeadlines: 0,
    };

  const isLoading = statsLoading;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {userName || 'User'}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's an overview of your compliance status and activities.
        </p>
      </div>

      {/* Stats Grid with Loading State */}
      {isLoading ? (
        <DashboardStatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg transform transition-all hover:scale-105">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Projects</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.activeProjects}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg transform transition-all hover:scale-105">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DocumentCheckIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Evidence</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.pendingEvidence}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg transform transition-all hover:scale-105">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Open Findings</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.openFindings}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg transform transition-all hover:scale-105">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Upcoming Deadlines
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {stats.upcomingDeadlines}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Compliance Status Chart */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Compliance Status Overview</h2>
              <ComplianceStatusChart />
            </div>
          )}
        </div>

        {/* Upcoming Tasks */}
        <div className="lg:col-span-1">
          {isLoading ? (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
              <TableSkeleton rows={3} />
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upcoming Tasks</h2>
              <UpcomingTasks />
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
              <RecentActivity />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
