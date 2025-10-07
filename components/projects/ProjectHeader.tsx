'use client';

import {
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    client: string;
    type: string;
    status: string;
    framework: string[];
    startDate: Date;
    targetEndDate: Date;
    auditPeriodStart?: Date;
    auditPeriodEnd?: Date;
    progress: number;
    description: string;
  };
}

const statusColors = {
  PLANNING: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

export default function ProjectHeader({ project }: ProjectHeaderProps) {
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="mt-1 text-sm text-gray-600">{project.description}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[project.status]}`}
            >
              {project.status.replace('_', ' ')}
            </span>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Client */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Client</dt>
            <dd className="mt-1 text-sm text-gray-900">{project.client}</dd>
          </div>

          {/* Frameworks */}
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-2">Trust Service Criteria</dt>
            <dd className="flex flex-wrap gap-1">
              {project.framework.map((fw) => (
                <span
                  key={fw}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
                >
                  {fw.replace(/_/g, ' ')}
                </span>
              ))}
            </dd>
          </div>

          {/* Project Period */}
          <div>
            <dt className="text-sm font-medium text-gray-500 flex items-center">
              <CalendarIcon className="h-4 w-4 mr-1" />
              Project Period
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {format(project.startDate, 'MMM d, yyyy')} -{' '}
              {format(project.targetEndDate, 'MMM d, yyyy')}
            </dd>
          </div>

          {/* Audit Period */}
          {project.auditPeriodStart && project.auditPeriodEnd && (
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <ClockIcon className="h-4 w-4 mr-1" />
                Audit Period
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {format(project.auditPeriodStart, 'MMM d, yyyy')} -{' '}
                {format(project.auditPeriodEnd, 'MMM d, yyyy')}
              </dd>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-medium text-gray-900">{project.progress}%</span>
          </div>
          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
            <div
              style={{ width: `${project.progress}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-600 transition-all duration-500"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <DocumentDuplicateIcon className="mr-2 h-4 w-4" />
            View Evidence
          </button>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <ChartBarIcon className="mr-2 h-4 w-4" />
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}
