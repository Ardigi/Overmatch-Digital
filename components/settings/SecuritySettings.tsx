'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  KeyIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import SessionManagement from './SessionManagement';

export default function SecuritySettings() {
  const [settings, setSettings] = useState({
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      expirationDays: 90,
      preventReuse: 5,
    },
    twoFactor: {
      required: true,
      allowSMS: false,
      allowApp: true,
      allowHardware: true,
    },
    sessionPolicy: {
      timeout: 30,
      maxConcurrent: 3,
      requireReauth: true,
    },
    ipWhitelist: {
      enabled: true,
      addresses: ['192.168.1.0/24', '10.0.0.0/8'],
    },
  });

  const securityEvents = [
    {
      id: '1',
      type: 'login',
      user: 'sarah.chen@overmatch.com',
      ip: '192.168.1.100',
      device: 'Chrome on Windows',
      timestamp: '2024-07-19T14:30:00',
      status: 'success',
    },
    {
      id: '2',
      type: 'password_change',
      user: 'michael.torres@overmatch.com',
      ip: '192.168.1.101',
      device: 'Safari on macOS',
      timestamp: '2024-07-19T10:15:00',
      status: 'success',
    },
    {
      id: '3',
      type: 'failed_login',
      user: 'unknown@external.com',
      ip: '45.67.89.10',
      device: 'Unknown',
      timestamp: '2024-07-18T22:45:00',
      status: 'blocked',
    },
    {
      id: '4',
      type: '2fa_enabled',
      user: 'lisa.martinez@overmatch.com',
      ip: '192.168.1.102',
      device: 'Firefox on Linux',
      timestamp: '2024-07-18T16:30:00',
      status: 'success',
    },
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <KeyIcon className="h-4 w-4" />;
      case 'password_change':
        return <LockClosedIcon className="h-4 w-4" />;
      case 'failed_login':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case '2fa_enabled':
        return <ShieldCheckIcon className="h-4 w-4" />;
      default:
        return <ShieldCheckIcon className="h-4 w-4" />;
    }
  };

  const getEventColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'blocked':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Password Policy */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Password Policy</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Password Length
              </label>
              <input
                type="number"
                value={settings.passwordPolicy.minLength}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordPolicy: {
                      ...settings.passwordPolicy,
                      minLength: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password Expiration (days)
              </label>
              <input
                type="number"
                value={settings.passwordPolicy.expirationDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordPolicy: {
                      ...settings.passwordPolicy,
                      expirationDays: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.passwordPolicy.requireUppercase}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordPolicy: {
                      ...settings.passwordPolicy,
                      requireUppercase: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Require uppercase letters</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.passwordPolicy.requireNumbers}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordPolicy: {
                      ...settings.passwordPolicy,
                      requireNumbers: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Require numbers</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.passwordPolicy.requireSpecialChars}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passwordPolicy: {
                      ...settings.passwordPolicy,
                      requireSpecialChars: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Require special characters</span>
            </label>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
        </div>
        <div className="p-6 space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.twoFactor.required}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  twoFactor: {
                    ...settings.twoFactor,
                    required: e.target.checked,
                  },
                })
              }
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Require 2FA for all users</span>
          </label>

          <div className="pl-7 space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.twoFactor.allowApp}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    twoFactor: {
                      ...settings.twoFactor,
                      allowApp: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">
                Allow authenticator apps (Google, Authy, etc.)
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.twoFactor.allowHardware}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    twoFactor: {
                      ...settings.twoFactor,
                      allowHardware: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Allow hardware keys (YubiKey, etc.)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.twoFactor.allowSMS}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    twoFactor: {
                      ...settings.twoFactor,
                      allowSMS: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Allow SMS (not recommended)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Session Management - Using our new SessionManagement component */}
      <SessionManagement />

      {/* Security Events */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Security Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {securityEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-2 ${getEventColor(event.status)}`}>
                      {getEventIcon(event.type)}
                      <span className="text-sm capitalize">{event.type.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{event.user}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{event.ip}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{event.device}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button className="btn-primary">Save Security Settings</button>
    </div>
  );
}
