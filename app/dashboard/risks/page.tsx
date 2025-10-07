'use client';

import {
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import RiskAssessment from '@/components/risks/RiskAssessment';
import RiskMatrix from '@/components/risks/RiskMatrix';
import RiskRegister from '@/components/risks/RiskRegister';
import RiskTreatment from '@/components/risks/RiskTreatment';
import { ErrorBoundary, ErrorMessage } from '@/components/ui/ErrorBoundary';
import { TabSkeleton } from '@/components/ui/LoadingSkeletons';

type TabId = 'matrix' | 'register' | 'assessment' | 'treatment';

export default function RisksPage() {
  const [activeTab, setActiveTab] = useState<TabId>('matrix');
  const [isLoading, setIsLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { id: 'matrix' as const, name: 'Risk Matrix', icon: ChartBarIcon },
    { id: 'register' as const, name: 'Risk Register', icon: ExclamationTriangleIcon },
    { id: 'assessment' as const, name: 'Assessment', icon: ClipboardDocumentCheckIcon },
    { id: 'treatment' as const, name: 'Treatment Plans', icon: ShieldCheckIcon },
  ];

  useEffect(() => {
    // Initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);

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
          title="Failed to load risk management data"
          message={error}
          onRetry={() => {
            setError(null);
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 600);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Risk Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Identify, assess, and manage organizational risks for SOC compliance
          </p>
        </div>
        <button
          className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 min-h-[44px]"
          aria-label="Create new risk assessment"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          <span className="hidden sm:inline">New Risk Assessment</span>
          <span className="sm:hidden">New Assessment</span>
        </button>
      </div>

      <div className="border-b border-gray-200">
        <nav
          className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto"
          role="tablist"
          aria-label="Risk management tabs"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap min-h-[48px]
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  focus:outline-none focus:border-primary-500 focus:text-primary-600
                `}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                aria-label={`View ${tab.name}`}
              >
                <Icon
                  className={`mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-primary-500' : 'text-gray-400'}`}
                  aria-hidden="true"
                />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div
        role="tabpanel"
        id={`${activeTab}-panel`}
        aria-label={`${tabs.find((t) => t.id === activeTab)?.name} content`}
      >
        {tabLoading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-64 bg-gray-100 rounded"></div>
            </div>
          </div>
        ) : (
          <ErrorBoundary>
            {activeTab === 'matrix' && <RiskMatrix />}
            {activeTab === 'register' && <RiskRegister />}
            {activeTab === 'assessment' && <RiskAssessment />}
            {activeTab === 'treatment' && <RiskTreatment />}
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
