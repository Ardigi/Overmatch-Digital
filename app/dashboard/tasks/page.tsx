'use client';

import {
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorBoundary';
import { CardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeletons';

// Mock data for tasks
const tasksData = [
  {
    id: 1,
    title: 'Complete risk assessment documentation',
    description: 'Review and update risk assessment for Q4 2024',
    priority: 'high',
    status: 'in_progress',
    dueDate: '2024-12-15',
    assignee: 'You',
    project: 'SOC 2 Type II Audit',
  },
  {
    id: 2,
    title: 'Upload evidence for access controls',
    description: 'Provide screenshots and documentation for AC-1 through AC-5',
    priority: 'medium',
    status: 'pending',
    dueDate: '2024-12-20',
    assignee: 'You',
    project: 'SOC 2 Type II Audit',
  },
  {
    id: 3,
    title: 'Review policy updates',
    description: 'Review and approve updated information security policies',
    priority: 'low',
    status: 'pending',
    dueDate: '2024-12-30',
    assignee: 'You',
    project: 'Policy Management',
  },
  {
    id: 4,
    title: 'Security awareness training',
    description: 'Complete annual security awareness training',
    priority: 'medium',
    status: 'completed',
    dueDate: '2024-12-01',
    assignee: 'You',
    project: 'Compliance Training',
  },
];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'low':
      return 'text-green-600 bg-green-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" aria-label="Completed" />;
    case 'in_progress':
      return <ClockIcon className="h-5 w-5 text-blue-500" aria-label="In Progress" />;
    default:
      return <ExclamationCircleIcon className="h-5 w-5 text-gray-400" aria-label="Pending" />;
  }
};

export default function TasksPage() {
  const [tasks, setTasks] = useState(tasksData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const stats = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <ErrorMessage
          title="Failed to load tasks"
          message={error}
          onRetry={() => {
            setError(null);
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 800);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tasks</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">
          Manage your compliance tasks and track progress
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <button
              onClick={() => setFilter('pending')}
              className={`bg-white overflow-hidden shadow rounded-lg p-5 hover:shadow-md transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 ${
                filter === 'pending' ? 'ring-2 ring-yellow-500' : ''
              }`}
              aria-label={`${stats.pending} pending tasks. Click to filter`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationCircleIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Tasks</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.pending}</dd>
                  </dl>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilter('in_progress')}
              className={`bg-white overflow-hidden shadow rounded-lg p-5 hover:shadow-md transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                filter === 'in_progress' ? 'ring-2 ring-blue-500' : ''
              }`}
              aria-label={`${stats.in_progress} tasks in progress. Click to filter`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">In Progress</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.in_progress}</dd>
                  </dl>
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilter('completed')}
              className={`bg-white overflow-hidden shadow rounded-lg p-5 hover:shadow-md transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                filter === 'completed' ? 'ring-2 ring-green-500' : ''
              }`}
              aria-label={`${stats.completed} completed tasks. Click to filter`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.completed}</dd>
                  </dl>
                </div>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Tasks List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-medium text-gray-900">
              {filter === 'all' ? 'All Tasks' : `${filter.replace('_', ' ')} Tasks`}
            </h2>
            <div className="flex items-center gap-2">
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear filter
                </button>
              )}
              <button
                className="inline-flex items-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 min-h-[44px]"
                aria-label="Create new task"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">New Task</span>
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardDocumentCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all'
                ? 'Get started by creating a new task.'
                : `No ${filter.replace('_', ' ')} tasks.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                    Task
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell"
                  >
                    Project
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Priority
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell"
                  >
                    Due Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell"
                  >
                    Assignee
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-gray-50 cursor-pointer focus-within:bg-gray-50"
                    tabIndex={0}
                    role="button"
                    aria-label={`View task: ${task.title}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        console.log('Open task:', task.id);
                      }
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusIcon(task.status)}</td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        <div className="text-sm text-gray-500 hidden sm:block">
                          {task.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                      {task.project}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                      {task.assignee}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
