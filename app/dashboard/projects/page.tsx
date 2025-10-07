'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';
import ProjectFilters from '@/components/projects/ProjectFilters';
import ProjectsTable from '@/components/projects/ProjectsTable';

export default function ProjectsPage() {
  const [filters, setFilters] = useState({});

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your SOC audit projects and compliance assessments
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            New Project
          </Link>
        </div>
      </div>

      {/* Filters */}
      <ProjectFilters filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Projects Table */}
      <div className="mt-8">
        <ProjectsTable filters={filters} />
      </div>
    </div>
  );
}
