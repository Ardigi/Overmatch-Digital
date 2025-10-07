'use client';

import { useEffect, useState } from 'react';
import ReportMetrics from '@/components/reports/ReportMetrics';
import ReportScheduler from '@/components/reports/ReportScheduler';
import ReportsHeader from '@/components/reports/ReportsHeader';
import ReportsList from '@/components/reports/ReportsList';
import ReportTemplates from '@/components/reports/ReportTemplates';
import { ErrorBoundary, ErrorMessage } from '@/components/ui/ErrorBoundary';
import { CardSkeleton, ListSkeleton } from '@/components/ui/LoadingSkeletons';

function ReportsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-96"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content skeleton */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <ListSkeleton items={3} />
          </div>
          <CardSkeleton />
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-8">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorMessage
          title="Failed to load reports"
          message={error}
          onRetry={() => {
            setError(null);
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 700);
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ReportsSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <ErrorBoundary>
        <ReportsHeader />
      </ErrorBoundary>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6 lg:space-y-8">
          <ErrorBoundary
            fallback={
              <div className="bg-white rounded-lg shadow p-6">
                <ErrorMessage
                  title="Failed to load reports list"
                  message="Unable to display your reports. Please try refreshing."
                />
              </div>
            }
          >
            <ReportsList />
          </ErrorBoundary>

          <ErrorBoundary>
            <ReportTemplates />
          </ErrorBoundary>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:space-y-8">
          <ErrorBoundary>
            <ReportScheduler />
          </ErrorBoundary>

          <ErrorBoundary>
            <ReportMetrics />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
