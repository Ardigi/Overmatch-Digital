'use client';

import { CalendarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useUpcomingTasks } from '@/hooks/api/useDashboard';

const priorityColors = {
  high: 'text-red-600 bg-red-100',
  medium: 'text-yellow-600 bg-yellow-100',
  low: 'text-green-600 bg-green-100',
};

export default function UpcomingTasks() {
  const { data: tasks, loading } = useUpcomingTasks(5);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const taskList = tasks || [];

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {taskList.map((task, taskIdx) => (
          <li key={task.id}>
            <div className="relative pb-8">
              {taskIdx !== taskList.length - 1 ? (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                    <CalendarIcon className="h-5 w-5 text-gray-500" />
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm text-gray-900">{task.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{task.projectName || 'No project'}</p>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          priorityColors[task.priority]
                        }`}
                      >
                        {task.priority === 'high' && (
                          <ExclamationTriangleIcon className="mr-1 h-3 w-3" />
                        )}
                        {task.priority} priority
                      </span>
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-right text-sm text-gray-500">
                    <time dateTime={task.dueDate}>{format(new Date(task.dueDate), 'MMM d')}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <a
          href="/dashboard/tasks"
          className="text-sm font-medium text-primary-600 hover:text-primary-500"
        >
          View all tasks →
        </a>
      </div>
    </div>
  );
}
