'use client';

import {
  ArrowPathIcon,
  BeakerIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useControlMatrix, useControls } from '@/hooks/api/useControls';
import type { Control } from '@/lib/api/controls';

// Mock data for development fallback
const mockControlCategories = [
  {
    id: 'cc',
    name: 'Common Criteria (CC)',
    controls: [
      {
        id: 'cc1.1',
        code: 'CC1.1',
        title: 'Control Environment',
        description: 'The entity demonstrates a commitment to integrity and ethical values.',
        status: 'IMPLEMENTED',
        effectiveness: 'EFFECTIVE',
        evidenceCount: 5,
        lastTested: '2024-01-15',
        frameworks: ['SOC2_SECURITY'],
      },
      {
        id: 'cc1.2',
        code: 'CC1.2',
        title: 'Board Independence and Oversight',
        description:
          'The board of directors demonstrates independence from management and exercises oversight.',
        status: 'IMPLEMENTED',
        effectiveness: 'EFFECTIVE',
        evidenceCount: 3,
        lastTested: '2024-01-20',
        frameworks: ['SOC2_SECURITY'],
      },
    ],
  },
  {
    id: 'cc6',
    name: 'Logical and Physical Access Controls',
    controls: [
      {
        id: 'cc6.1',
        code: 'CC6.1',
        title: 'Logical Access Controls',
        description:
          'The entity implements logical access security software, infrastructure, and architectures.',
        status: 'IMPLEMENTED',
        effectiveness: 'EFFECTIVE',
        evidenceCount: 8,
        lastTested: '2024-02-01',
        frameworks: ['SOC2_SECURITY', 'SOC2_CONFIDENTIALITY'],
      },
      {
        id: 'cc6.2',
        code: 'CC6.2',
        title: 'User Authentication',
        description:
          'The entity authenticates users through unique usernames and passwords or other forms.',
        status: 'PARTIALLY_IMPLEMENTED',
        effectiveness: 'PARTIALLY_EFFECTIVE',
        evidenceCount: 4,
        lastTested: '2024-02-05',
        frameworks: ['SOC2_SECURITY'],
      },
      {
        id: 'cc6.3',
        code: 'CC6.3',
        title: 'Physical Access Controls',
        description:
          'The entity restricts physical access to facilities and protected information assets.',
        status: 'IMPLEMENTED',
        effectiveness: 'EFFECTIVE',
        evidenceCount: 6,
        lastTested: '2024-01-25',
        frameworks: ['SOC2_SECURITY', 'SOC2_AVAILABILITY'],
      },
    ],
  },
  {
    id: 'cc7',
    name: 'System Operations',
    controls: [
      {
        id: 'cc7.1',
        code: 'CC7.1',
        title: 'Vulnerability Management',
        description: 'The entity identifies, evaluates, and manages vulnerabilities.',
        status: 'IMPLEMENTED',
        effectiveness: 'EFFECTIVE',
        evidenceCount: 7,
        lastTested: '2024-02-10',
        frameworks: ['SOC2_SECURITY', 'SOC2_AVAILABILITY'],
      },
      {
        id: 'cc7.2',
        code: 'CC7.2',
        title: 'System Monitoring',
        description: 'The entity monitors system performance and capacity.',
        status: 'NOT_IMPLEMENTED',
        effectiveness: 'NOT_TESTED',
        evidenceCount: 0,
        lastTested: null,
        frameworks: ['SOC2_AVAILABILITY'],
      },
    ],
  },
];

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
    label: 'Partial',
  },
  NOT_IMPLEMENTED: {
    icon: XCircleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Not Implemented',
  },
  NOT_APPLICABLE: {
    icon: XCircleIcon,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'N/A',
  },
};

const effectivenessConfig = {
  EFFECTIVE: { color: 'text-green-600', label: 'Effective' },
  PARTIALLY_EFFECTIVE: { color: 'text-yellow-600', label: 'Partially Effective' },
  NOT_EFFECTIVE: { color: 'text-red-600', label: 'Not Effective' },
  NOT_TESTED: { color: 'text-gray-600', label: 'Not Tested' },
};

const ITEMS_PER_PAGE = 5;

