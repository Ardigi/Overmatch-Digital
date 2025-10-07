'use client';

import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  description: string;
  pdfUrl?: string;
}

// Mock data - would come from API
const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    date: '2024-01-15',
    dueDate: '2024-02-15',
    amount: 15000,
    status: 'paid',
    description: 'SOC 2 Type II Audit - Q1 2024',
    pdfUrl: '/invoices/INV-2024-001.pdf',
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    date: '2024-02-15',
    dueDate: '2024-03-15',
    amount: 5000,
    status: 'pending',
    description: 'SOC 2 Readiness Assessment',
    pdfUrl: '/invoices/INV-2024-002.pdf',
  },
  {
    id: '3',
    invoiceNumber: 'INV-2023-012',
    date: '2023-12-15',
    dueDate: '2024-01-15',
    amount: 12000,
    status: 'overdue',
    description: 'SOC 2 Type I Audit - Initial',
    pdfUrl: '/invoices/INV-2023-012.pdf',
  },
];

export default function ClientBillingView() {
  const [invoices] = useState<Invoice[]>(mockInvoices);
  const [selectedYear, setSelectedYear] = useState<string>('2024');

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'overdue':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    switch (status) {
      case 'paid':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'overdue':
        return `${baseClasses} bg-red-100 text-red-800`;
    }
  };

  const totalDue = invoices
    .filter((inv) => inv.status !== 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const years = [...new Set(invoices.map((inv) => new Date(inv.date).getFullYear()))];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and download your invoices and payment history
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentTextIcon className="h-8 w-8 text-gray-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Invoiced</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(invoices.reduce((sum, inv) => sum + inv.amount, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Paid</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(
                  invoices
                    .filter((inv) => inv.status === 'paid')
                    .reduce((sum, inv) => sum + inv.amount, 0)
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Outstanding</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalDue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Invoice History</h2>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="all">All Years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
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
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices
                .filter(
                  (inv) =>
                    selectedYear === 'all' ||
                    new Date(inv.date).getFullYear().toString() === selectedYear
                )
                .map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(invoice.status)}
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{invoice.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(invoice.date)}</div>
                      <div className="text-xs text-gray-500">
                        Due: {formatDate(invoice.dueDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(invoice.status)}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-primary-600 hover:text-primary-900 inline-flex items-center">
                        <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {invoices.length === 0 && (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No invoices found</p>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Need Help with Billing?</h3>
        <p className="text-sm text-blue-700 mb-4">
          For questions about invoices or payment methods, please contact our billing team.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="mailto:billing@overmatch.digital"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Contact Billing Support
          </a>
          <a
            href="/help/billing"
            className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
          >
            View Billing FAQ
          </a>
        </div>
      </div>
    </div>
  );
}
