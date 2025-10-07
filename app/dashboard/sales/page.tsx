'use client';

import {
  CalculatorIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import LeadsList from '@/components/sales/LeadsList';
import ROICalculator from '@/components/sales/ROICalculator';
import SalesActivities from '@/components/sales/SalesActivities';
import SalesHeader from '@/components/sales/SalesHeader';
import SalesPipeline from '@/components/sales/SalesPipeline';
import { ErrorBoundary, ErrorMessage } from '@/components/ui/ErrorBoundary';
import { CardSkeleton, TabSkeleton } from '@/components/ui/LoadingSkeletons';

type TabId = 'pipeline' | 'leads' | 'roi' | 'activities';

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pipeline');
  const [isLoading, setIsLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { id: 'pipeline' as const, name: 'Sales Pipeline', icon: ChartBarIcon },
    { id: 'leads' as const, name: 'Leads', icon: UserGroupIcon },
    { id: 'roi' as const, name: 'ROI Calculator', icon: CalculatorIcon },
    { id: 'activities' as const, name: 'Activities', icon: ClipboardDocumentListIcon },
  ];

  useEffect(() => {
    // Initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = (tabId: TabId) => {
    setTabLoading(true);
    setActiveTab(tabId);

    // Simulate loading for tab content
    setTimeout(() => {
      setTabLoading(false);
    }, 300);
  };

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorMessage
          title="Failed to load sales data"
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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-96"></div>
        </div>
        <TabSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <ErrorBoundary>
        <SalesHeader />
      </ErrorBoundary>

      <div className="bg-white shadow-sm rounded-lg">
        <div className="border-b border-gray-200">
          <nav
            className="flex gap-4 sm:gap-8 px-4 sm:px-6 overflow-x-auto"
            aria-label="Sales tabs"
            role="tablist"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-h-[48px]
                    ${
                      activeTab === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                    focus:outline-none focus:border-primary-600 focus:text-primary-600
                  `}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  aria-label={`View ${tab.name}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="hidden sm:inline">{tab.name}</span>
                  <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div
          className="p-4 sm:p-6"
          role="tabpanel"
          id={`${activeTab}-panel`}
          aria-label={`${tabs.find((t) => t.id === activeTab)?.name} content`}
        >
          {tabLoading ? (
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
            </div>
          ) : (
            <ErrorBoundary
              fallback={
                <ErrorMessage
                  title="Failed to load content"
                  message="Unable to display this section. Please try refreshing."
                />
              }
            >
              {activeTab === 'pipeline' && <SalesPipeline />}
              {activeTab === 'leads' && <LeadsList />}
              {activeTab === 'roi' && <ROICalculator />}
              {activeTab === 'activities' && <SalesActivities />}
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
