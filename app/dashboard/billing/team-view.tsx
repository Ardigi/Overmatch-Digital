'use client';

import {
  CalculatorIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import BillingHeader from '@/components/billing/BillingHeader';
import InvoicesList from '@/components/billing/InvoicesList';
import PricingCalculator from '@/components/billing/PricingCalculator';
import RecurringRevenue from '@/components/billing/RecurringRevenue';

export default function TeamBillingPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'invoices', name: 'Invoices', icon: DocumentTextIcon },
    { id: 'calculator', name: 'SOC Calculator', icon: CalculatorIcon },
    { id: 'recurring', name: 'Recurring Revenue', icon: CurrencyDollarIcon },
  ];

  return (
    <div className="space-y-6">
      <BillingHeader />

      <div className="bg-white shadow-sm rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex gap-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${
                      activeTab === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <BillingOverview />}
          {activeTab === 'invoices' && <InvoicesList />}
          {activeTab === 'calculator' && <PricingCalculator />}
          {activeTab === 'recurring' && <RecurringRevenue />}
        </div>
      </div>
    </div>
  );
}

function BillingOverview() {
  const monthlyStats = [
    { month: 'Jan', revenue: 285000, invoices: 23, collections: 272000 },
    { month: 'Feb', revenue: 310000, invoices: 26, collections: 298000 },
    { month: 'Mar', revenue: 325000, invoices: 28, collections: 315000 },
    { month: 'Apr', revenue: 342000, invoices: 31, collections: 335000 },
    { month: 'May', revenue: 365000, invoices: 34, collections: 358000 },
    { month: 'Jun', revenue: 378000, invoices: 36, collections: 370000 },
  ];

  const outstandingInvoices = [
    { client: 'TechCorp Solutions', amount: 35000, daysOverdue: 15, type: 'SOC2 Type II' },
    {
      client: 'Financial Services Inc',
      amount: 25000,
      daysOverdue: 8,
      type: 'Readiness Assessment',
    },
    { client: 'Healthcare Data Systems', amount: 45000, daysOverdue: 22, type: 'SOC2 Type II' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 6 Months)</h3>
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="grid grid-cols-6 gap-4">
            {monthlyStats.map((stat) => (
              <div key={stat.month} className="text-center">
                <div className="text-sm text-gray-600 mb-2">{stat.month}</div>
                <div className="text-xl font-bold text-gray-900">
                  ${(stat.revenue / 1000).toFixed(0)}k
                </div>
                <div className="text-xs text-gray-500 mt-1">{stat.invoices} invoices</div>
                <div className="mt-2 h-32 bg-primary-100 rounded relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-primary-600 rounded transition-all"
                    style={{ height: `${(stat.revenue / 400000) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding Invoices</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-red-800">Total Outstanding</p>
              <p className="text-2xl font-bold text-red-900">$105,000</p>
            </div>
            <button className="btn-primary">Send Reminders</button>
          </div>
          <div className="space-y-3">
            {outstandingInvoices.map((invoice, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-t border-red-200"
              >
                <div>
                  <p className="font-medium text-gray-900">{invoice.client}</p>
                  <p className="text-sm text-gray-600">{invoice.type}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${invoice.amount.toLocaleString()}</p>
                  <p className="text-sm text-red-600">{invoice.daysOverdue} days overdue</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-600">Average Invoice Value</h4>
          <p className="text-2xl font-bold text-gray-900 mt-2">$12,450</p>
          <p className="text-sm text-green-600 mt-1">+8.3% from last quarter</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-600">Collection Rate</h4>
          <p className="text-2xl font-bold text-gray-900 mt-2">96.5%</p>
          <p className="text-sm text-gray-600 mt-1">30-day average</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-600">Next Month Projected</h4>
          <p className="text-2xl font-bold text-gray-900 mt-2">$395,000</p>
          <p className="text-sm text-gray-600 mt-1">Based on contracts</p>
        </div>
      </div>
    </div>
  );
}
