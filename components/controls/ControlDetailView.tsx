'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { Tab } from '@headlessui/react';
import {
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  PlayIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ArchiveBoxIcon,
  PlusIcon,
  DocumentArrowUpIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useControlDetail } from '@/hooks/useControlDetail';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import type { ControlDetailViewProps } from '@/types/control-detail.types';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const statusConfig = {
  IMPLEMENTED: {
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Implemented',
  },
  PARTIALLY_IMPLEMENTED: {
    icon: ExclamationTriangleIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Partially Implemented',
  },
  NOT_IMPLEMENTED: {
    icon: XCircleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Not Implemented',
  },
  NOT_APPLICABLE: {
    icon: ClockIcon,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Not Applicable',
  },
};

const effectivenessConfig = {
  EFFECTIVE: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Effective' },
  PARTIALLY_EFFECTIVE: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Partially Effective' },
  INEFFECTIVE: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Not Effective' },
  NOT_TESTED: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Not Tested' },
};

export default function ControlDetailView({ controlId, onEdit, onTest, onArchive }: ControlDetailViewProps) {
  const {
    control,
    tests,
    gaps,
    statistics,
    loading,
    isRefreshing,
    uploadingEvidence,
    deletingEvidence,
    error,
    selectedTab,
    setSelectedTab,
    refreshAll,
    uploadEvidence,
    deleteEvidence,
  } = useControlDetail(controlId);

  const [showUploadModal, setShowUploadModal] = useState(false);

  if (loading && !control) {
    return <ControlDetailSkeleton />;
  }

  if (error || !control) {
    return <ControlNotFound controlId={controlId} onRetry={refreshAll} />;
  }

  const status = statusConfig[control.status] || statusConfig.NOT_IMPLEMENTED;
  const effectiveness = control.effectiveness 
    ? effectivenessConfig[control.effectiveness] 
    : effectivenessConfig.NOT_TESTED;
  const StatusIcon = status.icon;

  const tabs = [
    { name: 'Overview', key: 'overview', count: null },
    { name: 'Testing', key: 'testing', count: tests?.length || 0 },
    { name: 'Evidence', key: 'evidence', count: control.evidence?.length || 0 },
    { name: 'Gaps', key: 'gaps', count: gaps?.length || 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            {/* Breadcrumb */}
            <nav className="flex mb-2" aria-label="Breadcrumb">
              <Link href="/controls" className="text-sm text-gray-500 hover:text-gray-700">
                Controls
              </Link>
              <ChevronRightIcon className="h-4 w-4 text-gray-400 mx-2 self-center" />
              <span className="text-sm text-gray-900 font-medium">{control.code}</span>
            </nav>

            {/* Title and Actions */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">
                    {control.name}
                  </h1>
                  <span className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-3 ml-4">
                <button
                  onClick={refreshAll}
                  disabled={isRefreshing}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <ArrowPathIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={onEdit}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </button>
                <button
                  onClick={onTest}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Test Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Tab.Group 
          selectedIndex={tabs.findIndex(tab => tab.key === selectedTab)}
          onChange={(index) => setSelectedTab(tabs[index].key as any)}
        >
          <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 p-1">
            {tabs.map((tab) => (
              <Tab
                key={tab.key}
                className={({ selected }) =>
                  classNames(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-primary-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-white text-primary-700 shadow'
                      : 'text-gray-600 hover:bg-white/[0.12] hover:text-gray-900'
                  )
                }
              >
                <span>{tab.name}</span>
                {tab.count !== null && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800">
                    {tab.count}
                  </span>
                )}
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels className="mt-6">
            {/* Overview Tab */}
            <Tab.Panel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Control Overview Card */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">Control Overview</h2>
                    </div>
                    <div className="px-6 py-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Control Code</dt>
                          <dd className="mt-1 text-sm text-gray-900">{control.code}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Category</dt>
                          <dd className="mt-1 text-sm text-gray-900">{control.category}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Type</dt>
                          <dd className="mt-1 text-sm text-gray-900">{control.type}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Framework</dt>
                          <dd className="mt-1 text-sm text-gray-900">{control.framework}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Testing Frequency</dt>
                          <dd className="mt-1 text-sm text-gray-900">{control.frequency}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Priority</dt>
                          <dd className="mt-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              control.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                              control.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                              control.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {control.priority || 'Not Set'}
                            </span>
                          </dd>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <dt className="text-sm font-medium text-gray-500 mb-2">Description</dt>
                        <dd className="text-sm text-gray-600 leading-relaxed">
                          {control.description}
                        </dd>
                      </div>
                    </div>
                  </div>

                  {/* Implementation Status */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">Implementation Status</h2>
                      {statistics && (
                        <div className="flex items-center">
                          <div className="w-32 bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-primary-600 h-2.5 rounded-full" 
                              style={{ width: `${statistics.passRate}%` }}
                            ></div>
                          </div>
                          <span className="ml-3 text-sm text-gray-600">{Math.round(statistics.passRate)}%</span>
                        </div>
                      )}
                    </div>
                    <div className="px-6 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-green-50 p-4 rounded-lg">
                          <dt className="text-sm font-medium text-green-900">Effectiveness Score</dt>
                          <dd className="mt-2 flex items-baseline">
                            <span className="text-2xl font-semibold text-green-600">
                              {control.testing?.testCoverage || 0}%
                            </span>
                          </dd>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <dt className="text-sm font-medium text-blue-900">Last Tested</dt>
                          <dd className="mt-2 text-sm text-blue-600">
                            {control.testing?.lastTested 
                              ? new Date(control.testing.lastTested).toLocaleDateString()
                              : 'Never'}
                          </dd>
                          {control.testing?.nextTestDate && (
                            <dd className="text-xs text-blue-500">
                              Next: {new Date(control.testing.nextTestDate).toLocaleDateString()}
                            </dd>
                          )}
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <dt className="text-sm font-medium text-gray-900">Risk Rating</dt>
                          <dd className="mt-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${effectiveness.bgColor} ${effectiveness.color}`}>
                              {effectiveness.label}
                            </span>
                          </dd>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar (1/3 width) */}
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-base font-semibold text-gray-900">Quick Actions</h3>
                    </div>
                    <div className="px-6 py-4 space-y-3">
                      <button
                        onClick={onTest}
                        className="w-full flex items-center justify-between px-4 py-3 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <div className="flex items-center">
                          <PlayIcon className="h-5 w-5 text-primary-600 mr-3" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900">Run Test</p>
                            <p className="text-xs text-gray-500">Execute control test</p>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center">
                          <DocumentArrowUpIcon className="h-5 w-5 text-gray-600 mr-3" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900">Upload Evidence</p>
                            <p className="text-xs text-gray-500">Add documentation</p>
                          </div>
                        </div>
                      </button>
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
                      >
                        <div className="flex items-center">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-3" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900">Report Issue</p>
                            <p className="text-xs text-gray-500">Flag control gap</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Gap Analysis Summary */}
                  {gaps && gaps.length > 0 && (
                    <div className="bg-white shadow rounded-lg">
                      <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-base font-semibold text-gray-900">Gap Analysis</h3>
                      </div>
                      <div className="px-6 py-4">
                        <div className="space-y-3">
                          {gaps.slice(0, 3).map((gap) => (
                            <div key={gap.id} className="flex items-start">
                              <div className={`flex-shrink-0 h-2 w-2 rounded-full mt-1.5 ${
                                gap.severity === 'CRITICAL' ? 'bg-red-500' :
                                gap.severity === 'HIGH' ? 'bg-orange-500' :
                                gap.severity === 'MEDIUM' ? 'bg-yellow-500' :
                                'bg-gray-500'
                              }`} />
                              <div className="ml-3 flex-1 min-w-0">
                                <p className="text-sm text-gray-900 truncate">{gap.description}</p>
                                <p className="text-xs text-gray-500">
                                  {gap.status} • {new Date(gap.identifiedDate).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                          {gaps.length > 3 && (
                            <button className="text-sm text-primary-600 hover:text-primary-700">
                              View all {gaps.length} gaps →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Related Controls */}
                  {control.relatedControls && control.relatedControls.length > 0 && (
                    <div className="bg-white shadow rounded-lg">
                      <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-base font-semibold text-gray-900">Related Controls</h3>
                      </div>
                      <div className="px-6 py-4">
                        <ul className="space-y-2">
                          {control.relatedControls.map((related) => (
                            <li key={related.id}>
                              <Link
                                href={`/controls/${related.id}`}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                {related.code} - {related.name}
                              </Link>
                              <span className="text-xs text-gray-500 ml-2">
                                ({related.relationship.replace(/_/g, ' ').toLowerCase()})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Tab.Panel>

            {/* Testing Tab */}
            <Tab.Panel>
              <TestingHistoryTab tests={tests} onNewTest={onTest} />
            </Tab.Panel>

            {/* Evidence Tab */}
            <Tab.Panel>
              <EvidenceTab 
                evidence={control.evidence} 
                onUpload={uploadEvidence}
                onDelete={deleteEvidence}
                uploading={uploadingEvidence}
                deleting={deletingEvidence}
              />
            </Tab.Panel>

            {/* Gaps Tab */}
            <Tab.Panel>
              <GapsTab gaps={gaps} controlId={controlId} />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
}

// Component implementations would continue here...
function ControlDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white shadow rounded-lg h-64"></div>
            <div className="bg-white shadow rounded-lg h-48"></div>
          </div>
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg h-48"></div>
            <div className="bg-white shadow rounded-lg h-32"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlNotFound({ controlId, onRetry }: { controlId: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Control not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Unable to load control with ID: {controlId}
        </p>
        <div className="mt-4">
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

// Additional tab components would be implemented here
function TestingHistoryTab({ tests, onNewTest }: any) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Testing History</h2>
        <button
          onClick={onNewTest}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          New Test
        </button>
      </div>
      <div className="px-6 py-4">
        {tests && tests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tester
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tests.map((test: any) => (
                  <tr key={test.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(test.testDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {test.tester?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        test.result === 'PASS' ? 'bg-green-100 text-green-800' :
                        test.result === 'FAIL' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {test.result}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {test.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No tests recorded yet.</p>
        )}
      </div>
    </div>
  );
}

function EvidenceTab({ evidence, onUpload, onDelete, uploading, deleting }: any) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Evidence Documentation</h2>
      </div>
      <div className="px-6 py-4">
        {evidence && evidence.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {evidence.map((item: any) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                <DocumentTextIcon className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-900">{item.fileName || item.type}</p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No evidence uploaded yet.</p>
        )}
      </div>
    </div>
  );
}

function GapsTab({ gaps, controlId }: any) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Gap Analysis</h2>
      </div>
      <div className="px-6 py-4">
        {gaps && gaps.length > 0 ? (
          <div className="space-y-4">
            {gaps.map((gap: any) => (
              <div key={gap.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{gap.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Identified: {new Date(gap.identifiedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    gap.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                    gap.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    gap.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {gap.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No gaps identified.</p>
        )}
      </div>
    </div>
  );
}