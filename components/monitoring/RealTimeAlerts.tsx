'use client';

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldExclamationIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  controlId?: string;
}

const initialAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: 'MFA not enabled for admin account',
    description: 'Admin user john.admin@acme.com does not have multi-factor authentication enabled',
    source: 'Okta',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    acknowledged: false,
    controlId: 'CC6.1',
  },
  {
    id: '2',
    type: 'warning',
    title: 'Unusual login pattern detected',
    description: 'User sarah.chen@acme.com logged in from new location: Brazil',
    source: 'Azure AD',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    acknowledged: false,
    controlId: 'CC6.2',
  },
  {
    id: '3',
    type: 'info',
    title: 'Security patch available',
    description: 'New security patch available for nginx/1.18.0',
    source: 'Datadog',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    acknowledged: true,
  },
  {
    id: '4',
    type: 'success',
    title: 'Backup completed successfully',
    description: 'Daily backup completed for production database',
    source: 'AWS',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    acknowledged: true,
  },
];

const alertConfig = {
  critical: {
    icon: ShieldExclamationIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
  },
  info: {
    icon: InformationCircleIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  success: {
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
  },
};

export default function RealTimeAlerts() {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState<'all' | 'unacknowledged'>('unacknowledged');

  // Simulate real-time alerts
  useEffect(() => {
    const interval = setInterval(() => {
      const randomAlert: Alert = {
        id: Date.now().toString(),
        type: Math.random() > 0.7 ? 'critical' : Math.random() > 0.5 ? 'warning' : 'info',
        title: 'New compliance event detected',
        description: `Automated check found potential issue in control ${Math.random() > 0.5 ? 'CC6.1' : 'CC7.2'}`,
        source: ['AWS', 'Azure', 'Okta', 'Datadog'][Math.floor(Math.random() * 4)],
        timestamp: new Date(),
        acknowledged: false,
        controlId: `CC${Math.floor(Math.random() * 8) + 1}.${Math.floor(Math.random() * 3) + 1}`,
      };

      setAlerts((prev) => [randomAlert, ...prev].slice(0, 10));
    }, 30000); // Add new alert every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert))
    );
  };

  const handleDismiss = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter((alert) => !alert.acknowledged);

  return (
    <div>
      {/* Filter Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setFilter('unacknowledged')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              filter === 'unacknowledged'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Unacknowledged ({alerts.filter((a) => !a.acknowledged).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              filter === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Alerts ({alerts.length})
          </button>
        </nav>
      </div>

      {/* Alerts List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <p className="text-center py-8 text-gray-500 text-sm">
            No {filter === 'unacknowledged' ? 'unacknowledged ' : ''}alerts to display
          </p>
        ) : (
          filteredAlerts.map((alert) => {
            const config = alertConfig[alert.type];
            const AlertIcon = config.icon;

            return (
              <div
                key={alert.id}
                className={`border rounded-lg p-4 ${config.borderColor} ${
                  alert.acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start">
                  <div className={`flex-shrink-0 rounded-lg p-2 ${config.bgColor}`}>
                    <AlertIcon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{alert.title}</h4>
                        <p className="mt-1 text-xs text-gray-600">{alert.description}</p>
                        <div className="mt-2 flex items-center space-x-3 text-xs text-gray-500">
                          <span>{alert.source}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(alert.timestamp, { addSuffix: true })}</span>
                          {alert.controlId && (
                            <>
                              <span>•</span>
                              <span className="font-medium">{alert.controlId}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="ml-4 text-gray-400 hover:text-gray-500"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {!alert.acknowledged && (
                      <div className="mt-3">
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="text-xs text-primary-600 hover:text-primary-500 font-medium"
                        >
                          Acknowledge
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* View All Link */}
      <div className="mt-4 text-center">
        <a href="#" className="text-sm text-primary-600 hover:text-primary-500">
          View all alerts in Alert Center →
        </a>
      </div>
    </div>
  );
}