// Helper function to get category name from code
const getCategoryName = (code: string): string => {
  const categoryNames: Record<string, string> = {
    CC: 'Common Criteria',
    CC1: 'Control Environment',
    CC2: 'Communication and Information',
    CC3: 'Risk Assessment',
    CC4: 'Monitoring Activities',
    CC5: 'Control Activities',
    CC6: 'Logical and Physical Access Controls',
    CC7: 'System Operations',
    CC8: 'Change Management',
    CC9: 'Risk Mitigation',
    A: 'Availability',
    C: 'Confidentiality',
    P: 'Privacy',
    PI: 'Processing Integrity',
  };

  return categoryNames[code] || code;
};

export default function ControlsMatrix() {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['cc6']);
  const [selectedFramework, setSelectedFramework] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Fetch controls from API
  const {
    data: controlsData,
    loading,
    execute: refreshControls,
  } = useControls({
    search: debouncedSearch,
    framework: selectedFramework,
    page: currentPage,
    pageSize: viewMode === 'flat' ? ITEMS_PER_PAGE : 100,
  });

  const { data: matrixData, loading: matrixLoading } = useControlMatrix(selectedFramework);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  // Process controls data
  const { filteredControls, filteredCategories } = useMemo(() => {
    // Use API data if available, otherwise fall back to mock data
    const rawControls = controlsData?.data || [];
    const controlCategories = matrixData?.categories || mockControlCategories;

    // Group controls by category if using API data
    if (rawControls.length > 0 && !matrixData) {
      // Create categories from flat control list
      const categoryMap = new Map<string, any>();

      rawControls.forEach((control: Control) => {
        const categoryCode = control.code.split('.')[0].toUpperCase();
        if (!categoryMap.has(categoryCode)) {
          categoryMap.set(categoryCode, {
            id: categoryCode.toLowerCase(),
            name: getCategoryName(categoryCode),
            controls: [],
          });
        }

        categoryMap.get(categoryCode)!.controls.push({
          id: control.id,
          code: control.code,
          title: control.name,
          description: control.description || '',
          status: control.status.toUpperCase().replace('_', '_'),
          effectiveness: control.effectiveness?.toUpperCase().replace('_', '_') || 'NOT_TESTED',
          evidenceCount: control.metadata?.evidenceCount || 0,
          lastTested: control.testing?.lastTested || null,
          frameworks: [control.framework.toUpperCase()],
        });
      });

      return {
        filteredControls: rawControls,
        filteredCategories: Array.from(categoryMap.values()),
      };
    }

    // Use existing logic for mock data
    const allControls: any[] = [];
    const categories = controlCategories
      .map((category) => {
        const controls = category.controls.filter((control) => {
          const matchesSearch = true; // Search is handled by API
          const matchesFramework =
            selectedFramework === undefined || control.frameworks.includes(selectedFramework);

          return matchesSearch && matchesFramework;
        });

        controls.forEach((control) => {
          allControls.push({ ...control, categoryId: category.id, categoryName: category.name });
        });

        return { ...category, controls };
      })
      .filter((category) => category.controls.length > 0);

    return { filteredControls: allControls, filteredCategories: categories };
  }, [searchTerm, selectedFramework]);

  // Pagination for flat view
  const totalPages = Math.ceil(filteredControls.length / ITEMS_PER_PAGE);
  const paginatedControls = filteredControls.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFrameworkChange = (value: string) => {
    setSelectedFramework(value);
    setCurrentPage(1);
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Controls Matrix</h2>

        {/* Filters and View Toggle */}
        <div className="mt-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search controls..."
                  className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 min-h-[44px] w-full sm:w-64"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  aria-label="Search controls"
                />
              </div>

              {/* Framework Filter */}
              <select
                className="px-4 py-2.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
                value={selectedFramework}
                onChange={(e) => handleFrameworkChange(e.target.value)}
                aria-label="Filter by framework"
              >
                <option value="ALL">All Frameworks</option>
                <option value="SOC2_SECURITY">SOC 2 - Security</option>
                <option value="SOC2_AVAILABILITY">SOC 2 - Availability</option>
                <option value="SOC2_CONFIDENTIALITY">SOC 2 - Confidentiality</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setViewMode('grouped')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-l-md border ${
                    viewMode === 'grouped'
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  } focus:z-10 focus:ring-2 focus:ring-primary-500`}
                  aria-label="Grouped view"
                >
                  Grouped
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('flat')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-r-md border-t border-r border-b ${
                    viewMode === 'flat'
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  } focus:z-10 focus:ring-2 focus:ring-primary-500`}
                  aria-label="Flat view"
                >
                  Flat List
                </button>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-500">
              {viewMode === 'flat' ? (
                <span>
                  Showing {paginatedControls.length} of {filteredControls.length} controls
                </span>
              ) : (
                <span>
                  {filteredControls.length} controls in {filteredCategories.length} categories
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls Display */}
      <div className="overflow-x-auto">
        {filteredControls.length === 0 ? (
          <div className="text-center py-12 px-4">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No controls found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : viewMode === 'flat' ? (
          /* Flat View with Pagination */
          <>
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Control
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Effectiveness
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Evidence
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedControls.map((control) => {
                  const status = statusConfig[control.status];
                  const effectiveness = effectivenessConfig[control.effectiveness];
                  const StatusIcon = status.icon;

                  return (
                    <tr key={control.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-start">
                          <StatusIcon className={`h-5 w-5 ${status.color} mr-3 mt-0.5`} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{control.code}</div>
                            <div className="text-sm text-gray-900">{control.title}</div>
                            <div className="text-xs text-gray-500 mt-1 max-w-md">
                              {control.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {control.categoryName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${effectiveness.color}`}>
                          {effectiveness.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <DocumentTextIcon className="h-4 w-4 text-gray-400 mr-1" />
                          {control.evidenceCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            className="text-primary-600 hover:text-primary-900 px-3 py-1.5 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            aria-label={`Edit control ${control.code}`}
                          >
                            Edit
                          </button>
                          <button
                            className="text-primary-600 hover:text-primary-900 inline-flex items-center px-3 py-1.5 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            aria-label={`Test control ${control.code}`}
                          >
                            <BeakerIcon className="h-4 w-4 mr-1" aria-hidden="true" />
                            Test
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

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
                    <ChevronLeftIcon className="h-5 w-5 mr-1" />
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
                    <ChevronRightIcon className="h-5 w-5 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Grouped View */
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Control
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Effectiveness
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Evidence
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Last Tested
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCategories.map((category) => (
                <Fragment key={category.id}>
                  {/* Category Header */}
                  <tr
                    className="bg-gray-50 hover:bg-gray-100 cursor-pointer focus-within:bg-gray-100"
                    onClick={() => toggleCategory(category.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCategory(category.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={expandedCategories.includes(category.id)}
                    aria-label={`Toggle ${category.name} category`}
                  >
                    <td colSpan={6} className="px-6 py-4">
                      <div className="flex items-center">
                        {expandedCategories.includes(category.id) ? (
                          <ChevronDownIcon className="h-5 w-5 text-gray-400 mr-2" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5 text-gray-400 mr-2" />
                        )}
                        <span className="text-sm font-medium text-gray-900">{category.name}</span>
                        <span className="ml-2 text-sm text-gray-500">
                          ({category.controls.length} controls)
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Category Controls */}
                  {expandedCategories.includes(category.id) &&
                    category.controls.map((control) => {
                      const status = statusConfig[control.status];
                      const effectiveness = effectivenessConfig[control.effectiveness];
                      const StatusIcon = status.icon;

                      return (
                        <tr key={control.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                <span
                                  className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${status.bgColor} ${status.color}`}
                                >
                                  <StatusIcon className="h-5 w-5" />
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {control.code}
                                </div>
                                <div className="text-sm text-gray-900">{control.title}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {control.description}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {control.frameworks.map((framework) => (
                                    <span
                                      key={framework}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
                                    >
                                      {framework.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm ${effectiveness.color}`}>
                              {effectiveness.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-900">
                              <DocumentTextIcon className="h-4 w-4 text-gray-400 mr-1" />
                              {control.evidenceCount}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {control.lastTested || 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                className="text-primary-600 hover:text-primary-900 px-3 py-1.5 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                aria-label={`Edit control ${control.code}`}
                              >
                                Edit
                              </button>
                              <button
                                className="text-primary-600 hover:text-primary-900 inline-flex items-center px-3 py-1.5 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                aria-label={`Test control ${control.code}`}
                              >
                                <BeakerIcon className="h-4 w-4 mr-1" aria-hidden="true" />
                                Test
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
