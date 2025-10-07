'use client';

import {
  ChartBarIcon,
  CogIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import ComplianceMetrics from '@/components/analytics/ComplianceMetrics';
import ExecutiveDashboard from '@/components/analytics/ExecutiveDashboard';
import OperationalInsights from '@/components/analytics/OperationalInsights';
import RevenueAnalytics from '@/components/analytics/RevenueAnalytics';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('executive');

  const tabs = [
    { id: 'executive', name: 'Executive Dashboard', icon: ChartBarIcon },
    { id: 'compliance', name: 'Compliance Metrics', icon: ShieldCheckIcon },
    { id: 'revenue', name: 'Revenue Analytics', icon: CurrencyDollarIcon },
    { id: 'operational', name: 'Operational Insights', icon: CogIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Intelligence</h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time insights into compliance, revenue, and operational performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            <option>Last 30 Days</option>
            <option>Last Quarter</option>
            <option>Year to Date</option>
            <option>Last Year</option>
          </select>
          <button className="btn-primary">Export Report</button>
        </div>
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
        {activeTab === 'executive' && <ExecutiveDashboard />}
        {activeTab === 'compliance' && <ComplianceMetrics />}
        {activeTab === 'revenue' && <RevenueAnalytics />}
        {activeTab === 'operational' && <OperationalInsights />}
      </div>
    </div>
  );
}
