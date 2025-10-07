'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  PlusIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  assignee: string;
  dueDate?: Date;
  completedDate?: Date;
}

const tasks: Task[] = [
  {
    id: '1',
    title: 'Complete vulnerability assessment',
    description: 'Run quarterly vulnerability scan on production infrastructure',
    type: 'CONTROL_TESTING',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignee: 'Michael Johnson',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    title: 'Update access control matrix',
    description: 'Review and update user access permissions for Q1',
    type: 'DOCUMENTATION',
    status: 'TODO',
    priority: 'MEDIUM',
    assignee: 'Emily Rodriguez',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    title: 'Collect firewall configuration evidence',
    type: 'EVIDENCE_COLLECTION',
    status: 'COMPLETED',
    priority: 'HIGH',
    assignee: 'Sarah Chen',
    completedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '4',
    title: 'Review incident response procedures',
    description: 'Annual review of IR procedures with management',
    type: 'REVIEW',
    status: 'BLOCKED',
    priority: 'URGENT',
    assignee: 'Sarah Chen',
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
  },
];

const statusConfig = {
  TODO: { icon: ClockIcon, color: 'text-gray-500', bgColor: 'bg-gray-100' },
  IN_PROGRESS: { icon: ClockIcon, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  COMPLETED: { icon: CheckCircleIcon, color: 'text-green-600', bgColor: 'bg-green-100' },
  BLOCKED: { icon: ExclamationTriangleIcon, color: 'text-red-600', bgColor: 'bg-red-100' },
};

const priorityConfig = {
  URGENT: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
};

interface ProjectTasksProps {
  projectId: string;
}

export default function ProjectTasks({ projectId }: ProjectTasksProps) {
  const [filter, setFilter] = useState<'ALL' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'>(
    'ALL'
  );

  const filteredTasks = filter === 'ALL' ? tasks : tasks.filter((task) => task.status === filter);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <div className="flex space-x-2">
            {(['ALL', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 text-sm rounded-md ${
                  filter === status
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                <span className="ml-1 text-xs">
                  (
                  {status === 'ALL'
                    ? tasks.length
                    : tasks.filter((t) => t.status === status).length}
                  )
                </span>
              </button>
            ))}
          </div>
        </div>
        <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.map((task) => {
          const status = statusConfig[task.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={task.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 mt-1 p-1 rounded-full ${status.bgColor}`}>
                    <StatusIcon className={`h-5 w-5 ${status.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                    {task.description && (
                      <p className="mt-1 text-sm text-gray-500">{task.description}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <UserCircleIcon className="h-4 w-4 mr-1" />
                        {task.assignee}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded ${priorityConfig[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span>{task.type.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {task.dueDate && task.status !== 'COMPLETED' && (
                    <p className="text-xs text-gray-500">Due {format(task.dueDate, 'MMM d')}</p>
                  )}
                  {task.completedDate && (
                    <p className="text-xs text-green-600">
                      Completed {format(task.completedDate, 'MMM d')}
                    </p>
                  )}
                  <button className="mt-2 text-xs text-primary-600 hover:text-primary-500">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No tasks found with the selected filter.
        </div>
      )}
    </div>
  );
}
