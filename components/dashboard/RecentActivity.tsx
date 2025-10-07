'use client';

import {
  ChartBarIcon,
  CheckCircleIcon,
  DocumentIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRecentActivity } from '@/hooks/api/useDashboard';

// Map activity types to icons and colors
const activityConfig = {
  project_created: {
    icon: PlusCircleIcon,
    iconBackground: 'bg-primary-500',
  },
  evidence_submitted: {
    icon: DocumentIcon,
    iconBackground: 'bg-blue-500',
  },
  control_updated: {
    icon: ShieldCheckIcon,
    iconBackground: 'bg-green-500',
  },
  finding_created: {
    icon: ExclamationTriangleIcon,
    iconBackground: 'bg-red-500',
  },
  report_generated: {
    icon: DocumentTextIcon,
    iconBackground: 'bg-purple-500',
  },
};

export default function RecentActivity() {
  const { data: activities, loading } = useRecentActivity(10);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const activityList = activities || [];

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activityList.map((activity, activityIdx) => {
          const config = activityConfig[activity.type as keyof typeof activityConfig] || {
            icon: DocumentIcon,
            iconBackground: 'bg-gray-500',
          };
          const Icon = config.icon;

          return (
            <li key={activity.id}>
              <div className="relative pb-8">
                {activityIdx !== activityList.length - 1 ? (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={`${config.iconBackground} h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white`}
                    >
                      <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-900">
                        {activity.title}{' '}
                        <span className="font-medium text-gray-700">by {activity.userName}</span>
                      </p>
                      <p className="mt-1 text-sm text-gray-500">{activity.description}</p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <time dateTime={activity.timestamp}>
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-8">
        <a
          href="/dashboard/activity"
          className="text-sm font-medium text-primary-600 hover:text-primary-500"
        >
          View all activity →
        </a>
      </div>
    </div>
  );
}
