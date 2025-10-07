'use client';

import {
  ArrowUpTrayIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  DocumentIcon,
  LockClosedIcon,
  PencilIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface Activity {
  id: string;
  type:
    | 'message'
    | 'file_upload'
    | 'file_review'
    | 'permission_change'
    | 'thread_created'
    | 'thread_resolved';
  actor: string;
  action: string;
  target?: string;
  timestamp: string;
  details?: string;
}

const activities: Activity[] = [
  {
    id: '1',
    type: 'file_review',
    actor: 'Sarah Johnson',
    action: 'approved',
    target: 'SOC2_Security_Policies_2024.pdf',
    timestamp: '10 minutes ago',
    details: 'All requirements met',
  },
  {
    id: '2',
    type: 'message',
    actor: 'Michael Chen',
    action: 'replied to',
    target: 'Missing Evidence: Q3 Security Training',
    timestamp: '1 hour ago',
  },
  {
    id: '3',
    type: 'file_upload',
    actor: 'Emily Rodriguez',
    action: 'uploaded',
    target: 'Incident_Response_Plan_v2.pdf',
    timestamp: '2 hours ago',
    details: '3.2 MB, encrypted',
  },
  {
    id: '4',
    type: 'thread_created',
    actor: 'Sarah Johnson',
    action: 'started discussion',
    target: 'Access Control Policy Clarification',
    timestamp: '3 hours ago',
  },
  {
    id: '5',
    type: 'permission_change',
    actor: 'System Admin',
    action: 'granted access to',
    target: 'David Kim',
    timestamp: '5 hours ago',
    details: 'Network Diagrams folder',
  },
  {
    id: '6',
    type: 'file_review',
    actor: 'Michael Chen',
    action: 'rejected',
    target: 'Employee_Training_Records.xlsx',
    timestamp: 'Yesterday',
    details: 'Missing completion dates',
  },
  {
    id: '7',
    type: 'thread_resolved',
    actor: 'Sarah Johnson',
    action: 'marked as resolved',
    target: 'Audit Schedule Discussion',
    timestamp: 'Yesterday',
  },
];

const activityIcons = {
  message: ChatBubbleLeftIcon,
  file_upload: ArrowUpTrayIcon,
  file_review: DocumentIcon,
  permission_change: LockClosedIcon,
  thread_created: ChatBubbleLeftIcon,
  thread_resolved: CheckCircleIcon,
};

const activityColors = {
  message: 'bg-blue-100 text-blue-600',
  file_upload: 'bg-green-100 text-green-600',
  file_review: 'bg-yellow-100 text-yellow-600',
  permission_change: 'bg-purple-100 text-purple-600',
  thread_created: 'bg-blue-100 text-blue-600',
  thread_resolved: 'bg-gray-100 text-gray-600',
};

export default function CollaborationActivity() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        <p className="mt-1 text-sm text-gray-500">Real-time audit collaboration feed</p>
      </div>

      <div className="p-6">
        <div className="flow-root">
          <ul className="-mb-8">
            {activities.map((activity, activityIdx) => {
              const Icon = activityIcons[activity.type];
              const colorClass = activityColors[activity.type];

              return (
                <li key={activity.id}>
                  <div className="relative pb-8">
                    {activityIdx !== activities.length - 1 ? (
                      <span
                        className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                    ) : null}

                    <div className="relative flex space-x-3">
                      <div>
                        <span
                          className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${colorClass}`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{activity.actor}</span> {activity.action}{' '}
                            {activity.target && (
                              <span className="font-medium">{activity.target}</span>
                            )}
                          </p>
                          {activity.details && (
                            <p className="mt-0.5 text-xs text-gray-500">{activity.details}</p>
                          )}
                        </div>
                        <div className="whitespace-nowrap text-right text-xs text-gray-500">
                          <time>{activity.timestamp}</time>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Collaboration Stats</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Active threads</span>
              <span className="font-medium text-gray-900">12</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Files shared</span>
              <span className="font-medium text-gray-900">47</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Team members</span>
              <span className="font-medium text-gray-900">8</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Avg response time</span>
              <span className="font-medium text-gray-900">2.3 hrs</span>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <div className="flex">
            <LockClosedIcon className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Secure Collaboration</h3>
              <p className="mt-1 text-xs text-blue-700">
                All communications and files are end-to-end encrypted. Activity logs are maintained
                for audit trail purposes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
