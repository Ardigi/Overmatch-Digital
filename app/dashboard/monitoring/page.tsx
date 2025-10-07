'use client';

import { useEffect, useState } from 'react';
import AutomatedChecks from '@/components/monitoring/AutomatedChecks';
import ComplianceMetrics from '@/components/monitoring/ComplianceMetrics';
import IntegrationStatus from '@/components/monitoring/IntegrationStatus';
import MonitoringHeader from '@/components/monitoring/MonitoringHeader';
import RealTimeAlerts from '@/components/monitoring/RealTimeAlerts';
import { ErrorBoundary, ErrorMessage } from '@/components/ui/ErrorBoundary';
import { CardSkeleton } from '@/components/ui/LoadingSkeletons';

function MonitoringSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-96"></div>
      </div>

      {/* Integration Status skeleton */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>

      {/* Metrics Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Automated Checks skeleton */}
      <CardSkeleton />
    </div>
  );
}

export default function MonitoringPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Auto-refresh for real-time data
  useEffect(() => {
    if (!isLoading) {
      const refreshInterval = setInterval(() => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 500);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(refreshInterval);
    }
  }, [isLoading]);

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorMessage
          title="Failed to load monitoring data"
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

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <MonitoringSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <ErrorBoundary>
        <MonitoringHeader />
      </ErrorBoundary>

      {/* Integration Status Overview */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Integration Status</h2>
          {isRefreshing && (
            <span className="text-sm text-gray-500 animate-pulse">Refreshing...</span>
          )}
        </div>
        <ErrorBoundary
          fallback={
            <ErrorMessage
              title="Integration status unavailable"
              message="Unable to load integration status. Check your connections."
            />
          }
        >
          <IntegrationStatus />
        </ErrorBoundary>
      </div>

      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Compliance Metrics */}
        <div className="bg-white shadow rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Live Compliance Metrics</h2>
          <ErrorBoundary
            fallback={
              <ErrorMessage
                title="Metrics unavailable"
                message="Unable to load compliance metrics."
              />
            }
          >
            <ComplianceMetrics />
          </ErrorBoundary>
        </div>

        {/* Real-time Alerts */}
        <div className="bg-white shadow rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Real-time Alerts</h2>
          <ErrorBoundary
            fallback={
              <ErrorMessage title="Alerts unavailable" message="Unable to load real-time alerts." />
            }
          >
            <RealTimeAlerts />
          </ErrorBoundary>
        </div>
      </div>

      {/* Automated Compliance Checks */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Automated Compliance Checks</h2>
        <ErrorBoundary
          fallback={
            <ErrorMessage
              title="Automated checks unavailable"
              message="Unable to load automated compliance checks."
            />
          }
        >
          <AutomatedChecks />
        </ErrorBoundary>
      </div>
    </div>
  );
}
