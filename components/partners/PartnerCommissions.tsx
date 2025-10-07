'use client';

import {
  ArrowDownTrayIcon,
  BanknotesIcon,
  CalculatorIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface Commission {
  id: string;
  partnerId: string;
  partnerName: string;
  projectName: string;
  clientName: string;
  projectValue: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'pending' | 'approved' | 'paid' | 'hold';
  invoiceNumber?: string;
  dueDate: string;
  paidDate?: string;
  notes?: string;
}

interface CommissionSummary {
  partnerId: string;
  partnerName: string;
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  totalLifetime: number;
  averageCommissionRate: number;
}

export default function PartnerCommissions() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPartner, setFilterPartner] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Mock data based on documentation's commission structure
  const commissions: Commission[] = [
    {
      id: '1',
      partnerId: '1',
      partnerName: 'Anderson & Associates CPA',
      projectName: 'GlobalTech SOC 2 Type II',
      clientName: 'GlobalTech Industries',
      projectValue: 125000,
      commissionRate: 30,
      commissionAmount: 37500,
      status: 'pending',
      dueDate: '2024-08-15',
      notes: 'Milestone 1 completion - Readiness Assessment',
    },
    {
      id: '2',
      partnerId: '2',
      partnerName: 'TechAudit Partners',
      projectName: 'CloudServe SOC 2 + ISO 27001',
      clientName: 'CloudServe Technologies',
      projectValue: 150000,
      commissionRate: 40,
      commissionAmount: 60000,
      status: 'approved',
      invoiceNumber: 'INV-2024-0234',
      dueDate: '2024-07-30',
    },
    {
      id: '3',
      partnerId: '1',
      partnerName: 'Anderson & Associates CPA',
      projectName: 'FinanceFlow SOC 1 Type I',
      clientName: 'FinanceFlow Systems',
      projectValue: 85000,
      commissionRate: 30,
      commissionAmount: 25500,
      status: 'paid',
      invoiceNumber: 'INV-2024-0198',
      dueDate: '2024-06-30',
      paidDate: '2024-06-28',
    },
    {
      id: '4',
      partnerId: '3',
      partnerName: 'Compliance First LLC',
      projectName: 'DataVault Readiness Assessment',
      clientName: 'DataVault Inc',
      projectValue: 35000,
      commissionRate: 25,
      commissionAmount: 8750,
      status: 'approved',
      invoiceNumber: 'INV-2024-0245',
      dueDate: '2024-07-25',
    },
    {
      id: '5',
      partnerId: '4',
      partnerName: 'Regional Business Advisors',
      projectName: 'SecureNet SOC 2 Type II',
      clientName: 'SecureNet Corp',
      projectValue: 95000,
      commissionRate: 15,
      commissionAmount: 14250,
      status: 'pending',
      dueDate: '2024-08-01',
    },
    {
      id: '6',
      partnerId: '2',
      partnerName: 'TechAudit Partners',
      projectName: 'InnovateTech SOC 2 Type I',
      clientName: 'InnovateTech Solutions',
      projectValue: 75000,
      commissionRate: 40,
      commissionAmount: 30000,
      status: 'paid',
      invoiceNumber: 'INV-2024-0156',
      dueDate: '2024-05-31',
      paidDate: '2024-05-30',
    },
  ];

  const getStatusColor = (status: Commission['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'hold':
        return 'bg-red-100 text-red-800';
    }
  };

  const getStatusIcon = (status: Commission['status']) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4" />;
      case 'approved':
      case 'paid':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'hold':
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  const filteredCommissions = commissions.filter((commission) => {
    const matchesStatus = filterStatus === 'all' || commission.status === filterStatus;
    const matchesPartner = filterPartner === 'all' || commission.partnerId === filterPartner;
    return matchesStatus && matchesPartner;
  });

  // Calculate summaries
  const partners = Array.from(new Set(commissions.map((c) => c.partnerId)));
  const summaries: CommissionSummary[] = partners.map((partnerId) => {
    const partnerCommissions = commissions.filter((c) => c.partnerId === partnerId);
    const partnerName = partnerCommissions[0]?.partnerName || '';

    return {
      partnerId,
      partnerName,
      totalPending: partnerCommissions
        .filter((c) => c.status === 'pending')
        .reduce((sum, c) => sum + c.commissionAmount, 0),
      totalApproved: partnerCommissions
        .filter((c) => c.status === 'approved')
        .reduce((sum, c) => sum + c.commissionAmount, 0),
      totalPaid: partnerCommissions
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + c.commissionAmount, 0),
      totalLifetime: partnerCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
      averageCommissionRate:
        partnerCommissions.reduce((sum, c) => sum + c.commissionRate, 0) /
        partnerCommissions.length,
    };
  });

  const totals = {
    pending: commissions
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.commissionAmount, 0),
    approved: commissions
      .filter((c) => c.status === 'approved')
      .reduce((sum, c) => sum + c.commissionAmount, 0),
    paid: commissions
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + c.commissionAmount, 0),
    total: commissions.reduce((sum, c) => sum + c.commissionAmount, 0),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ClockIcon className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(totals.pending / 1000).toFixed(1)}k
              </p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(totals.approved / 1000).toFixed(1)}k
              </p>
              <p className="text-sm text-gray-600">Approved</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <BanknotesIcon className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(totals.paid / 1000).toFixed(1)}k
              </p>
              <p className="text-sm text-gray-600">Paid (YTD)</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CurrencyDollarIcon className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(totals.total / 1000).toFixed(1)}k
              </p>
              <p className="text-sm text-gray-600">Total Commissions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="hold">On Hold</option>
          </select>

          <select
            value={filterPartner}
            onChange={(e) => setFilterPartner(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Partners</option>
            {summaries.map((summary) => (
              <option key={summary.partnerId} value={summary.partnerId}>
                {summary.partnerName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowPaymentModal(true)} className="btn-primary">
            Process Payments
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Commission Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCommissions.map((commission) => (
              <tr key={commission.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{commission.partnerName}</p>
                    <p className="text-sm text-gray-600">{commission.clientName}</p>
                    {commission.invoiceNumber && (
                      <p className="text-xs text-gray-500 mt-1">
                        Invoice: {commission.invoiceNumber}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm text-gray-900">{commission.projectName}</p>
                    <p className="text-xs text-gray-500">
                      ${commission.projectValue.toLocaleString()} @ {commission.commissionRate}%
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-gray-900">
                    ${commission.commissionAmount.toLocaleString()}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(commission.status)}`}
                    >
                      {getStatusIcon(commission.status)}
                      {commission.status}
                    </span>
                  </div>
                  {commission.paidDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Paid: {format(new Date(commission.paidDate), 'MMM d, yyyy')}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-sm">
                    <CalendarIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">
                      {format(new Date(commission.dueDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {commission.status === 'pending' && (
                      <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        Approve
                      </button>
                    )}
                    {commission.status === 'approved' && (
                      <button className="text-green-600 hover:text-green-700 text-sm font-medium">
                        Mark Paid
                      </button>
                    )}
                    <button className="text-gray-600 hover:text-gray-700 text-sm font-medium">
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Partner Commission Summary</h3>
          <div className="space-y-3">
            {summaries.map((summary) => (
              <div
                key={summary.partnerId}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{summary.partnerName}</p>
                    <p className="text-sm text-gray-600">
                      Average rate: {summary.averageCommissionRate.toFixed(0)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      ${summary.totalLifetime.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">lifetime earnings</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Pending</p>
                    <p className="font-medium text-yellow-600">
                      ${summary.totalPending.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Approved</p>
                    <p className="font-medium text-blue-600">
                      ${summary.totalApproved.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Paid</p>
                    <p className="font-medium text-green-600">
                      ${summary.totalPaid.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
