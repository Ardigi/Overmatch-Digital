'use client';

import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'error' | 'disconnected';
  lastSync?: Date;
  eventsCollected: number;
  description: string;
  icon: string;
}

const integrations: Integration[] = [
  {
    id: '1',
    name: 'AWS CloudTrail',
    type: 'Cloud Provider',
    status: 'connected',
    lastSync: new Date(Date.now() - 5 * 60 * 1000),
    eventsCollected: 15234,
    description: 'Monitoring AWS infrastructure and access logs',
    icon: '☁️',
  },
  {
    id: '2',
    name: 'Microsoft Azure',
    type: 'Cloud Provider',
    status: 'connected',
    lastSync: new Date(Date.now() - 3 * 60 * 1000),
    eventsCollected: 8921,
    description: 'Azure AD and resource monitoring',
    icon: '☁️',
  },
  {
    id: '3',
    name: 'Okta',
    type: 'Identity Provider',
    status: 'connected',
    lastSync: new Date(Date.now() - 2 * 60 * 1000),
    eventsCollected: 3456,
    description: 'User authentication and access management',
    icon: '🔐',
  },
  {
    id: '4',
    name: 'GitHub',
    type: 'Source Control',
    status: 'error',
    lastSync: new Date(Date.now() - 45 * 60 * 1000),
    eventsCollected: 892,
    description: 'Code repository access and changes',
    icon: '💻',
  },
  {
    id: '5',
    name: 'Datadog',
    type: 'Monitoring',
    status: 'connected',
    lastSync: new Date(Date.now() - 1 * 60 * 1000),
    eventsCollected: 45678,
    description: 'Infrastructure and application monitoring',
    icon: '📊',
  },
  {
    id: '6',
    name: 'Jira',
    type: 'Issue Tracking',
    status: 'disconnected',
    eventsCollected: 0,
    description: 'Change management and incident tracking',
    icon: '📋',
  },
];

const statusConfig = {
  connected: {
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Connected',
  },
  error: {
    icon: ExclamationTriangleIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Error',
  },
  disconnected: {
    icon: XCircleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Disconnected',
  },
};

export default function IntegrationStatus() {
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const handleRefresh = async (integrationId: string) => {
    setRefreshing(integrationId);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setRefreshing(null);
  };

  const getTimeSinceSync = (lastSync?: Date) => {
    if (!lastSync) return 'Never';
    const minutes = Math.floor((Date.now() - lastSync.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {integrations.map((integration) => {
        const status = statusConfig[integration.status];
        const StatusIcon = status.icon;

        return (
          <div
            key={integration.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{integration.icon}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">{integration.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{integration.type}</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}
              >
                <StatusIcon className="mr-1 h-3 w-3" />
                {status.label}
              </span>
            </div>

            <p className="mt-3 text-xs text-gray-600">{integration.description}</p>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Last sync:</span>
                <span className="text-gray-900 font-medium">
                  {getTimeSinceSync(integration.lastSync)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Events collected:</span>
                <span className="text-gray-900 font-medium">
                  {integration.eventsCollected.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => handleRefresh(integration.id)}
                disabled={refreshing === integration.id}
                className="inline-flex items-center text-xs text-primary-600 hover:text-primary-500 disabled:opacity-50"
              >
                <ArrowPathIcon
                  className={`mr-1 h-3 w-3 ${refreshing === integration.id ? 'animate-spin' : ''}`}
                />
                {refreshing === integration.id ? 'Syncing...' : 'Sync Now'}
              </button>
              <button className="text-xs text-gray-600 hover:text-gray-900">Configure</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
