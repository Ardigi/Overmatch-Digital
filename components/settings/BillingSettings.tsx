'use client';

import {
  ArrowDownTrayIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import React, { useState } from 'react';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank';
  name: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  description: string;
}

interface Subscription {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'annual';
  status: 'active' | 'canceled' | 'past_due';
  nextBillingDate: string;
  features: string[];
}

export default function BillingSettings() {
  const [activeTab, setActiveTab] = useState('overview');

  const currentPlan: Subscription = {
    id: '1',
    name: 'Professional Plan',
    price: 499,
    interval: 'monthly',
    status: 'active',
    nextBillingDate: '2024-08-01',
    features: [
      'Unlimited SOC 2 audits',
      'Up to 50 client accounts',
      'Advanced compliance automation',
      'Priority support',
      'API access',
    ],
  };

  const paymentMethods: PaymentMethod[] = [
    {
      id: '1',
      type: 'card',
      name: 'Visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true,
    },
    {
      id: '2',
      type: 'bank',
      name: 'Chase Business',
      last4: '6789',
      isDefault: false,
    },
  ];

  const invoices: Invoice[] = [
    {
      id: '1',
      number: 'INV-2024-07',
      date: '2024-07-01',
      dueDate: '2024-07-01',
      amount: 499,
      status: 'paid',
      description: 'Professional Plan - July 2024',
    },
    {
      id: '2',
      number: 'INV-2024-06',
      date: '2024-06-01',
      dueDate: '2024-06-01',
      amount: 499,
      status: 'paid',
      description: 'Professional Plan - June 2024',
    },
    {
      id: '3',
      number: 'INV-2024-05',
      date: '2024-05-01',
      dueDate: '2024-05-01',
      amount: 499,
      status: 'paid',
      description: 'Professional Plan - May 2024',
    },
  ];

  const usageMetrics = {
    clients: { used: 32, limit: 50 },
    audits: { used: 145, limit: 'Unlimited' },
    storage: { used: 67, limit: 100 },
    apiCalls: { used: 45000, limit: 100000 },
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
      case 'past_due':
        return 'bg-red-100 text-red-800';
      case 'canceled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'invoices', name: 'Invoices' },
    { id: 'payment', name: 'Payment Methods' },
    { id: 'usage', name: 'Usage' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Billing & Subscription</h3>
          <div className="flex items-center gap-2 mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="p-6">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg p-6 text-white mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-2xl font-bold mb-2">{currentPlan.name}</h4>
                  <p className="text-primary-100 mb-4">
                    ${currentPlan.price}/{currentPlan.interval === 'monthly' ? 'month' : 'year'}
                  </p>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white`}
                    >
                      {currentPlan.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-primary-100">
                      Next billing: {format(new Date(currentPlan.nextBillingDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                <button className="btn-secondary bg-white text-primary-600 hover:bg-primary-50">
                  Change Plan
                </button>
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-3">Current Plan Features</h5>
              <ul className="space-y-2">
                {currentPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Current Period</p>
                <p className="text-2xl font-bold text-gray-900">$499.00</p>
                <p className="text-sm text-gray-500">July 1 - July 31, 2024</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Spent (YTD)</p>
                <p className="text-2xl font-bold text-gray-900">$3,493.00</p>
                <p className="text-sm text-gray-500">Since January 2024</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{invoice.number}</p>
                            <p className="text-xs text-gray-500">{invoice.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {format(new Date(invoice.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        ${invoice.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="p-6">
            <div className="space-y-4 mb-6">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CreditCardIcon className="h-6 w-6 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {method.name} ending in {method.last4}
                      </p>
                      {method.type === 'card' && method.expiryMonth && method.expiryYear && (
                        <p className="text-sm text-gray-500">
                          Expires {method.expiryMonth}/{method.expiryYear}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {method.isDefault && (
                      <span className="px-2.5 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                        Default
                      </span>
                    )}
                    <button className="text-sm text-gray-600 hover:text-gray-700">Edit</button>
                    <button className="text-sm text-red-600 hover:text-red-700">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-secondary">Add Payment Method</button>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Client Accounts</span>
                  <span className="text-sm text-gray-500">
                    {usageMetrics.clients.used}/{usageMetrics.clients.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{
                      width: `${(usageMetrics.clients.used / usageMetrics.clients.limit) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Audits Completed</span>
                  <span className="text-sm text-gray-500">
                    {usageMetrics.audits.used}/{usageMetrics.audits.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Storage (GB)</span>
                  <span className="text-sm text-gray-500">
                    {usageMetrics.storage.used}/{usageMetrics.storage.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{
                      width: `${(usageMetrics.storage.used / usageMetrics.storage.limit) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">API Calls</span>
                  <span className="text-sm text-gray-500">
                    {usageMetrics.apiCalls.used.toLocaleString()}/
                    {usageMetrics.apiCalls.limit.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{
                      width: `${(usageMetrics.apiCalls.used / usageMetrics.apiCalls.limit) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Approaching Client Limit</p>
                  <p className="text-sm text-blue-800 mt-1">
                    You're using 64% of your client account limit. Consider upgrading to the
                    Enterprise plan for unlimited clients.
                  </p>
                  <button className="text-sm font-medium text-blue-700 hover:text-blue-800 mt-2">
                    View upgrade options →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">Need help with billing?</h4>
        <p className="text-sm text-yellow-800 mb-3">
          Our support team is available to assist with billing questions, plan changes, and payment
          issues.
        </p>
        <button className="btn-secondary text-yellow-900 border-yellow-300 hover:bg-yellow-100">
          Contact Support
        </button>
      </div>
    </div>
  );
}
