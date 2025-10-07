'use client';

import {
  BellIcon,
  CheckIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  timezone: string;
  photoUrl?: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  auditUpdates: boolean;
  taskReminders: boolean;
  findingAlerts: boolean;
  reportAvailable: boolean;
  digestFrequency: 'daily' | 'weekly' | 'monthly';
}

export default function ClientSettingsView() {
  const { showSuccess, showError } = useToast();

  const [profile, setProfile] = useState<UserProfile>({
    name: 'John Smith',
    email: 'john.smith@acmecorp.com',
    phone: '+1 (555) 123-4567',
    title: 'Compliance Manager',
    company: 'Acme Corporation',
    timezone: 'America/New_York',
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    auditUpdates: true,
    taskReminders: true,
    findingAlerts: true,
    reportAvailable: true,
    digestFrequency: 'weekly',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleProfileSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showSuccess('Profile Updated', 'Your profile has been successfully updated.');
      setIsEditing(false);
    } catch (error) {
      showError('Update Failed', 'Unable to update your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showSuccess('Preferences Saved', 'Your notification preferences have been updated.');
    } catch (error) {
      showError('Save Failed', 'Unable to save notification preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your profile and notification preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <UserCircleIcon className="h-5 w-5 mr-2 text-gray-400" />
                Profile Information
              </h2>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  disabled={!isEditing}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Contact your administrator to change your email
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  disabled={!isEditing}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Job Title</label>
                <input
                  type="text"
                  value={profile.title}
                  onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                  disabled={!isEditing}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Company</label>
                <input
                  type="text"
                  value={profile.company}
                  disabled
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                <select
                  value={profile.timezone}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  disabled={!isEditing}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>
            </div>

            {isEditing && (
              <div className="mt-6 flex justify-end">
                <button onClick={handleProfileSave} disabled={isSaving} className="btn-primary">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <BellIcon className="h-5 w-5 mr-2 text-gray-400" />
              Notification Preferences
            </h2>
          </div>

          <div className="px-6 py-4 space-y-6">
            {/* Communication Channels */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Communication Channels</h3>
              <div className="space-y-3">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={notifications.emailNotifications}
                    onChange={(e) =>
                      setNotifications({ ...notifications, emailNotifications: e.target.checked })
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-700">
                      Email Notifications
                    </span>
                    <span className="block text-xs text-gray-500">Receive updates via email</span>
                  </div>
                </label>

                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={notifications.smsNotifications}
                    onChange={(e) =>
                      setNotifications({ ...notifications, smsNotifications: e.target.checked })
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-700">
                      SMS Notifications
                    </span>
                    <span className="block text-xs text-gray-500">
                      Receive critical alerts via text message
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Notification Types */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Notification Types</h3>
              <div className="space-y-3">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={notifications.auditUpdates}
                    onChange={(e) =>
                      setNotifications({ ...notifications, auditUpdates: e.target.checked })
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-700">Audit Updates</span>
                    <span className="block text-xs text-gray-500">
                      Status changes and milestone completions
                    </span>
                  </div>
                </label>

                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={notifications.taskReminders}
                    onChange={(e) =>
                      setNotifications({ ...notifications, taskReminders: e.target.checked })
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-700">Task Reminders</span>
                    <span className="block text-xs text-gray-500">
                      Upcoming deadlines and overdue tasks
                    </span>
                  </div>
                </label>

                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={notifications.findingAlerts}
                    onChange={(e) =>
                      setNotifications({ ...notifications, findingAlerts: e.target.checked })
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-700">Finding Alerts</span>
                    <span className="block text-xs text-gray-500">
                      New findings and status updates
                    </span>
                  </div>
                </label>

                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={notifications.reportAvailable}
                    onChange={(e) =>
                      setNotifications({ ...notifications, reportAvailable: e.target.checked })
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-700">
                      Report Availability
                    </span>
                    <span className="block text-xs text-gray-500">
                      When SOC reports are ready for download
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Digest Frequency */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Summary Digest Frequency</h3>
              <select
                value={notifications.digestFrequency}
                onChange={(e) =>
                  setNotifications({ ...notifications, digestFrequency: e.target.value as any })
                }
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="daily">Daily Summary</option>
                <option value="weekly">Weekly Summary</option>
                <option value="monthly">Monthly Summary</option>
              </select>
            </div>

            <div className="pt-4">
              <button onClick={handleNotificationSave} disabled={isSaving} className="btn-primary">
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>

        {/* Security Information */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <ShieldCheckIcon className="h-5 w-5 mr-2 text-gray-400" />
              Security Information
            </h2>
          </div>

          <div className="px-6 py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex">
                <CheckIcon className="h-5 w-5 text-green-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Two-Factor Authentication Enabled
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    Your account is protected with 2FA. Last verified: 2 days ago
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Password</h3>
                <p className="mt-1 text-sm text-gray-600">Last changed 45 days ago</p>
                <button className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
                  Change Password
                </button>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900">Active Sessions</h3>
                <p className="mt-1 text-sm text-gray-600">
                  You are currently signed in on 2 devices
                </p>
                <button className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
                  Manage Sessions
                </button>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900">Login History</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Last login: Today at 9:15 AM from New York, NY
                </p>
                <button className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View Full History
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
