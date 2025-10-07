'use client';

import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Fragment, useEffect, useState } from 'react';
import { useProjects } from '@/hooks/api/useProjects';
import type { Project } from '@/lib/api/projects';

interface ProjectFiltersProps {
  filters: {
    search?: string;
    status?: Project['status'];
    type?: Project['type'];
    clientId?: string;
  };
  onFiltersChange: (filters: any) => void;
}

const statusOptions = [
  { label: 'All Status', value: undefined },
  { label: 'Planning', value: 'planning' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Review', value: 'review' },
  { label: 'Completed', value: 'completed' },
  { label: 'On Hold', value: 'on_hold' },
];

const typeOptions = [
  { label: 'All Types', value: undefined },
  { label: 'SOC 1', value: 'soc1' },
  { label: 'SOC 2', value: 'soc2' },
  { label: 'ISO 27001', value: 'iso27001' },
  { label: 'HIPAA', value: 'hipaa' },
  { label: 'PCI', value: 'pci' },
  { label: 'Readiness', value: 'readiness' },
  { label: 'Risk Assessment', value: 'risk_assessment' },
];

export default function ProjectFilters({ filters, onFiltersChange }: ProjectFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '');

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

  const selectedStatus = statusOptions.find((s) => s.value === filters.status);
  const selectedType = typeOptions.find((t) => t.value === filters.type);
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />

          {/* Status Filter */}
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                {selectedStatus?.label || 'Status: All'}
                <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
              </Menu.Button>
            </div>
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
                  {statusOptions.map((option) => (
                    <Menu.Item key={option.value || 'all'}>
                      {({ active }) => (
                        <button
                          onClick={() => handleFilterChange('status', option.value)}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } block w-full text-left px-4 py-2 text-sm`}
                        >
                          {option.label}
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
            <div>
              <Menu.Button className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                {selectedType?.label || 'Type: All'}
                <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
              </Menu.Button>
            </div>
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
                  {typeOptions.map((option) => (
                    <Menu.Item key={option.value || 'all'}>
                      {({ active }) => (
                        <button
                          onClick={() => handleFilterChange('type', option.value)}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } block w-full text-left px-4 py-2 text-sm`}
                        >
                          {option.label}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search projects..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
    </div>
  );
}
