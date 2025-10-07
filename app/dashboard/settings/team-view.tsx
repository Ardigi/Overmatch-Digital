'use client';

import {
  BellIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import BillingSettings from '@/components/settings/BillingSettings';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import OrganizationSettings from '@/components/settings/OrganizationSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import UserManagement from '@/components/settings/UserManagement';

export default function TeamSettingsPage() {
  const [activeTab, setActiveTab] = useState('organization');

  const tabs = [
    { id: 'organization', name: 'Organization', icon: BuildingOfficeIcon },
    { id: 'users', name: 'Users & Roles', icon: UsersIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'integrations', name: 'Integrations', icon: PuzzlePieceIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'billing', name: 'Billing & Plan', icon: CreditCardIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your organization, users, and system preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full group flex items-center px-3 py-2 text-sm font-medium rounded-lg
                    ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 ${activeTab === tab.id ? 'text-primary-700' : 'text-gray-400 group-hover:text-gray-500'}`}
                  />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="col-span-9">
          {activeTab === 'organization' && <OrganizationSettings />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'integrations' && <IntegrationSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'billing' && <BillingSettings />}
        </div>
      </div>
    </div>
  );
}
