'use client';

import { useEffect, useState } from 'react';
import ControlsHeader from '@/components/controls/ControlsHeader';
import ControlsMatrix from '@/components/controls/ControlsMatrix';
import ControlsStats from '@/components/controls/ControlsStats';
import { ErrorBoundary, ErrorMessage } from '@/components/ui/ErrorBoundary';
import { CardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeletons';

function ControlsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-96"></div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Table skeleton */}
      <TableSkeleton rows={8} />
    </div>
  );
}

export default function ControlsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorMessage
          title="Failed to load controls"
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
        <ControlsSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ErrorBoundary>
        <ControlsHeader />
      </ErrorBoundary>

      {/* Controls Statistics */}
      <div className="mt-6">
        <ErrorBoundary>
          <ControlsStats />
        </ErrorBoundary>
      </div>

      {/* Controls Matrix */}
      <div className="mt-8">
        <ErrorBoundary
          fallback={
            <div className="bg-white rounded-lg shadow p-6">
              <ErrorMessage
                title="Failed to load controls matrix"
                message="The controls data could not be loaded. Please try refreshing the page."
              />
            </div>
          }
        >
          <ControlsMatrix />
        </ErrorBoundary>
      </div>
    </div>
  );
}
