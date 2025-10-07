'use client';

import { Menu, Transition } from '@headlessui/react';
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Fragment, useEffect, useState } from 'react';

import { useControls } from '@/hooks/api/useControls';
import { useProjects } from '@/hooks/api/useProjects';
import type { Evidence } from '@/lib/api/evidence';

interface EvidenceFiltersProps {
  filters: {
    search?: string;
    type?: Evidence['type'];
    category?: Evidence['category'];
    status?: Evidence['status'];
    relatedControlId?: string;
    relatedProjectId?: string;
    collectionDateFrom?: string;
    collectionDateTo?: string;
  };
  onFiltersChange: (filters: any) => void;
}

const statusOptions = [
  { label: 'All', value: undefined, icon: null },
  { label: 'Approved', value: 'approved', icon: CheckCircleIcon, color: 'text-green-600' },
  { label: 'Pending Review', value: 'pending', icon: ClockIcon, color: 'text-yellow-600' },
  { label: 'Rejected', value: 'rejected', icon: XCircleIcon, color: 'text-red-600' },
  { label: 'Expired', value: 'expired', icon: XCircleIcon, color: 'text-red-600' },
];

const typeOptions = [
  { label: 'All Types', value: undefined },
  { label: 'Document', value: 'document' },
  { label: 'Screenshot', value: 'screenshot' },
  { label: 'Log File', value: 'log' },
  { label: 'Configuration', value: 'configuration' },
  { label: 'Report', value: 'report' },
  { label: 'Other', value: 'other' },
];

const categoryOptions = [
  { label: 'All Categories', value: undefined },
  { label: 'Policy', value: 'policy' },
  { label: 'Control', value: 'control' },
  { label: 'Audit', value: 'audit' },
  { label: 'Assessment', value: 'assessment' },
  { label: 'General', value: 'general' },
];

export default function EvidenceFilters({ filters, onFiltersChange }: EvidenceFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const { data: controlsData } = useControls({ pageSize: 100 });
  const { data: projectsData } = useProjects({ pageSize: 100 });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const removeFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setSearchValue('');
    onFiltersChange({});
  };

  const selectedControl = controlsData?.data?.find((c) => c.id === filters.relatedControlId);
  const selectedProject = projectsData?.data?.find((p) => p.id === filters.relatedProjectId);
  const selectedStatus = statusOptions.find((s) => s.value === filters.status);
  const selectedType = typeOptions.find((t) => t.value === filters.type);
  const selectedCategory = categoryOptions.find((c) => c.value === filters.category);
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div className="flex items-center space-x-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />

          {/* Control Filter */}
          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              {selectedControl
                ? `${selectedControl.code} - ${selectedControl.name}`
                : 'Control: All'}
              <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="origin-top-left absolute left-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 focus:outline-none">
                <div className="py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => handleFilterChange('relatedControlId', undefined)}
                        className={`${
                          active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                        } block w-full text-left px-4 py-2 text-sm`}
                      >
                        All Controls
                      </button>
                    )}
                  </Menu.Item>
                  {controlsData?.data?.map((control) => (
                    <Menu.Item key={control.id}>
                      {({ active }) => (
                        <button
                          onClick={() => handleFilterChange('relatedControlId', control.id)}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } block w-full text-left px-4 py-2 text-sm`}
                        >
                          {control.code} - {control.name}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* Status Filter */}
          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              {selectedStatus ? selectedStatus.label : 'Status: All'}
              <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="origin-top-left absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 focus:outline-none">
                <div className="py-1">
                  {statusOptions.map((status) => (
                    <Menu.Item key={status.value || 'all'}>
                      {({ active }) => (
                        <button
                          onClick={() => handleFilterChange('status', status.value)}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } block w-full text-left px-4 py-2 text-sm flex items-center`}
                        >
                          {status.icon && (
                            <status.icon className={`mr-2 h-4 w-4 ${status.color}`} />
                          )}
                          {status.label}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* Type Filter */}
          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              {selectedType ? selectedType.label : 'Type: All'}
              <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="origin-top-left absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 focus:outline-none">
                <div className="py-1">
                  {typeOptions.map((type) => (
                    <Menu.Item key={type.value || 'all'}>
                      {({ active }) => (
                        <button
                          onClick={() => handleFilterChange('type', type.value)}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } block w-full text-left px-4 py-2 text-sm`}
                        >
                          {type.label}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* Date Range */}
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
            <CalendarIcon className="mr-2 h-5 w-5 text-gray-400" />
            Last 30 days
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search evidence..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="block w-full lg:w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Active Filters */}
      {(filters.search ||
        filters.type ||
        filters.status ||
        filters.relatedControlId ||
        filters.relatedProjectId ||
        filters.category) && (
        <div className="mt-4 flex items-center flex-wrap gap-2">
          <span className="text-sm text-gray-500">Active filters:</span>
          {filters.search && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Search: {filters.search}
              <button
                onClick={() => {
                  setSearchValue('');
                  removeFilter('search');
                }}
                className="ml-1 inline-flex items-center p-0.5 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
              >
                <XCircleIcon className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedControl && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Control: {selectedControl.code}
              <button
                onClick={() => removeFilter('relatedControlId')}
                className="ml-1 inline-flex items-center p-0.5 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
              >
                <XCircleIcon className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedProject && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Project: {selectedProject.name}
              <button
                onClick={() => removeFilter('relatedProjectId')}
                className="ml-1 inline-flex items-center p-0.5 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
              >
                <XCircleIcon className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedStatus && selectedStatus.value && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Status: {selectedStatus.label}
              <button
                onClick={() => removeFilter('status')}
                className="ml-1 inline-flex items-center p-0.5 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
              >
                <XCircleIcon className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedType && selectedType.value && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Type: {selectedType.label}
              <button
                onClick={() => removeFilter('type')}
                className="ml-1 inline-flex items-center p-0.5 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
              >
                <XCircleIcon className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedCategory && selectedCategory.value && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Category: {selectedCategory.label}
              <button
                onClick={() => removeFilter('category')}
                className="ml-1 inline-flex items-center p-0.5 rounded-full text-primary-400 hover:bg-primary-200 hover:text-primary-500"
              >
                <XCircleIcon className="h-3 w-3" />
              </button>
            </span>
          )}
          <button
            onClick={clearAllFilters}
            className="text-sm text-primary-600 hover:text-primary-500"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
