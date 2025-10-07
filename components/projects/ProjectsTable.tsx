'use client';

import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';
import { useDeleteProject, useProjects } from '@/hooks/api/useProjects';
import { Project } from '@/lib/api/projects';

interface ProjectsTableProps {
  filters?: any;
}

const mockProjects = [
  {
    id: '1',
    name: 'SOC 2 Type II - Acme Corp',
    client: 'Acme Corporation',
    type: 'SOC2_TYPE2',
    status: 'IN_PROGRESS',
    framework: ['SOC2_SECURITY', 'SOC2_AVAILABILITY'],
    startDate: new Date('2024-01-15'),
    targetEndDate: new Date('2024-07-15'),
    progress: 65,
    auditor: 'Sarah Chen',
  },
  {
    id: '2',
    name: 'SOC 1 Type I - Global Finance',
    client: 'Global Finance Inc',
    type: 'SOC1_TYPE1',
    status: 'UNDER_REVIEW',
    framework: ['SOC1'],
    startDate: new Date('2024-02-01'),
    targetEndDate: new Date('2024-03-15'),
    progress: 90,
    auditor: 'Mike Johnson',
  },
  {
    id: '3',
    name: 'Readiness Assessment - TechStart',
    client: 'TechStart Inc',
    type: 'READINESS_ASSESSMENT',
    status: 'PLANNING',
    framework: ['SOC2_SECURITY', 'SOC2_PRIVACY'],
    startDate: new Date('2024-03-01'),
    targetEndDate: new Date('2024-04-01'),
    progress: 15,
    auditor: 'Emily Rodriguez',
  },
];

const statusStyles = {
  PLANNING: { color: 'bg-gray-100 text-gray-800', icon: ClockIcon },
  IN_PROGRESS: { color: 'bg-blue-100 text-blue-800', icon: ClockIcon },
  UNDER_REVIEW: { color: 'bg-yellow-100 text-yellow-800', icon: ExclamationCircleIcon },
  COMPLETED: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
};

const typeLabels = {
  SOC1_TYPE1: 'SOC 1 Type I',
  SOC1_TYPE2: 'SOC 1 Type II',
  SOC2_TYPE1: 'SOC 2 Type I',
  SOC2_TYPE2: 'SOC 2 Type II',
  READINESS_ASSESSMENT: 'Readiness Assessment',
  GAP_REMEDIATION: 'Gap Remediation',
  PENETRATION_TEST: 'Penetration Test',
};

export default function ProjectsTable({ filters }: ProjectsTableProps) {
  const { showSuccess, showError } = useToast();

  // Fetch projects from API
  const {
    data: projectsData,
    loading,
    execute: refreshProjects,
  } = useProjects({
    ...filters,
    pageSize: 50,
  });

  const deleteProject = useDeleteProject();

  const projects = projectsData?.data || mockProjects;

  const handleDelete = async (projectId: string, projectName: string) => {
    if (confirm(`Are you sure you want to delete the project "${projectName}"?`)) {
      try {
        await deleteProject.mutate(projectId);
        showSuccess('Project deleted', 'The project has been successfully deleted.');
        refreshProjects();
      } catch (error) {
        showError('Delete failed', 'Failed to delete the project. Please try again.');
      }
    }
  };

  if (loading && projects.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-3 border-b border-gray-200 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">{projects.length} Active Projects</h3>
          <button
            onClick={() => refreshProjects()}
            disabled={loading}
            className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            title="Refresh projects"
          >
            <ArrowPathIcon className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <ul className="divide-y divide-gray-200">
        {projects.map((project: any) => {
          const status = project.status?.toUpperCase().replace(/-/g, '_') || 'PLANNING';
          const type = project.type?.toUpperCase().replace(/-/g, '_') || 'SOC2_TYPE2';
          const StatusIcon = statusStyles[status]?.icon || ClockIcon;

          return (
            <li key={project.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-primary-600 truncate">
                        {project.name}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status]?.color || 'bg-gray-100 text-gray-800'}`}
                        >
                          <StatusIcon className="mr-1 h-4 w-4" />
                          {status.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          <span className="font-medium">
                            {project.client?.name || project.client}
                          </span>
                          <span className="mx-2">•</span>
                          {typeLabels[type] || type}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <p>
                          {format(new Date(project.startDate), 'MMM d, yyyy')} -{' '}
                          {format(
                            new Date(project.endDate || project.targetEndDate),
                            'MMM d, yyyy'
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <span>Progress</span>
                        <div className="ml-2 flex-1">
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                            <div
                              style={{
                                width: `${project.progress || project.metadata?.progress || 0}%`,
                              }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500"
                            />
                          </div>
                        </div>
                        <span className="ml-2">
                          {project.progress || project.metadata?.progress || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="p-1 text-gray-400 hover:text-gray-500"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </Link>
                    <button className="p-1 text-gray-400 hover:text-gray-500">
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(project.id, project.name)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Delete project"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {projects.length === 0 && !loading && (
        <div className="text-center py-12">
          <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No projects found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
        </div>
      )}
    </div>
  );
}
