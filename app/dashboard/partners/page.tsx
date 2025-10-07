'use client';

import {
  ChartBarIcon,
  CurrencyDollarIcon,
  FolderIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import PartnerCommissions from '@/components/partners/PartnerCommissions';
import PartnerList from '@/components/partners/PartnerList';
import PartnerPerformance from '@/components/partners/PartnerPerformance';
import PartnerResources from '@/components/partners/PartnerResources';

export default function PartnersPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', name: 'Partner Overview', icon: UserGroupIcon },
    { id: 'performance', name: 'Performance', icon: ChartBarIcon },
    { id: 'commissions', name: 'Commissions', icon: CurrencyDollarIcon },
    { id: 'resources', name: 'Resources', icon: FolderIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner Portal</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage CPA partnerships and track performance
          </p>
        </div>
        <button className="btn-primary">Invite Partner</button>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon
                  className={`mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-primary-500' : 'text-gray-400'}`}
                />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === 'overview' && <PartnerList />}
        {activeTab === 'performance' && <PartnerPerformance />}
        {activeTab === 'commissions' && <PartnerCommissions />}
        {activeTab === 'resources' && <PartnerResources />}
      </div>
    </div>
  );
}
