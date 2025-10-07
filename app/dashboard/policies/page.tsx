'use client';

import {
  CheckBadgeIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import PolicyApprovals from '@/components/policies/PolicyApprovals';
import PolicyEditor from '@/components/policies/PolicyEditor';
import PolicyList from '@/components/policies/PolicyList';
import PolicyTemplates from '@/components/policies/PolicyTemplates';
import { ErrorBoundary, ErrorMessage } from '@/components/ui/ErrorBoundary';
import { CardSkeleton, TabSkeleton } from '@/components/ui/LoadingSkeletons';

type TabId = 'policies' | 'templates' | 'approvals' | 'history';

export default function PoliciesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('policies');
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { id: 'policies' as const, name: 'Active Policies', icon: DocumentTextIcon },
    { id: 'templates' as const, name: 'Templates', icon: DocumentDuplicateIcon },
    { id: 'approvals' as const, name: 'Approvals', icon: CheckBadgeIcon },
    { id: 'history' as const, name: 'Revision History', icon: ClockIcon },
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
    setSelectedPolicy(null); // Clear selection when changing tabs

    // Simulate loading for tab content
    setTimeout(() => {
      setTabLoading(false);
    }, 300);
  };

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorMessage
          title="Failed to load policies"
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Policy Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Manage security policies, procedures, and compliance documentation
          </p>
        </div>
        <button
          className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 min-h-[44px]"
          aria-label="Create new policy"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          <span className="hidden sm:inline">Create Policy</span>
          <span className="sm:hidden">Create</span>
        </button>
      </div>

      <div className="border-b border-gray-200">
        <nav
          className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto"
          role="tablist"
          aria-label="Policy tabs"
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
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          className={selectedPolicy ? 'lg:col-span-4' : 'lg:col-span-12'}
          role="tabpanel"
          id={`${activeTab}-panel`}
          aria-label={`${tabs.find((t) => t.id === activeTab)?.name} content`}
        >
          {tabLoading ? (
            <CardSkeleton />
          ) : (
            <ErrorBoundary>
              {activeTab === 'policies' && (
                <PolicyList onSelectPolicy={setSelectedPolicy} selectedPolicy={selectedPolicy} />
              )}
              {activeTab === 'templates' && <PolicyTemplates />}
              {activeTab === 'approvals' && <PolicyApprovals />}
              {activeTab === 'history' && (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
                  <p className="text-gray-600">
                    Revision history will allow you to track all changes to your policies
                  </p>
                </div>
              )}
            </ErrorBoundary>
          )}
        </div>

        {selectedPolicy && activeTab === 'policies' && !tabLoading && (
          <div className="lg:col-span-8">
            <ErrorBoundary>
              <PolicyEditor policyId={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  );
}
