'use client';

import {
  ArrowDownIcon,
  ArrowTrendingUpIcon,
  ArrowUpIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface PartnerMetrics {
  partnerId: string;
  partnerName: string;
  partnershipType: string;
  revenue: {
    current: number;
    previous: number;
    growth: number;
  };
  projects: {
    completed: number;
    active: number;
    pipeline: number;
  };
  clients: {
    total: number;
    new: number;
    retained: number;
  };
  performance: {
    conversionRate: number;
    avgProjectValue: number;
    avgTimeToClose: number;
    clientSatisfaction: number;
  };
}

export default function PartnerPerformance() {
  const [timeRange, setTimeRange] = useState('quarter');
  const [sortBy, setSortBy] = useState('revenue');

  // Mock data based on documentation's partnership success metrics
  const partnerMetrics: PartnerMetrics[] = [
    {
      partnerId: '1',
      partnerName: 'Anderson & Associates CPA',
      partnershipType: 'White-Label',
      revenue: {
        current: 125000,
        previous: 95000,
        growth: 31.6,
      },
      projects: {
        completed: 8,
        active: 3,
        pipeline: 5,
      },
      clients: {
        total: 12,
        new: 4,
        retained: 8,
      },
      performance: {
        conversionRate: 68,
        avgProjectValue: 37500,
        avgTimeToClose: 21,
        clientSatisfaction: 4.8,
      },
    },
    {
      partnerId: '2',
      partnerName: 'TechAudit Partners',
      partnershipType: 'Joint Venture',
      revenue: {
        current: 95000,
        previous: 72000,
        growth: 31.9,
      },
      projects: {
        completed: 5,
        active: 2,
        pipeline: 3,
      },
      clients: {
        total: 8,
        new: 3,
        retained: 5,
      },
      performance: {
        conversionRate: 75,
        avgProjectValue: 40000,
        avgTimeToClose: 18,
        clientSatisfaction: 4.9,
      },
    },
    {
      partnerId: '3',
      partnerName: 'Compliance First LLC',
      partnershipType: 'Subcontractor',
      revenue: {
        current: 45000,
        previous: 38000,
        growth: 18.4,
      },
      projects: {
        completed: 3,
        active: 1,
        pipeline: 2,
      },
      clients: {
        total: 5,
        new: 2,
        retained: 3,
      },
      performance: {
        conversionRate: 60,
        avgProjectValue: 35000,
        avgTimeToClose: 25,
        clientSatisfaction: 4.6,
      },
    },
    {
      partnerId: '4',
      partnerName: 'Regional Business Advisors',
      partnershipType: 'Referral',
      revenue: {
        current: 67500,
        previous: 52500,
        growth: 28.6,
      },
      projects: {
        completed: 10,
        active: 0,
        pipeline: 8,
      },
      clients: {
        total: 15,
        new: 6,
        retained: 9,
      },
      performance: {
        conversionRate: 45,
        avgProjectValue: 15000,
        avgTimeToClose: 30,
        clientSatisfaction: 4.7,
      },
    },
  ];

  const sortedMetrics = [...partnerMetrics].sort((a, b) => {
    switch (sortBy) {
      case 'revenue':
        return b.revenue.current - a.revenue.current;
      case 'growth':
        return b.revenue.growth - a.revenue.growth;
      case 'projects':
        return (
          b.projects.completed + b.projects.active - (a.projects.completed + a.projects.active)
        );
      case 'conversion':
        return b.performance.conversionRate - a.performance.conversionRate;
      default:
        return 0;
    }
  });

  const totalMetrics = {
    revenue: partnerMetrics.reduce((sum, p) => sum + p.revenue.current, 0),
    previousRevenue: partnerMetrics.reduce((sum, p) => sum + p.revenue.previous, 0),
    projects: partnerMetrics.reduce((sum, p) => sum + p.projects.completed + p.projects.active, 0),
    clients: partnerMetrics.reduce((sum, p) => sum + p.clients.total, 0),
    avgConversion:
      partnerMetrics.reduce((sum, p) => sum + p.performance.conversionRate, 0) /
      partnerMetrics.length,
  };

  const overallGrowth =
    ((totalMetrics.revenue - totalMetrics.previousRevenue) / totalMetrics.previousRevenue) * 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Revenue</span>
            <div
              className={`flex items-center gap-1 text-sm ${overallGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {overallGrowth > 0 ? (
                <ArrowUpIcon className="h-4 w-4" />
              ) : (
                <ArrowDownIcon className="h-4 w-4" />
              )}
              {overallGrowth.toFixed(1)}%
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${(totalMetrics.revenue / 1000).toFixed(0)}k
          </p>
          <p className="text-xs text-gray-500 mt-1">This {timeRange}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Active Projects</span>
            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalMetrics.projects}</p>
          <p className="text-xs text-gray-500 mt-1">Across all partners</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Clients</span>
            <UserGroupIcon className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalMetrics.clients}</p>
          <p className="text-xs text-gray-500 mt-1">Partner-sourced</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Conversion</span>
            <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {totalMetrics.avgConversion.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Lead to client</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="revenue">Sort by Revenue</option>
            <option value="growth">Sort by Growth</option>
            <option value="projects">Sort by Projects</option>
            <option value="conversion">Sort by Conversion</option>
          </select>
        </div>

        <button className="btn-secondary">Export Report</button>
      </div>

      <div className="space-y-4">
        {sortedMetrics.map((partner) => (
          <div key={partner.partnerId} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{partner.partnerName}</h3>
                <p className="text-sm text-gray-600">{partner.partnershipType} Partner</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  ${(partner.revenue.current / 1000).toFixed(0)}k
                </p>
                <div
                  className={`flex items-center justify-end gap-1 text-sm ${partner.revenue.growth > 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {partner.revenue.growth > 0 ? (
                    <ArrowUpIcon className="h-4 w-4" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4" />
                  )}
                  {partner.revenue.growth.toFixed(1)}% from last period
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <DocumentTextIcon className="h-4 w-4" />
                  Projects
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {partner.projects.completed + partner.projects.active}
                </p>
                <p className="text-xs text-gray-500">
                  {partner.projects.active} active, {partner.projects.pipeline} pipeline
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <UserGroupIcon className="h-4 w-4" />
                  Clients
                </div>
                <p className="text-lg font-semibold text-gray-900">{partner.clients.total}</p>
                <p className="text-xs text-gray-500">
                  {partner.clients.new} new, {partner.clients.retained} retained
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <ArrowTrendingUpIcon className="h-4 w-4" />
                  Conversion
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {partner.performance.conversionRate}%
                </p>
                <p className="text-xs text-gray-500">Lead to client rate</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <ClockIcon className="h-4 w-4" />
                  Avg Close Time
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {partner.performance.avgTimeToClose} days
                </p>
                <p className="text-xs text-gray-500">Deal velocity</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-gray-600">Avg Project Value:</span>
                    <span className="font-medium text-gray-900 ml-1">
                      ${partner.performance.avgProjectValue.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Client Satisfaction:</span>
                    <span className="font-medium text-gray-900 ml-1">
                      {partner.performance.clientSatisfaction}/5.0
                    </span>
                  </div>
                </div>
                <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  View Details →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Performance Insights</h4>
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p className="font-medium mb-1">Top Performing Categories:</p>
            <ul className="space-y-1 ml-4">
              <li>• Joint Venture partners show highest conversion rates (75%)</li>
              <li>• White-Label partners generate most revenue volume</li>
              <li>• Referral partners provide steady lead flow</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">Recommendations:</p>
            <ul className="space-y-1 ml-4">
              <li>• Expand Joint Venture partnerships in tech sector</li>
              <li>• Provide additional training for Subcontractor partners</li>
              <li>• Implement automated lead distribution system</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
