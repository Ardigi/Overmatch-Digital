'use client';

import {
  BellIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    email: {
      projectUpdates: true,
      findingAlerts: true,
      taskReminders: true,
      weeklyDigest: true,
      securityAlerts: true,
      billingNotices: true,
    },
    inApp: {
      projectUpdates: true,
      findingAlerts: true,
      taskReminders: true,
      mentions: true,
      comments: true,
    },
    slack: {
      enabled: true,
      criticalFindings: true,
      projectMilestones: true,
      dailySummary: false,
    },
    mobile: {
      enabled: false,
      criticalAlerts: true,
      taskDue: true,
    },
  });

  const notificationCategories = [
    {
      title: 'Project & Audit',
      description: 'Updates about projects, audits, and findings',
      settings: [
        { key: 'projectUpdates', label: 'Project status updates' },
        { key: 'findingAlerts', label: 'New findings and issues' },
        { key: 'projectMilestones', label: 'Project milestone completions' },
      ],
    },
    {
      title: 'Tasks & Reminders',
      description: 'Personal task assignments and due date reminders',
      settings: [
        { key: 'taskReminders', label: 'Task due date reminders' },
        { key: 'taskDue', label: 'Tasks approaching deadline' },
      ],
    },
    {
      title: 'Communication',
      description: 'Team collaboration and mentions',
      settings: [
        { key: 'mentions', label: 'When someone mentions you' },
        { key: 'comments', label: 'Comments on your work' },
      ],
    },
    {
      title: 'Security & Compliance',
      description: 'Important security and compliance alerts',
      settings: [
        { key: 'securityAlerts', label: 'Security incidents and alerts' },
        { key: 'criticalFindings', label: 'Critical audit findings' },
        { key: 'criticalAlerts', label: 'Critical system alerts' },
      ],
    },
    {
      title: 'Reports & Summaries',
      description: 'Scheduled reports and activity summaries',
      settings: [
        { key: 'weeklyDigest', label: 'Weekly activity digest' },
        { key: 'dailySummary', label: 'Daily summary' },
      ],
    },
    {
      title: 'Billing & Account',
      description: 'Billing, subscription, and account updates',
      settings: [{ key: 'billingNotices', label: 'Billing and payment notices' }],
    },
  ];

  const handleToggle = (channel: string, setting: string) => {
    setNotifications({
      ...notifications,
      [channel]: {
        ...notifications[channel as keyof typeof notifications],
        [setting]:
          !notifications[channel as keyof typeof notifications][
            setting as keyof (typeof notifications)[keyof typeof notifications]
          ],
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
          <p className="text-sm text-gray-600 mt-1">
            Choose how and when you want to be notified about important events
          </p>
        </div>

        <div className="p-6">
          {/* Notification Channels */}
          <div className="mb-8">
            <h4 className="text-base font-medium text-gray-900 mb-4">Notification Channels</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Email Notifications</p>
                    <p className="text-sm text-gray-600">sarah.chen@overmatch.com</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={true} className="sr-only peer" readOnly />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ComputerDesktopIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">In-App Notifications</p>
                    <p className="text-sm text-gray-600">Notifications within the platform</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={true} className="sr-only peer" readOnly />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Slack Integration</p>
                    <p className="text-sm text-gray-600">Connected to #audit-alerts channel</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.slack.enabled}
                    onChange={() =>
                      setNotifications({
                        ...notifications,
                        slack: { ...notifications.slack, enabled: !notifications.slack.enabled },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <DevicePhoneMobileIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Mobile Push</p>
                    <p className="text-sm text-gray-600">Get notifications on your phone</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.mobile.enabled}
                    onChange={() =>
                      setNotifications({
                        ...notifications,
                        mobile: { ...notifications.mobile, enabled: !notifications.mobile.enabled },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Notification Types */}
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4">Notification Types</h4>
            <div className="space-y-6">
              {notificationCategories.map((category) => (
                <div key={category.title} className="border-b border-gray-200 pb-6 last:border-0">
                  <h5 className="font-medium text-gray-900 mb-1">{category.title}</h5>
                  <p className="text-sm text-gray-600 mb-3">{category.description}</p>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-sm font-medium text-gray-700">Notification</div>
                    <div className="text-sm font-medium text-gray-700 text-center">Email</div>
                    <div className="text-sm font-medium text-gray-700 text-center">In-App</div>
                    <div className="text-sm font-medium text-gray-700 text-center">Slack</div>

                    {category.settings.map((setting) => {
                      const emailValue =
                        notifications.email[setting.key as keyof typeof notifications.email];
                      const inAppValue =
                        notifications.inApp[setting.key as keyof typeof notifications.inApp];
                      const slackValue =
                        notifications.slack[setting.key as keyof typeof notifications.slack];

                      return (
                        <React.Fragment key={setting.key}>
                          <div className="text-sm text-gray-600">{setting.label}</div>
                          <div className="text-center">
                            {emailValue !== undefined && (
                              <input
                                type="checkbox"
                                checked={emailValue}
                                onChange={() => handleToggle('email', setting.key)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                            )}
                          </div>
                          <div className="text-center">
                            {inAppValue !== undefined && (
                              <input
                                type="checkbox"
                                checked={inAppValue}
                                onChange={() => handleToggle('inApp', setting.key)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                            )}
                          </div>
                          <div className="text-center">
                            {slackValue !== undefined && notifications.slack.enabled && (
                              <input
                                type="checkbox"
                                checked={slackValue}
                                onChange={() => handleToggle('slack', setting.key)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button className="btn-secondary">Reset to Defaults</button>
        <button className="btn-primary flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5" />
          Save Preferences
        </button>
      </div>
    </div>
  );
}
