'use client';

import { Suspense, useEffect, useState } from 'react';
import ActiveThreads from '@/components/collaboration/ActiveThreads';
import CollaborationActivity from '@/components/collaboration/CollaborationActivity';
import CollaborationHeader from '@/components/collaboration/CollaborationHeader';
import SharedFiles from '@/components/collaboration/SharedFiles';
import TeamOverview from '@/components/collaboration/TeamOverview';
import { ErrorBoundary, ErrorMessage } from '@/components/ui/ErrorBoundary';
import { CardSkeleton, ListSkeleton } from '@/components/ui/LoadingSkeletons';

function CollaborationSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-96"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content skeleton */}
        <div className="lg:col-span-2 space-y-8">
          <CardSkeleton />
          <ListSkeleton items={3} />
          <CardSkeleton />
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-8">
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

function CollaborationContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  if (error) {
    return (
      <ErrorMessage
        title="Failed to load collaboration data"
        message={error}
        onRetry={() => {
          setError(null);
          setIsLoading(true);
          setTimeout(() => setIsLoading(false), 600);
        }}
      />
    );
  }

  if (isLoading) {
    return <CollaborationSkeleton />;
  }

  return (
    <div className="space-y-8">
      <CollaborationHeader />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-8">
          <ErrorBoundary>
            <TeamOverview />
          </ErrorBoundary>
          <ErrorBoundary>
            <ActiveThreads />
          </ErrorBoundary>
          <ErrorBoundary>
            <SharedFiles />
          </ErrorBoundary>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-8">
          <ErrorBoundary>
            <CollaborationActivity />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default function CollaborationPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ErrorBoundary>
        <CollaborationContent />
      </ErrorBoundary>
    </div>
  );
}
