'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useControls } from '@/hooks/useControls';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface ControlsListProps {
  frameworkId?: string;
  categoryId?: string;
  onControlSelect?: (controlId: string) => void;
}

const statusOptions = [
  { value: 'ACTIVE', label: 'Active', icon: CheckCircleIcon, color: 'text-green-600' },
  { value: 'DRAFT', label: 'Draft', icon: DocumentTextIcon, color: 'text-gray-600' },
  { value: 'UNDER_REVIEW', label: 'Under Review', icon: ClockIcon, color: 'text-yellow-600' },
  { value: 'DEPRECATED', label: 'Deprecated', icon: XCircleIcon, color: 'text-red-600' },
];

const effectivenessOptions = [
  { value: 'EFFECTIVE', label: 'Effective', color: 'bg-green-100 text-green-800' },
  { value: 'PARTIALLY_EFFECTIVE', label: 'Partially Effective', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'INEFFECTIVE', label: 'Ineffective', color: 'bg-red-100 text-red-800' },
  { value: 'NOT_TESTED', label: 'Not Tested', color: 'bg-gray-100 text-gray-800' },
];

const sortOptions = [
  { value: 'controlId', label: 'Control ID' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'effectiveness', label: 'Effectiveness' },
  { value: 'lastTested', label: 'Last Tested' },
  { value: 'nextReview', label: 'Next Review' },
];

export default function ControlsList({ 
  frameworkId, 
  categoryId, 
  onControlSelect 
}: ControlsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [selectedEffectiveness, setSelectedEffectiveness] = useState(searchParams.get('effectiveness') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'controlId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
  );
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('pageSize') || '20'));
  
  // Fetch controls
  const { 
    data: controlsResponse, 
    loading, 
    error, 
    execute: refetchControls 
  } = useControls({
    frameworkId,
    categoryId,
    status: selectedStatus,
    effectiveness: selectedEffectiveness,
    search: searchTerm,
    sortBy,
    sortOrder,
    page,
    pageSize,
  });
  
  const controls = controlsResponse?.items || [];
  const totalPages = controlsResponse?.totalPages || 1;
  const totalItems = controlsResponse?.total || 0;
  
  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (selectedStatus) params.set('status', selectedStatus);
    if (selectedEffectiveness) params.set('effectiveness', selectedEffectiveness);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    params.set('page', page.toString());
    params.set('pageSize', pageSize.toString());
    
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchTerm, selectedStatus, selectedEffectiveness, sortBy, sortOrder, page, pageSize]);
  
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };
  
  const handleControlClick = (controlId: string) => {
    if (onControlSelect) {
      onControlSelect(controlId);
    } else {
      router.push(`/controls/${controlId}`);
    }
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setSelectedEffectiveness('');
    setSortBy('controlId');
    setSortOrder('asc');
    setPage(1);
  };
  
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedStatus) count++;
    if (selectedEffectiveness) count++;
    return count;
  }, [searchTerm, selectedStatus, selectedEffectiveness]);
  
  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search controls by ID, name, or description..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <FunnelIcon className="h-5 w-5 mr-2 text-gray-400" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
        
        {/* Expandable Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Effectiveness Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effectiveness
                </label>
                <select
                  value={selectedEffectiveness}
                  onChange={(e) => {
                    setSelectedEffectiveness(e.target.value);
                    setPage(1);
                  }}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="">All Levels</option>
                  {effectivenessOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order
                </label>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {sortOrder === 'asc' ? (
                    <>
                      <ArrowUpIcon className="h-4 w-4 mr-2" />
                      Ascending
                    </>
                  ) : (
                    <>
                      <ArrowDownIcon className="h-4 w-4 mr-2" />
                      Descending
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <div className="mt-4">
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-500"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-700">
          Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
          <span className="font-medium">
            {Math.min(page * pageSize, totalItems)}
          </span>{' '}
          of <span className="font-medium">{totalItems}</span> controls
        </p>
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Show:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setPage(1);
            }}
            className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
      
      {/* Controls Table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading controls...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-400 mx-auto" />
            <p className="mt-2 text-sm text-red-600">Error loading controls</p>
            <button
              onClick={() => refetchControls()}
              className="mt-4 text-sm text-primary-600 hover:text-primary-500"
            >
              Try again
            </button>
          </div>
        ) : controls.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheckIcon className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">No controls found</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 text-sm text-primary-600 hover:text-primary-500"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('controlId')}
                  >
                    <div className="flex items-center">
                      Control ID
                      {sortBy === 'controlId' && (
                        sortOrder === 'asc' ? 
                          <ArrowUpIcon className="ml-1 h-3 w-3" /> : 
                          <ArrowDownIcon className="ml-1 h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Name
                      {sortBy === 'name' && (
                        sortOrder === 'asc' ? 
                          <ArrowUpIcon className="ml-1 h-3 w-3" /> : 
                          <ArrowDownIcon className="ml-1 h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Effectiveness
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Tested
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Review
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {controls.map((control: any) => {
                  const statusOption = statusOptions.find(s => s.value === control.status);
                  const StatusIcon = statusOption?.icon || DocumentTextIcon;
                  const effectivenessOption = effectivenessOptions.find(e => e.value === control.effectiveness);
                  
                  return (
                    <tr
                      key={control.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleControlClick(control.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {control.controlId}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <p className="font-medium truncate max-w-xs">{control.name}</p>
                          {control.description && (
                            <p className="text-gray-500 truncate max-w-xs">{control.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <StatusIcon className={`h-5 w-5 mr-2 ${statusOption?.color}`} />
                          <span className="text-sm text-gray-900">{statusOption?.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${effectivenessOption?.color}`}>
                          {effectivenessOption?.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {control.lastTested ? format(new Date(control.lastTested), 'MMM d, yyyy') : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {control.nextReview ? (
                          <span className={
                            new Date(control.nextReview) < new Date() 
                              ? 'text-red-600 font-medium' 
                              : ''
                          }>
                            {format(new Date(control.nextReview), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          'Not scheduled'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleControlClick(control.id);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{page}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                {/* Page Numbers */}
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = page <= 3 ? i + 1 : page + i - 2;
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === page
                          ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}